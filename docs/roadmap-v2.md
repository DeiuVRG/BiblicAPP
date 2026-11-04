# Roadmap v2: Ask and the translated books first

Status: plan produced on 4 November 2026 for the reprioritisation of ADR-014 (`docs/decizii.md`). Priorities come from `CLAUDE.md`: (1) the technical product first (app, backend, content, reader,
offline, payments); (2) the reference platform The Faith Received is the product reference, with the focus on the **Ask** chat (answers with citations from the library) and on the **books translated
into Romanian and English**; (3) legal and compliance after the app is ready, except the cheap-now technical decisions (unexposed `content` schema, consent screens, account deletion, licence table).
Companions: `docs/the-faith-received-inventory.md` (what the reference does; feature IDs below), `docs/ui-spec-v2.md` (what we build; check IDs below), `docs/arhitectura-app-biblica.md` (architecture v2; its
own roadmap, section 10, is reordered here), `docs/ask-api.md`, `docs/traducere-pipeline.md`, `docs/multi-edition-spec.md`. Durations are estimates for calendar weeks of mostly agent-driven work with the owner reviewing; the
critical path is content and reviewers, not code. Revised the same evening after two independent reviews of the three documents
(inventory, ui-spec, roadmap): decisions ADR-016 to ADR-026 are listed in section 12.1, and the first push inside P1 (P1a, about two days of agent work)
is defined in section 3.5.

## Contents

