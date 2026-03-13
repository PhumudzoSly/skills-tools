import { tool } from 'ai';
import { z } from 'zod';
import { readSkillMarkdown } from './github-skill-reader.js';
import { inferSkillNameFromSlug, normalizeSkillKey } from './scoring.js';
import type { PreconfiguredSkill, ReadSkillOutput, ReadToolConfig } from './types.js';

const ReadSkillInputSchema = z.object({
  source: z.string().optional(),
  skillName: z.string().optional(),
  slug: z.string().optional(),
  preferredPath: z.string().optional(),
  maxChars: z.number().int().min(1000).max(120000).optional(),
});

function trimContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n\n[TRUNCATED:${content.length - maxChars} chars omitted]`;
}

function findPreconfiguredSkill(
  preconfiguredSkills: PreconfiguredSkill[],
  skillName: string | undefined,
  slug: string | undefined
): PreconfiguredSkill | undefined {
  const byName = normalizeSkillKey(skillName ?? '');
  const bySlug = normalizeSkillKey(inferSkillNameFromSlug(slug) ?? '');

  return preconfiguredSkills.find((skill) => {
    const skillKey = normalizeSkillKey(skill.name);
    if (byName && skillKey === byName) return true;
    if (bySlug && skillKey === bySlug) return true;
    return (skill.aliases ?? []).some((alias) => {
      const aliasKey = normalizeSkillKey(alias);
      return (byName && aliasKey === byName) || (bySlug && aliasKey === bySlug);
    });
  });
}

function buildContextPatch(input: {
  name: string;
  source: string;
  branch: string;
  path: string;
  markdown: string;
}): string {
  return [
    `ACTIVE SKILL: ${input.name}`,
    `SOURCE: ${input.source}`,
    `REF: ${input.branch}`,
    `PATH: ${input.path}`,
    '',
    input.markdown,
  ].join('\n');
}

function buildError(message: string): ReadSkillOutput {
  return {
    ok: false,
    message,
  };
}

export function createReadSkillTool(config: ReadToolConfig = {}) {
  const maxChars = config.maxChars ?? 18000;
  const maxCandidatesToRead = config.maxCandidatesToRead ?? 20;
  const preconfiguredSkills = config.preconfiguredSkills ?? [];

  return tool({
    description:
      'Read a SKILL.md file by source+name or slug and return markdown content for model context.',
    inputSchema: ReadSkillInputSchema,
    execute: async (input) => {
      const requestedName = input.skillName?.trim() || inferSkillNameFromSlug(input.slug);
      const preconfigured = findPreconfiguredSkill(preconfiguredSkills, requestedName, input.slug);

      const source = input.source?.trim() || preconfigured?.source;
      if (!source) {
        return buildError(
          'Missing source. Provide source (owner/repo) or configure the skill in preconfiguredSkills.'
        );
      }

      const preferredPath = input.preferredPath ?? preconfigured?.preferredPath;

      let resolved;
      try {
        resolved = await readSkillMarkdown({
          source,
          skillName: requestedName,
          slug: input.slug,
          preferredPath,
          maxCandidatesToRead,
          fetchFn: config.fetchFn,
          githubToken: config.githubToken,
        });
      } catch (error) {
        return buildError(error instanceof Error ? error.message : 'Failed to read skill markdown');
      }

      if (!resolved) {
        const nameOrSlug = requestedName ?? input.slug ?? '(unspecified)';
        return buildError(`Could not resolve SKILL.md for ${nameOrSlug} in ${source}`);
      }

      const finalMaxChars = input.maxChars ?? maxChars;
      const markdown = trimContent(resolved.content, finalMaxChars);
      const contextPatch = buildContextPatch({
        name: resolved.name,
        source: resolved.source,
        branch: resolved.branch,
        path: resolved.path,
        markdown,
      });

      return {
        ok: true,
        message: `Loaded skill ${resolved.name} from ${resolved.source}`,
        selected: {
          name: resolved.name,
          source: resolved.source,
          path: resolved.path,
          branch: resolved.branch,
          description: resolved.description,
        },
        contextPatch,
        skillMarkdown: markdown,
      } satisfies ReadSkillOutput;
    },
  });
}
