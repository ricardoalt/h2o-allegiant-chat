# AWS/Amplify Clone Context for Gas-Focused Product

## skill_resolution

- `paths-injected`: loaded/read the requested skill docs at:
  - `/Users/ricardoaltamirano/.agents/skills/ai-sdk/SKILL.md`
  - `/Users/ricardoaltamirano/.agents/skills/vercel-react-best-practices/SKILL.md`
- No source files were modified. This report is the only written artifact.
- Working tree is dirty with many deletions and `gas-clone/` untracked; treat current repo state as non-authoritative for deletions.

## Current AWS/Amplify resources referenced locally

From root `amplify_outputs.json`:

| Resource | Current value | Clone hazard |
|---|---|---|
| Cognito User Pool | `us-east-1_dxJow63e9` | Gas clone users would authenticate into water/H2O user pool if copied. |
| Cognito User Pool Client | `4atp4cr94rv37gifmehf9cko8v` | Frontend cookies/tokens target existing app client. |
| Cognito Identity Pool | `us-east-1:a0d96289-7dea-4d66-a0be-294fdbb090df` | Amplify Storage identity paths and IAM credentials resolve against existing pool. |
| AppSync GraphQL URL | `https://q2kwhdji7rhzrent77qc7ie7cm.appsync-api.us-east-1.amazonaws.com/graphql` | Chat/thread metadata goes to existing data API/DynamoDB tables. |
| S3 bucket | `amplify-goodchat-ricardoa-secondstreamprivatefiles-knm8qqti1eyr` | Attachments/generated PDFs can be written into existing bucket. |
| Lambda Function URL | `https://i2bquluu4ttmvzpuxva665dlye0tnunw.lambda-url.us-east-1.on.aws/` | Browser chat would call existing streaming Lambda and its DDB/S3/Cognito env. |
| Region | `us-east-1` | Bedrock and all current Amplify resources are region-bound. |

The checked-in/generated outputs file is not just metadata: it is imported by client and server runtime paths and therefore directly selects production/sandbox resources.

## Backend resource definitions and deployment shape

### Amplify Gen 2 backend root

- `amplify/backend.ts:9-13` defines the backend with `auth`, `data`, and `storage`.
- `amplify/backend.ts:16-21` mutates Cognito so admin-created users only are allowed (`allowAdminCreateUserOnly: true`).
- `amplify/backend.ts:23-37` creates a separate `streaming-canary` stack with unauthenticated Function URL response streaming.
- `amplify/backend.ts:39-46` hardcodes chat Function URL CORS origins:
  - `https://www.h2oassistant.com`
  - `https://h2oassistant.com`
  - `https://main.d22icjbzj7x471.amplifyapp.com`
  - `http://localhost:3000`
- `amplify/backend.ts:47-58` creates `chat-streaming` stack and binds Amplify Data tables (`Session`, `Message`, `Artifact`) plus the Amplify Storage bucket.
- `amplify/backend.ts:59-100` creates `ChatStreamingFunction` from `amplify/functions/chat-streaming/handler.ts`, Node 22, ESM bundle, 1024 MB, 10-minute timeout.
- `amplify/backend.ts:72-83` injects Lambda env vars for Cognito IDs, DDB table names/index names, bucket name, blob prefix, and allowed origins.
- `amplify/backend.ts:102-139` grants Lambda direct DynamoDB table/index access, S3 access to `lambda-chat/attachments/*`, and Bedrock invoke permissions.
- `amplify/backend.ts:141-161` creates unauthenticated Lambda Function URL with `InvokeMode.RESPONSE_STREAM`, CORS, CloudFormation output `ChatStreamingFunctionUrl`, and `backend.addOutput({ custom.chatStreamingFunctionUrl })`.

Clone implication: running an independent Amplify backend deployment is mandatory. Do not copy the current `amplify_outputs.json` into the gas clone except as a schema example.

### Auth

- `amplify/auth/resource.ts:1-100` defines Cognito email login and a custom invitation email.
- Branding is hardcoded for H2O:
  - `SITE_URL = "https://h2oassistant.com"`
  - `APP_URL = "https://h2oassistant.com/login"`
  - `LOGO_URL = "https://h2oassistant.com/h2o-allegiant-email.png"`
  - Email subject/body: `Welcome to H2O Allegiant`.
- `amplify/backend.ts:16-21` enforces invite-only/admin-created users.

Clone hazards: gas users could receive H2O-branded Cognito emails unless this is changed before deployment; if outputs are shared, user accounts are literally shared.

### Data / DynamoDB / AppSync

- `amplify/data/resource.ts:3-85` defines models: `User`, `AgentConfig`, `Session`, `Message`, `File`, `GeneratedOutput`, `Artifact`.
- All models use owner authorization (`allow.owner()`); default auth mode is Cognito user pool (`amplify/data/resource.ts:88-93`).
- Secondary indexes:
  - `Message` by `sessionId` (`listMessageBySessionId`).
  - `Artifact` by `threadId` and `userId`.
