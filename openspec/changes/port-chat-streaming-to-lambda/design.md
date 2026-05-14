# Design: Port Chat Streaming to Lambda

## Status

`design_complete`

## Executive summary

Move only the chat streaming HTTP runtime to an AWS Lambda Function URL with `InvokeMode.RESPONSE_STREAM`. Keep `createChatPostHandler` as the deep chat Module and add runtime Adapters around the existing seams: `ChatStore`, `BlobStore`, `StreamAgent`, `generateText`, and `getOwner`.

Initial production path is **Function URL direct**. API Gateway REST response streaming is a later governance option only, because the current goal is to solve Amplify Hosting `WEB_COMPUTE` buffering with the smallest proven AWS-native surface.

Key decisions:

- Use `awslambda.streamifyResponse()` in a Node.js Lambda runtime.
- Convert the Function URL event into a standard web `Request`, invoke `createChatPostHandler`, then progressively pipe the returned web `Response.body` into Lambda `responseStream`.
- Use Function URL auth type `NONE` plus explicit Cognito JWT verification in the handler; browser SigV4 is not required for the spike.
- Recommend the frontend send a **Cognito access token** for authorization. Use `sub` as `OwnerContext.userId`. Do not depend on ID-token profile claims for API authorization.
- Do not rely on Cognito `identityId` for Lambda blob paths. For the Lambda path, use a role-backed S3 `BlobStore` keyed by stable `userId` and `threadId`, while keeping the existing Next/Amplify private-storage adapter for rollback.
- Prefer a portable AppSync/Amplify Data IAM `ChatStore` adapter for Lambda if feasible in implementation; fall back to a narrow direct DynamoDB adapter only if generated AppSync server access is too costly or fragile.
- Keep same-origin `/api/chat` and the existing Next adapters available as config-only rollback.

## Goals and non-goals

### Goals

- Preserve `createChatPostHandler` and its request/response contract.
- Add a Lambda runtime Adapter, not a chat-domain rewrite.
- Deliver progressive AI SDK UI message stream chunks in AWS production.
- Preserve request validation, persistence semantics, attachment constraints, regenerate, and title generation.
- Keep rollback to `/api/chat` configuration-only.
- Define least-privilege infrastructure, observability, CORS, and strict TDD test strategy.

### Non-goals

- No app code implementation in this design phase.
- No migration of the whole Next.js app off Amplify Hosting.
- No API Gateway REST, CloudFront, WAF, custom domain, VPC, WebSocket, or AppSync realtime in the initial path.
- No removal of `/api/chat` or the current Next/Amplify SSR stores before Lambda verification.

## Current architecture summary

Current chat execution is already shaped correctly for a runtime migration:

- `src/lib/chat-handler.ts` exports `createChatPostHandler(deps)` and `chatPost()`.
- `createChatPostHandler` accepts a standard web `Request` and returns a standard web `Response`.
- It parses the AI SDK transport body with `parseChatRequest`, resolves `OwnerContext`, persists user/assistant messages, loads attachments for Bedrock, streams via the injected agent, and returns `createUIMessageStreamResponse({ stream })`.
- Current default adapters are runtime-specific:
  - `getCurrentOwner()` uses Amplify Auth server APIs with Next cookies.
  - `AmplifyChatStore` uses `generateServerClientUsingCookies`.
  - `AmplifyBlobStore` uses Amplify Storage server APIs and private paths under `private/{identityId}/...`.

The design keeps that Module intact and adds Lambda-compatible adapters beside the existing Next adapters.

## Proposed runtime architecture

```text
Browser chat UI
  ├─ default/rollback: POST same-origin /api/chat
  └─ lambda enabled: POST https://<function-url>/ with Authorization: Bearer <access-token>

Lambda Function URL (InvokeMode.RESPONSE_STREAM, authType NONE, restricted CORS)
  └─ awslambda.streamifyResponse(handler)
       ├─ Function URL event -> web Request Adapter
       ├─ Cognito access JWT -> OwnerContext Adapter
       ├─ Lambda ChatStore Adapter
       ├─ Lambda BlobStore Adapter
       ├─ existing createChatPostHandler(...)
       └─ web Response.body -> Lambda responseStream Adapter
```

