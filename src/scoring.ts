import type { SkillCandidate } from './types.js';

export function normalizeSkillKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function inferSkillNameFromSlug(slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  const cleaned = slug.replace(/^\/+|\/+$/g, '');
  if (!cleaned) return undefined;
  const parts = cleaned.split('/');
  return parts[parts.length - 1];
}

function tokenize(value: string): Set<string> {
  return new Set(normalizeSkillKey(value).split('-').filter(Boolean));
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap++;
  }
  return overlap / Math.max(a.size, b.size);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function scoreSkillCandidate(input: {
  query: string;
  name: string;
  description?: string;
  installs?: number;
}): { confidence: number; reason: string } {
  const queryKey = normalizeSkillKey(input.query);
  const nameKey = normalizeSkillKey(input.name);
  const descriptionKey = normalizeSkillKey(input.description ?? '');

  const exactMatch = nameKey === queryKey ? 1 : 0;
  const containsMatch =
    nameKey.includes(queryKey) || queryKey.includes(nameKey) || descriptionKey.includes(queryKey)
      ? 1
      : 0;

  const queryTokens = tokenize(queryKey);
  const nameTokens = tokenize(nameKey);
  const descriptionTokens = tokenize(descriptionKey);

  const nameOverlap = overlapScore(queryTokens, nameTokens);
  const descriptionOverlap = overlapScore(queryTokens, descriptionTokens);
  const installs = input.installs ?? 0;
  const popularity = installs > 0 ? Math.min(Math.log10(installs + 1) / 6, 1) : 0;

  const confidence = clamp01(
    exactMatch * 0.7 +
      containsMatch * 0.14 +
      nameOverlap * 0.1 +
      descriptionOverlap * 0.04 +
      popularity * 0.02
  );

  const reasons: string[] = [];
  if (exactMatch) reasons.push('exact-name-match');
  if (!exactMatch && containsMatch) reasons.push('name-or-description-contains-query');
  if (nameOverlap > 0) reasons.push('token-overlap');
  if (descriptionOverlap > 0.35) reasons.push('description-overlap');
  if (popularity > 0.35) reasons.push('popular-skill');
  if (reasons.length === 0) reasons.push('semantic-near-match');

  return {
    confidence: Number(confidence.toFixed(4)),
    reason: reasons.join(', '),
  };
}

export function sortCandidatesByConfidence<T extends SkillCandidate>(candidates: T[]): T[] {
  return [...candidates].sort((a, b) => b.confidence - a.confidence);
}
