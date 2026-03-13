export type FindMode = 'preconfig' | 'search';
export type RankingStrategy = 'deterministic' | 'hybrid' | 'ai';

export interface PreconfiguredSkill {
  name: string;
  source: string;
  aliases?: string[];
  preferredPath?: string;
}

export interface SkillCandidate {
  id: string;
  name: string;
  source: string;
  slug?: string;
  installs?: number;
  description?: string;
  confidence: number;
  reason: string;
  preferredPath?: string;
}

export interface FindSkillsInput {
  mode: FindMode;
  query?: string;
  limit?: number;
}

export interface FindSkillsOutput {
  ok: boolean;
  mode: FindMode;
  message: string;
  recommended?: SkillCandidate;
  candidates: SkillCandidate[];
  needsDisambiguation: boolean;
}

export interface ReadSkillInput {
  source?: string;
  skillName?: string;
  slug?: string;
  preferredPath?: string;
  maxChars?: number;
}

export interface ReadSkillOutput {
  ok: boolean;
  message: string;
  selected?: {
    name: string;
    source: string;
    path: string;
    branch: string;
    description: string;
  };
  contextPatch?: string;
  skillMarkdown?: string;
}

export interface SearchSkillRecord {
  id: string;
  name: string;
  source: string;
  installs?: number;
  description?: string;
}

export interface SearchSkillApiResponse {
  skills: SearchSkillRecord[];
}

export interface AiRankerInput {
  query: string;
  candidates: SkillCandidate[];
}

export interface AiRankerDecision {
  name: string;
  source?: string;
  confidence?: number;
  reason?: string;
}

export interface FindToolConfig {
  defaultMode?: FindMode;
  allowedModes?: FindMode[];
  searchLimit?: number;
  minConfidence?: number;
  closeScoreDelta?: number;
  rankingStrategy?: RankingStrategy;
  skillsApiBaseUrl?: string;
  fetchFn?: typeof fetch;
  preconfiguredSkills?: PreconfiguredSkill[];
  aiRanker?: (input: AiRankerInput) => Promise<AiRankerDecision | null>;
}

export interface ReadToolConfig {
  maxChars?: number;
  maxCandidatesToRead?: number;
  githubToken?: string;
  fetchFn?: typeof fetch;
  preconfiguredSkills?: PreconfiguredSkill[];
}

export interface SkillsToolsConfig {
  find?: FindToolConfig;
  read?: ReadToolConfig;
}

export interface ResolvedSkillMarkdown {
  name: string;
  description: string;
  source: string;
  branch: string;
  path: string;
  content: string;
}
