# Gas clone domain-agent context

`skill_resolution: paths-injected` — loaded the requested skills: `ai-sdk`, `ai-prompt-engineering`, and `ai-elements` from `/Users/ricardoaltamirano/.agents/skills/...` before inspection.

## Executive map

The repo is a reusable Next.js/Amplify chat + artifact platform, but the active vertical is hard-wired as **H2O Allegiant**, a US wastewater business-development assistant. Gas-domain adaptation is mostly a domain/brand/profile swap, not a transport/storage rewrite.

High-coupling areas:

1. **Agent identity + operating contract** — `src/ai/prompts/h2o-allegiant.ts` generated from `.md` is entirely wastewater-specific.
2. **Runtime skill set** — `src/ai/skills/h2o-*` names, descriptions, and bodies encode wastewater lenses, regulations, economics, hazards, and artifact workflow.
3. **Artifact tools + PDF brand** — tool function names and labels are generic-ish artifact shapes, but the factory, descriptions, logs, logos, colors, and PDF copy are H2O-branded.
4. **UI/marketing copy/assets** — app metadata, landing page, login/sidebar logo, empty-state suggestions, public assets, screenshots/docs are water/H2O-specific.
5. **Tests/docs/fixtures** — many tests assert H2O names, wastewater examples, NPDES/POTW/PFAS examples, and exact skill names.

Low-coupling / preserve behavior:

- Chat transport, Lambda handler, auth, owner scoping, thread/message storage, attachment limits, draft state, model selection, Bedrock provider, tool repair, and PDF persistence are platform mechanics and should remain unchanged unless product requirements change.
- Artifact kinds (`field-brief`, `playbook`, `analytical-read`, `proposal-shell`) are domain-agnostic enough to keep initially if the gas product wants the same workflow outputs.

## Key files and water-domain coupling

### Agent runtime wiring

- `src/ai/agents/agent.ts:10` imports `h2oAllegiantPrompt`.
- `src/ai/agents/agent.ts:23` exports `H2O_AGENT_INSTRUCTIONS`.
- `src/ai/agents/agent.ts:37-49` builds `H2O_AGENT_SYSTEM_MESSAGES` with the H2O prompt plus auto-discovered skill block.
- `src/ai/agents/agent.ts:74-90` fixes artifact tool sequence and kind mapping (`generateFieldBrief`, `generatePlaybook`, `generateAnalyticalRead`, `generateProposalShell`). These tool names can stay, but factory names and descriptions are H2O-specific.
- `src/ai/agents/agent.ts:152` checks for loaded skill name `h2o-field-brief` before constraining artifact tools. This is a hard runtime dependency: gas adaptation must update this sentinel to the gas render skill name or keep an alias.

Risk: skill-name changes are not cosmetic. `prepareStep` behavior depends on the render skill name and tests assert it.

### Static system prompt

- `src/ai/prompts/h2o-allegiant.ts:1` says generated from `h2o-allegiant.md`; edit source markdown and regenerate if preserving the current generation pattern.
- Prompt content identifies the agent as `H2O Allegiant Discovery Agent`, "wastewater BD field agent", and anchors on customer economics: BATNA over 5 years including surcharges, forced retrofits, and enforcement exposure.
- It defines a four-artifact package: Field Brief, Playbook, Analytical Read, Proposal Shell.
- It defines stages: `Lead → Qualify → Scope → Position → Propose → Close`.
- It instructs loading exact skills: `h2o-evidence-and-context`, `h2o-stage-and-gaps`, `h2o-positioning`, `h2o-field-brief`, and `h2o-allegiant-brand`.
- It includes wastewater examples: F006, CWSRF, NPDES-like artifact triggers, field-agent/customer-economics framing.

Gas replacement should keep the prompt architecture and output contracts, but replace domain ontology, evidence types, economics, hazards, regulatory boundaries, and skill names.

### Skills

All active runtime skills live under `src/ai/skills/*/SKILL.md`; discovery is automatic.

- `src/ai/skills/discover.ts:91-114` auto-discovers every subdirectory with `SKILL.md`, validates frontmatter `name` equals directory, and sorts by name.
- `src/ai/skills/discover.ts:133-146` builds the `<available_skills>` block used by the agent. No static list to update, but tests expect exactly five H2O skills.

