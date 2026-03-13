import { streamText } from "ai";
import { initSkillsTools } from "@phumudzo/skills-tools";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const { tools } = initSkillsTools();

  const result = streamText({
    model: "openai/gpt-5",
    messages,
    tools,
    system:
      "You are a helpful assistant that helps users discover and read skills using the provided tools. Default to using the readSkillTool when appropriate. You can search for skills and help users.",
  });

  return result.consumeStream();
}