### Runtime Adapter contract

Add a Lambda handler module under the Amplify function source later, for example `amplify/functions/chat-streaming/handler.ts`. It should construct the existing handler with Lambda-specific dependencies:

- `chatStore`: Lambda-compatible `ChatStore`.
- `blobStore`: Lambda-compatible `BlobStore`.
- `agent`: existing agent import.
- `generateText`: existing AI SDK `generateText` import.
- `getOwner`: Lambda Cognito JWT owner adapter bound to the current request headers.

The adapter MUST NOT call `chatPost()` because `chatPost()` wires the Next-cookie default adapters. It MUST call `createChatPostHandler(...)` directly.

### Event to web Request

The Function URL event adapter should:

- Accept only `POST` for chat execution and `OPTIONS` for CORS preflight.
- Reconstruct URL from the Function URL domain/path or configured public endpoint.
- Preserve required headers, especially `content-type`, `authorization`, AI SDK-relevant accept headers, and request correlation headers.
- Decode body using `event.isBase64Encoded`.
- Create `new Request(url, { method, headers, body })` for POST.
- Reject unsupported methods with `405` and request parse failures with a non-streaming error response.

### Web Response to Lambda responseStream

The stream adapter should:

1. Await `createChatPostHandler({ ... })({ request })`.
2. Copy status code and response headers before body writes.
3. Preserve `content-type` from `createUIMessageStreamResponse` exactly when present.
4. Set cache-disabling headers appropriate for streaming (`cache-control: no-cache, no-transform`) unless the web response already sets stricter values.
5. Pipe `Response.body` progressively using a reader loop:
   - `const reader = response.body?.getReader()`
   - for each `Uint8Array` chunk, `responseStream.write(Buffer.from(chunk))`
   - close with `responseStream.end()` in `finally` after successful or handled error completion.
6. If `response.body` is null, write `await response.arrayBuffer()` once and close.
7. Log first-byte time when the first chunk is written and stream completion/error boundaries.

Implementation should avoid buffering the whole body with `response.text()` or `arrayBuffer()` for normal streaming responses.

## Auth and owner design

### Decision: send access token first

Recommend the frontend send Cognito **access token** in `Authorization: Bearer <token>`.

Rationale:

- Access tokens are intended for API authorization.
- `token_use` can be strictly verified as `access`.
- The token contains stable `sub` and Cognito username/client claims sufficient to resolve application ownership.
- ID tokens are identity/profile assertions for the client and increase risk of treating profile-oriented claims as API authorization.

The Lambda verifier should use `aws-jwt-verify` as a direct dependency if imported by Lambda code. Verification requirements:

- issuer matches the configured Cognito User Pool.
- `token_use` is `access`.
- client ID/audience rules match Cognito access-token verifier expectations (`clientId` for access tokens).
- expiration, signature, and key id are valid.
- missing, malformed, wrong issuer, wrong client, wrong token use, and expired tokens are rejected before chat execution.

### OwnerContext mapping

Map verified token claims to:

```ts
{
  userId: claims.sub,
  identityId: claims.sub
}
```

For Lambda chat authorization, `userId` is the canonical owner key. `identityId` is retained only to satisfy the existing `OwnerContext` shape and MUST NOT be used for new Lambda S3 object ownership unless a future design explicitly maps Cognito Identity Pool IDs.

### ID token fallback

Do not support ID token by default. If implementation discovers that the frontend auth library can only retrieve ID tokens in the target UI without larger changes, support must be an explicit decision with separate verifier configuration (`token_use: id`, audience/client handling) and tests. The design recommendation remains access-token first.

## Portable ChatStore design

### Decision: prefer AppSync/Amplify Data IAM adapter; direct DynamoDB fallback

The Lambda path needs `ChatStore` behavior compatible with existing `AmplifyChatStore`:

- `getThreadMessages`
- `saveMessage`
- `createThread`
- `getThreadById`
- `updateThreadTitle`
- `listThreads`
- `deleteThread`
- `replaceAssistantMessageAfter`
- `cloneThread`

