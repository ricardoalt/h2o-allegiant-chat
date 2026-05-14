# Tasks: Port Chat Streaming to Lambda

## Review Workload Forecast

| Field                   | Value                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | 900–1,400                                                                                                         |
| 400-line budget risk    | High                                                                                                              |
| Chained PRs recommended | Yes                                                                                                               |
| Suggested split         | PR 1 (Runtime+Infra) → PR 2 (Auth) → PR 3 (ChatStore) → PR 4 (BlobStore) → PR 5 (Transport+Observability+Cleanup) |
| Delivery strategy       | ask-on-risk                                                                                                       |
| Chain strategy          | stacked-to-main                                                                                                   |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

---

## Work Units

### PR 1 — Lambda Runtime Adapter & Infrastructure

**Goal:** Add the Lambda Function URL runtime shell, event/request/response adapters, and backend CDK wiring. No chat domain logic; only transport.

**Files**

- `amplify/functions/chat-streaming/handler.ts`
- `amplify/functions/chat-streaming/runtime-adapter.ts`
- `amplify/backend.ts`
- `amplify/backend.test.ts`
- `package.json` (add `aws-jwt-verify` dev+prod dependency)

**TDD Evidence Required**

1. **RED** — Write `amplify/functions/chat-streaming/runtime-adapter.test.ts`:
   - POST event with base64 body → valid web `Request` (method, URL, headers, body).
   - POST event with plain text body → valid web `Request`.
   - Malformed JSON body → rejected with 400 before streaming.
   - Unsupported method (GET) → rejected with 405.
   - OPTIONS preflight → returns configured CORS headers without invoking chat handler.
2. **GREEN** — Implement `runtime-adapter.ts`:
   - `createLambdaRequest(event)` builds `new Request(url, { method, headers, body })`.
   - `pipeResponseToStream(response, responseStream)` copies status/headers, reads `Response.body` via `getReader()`, writes `Buffer.from(chunk)` progressively, ends stream in `finally`.
   - Sets `cache-control: no-cache, no-transform` unless response already sets stricter.
3. **TRIANGULATE** — Add null-body response test (falls back to `arrayBuffer()`), add stream error handling test (logs and ends stream safely).
4. **REFACTOR** — Extract shared header whitelist and CORS response builder; ensure handler delegates to adapter functions and does not inline streaming logic.

**Acceptance**

- `bun run test amplify/functions/chat-streaming/runtime-adapter.test.ts` passes.
- `bun run test amplify/backend.test.ts` passes (asserts new stack, `InvokeMode.RESPONSE_STREAM`, `authType: NONE`, CORS allowlist, IAM actions).
- `bunx tsc --noEmit` passes for new handler files.

---

### PR 2 — Cognito Access-Token Owner Adapter

**Goal:** Add a Lambda-specific `getOwner` adapter that verifies `Authorization: Bearer <Cognito access token>` and maps `sub` to `OwnerContext`.

**Files**

- `src/lib/auth/lambda-owner.ts`
- `src/lib/auth/lambda-owner.test.ts`

**TDD Evidence Required**

1. **RED** — Write `lambda-owner.test.ts` with a Cognito JWKS mock:
   - Missing header → throws `AuthRequiredError`.
   - Malformed Bearer prefix → throws `AuthRequiredError`.
   - Expired token → throws `AuthRequiredError`.
   - Wrong issuer → throws `AuthRequiredError`.
   - Wrong client/audience → throws `AuthRequiredError`.
   - Wrong `token_use` (e.g., `id`) → throws `AuthRequiredError`.
   - Valid access token → returns `{ userId: claims.sub, identityId: claims.sub }`.
2. **GREEN** — Implement `lambda-owner.ts` using `aws-jwt-verify` `CognitoJwtVerifier`:
   - Verify issuer (user pool URL), `token_use: "access"`, client ID.
   - Extract `sub` for both `userId` and `identityId`.
   - Do **not** support ID token unless a later explicit decision is recorded.
3. **TRIANGULATE** — Add test for token with unexpected `scope` or missing `sub`; ensure behavior is deterministic.
4. **REFACTOR** — Extract verifier creation to a factory so the same config is reused in tests and handler; keep JWT claims out of logs.

**Acceptance**

- `bun run test src/lib/auth/lambda-owner.test.ts` passes.
- `bunx tsc --noEmit` passes.
- If the frontend auth library cannot retrieve access tokens without larger changes, escalate to supervisor before proceeding to PR 3.

---

### PR 3 — Portable ChatStore Adapter (AppSync/IAM First)

**Goal:** Decide and implement the smallest Lambda-compatible `ChatStore` that preserves existing semantics.

