# Roadmap v2: Ask and the translated books first

Status: plan produced on 4 November 2026 for the reprioritisation of ADR-014 (`docs/decizii.md`). Priorities come from `CLAUDE.md`: (1) the technical product first (app, backend, content, reader,
offline, payments); (2) the reference platform The Faith Received is the product reference, with the focus on the **Ask** chat (answers with citations from the library) and on the **books translated
into Romanian and English**; (3) legal and compliance after the app is ready, except the cheap-now technical decisions (unexposed `content` schema, consent screens, account deletion, licence table).
Companions: `docs/the-faith-received-inventory.md` (what the reference does; feature IDs below), `docs/ui-spec-v2.md` (what we build; check IDs below), `docs/arhitectura-app-biblica.md` (architecture v2; its
own roadmap, section 10, is reordered here), `docs/ask-api.md`, `docs/traducere-pipeline.md`, `docs/multi-edition-spec.md`. Durations are estimates for calendar weeks of mostly agent-driven work with the owner reviewing; the
critical path is content and reviewers, not code.

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

**What changes against the architecture's roadmap** (to record in `docs/decizii.md`; the entries are in section 12.1 below): AI is no longer phase 2 after the reader, it ships in P1 on the packs-from-disk gateway; Supabase, Auth and the domain move to P2 (Ask beta needs none of them); the signed catalogue,
the Transparency data model and the reference's shell enter P1; legal work (DPO, DPIA, ROPA, store forms) moves to P4 while the cheap-now decisions stay early; the review tool is a file flow (`review.md`) until P3.

---

## 1. Baseline on 4 November 2026 (P0)

| Area | State |
|---|---|
| App | Expo SDK 58, React Native 0.88, Expo Router, TypeScript strict, pnpm monorepo; library, work, reader, search, settings; signed packs verified in the app (Ed25519, pinned keys); bilingual editions with reading language and interface language; editorial design in three themes (Literata and Inter, burgundy accent); web export on GitHub Pages; APK pre-release `v0.1.0-test`; CI with web export and APK. Open item: "Finisare UI" (licence label out of the list, clearer contents numerals, check on a real APK). Accent, fonts and layout are replaced by ui-spec-v2 |
| Content | Vos, *The Teaching of Jesus Concerning the Kingdom of God and the Church* (1903): English source, 11 sections, 131 paragraphs, public domain. Romanian translation: chapter I merged (a partial pack, flagged "Traducere parțială"); chapters II-XI in progress (29 batches; 23 drafts exist at the time of writing, merge and pack pending). Source inventory of 56 files with licence risk in `content/INVENTORY.md` |
| Translation pipeline (v3-lite) | `content-tools`: jobs, checks, merge, review sheet, signing; Sonnet agents for draft, independent critic and revision; target `ro` from English sources; materials per language (`content/translation/`). Not yet: target `en`, Latin or Greek sources, reference-overlap check |
| Ask gateway | `apps/api` (Hono, Node 22): `POST /v1/ask` as SSE (`sources`, `delta`, `citation`, `done`, `error`), `GET /v1/library`, `GET /v1/health`; BM25 retrieval with a Romanian-English glossary bridge; scripture-reference boost; quotation check; per-IP rate limit; mock and Claude providers; Fly.io config and deploy workflow written, **deployment needs the owner's Fly account, token and Anthropic key** (steps in `docs/ask-api.md`). No accounts, no embeddings, no caching |
| Docs | architecture v2, multi-edition spec, design spec (v1), translation pipeline, skill review, security notes, Ask API, decisions log (ADR-001 to ADR-014); this inventory, ui-spec-v2 and roadmap |
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
**Window.** Weeks 1-4 (estimate). **Scope** = ui-spec items tagged P1 and the inventory's MUST rows.

### 3.1 Deliverables

