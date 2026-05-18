import type { ChatStatus } from "ai";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import type { AgentStatusData, MyUIMessage } from "@/types/ui-message";

export const canSubmitPromptMessage = (message: PromptInputMessage): boolean => {
  const hasText = Boolean(message.text?.trim());
  const hasAttachments = Boolean(message.files?.length);
  return hasText || hasAttachments;
};

// Tool states that already render their own visible card (the ArtifactToolCard
// renders for `output-available` preliminary/final yields and `output-error`).
// During `input-streaming` / `input-available` the card returns null and the
// global AgentStatusProgress is the only signal the user has — keep it visible.
const CARD_VISIBLE_TOOL_STATES = new Set<string>(["output-available", "output-error"]);

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

const hasArtifactCardVisible = (message: MyUIMessage | undefined): boolean => {
  if (!message) return false;
  return message.parts.some((part) => {
    if (!isToolPartWithState(part)) return false;
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

  // Hide the global status only once an actual artifact card or assistant text
  // is visible — those take over the progress signal. While the tool is still
  // in input-streaming/input-available the card is null, so this stays visible.
  const lastAssistant = findLast(messages, (m) => m.role === "assistant");
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
