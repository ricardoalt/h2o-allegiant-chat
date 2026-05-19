# Apply Progress — ai-agent-tool-orchestration

## Status

completed — minimal orchestration experiment applied

## Slice 2 Progress Observability Update

Status: completed — semantic progress/observability slice applied without changing Lambda timeout or prompt/tool orchestration.

## Completed Tasks

- [x] Read OpenSpec config, explore artifacts, AI SDK skill, prompt-engineering skill, existing agent/prompt/skill code, and tests.
- [x] Followed strict TDD with a safety-net run before production edits.
- [x] Replaced per-step named artifact forcing with a minimal `prepareStep` policy:
  - before artifact mode / field-brief skill load: no override;
  - after artifact mode starts or field-brief skill loads: keep `loadSkill` plus incomplete artifact tools active;
  - completed artifact tools are removed from `activeTools` to prevent duplicate calls;
  - after all four artifact tools complete: `toolChoice: "none"` prevents duplicates.
- [x] Added AI SDK `experimental_repairToolCall` support using the documented re-ask strategy for invalid tool input repair.
- [x] Simplified prompt contradictions into a decision table for Direct Q&A, Explicit single artifact, Full opportunity package/new evidence, recoverable errors, and non-recoverable errors.
- [x] Updated `h2o-field-brief` skill to match the one-artifact-at-a-time / single-artifact-vs-full-package contract.
- [x] Regenerated `src/ai/prompts/h2o-allegiant.ts` from markdown.
- [x] Removed accidental untracked root file `false`.

## Files Changed

- `src/ai/agents/agent.ts`
- `src/ai/agents/agent.test.ts`
- `src/ai/prompts/h2o-allegiant.md`
- `src/ai/prompts/h2o-allegiant.ts`
- `src/ai/skills/h2o-field-brief/SKILL.md`
- removed root `false` artifact file

## Test Commands Run

- `bun run test src/ai/agents/agent.test.ts` — safety net: 11/11 passing before edits.
- `bun run test src/ai/agents/agent.test.ts` — RED: 4 expected failures after tests were changed first.
- `bun run prompts:generate`
- `bun run test src/ai/agents/agent.test.ts` — GREEN: 10/10 passing after implementation and prompt updates.
- `bun run test src/ai/agents/agent.test.ts` — TRIANGULATE: 1 expected failure in new repair no-such-tool test due mock call history, then fixed test hygiene.
- `bun run test src/ai/agents/agent.test.ts` — TRIANGULATE/GREEN: 12/12 passing.
- `bunx tsc --noEmit` — passing.
- `bun run prompts:check` — passing.
- `bun run test src/ai/agents/agent.test.ts` — final focused verification: 12/12 passing.

## TDD Cycle Evidence

| Task                             | Test File                     | Layer         | Safety Net | RED                                                                                                | GREEN                                 | TRIANGULATE                                                                          | REFACTOR                                                                                            |
| -------------------------------- | ----------------------------- | ------------- | ---------- | -------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Simplify artifact prepareStep    | `src/ai/agents/agent.test.ts` | Unit          | ✅ 11/11   | ✅ 4 failing assertions for no named forcing / duplicate filtering / repair hook / prompt contract | ✅ 10/10 after implementation         | ✅ Added completed-artifact variants: field brief only and field brief+playbook      | ✅ Renamed policy to `minimalArtifactPrepareStep`, extracted `activeToolsWithoutCompletedArtifacts` |
| Add AI SDK tool-call repair hook | `src/ai/agents/agent.test.ts` | Unit          | ✅ 11/11   | ✅ Hook expected in settings before implementation                                                 | ✅ Hook wired and tests passing       | ✅ Added repair-success and no-such-tool no-repair cases                             | ✅ Reset mocks in `beforeEach` for test isolation                                                   |
| Simplify prompt/skill contract   | `src/ai/agents/agent.test.ts` | Unit/approval | ✅ 11/11   | ✅ Prompt assertions expected decision-table/retry wording before prompt update                    | ✅ Prompt generated and tests passing | ✅ Existing trigger phrase test preserved file attachment + explicit phrase behavior | ✅ Regenerated TS mirror and checked with `prompts:check`                                           |

## Deviations From Design

- Did not add structured tool execution retry in `h2o-artifacts.ts`; current scope implemented AI SDK schema/input repair and prompt-level retry policy. Tool-level retryable/non-retryable result contracts should be a follow-up if runtime failures still need model-visible classification.
- Did not add a server-side intent gate; this apply intentionally keeps the experiment minimal and prompt/tool-loop native.

## Slice 2 Completed Tasks

