# The Faith Received: platform inventory

Status: reference inventory for the reprioritisation of 4 November 2026 (ADR-014 in `docs/decizii.md`).
Companion documents: `docs/ui-spec-v2.md` (our target interface) and `docs/roadmap-v2.md` (the plan).
Language: English (technical documents of this repository). Product copy for the app is specified in
Romanian and English in `docs/ui-spec-v2.md`.

## Contents

0. [Scope, sources and method](#0-scope-sources-and-method)
1. [What the platform is](#1-what-the-platform-is)
2. [Information architecture](#2-information-architecture)
3. [Feature catalogue](#3-feature-catalogue) (areas SH, LP, LB, WK, RD, TR, SC, TP, SR, AK, RS, LX, AB, AC, PR)
4. [Page anatomies](#4-page-anatomies)
5. [Design language](#5-design-language)
6. [Content model implied by the platform](#6-content-model-implied-by-the-platform)
7. [What the platform does not do and we need](#7-what-the-platform-does-not-do-and-we-need)
8. [Quirks and drift in the reference (do not copy)](#8-quirks-and-drift-in-the-reference-do-not-copy)
9. [What could not be verified](#9-what-could-not-be-verified)
10. [Evidence index](#10-evidence-index)

---

## 0. Scope, sources and method

**Reference platform.** The Faith Received (TFR), a reading and research application for historical
Christian texts, published by Mere Orthodoxy at `https://mereorthodoxy.com/the-faith-received/`. It is
labelled BETA everywhere. Captured on 4 November 2026.

**What this document is.** A complete inventory of what exists there, written so that a team can rebuild it
without seeing the site: the navigation tree, every feature with its priority for us, the anatomy of each
page type, the design language, the content model the platform implies, and the gaps we must fill (Romanian,
bilingual interface, offline, native apps).

**How the material was gathered.**

| Source | What it gave | Evidence tag |
|---|---|---|
| Playwright Chromium, desktop user agent, 1366x900 (D) and 390x844 (P), device scale factor 1, signed out | Rendered pages, measured geometry and computed styles | `[live]`, `[dom]` |
| The site's own public JavaScript and CSS, read as text (never run outside the page loads a browser performs) | Behaviour, state keys, endpoints, design rationale in comments | `[js]`, `[css]` |
| JSON files the browser itself downloaded while rendering | Data schemas (keys and types only) | `[data]` |
| Public how-to page (copy and 20 product screenshots of signed-in tools), tutorial tours, gate dialogs, pricing pages | Everything behind accounts | `[howto]`, `[tour]` |
| One extra live capture made while writing this document (the work hub of a library work, signed out, four tabs read) | The work hub anatomy | `[live-wh]` |
| The synthesiser's own inference, always marked | Implications for our rebuild | `[inference]` |

**Rules followed.** No account was created, nobody signed in, no form was submitted, no e-mail address was
typed, no worker API was called by us. Tools behind an account are described from public copy, the site's own
tours, its public product screenshots and its public client code. Page text is not reproduced: only UI labels
and short fragments appear here. Screenshots and raw captures are copyrighted reference material and stay in
`test-results/tfr/` (gitignored) and the session scratchpad; none of it belongs in `docs/` or `content/`.
Hero paintings and portraits of the reference are not ours to reuse (see `docs/ui-spec-v2.md`, art direction).

**Vocabulary used in the catalogue.**

- Gate (what the reference does): **open** (no account), **acct** (free account; "free during the beta"),
  **member** (paid, only after the beta), **overlay** (page visible but covered by a blocking account overlay),
  **srv** (server-gated shell: the server sends only a sign-up panel).
- AI column: **No**; **LLM** (a model answers at request time); **LLM-pre** (text generated in advance by a
  model and shown as data, always labelled machine-written); **Emb** (search by embeddings); **Rule**
  (deterministic software, for example the modernizer or the computed counts).
- Priority for us: **MUST** (Phase 1, "Beta 1": navigation shell, landing, library, work hub, reader parity,
  Ask v1, bilingual books), **SHOULD** (Phase 2 or 3), **LATER** (Phase 4 or later, or when the data exists),
  **SKIP** (we do not build it, with the reason). Phases are defined in `docs/roadmap-v2.md`.

---

## 1. What the platform is

**Shape.** One Ghost 6 publication (Mere Orthodoxy, a non-profit publication) hosts a sub-site under
`/the-faith-received/`. Static markup comes from Ghost templates; almost every number, list and tool is drawn
in the browser from JSON served by Cloudflare Workers (a library worker, an Ask worker, a verse worker, a forms
worker, a membership worker, a kit worker for e-mail tags). The product was ported from a stand-alone app and
still maps its old paths. The reading application is a separate engine (a shared design system, "PRDL", serves
four sister reading sites).

**Scale shown to visitors (4 November 2026; counts differ by surface and drift).**

| Measure | Value |
|---|---|
| Works "available to read" | 19,921 live on the landing (static fallback 19,763; All works says 17,903; the works index holds 19,445) |
| Machine-translated into English | about 15,000 (the public registry lists 14,811); all inspected works say "needs review" |
| Corpora | Migne Latin (PL, 8,967 rows), Migne Greek (PG, 3,149), Orientalis (PO, 400), TFR proper, Early English Books, confessions (680 documents), a curated English set (16 works) |
| Shelves | nine (Latin, Greek and Eastern Fathers, Medieval, Roman Catholic, Continental Reformed, English writers, Lutheran, Humanism and Law) plus Creeds and the Councils (57 volumes) |
| Authors | 1,879 across nine shelves |
| Text volume | 2,437,905 pages; English 5.16 billion characters; source text 4.12 billion |
| Scripture | 31,102 verses; a per-verse citation index (for example 777 works cite Romans 3:28); 321 creed documents with 20,288 proof-text citations over 7,391 verses |
| Topics | 10 parts, 45 curated loci; 198 mined topics (379,490 indexed passages on one topic alone) |
| Reference works | Dictionary of Catholic Theology (1,916 articles, French and English paragraph by paragraph); Glossary (about 34 MB in 296 buckets) |
| Essays and podcasts | 494 articles and 93 episodes of the publisher, about the library |
| Changelog | 161 changes, 37 open reader reports |

**Business model.** Every text is free to read and stays free. Research tools (Search, Ask, Compare,
Connections, Notebook, Desk, Lexicon, Commentary Decks, Disputed Questions, Set Indexes, Page Scans,
Bookmarks) need a free account while the beta runs and become member-only afterwards (USD 100 per year or
USD 10 per month; lifetime USD 995; gifts, group seats, organisation and student plans). One flag switches
every gate from "free during the beta" to "members only". Scripture, Topics and Guides sit behind a blocking
free-account overlay already.

**The editorial claim.** Most English texts are machine translations. The product answers the trust problem
with transparency: a panel before the text (who produced the English, review state, reports, corrections),
the original always one tap away, page scans, a public dated changelog and a public report form. This is the
closest analogue to our bilingual translated books.

**The moat.** Everything interesting (Ask, Compare, Connections, Scripture and Topics views, work guides,
Lexicon) stands on pre-mined, page-addressed data layers: positions with stance, Scripture references,
citations resolved between works, topic loci, a five-part index per work, page summaries, a word index and
embeddings. The chat interface is the visible part; the data is the cost and the value. Every derived item
links back to a page.

**Trust rules worth copying** (stated in the reference's own code comments for the Verse Desk):

1. Every number and sentence is computed by a fixed rule from data; nothing is hand-written or model-written
   for one verse.
2. A module with no data renders nothing (no "empty", "planned" or "data needed" placeholders).
3. A name is attached to a position only where the data gives a stance.
4. Every link goes to something that exists.
5. Machine-written text is always labelled and never set as a quotation ("a gist is not a quotation").
6. A figure that needs a note on how it was made carries a "Methodology" disclosure.

---

## 2. Information architecture

### 2.1 The navigation tree

The section bar ("rail") is the primary navigation. It sits under the publisher's own masthead (not part of
the product). Labels are small caps. `[open]` no account, `[acct]` free account, `[overlay]` blocking account
overlay, `[srv]` server-gated.

```
Publisher chrome (Ghost): masthead  HOME · ABOUT · JOURNAL · THE DAILY LITURGY · THE FAITH RECEIVED
                                    · RESOURCES ▾ (11 links) · SUPPORT ▾ (4 links) · CONTACT
                                    · article-search icon · Sign in · Become a Member
                          footer    social, about, podcasts, resources, legal line, sign-up link

Section bar (sticky, 48 px D / 43 px P)
 THE FAITH RECEIVED | HOME ........ /                                  landing                      [open]
 SEARCH ........................... /search/                           works, passages, scripture, ask [acct, srv]
 READ ›  (drawer, 6)
   Curated ........................ /curated/                          browse: five folding bands   [open]
   Full Library ................... /all-works/?collection=all         by author / by century       [open]
       shelf pages ................ /confessions/  /patrologia-latina/  /patrologia-graeca/
                                    /patrologia-orientalis/  /early-english-books/                   [open]
   Authors ........................ /authors/ (alias /author/)         index of 1,879 authors       [open]
       author room ................ /author/?sh=<shelf>#<slug>         tabs: Works, Positions, Scripture,
                                                                         Topics, Reception, Connections, Search [open]
       work hub ................... /author/?sh=<shelf>#w/<slug>       11 tabs (see 4.4)            [open]
   Traditions ..................... /tradition/  ->  /tradition/?t=<slug>   15 listed, 17 records    [open]
   Guides ......................... /guide/  ->  /guide/?s=<shelf>     century ruler + 14 guides    [overlay]
   Dictionary ..................... /dictionary/                       1,916 articles FR + EN       [open]
 SCRIPTURE ........................ /scripture/?ref=<book>.<ch>[.<v>]&t=<tr>   reader + commentary pane [overlay]
       Verse Desk ................. /scripture/desk/?ref=<book>.<ch>.<v>      one verse, everything     [open]
 TOPICS ........................... /topics/  ->  /topics/?t=<locus>   ten parts, 45 loci, topic desk [overlay]
       Every doctrine ............. /doctrines/  ->  /doctrines/?s=<slug>     198 mined topics         [open]
 RESEARCH ›  (drawer, 12)  hub page /research/ with seven desk tabs (#ask #power-search #compare
                                    #bookmarks #notebook #connections #desk)
   Ask ............................ /ask/  (?chat= ?q= ?trad= ?view=history ?share=<id>)            [acct, srv]
   Power Search ................... /search/#power                      search by meaning            [acct]
   Compare ........................ /research/#compare  and  /compare/#a=<slug>,<slug>             [acct]
   Connections .................... /connections/  (#a=<slug>, #t=<topic>)                          [acct]
   Commentary Decks ............... /commentary-decks/                  eight decks                  [acct, srv]
   Disputed Questions ............. /disputed-questions/                                            [acct, srv]
   Lexicon ........................ /lexicon/  (#<term> ?q=<term>)                                  [acct, srv]
   Set Indexes .................... /set-index/  (?set=<id>)                                         [acct, srv]
   Page Scans ..................... /scans/                                                           [acct, srv]
   Bookmarks ...................... /research/#bookmarks                                             [acct]
   Notebook ....................... /research/#notebook  and  /pins/ ("Bookmarks" page title)       [acct]
   Desk ........................... /desk/  (?doc=<id>, ?view=research&notebook=<id>)               [acct, srv]
 RESOURCES ........................ /resources/  (#articles #podcasts)  494 essays, 93 episodes   [open]
 ABOUT ›  (drawer, 3)
   About TFR ...................... /manifesto/  six hash tabs: #what #story #mere-orthodoxy
                                    #transparency #changelog #most-read                              [open]
   Tutorial ....................... /tutorial/  six guided tours (?tour=<name>)                     [open]
   How to use ..................... /how-to-use/  tabs #laity #pastors #academics                    [open]

Reachable but not in the bar
   Reader ......................... /read/?w=<slug>[&p=<n>][#b<page>-<n>][&hl=<words>]              [open]
   Transparency policy ............ /transparency/  (registry of 14,811 machine-translated works)  [open]
   Glossary ....................... /glossary/                          theological terms            [open]
   Devotional plan ................ /devotional/                        sources + a Bible track      [open]
   Today's Reading ................ /today/                             one passage a day            [open]
   Notebooks page ................. /pins/  (?view=research = "Personal research")                  [acct]
   Shared Ask answers ............. /ask/?share=<id>                    public, noindex              [open]
   Membership ..................... /membership/  /give/  /groups/  /institutions/  /student/       [open]
   Legacy forwarders .............. /bible/  /library  /fathers  /dtc  /pins  ...  rewritten at load
```

Counts: the READ drawer has 6 links, RESEARCH 12, ABOUT 3; the bar has 8 items, three of them drawers.
RESEARCH is the only item whose children are all behind an account.

### 2.2 URL grammars the product relies on

| Area | Grammar | Notes |
|---|---|---|
| Reader | `/read/?w=<slug>` plus `&p=<n>` (section or column), `#b<page>-<block>` (paragraph anchor, first block of a page is `-0`), `#h<n>-<slug>` (heading card), `&hl=<words>` (mark and open find, 3+ characters), `&lanes=en`, `&src=` (Greek/Latin source view), `&peek=1` (embedded) | Ordinary navigation does not change the URL; only a page jump or a heading anchor writes a hash. The place is kept in local storage instead. |
| Library | `collection=all\|confessions\|pld\|pg\|po\|eebo\|tfr\|mo`, `q`, `tradition`, `denomination`, `party`, `century=1..20`, `scans=1`, `letter=A..Z\|#`, `view=century\|volume\|tome\|year`, `page=N` | Written with `replaceState` on every change and parsed on load; defaults are omitted. |
| Authors | `?q=`, `?sh=<pl\|gf\|po\|md\|rc\|rf\|lu\|ed\|hl>`, `?a=<slug or name>` (resolved client side), `#<slug>`, `#<slug>/<tab>`, `#w/<work slug>[/<section>]` | Every author gets a page, with or without a research room. |
| Scripture | `?ref=<book>.<chapter>[.<verse>]`, `&t=ESV\|CSB17\|KJV\|NASB`, `?pane=0\|1` | One template serves all 31,102 verses; the parser accepts `rom.5.12`, `Rom 5:12`, `1 Cor 13`, library slugs, SBL and Vulgate abbreviations, legacy forms. |
| Topics | `?t=<locus id>`, `&view=<read\|compare\|trace\|scripture>`, `&c=<same>` | Locus ids mix Latin and English slugs. |
| Compare | `#a=<slug1>,<slug2>[,..4]&sel=<topic>&g=canon&s=<stance>&q=<phrase>&v=meet&m=opposite\|assert&o=n\|denies` | State lives in the hash so a view is a link. |
| Resources | `?q= &kind= &sort=` (articles), `?pq= &show= &psort=` (podcasts), `#articles` `#podcasts` | Whole state in the address, defaults omitted. |
| Ask | `?chat=<id>`, `?q=`/`?ask=` (auto-send from a hero box), `?trad=<shelf>`, `?view=history`, `?share=<id>` | Keyboard: Ctrl/Cmd+Shift+A opens Ask from anywhere. |
| Tours | `?tour=<name>&tstep=<index>` | Tours run over gated pages on purpose (gates are lifted while a tour is active). |
| Test hooks | `?gate=force`, `?gate=off` | Present in production code; we do not copy them. |

### 2.3 Gating map (what an anonymous visitor can and cannot do)

| Open to everyone | Free account (now) / member (after the beta) |
|---|---|
| Reading every work; outline, Library tab, Index tab content; Transparency; typography, theme, flow/pages, fold all, hide toolbar; copy link; find in the loaded text; local highlights; copy and link from the selection bar; paragraph rail; Scripture and footnote previews; volume navigator; About-this-work card; the Report form from the Transparency dialog and from a selection | Search and Power Search; Ask (Deep research, share, MCP key, ChatGPT link); Compare; Connections; Notebook (every save control), Bookmarks, Desk; Commentary Decks; Disputed Questions; Lexicon and Define; Set Indexes; Page Scans and the Scan lane; the reader Research panel, Search whole work, Related passages, Modernize; the toolbar Report button |
| Landing, Browse, Full Library, shelf pages, Authors, author rooms and their tabs (including Compare-like and Connections-like tabs and the author-scoped search), work hubs, Traditions, Dictionary, Glossary, Devotional, Today, Resources, About, Tutorial and tours, How to use, Transparency, shared Ask answers, the Verse Desk, Every doctrine | Scripture, Topics and Guides are behind the blocking overlay from the first view (a free-trial counter exists in code and comments but the live behaviour is a hard gate) |

Observation `[inference]`: the Verse Desk, the author room and Every doctrine expose most of what the gated
Scripture, Compare, Connections and Topics tools show, so the gate is soft in effect. The data files are public
JSON; the modal is presentation only.

---

## 3. Feature catalogue

One row per feature. Columns: **ID**; **Feature**; **Where** it lives; **What it does**; **Data** it needs;
**Gate** in the reference; **AI** (see section 0); **Priority for us** with the reason. "Phase" numbers refer
to `docs/roadmap-v2.md` (P1 = Beta 1). Rows marked SKIP are listed on purpose: a reviewer should be able to
see that they were considered. The count by priority is at the end of this section.

### 3.1 Shell, navigation and chrome (SH)

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| SH-01 | Publisher masthead | every page | Ghost header (logo, site nav, article-search icon, Sign in, Become a Member), fixed 77/61 px; phone right-hand drawer | Ghost nav | open | No | SKIP: the publisher's chrome; we build our own brand bar (ui-spec 4.1) |
| SH-02 | Section bar ("rail") | every page | Sticky 48/43 px bar: brand and HOME, SEARCH, READ, SCRIPTURE, TOPICS, RESEARCH, RESOURCES, ABOUT; small caps | route table | open | No | MUST P1: the signature of the product |
| SH-03 | Rail drawers (READ 6, RESEARCH 12, ABOUT 3) | rail | Desktop: opens along the bar (width animates, other items slide left, `›` becomes `‹`); phone: drops as 48 px rows; one open at a time; Esc, outside click, aria-expanded | route table | open (links gated) | No | MUST P1: only live items are listed |
| SH-04 | Rail as a scroller on phone | rail, up to 640 px | One horizontally scrolling row, hidden scrollbar | - | open | No | MUST P1 (add an edge fade as a scroll cue) |
| SH-05 | Current-location marking | rail | `aria-current` on the matching link, darker group toggle, hash-aware | route state | open | No | MUST P1 |
| SH-06 | Feature-gate modal | any gated click | Dialog: eyebrow, title, one-line value, first/last name and e-mail, "create free account", redirect back to the tool, Esc, focus trap; one flag turns it into "members only" | gate copy, account API | open to submit | No | SHOULD P2: our copy and flow once accounts exist (P1 has no gate) |
| SH-07 | Blocking account overlay | Guides, Scripture, Topics | Full-viewport overlay, page inert, Esc swallowed, no close button; exits: form, sign in, back to library | - | overlay | No | SKIP: hostile and inaccessible, and soft in effect (the Verse Desk shows the same data) |
| SH-08 | Server-gated tool shell and arrival modal | Search, Ask, Compare, Connections, Desk, Decks, Lexicon... | The server sends only a sign-up panel; the modal opens on arrival | - | srv | No | SKIP: we show the real screen with an in-context prompt, enforced server side (P2) |
| SH-09 | Inline gate band | `/pins/` | Cream band with the six-tool list and a sign-up form | - | open | No | SKIP: covered by SH-06 |
| SH-10 | Survey tab "Tell Us What You Think" | every page except the reader | Fixed bottom strip with a tab; eight-question bottom sheet, auto-advance, "don't show again"; local state | survey endpoint | open | No | LATER P3: a three-question in-app feedback; P1 has a feedback link |
| SH-11 | Give feedback / Report an issue dialog | beta band, transparency | Modal form (names, e-mail, work, author, issue type, comment) with a bot check, posted to a forms backend | forms backend | open | No | SHOULD P2 (P1: a mail link) |
| SH-12 | "Methodology" disclosure | under figures, AI notes | Closed details; opens for print; says how a figure or ranking was made | text per module | open | No | MUST P1 |
| SH-13 | BETA pill and beta band | hero, most pages | Label plus a cream band with a feedback button | copy | open | No | MUST P1 (our beta) |
| SH-14 | Support band | inner pages | Dark CTA "free to read, paid for by readers" with a membership button | membership | open | No | LATER P4 (membership) |
| SH-15 | Footer | every page | Columns of links, legal line, sign-up link | - | open | No | MUST P1 (light) |
| SH-16 | Legacy-route rewriting and `?a=` author resolution | everywhere | Rewrites old stand-alone app paths; resolves author names with dates stripped | slug table | open | No | SKIP: no legacy; LATER slug aliases |
| SH-17 | Theme | reader, Scripture, Verse Desk | Reader Light/Sepia/Dark (follows the OS until chosen); Scripture working surface has its own dark toggle; everything else is forced light | - | open | No | MUST P1: all three themes on every screen (deviation D-01) |
| SH-18 | Paper-grain film | every page | Fixed noise overlay at 3 % opacity | - | open | No | LATER: cosmetic, web only |
| SH-19 | Keyboard shortcut help | reader | `?` opens a card (arrows, `[` `]`, `/`, `r`, `w`, Esc) | - | open | No | SHOULD P2 (the shortcuts themselves are MUST P1 on web) |
| SH-20 | Print stylesheet | every page | Hides chrome, opens Methodology, prints notes inline | - | open | No | LATER (web) |
| SH-21 | Anonymous usage events | every page | Page and feature events (`work_open`, `work_depth`, `feature_use`) to an events worker; Plausible; PostHog for identified users | analytics | open | No | LATER P4: PostHog EU with consent, per the architecture |
| SH-22 | Site search for the publisher's essays | masthead | 720 px modal: title, author, keyword and date filters | essay index | open | No | SKIP |

### 3.2 Landing (LP)

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| LP-01 | Hero with highlight-sweep headline | landing | Dark photo band; kicker with pulsing pilcrow and BETA pill; two-line H1 whose second line is highlighted by a terracotta bar that sweeps in once; two buttons and two text links; reduced-motion safe | image, copy | open | No | MUST P1: our copy and our art; second button is "Ask" |
| LP-02 | "Where to start" doors | landing | Four doors (Read, Scripture, Topics, Research with a MEMBERS pill) in a 4/2/1 column hairline grid | - | open (Research gated) | No | MUST P1: Read and Ask doors; others appear when live |
| LP-03 | Free vs Member block with free-account form | landing | Two-column comparison, passwordless sign-up (first, last, e-mail), beta note | tier copy | open | No | LATER P4 (membership); P1 shows a short "free to read" statement |
| LP-04 | Devotional split | landing | Cream band: framed painting, kicker, H2, paragraph, Start reading | art, copy | open | No | SHOULD P1: one editorial band with our own words and art |
| LP-05 | Stats band | landing | Four figures over a dark painting; the works count is computed from the catalogues | catalogue counts | open | Rule | MUST P1: counts from our signed catalogue (works, editions, languages) |
| LP-06 | "Who it is for" | landing | Three columns: laity, pastors, academics | copy | open | No | MUST P1 (Mireni, Păstori, Cercetători) |
| LP-07 | "In the collection" cards | landing | Twelve named works as 4-column cards (group, era, title, description, READ arrow) deep-linking to the reader; description and arrow hidden on phone | curated list | open | No | MUST P1: cards for every work we have (up to 12) with RO/EN badges |
| LP-08 | "Study" split with facsimile plates | landing | Two title-page scans beside "read the translation next to the original" | scans | open | No | MUST P1: a static picture of our side-by-side reading mode |
| LP-09 | "The shelves" cards | landing | Eleven cards: plate, live count, italic who-line; links to shelf pages | shelf catalogue | open | Rule | MUST P1: shelves that hold works; typographic plates |
| LP-10 | "Explore the library" list | landing | 17 entries (name and one clause) in three columns | route table | open | No | SHOULD P2 (P1 lists the live entries) |
| LP-11 | Membership block | landing | Annual/Monthly toggle, Member and Lifetime cards, "Other memberships", "Rather give once?" | pricing | open | No | LATER P4 (see PR area) |
| LP-12 | Beta band and Transparency band | landing | Feedback button; band linking the transparency policy | copy | open | No | MUST P1 |
| LP-13 | Counts computed from seven catalogues at load | landing | 26 requests, counts replaced after load | catalogues | open | Rule | SKIP: one signed catalogue file, counts derived once (reference counts disagree by surface) |

### 3.3 Library, shelves, authors, traditions, reference works (LB)

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| LB-01 | Browse ("Curated") | `/curated/` | Hero with a search form (scope, collection, tradition, century selects hidden) and five buttons; five folding bands: creeds, classics, 30 authors, fathers, guide teasers, shelf samples | hand-written lists, catalogue | open | No | MUST P1: a band renders only when it has items |
| LB-02 | Full Library | `/all-works/` | One template for the library and each shelf: shelf fold, view tabs, filter panel, A-Z bar, author accordions, pager | work catalogue | open | No | MUST P1 |
| LB-03 | Filters | Full Library | Collection, century (with counts), tradition, conditional denomination/party, "has page scans"; the count line always says what the list is | facets | open | No | MUST P1: shelf, century, tradition, language, availability; denomination and party LATER |
| LB-04 | A-Z letter bar with counts | Full Library | Letters with counts, empty letters omitted, selecting resets page | author names | open | No | MUST P1 (Romanian collation) |
| LB-05 | Search an author or a title | Full Library, Browse | 180 ms debounce; ranking: matching authors, works naming them, unattributed works | catalogue | open | No | MUST P1 (search by name) |
| LB-06 | By-century view | Full Library | Twenty numbered tiles with counts and a "no century" note; choosing one filters | derived century | open | No | MUST P1 |
| LB-07 | Author accordions with work rows | Full Library | Name, "N works", then rows: title, italic original title, right-aligned citation; "View contents (N sections)" | catalogue, contents | open | No | MUST P1 |
| LB-08 | Edition groups (facsimile vs born-digital witness of one edition) | list rows | Labels such as "Digital text held" | editions file | open | No | SKIP: our model is one edition per language with `sourceEditionId` |
| LB-09 | Shelf pages | `/confessions/`, Migne, EEBO | Same template with its own hero, tabs (by tradition, by volume, by tome) and counts | corpus catalogues | open | No | MUST P1: one shelf template driven by a `shelf` slug |
| LB-10 | "Study this shelf" panel | Full Library, Migne shelves | Ask this shelf, Scripture, Authors, Topics, Connections, Guide | shelf keys | open (tools gated) | No | SHOULD P2: "Ask this shelf" first |
| LB-11 | Authors index | `/authors/` | Find box, period filter, order (library selection, A-Z, most works, most Scripture citations), nine shelf accordions, Expand all, Reset | author directory | open | No | MUST P1: simple alphabetical index; filters SHOULD P2 |
| LB-12 | Author room (profile) | `/author/` | Portrait, dates, "from the library" picks, quick facts, cites most / cited by, related authors, kind-of-work filter, Read / Explore / Save work | enrichment per author | open | LLM-pre | SHOULD P2: bio, works, quick facts; the rest LATER |
| LB-13 | Author room tabs | `/author/` | Works, Positions, Scripture, Topics, Reception, Connections, Search | mined layers | open (Save, Compare gated) | LLM-pre | SHOULD P3 (Works P2) |
| LB-14 | Traditions index and page | `/tradition/` | 15 rows (five top-level, ten under Protestant); page with overview, related, documents by year, authors by birth | traditions data | open | LLM-pre | SHOULD P2 |
| LB-15 | Guides with century ruler | `/guide/` | Chart of 13 shelves by decade with a selected-century column, shelf cards, 14 shelf guides (Councils scrollytelling, find over every tome) | guide data | overlay | LLM-pre | LATER P3: the ruler needs breadth of content |
| LB-16 | Dictionary of Catholic Theology | `/dictionary/` | 1,916 French articles with English alongside, paragraph by paragraph; `Both / English / Francais`; headword search either language; A-Z; prev/next; text size; per-article quality flag | paired paragraph arrays | open | LLM-pre | SHOULD P2 as a pattern (aligned bilingual reading); the content itself SKIP |
| LB-17 | Glossary | `/glossary/` | Term search fetching one two-character bucket; letter browse; definitions attributed to author and page | 296 buckets | open | LLM-pre | LATER P3 |
| LB-18 | Devotional plan builder | `/devotional/` | Choose sources, add a Bible track, save a plan; keeps place | plan store | open | No | LATER P4 (reading plans, local notifications) |
| LB-19 | Today's Reading | `/today/` | One passage a day from the curated English set, link into the document | day table | open | No | LATER P4 |
| LB-20 | Resources | `/resources/` | 494 essays and 93 episodes of the publisher; search with aliases, kind filters, sort, "Serves:" tooltips, whole state in the URL | essay index | open | No | SKIP the content (the publisher's essays); the pattern LATER as our own "Resurse" |

### 3.4 Work hub (WK)

The hub is documented from a live capture of a Migne work (`[live-wh]`) and from the site's CSS. It is open (no
account). Works without enrichment data answer "Not found." at that address (observed for a curated English work).

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| WK-01 | Work card | `/author/#w/<slug>` | Title, author link, volume/column citation, kind-of-work chip, stat tiles (pages, Scripture citations), "Open in the reader" | work meta | open | Rule | MUST P1 (sections, words, editions, Scripture citations when indexed) |
| WK-02 | Sticky tab strip with counts | work hub | 11 tabs; one scrolling row on phone; 44 px tabs, active underlined | enrichment | open | mixed | MUST P1 for the strip; tabs appear by phase |
| WK-03 | Overview | work hub | Machine-written blurb, kind tags, "Where to start" numbered list (page and one-line reason), Methodology | blurb, start list | open | LLM-pre | MUST P1: our blurb and 3-5 start points, labelled |
| WK-04 | The argument | work hub | Summary, numbered theses with page spans, objections and answers, "how it is argued" | theses | open | LLM-pre | LATER P3 |
| WK-05 | Sections | work hub | Each section with a one- or two-sentence summary | section summaries | open | LLM-pre | SHOULD P2 (P1 lists contents without summaries) |
| WK-06 | Index in five parts | work hub, reader | Subjects, Persons, Scripture, Terms, Questions with counts; find box; page buttons per entry | five-part index | open | LLM-pre | SHOULD P2 (Scripture part, deterministic); the rest P3 |
| WK-07 | Quotations | work hub | Source-language quotes with page and reason | quotes | open | LLM-pre | LATER P3 |
| WK-08 | Later readers | work hub | Pages of the work cited N times by M later works; find a later writer; open a page to see the citers | citation graph | open | LLM-pre | LATER P3 |
| WK-09 | Scripture tab | work hub | Counts by kind (quotations, citations, allusions) and per book | Scripture index | open | Rule | SHOULD P2 |
| WK-10 | Topics tab | work hub | Pages per topic | topic tags | open | LLM-pre | SHOULD P3 |
| WK-11 | Positions tab | work hub | Doors to the author's positions, "follow sources cited", "explore later citations" | mined positions | open | LLM-pre | LATER P3 |
| WK-12 | Sources cited and Names tabs | work hub | Resolved citations to held works; citation index and names in the text | resolved citations | open | LLM-pre | LATER P3 |
| WK-13 | "Resources on this work" | work hub | Essay cards of the publisher about the work and its author | essay index | open | No | SKIP (publisher's essays) |
| WK-14 | "About this work" card in the reader | reader | Blurb, author card, "more by" | blurb | open | LLM-pre | MUST P1 (as the hub's Overview; no separate overlay) |
| WK-15 | Work-level machine-written guide with a model note | enrichment files | Every guide file carries a model alias and a note that it was machine-written and checked against the library | enrichment | open | LLM-pre | MUST P1: label every generated block (Methodology) |

### 3.5 Reader (RD)

The reader is the heart of the product: one shell, one scroller (the document itself never scrolls), the whole
work in the DOM, fed from JSON. Geometry at 1366x900: site masthead 77 px, section bar 48 px, reader toolbar
67 px (97 px with a volume row), outline panel 300 px, text scroller; at 390x844: masthead 61, bar 43, toolbar
53, thumb bar 61.

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| RD-01 | Reader shell | `/read/?w=` | Fixed bars, 300 px outline column, one scroller; 3 px progress bar fixed to the bottom; skip link "Skip to the text" | work JSON | open | No | MUST P1 |
| RD-02 | Toolbar | reader | Contents toggle, title block, prev/next, section counter, Transparency, find, `Aa`, `Tools`; everything else folded into Tools | - | open | No | MUST P1 |
| RD-03 | Title block | toolbar | Title (20 px), author link, dates or volume, language of the text | work meta | open | No | MUST P1 (adds the language label) |
| RD-04 | Volume navigator | toolbar row 3, Migne works | Previous/next volume links, dropdown of the works in a volume, "Previous in PL 35" bars inside the text | collections | open | No | SKIP: Migne-specific; the pattern LATER P3 for multi-volume sets |
| RD-05 | Section prev/next and counter | toolbar | Arrows and keys; the counter counts sections or columns and accepts a number to jump | sections | open | No | MUST P1 |
| RD-06 | Resume place and deep links | reader | Last place per work kept locally; `&p=`, `#b<page>-<n>`, `&hl=`; ordinary navigation leaves the URL alone | local state | open | No | MUST P1 (exists: position store per edition) |
| RD-07 | Auto-hide chrome on scroll | reader | Desktop: masthead slides away; phone: masthead, bar, toolbar and thumb bar leave on scroll down and return on scroll up | - | open | No | MUST P1 |
| RD-08 | Hide toolbar (focus mode) | Tools | Hides all bars; a fixed "SHOW TOOLBAR" button stays; remembered | - | open | No | SHOULD P2 |
| RD-09 | Progress, skip link, focus rings | reader | 3 px ink progress bar; 2 px focus ring offset 2 px | - | open | No | MUST P1 |
| RD-10 | Loading and error states | reader | Shimmering "Loading" text; unknown work and missing work messages with a library link | - | open | No | MUST P1 |
| RD-11 | Outline panel with tabs | left panel | Tabs Outline (default), Pages, Index, Library, as joined segments; active filled terracotta | sections | open | No | MUST P1 (Outline); Index and Library P2; Pages LATER |
| RD-12 | Hierarchical outline | outline | Entries 14 px with depth indent and chevrons; current entry bold with a 2 px bar and `aria-current`; follows scroll | section tree | open | No | MUST P1 |
| RD-13 | Search contents | outline | Live heading filter, "N matching headings", Clear, Esc, arrow keys | - | open | No | MUST P1 |
| RD-14 | Show current; Expand/Collapse all | outline | Scrolls to the current entry; folds branches (hierarchical outlines only) | - | open | No | MUST P1 |
| RD-15 | Expand contents overlay | outline | Full-page three-column index, or cards per top-level section | - | open | No | SHOULD P2 |
| RD-16 | Hide/Show contents | toolbar, `[` `]` | Slides the panel; choosing an entry closes it | - | open | No | MUST P1 |
| RD-17 | Pages tab | outline, Migne works | Rows with scan thumbnails and column labels | page scans | open | No | LATER P3 (with scans) |
| RD-18 | Index tab | outline | Printed indexes and generated parts (Subjects, Persons, Scripture, Terms, Questions) | five-part index | open | LLM-pre | SHOULD P2 (Scripture part), the rest P3 |
| RD-19 | Library tab | outline | Author tree with filter; selecting a work loads it | catalogue | open | No | SHOULD P2 |
| RD-20 | Phone contents drawer | phone | Full-width drawer from the thumb bar with "Authors" and "Scripture" chips, 56 px rows | - | open | No | MUST P1 |
| RD-21 | Chapter cards in tiers | text | Card (border, 3 px radius, title 1.42 em / 600), label-only card with eyebrow, continuation, tier 2 (top rule), tier 3; "§" anchor; long titles shrink | headings | open | No | MUST P1 |
| RD-22 | Fold cards, Collapse all / Expand all | text, Tools | A fold toggle per card; folds every section | - | open | No | MUST P1 |
| RD-23 | Reading text | text | Source Serif 21 px / 1.55 (16 px / 24.8 on phone), measure 37 em, paragraph spacing 0.58 em, chapter line in italic | paragraphs | open | No | MUST P1 |
| RD-24 | Flow vs Pages | Tools | Continuous reading or page-break marker bars | page breaks | open | No | SKIP: we have sections, not printed pages; LATER with scans |
| RD-25 | Margin markers and citation copy | text | Page/column pill in the margin; click copies "Author, Title, volume, section. - URL" | - | open | No | MUST P1 (paragraph marker; copy citation) |
| RD-26 | Parallel lanes | text, Tools | English, source and scan lanes; one button cycles English, source, Both; Both = aligned rows, default 0.44/0.56, draggable gap; stacked on phone with lane labels; one English text only | paired paragraphs | open | No | MUST P1: our core, RO/EN/original with exact 1:1 alignment by `sourceId` |
| RD-27 | Source switcher | Tools | Greek, Latin, Greek and Latin | - | open | No | SKIP (Migne-specific) |
| RD-28 | Lane sizes and split | Aa | Source and English size sliders 70-150 %; drag the gap, double-click resets | - | open | No | MUST P1 for the balance slider; sizes SHOULD P2 |
| RD-29 | Scan pane | Tools | Facsimile column with prev/next, zoom, fill, lightbox, resizer, phone swipe | page images | acct | No | LATER P3 (we hold the source PDFs) |
| RD-30 | Scripture references | text | Parser links unambiguous citations (abbreviations, ranges, continuations); hover/focus/click opens a 460 px preview with verse text and links "Open Bible chapter" and "Find chapter commentaries"; bottom sheet at 700 px | parser, Bible text | open | Rule | MUST P1: detection and styling, no link until a text exists; SHOULD P2: preview |
| RD-31 | Cross-work citation links | text | A cited work or author is marked; click opens a page window (cited page, one before, one after, language toggle) | resolved citations | open | LLM-pre | LATER P3 |
| RD-32 | Footnote markers and banks | text, Aa | Superscript markers with a 470 px preview and "Show in page"; per-folio banks; On demand / Show all | notes with markers | open | No | SHOULD P2 (needs inline markers in the content model) |
| RD-33 | Apparatus and editorial notes | Migne works | Source-lane note banks; "Hide editorial notes" | notes | open | No | SKIP (Migne-specific) |
| RD-34 | Margin notes | works with marginalia | Notes in side rails, or an inline marker opening a popover | marginalia | open | No | LATER P3 |
| RD-35 | Highlights | selection bar | Five colours (amber, sage, slate, rose, lilac), stored locally with colour, range and citation; Remove | local state | open | No | MUST P1 as paragraph-level highlights; range highlights on web SHOULD P2 |
| RD-36 | Copy and Link | selection bar, rail | Copy = words, blank line, citation, URL; Link = exact block URL | - | open | No | MUST P1 |
| RD-37 | Define | selection bar | Single word opens the Lexicon | lexicon | acct | LLM-pre | LATER P3 |
| RD-38 | Note, Save, Image, Ask, More | selection bar | Notebook note; clip; quote-image maker (five sizes, PNG); discuss the passage in Ask; research menu | notebook, Ask | acct | LLM (Ask) | Ask MUST P1; Note and Save SHOULD P2; Image LATER P4 |
| RD-39 | Paragraph rail | text, pointer devices | Hover shows link and copy buttons 30 px left of the text | - | open | No | MUST P1 (web hover rail; native long-press sheet) |
| RD-40 | Find in text | toolbar, `/`, Ctrl+K | Count ("1 of 27"), prev/next, Esc; marks hits; loaded text only; `&hl=` opens it | - | open | No | MUST P1 (whole edition, local) |
| RD-41 | Search whole work | find bar | Server search across the work | search API | acct | No | SKIP: the whole edition is local, so this is free |
| RD-42 | Typography panel `Aa` | toolbar | Reading aids, footnotes mode, font (Serif, Sans, Legible), spacing (3), text size 14-34, lane sizes, scan zoom; applies live and persists | - | open | No | MUST P1 |
| RD-43 | Theme toggle | Tools | Cycles Light, Sepia, Dark; follows the OS until chosen | - | open | No | MUST P1 |
| RD-44 | Modernize | Aa | Rule-based spelling and verb-ending update for early modern English; reversible; never touches the source lane | word list | acct | Rule | LATER P4: needs a Romanian pre-1993 orthography equivalent (architecture) |
| RD-45 | Split paragraphs | Aa | Long paragraphs shown in about 450-character pieces | - | open | No | LATER |
| RD-46 | Tools drawer | toolbar | Language, source, scan, flow/pages, fold all, hide notes, theme, copy link, bookmark, report, hide toolbar, top, research, ask; overflows on works with many buttons | - | mixed | No | MUST P1 (our set; no overflow) |
| RD-47 | Phone shell | phone | Thumb bar (Contents, Search, Text, Tools), Tools as a horizontal strip of 60-90 px cells, bottom sheets at 700 px, contents drawer | - | open | No | MUST P1 |
| RD-48 | Keyboard shortcuts | web | Arrows, `[` `]`, `/` and Ctrl/Cmd+K, Enter/Shift+Enter, `?`, `r`, `w`, Esc (closes the topmost layer) | - | open | No | MUST P1 (web) |
| RD-49 | Copy link and citation format | Tools | Copies `?w=&p=`; citation is "Author, Title, volume, section." plus the block URL | - | open | No | MUST P1 (our format uses stable paragraph ids) |
| RD-50 | Bookmark a work | Tools | Toggle; optimistic with rollback; per member on the server | - | acct | No | MUST P1 local; SHOULD P2 synced |
| RD-51 | Research panel | right drawer | Tabs Work, Search, Passage, Saved, Ask; settings and exports | mixed | acct | mixed | SHOULD P2-P3 piece by piece (Saved and docked Ask P2) |
| RD-52 | Related passages | `r` key | Passages that say the same elsewhere in the library | embeddings | acct | Emb | SHOULD P3 |
| RD-53 | Hypothes.is annotations | Research panel | Opt-in public annotation layer | third party | acct | No | SKIP |
| RD-54 | Reading-place saves | Research panel | Explicit save of the visible position into a notebook | notebook | acct | No | SHOULD P2 |
| RD-55 | Embedded reader | Ask source pane, Desk | Reader inside an iframe with chrome removed; reports its scroll place | - | open | No | MUST P1 as a component (no iframe) |
| RD-56 | Persisted reader state | local storage | Last place, theme, font, spacing, sizes, lanes, flow, footnotes, split, toolbar hidden, highlights | - | open | No | MUST P1 (settings store) |

### 3.6 Transparency and trust (TR)

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| TR-01 | Transparency button | toolbar, phone Tools | Label is "AI Transparency" for machine translations, "Transparency" otherwise; opens a dialog | status | open | No | MUST P1 |
| TR-02 | Transparency dialog | reader | 560 px dialog below the toolbar: facts line, lead note by provenance kind, review row, reported issues, corrections, report button, policy link | status | open | No | MUST P1: richer than the reference (see ui-spec 8.6) |
| TR-03 | Provenance variants | dialog | AI translation (names the source language), human translation (credit or "name not recorded"), written in English, original only, unknown, EEBO transcription | provenance kind | open | No | MUST P1 |
| TR-04 | Review state | dialog | Pill NEEDS REVIEW or REVIEWED with date; committee wording for AI, editor wording otherwise; reviewer stored but never shown | review record | open | No | MUST P1 |
| TR-05 | Reported issues | dialog | "No issues reported yet" or "N open, M settled" | reports | open | No | SHOULD P2 (needs a server) |
| TR-06 | Corrections | dialog | Dated entries, newest first, five per page | revisions | open | No | MUST P1 (from signed pack revisions) |
| TR-07 | Report a problem | dialog, selection bar, toolbar | Form with passage prefill; the toolbar button is gated, the dialog's is not | reports inbox | open / acct | No | P1: a mail link with the citation; P2: a form |
| TR-08 | Policy page | `/transparency/` | Eight commitments: label before the text, original beside the translation, Modernize is not AI, anyone can report, reports counted in public, corrections dated, a committee is formed, every work says Reviewed or Needs review | policy | open | No | MUST P1: our own policy |
| TR-09 | Registry of machine-translated works | `/transparency/` | Closed disclosure listing every machine-translated work (14,811), 50 at a time | registry | open | No | SHOULD P3 (P1: the list is short and printed in full) |
| TR-10 | Changelog and open reports | About tab | 161 changes, 37 open reports; badges STAFF, REPORTED, FEATURE; sort; thumbs counts | forms backend | open | No | SHOULD P3 |
| TR-11 | Most read works | About tab | Monthly list of 150, paged | telemetry | open | No | LATER P4 |
| TR-12 | Machine-text labelling pattern | everywhere | Plain notes such as "Gathered by machine", "AI-assisted: answers cite the library's pages", "Software reads each answer from the author's pages", "a profile match is never a citation" | - | open | No | MUST P1 |

### 3.7 Scripture and the Verse Desk (SC)

Scripture is the second pillar of the reference: a per-verse citation index over the whole library, shown through
many views. In the reference it is behind the blocking overlay; the Verse Desk is open.

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| SC-01 | Chapter reader | `/scripture/` | 66 canon books and 7 deuterocanonical; one template for 31,102 verses; verse text in one of four translations | Bible text | overlay | No | SHOULD P2: needs licensed or public-domain texts per language |
| SC-02 | Controls | bar | Division tabs (manual activation), Book, Chapter, Translation selects; previous/next chain Genesis to Revelation (Apocrypha separate) | canon table | overlay | No | SHOULD P2 |
| SC-03 | Four translations | bar | ESV, CSB, KJV, NASB with remembered choice and `&t=`; NIV withdrawn on 7 October 2026 for licensing; text from a third-party API | Bible text | overlay | No | SHOULD P2: self-hosted texts with a licence record per translation |
| SC-04 | Reference parser and legacy forwarding | reader | Accepts how people type references, SBL and Vulgate abbreviations; forwards old addresses | parser | open | Rule | SHOULD P2 (RO and EN grammar in `packages/shared`) |
| SC-05 | Verse as button | text | Click opens the panel and writes the verse to the URL; click again closes; Esc closes | - | overlay | No | SHOULD P2 |
| SC-06 | Commentary pane | right rail | Tabs Commentary, Citations, Reception, Hymns and a Verse Desk button; follows the reader | mixed | overlay | mixed | SHOULD P2 (Citations only), rest P3 |
| SC-07 | "Follow the text" | pane | One commentator whose note follows the verse on the reading line (22-32 % of the viewport); click pins; Previous/Next page | commentary map | overlay | No | LATER P3 (needs commentaries mapped to verses) |
| SC-08 | Key commentators and directory | pane | Curated pills (on the book, whole Bible) and a directory by tradition, author, work with find box | rank file | overlay | No | LATER P3 |
| SC-09 | Commentary language toggle | pane | English / Latin switch, remembered | paired text | overlay | No | LATER P3 (RO / EN / original) |
| SC-10 | Creed proof-texts | pane, desk | Creeds that print the verse as a proof text, with the words each stands behind, linked into the document (321 documents, 20,288 citations) | proof-text index | overlay | No | SHOULD P3 (needs creeds with structured articles) |
| SC-11 | Citations view | pane, desk | Headline count; tradition, author, century filters; text search; five most-cited sources with inline Preview and "Keep reading here" | verse citation index | overlay | No | SHOULD P2: the list of paragraphs of our library that cite the verse |
| SC-12 | Reception view | pane | Counts, century strip, commentaries with a note, witnesses by period ranked by standing, never by count | reception index | overlay | LLM-pre | LATER P3 |
| SC-13 | Hymns view | pane | Hymns whose headings name the chapter | hymn index | overlay | No | SKIP: no hymn corpus |
| SC-14 | Commentaries panel | bar | Tradition and author filters; folds: on the book, whole Bible, cited elsewhere, other works; Preview | commentary map | overlay | No | LATER P3 |
| SC-15 | Chapter overview | rail, no verse open | Citation stats, "x of y verses cited", most-cited verses with bars | verse counts | overlay | Rule | SHOULD P2 |
| SC-16 | Layout modes | view bar, 900 px up | 50/50, 40/60, 60/40, Scripture only, Panel only; "Show panel" hint | - | overlay | No | LATER P3 |
| SC-17 | Dark mode of the working surface | view bar | Own toggle, follows reader theme and OS | - | overlay | No | MUST P1: a global theme |
| SC-18 | Phone layout | reader on phone | Panel and pane open inline after the verse's paragraph as accordion rows; no layout buttons | - | overlay | No | SHOULD P2 |
| SC-19 | Scripture tour | `?tour=scripture` | 27 steps across reader and desk; several stale on desktop | - | open | No | SHOULD P3 |
| SC-20 | Desk head | Verse Desk | Verse in four translations, century ruler of works citing it, four stat tiles, a lede composed from the counts | verse index | open | Rule | SHOULD P3 |
| SC-21 | Key voices | desk | Six authors, oldest first, portrait, machine gist, link to the page | rank, gists | open | LLM-pre | LATER P3 |
| SC-22 | How the church read it; Points in dispute | desk | Leading reading per age (needs five placed pages); questions with competing positions, counts of pages and authors, no names | readings | open | LLM-pre | LATER P3 |
| SC-23 | Who confesses it | desk | Creeds citing the verse grouped by tradition, linked to the paragraph | proof-text index | open | No | SHOULD P3 |
| SC-24 | Commentary ladder | desk | Seven age cards with three exemplar commentators each | commentary map | open | No | LATER P3 |
| SC-25 | Chapter heat | desk | One bar per verse sized by works citing it; each a link; most cited verses | verse counts | open | Rule | SHOULD P3 |
| SC-26 | Share this verse | desk | "Copy link to this verse" | - | open | No | SHOULD P2 |
| SC-27 | Desk citations and commentaries | desk | Two bar charts (century, tradition), filters, kind chips (Quotes, Cites, Alludes, Expounds), author cards, pagination (250 per load), commentary rows with Preview | verse index | open | No | SHOULD P3 |
| SC-28 | Similar passages | desk | Read with; similar Scripture use (shared pages); similar wording (meaning search) | co-citation, embeddings | open / member | Emb | SHOULD P3 |
| SC-29 | Ask about this verse | desk | Question box that opens Ask | Ask | member | LLM | SHOULD P2 (hand-off to Ask with the reference attached) |
| SC-30 | Essays on the verse | desk | Publisher essays about the verse then its chapter | essay index | open | No | SKIP |
| SC-31 | Desk navigation | desk | Previous/Next verse, Back to chapter, 12 "on this page" anchors | - | open | No | SHOULD P3 |
| SC-32 | Scripture text sourcing | data | Third-party text API; deuterocanon is Douay-Rheims from the library's own index; verses numbered as the ASV (Psalm superscriptions differ) | Bible text | - | No | SHOULD P2: own hosting and an explicit versification map (Romanian Psalms follow another count) |

### 3.8 Topics and doctrines (TP)

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| TP-01 | Topics contents | `/topics/` | Find box with aliases; three columns of ten numbered parts, 45 topics (36 top-level, 9 narrower); order is an editorial decision | loci file | overlay | No | SHOULD P3: our own taxonomy (decision OQ-6) |
| TP-02 | Topic head | `/topics/?t=` | Path, name, sentence, four computed counts (articles, works, authors, verses) as anchors, jump nav | counts | overlay | Rule | SHOULD P3 |
| TP-03 | "About" tabs | topic page | History (default), Scripture, A course of reading, Traditions compared, Concept guides | topic enrichment | overlay | LLM-pre | SHOULD P3 |
| TP-04 | Through-time ruler | topic page | Stacked bars per century in shelf colours, square-root scaled, five tinted ages, creed chips | century counts | overlay | Rule | SHOULD P3 |
| TP-05 | How each tradition treats it | topic page | One card per tradition with verbatim excerpts and key works; says plainly when a tradition has none | documents | overlay | No | SHOULD P3 |
| TP-06 | Classic treatments | topic page | Standard works section by section, grouped by shelf | treatments | overlay | LLM-pre | LATER |
| TP-07 | Key verses | topic page | Nine verse cards with the share of the verse's citing that falls under the topic | verse index | overlay | Rule | SHOULD P3 |
| TP-08 | People | topic page | Twelve voices by birth, with portraits and pages indexed | authors | overlay | Rule | LATER |
| TP-09 | Reading path | topic page | "Start here" (short statements) and "Go deeper" (treatments) | documents | overlay | Rule | SHOULD P3 |
| TP-10 | Related topics | topic page | Chips by shared proof-texts | co-citation | overlay | Rule | LATER |
| TP-11 | Two tabbed blocks | topic page | Creeds and works, each with tabs Read, Compare, Trace, Scripture and tradition chips | documents | overlay | No | LATER |
| TP-12 | Every doctrine | `/doctrines/` | 198 ranked mined topics with filter; detail with ranked authors, sampled positions with stance labels, Positions band (writer, group by, find a phrase) | mined positions | open | LLM-pre | LATER P3 (needs mined positions) |
| TP-13 | Topics tour | `?tour=topics` | 12 steps; one still points at a sidebar that no longer exists | - | open | No | SHOULD P3 |

### 3.9 Search (SR)

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| SR-01 | Search page with four modes | `/search/` | Works (title or author), Passages (words in the texts), Scripture (a verse), Ask (a question); shelf select; filters and order; compact density | indexes | srv | mixed | P1 basic local search (exists); P2 the four modes |
| SR-02 | Exact words vs By idea | Passages mode | Exact matches wording; By idea finds passages that say the same thing in other words | word index, embeddings | srv | Emb | SHOULD P2 |
| SR-03 | Power Search | desk tab | Describe an idea; results grouped by work (25 per page) with expandable passages; scope and facet filters | embeddings | acct | Emb | SHOULD P2 |
| SR-04 | Library search from Browse | `/curated/` | Hero search box posting to the search page | - | open | No | MUST P1 (searches by name locally) |
| SR-05 | Author-scoped search | author room | Word-index counts per word form, recorded statements, indexed passages, works; "Ask" button | word index | open | Rule | LATER P3 |
| SR-06 | Search by Scripture reference | Search | Matches the verse or range | verse index | srv | No | SHOULD P2 (the gateway already boosts references) |
| SR-07 | Find in text | reader | See RD-40 | - | open | No | MUST P1 |

### 3.10 Ask: the AI question-and-answer workspace (AK)

Ask is a full workspace, not a chat box: answers are written from the library only, every claim is a chip that
opens the book at the quoted sentence, and each answer is checked against the pages it cites. The engine is
vendored from the corpus owner's own site and configured by a client config object.

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| AK-01 | Ask workspace | `/ask/`, overlay on any page | Fixed full-screen layer: sidebar 272 px, chat column (measure 760 px), optional source pane; light/dark/sepia | Ask worker | acct (srv) | LLM | MUST P1: our page on our gateway, open during the beta |
| AK-02 | Doors into Ask | rail, hub row, reader Tools, selection bar, shelf pages, author-room search, `?ask=`, Ctrl/Cmd+Shift+A | Opens Ask, optionally scoped to a work, shelf, author or passage | route state | acct | LLM | MUST P1: rail, landing, work hub, paragraph action; the rest P2 |
| AK-03 | Docked mode beside the book | reader, 1100 px up | Panel docked to the right; citations navigate the book itself; below 1100 px a full-screen dialog | - | acct | LLM | SHOULD P2 |
| AK-04 | Conversation sidebar | Ask | New conversation, search, list (title, state or date), folders (collapsible), archive toggle, "Delete all archived", links to Collections and Desk | local store | acct | No | SHOULD P2 (list and delete P1-light) |
| AK-05 | Header and options menu | Ask | Title, context line ("Whole library" or scope), state pill, theme, "..." menu: rename, download Markdown, move to folder, archive, delete, connect an agent | local store | acct | No | P1: title and new; P2: the menu |
| AK-06 | Welcome state | Ask | "Ask the Library" with four suggestion groups (Explore a doctrine, Trace an idea, Find a reading path, Understand a passage), one random prompt each; in-book and narrowed variants; a click fills the composer, never sends | prompt lists | acct | No | MUST P1: our prompts, each tested to return sources on the installed library |
| AK-07 | Composer | Ask | Label "Your question", textarea (auto-grows to 170 px), mode toggle, scope toggle, send or stop; Enter sends, Shift+Enter newline, Enter never sends on coarse pointers; draft autosave | - | acct | No | MUST P1 |
| AK-08 | Quick Ask mode | composer | Streamed concise answer; client abort at 330 s; may be escalated automatically | Ask API | acct | LLM | MUST P1 |
| AK-09 | Deep research mode | composer | Durable server job (up to 10 minutes per run, pause, continue, retry), progress polling every 5 s, report and evidence downloads | job store | acct | LLM | LATER P3 |
| AK-10 | Turn anatomy | Ask | Question bubble; mode line; progress (stage, elapsed time, "found so far" chips); answer with "Top" and section jump card; Markdown body (headings, lists, blockquotes, tables, diagrams); extras; actions | stream | acct | LLM | MUST P1: our subset |
| AK-11 | Citation chips with hover preview | answers | Chip after the sentence ("p. 384"); hover or focus opens the exact paragraph with the quoted words marked and the source-language paragraph beside it; touch keeps the link | page text | acct | No | MUST P1: RO and EN side by side |
| AK-12 | Chip link target | answers | Opens the reader at the quoted sentence (`?w=&hl=#b<page>`); variants: page not among those sent, "Unverified reference" | - | acct | No | MUST P1 (paragraph id plus highlight) |
| AK-13 | Check line | under answers | "Checked against the pages: N of M cited statements supported, K in part, N quotations verified word for word, N unsupported citations removed"; in-place "in part" and "unconfirmed" badges | server checks | acct | LLM | SHOULD P2: a support check pass; P1 shows the quotation check |
| AK-14 | Notices | under answers | Unverified-quotation notice; "Gaps in the evidence"; coverage line ("scan capped, not complete coverage"); research activity log; research context (topic loci) | stream | acct | LLM | MUST P1: the quotation notice; the rest P2-P3 |
| AK-15 | Receipts and all sources | under answers | First three works the answer actually cites, in citation order; "All sources: N passages, M works, K cited" grouped by work with passage cards and "Read here" | sources | acct | No | MUST P1 |
| AK-16 | Source pane | Ask | The real reader beside the conversation; resizable 28-76 % (default 53), history-aware; phone: tabs "Conversation / Read source" | reader | acct | No | MUST P1 |
| AK-17 | Scope: "Search within" | composer | Shelves, English groups, authors, works, "use the work I am reading", "include my notebook"; compiled to work slugs; validation errors | catalogue | acct | No | P1: one work or the whole library; P2: shelves, authors; notebook P3 |
| AK-18 | Conversation storage | Ask | IndexedDB, mirror of the last 40 in local storage, tab sync, tombstones, recovery of interrupted streams | local store | acct | No | P1: simple local store; P2: hardened (or server side) |
| AK-19 | Folders, archive, delete, rename, Markdown download | Ask | Named folders (60 characters), archive hides from list and palette | local store | acct | No | SHOULD P2 |
| AK-20 | Usage meter | composer foot | "N of CAP used" or "N this month, library P %"; hidden when unknown | usage API | acct | No | SHOULD P2 (accounts); hide when unknown |
| AK-21 | Completion notifications | sidebar | In-site toasts, live region, opt-in OS notification when the tab is hidden | - | acct | No | LATER |
| AK-22 | Share an answer | answer actions | Public noindex page with the question, answer and sources, with a "shared by a reader, not reviewed" note | share store | create acct, read open | No | SHOULD P2 |
| AK-23 | Save to notebook, Insert in Desk, Copy answer | answer actions | Saves question, answer and sources as a notebook note | notebook | acct | No | Copy MUST P1; Save SHOULD P2; Desk LATER |
| AK-24 | Connect an AI agent | "..." menu | Personal key and connector URL so Claude or ChatGPT can use the library's tools; hourly rate | MCP | acct | LLM | LATER P5 |
| AK-25 | "Use my ChatGPT" | sidebar | Device-code link to the reader's own plan; fallback to the library's models | BYO | acct | LLM | SKIP: our cost model is our own |
| AK-26 | Command palette | Ask | Ctrl/Cmd+K: conversations and actions (new, search within, mode, browse, library) | local store | acct | No | SHOULD P2 |
| AK-27 | Selected-passage questions | reader | Quoted passage attached to the question; book-bound conversations; starters from the work's own index | index | acct | LLM | P1: paragraph to Ask; P2: starters |
| AK-28 | Out-of-scope refusal and error copy | Ask | Polite refusal for unrelated questions; busy, expired-session, interrupted, stopped, timeout states; retry | - | acct | LLM | MUST P1 |
| AK-29 | Stream contract | worker | Newline-delimited JSON: progress (message, works found), delta, result (sources, unverified, check), error; deep jobs add plan, step, report | - | acct | LLM | P1: our SSE contract (`sources`, `delta`, `citation`, `done`, `error`) |
| AK-30 | Trust labelling | Ask | "AI-assisted: answers cite the library's pages"; shared answers say they are not reviewed; quotation not found is called out, never silently kept | - | acct | No | MUST P1 |
| AK-31 | Limits | worker | Per-member monthly cap plus a global daily spend budget that blocks everyone when spent; errors name the cause | budget | acct | No | SHOULD P2 (money budgets per user, per the architecture); P1: per-IP limit and a spend limit |

### 3.11 Other research tools (RS)

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| RS-01 | Research hub page | `/research/` | Five groups (Search and ask; Read with the commentators; Look things up; Compare and connect; Keep your work) with one-line promises and Open buttons; becomes the desk when signed in | tool list | open (tools acct) | No | SHOULD P2: when at least four tools are live |
| RS-02 | Research desk | `/research/#<tab>` | Seven hash tabs (Ask, Power Search, Compare, Bookmarks, Notebook, Connections, Desk); each keeps its place | - | acct | No | LATER P3 |
| RS-03 | Compare desk | `/compare/`, desk tab | Two to four authors, one topic, columns by work, date-ordered, each statement with a quote block, provenance line and an "INDEX NOTE" gloss | positions per author | acct | LLM-pre | SHOULD P3 (needs mined positions) |
| RS-04 | Topic picker with stance bars | Compare | Per-author bars (asserts, denies, reports, qualifies), order by loci, most statements or most denial | positions | acct | LLM-pre | SHOULD P3 |
| RS-05 | Views and filters | Compare | Side by side or "Where they meet" (any, opposite or both assert); works order; stance; phrase filter | positions | acct | No | SHOULD P3 |
| RS-06 | Streaming of full statement lists | Compare | Each column streams its complete list with progress text; queue of two requests | evidence API | acct | No | SHOULD P3 |
| RS-07 | Saved views, export to Desk, suggested pairs, pair page | Compare | Local saved views; six suggested comparisons; citations both ways between two authors | - | acct | No | LATER P3 |
| RS-08 | Connections map | `/connections/` | Authors as points, citations as lines; Timeline, Rings, Tradition layouts; zoom; period colours; filters (shelf, period, years, network prominence); phone list/map switch | citation graph | acct | LLM-pre | LATER P3-P5: needs breadth of content |
| RS-09 | Author panel | Connections | Cited by N authors, cites, counts, "contested %", evidence per link, filter field | graph | acct | LLM-pre | LATER |
| RS-10 | Paths, Topics, Scripture views | Connections | Chain of citations between two authors; who wrote on a doctrine or a passage | graph | acct | LLM-pre | LATER |
| RS-11 | Connected topics (author room) | author room | Topic pairs with shared pages and shared passages ("a profile match is never a citation") | mined | open | LLM-pre | LATER P3 |
| RS-12 | Notebook | desk tab, `/pins/` | Collections of entries (cite line, work and date, quote with a left rule, your note, Open, Copy citation, two-step Remove), Recent / By work, filter | local store, sync | acct | No | SHOULD P2 |
| RS-13 | Item kinds | notebook | Work reference, passage reference, note, Ask answer, reading place, quote image, analysis record | - | acct | No | SHOULD P2 (subset) |
| RS-14 | Typed relations and constellation | `/pins/` | Link two entries with supports, contests, cites, expands, parallels; SVG graph | - | acct | No | LATER |
| RS-15 | Share a collection | `/pins/` | Link carrying the collection (up to 8,000 characters) or a downloaded file | - | acct | No | LATER |
| RS-16 | Exports | reader panel | Notebook, page range or whole work as Markdown; copy English / source column | - | acct | No | SHOULD P2 (Markdown export of the notebook) |
| RS-17 | Bookmarks | desk tab | Per-member list of works (Recent, Author, Collection), reading places, Remove (two-step), optimistic toggle; shares a store with the publisher's essay bookmarks | member store | acct | No | MUST P1 local; SHOULD P2 synced |
| RS-18 | Desk | `/desk/` | Write and Research modes, paper picker, notebook picker, editor, rail of kept material (four tabs), source preview split, word count, save state | local store | acct | No | LATER P3-P4 |
| RS-19 | Insert into Desk | Ask, Compare, notebook | Hands an answer or a comparison to a new paper with citations kept | - | acct | No | LATER |
| RS-20 | Local-first storage with account sync hooks | all tools | State lives in the browser; sync functions are attached by the host layer | - | acct | No | MUST P1 local; SHOULD P2 sync through Supabase |
| RS-21 | Commentary Decks | `/commentary-decks/` | Eight decks (Lombard, Aquinas, Suarez, Voetius, Vitringa, Quenstedt, Decretals, Gratian); text pane beside any commentator; Swap, Clear, Copy link, English/Latin/Both | commentary map | acct | No | LATER |
| RS-22 | Disputed Questions | `/disputed-questions/` | A chart of how authors answered a question by century | mined | acct | LLM-pre | LATER |
| RS-23 | Set Indexes | `/set-index/` | One index for a whole set of volumes | indexes | acct | No | LATER |
| RS-24 | Page Scans | `/scans/` | Works beside the printed page | page images | acct | No | LATER P3 |
| RS-25 | Work guide folds | reader panel, hub | Fourteen sections mirrored between the Work tab and the hub | enrichment | acct | LLM-pre | SHOULD P3 |
| RS-26 | Published work analysis | reader panel | Page summaries, positions, authorities, Scripture references, questions, terms, replies; Read source, Save record, Discuss record | units file | acct | LLM-pre | SHOULD P3 |
| RS-27 | Quote image maker | selection bar, panel | PNG in five sizes with author, citation and template | - | acct | No | LATER P4 |
| RS-28 | Related works | panel | Hidden in the reference ("the feature does not exist") | - | - | - | SKIP |

### 3.12 Lexicon (LX)

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| LX-01 | Lexicon search | `/lexicon/?q=` | English, Latin or Greek terms; results show Latin and Greek forms and the number of defining works; cap "200 or more" | term records | srv | LLM-pre | LATER P3 |
| LX-02 | Lexicon entry | `/lexicon/#term` | Latin and Greek form lists with "and N more", numbered senses (one-sentence definitions), "Defined by" rows with author, work and "Open p. N" | term records | srv | LLM-pre | LATER P3 |

### 3.13 About, help and tours (AB)

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| AB-01 | About TFR | `/manifesto/` | Six hash tabs: What/Why/How, Story, Mere Orthodoxy and TFR (FAQ), Transparency commitment, Changelog, Most read | copy | open | No | MUST P1: a short "About" with method and transparency; the rest later |
| AB-02 | Tutorial hub | `/tutorial/` | Six numbered cards (Reading a work 35 steps, Scripture 27, Topics 12, Search 5, Research tools 18, Connections 14) with Start, Take again, done ticks; explainer of the shelves | tour state | open | No | SHOULD P3 |
| AB-03 | Guided-tour engine | `?tour=` | Dims the page, spotlight box, card (step n of m, Members pill, example box, Skip, Back, Next), arrow keys, waits up to 20 s for targets; gates lifted | tour definitions | open | No | SHOULD P3 |
| AB-04 | How to use | `/how-to-use/` | Tabs Laity, Pastors, Academics; 34 task cards with a screenshot, a note ("Needs a free account", "AI-assisted") and a Try it link | screenshots | open | No | SHOULD P2: ours, with real screenshots of our app |
| AB-05 | Contributor cards and origin essays | About tabs | Photos, bios, essays by the project's authors | - | open | No | SKIP (their people); we write our own About |
| AB-06 | Feedback and changelog entry points | About | See SH-11, TR-10 | - | open | No | per those rows |

### 3.14 Accounts and access (AC)

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| AC-01 | Free account | gates, landing | Passwordless: first name, last name, e-mail; a sign-in link by e-mail; redirect back to the tool; "check your inbox" state; validation messages | Ghost Members | open | No | SHOULD P2: Supabase Auth with e-mail codes on mobile, magic link on web |
| AC-02 | Sign-in portal | header, footer | Ghost Portal modal (480 px) and full-screen sheet on phone; sign-up with tiers Free preview and Membership | Ghost | open | No | SKIP: our own screens |
| AC-03 | Member status and the beta flag | all gates | `anonymous`, `free`, `paid`, `comped`; one flag turns research gates from subscriber to member | entitlements | - | No | SHOULD P2 (account state), P4 (entitlements table) |
| AC-04 | Member tagging and daily usage event | research pages | E-mail platform tags once; one usage event per Central-time day | kit worker | acct | No | SKIP: PostHog with consent later |
| AC-05 | Bot check on forms | gates, report | Cloudflare Turnstile | - | open | No | LATER (forms) |
| AC-06 | Sync of local state to the account | all tools | Hooks for chats, pins, collections, highlights, notes, deletions, last-read | member store | acct | No | SHOULD P2 |
| AC-07 | Public shared answers | `/ask/?share=` | The only Ask surface that renders for anonymous visitors | share store | open | No | SHOULD P2 |

### 3.15 Pricing and membership (PR)

All prices USD; payment by Stripe in the reference. Our architecture uses RevenueCat for the stores and Paddle on
the web (`docs/arhitectura-app-biblica.md`, section 8); everything here is LATER (P4 and after).

| ID | Feature | Where | What it does | Data | Gate | AI | Priority for us |
|---|---|---|---|---|---|---|---|
| PR-01 | Plan block | landing, `/membership/` | Billing toggle Annual (save 17 %) / Monthly; Member USD 100 a year or USD 10 a month; whole card is a click target | tiers | open | No | LATER P4: our own plans (RON) |
| PR-02 | Lifetime membership | same | USD 995 one time, with a book and two gift memberships | tiers | open | No | LATER: decision OQ-11 |
| PR-03 | Gift memberships | `/give/` | From USD 10 for one, three, six or twelve months; never renews; claimed by e-mail; unclaimed gifts expire after a year | gift store | open | No | LATER P4+ (store gift SKUs) |
| PR-04 | Group seats | `/groups/` | USD 80 per seat, five to ten seats, live total | - | open | No | LATER P5 |
| PR-05 | Organisational access | `/institutions/` | USD 2,500 a year, access by e-mail domain | - | open | No | LATER P5 |
| PR-06 | Student membership | `/student/` | Print plus digital USD 50 or digital USD 20; school-e-mail confirmation | - | open | No | LATER |
| PR-07 | One-time donation | landing | External donation page | - | open | No | LATER P4 |
| PR-08 | Membership page | `/membership/` | Story hero, plan block, "other memberships", testimonial band, "what you're supporting" | copy | open | No | LATER P4 |
| PR-09 | Free vs Member comparison copy | landing | Free: read everything; Member: research tools after the beta, print journal | copy | open | No | LATER P4 |
| PR-10 | Checkout flows | Stripe, Portal | Stripe Checkout and Portal for the recurring plan | payments | open | No | SKIP: RevenueCat and Paddle |

**Counts by priority** (generated from the tables above; SHOULD includes the "P1 and P2" split rows under their
dominant priority):

COUNTS_PLACEHOLDER