Preferred implementation is a Lambda `ChatStore` that calls Amplify Data/AppSync with IAM credentials from the Lambda role. This preserves the generated data API boundary and avoids coupling to table internals.

If AppSync IAM access from Lambda is materially complex, implementation may use a narrow direct DynamoDB adapter against the generated Amplify tables, but only if tasks document table names/indexes as environment variables and tests prove semantic equivalence. Direct DynamoDB is more operationally coupled and should be treated as fallback, not first choice.

### Compatibility requirements

- Store `resourceId` as `owner.userId` (`claims.sub`) exactly as the current handler does.
- Existing authorization check in `createChatPostHandler` (`thread.resourceId !== owner.userId`) remains authoritative at the chat Module layer.
- `replaceAssistantMessageAfter` must preserve regenerate semantics by deleting/truncating later messages and writing the new assistant message in order.
- `updateThreadTitle` must reliably update title and updated time semantics; current `AmplifyChatStore.bumpUpdatedAt` updates title with current title to force timestamp behavior, but the Lambda adapter should use explicit timestamp fields if available.
- List and get behavior must not leak cross-user threads.

## Portable BlobStore design

### Decision: role-backed S3 BlobStore keyed by userId/threadId

Current `AmplifyBlobStore` private paths require a Cognito `identityId` from Amplify SSR context. Lambda receives a User Pool JWT, not necessarily a Cognito Identity Pool identity ID. Mapping identity IDs during streaming would add Cognito Identity calls, caching, failure modes, and ambiguity between `userId` and `identityId`.

For the Lambda path, use a Lambda role-backed S3 `BlobStore` with keys shaped by stable application ownership:

```text
<configured-prefix>/users/<userId>/threads/<threadId>/<uuid>-<safe-filename>
```

This requires a small owner-aware wrapper or a Lambda-specific blob store factory, because the existing `BlobStore.put(input)` does not include owner. The wrapper can close over `OwnerContext` for the request and still expose the existing `BlobStore` interface to `createChatPostHandler`.

### Existing S3 fallback note

`src/lib/storage/s3-blob-store.ts` currently signs S3 requests manually and requires explicit credentials when used from server paths. In Lambda, prefer AWS SDK v3 S3 client or role-based default credential provider instead of requiring static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`. If the existing custom signer is reused, it must be extended to use the Lambda role credential provider safely; static credentials are not acceptable for the Lambda production path.

### Attachment compatibility

- `parseChatRequest` remains responsible for count, size, MIME family, and PDF text constraints.
- `withAttachmentPersistence` continues to receive a `BlobStore` and convert data URLs to persisted attachment refs.
- `withBedrockAttachmentData` continues to call `blobStore.get(metadata.s3Key)` before Bedrock invocation.
- New Lambda S3 keys and existing Amplify private keys may coexist during canary. Do not assume objects written by one adapter are readable by the other unless the adapter explicitly supports both key shapes.

### identityId/userId issue

Design decision: for Lambda-written attachments, `userId` (`sub`) is the owner path component. `identityId` is not required. Existing Next-path attachments may still use `private/{identityId}/...`; rollback remains safe for existing Next behavior, but cross-path attachment replay must be tested. If mixed-mode reading is required during rollout, the Lambda `BlobStore.get` may need to accept both new `users/{userId}` keys and old `private/{identityId}` keys, but old private reads require a deliberate permission and identity mapping decision.

## CORS design

Function URL CORS must be restrictive:

- Allowed origins: configured Amplify app production origin plus explicitly listed sandbox/preview origins.
- Allowed methods: `POST`, `OPTIONS`.
- Allowed headers: `authorization`, `content-type`, and any required AI SDK transport headers discovered in tests.
- Exposed headers: error/debug correlation headers that are safe for the browser, such as `x-request-id` and `x-error-code`.
- Credentials: normally `false` for bearer-token cross-origin calls; do not rely on cookies for Lambda Function URL auth.
- Max age: reasonable preflight cache, e.g. 300-600 seconds.

CORS must be enforced in Function URL configuration and validated in handler tests for preflight behavior. The handler should still reject unauthorized POST requests even if CORS is misconfigured.

## IAM least privilege

Lambda execution role should include only required actions:

- Bedrock model invocation permissions already needed by the existing agent path, scoped to selected models/regions where possible.
- AppSync GraphQL `appsync:GraphQL` scoped to the Amplify Data API ARN and required operation paths if AppSync adapter is selected.
- Or DynamoDB permissions scoped to required generated tables/indexes if direct DynamoDB fallback is selected (`GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `BatchWriteItem` as needed).
- S3 permissions scoped to the attachment bucket and configured Lambda prefix only: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`; `s3:ListBucket` only if tests prove it is needed, scoped by prefix condition.
- CloudWatch Logs for Lambda execution.
- No VPC attachment for Function URL streaming path.
- No static AWS credentials in Lambda environment.

Function URL should use `InvokeMode.RESPONSE_STREAM`. Auth type should be `NONE` for browser bearer-token spike, with explicit JWT verification in code.

## Frontend transport design

Add a config-based transport switch, preserving the AI SDK request body contract parsed by `parseChatRequest`.

Modes:

- Default: `api: "/api/chat"`, no Authorization header, same-origin cookies continue to work.
- Lambda enabled: `api: <public Function URL>`, add `Authorization: Bearer <Cognito access token>`.

The existing `DefaultChatTransport` and `prepareSendMessagesRequest` shape must be preserved. The transport switch should only change endpoint and headers, not the payload fields: `threadId`, `messages`, `trigger`, `messageId`, `modelId`, and `webSearchEnabled`.

Frontend config should be public and explicit, for example:

- `NEXT_PUBLIC_CHAT_TRANSPORT=same-origin|lambda`
- `NEXT_PUBLIC_CHAT_LAMBDA_URL=https://...`