| ID | Workstream | Deliverable | Reference (inventory / ui-spec) | Done when |
|---|---|---|---|---|
| P1-A1 | A | Tokens, fonts, themes: three palettes (ui-spec 2.1), IM Fell Great Primer and Source Serif 4 via `@expo-google-fonts`, type scale, radii, motion; Literata kept as option; Gentium Plus for Greek lanes (loaded only with Greek editions); `theme.test.ts` lists the contrast pairs of 2.1 | SH-17; ui-spec 2 | all pairs pass; no-hardcoded-colours test green; screenshots of the existing screens in the new look |
| P1-A2 | A | Component kit: Button variants, Chip, Tabs, Disclosure, Dialog, Sheet, Popover, Toast, Hero, Band, cards, rows, Icon | ui-spec 3 | each component has a render test and a keyboard test |
| P1-A3 | A | Shell and routes: brand bar, section bar with drawers (desktop and phone), feature flags, review flag, route tree of ui-spec 4.4 (`/` becomes the landing; the library moves to `/library/all`) | SH-02..05, SH-15 | checks S1-S8 |
| P1-A4 | A, C | Signed catalogue: schema, `content-tools` build command, loader with verification, derived counts, centuries, shelves | ui-spec 6.8 | catalogue verifies; counts equal pack contents; a pack without an entry still lists |
| P1-A5 | A | Landing | LP-01, 02, 05..09, 12 (LP-04 as a light editorial band) | checks L1-L8 |
| P1-A6 | A | Library: Selecție, Toată biblioteca (shelves, centuries, A-Z, search by name, URL state), Authors index and author page | LB-01..07, 09, 11 | checks B1-B9 |
| P1-A7 | A | Work hub v2: card, editions, transparency row, Prezentare, Cuprins, actions | WK-01..03, 14, 15 | checks W1-W7 |
| P1-A8 | A | Reader parity: toolbar, outline panel, chapter cards, Aa sheet, Tools panel, find in text, keyboard, progress, resume, paragraph actions, local bookmarks and highlights, phone shell | RD-01..03, 05..07, 09..14, 16, 20, 21, 23, 25, 30 (detection and indexing only), 35, 36, 39, 40, 42, 43, 46..50, 55, 56 | checks R1-R5, R10-R19 |
| P1-A9 | A, C | Bilingual reading: repository `getAlignedSection` and `getAlignedParagraphs`, language control, two lanes, place-keeping switch, placeholders for gaps | RD-26, 28 (balance slider) | checks R6-R8 |
| P1-A10 | A, C | Transparency: additive `ProvenanceSchema` fields, panel, policy page, provenance records for the Vos editions | TR-01..04, 06 (revisions), 07 (mail), 08, 12 | checks R9, T1-T5, Q3 |
| P1-A11 | A | Ask screen v1: all of ui-spec 9 except the sidebar, docked panel, share, notebook, Deep research, palette, meter; entry points from the work hub, reader, author page and paragraph; `ReaderPane`; first-use notice; local conversation | AK-01, 02, 05..08, 10..12, 14..16, 17 (work and author), 18 (simple), 23 (copy), 27 (paragraph), 28..30; RD-38 (Ask action) | checks A1-A19 |
| P1-A12 | A | Settings updates, About and Transparency pages, Bookmarks page, footer, feedback mail link | AB-01; RS-17 and RS-20 (local); SH-11 (mail link) | checks Q2-Q4 |
| P1-A13 | A, E | Playwright acceptance: `scripts/check-ui-v2.mjs`, fixtures F-1 and F-2, screenshot matrix in `docs/screenshots/v2/`, CI step, report artifact | ui-spec 20 | script exits 0; screenshots committed |
| P1-A14 | A | i18n: every new string in `ro.ts` and `en.ts`, `count()` plural helper (Romanian categories), century formatter, cedilla lint | ui-spec 17 | G9, G10 green |
| P1-B1 | B, E | Deploy the gateway on Fly (fra, one machine), set the public API URL in the web build and the APK, CORS for the web origin, dedicated Anthropic workspace with a monthly spend limit and alert | `docs/ask-api.md` deployment | `/v1/health` ok; an Ask question works from the web build and the APK |
| P1-B2 | B | Gateway changes the UI wants: unverified quotation strings in `done`, `Access-Control-Expose-Headers` for `RateLimit-*`, optional `passage` field, request id in error bodies; tests and docs | ui-spec 9.11 | contract tests green; `docs/ask-api.md` updated |
| P1-B3 | B | Suggestions per language and a retrieval test for each; evaluation set v0 (40 questions, 20 RO and 20 EN, over the installed works) with structural checks (sources present, valid citations, quotations verified) | AK-06; ui-spec A19 | suggestions test green; eval report committed |
| P1-B4 | B | Cross-language retrieval: extend the glossary bridge with the vocabulary of every new work; measure on the eval set; write the decision on moving to embeddings in P2 | `docs/ask-api.md` limits | eval shows the gaps; decision recorded |
| P1-C1 | C | Vos Romanian complete: chapters II-XI merged, checks clean, review sheet generated, pack revision bumped, status "neverificată" with provenance | TR-02..06 | RO pack covers 11 of 11 sections; `committed-content.test.ts` green |
| P1-C2 | C | Pipeline generalisation: target `en`, sources in Latin and Greek, per-language materials (`rules-en`, `glossary-en`, `calques-en`, prompts), Latin reference grammar, checks parameterised, reference-overlap check against public-domain English translations | `docs/traducere-pipeline.md` 1.1 | tests for each check; a dry run on a Latin chapter |
| P1-C3 | C | First Latin work, Augustine *De spiritu et littera* (P2D-02): clean the OCR, source edition `la`, two translations `en` and `ro` made from the Latin, independent critic, review sheets, three packs | books plan 8.3 | three editions, aligned; both translations "neverificată" with provenance |
| P1-C4 | C, G | Creeds starter shelf: 5-6 short public-domain documents (list in 8.3) with article structure; translations from the original where it is not English | LB-09; books plan | each document readable in RO and EN |
| P1-C5 | C, G | Catalogue content: shelves, author records (names per language, dates, short bios labelled editorial or AI), blurbs and "where to start" for every work | ui-spec 6.8, 7 | every installed work has a complete entry |
| P1-C6 | C, G | Reviewer v0: review sheets handed to the first reviewer, the import path back, the status change flow (pack revision) | `docs/skill-traducere-revizie.md` | one chapter reviewed end to end, status shown in the panel |
| P1-C7 | C | Throughput measurement: words per day of the agent pipeline per language pair and of the reviewer | architecture risk "reviewer throughput" | report in `docs/decizii.md` |
| P1-E1 | E | CI: Playwright UI checks and screenshot artifacts on pull requests; web export to Pages; APK build kept | ui-spec 20 | green pipeline |
| P1-F1 | F | Ask first-use notice text, a short "what is sent to the AI provider" statement in About, the report mailbox | ui-spec 9.4, 15 | texts approved by the owner |
| P1-G1 | G | Owner decisions OQ-1 to OQ-4, OQ-9, OQ-10 (section 12) and copy approval | | answers recorded |

