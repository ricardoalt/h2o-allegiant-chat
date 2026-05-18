# SDD Explore — Slice 2 Deep Streaming/Progress Investigation

## Status

completed

## Executive Summary

The long-standing “agent stops, then suddenly delivers/errors” behavior is not primarily a Lambda timeout, PDF render, S3, or DynamoDB problem. Current evidence points to a progress-observability gap during long AI SDK model/tool-loop phases.

Current SecondstreamAI streams, but it mostly streams default AI SDK tool lifecycle parts and terminal outputs. It does not stream semantic progress/status during long model generation or long tool execution. Legacy SecondStream felt alive because it emitted explicit progress protocol events, keepalives, and UI status states.

## Root Cause Theory by Layer

### 1. Model step latency

`ToolLoopAgent.stream()` runs a multi-step loop. Some steps can be long before a new visible chunk appears. In artifact flows, the model must build large structured tool inputs. That can create long silent windows before the actual PDF tool starts.

Current code logs some step information, but does not stream user-facing step progress.

### 2. Tool execution latency

Artifact tools perform render → storage → DB persist before returning final output. AI SDK emits tool input states and then tool result/error states, but if the tool does not yield preliminary outputs, the UI has no native progress during execution.

### 3. Server/Lambda streaming

The Lambda Function URL stream is not fully buffering the entire response. Logs show handler response starts quickly and chunks are piped incrementally. Large gaps are more likely upstream model/tool gaps than Lambda buffering.

The runtime adapter writes SSE keepalive comments, but keepalive writes are not logged as normal `stream_write` chunks and the UI does not surface them as progress.

### 4. Client UI/reconciliation

The UI hides non-artifact tool activity and shows only generic thinking/artifact cards. It also waits for terminal artifact states during reconciliation. This is safer for persistence but worsens perceived stalls.

## Legacy SecondStream Difference

Legacy had three visibility layers that current app lacks:

1. Semantic status events:
   - `data-agent-status`
   - examples: `preparing-analysis`, `idle`
2. Explicit tool lifecycle events:
   - `tool-input-start`
   - `tool-input-delta`
   - `tool-input-available`
   - `tool-output-available`
   - `tool-output-error`
3. Keepalive comments during long gaps:
   - `: keepalive\n\n`

Legacy frontend also consumed these events with a dedicated message-part renderer and status shimmer logic. Current frontend has no `data-agent-status` type and no equivalent progress protocol.

## AI SDK v6 Findings

AI SDK UI streams include chunks such as:

- `tool-input-start`
- `tool-input-delta`
- `tool-input-available`
- `tool-input-error`
- `tool-output-available`
- `tool-output-error`
- `data-*`
- `start-step`
- `finish-step`
- `finish`
- `abort`

Tool parts map to states:

- `input-streaming`
- `input-available`
- `output-available`
- `output-error`

AI SDK does not provide a general built-in heartbeat/progress chunk for long silent model calls or long tool executions.

Useful SDK mechanisms:

1. Async-generator tools can yield preliminary outputs:
   - preliminary outputs become `tool-output-available` with `preliminary: true`.
   - final output becomes normal `tool-output-available`.
2. `createUIMessageStream` can write custom `data-*` chunks.
3. `onStepFinish` is useful for logs after a step, not live progress.
4. `experimental_onToolCallFinish` is useful for observability after a tool completes/errors, not live progress unless mapped into custom UI data.
5. `chunkMs` timeout can detect silent stalls but is not a UX progress solution.

## AWS Log Evidence

Recent sandbox log group:

`/aws/lambda/amplify-goodchat-ricardoa-ChatStreamingFunctionF36-0EiVMZlsaDvl`

The handler returns/pipes early:

- first stream body chunk observed ~22 ms after handler result in a sampled request.
- `waitedForDrain=false` in sampled writes.

A sample request reached ~242 seconds near `totalMs`. Logs do not currently expose enough detail to attribute time to model steps vs tool steps.

Missing telemetry:

- model step start/finish duration
- tool call start/finish correlated with step index
- first-token latency
- AI SDK abort reason
- keepalive write telemetry
- client disconnect telemetry

## What I Think Is Actually Happening

The app is not “stopping.” It is working, but it has long silent phases:

1. Model generates/validates large structured input for Field Brief.
2. Tool runs quickly once called.
3. Model generates/validates large structured input for Playbook.
4. Tool runs quickly once called.
5. Model/tool flow approaches `totalMs` and an artifact may become `output-error`/aborted.

Because the UI lacks semantic progress and exposes low-level pending tool state, the user experiences this as a freeze.

## Recommended Slice 2 Direction

### Phase A — Instrument before optimizing

Add server logs for:

- request agent stream start
- each AI SDK step start/finish if available
- first model chunk/first tool input
- tool call start/finish/error with duration, step number, tool name
- keepalive writes
- final `onFinish` with `isAborted`, finish reason, part summary, elapsed time

### Phase B — Stream semantic progress

Add custom `data-agent-status` parts or preliminary tool yields:

- `preparing-field-brief-input`
- `rendering-field-brief`
- `uploading-field-brief`
- `field-brief-ready`
- `preparing-playbook-input`
- etc.

Prefer native AI SDK patterns:

- async-generator artifact tools for render/storage/persist phases;
- `createUIMessageStream` `data-*` parts for global model/agent phases.

### Phase C — UI consumes progress

Add `data-agent-status` to `MyUIMessage` and render a compact status line. Stop generic shimmer when tool/status activity appears.

### Phase D — Optional timeout detection

Consider `chunkMs` only after expected silent windows are known. It detects stalls but can also abort legitimate long Bedrock/tool steps if set too aggressively.

## Risks

- UI-only fixes can hide the problem but not reduce 2–4 minute latency.
- Backend-only logs help debugging but do not improve user perception.
- `chunkMs` can create false aborts if Bedrock legitimately has long silent steps.
- Async-generator tools may require careful type/test updates for AI SDK tool result rendering.

## Next Recommended

Proceed to SDD proposal/design for Slice 2 with two deliverables:

1. Observability instrumentation: measure model/tool/stream phases precisely.
2. User-facing progress protocol: semantic status parts and/or preliminary artifact tool outputs.

Do not start by changing Lambda timeout again. Current evidence does not support Lambda timeout as the primary cause.