Current skills:

- `src/ai/skills/h2o-evidence-and-context/SKILL.md:2-3` — integrated evidence read. Water terms include `water-evidence-interpretation`, `compliance-and-safety-flagging`, wastewater lens classifications, POTW, PFAS, F006, CWSRF-like questions.
- `src/ai/skills/h2o-stage-and-gaps/SKILL.md:2-3` — stage/gap classification. Mostly reusable sales-stage logic, but gap examples include CWSRF, capex/grant/P3/EaaS, operator skill level, PFAS speciation.
- `src/ai/skills/h2o-positioning/SKILL.md:2-3` — the deepest water coupling. It defines US wastewater solution architecture, economics, funding anchors, cost-of-alternative model, and lens cheat sheet.
- `src/ai/skills/h2o-positioning/SKILL.md:202-283` — complete wastewater lens/unit-economics catalogue: municipal wet weather, industrial discharge, advanced reuse, NRW, biosolids/residuals, stormwater MS4, decentralized onsite.
- `src/ai/skills/h2o-field-brief/SKILL.md:2-3` — renderer skill. Artifact structure is reusable, but examples and themes include PFAS, F006, ELG horizons, compliance flags, operator conversation.
- `src/ai/skills/h2o-allegiant-brand/SKILL.md:2-3` and `:30-34` — H2O brand system; explicitly says water-coded blue/cyan palette and US wastewater Discovery Agent.

Risk: a search/replace of `h2o` to gas is insufficient. The gas clone needs a gas-domain evidence/context skill and especially a new positioning/unit-economics catalogue. Otherwise the agent will still reason like a wastewater BD agent with gas branding.

### Artifact tools and schemas

- `src/ai/tools/h2o-artifacts.ts:13-22` customer schema includes `county`, `state`, `basin`; basin/watershed metadata is water-biased. Gas may need basin as oil/gas basin (could be reusable), plus asset/site/field/operator metadata.
- `src/ai/tools/h2o-artifacts.ts:24` stages are generic sales stages and likely reusable.
- `src/ai/tools/h2o-artifacts.ts:90-127` Playbook schema uses `operator conversation` in comments/default subtitle.
- `src/ai/tools/h2o-artifacts.ts:142-166` Analytical Read comments/examples include produced-water, compliance/safety flags, sub-stream lens rows.
- `src/ai/tools/h2o-artifacts.ts:375-383` default titles are generic except Field Brief uses customer name.
- `src/ai/tools/h2o-artifacts.ts:402-406` logs are `[h2o-artifacts]`.
- `src/ai/tools/h2o-artifacts.ts:588-639` `createH2oArtifactTools` defines tool descriptions with H2O names and gas-ish examples already present in one place: `Pecos East`, produced-water failure, H2S, NORM, SWD integrity. This suggests prior partial gas-domain drift in artifact descriptions, but the rest of the agent is still water/H2O.
- `src/lib/chat-handler.ts:11,52,372` imports/uses `createH2oArtifactTools`.

Risk: tool names are part of AI SDK UI message parts (`tool-generateFieldBrief`, etc.). Keep the four tool names for minimal behavior preservation; rename only factory/internal H2O labels if necessary. Renaming tool functions would cascade through UI rendering, tests, and stored message parts.

### Artifact payloads and PDF rendering

- `src/lib/artifacts/payloads.ts` types are mostly domain-neutral. Water coupling appears in comments (`sub-basin or watershed`) and artifact labels indirectly.
- `src/lib/artifacts/pdf/brand-tokens.ts:1-31` defines `h2oBrand`, water/H2O colors, logo size.
- `src/lib/artifacts/pdf/brand-tokens.ts:34-39` labels are `H2O Allegiant Field Brief`, etc.
- `src/lib/artifacts/pdf/shared-document.tsx:8` default logo path is `public/h2o-allegiant.png`.
- `src/lib/artifacts/pdf/shared-document.tsx:18-30` function is named `resolveH2oPdfLogoSource`; warnings mention H2O.
- `src/lib/artifacts/pdf/shared-document.tsx:136-158` `LogoMark` docs and fallback text say H2O Allegiant.
- `src/lib/artifacts/pdf/shared-document.tsx:193-197` cover metadata includes `Internal handover` (domain-neutral).

