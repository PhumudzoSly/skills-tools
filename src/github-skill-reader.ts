import matter from 'gray-matter';
import { inferSkillNameFromSlug, normalizeSkillKey } from './scoring.js';
import type { ResolvedSkillMarkdown } from './types.js';

interface GitHubTreeResponse {
  tree?: Array<{ path?: string; type?: string }>;
}

function parseOwnerRepo(source: string): { owner: string; repo: string } | null {
  const match = source.match(/^([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/i, ''),
  };
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function safeNormalizePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return normalized;

  const segments = normalized.split('/');
  if (segments.includes('..')) {
    throw new Error('Invalid preferredPath: cannot contain ".." segments');
  }

  return normalized.endsWith('SKILL.md') ? normalized : `${normalized}/SKILL.md`;
}

async function listSkillPaths(options: {
  owner: string;
  repo: string;
  branch: string;
  fetchFn: typeof fetch;
  token?: string;
}): Promise<string[]> {
  const url = `https://api.github.com/repos/${options.owner}/${options.repo}/git/trees/${options.branch}?recursive=1`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'vercel-skills-tools',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await options.fetchFn(url, { headers });
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as GitHubTreeResponse;
  if (!Array.isArray(data.tree)) return [];

  return data.tree
    .filter((entry) => entry.type === 'blob' && typeof entry.path === 'string')
    .map((entry) => entry.path as string)
    .filter((path) => path.endsWith('/SKILL.md') || path === 'SKILL.md');
}

async function fetchRawFile(options: {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  fetchFn: typeof fetch;
}): Promise<string | null> {
  const encodedPath = encodePath(options.path);
  const rawUrl = `https://raw.githubusercontent.com/${options.owner}/${options.repo}/${options.branch}/${encodedPath}`;
  const response = await options.fetchFn(rawUrl);
  if (!response.ok) return null;
  return response.text();
}

function parseSkillFrontmatter(content: string): { name: string; description: string } | null {
  const parsed = matter(content);
  if (typeof parsed.data.name !== 'string' || typeof parsed.data.description !== 'string') {
    return null;
  }

  return {
    name: parsed.data.name,
    description: parsed.data.description,
  };
}

function computePathScore(options: {
  path: string;
  preferredPath?: string;
  targetName?: string;
  slug?: string;
}): number {
  const pathKey = normalizeSkillKey(options.path);
  const targetKey = normalizeSkillKey(options.targetName ?? '');
  const slugName = inferSkillNameFromSlug(options.slug);
  const slugKey = normalizeSkillKey(slugName ?? '');

  let score = 0;
  if (options.preferredPath && options.path === options.preferredPath) score += 100;
  if (targetKey && pathKey.includes(targetKey)) score += 20;
  if (slugKey && pathKey.includes(slugKey)) score += 15;
  if (pathKey.startsWith('skills-')) score += 1;
  if (pathKey.includes('skills/')) score += 2;
  return score;
}

function rankPaths(options: {
  paths: string[];
  preferredPath?: string;
  targetName?: string;
  slug?: string;
}): string[] {
  return [...options.paths].sort((a, b) => {
    const scoreA = computePathScore({
      path: a,
      preferredPath: options.preferredPath,
      targetName: options.targetName,
      slug: options.slug,
    });
    const scoreB = computePathScore({
      path: b,
      preferredPath: options.preferredPath,
      targetName: options.targetName,
      slug: options.slug,
    });
    return scoreB - scoreA;
  });
}

function computeMatchScore(options: {
  requestedName?: string;
  requestedSlug?: string;
  parsedName: string;
  path: string;
}): number {
  const parsedKey = normalizeSkillKey(options.parsedName);
  const requestedNameKey = normalizeSkillKey(options.requestedName ?? '');
  const slugName = inferSkillNameFromSlug(options.requestedSlug);
  const requestedSlugKey = normalizeSkillKey(slugName ?? '');
  const pathKey = normalizeSkillKey(options.path);

  let score = 0;
  if (!requestedNameKey && !requestedSlugKey) score += 1;

  if (requestedNameKey && parsedKey === requestedNameKey) score += 50;
  else if (requestedNameKey && parsedKey.includes(requestedNameKey)) score += 15;

  if (requestedSlugKey && parsedKey === requestedSlugKey) score += 45;
  else if (requestedSlugKey && pathKey.includes(requestedSlugKey)) score += 20;

  if (requestedNameKey && pathKey.includes(requestedNameKey)) score += 10;
  return score;
}

export async function readSkillMarkdown(options: {
  source: string;
  skillName?: string;
  slug?: string;
  preferredPath?: string;
  maxCandidatesToRead?: number;
  fetchFn?: typeof fetch;
  githubToken?: string;
}): Promise<ResolvedSkillMarkdown | null> {
  const parsedSource = parseOwnerRepo(options.source);
  if (!parsedSource) {
    throw new Error(
      `Unsupported source format "${options.source}". Expected owner/repo (for example: vercel-labs/agent-skills).`
    );
  }

  const fetchFn = options.fetchFn ?? fetch;
  const maxCandidates = Math.max(1, Math.min(50, options.maxCandidatesToRead ?? 20));
  const preferredPath = options.preferredPath
    ? safeNormalizePath(options.preferredPath)
    : undefined;

  let best: { score: number; result: ResolvedSkillMarkdown } | null = null;

  for (const branch of ['main', 'master']) {
    const skillPaths = await listSkillPaths({
      owner: parsedSource.owner,
      repo: parsedSource.repo,
      branch,
      fetchFn,
      token: options.githubToken,
    });

    if (skillPaths.length === 0) continue;

    const rankedPaths = rankPaths({
      paths: skillPaths,
      preferredPath,
      targetName: options.skillName,
      slug: options.slug,
    }).slice(0, maxCandidates);

    for (const path of rankedPaths) {
      const content = await fetchRawFile({
        owner: parsedSource.owner,
        repo: parsedSource.repo,
        branch,
        path,
        fetchFn,
      });

      if (!content) continue;

      const parsed = parseSkillFrontmatter(content);
      if (!parsed) continue;

      const score = computeMatchScore({
        requestedName: options.skillName,
        requestedSlug: options.slug,
        parsedName: parsed.name,
        path,
      });

      const result: ResolvedSkillMarkdown = {
        name: parsed.name,
        description: parsed.description,
        source: options.source,
        branch,
        path,
        content,
      };

      if (!best || score > best.score) {
        best = { score, result };
      }

      if (score >= 50) {
        return result;
      }
    }
  }

  return best?.result ?? null;
}