- The streaming Lambda does not call AppSync for chat persistence; it writes underlying Amplify Data DynamoDB tables directly via table names from CDK (`amplify/backend.ts:48-83`).

Clone hazards: shared AppSync URL or Lambda env table names means gas conversations, artifacts, and users land in the existing H2O data plane.

### Storage / S3

- `amplify/storage/resource.ts:3-13` defines bucket name alias `secondstreamPrivateFiles` with path access `private/{entity_id}/*` for Cognito identity read/write/delete.
- Root outputs currently resolve that alias to physical bucket `amplify-goodchat-ricardoa-secondstreamprivatefiles-knm8qqti1eyr`.
- Next/server Amplify uploads use private identity paths: `src/lib/storage/amplify-blob-store.ts:9-12` builds `private/<identityId>/sessions/<threadId>/<id>-<filename>`.
- Lambda chat uploads use direct S3 under `lambda-chat/attachments/users/<userId>/threads/<threadId>/...`: `src/lib/storage/lambda-blob-store.ts:41-58`.
- Generated artifact PDFs share the same Lambda blob bucket and prefix: `src/lib/artifacts/pdf-storage.ts:46-56` builds `<prefix>/artifacts/<userId>/<threadId>/<kind>.pdf`; env loaded at `src/lib/artifacts/pdf-storage.ts:232-256`.

Clone hazards: shared bucket/prefix is the highest-risk data leak for attachments and PDFs. For gas, use a new Amplify deployment/bucket and consider renaming `secondstreamPrivateFiles`/prefixes to gas-specific names for operator clarity.

### Lambda chat transport

- Browser chat posts directly to Function URL from `amplify_outputs.json#custom.chatStreamingFunctionUrl` in `src/components/chat-interface.tsx:111-122`.
- Missing `custom.chatStreamingFunctionUrl` throws at module load (`src/components/chat-interface.tsx:117-122`).
- Auth header uses Cognito access token from current Amplify config: `src/components/chat-interface.tsx:130-139`.
- Lambda handler verifies access tokens against env `COGNITO_USER_POOL_ID` and `COGNITO_USER_POOL_CLIENT_ID`: `amplify/functions/chat-streaming/handler.ts:119-127`; verifier accepts only Cognito access tokens (`src/lib/auth/lambda-owner.ts:47-66`).
- Lambda accepts `OPTIONS`, `POST`, and `GET`; GET is artifact presign, POST is chat stream (`amplify/functions/chat-streaming/handler.ts:80-170`).
- CORS is enforced both at Lambda Function URL config and runtime origin checks (`amplify/functions/chat-streaming/runtime-adapter.ts:119-151`).

Clone hazards: if gas frontend domain is not added to `chatStreamingAllowedOrigins`, browser preflight will fail. If gas frontend uses old outputs, it will authenticate/call the H2O Lambda and be rejected or write to H2O resources depending on token/resource alignment.

## Runtime config paths that select resources

- `app/providers.tsx:1-9`: client `Amplify.configure(outputs, ...)` uses root `amplify_outputs.json`.
- `src/config/amplify-client.ts:1-38`: configures cookie-backed Amplify auth credentials from root outputs.
- `src/lib/auth/amplify-server.ts:1-4`: server runner uses root outputs.
- `src/lib/storage/amplify-chat-store.ts:1-14`: server AppSync model client uses root outputs; constructor fail-fast checks outputs.
- `src/config/amplify-runtime.ts:1-35`: requires `auth`, `data`, and `storage` sections; `bun run verify:amplify-config` checks this.
- `proxy.ts:1-48`: route protection uses Amplify server auth; `/amplify_outputs.json` is publicly bypassed.
- `.env.example:1-24`: local env only covers Bedrock/AWS credentials and optional rollback stores; it does not select Amplify resources.

Important: resource selection is file-based (`amplify_outputs.json`), not `NEXT_PUBLIC_*`. A cloned repo must generate/copy its own outputs file before any real browser/server testing.

## AI/Bedrock dependency relevant to backend cloning

- `src/lib/bedrock-provider.ts:1-9` uses Amazon Bedrock via AWS SDK provider chain and `AWS_REGION || us-east-1`.
- `src/config/models.ts:21-34` exposes one model: `claude-sonnet-4-6`, runtime `us.anthropic.claude-sonnet-4-6`.
- `amplify/backend.ts:129-138` grants Lambda Bedrock invoke permissions for inference profiles/foundation models.
- `src/ai/agents/agent.ts:1-33` imports H2O prompt/skills and uses AI SDK `ToolLoopAgent`; backend bundle copies `src/ai/skills` and `public/h2o-allegiant.png` into Lambda (`amplify/backend.ts:64-70`).

Clone hazards: gas deployment AWS role/account must have Bedrock model access in the target region. The Lambda bundle currently copies an H2O logo and uses H2O-specific prompt/tool names unless separately productized.

## Hardcoded water/H2O/product names that matter for AWS clone safety