Risk: PDF snapshots/tests likely assert layout and exact labels. Changing brand tokens/logos can affect PDF rendering tests even if behavior is otherwise preserved.

### Chat UI and AI Elements usage

- `src/components/chat-interface.tsx:47-51` empty-state suggestions are water-specific: water quality report, water regulation, maintenance procedure. These should become gas-domain prompts.
- `src/components/chat-interface.tsx:53-58` artifact UI labels are generic and likely reusable.
- `src/components/chat-interface.tsx:112-116` heartbeat copy says `Generating artifact package…` and is reusable.
- `src/components/h2o-allegiant-logo.tsx:3-13` hard-coded logo component path `/h2o-allegiant.png` and alt text.
- `src/components/app-sidebar.tsx:12,145` imports/renders `H2OAllegiantLogo`.
- `app/login/login-view.tsx:7,62-65` imports logo and says `Sign in to H2O Allegiant`.
- `app/layout.tsx:25-29` metadata title `H2O Allegiant`, description `Your water intelligence assistant.`
- `app/page.tsx:7-33` marketing metadata is entirely H2O/wastewater and reads `public/landing.html`.
- `public/landing.html` is a full H2O Allegiant wastewater landing page with title/meta and many wastewater examples.

Risk: If the gas clone is product-facing, landing page and auth chrome are visible high-priority changes. If internal-only, agent prompt/skills matter more than marketing.

### Docs and seed/default assets

- `README.md:5-21` describes current vertical as H2O Allegiant wastewater BD and platform direction.
- `README.md:39-45` architecture diagram explicitly maps Water prompt/skills/tools.
- `README.md:61-91` current vertical and capabilities are H2O/wastewater.
- `docs/h2o-allegiant-agent-prd.md` and `docs/h2o-allegiant-agent-flow.md` are domain design docs. They should either be cloned to gas docs or left as historical references clearly marked.
- `docs/index.html` and `public/landing.html` duplicate/variant H2O landing content.
- Assets: `public/h2o-allegiant.png`, `public/h2o-allegiant-email.png`, `public/assets/h2o-allegiant-logo*.png`, `src/assets/h2o-allegiant-logo*.png`, `src/assets/prairie-field-brief.pdf`, `public/assets/prairie-field-brief.pdf`.

Risk: The user warned the working tree is dirty; do not assume deletion of old H2O docs/assets is desired. For a gas clone, prefer adding/repointing gas assets and leaving historical docs unless a cleanup is explicitly approved.

### Tests and fixtures

Water/H2O assertions are broad:

- `src/ai/agents/agent.test.ts` asserts H2O prompt content, skill names, sequential artifact tools, and `h2o-field-brief` sentinel behavior.
- `src/ai/skills/discover.test.ts` asserts exactly five H2O skills and exact skill names/descriptions.
- `src/ai/tools/load-skill.test.ts` loads `h2o-field-brief` and asserts directory/content.
- `src/ai/tools/h2o-artifacts.test.ts` uses `Prairie Water`, NPDES, H2O owners (`H2O PM`, `H2O Estimating`), playbook header examples.
- `src/components/chat-interface.test.tsx` asserts artifact labels and tool parts; mostly reusable unless tool names/labels change.
- `amplify/functions/chat-streaming/artifact-presign.test.ts` fixture uses `acme-water` and `Acme Water Field Brief`.
- PDF tests under `src/lib/artifacts/pdf/*.test.tsx` likely assert exact H2O labels, stage badges, document text, and logo behavior.

Risk: The minimal patch set must update tests alongside code. A clean gas clone with renamed skills will fail tests until expected names/fixtures are changed.

## Water-to-gas replacement map

### Product/brand naming

| Current | Gas-domain replacement decision |
| --- | --- |
| `H2O Allegiant` | Need product name. Placeholder: `Gas Allegiant` or actual customer/product name. |
| `h2o-allegiant` prompt/asset/component prefixes | Use stable gas prefix, e.g. `gas-allegiant` or requested brand. |
| `H2O_AGENT_*` exports | Rename to gas equivalents or keep aliases temporarily for tests/backcompat. |
| `createH2oArtifactTools` / `[h2o-artifacts]` | Rename to `createGasArtifactTools` / `[gas-artifacts]` if not preserving internal names. |
| H2O blue/cyan water-coded palette | Gas brand palette; if no brand, preserve layout but change tokens/labels only. |

