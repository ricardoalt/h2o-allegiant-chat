import type { UIMessage } from "ai";

// AI SDK 6 verification note (checked in node_modules/ai/src + docs):
// - Tool definitions use `tool({ inputSchema, execute })`.
// - UI parts are emitted as `tool-<toolName>` with state transitions
//   (`input-streaming` | `input-available` | `output-available` | `output-error`).
// This file mirrors that contract so UI rendering remains type-safe.

type ArtifactKind = "field-brief" | "playbook" | "analytical-read" | "proposal-shell";

export type AgentStatusPhase =
  | "preparing-analysis"
  | "preparing-artifact"
  | "still-working"
  | "streaming-results"
  | "complete"
  | "error";

export type AgentStatusData = {
  phase: AgentStatusPhase;
  label: string;
  detail?: string;
  elapsedMs?: number;
  // Carried when phase identifies a specific artifact tool the agent is about
  // to invoke. Lets the UI replace the generic "Still working…" status with a
  // semantic "Preparing Playbook…" between artifact tool calls.
  artifactKind?: ArtifactKind;
};

export type ArtifactToolProgressStatus = "rendering" | "storing" | "persisting";

export type ArtifactToolUIProgress = {
  artifactType: ArtifactKind;
  title: string;
  status: ArtifactToolProgressStatus;
  message: string;
};

export type ArtifactToolUIResult = {
  artifactId: string;
  artifactType: ArtifactKind;
  title: string;
  status: "ready";
  createdAt: string;
  formats: Array<{
    format: "pdf";
    mediaType: "application/pdf";
    filename: string;
    downloadUrl: string;
  }>;
};

export type ArtifactToolUIOutput = ArtifactToolUIProgress | ArtifactToolUIResult;

export type MyUIMessage = UIMessage<
  unknown,
  {
    "conversation-title": {
      title: string;
    };
    "new-thread-created": {
      threadId: string;
      title: string;
      resourceId: string;
      createdAt: string;
      updatedAt: string;
    };
    "agent-status": AgentStatusData;
  },
  {
    generateFieldBrief: {
      input: unknown;
      output: ArtifactToolUIOutput;
    };
    generatePlaybook: {
      input: unknown;
      output: ArtifactToolUIOutput;
    };
    generateAnalyticalRead: {
      input: unknown;
      output: ArtifactToolUIOutput;
    };
    generateProposalShell: {
      input: unknown;
      output: ArtifactToolUIOutput;
    };
  }
>;