**Files**

- `src/lib/storage/lambda-chat-store.ts` (or `lambda-chat-store-dynamodb.ts` if fallback)
- `src/lib/storage/lambda-chat-store.test.ts`
- `openspec/changes/port-chat-streaming-to-lambda/chat-store-decision.md` (decision record)

**Decision Gate — Feasibility Spike (must complete before coding)**

- Attempt to call the generated Amplify Data/AppSync API from a Lambda role using IAM auth (AWS Signature V4 on GraphQL).
- Time-box to 1 implementation session.
- If feasible: document the AppSync endpoint ARN and required IAM action `appsync:GraphQL`.
- If infeasible or fragile: record the decision to fall back to **direct DynamoDB** against the generated tables, with table names/indexes passed as environment variables.

**TDD Evidence Required**

1. **RED** — Write contract tests in `lambda-chat-store.test.ts` that assert the same behavior as existing `chat-store.test.ts`:
   - `createThread` → thread exists with `resourceId === owner.userId`.
   - `saveMessage` → message appended; `getThreadMessages` returns in order.
   - `replaceAssistantMessageAfter` → truncates later messages and writes new assistant message.
   - `cloneThread` → copies messages up to specified ID.
   - `listThreads(userId)` → returns only that user’s threads.
   - `deleteThread` → removes thread and messages.
2. **GREEN** — Implement the chosen adapter:
   - AppSync path: use IAM-signed GraphQL calls preserving generated mutations/queries.
   - DynamoDB fallback: use `@aws-sdk/client-dynamodb` with Lambda role; document table env vars.
3. **TRIANGULATE** — Add cross-user leak test (requesting another user’s thread returns null/empty); add regenerate semantics test (assistant replace does not corrupt ordering).
4. **REFACTOR** — Extract shared query builders or mutation wrappers; ensure `resourceId` is set from `owner.userId` exactly as current `AmplifyChatStore` does.

**Acceptance**

- `bun run test src/lib/storage/lambda-chat-store.test.ts` passes.
- `bunx tsc --noEmit` passes.
- Decision record is present and reviewed.

---

### PR 4 — Role-Backed S3 BlobStore Adapter

**Goal:** Add a Lambda `BlobStore` that uses the Lambda execution role for S3, with keys scoped to `userId/threadId`.

**Files**

- `src/lib/storage/lambda-blob-store.ts`
- `src/lib/storage/lambda-blob-store.test.ts`

**TDD Evidence Required**

1. **RED** — Write `lambda-blob-store.test.ts`:
   - `put` returns a key containing `users/<userId>/threads/<threadId>/` and a safe filename.
   - `get` returns the original bytes for a key.
   - `delete` removes the object.
   - Unsafe filename characters are sanitized to `-`.
   - Null/empty bytes are rejected at the `BlobStore` boundary.
2. **GREEN** — Implement `lambda-blob-store.ts`:
   - Use AWS SDK v3 `S3Client` with default credential provider (no static `AWS_ACCESS_KEY_ID`).
   - Key format: `<prefix>/users/<userId>/threads/<threadId>/<uuid>-<safe-filename>`.
   - Factory accepts `OwnerContext` and returns a `BlobStore` implementation so `createChatPostHandler` receives the standard interface.
3. **TRIANGULATE** — Add test verifying that the same `BlobStore` instance cannot accidentally write to another user’s prefix (defense in depth, even though `createChatPostHandler` already checks ownership).
4. **REFACTOR** — Extract `createS3Key(input)` helper; share sanitization logic with existing `s3-blob-store.ts` if possible.

**Acceptance**

- `bun run test src/lib/storage/lambda-blob-store.test.ts` passes.
- `bunx tsc --noEmit` passes.
- Key shape documented in code comments.

---

### PR 5 — Frontend Transport Switch, Observability & Cleanup

**Goal:** Wire the frontend to target the Function URL with a Bearer token, add structured Lambda logs, and remove temporary canary resources.

**Files**

- `src/config/env.ts` (or new `src/config/chat-transport.ts`)
- `src/components/chat-interface.tsx`
- `amplify/functions/chat-streaming/handler.ts` (add observability)
- `amplify/functions/chat-streaming/observability.ts`
- `docs/lambda-chat-smoke.md`
- `amplify/backend.ts` (remove or disable `streaming-canary` stack)
- `amplify/backend.test.ts` (update assertions)

**TDD Evidence Required**

