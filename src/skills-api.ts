import type { SearchSkillApiResponse, SearchSkillRecord } from './types.js';

export const DEFAULT_SKILLS_API_BASE_URL = 'https://skills.sh';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/g, '');
}

export async function searchSkillsApi(options: {
  query: string;
  limit: number;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<SearchSkillRecord[]> {
  const query = options.query.trim();
  if (!query) return [];

  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_SKILLS_API_BASE_URL);
  const limit = Math.max(1, Math.min(25, options.limit));
  const fetchFn = options.fetchFn ?? fetch;

  const url = `${baseUrl}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Skills search failed with HTTP ${response.status}`);
  }

  const json = (await response.json()) as Partial<SearchSkillApiResponse>;
  if (!Array.isArray(json.skills)) {
    return [];
  }

  return json.skills
    .filter((item): item is SearchSkillRecord => {
      return (
        item != null &&
        typeof item.name === 'string' &&
        item.name.length > 0 &&
        typeof item.source === 'string' &&
        item.source.length > 0
      );
    })
    .map((item) => ({
      id:
        typeof item.id === 'string' && item.id.length > 0 ? item.id : `${item.source}/${item.name}`,
      name: item.name,
      source: item.source,
      installs: typeof item.installs === 'number' ? item.installs : 0,
      description: typeof item.description === 'string' ? item.description : undefined,
    }));
}