These do not all share resources, but they affect deployment correctness, CORS, emails, URLs, storage naming, and operator confusion:

- `package.json:2`: package name `goodchat` influences Amplify-generated physical resource names (current bucket includes `amplify-goodchat-...`).
- `amplify/storage/resource.ts:3-13`: logical storage name `secondstreamPrivateFiles`.
- `amplify/auth/resource.ts`: H2O site URL/logo/email copy.
- `amplify/backend.ts:39-46`: H2O domains and Amplify app domain in CORS allow-list.
- `src/config/env.ts:5-12` and `.env.example:21-23`: optional fallback prefix `secondstream/attachments/`.
- `amplify/backend.ts:64-70`: Lambda bundle copies `public/h2o-allegiant.png`.
- `src/lib/artifacts/pdf/*`: PDF brand tokens/document subjects are H2O-specific.
- `src/components/chat-interface.tsx:37-41`: empty state suggestions are water-focused.

## Recommended duplication path to avoid sharing production resources

1. **Create a clean copy/branch/repo for gas.** Do not rely on current dirty working tree deletions.
2. **Before any deploy/sandbox**, change product identifiers that influence resources and external behavior:
   - `package.json` name from `goodchat` to a gas-specific name.
   - `amplify/storage/resource.ts` storage logical name from `secondstreamPrivateFiles` if desired for clarity.
   - `amplify/auth/resource.ts` SITE_URL, APP_URL, LOGO_URL, subject/body.
   - `amplify/backend.ts` `chatStreamingAllowedOrigins` to gas production/staging domains plus localhost.
   - Fallback prefixes in `.env.example`/`src/config/env.ts` if fallback S3 remains supported.
3. **Deploy a new Amplify backend/sandbox in the intended AWS account/region:**
   - `nvm use`
   - `npx ampx sandbox` for dev, or the project’s chosen Amplify deploy flow for persistent environments.
4. **Replace root `amplify_outputs.json` with the gas-generated outputs.** Confirm every ID/URL/bucket differs from the H2O values listed above.
5. **Run config and local gates:**
   - `bun run verify:amplify-config`
   - `bunx tsc --noEmit`
   - `bun run check -- --max-diagnostics=200`
   - `bun run test`
6. **Smoke test real AWS behavior:** use `docs/amplify-sandbox-smoke.md` and `docs/lambda-chat-smoke.md` adapted for gas. Specifically verify Cognito invite-only, owner isolation, S3 object prefixes, direct Lambda streaming, and artifact presign/download.
7. **Only then point a hosted gas frontend at the gas outputs.** The direct chat transport is baked from root outputs at build/runtime; stale outputs mean stale AWS resources.

## Exact commands/files to inspect next

Commands:

```bash
git status --short
nvm use
npx ampx sandbox
bun run verify:amplify-config
node -e "const o=require('./amplify_outputs.json'); console.log(o.auth?.user_pool_id,o.auth?.user_pool_client_id,o.auth?.identity_pool_id,o.data?.url,o.storage?.bucket_name,o.custom?.chatStreamingFunctionUrl)"
bunx tsc --noEmit
bun run check -- --max-diagnostics=200
bun run test
```

High-value files for clone work:

- `amplify/backend.ts` — stacks, Lambda URL, CORS, env vars, IAM, backend outputs.
- `amplify/auth/resource.ts` — Cognito invite email and H2O URLs/branding.
- `amplify/data/resource.ts` — owner-scoped data model and indexes.
- `amplify/storage/resource.ts` — bucket alias and private path policy.
- `amplify_outputs.json` — generated resource selector; must be gas-specific.
- `src/components/chat-interface.tsx` — direct Lambda Function URL transport and auth header.
- `app/providers.tsx`, `src/config/amplify-client.ts`, `src/lib/auth/amplify-server.ts` — Amplify client/server configuration.
- `amplify/functions/chat-streaming/handler.ts` — Lambda env usage, Cognito verifier, DDB/S3/Bedrock runtime.
- `src/lib/storage/lambda-chat-store.ts`, `src/lib/storage/lambda-blob-store.ts`, `src/lib/artifacts/lambda-artifact-store.ts`, `src/lib/artifacts/pdf-storage.ts` — direct AWS table/bucket usage.
- `docs/amplify-sandbox-smoke.md`, `docs/lambda-chat-smoke.md` — real AWS smoke checklists.

## Open questions before gas clone deployment

- Which AWS account/region should own gas resources, and is Bedrock model access enabled there?
- What are the gas production/staging/frontend domains for Lambda Function URL CORS?
- Should gas be a fully separate Amplify app/backend or an environment in the same Amplify app? For avoiding shared production resources, a separate app/account is safest.
- Should Cognito remain invite-only/admin-created for gas?
- Should data schema remain shared shape, or should gas need domain-specific models/artifacts beyond the reusable chat/session/artifact tables?
- Should H2O-specific agent prompt, tools, PDFs, logo, and email branding be productized before first gas deploy, or is infra isolation the first milestone?
