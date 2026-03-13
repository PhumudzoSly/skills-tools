import { tool } from 'ai';
import { z } from 'zod';
import { normalizeSkillKey, scoreSkillCandidate, sortCandidatesByConfidence } from './scoring.js';
import { searchSkillsApi } from './skills-api.js';
import type {
  FindMode,
  FindSkillsOutput,
  FindToolConfig,
  PreconfiguredSkill,
  SkillCandidate,
} from './types.js';

const FindSkillsInputSchema = z.object({
  mode: z.enum(['preconfig', 'search']).optional(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function includesNormalized(haystack: string, needle: string): boolean {
  return normalizeSkillKey(haystack).includes(normalizeSkillKey(needle));
}

function preconfigToCandidate(skill: PreconfiguredSkill, query?: string): SkillCandidate {
  const isExact = query ? normalizeSkillKey(skill.name) === normalizeSkillKey(query) : false;
  const isContains = query ? includesNormalized(skill.name, query) : false;
  const confidence = isExact ? 1 : isContains ? 0.82 : 0.76;
  return {
    id: `${skill.source}/${skill.name}`,
    name: skill.name,
    source: skill.source,
    confidence,
    reason: isExact
      ? 'preconfigured-exact-match'
      : isContains
        ? 'preconfigured-name-contains-query'
        : 'preconfigured-skill',
    preferredPath: skill.preferredPath,
  };
}

function findPreconfiguredByName(
  preconfigured: PreconfiguredSkill[],
  candidateName: string
): PreconfiguredSkill | undefined {
  const key = normalizeSkillKey(candidateName);
  return preconfigured.find((skill) => {
    if (normalizeSkillKey(skill.name) === key) return true;
    return (skill.aliases ?? []).some((alias) => normalizeSkillKey(alias) === key);
  });
}

function findPreconfiguredMatches(
  preconfigured: PreconfiguredSkill[],
  query: string | undefined
): SkillCandidate[] {
  if (!query) {
    return preconfigured.map((skill) => preconfigToCandidate(skill));
  }

  const key = normalizeSkillKey(query);
  const matches = preconfigured.filter((skill) => {
    if (normalizeSkillKey(skill.name).includes(key)) return true;
    return (skill.aliases ?? []).some((alias) => normalizeSkillKey(alias).includes(key));
  });

  return matches.map((skill) => preconfigToCandidate(skill, query));
}

function closeScores(candidates: SkillCandidate[], closeScoreDelta: number): boolean {
  if (candidates.length < 2) return false;
  return candidates[0].confidence - candidates[1].confidence < closeScoreDelta;
}

function buildOutput(input: {
  mode: FindMode;
  message: string;
  candidates: SkillCandidate[];
  minConfidence: number;
  closeScoreDelta: number;
}): FindSkillsOutput {
  const sorted = sortCandidatesByConfidence(input.candidates);
  const recommended = sorted[0];

  const needsDisambiguation =
    sorted.length === 0 ||
    !recommended ||
    recommended.confidence < input.minConfidence ||
    closeScores(sorted, input.closeScoreDelta);

  return {
    ok: sorted.length > 0,
    mode: input.mode,
    message: input.message,
    recommended,
    candidates: sorted,
    needsDisambiguation,
  };
}

export function createFindSkillsTool(config: FindToolConfig = {}) {
  const defaultMode = config.defaultMode ?? 'search';
  const allowedModes = config.allowedModes ?? ['preconfig', 'search'];
  const rankingStrategy = config.rankingStrategy ?? 'hybrid';
  const searchLimit = Math.max(1, Math.min(25, config.searchLimit ?? 10));
  const minConfidence = config.minConfidence ?? 0.68;
  const closeScoreDelta = config.closeScoreDelta ?? 0.08;
  const preconfiguredSkills = config.preconfiguredSkills ?? [];

  return tool({
    description:
      'Find skills using either preconfigured mode or search mode. Returns ranked candidates and a recommended pick.',
    inputSchema: FindSkillsInputSchema,
    execute: async (input) => {
      const mode = (input.mode ?? defaultMode) as FindMode;
      if (!allowedModes.includes(mode)) {
        return buildOutput({
          mode,
          message: `Mode ${mode} is disabled. Allowed modes: ${allowedModes.join(', ')}`,
          candidates: [],
          minConfidence,
          closeScoreDelta,
        });
      }

      const query = input.query?.trim();
      const limit = Math.max(1, Math.min(25, input.limit ?? searchLimit));

      if (mode === 'preconfig') {
        const matches = findPreconfiguredMatches(preconfiguredSkills, query).slice(0, limit);
        if (matches.length === 0) {
          return buildOutput({
            mode,
            message: query
              ? `No preconfigured skills match "${query}"`
              : 'No preconfigured skills were provided in config',
            candidates: [],
            minConfidence,
            closeScoreDelta,
          });
        }

        return buildOutput({
          mode,
          message: query
            ? `Found ${matches.length} preconfigured match(es)`
            : `Listed ${matches.length} preconfigured skill(s)`,
          candidates: matches,
          minConfidence,
          closeScoreDelta,
        });
      }

      if (!query || query.length < 2) {
        return buildOutput({
          mode,
          message: 'Search mode requires query with at least 2 characters',
          candidates: [],
          minConfidence,
          closeScoreDelta,
        });
      }

      let records;
      try {
        records = await searchSkillsApi({
          query,
          limit,
          baseUrl: config.skillsApiBaseUrl,
          fetchFn: config.fetchFn,
        });
      } catch (error) {
        return buildOutput({
          mode,
          message: error instanceof Error ? error.message : 'Failed to query search API',
          candidates: [],
          minConfidence,
          closeScoreDelta,
        });
      }

      const scored: SkillCandidate[] = records.map((record) => {
        const baseScore = scoreSkillCandidate({
          query,
          name: record.name,
          description: record.description,
          installs: record.installs,
        });

        const preconfigured = findPreconfiguredByName(preconfiguredSkills, record.name);
        const sourceBoost = preconfigured && preconfigured.source === record.source ? 0.08 : 0;
        const confidence = clamp01(baseScore.confidence + sourceBoost);

        return {
          id: record.id,
          slug: record.id,
          name: record.name,
          source: record.source,
          installs: record.installs,
          description: record.description,
          confidence: Number(confidence.toFixed(4)),
          reason:
            sourceBoost > 0 ? `${baseScore.reason}, preconfigured-source-bonus` : baseScore.reason,
          preferredPath: preconfigured?.preferredPath,
        };
      });

      let sorted = sortCandidatesByConfidence(scored);

      const shouldRunAiRanking =
        rankingStrategy === 'ai' ||
        (rankingStrategy === 'hybrid' &&
          (sorted.length === 0 ||
            sorted[0].confidence < minConfidence ||
            closeScores(sorted, closeScoreDelta)));

      if (shouldRunAiRanking && config.aiRanker && sorted.length > 0) {
        try {
          const decision = await config.aiRanker({
            query,
            candidates: sorted.slice(0, 5),
          });

          if (decision?.name) {
            const selected = sorted.find((candidate) => {
              const nameMatch =
                normalizeSkillKey(candidate.name) === normalizeSkillKey(decision.name);
              const sourceMatch = decision.source
                ? normalizeSkillKey(candidate.source) === normalizeSkillKey(decision.source)
                : true;
              return nameMatch && sourceMatch;
            });

            if (selected) {
              const others = sorted.filter((candidate) => candidate !== selected);
              selected.reason = decision.reason
                ? `${selected.reason}, ai-selected(${decision.reason})`
                : `${selected.reason}, ai-selected`;
              if (typeof decision.confidence === 'number') {
                selected.confidence = Number(clamp01(decision.confidence).toFixed(4));
              }
              sorted = [selected, ...others];
            }
          }
        } catch {
          // If the AI ranker fails we keep deterministic ranking results.
        }
      }

      return buildOutput({
        mode,
        message: `Found ${sorted.length} candidate skill(s)`,
        candidates: sorted,
        minConfidence,
        closeScoreDelta,
      });
    },
  });
}
