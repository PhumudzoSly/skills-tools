import { describe, it, expect, vi, beforeEach } from "vitest";
import { initSkillsTools } from "../src/index.js";
import * as GithubReader from "../src/github-skill-reader.js";

describe("Skills Tools Execution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("findSkillsTool", () => {
    it("executes preconfig mode correctly", async () => {
      const { findSkillsTool } = initSkillsTools({
        find: {
          defaultMode: "preconfig",
          preconfiguredSkills: [
            { name: "playwright", source: "vercel-labs/agent-skills" },
            {
              name: "prisma-expert",
              source: "vercel-labs/agent-skills",
              aliases: ["prisma"],
            },
          ],
        },
      });

      const executionResult = await findSkillsTool.execute?.(
        { query: "prisma", limit: 5 },
        {} as never,
      );
      if (!executionResult) throw new Error("Tool execute function not found");

      expect((executionResult as any).mode).toBe("preconfig");
      expect((executionResult as any).candidates.length).toBe(1);
      expect((executionResult as any).candidates[0].name).toBe("prisma-expert");
      expect((executionResult as any).candidates[0].confidence).toBeGreaterThan(0);
    });

    it("executes search mode with mocked fetch", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          skills: [
            {
              id: "other/nextjs-cache",
              name: "nextjs-cache",
              source: "other",
              description: "Caching in nextjs",
              installs: 10,
            },
            {
              id: "vercel-labs/nextjs-routing",
              name: "nextjs-routing",
              source: "vercel-labs",
              description: "Next.js App Router patterns",
              installs: 50, // higher installs
            },
          ],
        }),
      });

      const { findSkillsTool } = initSkillsTools({
        find: {
          defaultMode: "search",
          fetchFn: mockFetch,
        },
      });

      const executionResult = await findSkillsTool.execute?.(
        { query: "nextjs", mode: "search", limit: 2 },
        {} as never,
      );
      if (!executionResult) throw new Error("Tool execute function not found");

      expect(mockFetch).toHaveBeenCalled();
      expect((executionResult as any).candidates.length).toBe(2);
      expect((executionResult as any).candidates[0].name).toBe("nextjs-routing");
      expect((executionResult as any).recommended?.name).toBe("nextjs-routing");
      expect((executionResult as any).mode).toBe("search");
    });
  });

  describe("readSkillTool", () => {
    it("executes and retrieves skill by mocking the reader", async () => {
      // Mocking readSkillMarkdown directly to avoid github rate limits / network logic here
      const spy = vi
        .spyOn(GithubReader, "readSkillMarkdown")
        .mockResolvedValue({
          name: "my-skill",
          slug: "my-skill",
          source: "vercel-labs/agent-skills",
          branch: "main",
          path: "skills/my-skill/SKILL.md",
          content: "--- \nname: my-skill\n--- \n# My Skill Content",
        });

      const { readSkillTool } = initSkillsTools();

      const executionResult = await readSkillTool.execute?.(
        {
          source: "vercel-labs/agent-skills",
          name: "my-skill",
        },
        {} as never,
      );

      if (!executionResult) throw new Error("Tool execute function not found");

      expect(spy).toHaveBeenCalled();
      expect((executionResult as any).name).toBe("my-skill");
      expect((executionResult as any).status).toBe("success");
      expect((executionResult as any).contextPatch).toContain("# My Skill Content");
    });

    it("enforces character limits on the context patch", async () => {
      const longContent = "# ".padEnd(20000, "A");

      const spy = vi
        .spyOn(GithubReader, "readSkillMarkdown")
        .mockResolvedValue({
          name: "long-skill",
          slug: "long-skill",
          source: "vercel-labs/agent-skills",
          branch: "main",
          path: "skills/long-skill/SKILL.md",
          content: longContent,
        });

      const { readSkillTool } = initSkillsTools({
        read: { maxChars: 500 },
      });

      const executionResult = await readSkillTool.execute?.(
        {
          source: "test",
          name: "long-skill",
        },
        {} as never,
      );

      if (!executionResult) throw new Error("Tool execute function not found");

      expect(spy).toHaveBeenCalled();
      expect((executionResult as any).contextPatch.length).toBeLessThanOrEqual(560);
      expect((executionResult as any).contextPatch).toContain("...[TRUNCATED]");
    });
  });
});
