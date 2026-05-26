# Gas Clone Operations Plan

## Executive recommendation

Use the **simplest operational clone path**: create a second sibling folder under `/Users/ricardoaltamirano/Developer`, keep it as a separate Git working copy/repository, do **not** copy local generated/runtime files, then provision a separate Amplify Gen 2 sandbox/deployment from that folder after renaming the app/brand/domain/CORS values.

Recommended folder:

```bash
/Users/ricardoaltamirano/Developer/SecondstreamAI-gas
```

Do not treat the current dirty working tree as the desired source of truth. The current branch is `main`, and `git status --short` shows many deleted root documents plus modified `README.md` and untracked `docs/screenshots/` and `gas-clone/`. Decide what source ref to clone from before copying.

`skill_resolution: paths-injected` — loaded `/Users/ricardoaltamirano/.config/opencode/skills/cognitive-doc-design/SKILL.md` for this bounded operational documentation report.

## What matters in this codebase

| Area | Current fact | Clone implication |
| --- | --- | --- |
| Package | `package.json` name is `goodchat`; private app; Node engine `>=22 <23`; Bun for app scripts; Amplify CLI via `npx ampx sandbox`. | Rename package only if desired for local clarity; keep Node 22. Use `bun install`, but use Node/npm for Amplify CLI. |
| Framework | Next.js App Router + React 19 + TypeScript. Scripts: `dev`, `build`, `test`, `check`, `verify:amplify-config`, `amplify:sandbox`. | No monorepo coordination needed. Clone can be independent. |
| Amplify Gen 2 | Backend in `amplify/`; `defineBackend({ auth, data, storage })`; custom stacks for `streaming-canary` and `chat-streaming`; Lambda Function URL is output as `custom.chatStreamingFunctionUrl`. | A separate Amplify app/backend environment is required for AWS isolation. Do not reuse root `amplify_outputs.json`. |
| Auth | Cognito email invite-only: `allowAdminCreateUserOnly = true`; invitation template hardcodes `https://h2oassistant.com`, logo URL, and H2O Allegiant copy. | Gas clone must update auth email subject/body URLs and branding before inviting users. |
| Data | Amplify Data models are owner-scoped: `User`, `AgentConfig`, `Session`, `Message`, `File`, `GeneratedOutput`, `Artifact`. Default auth mode `userPool`. | Schema is reusable; data does not migrate automatically. Decide whether gas clone starts empty or imports data. |
| Storage | Storage name is `secondstreamPrivateFiles`; private path rule `private/{entity_id}/*`. Lambda writes under `lambda-chat/attachments/`; optional S3 fallback prefix defaults to `secondstream/attachments/`. | Rename storage/bucket-facing names/prefixes for gas if you need clean AWS resource names and easier cost attribution. Preserve `private/{entity_id}/*`. |
| Chat transport | Browser posts directly to Lambda Function URL from `amplify_outputs.json#custom.chatStreamingFunctionUrl`; there is no production Next API chat route. | Generated outputs must come from the gas backend. Frontend domain must be in Lambda Function URL CORS allow-list. |
| CORS | `amplify/backend.ts` hardcodes `https://www.h2oassistant.com`, `https://h2oassistant.com`, current Amplify app domain, and `http://localhost:3000`. | Replace/add gas production domains and the gas Amplify app domain before backend deploy, or browser preflight will fail/hang. |
| Agent | Active agent imports `h2oAllegiantPrompt`; skills are `src/ai/skills/h2o-*`; artifact tools are H2O artifact generators; PDF brand tokens and logo are H2O-specific. | A true gas-focused version requires prompt, skills, tool names/schemas, PDF titles/branding, UI copy, and assets to change. |
| Local generated files | `.gitignore` excludes `.env*`, `amplify_outputs.json`, `.amplify/`, `.next/`, `.output/`, `node_modules/`, `*.tsbuildinfo`, `.atl/`, `.pi/`, reports, tmp, openspec. | Do not copy generated/runtime artifacts into the clone. Regenerate install/build/backend outputs inside the gas folder. |
| Secrets | `.env.example` documents AWS/Bedrock credentials and optional fallback S3 settings. `.env` is ignored. | Never copy `.env` blindly. Use separate least-privilege AWS credentials/profile or explicitly confirm shared Bedrock credentials are acceptable. |

## Recommended simplest path

1. **Choose the source ref.** Prefer a clean committed ref from `main` or a tagged baseline. Do not base the clone on the current dirty tree until the deletions/modifications are reviewed.
2. **Create a sibling clone.** Clone from Git or copy only tracked source files into `/Users/ricardoaltamirano/Developer/SecondstreamAI-gas`.
3. **Exclude generated/local files.** Do not copy `.env`, `.amplify/`, `amplify_outputs.json`, `.next/`, `.output/`, `node_modules/`, `tsconfig.tsbuildinfo`, local reports/tmp/tooling metadata.
4. **Rename operational identifiers.** Update package/app naming, visible product copy, domains, email templates, CORS allow-list, storage names/prefixes, prompt/skill/tool/PDF branding from H2O/wastewater to gas.
5. **Provision separate AWS resources.** Run Amplify Gen 2 sandbox/deploy from the gas folder with Node 22. Copy the gas-generated `amplify_outputs.json` into the gas project root only.
6. **Validate locally and with sandbox smoke.** Run config, type/lint/test/build gates, then manual auth/data/storage/chat smoke against the gas backend.

