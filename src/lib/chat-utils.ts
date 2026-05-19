import type { ChatStatus } from "ai";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import type { AgentStatusData, MyUIMessage } from "@/types/ui-message";

export const canSubmitPromptMessage = (message: PromptInputMessage): boolean => {
  const hasText = Boolean(message.text?.trim());
  const hasAttachments = Boolean(message.files?.length);
  return hasText || hasAttachments;
};

const ARTIFACT_TOOL_KIND_BY_TYPE = {
  "tool-generateFieldBrief": "field-brief",
  "tool-generatePlaybook": "playbook",
  "tool-generateAnalyticalRead": "analytical-read",
  "tool-generateProposalShell": "proposal-shell",
} as const;

// Tool states that already render their own visible artifact card. Keep this
// aligned with ArtifactToolCard so generic status only shows during true
// pre-tool gaps or semantic preparing-artifact announcements.
const CARD_VISIBLE_TOOL_STATES = new Set<string>([
  "input-streaming",
  "input-available",
  "output-available",
  "output-error",
]);

const hasVisibleText = (message: MyUIMessage | undefined): boolean => {
  if (!message) return false;
  return message.parts.some(
    (part) => (part.type === "text" || part.type === "reasoning") && part.text.length > 0,
  );
};

const isToolPartWithState = (part: MyUIMessage["parts"][number]): boolean =>
  part.type.startsWith("tool-") && "state" in part;

const hasAnyToolActivity = (message: MyUIMessage | undefined): boolean => {
  if (!message) return false;
  return message.parts.some(isToolPartWithState);
};

const getArtifactKindForToolPart = (
  part: MyUIMessage["parts"][number],
): AgentStatusData["artifactKind"] | undefined => {
  if (!(part.type in ARTIFACT_TOOL_KIND_BY_TYPE)) return undefined;
  return ARTIFACT_TOOL_KIND_BY_TYPE[part.type as keyof typeof ARTIFACT_TOOL_KIND_BY_TYPE];
};

const hasArtifactCardVisible = (
  message: MyUIMessage | undefined,
  artifactKind?: AgentStatusData["artifactKind"],
): boolean => {
  if (!message) return false;
  return message.parts.some((part) => {
    if (!isToolPartWithState(part)) return false;
    const partArtifactKind = getArtifactKindForToolPart(part);
    if (!partArtifactKind || (artifactKind && partArtifactKind !== artifactKind)) return false;
    const state = (part as { state?: unknown }).state;
    return typeof state === "string" && CARD_VISIBLE_TOOL_STATES.has(state);
  });
};

export function shouldShowAgentStatusProgress(
  status: ChatStatus,
  messages: MyUIMessage[],
  agentStatus: AgentStatusData | null,
): boolean {
  if (!agentStatus || (status !== "submitted" && status !== "streaming")) {
    return false;
  }

  const lastAssistant = findLast(messages, (m) => m.role === "assistant");

  // Keep semantic artifact preparation visible through the long pre-tool gap,
  // even if the assistant has already streamed explanatory text. Generic
  // still-working heartbeats should not compete with visible text or cards.
  if (agentStatus.phase === "preparing-artifact") {
    return !hasArtifactCardVisible(lastAssistant, agentStatus.artifactKind);
  }

  return !hasVisibleText(lastAssistant) && !hasArtifactCardVisible(lastAssistant);
}

/**
 * Returns true when a loading shimmer should be displayed for the assistant.
 *
 * Covers two cases:
 *  1. status is "submitted" (request sent, no stream open yet)
 *  2. status is "streaming" but the last assistant message has no visible
 *     text/reasoning or tool activity (stream is open, first user-visible
 *     progress hasn't arrived yet)
 */
export function shouldShowLoadingShimmer(status: ChatStatus, messages: MyUIMessage[]): boolean {
  if (status === "submitted") return true;

  if (status === "streaming") {
    const lastAssistant = findLast(messages, (m) => m.role === "assistant");
    // Suppress the generic "Thinking…" shimmer as soon as ANY tool activity
    // exists, even in input-streaming. The AgentStatusProgress handles those
    // input states; the generic shimmer is only for true silent windows.
    return !hasVisibleText(lastAssistant) && !hasAnyToolActivity(lastAssistant);
  }

  return false;
}

function findLast<T>(arr: T[], predicate: (item: T) => boolean): T | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return arr[i];
  }
  return undefined;
}