0. [Summary](#0-summary)
1. [Baseline on 4 November 2026 (P0)](#1-baseline-on-4-november-2026-p0)
2. [Workstreams and who does what](#2-workstreams-and-who-does-what)
3. [Phase 1: Beta 1](#3-phase-1-beta-1)
4. [Phase 2: depth, accounts, Scripture, search by meaning](#4-phase-2-depth-accounts-scripture-search-by-meaning)
5. [Phase 3: research tools and breadth](#5-phase-3-research-tools-and-breadth)
6. [Phase 4: release](#6-phase-4-release)
7. [Phase 5 and backlog](#7-phase-5-and-backlog)
8. [The books plan (translated works)](#8-the-books-plan-translated-works)
9. [What the owner must provide](#9-what-the-owner-must-provide)
10. [Dependencies and critical path](#10-dependencies-and-critical-path)
11. [Risks](#11-risks)
12. [Decisions to record and questions for the owner](#12-decisions-to-record-and-questions-for-the-owner)
13. [Quality gates, cost and working agreements](#13-quality-gates-cost-and-working-agreements)

---

## 0. Summary

**Order of work.** Two things come first, in parallel: (a) the **Ask** experience on the gateway that already exists, and (b) the **bilingual translated books** (Romanian and English, made from the original), shown through the
reference's look: navigation shell, landing, library, work hub, a reader with parity, the Transparency panel. Accounts, Supabase, Scripture, search by meaning and the research tools follow; payments, stores and compliance come last.

| Phase | Name | Goal in one line | Window (estimate) | Exit gate |
|---|---|---|---|---|
| P0 | Baseline | M0 app, bilingual editions, editorial design, Ask gateway v1 built, Vos in progress | done / in flight | n/a |
| P1 | Beta 1 | The reference's look and reader, Ask v1 live on the web and an APK, a first shelf of bilingual books with transparency | weeks 1-4 | ui-spec section 20 green for P1 items; Ask end to end on the deployed gateway; at least 3 works readable in both languages |
| P2 | Depth | Accounts and sync, hybrid retrieval, Scripture view v1, search by meaning, offline downloads, notebook v1, 12-15 works | weeks 5-12 | Ask gated by a free account with budgets and an evaluation set at threshold; Scripture view on a licensed or public-domain text |
| P3 | Research tools | Topics, Compare, Lexicon, Deep research, scans, work-hub depth, review app, 25+ works | weeks 13-24 | each tool passes its checks; reviewer throughput measured and sufficient for the P4 catalogue |
| P4 | Release | Membership, payments, store submission, compliance, pen test | weeks 25-36 | store approval; compliance checklist signed; at least 5 reviewed AI translations and 10 verified editions (architecture target) |
| P5 | Later | Audio, MCP, SEO preview pages, own hosting of models, group plans | after launch | by trigger |

**What changes against the architecture's roadmap** (to record in `docs/decizii.md`; the entries are in section 12.1 below): AI is no longer phase 2 after the reader, it ships in P1 on the packs-from-disk gateway, with retrieval scoped to the work's editions (the architecture's whole-book mode A waits for its spike and moves to P2, ADR-025),
open to a list of testers by an access code until the DPIA is signed (3.3 criterion 6); Supabase, Auth and the domain move to P2 (Ask beta needs none of them); the signed catalogue,
the Transparency data model and the reference's shell enter P1; legal work (DPO, DPIA, ROPA, store forms) moves to P4 while the cheap-now decisions stay early; the review tool is a file flow (`review.md`) until P3.

---

## 1. Baseline on 4 November 2026 (P0)

| Area | State |
|---|---|
| App | Expo SDK 58, React Native 0.88, Expo Router, TypeScript strict, pnpm monorepo; library, work, reader, search, settings; signed packs verified in the app (Ed25519, pinned keys); bilingual editions with reading language and interface language; editorial design in three themes (Literata and Inter, burgundy accent); web export on GitHub Pages; APK pre-release `v0.1.0-test`; CI with web export and APK. Open item: "Finisare UI" (licence label out of the list, clearer contents numerals, check on a real APK). Accent, fonts and layout are replaced by ui-spec-v2 |
| Content | Vos, *The Teaching of Jesus Concerning the Kingdom of God and the Church* (1903): English source, 11 sections, 131 paragraphs, public domain. Romanian translation: chapter I merged (a partial pack, flagged "Traducere parțială"); chapters II-XI in progress (29 batches; 23 drafts exist at the time of writing, merge and pack pending). Source inventory of 56 files with licence risk in `content/INVENTORY.md` |
| Translation pipeline (v3-lite) | `content-tools`: jobs, checks, merge, review sheet, signing; Sonnet agents for draft, independent critic and revision; target `ro` from English sources; materials per language (`content/translation/`). Not yet: target `en`, Latin or Greek sources, reference-overlap check |
| Ask gateway | `apps/api` (Hono, Node 22): `POST /v1/ask` as SSE (`sources`, `delta`, `citation`, `done`, `error`), `GET /v1/library`, `GET /v1/health`; BM25 retrieval with a Romanian-English glossary bridge; scripture-reference boost; quotation check; per-IP rate limit; mock and Claude providers; Fly.io config and deploy workflow written, **deployment needs the owner's Fly account, token and Anthropic key** (steps in `docs/ask-api.md`). No accounts, no embeddings, no caching |
| Docs | architecture v2, multi-edition spec, design spec (v1), translation pipeline, skill review, security notes, Ask API, decisions log (ADR-001 to ADR-015); this inventory, ui-spec-v2 and roadmap |
| Missing | catalogue (shelves, centuries, blurbs), Transparency data model, shell and landing, accounts, Supabase, Bible texts, offline downloads, reviewer tooling, Playwright UI acceptance |

---

## 2. Workstreams and who does what

| Code | Workstream | Content |
|---|---|---|
| A | App and UI | `apps/mobile`: tokens, components, shell, screens, reader, Ask screen, tests, screenshots |
| B | Ask and retrieval | `apps/api`: deployment, contract changes, retrieval, evaluation, limits, later accounts and budgets |
| C | Books and translation | ingest, pipeline, translations, checks, review sheets, packs, catalogue content |
| D | Data and backend | Supabase (schemas `public` and `content`, RLS, Auth, sync), pack delivery (R2), `ops` service |
| E | Ops and release | CI, deploy, domain and Cloudflare, monitoring, builds, store accounts |
| F | Legal and compliance | cheap-now technical decisions in P1-P3; the full programme in P4 |
| G | Editorial and review | owner decisions, copy, art, reviewers, glossary approvals |

**People.** The orchestrator (Fable) plans, judges and integrates; every subagent runs on Sonnet (`claude-sonnet-5-5`, effort up to max); Opus only exceptionally (for example a final quality judge on a critical deliverable) and the owner is told when it was used
(CLAUDE.md). The owner decides, supplies accounts and keys, approves copy and glossary rows, and names reviewers. Human reviewers (theologians, philologists, native readers of Romanian and English) sign off translations; their throughput bounds the catalogue.

---

## 3. Phase 1: Beta 1

**Goal.** A visitor opens the web app or the APK, sees the reference's structure in our brand, reads a book in Romanian, in English or both side by side, sees how the translation was made, and asks the library a question in either language and gets a cited answer that opens the book at the paragraph.
**Window.** Weeks 1-4 (estimate); the first two days of agent work are the P1a cut of 3.5. **Scope** = ui-spec items tagged P1 and the inventory's MUST rows.

### 3.1 Deliverables

| ID | Workstream | Deliverable | Reference (inventory / ui-spec) | Done when | Cut (3.5) |
|---|---|---|---|---|---|
| P1-A1 | A | Tokens, fonts, themes: three palettes (ui-spec 2.1) with the derived flat tokens and the migration checklist of 2.1 (web template, splash, icons, navigation theme, tests, scripts), IM Fell Great Primer and Source Serif 4 via `@expo-google-fonts` (only the first-paint set is awaited, the rest loads on demand), type scale, radii, motion; Literata kept as option; Gentium Plus for Greek lanes (loaded only with Greek editions); `theme.test.ts` lists the contrast pairs of 2.1 | SH-17, SC-17; ui-spec 2 | all pairs pass; no-hardcoded-colours test green; `Palette` stays flat; icons regenerated; `icons.test`, `theme.test`, `design.test`, `check-web-theme.mjs` and `smoke-web.mjs` green; the shipped TTF total is measured in CI and printed in the README; screenshots of the existing screens in the new look | P1a |
| P1-A2 | A | Component kit: Button variants, Chip, Tabs, Disclosure, Dialog, Sheet, Popover, Toast, Hero, Band, cards, rows, Icon (`react-native-svg` after the native-module check; copy through `expo-clipboard`) | SH-12; ui-spec 3 | each component has a render test and a handler test (key and press handlers called with synthetic events); focus, tab order and Esc behaviour are covered by the Playwright checks G7, G8 and S3; the native-module check is recorded in `docs/decizii.md` | P1a core (Button, Chip, Tabs, Disclosure, Dialog, Sheet, Toast, Icon, Hero, Band); Popover and the rest P1b |
| P1-A3 | A | Shell and routes: brand bar, section bar with drawers (desktop and phone) inside one `PageScroll` scaffold (both bars are the first two children of the screen's scroll container; the section bar is a sticky header), feature flags, review flag, route tree of ui-spec 4.4 (`/` becomes the landing; the library moves to `/library/all`); the Playwright helpers (`scripts/lib/web-export.mjs`, `smoke-web.mjs`, `screenshots-web.mjs`) learn the new routes | SH-02..05, SH-15 | checks S1-S8 | P1a (no review flag, no hide-on-scroll: P1b) |
| P1-A4 | A, C | Signed catalogue: schema (ui-spec 6.8: shelves, authors, issuing bodies, works, packs), `content-tools` build command, loader with verification (the catalogue signature once at start; each pack's sha256 against the signed catalogue when its edition is first opened or searched), derived counts, centuries, shelves | ui-spec 6.8 | catalogue verifies; counts equal pack contents; a pack without an editorial entry still lists; the catalogue lists packId, sha256 and size of every pack; a tampered catalogue is rejected (check C1); cold start on a mid-range Android is measured (budget: at most 2 s added) before the C3 and C4 packs are bundled | P1a (v0) |
| P1-A5 | A | Landing | LP-01, 02, 05..09, 12 (LP-04 as a light editorial band), SH-13 | checks L1-L8 | P1a (bands 1, 2, 3, 6, 8, 11, 12, 13 on the flat `masthead`); bands 4, 5, 7 with art: P1b |
| P1-A6 | A | Library: Selecție, Toată biblioteca (shelves, centuries, A-Z, search by name, URL state), Authors index and author page; works without an individual author are grouped under their issuing body | LB-01..07, 09, 11 | checks B1-B11 | P1a (authors as a plain list); author pages, century tab and tiles: P1b |
| P1-A7 | A | Work hub v2: card, editions, transparency row, Prezentare, Cuprins, actions | WK-01..03, 14, 15 | checks W1-W7 | P1a; StartList and StatTiles: P1b |
| P1-A8 | A | Reader parity: toolbar, outline panel, chapter cards, Aa sheet (steppers, no slider module), Tools panel, find in text (`searchEdition`), keyboard, progress, resume, paragraph actions (hover rail on web; the `¶ n` button and its sheet on touch), local bookmarks and highlights, phone shell | RD-01..03, 05..07, 09..14, 16, 20, 21, 23, 25, 30 (detection and indexing only), 35, 36, 39, 40, 42, 43, 46..50, 55, 56 | checks R1-R5, R10-R19, R21; the native-module check is recorded in `docs/decizii.md`; the `¶ n` button next to selectable text is tried on a real APK before the sheet is committed | P1a core (toolbar, Cuprins panel, chapter card, Aa presets and steppers, find, keys, progress, resume, work bookmark; phone: toolbar and a simple bottom bar); thumb bar, Tools strip, paragraph rail and sheet, highlights, Esc layer manager, hide-on-scroll: P1b |
| P1-A9 | A, C | Bilingual reading: repository `getAlignedSection` and `getAlignedParagraphs`, language control, two lanes, place-keeping switch, placeholders for gaps | RD-26, 28 (balance: stepper and drag handle, no slider module) | checks R6-R8, R20 | P1a (two lanes fixed at 50/50, placeholders); the drag handle: P1b |
| P1-A10 | A, C | Transparency: additive `ProvenanceSchema` fields (kind, the `transcription` flag, model, date, passes, checks, review state, corrections), panel, policy page, provenance records for the Vos editions | TR-01..04, 06 (revisions), 07 (mail), 08, 12 | checks R9, T1-T5, Q3 | P1a |
| P1-A11 | A | Ask screen v1: all of ui-spec 9 except the sidebar, docked panel, share, notebook, Deep research, palette, meter, outline card, tables, perspective cards and the help banner [P2]; entry points from the work hub, reader, author page and paragraph; `ReaderPane`; first-use notice with the tester access code; local conversation | AK-01, 02, 05..08, 10..12, 14..16, 17 (work and author), 18 (simple), 23 (copy), 27 (paragraph), 28..30; RD-38 (Ask action) | checks A1-A26 (A19 to A21 are unit tests) | P1a core (SSE client and the split-inside-ș test, welcome, composer, turn with three progress stages, paragraphs and chips, preview as Sheet or Dialog at every width, receipts, notices, errors, first-use dialog, local conversation, scope chip library or work, language chip); source pane with resize handle, hover Popover, passage attach: P1b |
| P1-A12 | A | Settings updates, About and Transparency pages, Bookmarks page, footer, feedback mail link | AB-01; RS-17 and RS-20 (local); SH-11 (mail link) | checks Q2-Q6 | P1a (minimal: Settings, About, Bookmarks of works) |
| P1-A13 | A, E | Playwright acceptance: `scripts/check-ui-v2.mjs`, fixtures F-1, F-2 and F-3, screenshot matrix in `docs/screenshots/v2/`, CI step, report artifact; native smoke N1-N10 recorded by hand in `report.json`; the capture scripts of the reference committed under `scripts/reference/` (no captured text or images) | ui-spec 20 | script exits 0; screenshots committed; `scripts/reference/` committed | P1a core (runner, F-1, F-3, the checks listed in 3.5, light and dark shots at desktop and phone of landing, library-all, work, reader, reader-lanes, transparency, ask-answer); the full matrix: P1b |
| P1-A14 | A | i18n: every new string in `ro.ts` and `en.ts`, `count()` plural helper (hand-written Romanian categories: Hermes has no `Intl.PluralRules`), century formatter, cedilla lint, `i18n-same.json` | ui-spec 17 | G9, G10 green; a Jest test compares the helper with `Intl.PluralRules` on Node for n = 0 to 1000 | P1a |
| P1-A15 | A | Search screen: ui-spec 10 (modes Lucrări, Pasaje, Întreabă; filters Raft and Limbă; URL state; hand-off to Ask with `?q=`) on the existing local engine (`searchEdition` for passages, the catalogue for works) | SR-01 (basic), SR-04 | check Q1 | P1a (modes Lucrări and Pasaje); filters and the Întreabă hand-off: P1b |
| P1-B1 | B, E | Deploy the gateway on Fly (fra, one machine), set the public API URL (`EXPO_PUBLIC_ASK_API_URL`, a GitHub Actions repository variable read by `web-pages.yml` and `android-apk.yml`) in the web build and the APK, CORS for the web origin, the tester access code (`ACCESS_CODE`, checked before any provider call), dedicated Anthropic workspace with a monthly spend limit and alert | `docs/ask-api.md` deployment | `/v1/health` ok; an Ask question works from the web build and the APK with the access code; a request without it gets `401 access_required` before any provider call | owner (needs the owner's Fly account, token and Anthropic key) |
| P1-B2 | B | Gateway changes the UI wants: the quotation check made against the sources the sentence cites, with the unverified strings in `done`; optional `passage` field; request id in error bodies; `X-Access-Code` check (`401 access_required`; the header joins the CORS allow-list); a global daily question cap (`DAILY_QUESTION_CAP`: `503 provider_busy` with `Retry-After` until midnight) so the spend limit is not the only brake; tests and docs (the exposed `RateLimit-*` and `Retry-After` headers already exist) | ui-spec 9.5, 9.8, 9.11 | contract tests green; `docs/ask-api.md` updated | P1a |
| P1-B3 | B | Suggestions per language (`content/ask/suggestions.<lang>.json`, bundled by the app, approved by the owner) and a retrieval test for each in `apps/api`; evaluation set v0 (40 questions, 20 RO and 20 EN, over the installed works) with structural checks (sources present, valid citations, quotations verified) | AK-06; ui-spec A19 | suggestions test green; eval report committed | P1a |
| P1-B4 | B | Cross-language retrieval: extend the glossary bridge with the vocabulary of every new work; measure on the eval set; write the decision on moving to embeddings in P2 | `docs/ask-api.md` limits | eval shows the gaps; decision recorded | P1b |
| P1-B5 | B | Spike on mode A: the largest planned edition (Augustine, about 27,800 words) as one document with one block per paragraph; measure block count, time to first token, citation accuracy and token count; fallback one block per 2-4 paragraphs | architecture 6 and 10 (phase 0) | numbers recorded in docs/decizii.md; go or no-go for P2-B2 | P1b (needs the owner's Anthropic key) |
| P1-C1 | C | Vos Romanian complete: chapters II-XI merged, checks clean, review sheet generated, pack revision bumped, status "neverificată" with provenance | TR-02..06 | RO pack covers 11 of 11 sections; `committed-content.test.ts` green | P1a |
| P1-C2 | C | Pipeline generalisation: target `en`, sources in Latin and Greek, per-language materials (`rules-en`, `glossary-en`, `calques-en`, prompts), Latin reference grammar, checks parameterised, reference-overlap check against public-domain English translations | `docs/traducere-pipeline.md` 1.1 | tests for each check; a dry run on a Latin chapter and on a Greek passage (Nicene-Constantinopolitan Creed) covering copy-exact Greek, the Greek reference grammar and polytonic rendering in Gentium Plus | P1a |
| P1-C3 | C | First Latin work, Augustine *De spiritu et littera* (P2D-02): clean the OCR, source edition `la`, two translations `en` and `ro` made from the Latin, independent critic, review sheets, three packs | books plan 8.3 | source edition aligned; EN and RO editions cover the chapters done, partial flag shown; both translations "neverificată" with provenance | P1a (the chapters translated so far); completion: P1b |
| P1-C4 | C, G | Creeds starter shelf: 5-6 short public-domain documents (list in 8.3) with article structure; translations from the original where it is not English; works without an individual author carry an issuing body | LB-09; books plan | each document readable in RO and EN | P1a (two documents); the rest: P1b |
| P1-C5 | C, G | Catalogue content: shelves, author records (names per language, dates, short bios labelled editorial or AI), issuing bodies for works without an author, blurbs and "where to start" for every work | ui-spec 6.8, 7 | every installed work has a complete entry | P1a (the installed works) |
| P1-C6 | C, G | Reviewer v0: review sheets handed to the first reviewer, the import path back, the status change flow (pack revision; corrections and review states reach an installed APK only with the next build until P2-D4, so the Transparency panel shows the pack revision date) | `docs/skill-traducere-revizie.md` | one chapter reviewed end to end, status shown in the panel | P1b |
| P1-C7 | C | Throughput measurement: words per day of the agent pipeline per language pair and of the reviewer | architecture risk "reviewer throughput" | report in `docs/decizii.md` | P1b |
| P1-C8 | C | Licence table v0: `content/licences.json` (work, edition, status, flags, evidence path under `content/licences/`), validated by `content-tools` at pack build and mirrored to the Supabase `licences` table in P2-D1 | CLAUDE.md priority 3; architecture 5 | validation runs in CI; every installed edition has a row | P1b |
| P1-E1 | E | CI: Playwright UI checks and screenshot artifacts on pull requests; web export to Pages; APK build kept; `ci.yml` and `android-apk.yml` verify every pack (a loop), not only the Vos English one | ui-spec 20 | green pipeline | P1b |
| P1-F1 | F | Ask first-use notice text, a short "what is sent to the AI provider" statement in About, the report mailbox | ui-spec 9.4, 15 | texts approved by the owner | draft P1a; approval: owner |
| P1-G1 | G | Owner decisions OQ-1 to OQ-4, OQ-9, OQ-10 (section 12), the tester list for the Ask beta, and copy approval (including the Ask copy of ui-spec 9.3) | | answers recorded | owner |

### 3.2 Dependencies inside P1

- A1 and A2 first (everything uses them); A3 and A4 next; A5-A8 and A11 in parallel afterwards. A9 needs the repository change and the pack alignment (exists). A10 needs the schema change before C1 and C3 write provenance.
- B1 needs the owner's Fly account, token and Anthropic key; until then the web build talks to the mock gateway started locally and the acceptance script runs against it.
- C2 gates C3 and C4. C1 is independent and finishes first.
- G1 gates the final copy of the landing, About and the policy page, and the shelf list used by A4 and C5.
- A4 changes how packs are verified (catalogue signature once, sha256 per pack on first use): it lands before C3 and C4 bundle their packs, and the cold-start measurement comes with it. A15 needs A3 and the existing local engine. B5 needs the owner's Anthropic key and is done in the same session as B1.
- The creeds contain Greek (C4): the dry run of C2 covers a Greek passage before any Greek document is merged.

### 3.3 Exit criteria for Beta 1

1. **UI**: every P1 check of `docs/ui-spec-v2.md` section 20 passes on the export at 1366x900 and 390x844 in light, sepia and dark (and at 1024x768 and 768x1024 for the shell and the reader); the native smoke N1-N10 is done on an APK; the owner has compared the screenshots with the reference captures and approved the look.
2. **Ask end to end** on the deployed gateway, web and APK (with the tester access code): a Romanian and an English question each return an answer with at least one valid citation that opens the right paragraph. On the evaluation set v0: at least 90 % of answers have one or more valid citations and at least 95 % have no unverified quotation; every suggestion returns sources.
3. **Books**: at least three works readable in both languages with real provenance (Vos RO and EN complete; at least two creeds-shelf documents; Augustine: the source edition plus the chapters translated so far in EN and RO, flagged "Traducere parțială"), and the two-lane view works on all of them.
4. **Catalogue**: at least eight documents installed across at least two shelves (Vos, Augustine, the creeds), all counts consistent between landing, library and work hub.
5. **Trust**: every AI translation shows "Neverificată" unless a reviewer signed it; the Transparency panel and the policy page are live; the report path works (mail in P1).
6. **Operations**: gateway deployed with a spend limit and alert; web app on the public URL with Ask limited to a list of testers (an access code) until the DPIA is signed (or, if the owner opens it to the public first, an ADR recording that decision as a deviation from architecture 7); APK pre-release (iOS in P1 means Safari on the web build); feedback address live.
7. **Records**: `docs/decizii.md` has the ADRs of section 12; `README.md` and the screenshots are refreshed; everything of value is committed and pushed.

### 3.4 Risks specific to P1

Reviewer availability (the status stays "Neverificată", which is acceptable in the beta per OQ-4); the pipeline for Latin sources is new (a dry run on one chapter comes before the full work); Romanian quality of the Ask answers on a thin library (one or two books) will look weak, so the content growth in C3-C4 matters for the demo;
react-native-web layout parity for two lanes and sticky bars needs early prototypes (A8 starts with a spike on the lane grid and the drawer). The four-week window assumes parallel agents on workstreams A, B and C; the content items C3 and C4 are the most likely to slip. Hermes has no `Intl.PluralRules` and the platform ICU orders `Intl.Collator('ro')` differently on iOS and Android, so counts use a hand-written helper and sorting starts from the folded key (ui-spec 17).

### 3.5 Sequencing inside P1: P1a and P1b

P1 as written is about four weeks of parallel agent work (31 deliverables, 14 screens, about 25 components, about 110 checks over a screenshot matrix of about 90 images, about 600 strings per language). It is not isolated work: it shares one `palettes.ts`, one pair of string tables, one shell and one reader, so its critical path is
A1, then A2 and A3, then the reader, then acceptance. The observed pace on 4 November (the gateway, about 9,100 lines with tests, took about three hours because it is one isolated module; the Vos Romanian drafts II-X took 3 hours 26 minutes) puts what two days of agent work can honestly deliver at about half of workstream A, the gateway changes and the short creeds. That is **P1a**; the rest is **P1b**. The Cut column of 3.1 marks every deliverable.

**P1a, in order.**

1. A1 (with its migration checklist) and A14 (`count()`, cedilla lint, `i18n-same.json`).
2. A2 minimal: Button, Chip, Tabs, Disclosure, Dialog, Sheet, Toast, Icon, and Hero and Band for the landing.
3. A3: desktop and phone drawers; no review flag, no hide-on-scroll.
4. A4 v0: shelves, authors, issuing bodies, works, kind, blurb, packs, derived counts, signature.
5. A5: bands 1, 2, 3, 6, 8, 11, 12, 13 on the flat `masthead`.
6. A6: `/library` and `/library/all` (search by name, A-Z, shelf filter, count line, URL state; authors as a plain list); A15 modes Lucrări and Pasaje.
7. A7: card, editions, transparency row, blurb, Cuprins, actions.
8. A8 core: toolbar, Cuprins panel, chapter card, Aa presets and steppers, find, keys, progress, resume, work bookmark; on phone the toolbar and a simple bottom bar.
9. A9: repository, language control, two lanes fixed at 50/50, gap placeholders.
10. A10: schema, panel, `/about/transparency`.
11. A11 core: SSE client and the split-inside-ș test, welcome, composer, turn, three progress stages, paragraphs and chips, preview as Sheet or Dialog at every width, receipts, notices, errors, first-use dialog with the access code, local conversation, scope chip (library or work), language chip.
12. A12 minimal: Settings, About, Bookmarks of works.
13. A13: the runner, F-1 and F-3, the checks G1, G3, G4, G9-G11, S1, S3, S6, L1-L4, B1-B4, W1-W4, R1-R3, R6-R10, T1, T2, A1-A6, A8-A12, Q1, and the shots (light and dark, desktop and phone) of landing, library-all, work, reader, reader-lanes, transparency and ask-answer.
14. B2, B3, C1, C2, C4 (two documents) and C3 (the chapters translated so far).

**Moved to P1b**: A2 Popover and the remaining cards and rows; A3 review flag and hide-on-scroll; A5 bands 4, 5 and 7 (art; band 7 needs a picture made from the finished reader); A6 author pages, century tab and tiles; A7 StartList and StatTiles; A8 thumb bar, Tools strip, paragraph rail and sheet, highlights, Esc layer manager, hide-on-scroll; A9 drag handle; A11 source pane with the resize handle, hover Popover, passage attach; A15 filters and the Întreabă hand-off; B4, B5; C3 completion, C5 beyond the installed works, C6, C7, C8; E1; the full A13 matrix.

**Not achievable by agents alone inside P1a** (they need the owner or a reviewer): B1 and exit criterion 2 (the owner's Fly account, token and Anthropic key); the 90 % and 95 % evaluation gates (they need the real model); the owner's screenshot sign-off; reviewer sign-off for "Verificată"; the owner's approval of the PROPUS glossary rows, which decide Romanian terms for an Orthodox-majority market (for example păcat strămoșesc or originar, îndreptățire or îndreptare), so the Augustine Romanian edition cannot be final without them.

---

## 4. Phase 2: depth, accounts, Scripture, search by meaning

**Goal.** Make the library deep and the study tools personal: accounts and sync, hybrid retrieval and a gated Ask with budgets, the Scripture view, search by meaning, offline downloads and the first notebook. **Window.** Weeks 5-12 (estimate). Inventory rows marked SHOULD P2.

| ID | Workstream | Deliverable | Reference |
|---|---|---|---|
| P2-D1 | D, E | Supabase project in Frankfurt (staging on the free plan, production on Pro when members exist); schemas `public` (exposed) and `content` (not exposed); RLS deny by default; pgTAP test of role rights; migrations in git; `app_config` | architecture 5 |
| P2-D2 | D, A | Auth: e-mail one-time codes on mobile, magic link on web, session in secure storage, no anonymous accounts; consent records with versions; profile with optional "my tradition" | AC-01, AC-03, AC-06 |
| P2-D3 | D, A | Sync: local store, outbox, `sync_push` (server sets the user, arbitrates on revision), tombstones; bookmarks, highlights, notes, reading places, conversations | AC-06, RS-12, RS-17, RS-20 |
| P2-D4 | D, E | Pack delivery: signed catalogue and manifests on Cloudflare R2 (EU), app downloads editions on demand with signature verification, "Descarcă pentru offline" on the work hub, Settings list of installed editions; gateway reads the same packs; packs move from the JS bundle to asset files read with `expo-file-system` once they pass about 2 MB; a service worker for the web export (precache of the shell, fonts, catalogue and bundled packs, versioned cache, update prompt) so that a reload works offline | ui-spec 7, 14, 19 |
| P2-D5 | E | Custom domain on Cloudflare (web app, gateway, site), DNS, TLS, the CORS allow-list, universal and app links, transactional e-mail domain (SPF, DKIM, DMARC) | OQ-1 |
| P2-B1 | B | Hybrid retrieval: embeddings (voyage-4, 1024 dimensions) plus lexical plus reciprocal rank fusion, chunking aligned to paragraphs with context prefixes; first in process for a small library, then pgvector in Supabase when the library or the accounts need it (decision D-P2-2) | architecture 6 |
| P2-B2 | B | Ask v2: whole-book mode A for members (the edition as one cached document, one block per paragraph, citations on) if the P1-B5 spike passes; second-pass support check with in-place "în parte / neconfirmat" badges, concurrent classifier (on-topic, injection, crisis, contested) with cancellation and the `perspective_marker` event, prompt caching, consent gate (403 before any provider call), budgets in money per user, free tier on the small model, usage meter, global kill switch for the free tier | AK-13, AK-20, AK-31 |
| P2-B3 | B | `/v1/search` (by meaning and exact), share endpoint (public noindex page), conversation endpoints if server side storage is chosen (decision D-P2-1) | SR-02, SR-03, AK-22 |
| P2-B4 | B, G | Evaluation set v1: 200 questions built with the reviewers (factual, contested with perspectives, passages, adversarial, sensitive-but-legitimate), thresholds recall@10 at least 0.85, citation validity at least 0.98, grounding at least 0.95 (scored by an Opus judge, ADR-026), refusals on legitimate questions at most 2 %; run on every prompt, retrieval or model change | architecture 6 |
| P2-A1 | A | Ask v2 UI: history sidebar, docked panel in the reader, share, command palette, scope by shelf and author, account gate and meter, deletion and consent screens, perspective cards, crisis help banner, lexicon preference (architecture 6, phase 2 chat UI), outline card and tables once the prompt allows headings | AK-03..05, 19, 20, 22, 26 |
| P2-A2 | A | Scripture view v1: reader, citations list, "Ask about this verse", chapter overview, previews in the reader, Bible packs with licence records and a versification map; section appears when a pack is installed | SC-01..05, 11, 15, 18, 26, 29, 32 |
| P2-A3 | A | Search v2: Scripture mode, by meaning, filters, compact | SR-01..03, 06 |
| P2-A4 | A | Reader depth: continuous flow option, expand contents overlay, Index and Library tabs, footnote markers and previews, range selection on web, focus mode, keyboard help, notebook actions and the Saved tab | RD-08, 15, 18, 19, 22, 30, 32, 35, 38, 51, 54 |
| P2-A5 | A | Notebook v1 and synced bookmarks; Traditions index and page; author room v1; work-hub Scriptura and Index tabs; How to use page | RS-12, 13, 16, 17; LB-12, 14; WK-05, 06, 09; AB-04 |
| P2-C1 | C | Scripture reference index built at pack-build time with the Romanian and English parsers, shipped per edition; Bible-text ingest (USFM or equivalent) with a licence check | SC-04, 11 |
| P2-C2 | C | More works (section 8.3, P2 list); enrichment v1: per-work guide (blurb, start points, section summaries) generated by agents, checked against the text, labelled "Text generat cu AI" with model and date | WK-03, 05 |
| P2-C3 | C, G | Reviewer throughput gate (go or no-go for the P4 catalogue); second reviewer; glossary approvals per tradition | architecture risk |
| P2-F1 | F | Versioned AI consent text; privacy statement v1 with sub-processors (Anthropic, Voyage, Supabase, Cloudflare, Fly); the art. 9 consent checkbox and the 16+ statement of the sign-in sheet (ui-spec 9.10); account deletion flow design; start of the DPIA | cheap-now decisions |

**Exit criteria.** Accounts, sync and deletion work; Ask requires a free account after the beta flag with budgets and the meter; hybrid retrieval meets the thresholds on evaluation set v1; Scripture view works on at least one English public-domain text and on a Romanian text if a licence has arrived; offline downloads work on web and APK;
12-15 works are installed with at least the Vos and Augustine editions complete; the notebook syncs between a phone and a browser.

---

## 5. Phase 3: research tools and breadth

**Goal.** The tools that make the library a study environment, and the catalogue breadth that makes them meaningful. **Window.** Weeks 13-24 (estimate). Inventory rows marked SHOULD P3 and LATER P3.

| ID | Deliverable | Reference |
|---|---|---|
| P3-1 | Mining pipeline at scale (agents or batches): topic tags per paragraph, positions with stance, resolved citations between works, five-part index, page summaries; every output labelled and stored with model and date; the same "trust rules" as the reference (computed counts, no names without stance, empty modules render nothing) | inventory 6.2 |
| P3-2 | Topics: taxonomy (decision OQ-6), index, topic page (counts, through-time ruler, traditions, key verses, reading path), topics tab on the work hub | TP-01..13 |
| P3-3 | Verse Desk and the commentary pane (needs commentary editions mapped to verses), layout modes | SC-06..10, 12, 14, 16, 20..31 |
| P3-4 | Compare, Lexicon and Glossary, Connections (as far as the citation graph allows), Disputed Questions, author room tabs | RS-03..11, 22; LX-01, 02; LB-13, 17 |
| P3-5 | Deep research: durable server jobs (up to 10 minutes, pause and continue, report and evidence downloads) | AK-09 |
| P3-6 | Page scans: page anchors per paragraph in packs, scan viewer from our source PDFs (storage and licence checked per source), Pages tab | RD-17, 29; RS-24 |
| P3-7 | Work hub depth: Argument, Quotations, Later readers, Topics, Positions, Sources cited, Names | WK-04..12 |
| P3-8 | Review app v1 (React and Vite, role and MFA): source and translation side by side, QC signals per paragraph, states, tickets, publication request | architecture 3 |
| P3-9 | Desk, guided tours, public changelog and open reports, registry of machine-translated works | RS-18, AB-02, 03, TR-09, 10 |
| P3-10 | Catalogue breadth: 25 or more works (section 8.3) | |
| P3-11 | TestFlight and Play internal testing builds (needs the store accounts) | |

**Exit criteria.** Each tool passes its own acceptance checks (added to `docs/ui-spec-v2.md` section 20 when the tool is specified in detail); reviewer throughput is measured and covers the P4 targets; the mined layers carry labels and Methodology notes.

---

## 6. Phase 4: release

**Goal.** Public launch on the stores and the web with payments, after the compliance programme. **Window.** Weeks 25-36 (estimate), following the architecture's phases 3 to 4b.

- Membership: RevenueCat for iOS and Android (offers, paywalls in Romanian, gift SKUs, Trusted Entitlements), Paddle on the web, the `entitlements` table written only by `ops`, plans and "De ce plătim?" (ui-spec 16), restore purchases; pricing in RON (decision OQ-11).
- Expo SDK 59 upgrade before submission (binary on an SDK at most four months old), EAS Build, Submit and Update with the runtime policy of the architecture.
- Compliance (priority 3 of CLAUDE.md, done now that the app is ready): DPO engaged, DPIA signed before the store release (the beta audience follows the decision of 12.2 question 3), ROPA, breach runbook, sub-processor list, Terms and Privacy, account deletion with Apple token revocation, DSAR export, retention jobs, Privacy Nutrition Labels and Data safety forms, AI Act labelling check, store listings, review notes and a demo account.
- Hardening: external penetration test and fixes, restore drill, incident runbook, error monitoring (Sentry EU), uptime checks, accessibility audit against ui-spec 18, performance profile on a mid-range Android, kill switch and minimum-version gate.
- Content gate: at least 5 AI-assisted translations fully reviewed and at least 10 verified editions (architecture target); the store build offers only reviewed editions as "Verificată" and keeps drafts out unless the owner decides otherwise (OQ-4).
- Web checkout 4-6 weeks after the stores (architecture phase 4b).

**Exit criteria.** Both stores approve; the compliance checklist is signed by the owner and the DPO; payments reconcile; the pen test has no open critical or major finding.

---

## 7. Phase 5 and backlog

Audio after a blind listening test (architecture section 6); MCP key and agent access (AK-24); SEO preview pages on the Astro site and a review of Expo SSR; group, organisation and student plans (PR-04..06); gift SKUs; own hosting of embeddings and, past a cost threshold, of a model for the free tier; the quote-image maker; a Romanian modernisation step for pre-1993 orthography editions; range selection and richer notebook relations;
the reference's printed-page layout if page anchors exist; Bedrock in the EU if the DPIA or a licensor requires it.

---

## 8. The books plan (translated works)

The owner's second focus. The rules are fixed (CLAUDE.md, ADR-012, ADR-013); this section turns them into a production line and an order of work.

### 8.1 Rules

1. Every work is offered in **Romanian and English**. For an English original the English edition is the source and only `ro` is produced; for Latin, Greek, German, French, Spanish, Dutch or Italian originals two translations are produced **from the original**, never one from the other,
   both aligned paragraph to paragraph to the source edition (`sourceId`; ULID ids never shared between editions).
2. Public-domain English translations (for example the Nicene and Post-Nicene Fathers) are given to the independent critic **as reference only** and are never copied. A new deterministic check, `REFERENCE_OVERLAP`, flags any paragraph that shares a long word run with the reference text (threshold to be tuned on a dry run).
3. Models translate; they do not decide alignment or identity. The critic works in a fresh context. Deterministic checks (paragraph parity, NFC, comma-below diacritics, source-language residue, Bible-reference parity, Greek copied exactly, length ratio, glossary, calques) emit flags; a human decides exegesis.
4. Scripture quoted by an author is translated as the author's text and flagged `CITAT_BIBLIC` for later replacement by a licensed Bible text; a model never produces verse text from memory.
5. Vocabulary follows the tradition of the work (Iisus or Isus, Hristos or Cristos, Născătoare de Dumnezeu or Maica Domnului...) through a glossary per tradition; the glossary rows marked PROPUS are approved by the owner.
6. Nothing is shown as **Verificată** without a human reviewer's sign-off recorded in the edition (role and date). AI translations in the beta are shown as **Neverificată** with full provenance (OQ-4).
7. Model rule: Sonnet agents for draft, critic and revision; Opus only exceptionally, for example as a final quality judge on the first translations, and the owner is told when it was used; the production Batches runner arrives in P4. The CLAUDE.md rule governs the subagents of the development sessions. API calls made by product code (Ask, the Batches runner, the evaluation judge) follow architecture 6 unless an ADR says otherwise (ADR-026); the model used for each translation is recorded per edition in its provenance and shown in the Transparency panel.

### 8.2 Production line (one work)

| Step | Output | Gate |
|---|---|---|
| 1. Select | row in `content/INVENTORY.md` with use T (translate), priority, licence risk | owner approves the list (OQ-3, section 8.3) |
| 2. Rights check | note per work: original public domain by the project rule (author died before 1956), edition-specific rights risk (modern critical apparatus, reprint introductions, translator rights), record in the licence table | stop on "high" until cleared |
| 3. Acquire source | the best public-domain edition (scan, born-digital text, or the owner's file); for Greek or Latin patristic texts a born-digital source if possible | network allow-list or owner upload |
| 4. Ingest and clean | `edition-<src>.json`: OCR repair (long s, hyphenation, running heads, page numbers), section and paragraph ids, Bible-reference tagging; source pack signed | ingest tests; spot check by an agent and the owner |
| 5. Catalogue entry | work, author (names per language), shelf, kind, blurb, start points | G1 decisions |
| 6. Jobs | chunks of 900-1,500 words that never split a paragraph | `translation-jobs` tests |
| 7. Draft, critic, revise (per language) | `drafts`, `critic`, `final` files, all committed | critic verdict, deterministic checks exit 0 |
| 8. Merge | `edition-<lang>.json`, `review.md` ordered by risk | coverage 100 % (or an explicit partial) |
| 9. Pack and sign | one pack per edition, revision bumped | verification in app and gateway |
| 10. Publish to beta | status Neverificată, provenance filled, appears in the library and in Ask | CI green |
| 11. Review | reviewer works the sheet (high-risk paragraphs first), edits `final`, re-runs checks and merge | sign-off with role and date |
| 12. Mark verified | pack revision with `review.state = reviewed`, correction entries for every change | status Verificată in the panel |

### 8.3 Order of work

Sizes are the inventory's estimates (words) and drift. Items marked "to source" are not among the files in `content/INVENTORY.md`.

**P1**

| Work | Source and targets | Size | Notes |
|---|---|---|---|
| Vos, *The Teaching of Jesus Concerning the Kingdom of God and the Church* (1903) | EN source, RO | about 29,700 words in the pipeline | in progress; finish, merge, provenance, status |
| Augustine, *De spiritu et littera* (P2D-02) | LA source (1914 Clarendon text; translate the Latin only, check the editor's English matter), EN and RO from the Latin | about 27,800 | first Latin work; also proves the generalised pipeline; the NPNF translation is critic reference only; Beta 1 ships the source edition and the chapters translated so far, flagged "Traducere parțială" |
| Creeds shelf (to source): Apostles' Creed (Latin), Nicene-Constantinopolitan Creed (Greek), Definition of Chalcedon (Greek), Athanasian Creed (Latin), Didache (Greek), Westminster Shorter Catechism (English, 1647) | LA and GRC sources with EN and RO from the original; the catechism EN source with RO | short (the catechism is the longest, a few thousand words) | the owner confirms the list and the source editions; Greek lanes need Gentium Plus (ui-spec 2.2), so the C2 dry run covers a Greek passage; article structure as sections with labels; Beta 1 needs at least two of these documents; works without an individual author carry an issuing body (ui-spec 6.8) |

**P2** (choose short and central first; partial editions are allowed and flagged)

| Work | Source and targets | Size | Notes |
|---|---|---|---|
| Augustine, *De fide et symbolo* and a few short treatises of CSEL 41 (P2D-09) | LA, EN and RO | selected | creed exposition, catechetical; keep one scan (P2D-10 is a duplicate) |
| Heidelberg Catechism (1563) (to source) | DE (and Latin) source, EN and RO | medium | creeds shelf; proof texts become Scripture index entries |
| Schleiermacher, *Über die Religion* (P2D-13) | DE, EN and RO | about 69,600 | clean Fraktur-to-Latin OCR; liberal theology is a fit for a historical shelf only |
| Orthodox candidates (to source, owner chooses, OQ-3): Athanasius *On the Incarnation*, Basil *On the Holy Spirit*, Gregory of Nazianzus *Theological Orations* | GRC, EN and RO | medium each | Greek sources need a better OCR or a born-digital text (licence of the digital corpus matters: architecture question 7); decisive for the Romanian market |
| Anselm, *Proslogion* and *Cur Deus homo* (to source, PL 158) | LA, EN and RO | short and medium | Migne text is public domain; the Schmitt critical edition in the inventory is not (P2D-06) |

**P3**

| Work | Source and targets | Size | Notes |
|---|---|---|---|
| Valdés, *Diálogo de doctrina Cristiana* (P2D-03) | ES, EN and RO | about 121,000 | translate the Spanish text only, not the 1925 French apparatus |
| Malebranche, *Entretiens sur la métaphysique et sur la religion* (P2D-04) | FR, EN and RO | about 71,000 | |
| Grotius, *De veritate religionis Christianae* (P2D-05) | LA, EN and RO | about 117,000 | 18th-century long s needs a normalisation pass; OCR 3 |
| Vedder, *Balthasar Hubmaier* (P1-06) | EN source, RO | about 140,500 | long; sections can ship first |
| Vos, *The Pauline Eschatology* (P1-08) | EN source, RO | about 128,000 | check the reprint's added matter before ingest |
| Aquinas *Expositio in Symbolum*, Bernard *De consideratione*, Melanchthon *Loci communes* 1521, Gregory the Great *Moralia* (to source from public-domain editions; the files in the inventory carry protected apparatus) | LA, EN and RO | varies | see the "to source" notes of the inventory |

### 8.4 Quality gates and states

Edition states: `draft` (not published), `beta` (published as Neverificată), `reviewed` (Verificată). A translation reaches `beta` when the critic verdict is clean or its findings are resolved or flagged, the deterministic checks exit 0, coverage is 100 % (or an explicit partial), and provenance is complete. It reaches `reviewed` when the review sheet is closed
(every CRITIC and MAJOR item resolved, every flag decided), a reviewer has signed with role and date, and the glossary rows it used are APROBAT. Corrections after publication are dated entries visible in the Transparency panel.

### 8.5 Throughput and go or no-go

P1-C7 measures, per language pair: agent words per day, flags per 1,000 words, critic disagreement rate, rework rate after revision; and, with the first reviewer, reviewer words per day. P2-C3 turns this into the go or no-go for the P4 catalogue (architecture target: at least 5 fully reviewed AI-assisted translations and 10 verified editions at launch).
If the reviewer rate is too low the options are a second reviewer, shorter works, partial editions with honest flags, or a smaller launch catalogue; the schedule moves, quality does not.

### 8.6 Delivery of packs

P1: packs live in the repository and are bundled in the app (`pack.json` is imported into the JS bundle: above about 2 MB of packs they move to asset files read with `expo-file-system`, P2-D4); the app verifies the signed catalogue once at start and each pack's sha256 when its edition is first opened or searched; the gateway image carries the same packs and redeploys when they change (workflow exists). P2: signed catalogue and manifests on Cloudflare R2, on-demand download with verification, gateway reads the same packs; a pack of a draft edition is flagged `beta` and can be hidden by `app_config`. Translation runs happen in Claude Code sessions;
API cost arises for the Ask gateway (spend limit) and, in P4, for production Batches.

---

## 9. What the owner must provide

| # | Item | Needed by | Why | How to provide | Blocks if missing |
|---|---|---|---|---|---|
| 1 | **Anthropic API key** from a dedicated workspace with a monthly spend limit and an alert (suggested start: 30-50 USD) | P1 week 1-2 | real Ask answers; the mock provider is the fallback | `fly secrets set ANTHROPIC_API_KEY=... --app biblioteca-api` (never in the repository, never in a chat); confirm whether the organisation has the server-side fallback beta (`MODEL_FALLBACK`) | Ask end-to-end acceptance and the Beta 1 gate |
| 2 | **Fly.io account**, `flyctl`, a payment method, the app name `biblioteca-api` (or another, then edit `fly.toml` and the workflow), and a **deploy token** as the GitHub Actions secret `FLY_API_TOKEN` | P1 week 1-2 | deploy the gateway; automatic redeploy when packs change | steps in `docs/ask-api.md`, "Deploying to Fly.io" | deployment; the workflow skips (does not fail) without the token |
| 3 | **Decisions OQ-1 to OQ-4, OQ-9, OQ-10** (name, art, shelves, publication policy, reviewers, feedback mailbox) and approval of the copy of the landing, About and policy page | P1 week 2-3 | final copy, catalogue and trust wording | a message with the answers; the OQ table of `docs/ui-spec-v2.md` section 21.2 | final copy; the shelf list |
| 4 | **Source files or permission to fetch them** (needed only if a fetch fails): the creeds shelf and the Orthodox candidates. On 4 November 2026 ccel.org, la.wikisource.org, en.wikisource.org, archive.org, raw.githubusercontent.com (Perseus), gutenberg.org, thelatinlibrary.com and vatican.va answered HTTP 200 from the session (el.wikisource.org answered 429 once and 200 later); the licence of Perseus and Wikisource text (CC BY-SA) stays with the lawyer (architecture section 5) | P1 week 1-2 | the creeds and later works | upload files or add hosts to the session allow-list | C3, C4 |
| 5 | **Reviewer(s)**: names or roles of a theological reviewer (Orthodox and Evangelical perspectives if possible), a Romanian and an English native reader, and a reader of Latin and Greek (a philologist) for the Verificată status of Augustine and the creeds; approval of the PROPUS glossary rows and the Bible-book abbreviation list | P1 week 3 (first), P2 week 5 (second) | the Verificată status; the throughput gate | a message with names and availability | "Verificată" anywhere |
| 6 | **Bible texts and licences**: which Romanian translations (Fidela, EDCR, Sinodală, others) and English ones (KJV, ASV, WEB or licensed); written permissions that explicitly cover normalising diacritics, offline storage and use as AI context; the public-domain fallbacks | start of conversations P1, needed P2 week 1-4 | the Scripture view, reference previews and Ask context for verses | letters or e-mails from licensors stored under `content/licences/` (reference only, no secrets) | Scripture view in Romanian |
| 7 | **Supabase project**: Frankfurt (eu-central-1); staging on the free plan first; project URL and the public anon key (client), the service-role key and database password (server only, as Fly secrets and GitHub secrets, never in the repository) | P2 week 1 | accounts, sync, content schema, hybrid retrieval | Supabase dashboard; secrets via `fly secrets set` | all of P2-D |
| 8 | **Domain** and registrar access; Cloudflare account (DNS, R2 bucket in the EU jurisdiction, Turnstile); an e-mail sending service (Resend or Brevo) with SPF, DKIM and DMARC records | P2 week 1-2 | web app and gateway on our domain, universal links, pack delivery, sign-in e-mails, the CORS allow-list | registrar and Cloudflare invitations | P2-D4, P2-D5; production auth |
| 9 | **Voyage AI key** for embeddings (free allowance exists) | P2 week 2 | hybrid retrieval | Fly secret | P2-B1 |
| 10 | **Hero art choice** from the short list we propose (public-domain, licence checked per image) | P1 week 2 | landing and bands | a message | final landing visuals (the flat `masthead` fallback ships otherwise) |
| 11 | **Time for reviews**: 1-2 hours a week to accept screenshots against the reference, to judge Romanian answers of Ask on the evaluation set (the 40 questions of v0 include 20 in Romanian) and to approve every suggestion in `suggestions.ro.json` and `suggestions.en.json` | every phase | native-speaker judgement cannot be automated | calendar | quality gates |
| 12 | **Apple Developer Program** and **Google Play Console** accounts (organisation accounts can take weeks to verify) | start P3, needed P3-P4 | TestFlight, Play internal, store submission | owner enrols | P3-11, P4 |
| 13 | **Payments**: RevenueCat and Paddle accounts, legal entity data, bank details; accountant answers on VAT treatment (architecture questions) | P4 | membership | owner and accountant | P4 payments |
| 14 | **Legal**: lawyer for Bible licences and the share-alike question; DPO (external, part-time) | lawyer for licences from P1-P2; DPO P4 | licences and compliance | engagements | P4 compliance gate |
| 15 | **Sentry and PostHog** (EU) accounts | P2 (errors), P4 (analytics with consent) | monitoring | invitations | observability |
| 16 | **GitHub Actions repository variables**: `EXPO_PUBLIC_ASK_API_URL` (the public gateway URL; neither `web-pages.yml` nor `android-apk.yml` passes it today, they set only `EXPO_PUBLIC_WEB_BASE_URL`) and `EXPO_PUBLIC_SITE_URL` (`https://deiuvrg.github.io/BiblicAPP` until the domain exists: the origin of the links copied on native; links copied during the beta break when the domain moves unless the Pages site keeps redirecting) | P1 week 1-2 | the web build and the APK reach the gateway; copied links work | repository settings | Ask in the builds; copy link on native |
| 17 | **Tester list and access code** for the Ask beta: the people who may use Ask, and the code itself as the Fly secret `ACCESS_CODE` (several codes may be listed so that one can be revoked) | P1 week 1-2 | the beta is limited to testers until the DPIA is signed (3.3 criterion 6, question 3 of 12.2) | a message with the testers; `fly secrets set ACCESS_CODE=...` (never in the repository) | Ask for anyone outside the list |

iOS in P1 means Safari on the web build: there is no iOS distribution channel before the Apple Developer account of row 12.

---

## 10. Dependencies and critical path

```
P1  A1 tokens+fonts ──► A2 components ──► A3 shell+routes ──┬──► A5 landing ──────────────┐
                                                             ├──► A6 library ◄─ A4 catalogue ◄─ C5 catalogue content
                                                             ├──► A7 work hub ◄── A10 provenance schema ◄─ (C1, C3 write it)
                                                             ├──► A8 reader ──► A9 two lanes (repository alignment)
                                                             └──► A11 Ask screen ◄── B1 gateway deployed ◄── owner: Fly + Anthropic key
                                      A13 Playwright acceptance ◄──────────────────────────────────── all A items
    C1 Vos RO ──► (done early)      C2 pipeline en + Latin ──► C3 Augustine ──┐
                                    C2 ──► C4 creeds shelf (sources: owner/allow-list) ──┴──► catalogue ≥ 8 documents, Ask has something to say
    G1 owner decisions ──► final copy, shelves; C6 reviewer v0 ──► first Verificată chapter
P2  D1 Supabase + D5 domain ──► D2 Auth ──► D3 sync ──► A1' Ask gate + history ;  B1' hybrid retrieval ──► B4' eval v1 ──► thresholds
    licences (owner) ──► C1' Bible texts ──► A2' Scripture view ;  D4 pack delivery ──► offline downloads
P3  mining pipeline (P3-1) ──► Topics, Compare, Lexicon, Connections ;  page anchors ──► scans ;  review app
P4  compliance + payments + stores (accounts opened in P3)
```

A15 (Search) hangs off A3 and the existing local engine; B5 (the mode A spike) needs the owner's Anthropic key together with B1; A4 changes the pack verification and lands before C3 and C4 bundle their packs.

**Critical path of P1**: content growth (C2 then C3 and C4) and reviewer availability, then the Ask end-to-end gate, which needs the owner's accounts. The UI work (A1-A12) is parallelisable and is not on the critical path as long as A1-A2 land first.
**Critical path of P2**: Bible licences (for Romanian) and the Supabase and domain set-up, then accounts, then the gated Ask; retrieval and evaluation run in parallel.
**Critical path to launch**: reviewer throughput (P2-C3 gate), store accounts opened early, compliance in P4.

---

## 11. Risks

| Risk | Phase | Mitigation |
|---|---|---|
| Reviewer capacity is the real bottleneck | all | measure in P1; Neverificată status in the beta; short works first; partial editions; second reviewer in P2; launch catalogue sized to the measured rate |
| Quality of Romanian theological translation and answers; the market is majority Orthodox and sensitive to vocabulary | P1+ | glossary per tradition with owner approval; independent critic; reviewer sign-off; explicit status; evaluation set with native-speaker judgement; never present drafts as reviewed |
| Greek (and some Latin) sources: poor OCR of polytonic Greek and long s; licence of born-digital corpora | P1-P2 | scans and OCR repair for short works first; prefer public-domain scans; the CC BY-SA question goes to the lawyer; Gentium Plus for the Greek lane |
| Bible licences delay the Scripture view in Romanian | P2 | English public-domain texts first; the section appears only when a pack exists; Ask never receives text whose licence excludes AI |
| Ask cost and abuse before accounts | P1 | tester access code, per-IP limit (20 per 10 minutes), a global daily question cap (a flood of 100 addresses at 20 questions each can spend about 30 USD in ten minutes), a dedicated Anthropic workspace with a spend limit and alert, one Fly machine, daily review of `ask.completed` log lines; kill switch by redeploying with the mock provider |
| A thin library makes Ask look weak (one or two books) | P1 | C3 and C4 in P1; suggestions tested against the installed works; "Ce conține acum" list when not covered; do not market Ask as broad |
| Lexical retrieval across languages is limited (glossary bridge) | P1-P2 | extend the glossary per work; evaluation set v0 shows gaps; embeddings in P2 |
| react-native-web layout parity (sticky bars, drawers, two-lane rows) and RN text-selection limits | P1 | spike first; paragraph-level actions on native (D-10); Playwright checks on the export; APK checked by hand |
| Font weight and bundle size (display face has one weight; Greek font adds 0.8 MB) | P1 | never request bold of IM Fell; load Gentium only with Greek editions; measure the web bundle in CI |
| A new native module (`react-native-svg`, `expo-clipboard`) breaks the new architecture or 16 KB alignment | P1 | one check on the CI APK at the start of P1-A2, recorded in `docs/decizii.md`; fallbacks: shapes from `View` and text labels for icons, the system Share sheet for copy; no gradient, slider or network module is added |
| P1 sized as two days of work | P1 | P1 is about four weeks; the first push is P1a (3.5); owner-dependent gates are listed there |
| Many bundled packs slow the cold start (each `pack.json` is imported into the JS bundle; verifying all of them at start costs about 0.3 s on a JIT and much more on Hermes) | P1 | catalogue signature once, sha256 per pack on first use, a cold-start measurement on a mid-range Android before the Augustine and creeds packs are bundled, asset files from about 2 MB (P2-D4) |
| Hermes has no `Intl.PluralRules`; the platform ICU orders `Intl.Collator('ro')` differently on iOS and Android | P1 | hand-written plural helper compared with Node's in a Jest test; sort by folded key first; no collation order asserted on devices |
| Reference counts and copy drift; copying its text by accident | P1 | our own copy (ui-spec); derive counts from the catalogue; no reference text or images in `docs/` or `content/` |
| Scope creep from the reference's long feature list (272 rows) | all | MUST/SHOULD/LATER/SKIP in the inventory is the scope; changes go through the owner, and the 24 SKIP rows are confirmed by the owner (12.2 question 5) |
| SDK 58 and library lag (architecture risk) | P2-P4 | upgrade plan to SDK 59 before submission |
| Privacy of questions sent to a US AI provider (special-category data) | P1-P4 | notice in P1 and the beta limited to testers by an access code, versioned consent in P2, DPIA signed before the store release, Bedrock EU option kept open (architecture) |

---

## 12. Decisions to record and questions for the owner

### 12.1 Entries for `docs/decizii.md` (each deviates from, or adds to, the architecture document)

| Proposed ID | Decision | Reason |
|---|---|---|
| ADR-016 | UI v2: the reference's structure with our tokens (three themes, `accent` for fills and `accentStrong` for text, `borderStrong` for outlines, flat derived tokens for scrims, shadows and washes); IM Fell Great Primer and Source Serif 4; Literata kept as an option; Inter reduced to a reading option; Gentium Plus for Greek lanes. It supersedes ADR-UI and its amendments 1 and 2 on: no gradients and no shadows, fonts, text size range, column widths, accent usage, focus-ring colour | owner request to look like the reference; WCAG; verified glyph coverage |
| ADR-017 | One chapter per screen in P1; continuous flow in P2 | keeps deep links, position store and tests; virtualisation work later |
| ADR-018 | Signed catalogue (`catalogue.json`) next to the packs: source of counts, shelves, centuries, editorial blurbs and the list of packs (packId, sha256, size); the app verifies the catalogue signature once and each pack's sha256 on first use | one source of counts; offline; same signing key; the cold start does not grow with the number of packs |
| ADR-019 | Transparency data model: additive `Provenance` fields (kind, `transcription` flag, model, date, passes, checks, review state, corrections), panel and policy page; states `draft`, `beta`, `reviewed` | the reference's central trust feature, with more disclosure |
| ADR-020 | Ask UI v1 on the existing SSE contract (builds on ADR-015; adds only the contract additions and the audience decision): unverified strings, the per-cited-source quotation check, `passage`, request id in errors, `X-Access-Code`, a daily question cap; open to testers by an access code until the DPIA is signed, with a per-IP limit and a spend limit; account gate in P2 | owner priority; cheap to ship now; architecture 7 asks for the DPIA before AI reaches preview |
| ADR-021 | Supabase, Auth and the domain move to P2; Ask beta runs on packs from disk | nothing in P1 needs them |
| ADR-022 | Legal and compliance programme moves to P4; cheap-now decisions stay early | CLAUDE.md priority 3 |
| ADR-023 | Paragraph-level actions (hover rail on web, the `¶ n` button and its sheet on touch); system text selection on native stays untouched | React Native `Text` has no custom selection toolbar, and a long press is taken by the system selection |
| ADR-024 | Pipeline: target `en`, Latin and Greek sources, reference-overlap check, two translations from the original | ADR-013 consequences |
| ADR-025 | Until the spike passes, "Întreabă despre această carte" is retrieval scoped to the work's editions on the existing gateway; the cached whole-book mode A for members moves to P2 | cost and quality of mode A are unmeasured and the gateway has no caching yet |
| ADR-026 | Translation and evaluation models: Sonnet for drafts, critics and revisions in P1-P3 (the CLAUDE.md rule); Opus 5.5 as judge only for the P2-B4 grounding score, reported to the owner each time; API calls made by product code (Ask, the Batches runner, the judge) follow architecture 6 unless an ADR says otherwise | CLAUDE.md governs the development subagents, architecture 6 names Opus for translation, critic and judge through Batches: the two must not be left to disagree |
| D-P2-1 (open) | Conversations: local first with sync, or server side in Supabase | privacy versus convenience; decide in P2 week 1 |
| D-P2-2 (open) | Retrieval infrastructure: in-process vectors for a small library, then pgvector | cost and complexity against scale; decide after the P1 evaluation |

### 12.2 Questions for the owner

The product and content questions OQ-1 to OQ-12 are in `docs/ui-spec-v2.md` section 21.2 (name, art, shelves, publication policy for unreviewed translations, Bible texts, topics taxonomy, fonts, Ask tiers, reviewers, mailbox, pricing, register of address). Roadmap-level additions:

1. Which creeds and which Orthodox works open the library (section 8.3), and may we fetch sources from public repositories (they answered from the session on 4 November; the allow-list is needed only if a fetch fails) or do you supply files?
2. May Opus be used, exceptionally, as a final quality judge on the first Romanian and English translations (it will be reported if used)?
3. Should the beta be public from day one (open web URL and APK) or limited to a list of testers first? Default until you answer: testers only, by an access code, because the DPIA is not signed (architecture 7); opening Ask to the public first needs an ADR that records the deviation.
4. Is a monthly Anthropic spend limit of 30-50 USD acceptable for the beta (cost per question is 0.005-0.015 USD on Sonnet according to `docs/ask-api.md`)?
5. Confirm the 24 SKIP rows of the inventory (the rows marked SKIP in section 3 there; the counts table gives the total): SH-01, SH-07, SH-08, SH-09, SH-16, SH-22, LP-13, LB-08, LB-20, WK-13, RD-04, RD-24, RD-27, RD-33, RD-41, RD-53, SC-13, SC-30, AK-25, RS-28, AB-05, AC-02, AC-04, PR-10. Many are publisher chrome or hostile gates, but some are product features; say which you want after all: RD-04 volume navigator (multi-volume sets), RD-24 flow versus printed pages (needs page anchors), RD-27 source switcher (Greek or Latin lanes), RD-33 editorial notes, RD-53 public annotations, SC-13 hymns, LB-20 resources (our own articles), AK-25 bring-your-own model.

---

## 13. Quality gates, cost and working agreements

**Gates on every change**: `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm format:check` (the repository's rules: TypeScript strict, no colour literals outside the palette, no secrets, tests for every new behaviour); from P1 also `scripts/check-ui-v2.mjs` and the screenshot matrix. Content changes keep the committed packs and `committed-content.test.ts` green.
Documents of the repository are in English; answers to the owner in Romanian; code, comments, file names and commit messages in English.

**Cost, order of magnitude** (the architecture's figures stay authoritative): Beta 1 needs one Fly machine, the Anthropic usage under a spend limit, GitHub Pages and the existing CI; no Supabase, no Cloudflare plan, no domain strictly required. P2 adds Supabase (free for staging, Pro 25 USD when members exist), Cloudflare (free plan, R2 with zero egress), Voyage (free allowance),
a domain and an e-mail service. Anthropic is the only line that scales with use; budgets in money per user arrive with accounts.

**Working agreements.** Model rule: orchestrator on Fable, every subagent on Sonnet (Opus only exceptionally and announced); API calls made by product code follow architecture 6 unless an ADR says otherwise (ADR-026). No secrets in the repository: only public keys reach the client; the Anthropic, Supabase service and Fly keys live as platform secrets. The cloud container is ephemeral: everything of value is committed and pushed before stopping. Before adding a native module, check new-architecture
compatibility and 16 KB page alignment. Every deviation from the architecture document is written in `docs/decizii.md` with its reason (section 12.1). Reference captures stay under `test-results/tfr/` and the scratchpad; nothing of the reference's text or images enters `docs/` or `content/`.