## Alternatives

### Alternative A — same repository, separate branch/environment

Use one repo with a `gas` branch and an Amplify branch/environment.

- **Pros:** simpler Git history, can merge platform fixes between water and gas.
- **Cons:** higher risk of cross-brand mistakes; local files and generated outputs are easy to confuse; a single codebase with hardcoded vertical names will create frequent conflicts until vertical routing exists.
- **Use when:** gas is a near-term variant and you expect shared platform development to dominate.

### Alternative B — fork/new repository from clean baseline

Create a separate repository for the gas clone.

- **Pros:** clean isolation for AWS, secrets, domains, CI, releases, and product copy.
- **Cons:** platform fixes must be manually ported or upstreamed.
- **Use when:** gas is a separate customer/product line and operational isolation matters more than shared iteration speed.

### Alternative C — real multi-vertical platform in one app

Implement a vertical router using the existing `AgentConfig` seam so water and gas are selectable profiles in one deployment.

- **Pros:** best long-term architecture for white-label direction described in `README.md`.
- **Cons:** not the simplest clone; requires design work across routing, prompt/tool registration, artifacts, branding, tenant config, and tests.
- **Use when:** you need one platform deployment serving multiple verticals/tenants, not a quick separate folder.

## Step-by-step checklist

### 0. Preflight decisions

- [ ] Confirm target folder name: recommended `SecondstreamAI-gas`.
- [ ] Confirm source ref: clean `main`, a tag, or current dirty tree after review.
- [ ] Confirm Git strategy: new repo/fork vs branch-only.
- [ ] Confirm AWS strategy: new Amplify app/backend vs same app with separate branch environment.
- [ ] Confirm domain(s): production apex/www and Amplify preview domain.
- [ ] Confirm whether any data/users/files migrate, or gas starts empty.

### 1. Create clone without local artifacts

If using Git:

```bash
cd /Users/ricardoaltamirano/Developer
git clone <repo-url> SecondstreamAI-gas
cd SecondstreamAI-gas
nvm use
bun install
```

If copying from local working tree, use a tracked-file export from a reviewed commit/ref instead of copying the whole folder. Avoid copying ignored/generated paths.

### 2. Remove/regenerate local runtime files in the gas folder

Verify these are absent or freshly generated in the gas folder:

- `.env`
- `.env.*` except `.env.example`
- `amplify_outputs.json`
- `.amplify/`
- `.next/`, `.output/`, `out/`, `build/`, `dist/`
- `node_modules/`
- `tsconfig.tsbuildinfo`
- `reports/`, `tmp/`, `.tmp/`, `.atl/`, `.pi/`, `.pi-lens/`

### 3. Rename app/brand/domain references

Minimum areas to search and update:

```bash
rg "H2O|h2o|Allegiant|h2oassistant|h2oallegiant|SecondstreamAI|goodchat|secondstream" \
  app src amplify public README.md package.json .env.example
```

Known high-value files:

- `package.json` — package name (`goodchat`) and scripts.
- `README.md` — product description and setup docs.
- `app/page.tsx`, `app/layout.tsx`, `app/login/login-view.tsx` — metadata, landing copy, sign-in copy, sales email.
- `components/h2o-allegiant-logo.tsx`, `components/app-sidebar.tsx`, `components/chat-interface.tsx` — logo and prompt placeholder.
- `public/*`, especially `h2o-allegiant.png`, `h2o-allegiant-email.png`, `public/landing.html`, favicon/OG assets.
- `amplify/auth/resource.ts` — Cognito invitation email URL, logo URL, subject/body.
- `amplify/backend.ts` — CORS allow-list and Lambda bundling copy of `public/h2o-allegiant.png`.
- `amplify/storage/resource.ts` — storage resource name `secondstreamPrivateFiles` if clean naming is desired.
- `src/ai/prompts/h2o-allegiant.md` and generated `.ts` — active system prompt.
- `scripts/generate-prompts.ts` — generated prompt file names/export name.
- `src/ai/skills/h2o-*` — skill directory names/content discovered at runtime.
- `src/ai/tools/h2o-artifacts.ts` and PDF docs under `src/lib/artifacts/pdf/` — artifact schemas, titles, PDF metadata, brand tokens, logo path.
- Tests containing H2O/secondstream strings.

### 4. Provision Amplify isolation

From the gas folder:

```bash
nvm use
npx ampx sandbox
```

Then copy/use the generated `amplify_outputs.json` for the gas project and verify:

```bash
bun run verify:amplify-config
```