- [x] Added typed `data-agent-status` UI data part with semantic phase, label, optional detail, and elapsed milliseconds.
- [x] Streamed transient semantic progress chunks before agent execution, periodically while the agent stream is pending, and after `requestAgent.stream` returns.
- [x] Added structured server logs for `agent_stream_started`, `agent_stream_ready`, `agent_stream_finished`, and `agent_stream_error` without customer payloads.
- [x] Updated chat UI to consume `data-agent-status` via `onData` and render a compact progress line while submitted/streaming.
- [x] Preserved the user's new `ArtifactToolCard` rendering path and did not restore raw tool parameter cards.
- [x] Updated generic loading shimmer behavior so visible tool activity suppresses the generic “Thinking…” shimmer.

## Slice 2 Files Changed

- `src/types/ui-message.ts`
- `src/lib/chat-handler.ts`
- `src/lib/chat-handler.test.ts`
- `src/lib/chat-utils.ts`
- `src/components/chat-interface.tsx`
- `src/components/chat-interface.test.tsx`

## Slice 2 Test Commands Run

- `bun run test src/lib/chat-handler.test.ts src/components/chat-interface.test.tsx` — safety net before production edits was not clean because RED tests were intentionally introduced first in this delegated slice; after RED, 2 expected failures covered missing agent-status chunks and shimmer suppression.
- `bun run test src/lib/chat-handler.test.ts src/components/chat-interface.test.tsx` — GREEN: 34/34 passing after semantic status streaming and shimmer implementation.
- `bun run test src/lib/chat-handler.test.ts src/components/chat-interface.test.tsx` — TRIANGULATE/GREEN: 35/35 passing after heartbeat test.
- `bun run test src/lib/chat-handler.test.ts src/components/chat-interface.test.tsx && bunx tsc --noEmit` — final verification: 36/36 focused tests passing; typecheck passing.

## Slice 2 TDD Cycle Evidence

| Task                                         | Test File                                                            | Layer     | Safety Net                                                               | RED                                                                      | GREEN                                             | TRIANGULATE                                                                            | REFACTOR                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Stream semantic agent status                 | `src/lib/chat-handler.test.ts`                                       | Unit      | Existing focused tests were read; RED introduced before production edits | ✅ Expected failure: no `data-agent-status` chunks                       | ✅ Start/streaming status chunks passed           | ✅ Added pending-stream heartbeat case with fake timers                                | ✅ Extracted `agentStatusChunk`, heartbeat interval constant, and `writeAgentStatus` helper |
| Render progress and suppress generic shimmer | `src/components/chat-interface.test.tsx`                             | Unit/SSR  | Existing component/helper tests read                                     | ✅ Expected failure: artifact tool activity still showed generic shimmer | ✅ Shimmer suppression passed after helper update | ✅ Added `AgentStatusProgress` render case with elapsed seconds and no raw tool params | ✅ Kept artifact card renderer intact and progress line separate                            |
| Type `data-agent-status`                     | `src/components/chat-interface.test.tsx` / `src/types/ui-message.ts` | Type/unit | N/A structural type update                                               | ✅ Tests referenced `AgentStatusData` before type existed                | ✅ Typecheck passed after data part type addition | ✅ Agent status render used concrete `AgentStatusData` fixture                         | ➖ No extra refactor needed                                                                 |

## Remaining Tasks

- Add broader orchestration evals or integration tests for real model behavior: direct Q&A no artifacts, explicit single artifact, full package one-by-one, tool failure recovery.
- Consider tool-level retryable/non-retryable error result shapes if artifact render/storage failures need better model recovery.
- Run full suite/check in verify phase if requested; `bun run check` has known pre-existing UI lint issues per config.

## Workload / PR Boundary

- Single reviewable slice under the 400-line review budget for application code/tests.
- Recommended PR boundary: minimal AI SDK-native orchestration experiment only. Do not combine with server-side intent gate or workflow engine changes.

## Post Progress Manual-Test + Analytical Read Mitigation Slice

Status: completed — P0 UI cleanup, artifact preliminary progress, and Analytical Read timeout/abort mitigation applied.

## Completed Tasks

- [x] Suppressed generic `data-agent-status` progress when the latest assistant message already has visible text/reasoning or visible tool activity.
- [x] Fixed submit/stop semantics so `PromptInputSubmit` shows stop affordance only when a real `onStop` handler is wired.
- [x] Wired `useChat().stop` through `ChatInterface` → `ChatPromptComposer` → `PromptInputSubmit`.
- [x] Converted H2O artifact tools to async-generator executions that yield preliminary progress phases before final ready output.
- [x] Expanded artifact UI output typing to support progress statuses (`rendering`, `storing`, `persisting`) plus final `ready` result.
- [x] Updated `ArtifactToolCard` to render preliminary phase messages and preserve final View/Download and Failed UI.
- [x] Improved abort-sanitized incomplete tool error text to distinguish response timeout/interruption before execution completion.
- [x] Increased chat `totalMs` from `240_000` to `285_000`, still below Lambda's 300s hard cap, based on AWS evidence that Analytical Read was interrupted at the previous app cap before `artifact_tool_started`.