1. **RED** — Write tests for transport config and UI behavior:
   - `prepareChatSendMessagesRequest` preserves payload shape (`threadId`, `messages`, `trigger`, `messageId`, `modelId`, `webSearchEnabled`) regardless of transport mode.
   - Lambda mode: `DefaultChatTransport` uses configured Function URL and injects `Authorization: Bearer <token>`.
   - Same-origin mode: no `Authorization` header; endpoint is `/api/chat`.
   - Token retrieval failure: UI surfaces error before sending.
2. **GREEN** — Implement transport switch:
   - Read `NEXT_PUBLIC_CHAT_TRANSPORT` (`same-origin` | `lambda`) and `NEXT_PUBLIC_CHAT_LAMBDA_URL`.
   - Fetch Cognito access token via Amplify Auth immediately before send; pass it in the `headers` callback or `prepareSendMessagesRequest` wrapper.
   - Keep `prepareChatSendMessagesRequest` body contract unchanged.
3. **TRIANGULATE** — Add test for CORS preflight failure simulation; add test confirming rollback config flips endpoint without code changes.
4. **REFACTOR** — Extract transport factory so `ChatInterface` does not branch on env vars directly.

**Observability Tasks**

- Add `createCorrelationId()` in `observability.ts`.
- In `handler.ts`, emit structured JSON logs:
  - `request_start`: correlation id, thread id, origin.
  - `auth_result`: success/failure category, timing ms.
  - `persistence_stage`: stage name, timing ms.
  - `stream_event`: first_byte_ms, complete_ms, error category.
- Do not log message content, tokens, or JWT claims.

**Cleanup Tasks**

- Remove the `streaming-canary` stack from `amplify/backend.ts` and its handler files if the canary is no longer needed.
- Update `amplify/backend.test.ts` to assert canary removal or deactivation.
- Document smoke validation in `docs/lambda-chat-smoke.md`:
  - `curl -N --no-buffer -H "Authorization: Bearer <token>" <function-url>`
  - Browser validation steps in Amplify sandbox.

**Acceptance**

- `bun run test src/components/chat-interface.test.ts` passes.
- `bun run test amplify/backend.test.ts` passes.
- `bunx tsc --noEmit` passes.
- `bun run check` passes; pre-existing UI lint issues are noted separately.

---

## Verification Gates (apply to all PRs)

| Gate           | Command                           |
| -------------- | --------------------------------- |
| Unit tests     | `bun run test <file>`             |
| Full suite     | `bun run test`                    |
| Type check     | `bunx tsc --noEmit`               |
| Lint/format    | `bun run check`                   |
| Amplify config | `bun run verify:amplify-config`   |
| Sandbox smoke  | `nvm use` then `npx ampx sandbox` |

---

## Rollback Plan

- If any PR fails verification, revert transport config to `same-origin` (`NEXT_PUBLIC_CHAT_TRANSPORT=same-origin`).
- Existing `/api/chat` route remains untouched; rollback is a config change, not a code revert.
- Do not remove Next-cookie adapters (`getCurrentOwner`, `AmplifyChatStore`, `AmplifyBlobStore`) until PR 5 is verified in production.

---

## Engram Save Status

- **Engram not available** in this executor session. Task plan is written to `openspec/changes/port-chat-streaming-to-lambda/tasks.md` only.

---

## Standard Phase Envelope

| Field                 | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **status**            | `tasks_complete`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **executive_summary** | Split the chat streaming migration into 5 stacked PRs: Runtime+Infra, Auth, ChatStore, BlobStore, Transport+Observability. Each PR carries strict TDD evidence (RED/GREEN/TRIANGULATE/REFACTOR), concrete file paths, and acceptance gates. Estimated diff exceeds 400 lines; chained delivery is mandatory. Key design decisions are reflected: Function URL direct, access-token auth, AppSync/IAM-first ChatStore with DynamoDB fallback decision gate, role-backed S3 BlobStore keyed by userId/threadId, and config-only rollback. |
| **artifacts**         | `openspec/changes/port-chat-streaming-to-lambda/tasks.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **next_recommended**  | Review this tasks.md for workload forecast and decision gates. Approve or adjust PR split and ChatStore fallback threshold before launching apply phase.                                                                                                                                                                                                                                                                                                                                                                                |
| **risks**             | AppSync IAM feasibility may exceed time-box and force DynamoDB fallback, adding table-env coupling. Frontend access-token retrieval may require ID-token fallback decision. CORS/browser streaming may need sandbox debugging. Reviewer burnout if not chained.                                                                                                                                                                                                                                                                         |
| **skill_resolution**  | `injected` — project standards from AGENTS.md and openspec/config.yaml were pre-resolved. Strict TDD, AWS-only, and 400-line guard are enforced.                                                                                                                                                                                                                                                                                                                                                                                        |