For production/hosting, create or connect a separate Amplify app/branch for gas, then add the deployed frontend domain(s) to `chatStreamingAllowedOrigins` in `amplify/backend.ts` before backend deploy.

### 5. Validate local code gates

```bash
nvm use
bun install
bun run verify:amplify-config
bunx tsc --noEmit
bun run check -- --max-diagnostics=200
bun run test
bun run build
```

### 6. Manual smoke against gas backend

- [ ] Login page shows gas branding and no public signup.
- [ ] Cognito invite email uses gas name, gas domain, and gas logo.
- [ ] User A and User B cannot see each other's threads.
- [ ] Attachment upload stores under `private/<identityId>/sessions/...` and cross-user read is denied.
- [ ] Chat streams through the gas Lambda Function URL from gas `amplify_outputs.json`.
- [ ] Generated artifacts use gas prompt, gas terms, gas artifact names, gas PDF metadata/logo, and no H2O/wastewater leakage.
- [ ] CloudWatch logs and Bedrock usage are attributable to the gas backend/environment.

## AWS isolation concerns

- **Amplify app/environment:** A second folder alone does not isolate AWS. Isolation comes from a separate Amplify app/backend environment or at least a separate Amplify branch environment.
- **`amplify_outputs.json`:** This file points the frontend at specific Cognito/AppSync/S3/Lambda resources. Never reuse the water output file in gas unless intentionally connecting to the same backend.
- **Cognito:** User pools, app clients, invitation templates, and hosted/auth URLs must be gas-specific. Admin-created-only is enforced in backend code and should remain unless product requirements change.
- **AppSync/DynamoDB:** Owner auth protects users within one backend, but sharing the same backend would mix water/gas product data and operational logs.
- **S3:** Amplify Storage private path must remain `private/{entity_id}/*`. Rename storage resource/prefixes for operational clarity, but do not change the Gen 2-valid private rule shape.
- **Lambda Function URL CORS:** Gas frontend domains must be in `chatStreamingAllowedOrigins`. Missing CORS is a likely silent browser failure.
- **Bedrock:** The Lambda IAM policy allows Bedrock invoke actions. Confirm model access for `us.anthropic.claude-sonnet-4-6` in the selected region/account.
- **CloudWatch/cost attribution:** Separate stacks make log groups and costs easier to attribute. Shared AWS credentials alone do not provide billing separation.

## Cost and security pitfalls

- **Copying `.env`:** Risks leaking or reusing credentials. Prefer a separate AWS profile/role or explicitly documented shared Bedrock credentials.
- **Copying `amplify_outputs.json`:** Causes the gas UI to use water Cognito/Data/Storage/Lambda resources.
- **Copying `.amplify/`:** Can confuse local Amplify app/backend association.
- **Long Lambda timeout:** Chat streaming Lambda has 1024 MB memory and 10-minute timeout. Artifact generation can create noticeable Lambda + Bedrock cost.
- **Prompt-cache economics:** The agent uses Bedrock prompt cache for the static prompt. Rewriting prompts/skills changes cache behavior and can raise first-turn costs.
- **Hardcoded public domains:** Auth email, metadata, CORS, sales mailto links, public landing page, PDF metadata, and logos currently contain H2O-specific values.
- **Fallback S3 runtime:** Optional `CHAT_BLOB_STORE_RUNTIME=s3` requires explicit bucket/prefix/credentials. If used in gas, choose gas-specific bucket/prefix and least-privilege IAM.
- **Dirty source tree:** Current local deletions may remove historical planning docs. Do not mirror them into the clone until reviewed.

## Validation commands

Run from the gas folder unless noted:

```bash
# repo/source sanity
git status --short
git branch --show-current
rg "H2O|h2o|Allegiant|h2oassistant|h2oallegiant|SecondstreamAI|goodchat|secondstream" app src amplify public README.md package.json .env.example

# dependency/runtime
nvm use
bun install

# Amplify generation/config
npx ampx sandbox
bun run verify:amplify-config

# local quality gates
bunx tsc --noEmit
bun run check -- --max-diagnostics=200
bun run test
bun run build

# app smoke
bun run dev
```

## Open questions

1. Should the gas clone be a new Git repository/fork or a branch in the same repository?
2. What exact gas product name, domain, logo, support/sales email, and legal/footer copy should replace H2O Allegiant?
3. Should gas use a fully separate AWS account, a separate Amplify app in the same account, or a separate branch environment under the same Amplify app?
4. Should any users, sessions, files, or artifacts migrate, or should gas start empty?
5. Is the gas assistant a quick prompt/brand swap, or does it need new artifact schemas/PDF renderers/tools equivalent to the H2O Field Brief/Playbook/Analytical Read/Proposal Shell?
6. Which Bedrock region/model should gas use, and are model access quotas already approved?
7. What is the intended production hosting target: Amplify Hosting, another platform, or local/internal only?
8. Should `SecondstreamAI` remain as the platform/company name in PDF metadata and docs, or should it be removed from the gas clone?
