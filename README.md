# @phumu/skills-tools

Installable AI SDK tools for working with the skills ecosystem using a two-step flow:

1. `findSkillsTool`: find candidates (preconfigured mode or search mode)
2. `readSkillTool`: load `SKILL.md` and return markdown/context patch

This package is designed so the model can choose a candidate from `findSkillsTool`, then call `readSkillTool` to load the actual skill instructions into context.

## Package Naming

If this is managed under Vercel Labs, prefer:

- `@vercel-labs/skills-tools`

If it is a team-owned package, use your own scope:

- `@your-scope/skills-tools`

This scaffold is currently configured as `@phumu/skills-tools` and can be changed in `package.json`.

## Install

```bash
pnpm add @phumu/skills-tools ai zod
```

## Quick Start

```ts
import { generateText, stepCountIs } from "ai";
import { initSkillsTools } from "@phumu/skills-tools";

const { tools } = initSkillsTools({
  find: {
    defaultMode: "search",
    rankingStrategy: "hybrid",
    preconfiguredSkills: [
      {
        name: "playwright",
        source: "vercel-labs/agent-skills",
      },
      {
        name: "prisma-expert",
        source: "vercel-labs/agent-skills",
      },
    ],
  },
  read: {
    maxChars: 16000,
  },
});

const result = await generateText({
  model: "anthropic/claude-sonnet-4.5",
  messages,
  tools,
  stopWhen: stepCountIs(6),
  system: [
    "When skill selection is ambiguous, call findSkillsTool first and inspect candidates.",
    "Then call readSkillTool for the selected candidate and use contextPatch in your reasoning.",
  ].join("\n"),
});
```

## Tool Behavior

### findSkillsTool

Input:

- `mode`: `"preconfig" | "search"`
- `query?`: search/filter text
- `limit?`: max candidates (1..25)

Output includes:

- `recommended`: top candidate
- `candidates`: ranked list
- `needsDisambiguation`: whether the model should choose from top candidates

Modes:

1. `preconfig`: list/filter only configured skills
2. `search`: call `https://skills.sh/api/search` and rank candidates

Ranking strategies:

1. `deterministic`: always score by heuristics
2. `hybrid`: deterministic, optional AI tie-breaker on low confidence
3. `ai`: AI ranker decides when provided

### readSkillTool

Input:

- `source?`: owner/repo (for example `vercel-labs/agent-skills`)
- `skillName?`
- `slug?`
- `preferredPath?`
- `maxChars?`

Resolution behavior:

1. Resolves source/name from explicit input or preconfigured map
2. Reads GitHub tree for `SKILL.md` files (`main` then `master`)
3. Loads best match markdown and validates frontmatter (`name` and `description`)
4. Returns:
   - `skillMarkdown`
   - `contextPatch` (ready to inject into model context)

## Advanced: AI Tie-Breaker

```ts
const { tools } = initSkillsTools({
  find: {
    rankingStrategy: "hybrid",
    aiRanker: async ({ query, candidates }) => {
      // Delegate to your own model or policy layer.
      // Return null to keep deterministic ranking.
      return {
        name: candidates[0]?.name ?? query,
        source: candidates[0]?.source,
        confidence: 0.72,
        reason: "domain-specific preference",
      };
    },
  },
});
```

## Development

```bash
pnpm install
pnpm type-check
pnpm build
```