### 3.2 Dependencies inside P1

- A1 and A2 first (everything uses them); A3 and A4 next; A5-A8 and A11 in parallel afterwards. A9 needs the repository change and the pack alignment (exists). A10 needs the schema change before C1 and C3 write provenance.
- B1 needs the owner's Fly account, token and Anthropic key; until then the web build talks to the mock gateway started locally and the acceptance script runs against it.
- C2 gates C3 and C4. C1 is independent and finishes first.
- G1 gates the final copy of the landing, About and the policy page, and the shelf list used by A4 and C5.

### 3.3 Exit criteria for Beta 1

1. **UI**: every P1 check of `docs/ui-spec-v2.md` section 20 passes on the export at 1366x900 and 390x844 in light, sepia and dark; the owner has compared the screenshots with the reference captures and approved the look.
2. **Ask end to end** on the deployed gateway, web and APK: a Romanian and an English question each return an answer with at least one valid citation that opens the right paragraph. On the evaluation set v0: at least 90 % of answers have one or more valid citations and at least 95 % have no unverified quotation; every suggestion returns sources.
3. **Books**: at least three works readable in both languages with real provenance in the Transparency panel (Vos RO and EN complete; Augustine in LA, EN and RO; at least one creeds-shelf document), and the two-lane view works on all of them.
4. **Catalogue**: at least eight documents installed across at least two shelves (Vos, Augustine, the creeds), all counts consistent between landing, library and work hub.
5. **Trust**: every AI translation shows "Neverificată" unless a reviewer signed it; the Transparency panel and the policy page are live; the report path works (mail in P1).
6. **Operations**: gateway deployed with a spend limit and alert; web app on the public URL; APK pre-release; feedback address live.
7. **Records**: `docs/decizii.md` has the ADRs of section 12; `README.md` and the screenshots are refreshed; everything of value is committed and pushed.

### 3.4 Risks specific to P1

Reviewer availability (the status stays "Neverificată", which is acceptable in the beta per OQ-4); the pipeline for Latin sources is new (a dry run on one chapter comes before the full work); Romanian quality of the Ask answers on a thin library (one or two books) will look weak, so the content growth in C3-C4 matters for the demo;
react-native-web layout parity for two lanes and sticky bars needs early prototypes (A8 starts with a spike on the lane grid and the drawer). The four-week window assumes parallel agents on workstreams A, B and C; the content items C3 and C4 are the most likely to slip.