### Domain ontology

| Water concept | Gas analogue to define before implementation |
| --- | --- |
| wastewater BD field agent | gas-domain BD / field development / midstream or upstream commercial agent |
| customer case file: permits, eDMRs, NPDES, ECHO, POTW, master plans | gas evidence packet: asset maps, production/flow history, SCADA trends, compressor/pipeline data, LOE, emissions/LDAR, permits, incident reports, integrity/maintenance records, offtake/contracts |
| lenses: municipal-wet-weather, industrial-discharge, advanced-reuse, NRW, biosolids, stormwater, decentralized onsite | gas lenses must be authored: e.g. midstream compression, gathering/pipeline integrity, produced-water handling/SWD, gas processing/treating, emissions/methane compliance, power/fuel optimization, measurement/LACT/allocation, safety/process risk. Exact list is an open product decision. |
| NPDES / CWSRF / DWSRF / WIFIA / ELG / PFAS / F006 / POTW surcharges | gas regulatory/economic anchors: PHMSA/DOT pipeline safety, EPA methane/OOOOb/c, state oil & gas commissions, FERC if interstate/midstream, air permits, flaring/venting rules, H2S/NORM/PSM where applicable. Need domain expert validation. |
| cost-of-alternative: surcharges, forced retrofits, enforcement exposure | gas cost-of-alternative: downtime/deferred production, curtailment, flaring penalties, integrity failure exposure, emissions fees, fuel/power inefficiency, trucking/SWD cost, contract penalties, safety incident exposure. |
| STOP/SPECIALIST/ATTENTION flags: HCN, PFAS, compliance | gas flags: H2S exposure, explosive atmosphere, overpressure/integrity anomaly, methane/air permit breach, NORM, produced-water spill/SWD integrity, PSM/RMP triggers, critical equipment single point of failure. |
| basin/watershed metadata | could become oil/gas basin/field/asset; `basin` is reusable but semantics change. |
| Field Brief / Playbook / Analytical Read / Proposal Shell | likely keep unless gas stakeholder wants different artifact names. |

### Minimal technical replacement map

| File/pattern | Minimal gas adaptation |
| --- | --- |
| `src/ai/prompts/h2o-allegiant.md/.ts` | Create gas prompt source and generated TS; update import in `agent.ts`. Preserve tool contracts and cache split. |
| `src/ai/skills/h2o-*` | Create/rename gas skills with gas frontmatter names and domain bodies. Update prompt and `agent.ts` sentinel. |
| `src/ai/tools/h2o-artifacts.ts` | Keep schemas/tool function names; rename factory/descriptions/log prefix and replace H2O/water comments/examples. Or keep filename/factory initially to minimize diff, but update descriptions because the model reads them. |
| `src/lib/artifacts/pdf/brand-tokens.ts` | Replace `h2oBrand` labels/colors/logo dimensions with gas brand tokens; update imports or keep token name as compatibility debt. |
| `src/lib/artifacts/pdf/shared-document.tsx` | Repoint default logo path and fallback text; rename resolver later if desired. |
| `src/components/h2o-allegiant-logo.tsx` | Create gas logo component or generic `BrandLogo`; update sidebar/login imports. |
| `src/components/chat-interface.tsx` | Replace empty-state suggestions; preserve AI Elements message/tool rendering. |
| `app/page.tsx`, `public/landing.html`, `app/layout.tsx`, `app/login/login-view.tsx` | Update visible product metadata, landing copy, sign-in copy, URL metadata, og images. |
| `README.md`, docs | Update current vertical description; leave H2O docs as historical or clone to gas docs. |
| Tests | Update expected skill names, product names, fixtures, NPDES/Prairie examples, artifact descriptions. |

## Likely minimal patch set preserving behavior

1. **Domain prompt swap**
   - Add `src/ai/prompts/<gas-name>.md` and generated `.ts` following current generation convention.
   - Update `src/ai/agents/agent.ts` import/system message constants to the gas prompt.
   - Preserve `ToolLoopAgent`, Bedrock provider, prompt-cache split, max steps/tokens, repair logic.

