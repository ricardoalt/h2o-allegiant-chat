# Verify Report — port-chat-streaming-to-lambda

**Status**: ⚠️ PARTIAL PASS — cold-start crash resolved; real Cognito smoke pending
**Date**: 2026-05-14

---

## Summary

**Phase 1 (initial verify):** Unit tests (132/132), TypeScript, and seam structure all passed. Lambda cold-start crashed in deployed sandbox with `Runtime.ImportModuleError: Cannot find module '@libsql/linux-x64-gnu'`.

**Phase 2 (bundle fix applied):** Surgical split of `chat-handler.ts` eliminated all Lambda-unsafe imports from the bundle. Sandbox redeployed. Invalid-token curl now reaches application code and returns `401 AUTH_REQUIRED`. Cold-start crash confirmed resolved.

**Remaining:** Real Cognito access-token smoke (auth → DynamoDB → S3 → Bedrock → progressive stream) requires manual user action (no test credentials in environment).

---

## Test / Validation Commands

| Command                                 | Result                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `bun run test`                          | ✅ 133/133 passed (post-fix)                                                      |
| `bunx tsc --noEmit`                     | ✅ clean                                                                          |
| `bun run check`                         | ⚠️ 6 errors — all pre-existing                                                    |
| `bun run verify:amplify-config`         | ✅ pass                                                                           |
| Lambda smoke — invalid token (pre-fix)  | ❌ `Cannot find module '@libsql/linux-x64-gnu'` — cold-start crash                |
| Lambda smoke — invalid token (post-fix) | ✅ `HTTP/1.1 401 Unauthorized` + `x-error-code: AUTH_REQUIRED` — app code reached |
| Lambda smoke — real Cognito token       | ⏳ PENDING — requires user to authenticate and supply token                       |

---

## Lambda Bundle Audit (post-fix, local esbuild metafile)

| Module                                  | Inputs in bundle | Status        |
| --------------------------------------- | ---------------- | ------------- |
| `@libsql`                               | 0                | ✅ eliminated |
| `next/headers`                          | 0                | ✅ eliminated |
| `@aws-amplify/adapter-nextjs`           | 0                | ✅ eliminated |
| `aws-amplify/auth/server`               | 0                | ✅ eliminated |
| `aws-amplify/storage/server`            | 0                | ✅ eliminated |
| `src/lib/storage/chat-store.ts`         | 0                | ✅ eliminated |
| `src/lib/auth/server.ts`                | 0                | ✅ eliminated |
| `src/lib/storage/amplify-blob-store.ts` | 0                | ✅ eliminated |

---

## Seams

All intact: `createChatPostHandler` ✅, `ChatStore` ✅, `BlobStore` ✅, `StreamAgent` ✅, `getOwner` ✅.

---

## Strict TDD Compliance

✅ Evidence table present in `apply-progress.md` for all PR1–PR5 slices plus post-fix bundle contamination repair.
✅ All tests GREEN (133/133).
✅ Auth error test coverage added: `handler.test.ts` now includes `AUTH_REQUIRED` path.

---

## Root Cause (resolved)

`src/lib/chat-handler.ts` mixed Lambda-safe `createChatPostHandler` with Next-only `getDefaultHandler()`/`chatPost()` in the same module. CDK `NodejsFunction`/esbuild follows string-literal dynamic imports, bundling `@libsql/client` (native addon), Next headers, and Amplify SSR. Fix: moved `getDefaultHandler`/`chatPost` to `src/lib/chat-handler-next.ts`, updated `app/api/chat/route.ts`. Lambda imports `createChatPostHandler` only from the now Lambda-safe `src/lib/chat-handler.ts`.

---

## Canary Retention Decision

The synthetic `streaming-canary` Function URL (`amplify/functions/streaming-canary/handler.ts`, stack `streaming-canary`) is **retained** until the real chat Lambda path passes end-to-end Cognito-token smoke. It serves as a zero-dependency diagnostic endpoint confirming that Lambda Function URL response streaming itself works independently of chat domain logic.

Recommended removal trigger: real Cognito-token smoke confirms auth → DynamoDB → Bedrock → progressive stream chunks. At that point, `amplify/functions/streaming-canary/` and the `streaming-canary` CDK stack should be removed and `docs/amplify-sandbox-smoke.md` updated accordingly.

---

## Remaining Blockers

1. **PENDING: Real Cognito access-token smoke** — requires user to authenticate and provide token. No test credentials available in `.env` or environment. Exact steps below.
2. **LOW: `AGENTS.md`** — updated (water-sector.md → water-sector.ts reference).
3. **LOW: canary cleanup** — deferred until smoke passes per above.

---

## Real Cognito Smoke — Exact Steps Required from User

Function URL: `https://i2bquluu4ttmvzpuxva665dlye0tnunw.lambda-url.us-east-1.on.aws/`

**Step 1 — Get a Cognito access token:**

Option A (browser): Open the app in a browser (`bun run dev`), log in, open DevTools → Application → Local Storage or Network → copy the `access_token` from any authenticated request.

Option B (CLI, if password is known):

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id 4atp4cr94rv37gifmehf9cko8v \
  --auth-parameters USERNAME=raltamirano@ibyma.com,PASSWORD=<password> \
  --query 'AuthenticationResult.AccessToken' \
  --output text
```

**Step 2 — Run the smoke:**

```bash
ACCESS_TOKEN=<paste-token-here>

curl -N --no-buffer \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  --data '{
    "threadId":"lambda-smoke-thread-001",
    "messages":[{"id":"user-1","role":"user","parts":[{"type":"text","text":"Say hello in one short sentence."}]}],
    "trigger":"submit-message",
    "messageId":"user-1",
    "modelId":"claude-sonnet-4-6",
    "webSearchEnabled":false
  }' \
  'https://i2bquluu4ttmvzpuxva665dlye0tnunw.lambda-url.us-east-1.on.aws/'
```

**Pass condition:** AI SDK UI message chunks arrive progressively (not all at once), HTTP 200, no error payload.

---

## Full Reports

- `reports/port-chat-streaming-to-lambda-verify-audit.md` — initial full verify (cold-start failure).
- `reports/port-chat-streaming-to-lambda-apply-review.md` — fresh reviewer approval of bundle-fix split.
- `reports/port-chat-streaming-to-lambda-remaining-apply.md` — post-fix apply evidence.
