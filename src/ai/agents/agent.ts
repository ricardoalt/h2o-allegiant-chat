import { ToolLoopAgent } from "ai";
import { waterSectorPrompt } from "@/ai/prompts/water-sector";
import { loadSkillTool } from "@/ai/tools/load-skill";
import { MODELS } from "@/config/models";
import { bedrockProvider } from "@/lib/bedrock-provider";

const instructions = waterSectorPrompt.trim();

export const agent = new ToolLoopAgent({
  model: bedrockProvider(MODELS[0].runtimeModelId),
  instructions,
  tools: {
    loadSkill: loadSkillTool,
  },
});

export type Agent = typeof agent;
