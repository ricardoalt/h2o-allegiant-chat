import { ToolLoopAgent, stepCountIs } from "ai";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { loadSkillTool } from "@/ai/tools/load-skill";
import { ASSISTANT_SYSTEM_PROMPT } from "@/ai/prompts/assistant";

const MODEL_ID = "us.anthropic.claude-sonnet-4-6";

export const discoveryAgent = new ToolLoopAgent({
  model: (() => {
    const bedrock = createAmazonBedrock({
      region: process.env.AWS_REGION || "us-east-1",
    });
    return bedrock(MODEL_ID);
  })(),
  instructions: `${ASSISTANT_SYSTEM_PROMPT}

## Available Skills

You have access to specialized skills stored in markdown files. When a user's request would benefit from detailed instructions for a specific task, call the \`loadSkill\` tool with the skill name.

Available skills (call loadSkill with the exact name):
- multimodal-intake: Extract structured data from photos, voice notes, video
- sds-interpretation: Extract and interpret SDS, COA, and analytical reports
- sub-discipline-router: Decompose opportunities into sub-streams with specialist lenses
- specialist-lens-light: Produce profile questions and red flags per sub-stream
- safety-flagging: Classify safety flags and surface stop-flags
- commercial-shaping: Size opportunities and produce commercial briefs
- discovery-gap-analysis: Identify Required vs Nice-to-have gaps
- qualification-gate: Run six-criteria qualification check
- discovery-reporting: Produce three-tier discovery reports
- trainee-mode: Adjust tone for less experienced users

Call loadSkill when you need detailed instructions for any of these tasks.`,
  tools: {
    loadSkill: loadSkillTool,
  },
  stopWhen: stepCountIs(20),
});