Token retrieval must happen immediately before send so expired tokens are refreshed by Amplify Auth where possible. If no valid token is available in lambda mode, the UI should fail before sending or surface an auth-required error rather than making an anonymous Function URL request.

## Observability

Each Lambda request should emit structured logs with a correlation id:

- request start: method, origin class, request id, thread id if parseable.
- auth result: success/failure reason category, not raw token.
- parse/validation failure: status and `x-error-code`.
- persistence stages: thread get/create, message save, attachment put/get, assistant save, title update.
- stream timings: handler start, stream response created, first byte written, stream complete, stream error.
- Bedrock/agent error category from existing chat handler logs.

Do not log message content, attachment bytes, bearer tokens, or raw JWT claims.

## Rollout and rollback

### Rollout

1. Keep `/api/chat` as default.
2. Deploy Lambda Function URL disabled from normal frontend config.
3. Validate infrastructure: Function URL uses `RESPONSE_STREAM`, CORS allowlist is correct, IAM is scoped.
4. Validate streaming with `curl -N --no-buffer` against a test token and with browser chat in sandbox.
5. Canary enable `NEXT_PUBLIC_CHAT_TRANSPORT=lambda` for a controlled environment/cohort.
6. Verify streaming, auth rejection, persistence reload, regenerate, title update, attachments, and rollback.
7. Only after verification, decide whether Function URL direct remains production path or graduates to API Gateway REST response streaming for governance.
8. Remove or explicitly decommission temporary canary resources after the cutover/governance decision.

### Rollback

- Set transport config back to same-origin `/api/chat`.
- Keep Lambda deployed but unused for diagnosis, or remove it in cleanup.
- Because `createChatPostHandler` and storage interfaces are preserved, rollback does not require chat-domain code changes.
- If canary wrote attachments using new Lambda S3 key shape, ensure rollback users can still load conversations they touched during canary or explicitly scope canary users/data before production exposure.

## Later API Gateway REST governance option

API Gateway REST response streaming is not part of the initial implementation. Revisit it only when direct Function URL lacks required production governance such as custom domain policy, WAF, centralized API throttling, or compliance controls. Do not substitute HTTP API as a streaming path unless AWS documentation and a canary prove equivalent streaming support for this use case.

## Test strategy and strict TDD evidence

Strict TDD is active. Later implementation must record RED, GREEN, TRIANGULATE, and REFACTOR evidence.

Required tests:

1. Runtime event adapter
   - RED/GREEN for POST event to web `Request` conversion.
   - Base64 and plain body handling.
   - Header preservation, method rejection, malformed body.
   - OPTIONS preflight behavior.

