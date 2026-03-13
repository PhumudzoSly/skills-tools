import { createFindSkillsTool } from './find-skills-tool.js';
import { createReadSkillTool } from './read-skill-tool.js';
import type { SkillsToolsConfig } from './types.js';

export function initSkillsTools(config: SkillsToolsConfig = {}) {
  const findSkillsTool = createFindSkillsTool(config.find);
  const readSkillTool = createReadSkillTool({
    ...(config.read ?? {}),
    preconfiguredSkills: config.read?.preconfiguredSkills ?? config.find?.preconfiguredSkills ?? [],
  });

  return {
    findSkillsTool,
    readSkillTool,
    tools: {
      findSkillsTool,
      readSkillTool,
    },
  };
}