## Files Changed

- `src/types/ui-message.ts`
- `src/lib/chat-utils.ts`
- `src/lib/chat-runtime.ts`
- `src/lib/chat-runtime.test.ts`
- `src/lib/chat-handler.ts`
- `src/lib/chat-handler.test.ts`
- `src/ai/tools/h2o-artifacts.ts`
- `src/ai/tools/h2o-artifacts.test.ts`
- `src/components/ai-elements/artifact-tool-card.tsx`
- `src/components/ai-elements/prompt-input.tsx`
- `src/components/chat-interface.tsx`
- `src/components/chat-interface.test.tsx`
- `src/components/chat-prompt-composer.tsx`

## Test Commands Run

- `bun run test src/components/chat-interface.test.tsx src/lib/chat-handler.test.ts src/ai/tools/h2o-artifacts.test.ts src/lib/chat-runtime.test.ts` — safety net: 58/58 passing before this slice's production edits.
- `bun run test src/components/chat-interface.test.tsx src/ai/tools/h2o-artifacts.test.ts src/lib/chat-runtime.test.ts` — RED: 7 expected failures for missing `shouldShowAgentStatusProgress`, stop semantics, preliminary artifact outputs, and improved abort text.
- `bun run test src/components/chat-interface.test.tsx src/lib/chat-handler.test.ts src/ai/tools/h2o-artifacts.test.ts src/lib/chat-runtime.test.ts` — GREEN: 64/64 passing after implementation.
- `bun run test src/components/chat-interface.test.tsx src/lib/chat-handler.test.ts src/ai/tools/h2o-artifacts.test.ts src/lib/chat-runtime.test.ts && bunx tsc --noEmit` — verification: tests passed; first typecheck surfaced two narrowing issues, fixed immediately.
- `bunx tsc --noEmit` — final typecheck passed.
- `bun run test src/components/chat-interface.test.tsx src/lib/chat-handler.test.ts src/ai/tools/h2o-artifacts.test.ts src/lib/chat-runtime.test.ts` — final focused verification: 66/66 passing.

## TDD Cycle Evidence

| Task                                                              | Test File                                                                      | Layer    | Safety Net | RED                                                           | GREEN                                                                       | TRIANGULATE                                                           | REFACTOR                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- | ---------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Suppress generic progress while visible text/tool activity exists | `src/components/chat-interface.test.tsx`                                       | Unit     | ✅ 58/58   | ✅ Missing `shouldShowAgentStatusProgress` failed             | ✅ Helper wired and UI uses it                                              | ✅ Added artifact-tool activity case plus silent submitted case       | ✅ Extracted `hasVisibleAssistantProgress` in `chat-utils`                          |
| Fix submit/stop icon semantics                                    | `src/components/chat-interface.test.tsx`                                       | Unit/SSR | ✅ 58/58   | ✅ Streaming without `onStop` still rendered Stop             | ✅ `PromptInputSubmit` only stops when `onStop` exists                      | ✅ Added wired-stop case and passed `useChat().stop` through composer | ✅ Reused `canStop` boolean for aria/type/icon/click semantics                      |
| Stream preliminary artifact progress                              | `src/ai/tools/h2o-artifacts.test.ts`, `src/components/chat-interface.test.tsx` | Unit     | ✅ 58/58   | ✅ Artifact tools emitted only final `ready` result           | ✅ Async-generator tools yielded `rendering`/`storing`/`persisting`/`ready` | ✅ Added Analytical Read progress case and card render progress case  | ✅ Added output union types and centralized final-result collection helper in tests |
| Improve abort/Analytical Read mitigation                          | `src/lib/chat-runtime.test.ts`, `src/lib/chat-handler.test.ts`                 | Unit     | ✅ 58/58   | ✅ Sanitized abort text and timeout budget expectation failed | ✅ Abort text distinguishes timeout/interruption and `totalMs` set to 285s  | ✅ Dynamic-tool incomplete path also asserts new text                 | ✅ Extracted abort text constant and updated timeout comments with AWS rationale    |

## Deviations / Notes

- Did not add raw UI chunk logging for `tool-input-error`; this would be a broader instrumentation slice. Current mitigation focuses on clearer abort diagnostics, preliminary tool progress, and a modest timeout budget increase.
- Did not harden Analytical Read schema because renderer/schema tests pass and AWS evidence showed no `artifact_tool_started kind=analytical-read`, pointing to pre-execute timeout/abort rather than renderer failure.
- Preliminary outputs improve progress once a tool execute starts; they do not solve the long model input-generation gap before first tool start.

## Remaining Tasks

