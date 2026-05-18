# SDD Explore — Post Progress Manual Test

## Status

completed

## Executive Summary

Manual testing after Slice 2 shows progress is better during PDF tool generation, but two UX issues and one remaining backend/progress gap remain:

1. The generic `Still working...` card appears while assistant text is already streaming, which feels like a weird duplicate progress card.
2. The composer shows a stop-square icon during streaming, but stop is not wired through the composer, so the affordance is misleading.
3. The first artifact card still stays in a broad `Preparing...` state until terminal success/error because artifact tools do not emit preliminary progress outputs yet.

AWS logs confirm the remaining stall is still not PDF render/storage/persist. The newest sandbox run spent ~160s before Field Brief tool start, while the Field Brief tool itself took ~1.8s and Playbook ~1s.

## Screenshots Interpreted

- `Still working...` card during text streaming: caused by unconditional heartbeat rendering while text is already visible.
- PDF tool card preparing state: improved UX, but lacks internal phase progress.
- Enter/stop icon: current UI shows square stop during streaming but likely lacks real stop handler wiring.
- Final failed Analytical Read: stream hit ~240s app cap with Analytical Read output-error; no Analytical Read tool start/failure logs appeared.

## AWS Evidence

Sandbox log group:

`/aws/lambda/amplify-goodchat-ricardoa-ChatStreamingFunctionF36-0EiVMZlsaDvl`

Request:

`df642378-f581-47de-b364-75aff14a8f59`

Thread:

`trtA36VgYj5BHIYNtgrWr`

Timeline:

- `17:48:49.660Z` `agent_stream_started`
- `17:48:49.672Z` `agent_stream_ready`, duration `12ms`
- `17:51:29.936Z` Field Brief tool started
- Field Brief total tool duration: `1763ms`
- `17:52:23.700Z` Playbook tool started
- Playbook total tool duration: `997ms`
- `17:52:49.676Z` `agent_stream_finished`, `isAborted: true`, duration `240016ms`
- Final parts included:
  - `tool-generateFieldBrief:output-available`
  - `tool-generatePlaybook:output-available`
  - `tool-generateAnalyticalRead:output-error`

Timing gaps:

- ~160.3s from stream ready to Field Brief tool start.
- ~52.0s from Field Brief finish to Playbook start.
- ~25.0s from Playbook finish to abort.

Conclusion: backend gap is model/tool-input generation time, not PDF execution time.

## AI SDK Finding

AI SDK v6 supports async-generator tools. A tool `execute` can yield preliminary outputs and then yield the final result. UI receives updates on the same `tool-<name>` part:

- `state: output-available`
- `preliminary: true` for preliminary outputs
- final output without `preliminary`

The output type must be a union because preliminary and final outputs share the same tool output type.

Recommended pattern:

```ts
type ArtifactToolOutput =
  | {
      status: "rendering";
      artifactType: ArtifactKind;
      title: string;
      message: string;
    }
  | {
      status: "storing";
      artifactType: ArtifactKind;
      title: string;
      message: string;
    }
  | {
      status: "persisting";
      artifactType: ArtifactKind;
      title: string;
      message: string;
    }
  | ArtifactToolResult;
```

Then artifact tools can yield `rendering`, `storing`, `persisting`, and finally the ready result.

## Recommended Fix Order

### P0 — Clean up misleading UI states

1. Suppress the generic `Still working...` card when assistant text or artifact tool activity is already visible.
2. Wire real `stop` from `useChat` through `ChatInterface → ChatPromptComposer → PromptInputSubmit`, or show the normal enter/send icon when no stop action is wired.

### P1 — Add artifact preliminary outputs

Convert `generate*` artifact tools to async generators with progress union outputs:

- `rendering`
- `storing`
- `persisting`
- `ready`

Update `ArtifactToolCard` to display the current phase instead of static `Preparing...`.

### P2 — Better root-cause diagnostics for aborted analytical read

Add logs around tool input start/available/error and AI SDK tool input validation so we can distinguish:

- model spent too long building Analytical Read input;
- Analytical Read input schema failed;
- totalMs aborted before tool could start.

## Risks

- Preliminary outputs improve tool execution visibility, but they do not fix the ~160s model gap before first tool start.
- The long model gap may require reducing tool input complexity or moving more PDF assembly into deterministic code after UX/progress is fixed.
- If stop is wired, abort/persistence behavior must remain recoverable.