2. **Skill swap**
   - Replace the five runtime skill docs with gas equivalents or add gas equivalents and remove/disable H2O ones from discovery.
   - Update the render-skill sentinel in `agent.ts` from `h2o-field-brief` to the gas render skill.
   - Keep the same skill architecture: evidence/context → stage/gaps → positioning → field-brief renderer → brand.

3. **Artifact tool descriptions/brand**
   - Keep tool names `generateFieldBrief`, `generatePlaybook`, `generateAnalyticalRead`, `generateProposalShell` to preserve AI SDK UI parts and tests.
   - Rename/update descriptions so model inputs are gas-specific.
   - Update PDF labels/logo/colors/fallback strings.

4. **UI/marketing visible copy**
   - Update app metadata, landing page, login heading, logo component/assets, empty suggestions.
   - Use gas examples that exercise the same behavior: upload evidence → full package; focused question → no artifacts; explicit single artifact → one tool.

5. **Tests/docs fixtures**
   - Update tests that assert H2O skill names and exact prompt/tool descriptions.
   - Replace `Prairie Water`/NPDES/PFAS fixtures with gas fixtures while preserving schema coverage.
   - Keep platform tests unchanged unless they assert product copy.

## Risks and gotchas

- **Prompt/tool contract drift:** The model reads artifact tool descriptions. If descriptions still say H2O/wastewater, gas prompt behavior will be contaminated even after skill changes.
- **Auto-discovery surprise:** `discoverSkills()` loads all `src/ai/skills/*/SKILL.md`. Leaving both H2O and gas skills active will expose both to the agent unless separated by directory or router.
- **Sentinel coupling:** Artifact tools become constrained only after `h2o-field-brief` is detected. A renamed gas render skill must update this check.
- **Generated prompt source:** `h2o-allegiant.ts` says it is generated from markdown. Editing only `.ts` may be overwritten by `scripts/generate-prompts.ts`.
- **Stored UI message compatibility:** Renaming tool functions changes UI part types (`tool-generatePlaybook`) and can break old messages/artifact cards. Keep function names for minimal clone.
- **Brand vs domain:** `h2oBrand` imports are widespread in PDF documents. Renaming the symbol creates a larger mechanical diff; changing values/labels in place is smaller but leaves internal naming debt.
- **Regulatory accuracy:** Gas-domain regulatory/economic anchors require domain approval. Do not invent precise gas unit economics without source/domain review.
- **Dirty tree:** Existing `gas-clone/domain-agent-context.md` already existed. Only this output artifact was written per task; source files were not modified.

## Open questions for the product owner/domain expert

1. What is the gas product/brand name, logo asset, domain, and preferred color palette?
2. Which gas segment is in scope first: upstream production, midstream gathering/compression, gas processing, pipeline integrity, LNG, utilities, or a broader oil-and-gas BD workflow?
3. Should the four existing artifact names remain (`Field Brief`, `Conversation Playbook`, `Analytical Read`, `Proposal Shell`)?
4. What are the canonical gas opportunity lenses and unit-economics cheat-sheet ranges?
5. Which regulations and safety flags are in scope for v1 (PHMSA, EPA methane, state flaring, PSM/RMP, H2S, NORM, etc.)?
6. Should this be a true clone with H2O files renamed/removed, or a multi-vertical architecture where H2O and gas coexist behind a router?
7. Should public landing/docs be gas-only now, or should historical H2O docs remain visible for platform provenance?

## Validation plan for implementation agent

- Run targeted tests after patching: `bun run test src/ai/agents/agent.test.ts src/ai/skills/discover.test.ts src/ai/tools/load-skill.test.ts src/ai/tools/h2o-artifacts.test.ts src/components/chat-interface.test.tsx` (file names may change if renamed).
- Run PDF/artifact tests if brand tokens or renderers change: `bun run test src/lib/artifacts/pdf` and artifact store/tool tests.
- Run full suite if feasible: `bun run test`.
- Run lint/check after broad rename: `bun run check`.
- Manual smoke: empty chat suggestions show gas prompts; focused gas question answers with no artifact tools; attached gas evidence triggers sequential four-PDF package; login/sidebar/landing show gas brand; generated PDF labels/logos are gas-branded.