---

## 4. Phase 2: depth, accounts, Scripture, search by meaning

**Goal.** Make the library deep and the study tools personal: accounts and sync, hybrid retrieval and a gated Ask with budgets, the Scripture view, search by meaning, offline downloads and the first notebook. **Window.** Weeks 5-12 (estimate). Inventory rows marked SHOULD P2.

| ID | Workstream | Deliverable | Reference |
|---|---|---|---|
| P2-D1 | D, E | Supabase project in Frankfurt (staging on the free plan, production on Pro when members exist); schemas `public` (exposed) and `content` (not exposed); RLS deny by default; pgTAP test of role rights; migrations in git; `app_config` | architecture 5 |
| P2-D2 | D, A | Auth: e-mail one-time codes on mobile, magic link on web, session in secure storage, no anonymous accounts; consent records with versions; profile with optional "my tradition" | AC-01, AC-03, AC-06 |
| P2-D3 | D, A | Sync: local store, outbox, `sync_push` (server sets the user, arbitrates on revision), tombstones; bookmarks, highlights, notes, reading places, conversations | AC-06, RS-12, RS-17, RS-20 |
| P2-D4 | D, E | Pack delivery: signed catalogue and manifests on Cloudflare R2 (EU), app downloads editions on demand with signature verification, "Descarcă pentru offline" on the work hub, Settings list of installed editions; gateway reads the same packs | ui-spec 7, 14 |
| P2-D5 | E | Custom domain on Cloudflare (web app, gateway, site), DNS, TLS, the CORS allow-list, universal and app links, transactional e-mail domain (SPF, DKIM, DMARC) | OQ-1 |
| P2-B1 | B | Hybrid retrieval: embeddings (voyage-4, 1024 dimensions) plus lexical plus reciprocal rank fusion, chunking aligned to paragraphs with context prefixes; first in process for a small library, then pgvector in Supabase when the library or the accounts need it (decision D-P2-2) | architecture 6 |
| P2-B2 | B | Ask v2: second-pass support check with in-place "în parte / neconfirmat" badges, concurrent classifier (on-topic, injection, crisis, contested) with cancellation, prompt caching, consent gate (403 before any provider call), budgets in money per user, free tier on the small model, usage meter, global kill switch for the free tier | AK-13, AK-20, AK-31 |
| P2-B3 | B | `/v1/search` (by meaning and exact), share endpoint (public noindex page), conversation endpoints if server side storage is chosen (decision D-P2-1) | SR-02, SR-03, AK-22 |
| P2-B4 | B, G | Evaluation set v1: 200 questions built with the reviewers (factual, contested with perspectives, passages, adversarial, sensitive-but-legitimate), thresholds recall@10 at least 0.85, citation validity at least 0.98, grounding at least 0.95, refusals on legitimate questions at most 2 %; run on every prompt, retrieval or model change | architecture 6 |
| P2-A1 | A | Ask v2 UI: history sidebar, docked panel in the reader, share, command palette, scope by shelf and author, account gate and meter, deletion and consent screens | AK-03..05, 19, 20, 22, 26 |
| P2-A2 | A | Scripture view v1: reader, citations list, "Ask about this verse", chapter overview, previews in the reader, Bible packs with licence records and a versification map; section appears when a pack is installed | SC-01..05, 11, 15, 18, 26, 29, 32 |
| P2-A3 | A | Search v2: Scripture mode, by meaning, filters, compact | SR-01..03, 06 |
| P2-A4 | A | Reader depth: continuous flow option, expand contents overlay, Index and Library tabs, footnote markers and previews, range selection on web, focus mode, keyboard help, notebook actions and the Saved tab | RD-08, 15, 18, 19, 22, 30, 32, 35, 38, 51, 54 |
| P2-A5 | A | Notebook v1 and synced bookmarks; Traditions index and page; author room v1; work-hub Scriptura and Index tabs; How to use page | RS-12, 13, 16, 17; LB-12, 14; WK-05, 06, 09; AB-04 |
| P2-C1 | C | Scripture reference index built at pack-build time with the Romanian and English parsers, shipped per edition; Bible-text ingest (USFM or equivalent) with a licence check | SC-04, 11 |
| P2-C2 | C | More works (section 8.3, P2 list); enrichment v1: per-work guide (blurb, start points, section summaries) generated by agents, checked against the text, labelled "Text generat cu AI" with model and date | WK-03, 05 |
| P2-C3 | C, G | Reviewer throughput gate (go or no-go for the P4 catalogue); second reviewer; glossary approvals per tradition | architecture risk |
| P2-F1 | F | Versioned AI consent text; privacy statement v1 with sub-processors (Anthropic, Voyage, Supabase, Cloudflare, Fly); account deletion flow design; start of the DPIA | cheap-now decisions |

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
- Compliance (priority 3 of CLAUDE.md, done now that the app is ready): DPO engaged, DPIA signed before AI is enabled for the public, ROPA, breach runbook, sub-processor list, Terms and Privacy, account deletion with Apple token revocation, DSAR export, retention jobs, Privacy Nutrition Labels and Data safety forms, AI Act labelling check, store listings, review notes and a demo account.
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
7. Model rule: Sonnet agents for draft, critic and revision; Opus only exceptionally, for example as a final quality judge on the first translations, and the owner is told when it was used; the production Batches runner arrives in P4.

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
| Augustine, *De spiritu et littera* (P2D-02) | LA source (1914 Clarendon text; translate the Latin only, check the editor's English matter), EN and RO from the Latin | about 27,800 | first Latin work; also proves the generalised pipeline; the NPNF translation is critic reference only |
| Creeds shelf (to source): Apostles' Creed (Latin), Nicene-Constantinopolitan Creed (Greek), Definition of Chalcedon (Greek), Athanasian Creed (Latin), Didache (Greek), Westminster Shorter Catechism (English, 1647) | LA and GRC sources with EN and RO from the original; the catechism EN source with RO | short (the catechism is the longest, a few thousand words) | the owner confirms the list and the source editions; Greek lanes need Gentium Plus (ui-spec 2.2); article structure as sections with labels |

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

P1: packs live in the repository and are bundled in the app; the gateway image carries the same packs and redeploys when they change (workflow exists). P2: signed catalogue and manifests on Cloudflare R2, on-demand download with verification, gateway reads the same packs; a pack of a draft edition is flagged `beta` and can be hidden by `app_config`. Translation runs happen in Claude Code sessions;
API cost arises for the Ask gateway (spend limit) and, in P4, for production Batches.

---

## 9. What the owner must provide

| # | Item | Needed by | Why | How to provide | Blocks if missing |
|---|---|---|---|---|---|
| 1 | **Anthropic API key** from a dedicated workspace with a monthly spend limit and an alert (suggested start: 30-50 USD) | P1 week 1-2 | real Ask answers; the mock provider is the fallback | `fly secrets set ANTHROPIC_API_KEY=... --app biblioteca-api` (never in the repository, never in a chat); confirm whether the organisation has the server-side fallback beta (`MODEL_FALLBACK`) | Ask end-to-end acceptance and the Beta 1 gate |
| 2 | **Fly.io account**, `flyctl`, a payment method, the app name `biblioteca-api` (or another, then edit `fly.toml` and the workflow), and a **deploy token** as the GitHub Actions secret `FLY_API_TOKEN` | P1 week 1-2 | deploy the gateway; automatic redeploy when packs change | steps in `docs/ask-api.md`, "Deploying to Fly.io" | deployment; the workflow skips (does not fail) without the token |
| 3 | **Decisions OQ-1 to OQ-4, OQ-9, OQ-10** (name, art, shelves, publication policy, reviewers, feedback mailbox) and approval of the copy of the landing, About and policy page | P1 week 2-3 | final copy, catalogue and trust wording | a message with the answers; the OQ table of `docs/ui-spec-v2.md` section 21.2 | final copy; the shelf list |
| 4 | **Source files or permission to fetch them**: the creeds shelf and the Orthodox candidates; if we fetch ourselves, the network allow-list for the source repositories (for example CCEL, Wikisource, archive.org, Perseus or Open Greek and Latin if accepted) because the session proxy blocks unlisted hosts | P1 week 1-2 | the creeds and later works | upload files or add hosts to the session allow-list | C3, C4 |
| 5 | **Reviewer(s)**: names or roles of a theological reviewer (Orthodox and Evangelical perspectives if possible) and a Romanian and an English native reader; approval of the PROPUS glossary rows and the Bible-book abbreviation list | P1 week 3 (first), P2 week 5 (second) | the Verificată status; the throughput gate | a message with names and availability | "Verificată" anywhere |
| 6 | **Bible texts and licences**: which Romanian translations (Fidela, EDCR, Sinodală, others) and English ones (KJV, ASV, WEB or licensed); written permissions that explicitly cover normalising diacritics, offline storage and use as AI context; the public-domain fallbacks | start of conversations P1, needed P2 week 1-4 | the Scripture view, reference previews and Ask context for verses | letters or e-mails from licensors stored under `content/licences/` (reference only, no secrets) | Scripture view in Romanian |
| 7 | **Supabase project**: Frankfurt (eu-central-1); staging on the free plan first; project URL and the public anon key (client), the service-role key and database password (server only, as Fly secrets and GitHub secrets, never in the repository) | P2 week 1 | accounts, sync, content schema, hybrid retrieval | Supabase dashboard; secrets via `fly secrets set` | all of P2-D |
| 8 | **Domain** and registrar access; Cloudflare account (DNS, R2 bucket in the EU jurisdiction, Turnstile); an e-mail sending service (Resend or Brevo) with SPF, DKIM and DMARC records | P2 week 1-2 | web app and gateway on our domain, universal links, pack delivery, sign-in e-mails, the CORS allow-list | registrar and Cloudflare invitations | P2-D4, P2-D5; production auth |
| 9 | **Voyage AI key** for embeddings (free allowance exists) | P2 week 2 | hybrid retrieval | Fly secret | P2-B1 |
| 10 | **Hero art choice** from the short list we propose (public-domain, licence checked per image) | P1 week 2 | landing and bands | a message | final landing visuals (the flat `masthead` fallback ships otherwise) |
| 11 | **Time for reviews**: 1-2 hours a week to accept screenshots against the reference and to judge Romanian answers of Ask on the evaluation set | every phase | native-speaker judgement cannot be automated | calendar | quality gates |
| 12 | **Apple Developer Program** and **Google Play Console** accounts (organisation accounts can take weeks to verify) | start P3, needed P3-P4 | TestFlight, Play internal, store submission | owner enrols | P3-11, P4 |
| 13 | **Payments**: RevenueCat and Paddle accounts, legal entity data, bank details; accountant answers on VAT treatment (architecture questions) | P4 | membership | owner and accountant | P4 payments |
| 14 | **Legal**: lawyer for Bible licences and the share-alike question; DPO (external, part-time) | lawyer for licences from P1-P2; DPO P4 | licences and compliance | engagements | P4 compliance gate |
| 15 | **Sentry and PostHog** (EU) accounts | P2 (errors), P4 (analytics with consent) | monitoring | invitations | observability |

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
| Ask cost and abuse before accounts | P1 | per-IP limit (20 per 10 minutes), a dedicated Anthropic workspace with a spend limit and alert, one Fly machine, daily review of `ask.completed` log lines; kill switch by redeploying with the mock provider |
| A thin library makes Ask look weak (one or two books) | P1 | C3 and C4 in P1; suggestions tested against the installed works; "Ce conține acum" list when not covered; do not market Ask as broad |
| Lexical retrieval across languages is limited (glossary bridge) | P1-P2 | extend the glossary per work; evaluation set v0 shows gaps; embeddings in P2 |
| react-native-web layout parity (sticky bars, drawers, two-lane rows) and RN text-selection limits | P1 | spike first; paragraph-level actions on native (D-10); Playwright checks on the export; APK checked by hand |
| Font weight and bundle size (display face has one weight; Greek font adds 0.8 MB) | P1 | never request bold of IM Fell; load Gentium only with Greek editions; measure the web bundle in CI |
| New native module (`react-native-svg`) breaks the new architecture or 16 KB alignment | P1 | View-drawn icons until the CLAUDE.md check passes |
| Reference counts and copy drift; copying its text by accident | P1 | our own copy (ui-spec); derive counts from the catalogue; no reference text or images in `docs/` or `content/` |
| Scope creep from the reference's long feature list (274 rows) | all | MUST/SHOULD/LATER/SKIP in the inventory is the scope; changes go through the owner |
| SDK 58 and library lag (architecture risk) | P2-P4 | upgrade plan to SDK 59 before submission |
| Privacy of questions sent to a US AI provider (special-category data) | P1-P4 | notice in P1, versioned consent in P2, DPIA before public launch, Bedrock EU option kept open (architecture) |

---

## 12. Decisions to record and questions for the owner

### 12.1 Entries for `docs/decizii.md` (each deviates from, or adds to, the architecture document)

| Proposed ID | Decision | Reason |
|---|---|---|
| ADR-015 | UI v2: the reference's structure with our tokens (three themes, `accent` for fills and `accentStrong` for text, `borderStrong` for outlines); IM Fell Great Primer and Source Serif 4; Literata kept as an option; Inter reduced to a reading option; Gentium Plus for Greek lanes | owner request to look like the reference; WCAG; verified glyph coverage |
| ADR-016 | One chapter per screen in P1; continuous flow in P2 | keeps deep links, position store and tests; virtualisation work later |
| ADR-017 | Signed catalogue (`catalogue.json`) next to the packs, source of counts, shelves, centuries and editorial blurbs | one source of counts; offline; same signing key |
| ADR-018 | Transparency data model: additive `Provenance` fields (kind, model, date, passes, checks, review state, corrections), panel and policy page; states `draft`, `beta`, `reviewed` | the reference's central trust feature, with more disclosure |
| ADR-019 | Ask UI v1 on the existing SSE contract; contract additions (unverified strings, exposed rate headers, passage); open during the beta with a per-IP limit and a spend limit; account gate in P2 | owner priority; cheap to ship now |
| ADR-020 | Supabase, Auth and the domain move to P2; Ask beta runs on packs from disk | nothing in P1 needs them |
| ADR-021 | Legal and compliance programme moves to P4; cheap-now decisions stay early | CLAUDE.md priority 3 |
| ADR-022 | Paragraph-level actions instead of arbitrary text selection on native | React Native limitation |
| ADR-023 | Pipeline: target `en`, Latin and Greek sources, reference-overlap check, two translations from the original | ADR-013 consequences |
| D-P2-1 (open) | Conversations: local first with sync, or server side in Supabase | privacy versus convenience; decide in P2 week 1 |
| D-P2-2 (open) | Retrieval infrastructure: in-process vectors for a small library, then pgvector | cost and complexity against scale; decide after the P1 evaluation |

### 12.2 Questions for the owner

The product and content questions OQ-1 to OQ-12 are in `docs/ui-spec-v2.md` section 21.2 (name, art, shelves, publication policy for unreviewed translations, Bible texts, topics taxonomy, fonts, Ask tiers, reviewers, mailbox, pricing, register of address). Roadmap-level additions:

1. Which creeds and which Orthodox works open the library (section 8.3), and may we fetch sources from public repositories (allow-list) or do you supply files?
2. May Opus be used, exceptionally, as a final quality judge on the first Romanian and English translations (it will be reported if used)?
3. Should the beta be public from day one (open web URL and APK) or limited to a list of testers first?
4. Is a monthly Anthropic spend limit of 30-50 USD acceptable for the beta (cost per question is 0.005-0.015 USD on Sonnet according to `docs/ask-api.md`)?

---

## 13. Quality gates, cost and working agreements

**Gates on every change**: `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm format:check` (the repository's rules: TypeScript strict, no colour literals outside the palette, no secrets, tests for every new behaviour); from P1 also `scripts/check-ui-v2.mjs` and the screenshot matrix. Content changes keep the committed packs and `committed-content.test.ts` green.
Documents of the repository are in English; answers to the owner in Romanian; code, comments, file names and commit messages in English.

**Cost, order of magnitude** (the architecture's figures stay authoritative): Beta 1 needs one Fly machine, the Anthropic usage under a spend limit, GitHub Pages and the existing CI; no Supabase, no Cloudflare plan, no domain strictly required. P2 adds Supabase (free for staging, Pro 25 USD when members exist), Cloudflare (free plan, R2 with zero egress), Voyage (free allowance),
a domain and an e-mail service. Anthropic is the only line that scales with use; budgets in money per user arrive with accounts.

**Working agreements.** Model rule: orchestrator on Fable, every subagent on Sonnet (Opus only exceptionally and announced). No secrets in the repository: only public keys reach the client; the Anthropic, Supabase service and Fly keys live as platform secrets. The cloud container is ephemeral: everything of value is committed and pushed before stopping. Before adding a native module, check new-architecture
compatibility and 16 KB page alignment. Every deviation from the architecture document is written in `docs/decizii.md` with its reason (section 12.1). Reference captures stay under `test-results/tfr/` and the scratchpad; nothing of the reference's text or images enters `docs/` or `content/`.