2. Stream piping adapter
   - Progressive chunk writes are observed in order without buffering.
   - Status and headers are copied before first write.
   - Empty/null body response works.
   - Stream errors close/log correctly.

3. Cognito owner adapter
   - Missing bearer, malformed token, expired token, wrong issuer, wrong client/audience, wrong `token_use` rejected.
   - Valid access token maps `sub` to `OwnerContext.userId`.
   - ID-token acceptance remains rejected unless explicitly enabled by a later decision.

4. ChatStore adapter
   - Shared contract tests for create/read/list/delete.
   - Save message ordering.
   - Regenerate-safe `replaceAssistantMessageAfter`.
   - Clone thread semantics.
   - Cross-user thread access behavior remains blocked by `createChatPostHandler` owner check.

5. BlobStore adapter
   - Put/get/delete with Lambda role credentials mocked or local fake.
   - Key shape includes `users/{userId}/threads/{threadId}` and sanitizes unsafe path segments.
   - Attachment refs round-trip through existing chat handler behavior.
   - Existing validation constraints remain enforced by `parseChatRequest` tests.

6. Frontend transport
   - Same-origin mode keeps `/api/chat` and payload shape.
   - Lambda mode uses Function URL and adds `Authorization` header.
   - Token retrieval failure is handled.
   - `prepareSendMessagesRequest` continues to include required fields.

7. Infrastructure assertions
   - Function URL `InvokeMode.RESPONSE_STREAM`.
   - CORS origins/methods/headers restricted as designed.
   - IAM policies scoped to Bedrock, AppSync/DynamoDB, S3 prefix, and logs.
   - No static AWS credentials required for Lambda storage.

Verification commands for later phases:

- `bun run test <file>` for targeted suites.
- `bun run test` for full test suite.
- `bunx tsc --noEmit`.
- `bun run check` with known pre-existing UI lint issues separated from this change.
- `bun run verify:amplify-config`.
- Amplify sandbox/smoke: `nvm use` then `npx ampx sandbox`.
- Streaming smoke: `curl -N --no-buffer` with an approved test Cognito access token.

## File changes planned for implementation

No app code is implemented in this design phase. Later implementation is expected to add or modify:

- `amplify/backend.ts` — Function URL, env, CORS, IAM.
- `amplify/functions/chat-streaming/*` — Lambda runtime handler and adapters.
- `src/lib/auth/*` or function-local auth module — Cognito JWT owner adapter.
- `src/lib/storage/*` — portable Lambda `ChatStore` and role-backed S3 `BlobStore` adapters or factories.
- `src/components/chat-interface.tsx` and supporting config module — transport switch and bearer header injection.
- Tests for runtime, auth, stores, frontend config, and infrastructure assertions.

## Risks and mitigations

| Risk                                                        | Mitigation                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| AppSync IAM adapter is more complex than expected           | Keep `ChatStore` contract tests; allow direct DynamoDB fallback with explicit env/table decisions.                           |
| Access-token/client verification mismatch                   | Use `aws-jwt-verify` Cognito verifier tests for all failure modes before wiring UI.                                          |
| Lambda cannot read old private `identityId` attachment keys | Scope canary carefully; decide separately whether mixed key reads are required.                                              |
| CORS blocks browser streaming                               | Test preflight and browser transport in sandbox before canary.                                                               |
| Function URL direct lacks governance                        | Accept for spike; document REST response streaming as later option.                                                          |
| Long streams increase cost/duration                         | Set timeout/concurrency deliberately and log first byte/close timings.                                                       |
| Implementation diff gets large                              | Split tasks into runtime/auth/store/frontend/infrastructure slices and pause if estimated review exceeds ~400 changed lines. |

## Open decisions for tasks/apply

- Exact AppSync IAM vs direct DynamoDB implementation after a short feasibility spike.
- Exact public environment variable names for transport config.
- Whether mixed-mode reading of old `private/{identityId}` attachment keys is required during canary.
- Final allowlist of production/sandbox origins.

## Skill resolution

`injected` — project standards and SDD constraints were provided by parent orchestration.