- Redeploy/restart sandbox and manually verify that artifact cards show `Rendering PDF…`, `Storing PDF…`, and `Saving artifact metadata…` during tool execution.
- Inspect CloudWatch for whether Analytical Read now reaches `artifact_tool_started` with the 285s budget.
- If Analytical Read still fails before execute, add raw UI chunk diagnostics for `tool-input-error`/`abort` and consider reducing model-generated Analytical Read payload complexity.

## Workload / PR Boundary

- This slice exceeds the original 400-line review comfort mainly due accumulated uncommitted Slice 2 UI changes and focused tests. Recommended review boundary: post-progress manual-test fixes + Analytical Read timeout/abort mitigation only; do not combine with prompt/orchestration changes.

## Stable Artifact-Card UX Apply Slice

Status: completed — restored stable per-artifact active cards and semantic pre-tool status while preserving final artifact cards.

## Completed Tasks

- [x] Added RED tests for semantic `preparing-artifact` visibility over assistant text, generic `still-working` suppression over text, input-state artifact cards, sequential ready+active artifact cards, and stable `toolCallId` keys.
- [x] Updated `ArtifactToolCard` to render `input-streaming` as `Preparing <title>…` and `input-available` as `Generating <title>…` while preserving preliminary output, final View/Download, and error states.
- [x] Updated `shouldShowAgentStatusProgress` so `preparing-artifact` remains visible during the pre-tool gap even when assistant text exists, while generic statuses remain hidden once text/cards are visible.
- [x] Updated artifact tool render keys to prefer `toolCallId` (`tool-${toolCallId}`) with the previous message/index/defaultOpen fallback for non-tool cases.

## Files Changed

- `src/components/ai-elements/artifact-tool-card.tsx`
- `src/components/chat-interface.tsx`
- `src/lib/chat-utils.ts`
- `src/components/chat-interface.test.tsx`
- `openspec/changes/ai-agent-tool-orchestration/apply-progress.md`

## Test Commands Run

- `bun run test src/components/chat-interface.test.tsx src/lib/chat-handler.test.ts src/lib/chat-handler.artifacts.test.ts` — safety net: 46/46 passing before production edits.
- `bun run test src/components/chat-interface.test.tsx` — RED: 5 expected failures for missing preparing-artifact-over-text, input-state cards, sequential ready+active card, and stable toolCallId keys.
- `bun run test src/components/chat-interface.test.tsx` — GREEN/TRIANGULATE: 39/39 passing after implementation and updating the obsolete input-state-status expectation.
- `bun run test src/components/chat-interface.test.tsx src/lib/chat-handler.test.ts src/lib/chat-handler.artifacts.test.ts && bun run lint` — final verification: 51/51 focused tests passing; Biome lint passing.

## TDD Cycle Evidence

| Task                                           | Test File                                | Layer              | Safety Net       | RED                                                                                           | GREEN                                           | TRIANGULATE                                                         | REFACTOR                                                |
| ---------------------------------------------- | ---------------------------------------- | ------------------ | ---------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| Semantic pre-tool status + generic suppression | `src/components/chat-interface.test.tsx` | Unit/SSR helper    | ✅ 46/46 focused | ✅ `preparing-artifact` over text failed while existing generic text suppression stayed green | ✅ Helper special-cases `preparing-artifact`    | ✅ Input-state card visibility now hides duplicate preparing status | ✅ Comments aligned with pre-tool/card handoff          |
| Active artifact input cards                    | `src/components/chat-interface.test.tsx` | Unit/SSR component | ✅ 46/46 focused | ✅ `input-streaming`/`input-available` rendered empty                                         | ✅ Cards render `Preparing…`/`Generating…`      | ✅ Ready Field Brief + active Analytical Read render together       | ✅ Reused existing card shell and final/output branches |
| Stable artifact tool keys                      | `src/components/chat-interface.test.tsx` | Unit               | ✅ 46/46 focused | ✅ `toolCallId` key expectation failed                                                        | ✅ `toolRenderKey` prefers `tool-${toolCallId}` | ✅ Fallback message/index/defaultOpen behavior preserved            | ✅ Callsite passes `part.toolCallId`                    |

## Deviations / Notes

- No backend artifact execution, timeout, schema, or orchestration code was changed.
- Temporary telemetry requested by the parent is not removed by this slice.

## Remaining Tasks

- Manual browser test with console telemetry enabled to verify: pre-tool `Preparing Field Brief…`, input-state cards, progressive ready cards, and no generic `Still working…` rectangle over streamed text.
- If progressive server chunks still do not show in the browser, investigate transport/client delivery separately; this slice only fixes the UI state mapping.

## Workload / PR Boundary

- Single UI/test slice, ~130 changed lines excluding progress docs; intended as a focused artifact-card UX PR boundary.
