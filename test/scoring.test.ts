import { describe, it, expect } from "vitest";
import {
  normalizeSkillKey,
  inferSkillNameFromSlug,
  scoreSkillCandidate,
  sortCandidatesByConfidence,
} from "../src/scoring.js";

describe("normalizeSkillKey", () => {
  it("normalizes various input strings", () => {
    expect(normalizeSkillKey("Next.JS")).toBe("next-js");
    expect(normalizeSkillKey("React-Query")).toBe("react-query");
    expect(normalizeSkillKey("  Some  skill  ")).toBe("some-skill");
    expect(normalizeSkillKey("!@#Special^&*Characters()")).toBe(
      "special-characters",
    );
  });
});

describe("inferSkillNameFromSlug", () => {
  it("returns undefined for empty slug", () => {
    expect(inferSkillNameFromSlug(undefined)).toBeUndefined();
    expect(inferSkillNameFromSlug("")).toBeUndefined();
  });

  it("extracts name from standard slugs", () => {
    expect(inferSkillNameFromSlug("user/repo/skill-name")).toBe("skill-name");
    expect(inferSkillNameFromSlug("/user/skill-name/")).toBe("skill-name");
    expect(inferSkillNameFromSlug("skill-name")).toBe("skill-name");
  });
});

describe("scoreSkillCandidate", () => {
  it("give high score for exact match", () => {
    const result = scoreSkillCandidate({
      query: "Next JS",
      name: "next-js",
      description: "Next.js framework skill",
    });

    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.reason).toContain("exact-name-match");
  });

  it("give moderate score for partial match in description", () => {
    const result = scoreSkillCandidate({
      query: "router",
      name: "react-components",
      description: "Components including a router for react",
    });

    expect(result.confidence).toBeLessThan(0.7);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.reason).toContain("name-or-description-contains-query");
  });

  it("boosts score slightly for popularity", () => {
    const target = {
      query: "tailwindcss",
      name: "tailwind-css",
    };

    const withoutInstalls = scoreSkillCandidate({ ...target, installs: 0 });
    const withInstalls = scoreSkillCandidate({ ...target, installs: 100000 });

    expect(withInstalls.confidence).toBeGreaterThan(withoutInstalls.confidence);
  });
});

describe("sortCandidatesByConfidence", () => {
  it("sorts candidates in descending order of confidence", () => {
    const candidates = [
      { id: "1", name: "A", source: "a", confidence: 0.2, reason: "" },
      { id: "2", name: "B", source: "b", confidence: 0.9, reason: "" },
      { id: "3", name: "C", source: "c", confidence: 0.5, reason: "" },
    ];

    const sorted = sortCandidatesByConfidence(candidates);
    expect(sorted[0].name).toBe("B");
    expect(sorted[1].name).toBe("C");
    expect(sorted[2].name).toBe("A");
  });
});
