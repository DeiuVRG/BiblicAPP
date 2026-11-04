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
| RD-01 | Reader shell | `/read/?w=` | Fixed bars, 300 px outline column, one scroller holding the whole work (continuous flow); 3 px progress bar fixed to the bottom; skip link "Skip to the text" | work JSON | open | No | MUST P1 (one chapter per screen, as in our app today; continuous flow SHOULD P2) |
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
| RD-22 | Fold cards, Collapse all / Expand all | text, Tools | A fold toggle per card; folds every section | - | open | No | SHOULD P2: meaningful once several chapters share one scroll (continuous flow); P1 cards are not collapsible |
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

**Counts by priority** (generated from the tables above by counting rows; a row that names two priorities, for example "P1 local, P2 synced", counts under the first one named; "SHOULD" covers Phases 2 and 3):

| Area | Features | MUST (P1) | SHOULD (P2-P3) | LATER | SKIP |
|---|---|---|---|---|---|
| SH: Shell and chrome | 22 | 8 | 3 | 5 | 6 |
| LP: Landing | 13 | 8 | 2 | 2 | 1 |
| LB: Library, authors, traditions, reference works | 20 | 9 | 5 | 4 | 2 |
| WK: Work hub | 15 | 5 | 4 | 5 | 1 |
| RD: Reader | 56 | 34 | 9 | 7 | 6 |
| TR: Transparency and trust | 12 | 8 | 3 | 1 | 0 |
| SC: Scripture and Verse Desk | 32 | 1 | 20 | 9 | 2 |
| TP: Topics and doctrines | 13 | 0 | 8 | 5 | 0 |
| SR: Search | 6 | 2 | 3 | 1 | 0 |
| AK: Ask | 31 | 19 | 8 | 3 | 1 |
| RS: Other research tools | 28 | 2 | 10 | 15 | 1 |
| LX: Lexicon | 2 | 0 | 0 | 2 | 0 |
| AB: About, help, tours | 5 | 1 | 3 | 0 | 1 |
| AC: Accounts and access | 7 | 0 | 4 | 1 | 2 |
| PR: Pricing and membership | 10 | 0 | 0 | 9 | 1 |
| **Total** | **272** | **97** | **82** | **69** | **24** |

---

## 4. Page anatomies

Measurements are at 1366x900 (D) and 390x844 (P) unless stated. "Band" means a full-width section with a centred
container of 1,124 px (side gutters 20 px on P). Colour names refer to the tokens in section 5.

### 4.1 Landing (`/the-faith-received/`)

**Purpose.** Marketing and entry page for signed-out visitors: say what the library is, show named works before
any count, show the shelves, list every feature, explain free versus member, capture a free account, sell
membership. One scrolling page, 10,002 px tall (D) and 18,753 px (P); no local state; everything dynamic is the
live counts and the plan toggle.

| # | Band | Height D / P | Background | Content |
|---|---|---|---|---|
| 1 | Hero | 698 / 710 | dusk photograph of a spired town under a dark gradient (`#2d2927b8` to `#2d2927f0`) | kicker (pulsing pilcrow, "THE FAITH RECEIVED", BETA pill); H1 52/56 px (P 28.9/32.3) in IM Fell, two lines, line two highlighted by a 78 % terracotta bar sweeping in over 0.55 s after 0.25 s; sub 17/27.2 px, white 84 %, 527 px wide; two buttons (solid orange, ghost) and two underlined links |
| 2 | "Where to start" | 316 / 710 | page | four doors, H3 28 px, paragraph 15 px muted, "NAME arrow" link 12 px caps; 4 columns above 1000 px, 2 from 641, 1 below with hairlines |
| 3 | Free / Member + account form | 523 / 1196 | page | two-column table with top and bottom hairlines; sign-up form grid 500 + 600 px; beta note |
| 4 | Devotional split | 788 / 939 | cream | framed painting (3 px dark border) and kicker, H2 38 px, paragraph, outline button |
| 5 | Stats and "Who it is for" | 687 / 1061 | dark painting under a 78-86 % scrim | four stats (numeral 46 px, caption 11 px caps; P 2x2); H2 40 px; three columns (H3 24 px) |
| 6 | "In the collection" | 1050 / 1779 | page, top hairline | grid of twelve cards (270 px cells, 14 px gap; 2 columns at 1100, 1 at 600); card: white, 1 px border, 3 px radius, date line 11 px caps orange, era line, title 19/700, description 14 px (hidden on P), READ arrow; hover: border terracotta, arrow +3 px |
| 7 | "Study" | 594 / 1544 | dark `#2d2927` | two cream-framed facsimile plates; kicker, H2, text, outline button |
| 8 | "The shelves" | 1207 / 4495 | page | eleven cards, 5 per row (cell 210, gap 24/18; P one column): plate 210x110, italic caption, name 17 px, count 12.5 px, description 13 px, who-line 12 px; dark pill "Browse Full Library" |
| 9 | "Explore the library" | 623 / 1266 | page | 17 bordered rows, three columns; bold label 15/600 and a muted clause |
| 10-12 | Membership | 238 + 1515 + 306 | page | header and toggle; two plan cards; "Other memberships" in four numbered columns; "Rather give once?" |
| 13 | Beta band | 348 / 340 | cream | kicker, sentence, `Give Feedback` |
| 14 | Transparency band | 482 / 449 | page, top hairline | H2 38 px, short paragraph, terracotta button; narrow container (664 px) |
| 15 | Footer | 426 / 1053 | page | columns of links |

Interactions: hero sweep and pulse (reduced-motion safe); counts replaced after the catalogues load; plan toggle;
whole membership card clickable (ignored while text is selected or with modifier keys); every gated link opens the
gate modal; header "Support" and the hero button scroll to the membership block. Phone: the rail becomes a
scroller, hero text 28.9 px, buttons stacked, all grids one column except the stats (2x2), collection cards lose
description and arrow (119 px tall), shelf cards show a 350x180 plate above the text.

### 4.2 Library and shelves

**Browse (`/curated/`).** Hero 379 px (H1 46 px IM Fell, a 660 px search form joined to a `SEARCH` button, five
buttons that wrap at 780 px). Below, five collapsible bands (`details`, all open, chevron at the far right of the
header; header = small-caps label plus H2 38 px): creeds and confessions (cream, 15 rows, 28 px titles), start here
(page, 10 rows in two columns), authors (dark, 30 rows, link "Explore all authors"), the fathers (cream, 18 rows),
guide teasers (13, in terracotta links), shelf samples (grey `#f2f2f2`, nine blocks with five featured works each).
Row anatomy: title 17 px (28 px in the big bands), italic original-language title 13-15 px muted, meta 11 px caps
(`GROUP, DATE`), hairline between rows. The lists are hand-written in the template; samples and counts come from the
catalogues (English title, original title, author).

**Full Library (`/all-works/?collection=all`).** Hero 395 px. A "Browse the shelves" fold (62 px row, `#fbf8f3`,
border; opens to a three-column grid of shelf cards: name 18 px, count in orange, italic who-line, a guide button and
a "Study this shelf" disclosure). View tabs `By author | By century` (18 px; the label becomes `By volume` or `By tome`
on Migne shelves). Filter panel (card `#fbf8f3`, 1,124 px): search input (180 ms debounce), a count line in 11 px caps
that always states what the list is ("N works in the whole library", "N works matching X in ..."), selects with caps
labels (collection, century with counts, tradition with counts, conditional denomination), a "has page scans"
checkbox, "N works have no date". A-Z bar with counts (two rows on D, one scrolling strip on P). The list: 100 authors
per page in two columns, each an accordion (chevron, name 13/600 caps terracotta, "N works" right-aligned); opened:
"ABOUT NAME" link, then rows (title 16 px, original title 13 px italic, citation 12 px muted "PL 139, cols. 419-462").
Pager `PREVIOUS | numbers | NEXT`; a page break only falls between authors. By-century view: twenty tiles (about
73x55 px) with counts. The whole state is in the URL (see 2.2). Phone: filters stack one per row, the A-Z bar scrolls,
one column.

**Shelf pages.** Same template with its own hero and counts: confessions (tabs By tradition / By century, groups
ordered The Whole Church, Eastern Orthodox, Roman Catholic, Waldensian, Bohemian Brethren, Protestant, Lutheran,
Reformed, Anglican, Presbyterian, Congregational, Baptist, Arminian), the three Migne pages with a "Study this shelf"
panel (Ask this shelf plus four cards: Scripture, Authors, Topics, Connections), Early English Books.

**Traditions (`/tradition/`).** Hero 390 px; a hairline list of 15 link rows (78 px): name 21 px (18 px for the ten
indented children of Protestant), one-line description, and a caps meta line "FROM <year>, N DOCUMENTS, N AUTHORS".
Detail: H1, dek, "Guide to the shelf" button, five open `details` (Overview in two columns, Related traditions chips,
Creeds, confessions and catechisms by year with a type tag, Authors in order of birth with works counts, and a nested
"all N authors" disclosure).

### 4.3 Authors and the author room

**Index (`/authors/`).** Hero 358 px. A filter card in three columns: Find an author, Period (nine periods from Early
patristic to Later authors and Undated), Order (library selection, A-Z, most works, most Scripture citations). Result
line ("1,879 authors across 9 shelves") with underlined "Expand all" and "Reset filters". Nine shelf cards (92 px, white,
border; "501 authors, 2,915 works", italic preview of the first four names) as accordions whose rows show name,
"birth year, tradition tags" and "N works". A search also lists "authors with works but no research room". A
Methodology disclosure closes the page. Phone: the three filters collapse behind "Filter and sort".

**Room.** Under the same hero: round portrait (186 px, cream ring), eyebrow, H1 52 px, one line of dates and office,
two outline buttons (citation map, compare). Tabs ABOUT, LIBRARY, THE ROOM, ESSAYS; blocks: four numbered
start-reading picks with chips, biography, an era scale (five periods), a quick-facts card (works, pages, Scripture
citations, tradition, shelf), "cites most" and "cited by" (eight authors each with counts), related authors; then the
tab bar `Works | Positions | Scripture | Topics | Reception | Connections | Search` (counts on some). The Works panel
has a title search, a "kind of work" select (commentaries, letters, sermons and homilies, treatises, polemical,
devotional and practical, editorial apparatus, catechisms and confessions, collected editions, history and lives) and
rows with `Read work`, `Explore work` (opens the work hub), `Save work`. The page is 18,307 px tall on D. Every author
has a page, with or without a room.

### 4.4 Work hub (`/author/?sh=<shelf>#w/<slug>`) `[live-wh]`

**Purpose.** One page per work that explains it and opens it: what it is, where to start, how it is built, what it
cites and who cited it. It reuses the Authors hero (H1 "Authors", 358 px on D) and the section bar; the page title is
"Authors". Open to everyone. Observed on a Migne work (Augustine, Ten Tractates on the First Epistle of John); a
curated English work answered "Not found." at the same address because no enrichment file exists for it.

| Zone | Content (D) |
|---|---|
| Breadcrumb | the author's name, 15 px muted, above the card |
| Card | white-cream card, 1 px border; title 32.8/52.5 px, weight 400, in the system serif stack (`ui-serif`, New York, Iowan Old Style, Palatino, Georgia: the display-font variable is not applied on this template, as on the Authors page); author link in terracotta, then the citation ("PL 35, cols. 1978-2062") and a bordered small-caps kind chip (11.8 px/600, tracking 1.4 px, muted); two stat tiles (220x76 px: number 24 px, caption 11 px caps): PAGES (43) and SCRIPTURE CITATIONS (361); link "Open in the reader" (14 px, terracotta, 44 px high) |
| Tab strip | sticky under the section bar, 47 px high on a page-coloured ground with a hairline; tab buttons 46 px high, Source Serif 14 px, active 600 ink with a 2 px accent underline, inactive 400 muted; counts in the label: Overview, The argument 7, Sections 10, Index 775, Quotations 4, Later readers 924, Scripture, Topics, Positions, Sources cited, Names. On P it stays one scrolling row |
| Overview | H2 26 px/500 (system serif); two columns from 960 px (1.15fr / 1fr, gap 56): left a machine-written blurb (Source Serif 17/27.2, 595 px wide, max 70 ch) and kind tags; right "Where to start" (H3 15 px/600): five numbered circles (1.7 rem), each a terracotta underlined page button (17 px) and one sentence of why; then a Methodology disclosure |
| The argument | a short summary, then numbered theses as expandable rows (16/600) with page spans, "how it is argued", objections and answers (dashed rules) |
| Sections | each section title (first words of the heading) with a one- or two-sentence summary |
| Index | "Index of the whole <corpus>" with five part buttons and counts (Subjects 207, Persons 1, Scripture 372, Terms 77, Questions 118), a "Find a subject" field and a two-column list of entries with page buttons (a page opens a page window) |
| Quotations | source-language quotes (italic, 3 px left rule) each with its page |
| Later readers | "pages of this work cited N times by M later works", a find field, rows "p. 2044, 128 later citations" that open to the citers |
| Scripture | counts "300 quotations, 36 citations, 25 allusions" and a per-book list ("I John 97 citations") |
| Topics | pages per topic (Sanctification 31 pages, Grace 29, ...) |
| Positions | three doors: read the author's positions; follow sources cited; explore later citations |
| Sources cited / Names | resolved citations with authors; a citation index and names in the text, counted separately |
| Resources band | "FROM MERE ORTHODOXY: Resources on this work" essay cards (skip) |

The page is 15,188 px tall on D for this work, mostly lists. P: card and tiles in one column, tab strip scrolls.

### 4.5 Reader (`/read/?w=<slug>`)

Desktop sketch (not to scale):

```
+-----------------------------------------------------------------------------+ y 0
| masthead (publisher)  logo | site nav ........ search  Sign in  [Become a Member]   77 px
+-----------------------------------------------------------------------------+
| section bar  THE FAITH RECEIVED | HOME   Search  Read>  Scripture  Topics ...      48 px
+-----------------------------------------------------------------------------+
| [menu] Title                      [<][>][ 3 / 114 ] [Transparency] [find] [Aa|Tools>]   67 px
|        Author  dates                                                              (97 with volume row)
+-----------+-----------------------------------------------------------------+
| [HIDE CONTENTS][EXPAND CONTENTS]   |  scroller: main#reading (max 960 wide)   |
| [Outline|Index|Library]            |    [ chapter card                    v ] |
| [Search contents]                  |    Chapter I                             |
| [Show current]                     |    paragraphs, 37 em measure             |
| 114 CONTENTS ENTRIES               |                                          |
| | current entry (bar)              |    (find bar sticks to the top here)     |
+-----------+-----------------------------------------------------------------+
                                       progress bar 3 px (fixed bottom)
```

Phone: masthead 61, bar 43, toolbar 53 (title and author only), text 16/24.8 with 12 px side padding, thumb bar 61 px
fixed at the bottom with four cells (Contents, Search, Text, Tools).

Layers, in the order Esc closes them: find bar, `Aa` panel, Tools drawer, Transparency dialog, Scripture / footnote /
margin previews, Expand-contents overlay, gate modal, Report form, keyboard help, Research panel; with nothing open
Esc hides the contents panel. Popovers: `Aa` panel 340 px wide below the button; Transparency dialog 560 px centred
below the toolbar (phone 358 px at x=16); selection bar 595x50 under the selection; Scripture preview 460 px; footnote
preview 470 px; at 700 px and below previews become bottom sheets (70 % of the viewport height, 12 px top radius).
Scroll behaviour: scrolling down slides the masthead away on desktop (the bar stays pinned, the toolbar rides up to
y=48); on phone everything but the progress bar leaves and returns on a scroll up.

Bilingual reading (Both): one row per aligned paragraph, source left and English right with a hairline divider; grid
columns 0.44fr and 0.56fr (English runs about 15 % longer than Latin), measure grows to 1,440 px, heading cards in each
lane; a drag handle changes the split (0.25-0.75, double-click resets). On phone the lanes stack, each block with a
muted lane label. There is exactly one English text per work: no second translation lane.

### 4.6 Scripture reader and Verse Desk

**Scripture reader (`/scripture/?ref=romans.8.7`).** Zones top to bottom: masthead and bar; hero 372 px (310 on P);
control bar 157 px (214 on P), not sticky: division tabs (Old Testament, New Testament, Apocrypha; 16 px, active
underlined in `#9c4d37`), Book select, Chapter select, Translation select (ESV, CSB, KJV, NASB), a "Commentaries (N)"
toggle, two 44 px circular previous/next buttons; a view bar (layout radio group of five icons and a dark-mode button);
the layout grid (max 1,380 px; two columns of 635 px with a 40 px gap at 50/50). Left: a card (`#fffdfa`, padding
34/44/40) with a chapter header (book name eyebrow 11 px caps orange over "Chapter 8" 42 px/600), a hint line and the
text at 19/35.15 px; every verse is a button, verse numbers superscript 11 px. The active verse has a 18 % orange wash
and a 2 px orange underline. Right: the commentary pane (ground `#fbf8f3`, padding 18/20/24) with a sticky tab row
(Commentary, Citations, Reception, Hymns, a Verse Desk button), an eyebrow ("Commentary on this verse"), the reference
as an H2 26 px, and a view: the creeds block (count, "Show all N", rows with the document title, article reference, the
words quoted), the current commentary line with "Change", key-commentator pills (two rows), a language switch, a
"where" line, the commentary's own page text, and a footer with the checkbox "Follow the text" and previous/next page.
Citations view: headline count, tradition/author/century selects, text box, "Clear filters", five most-cited sources with
Preview. A chapter overview shows when no verse is open. Below 900 px there are no columns: the pane opens inline after
the verse's paragraph as accordion rows (reception history, readings, points in dispute, commentaries on the verse and
the book, cited elsewhere, citations of this verse, read with, similar passages). Attribution line at the foot. Dark
palette: page `#222320`, card `#2B2C29`, panel `#272824`, ink `#E9E9E5`, muted `#B0B0A8`, rule `#454740`, accent `#D79380`.

**Verse Desk (`/scripture/desk/?ref=romans.3.28`).** One long page (13,756 px D, 22,657 P), module order is DOM order:
desk head (reference in IM Fell 44 px, verse 30/41.4 px, previous / back / next links, century ruler with 18 bars and
the library's usual share marked), four stat tiles (works citing it, commentaries, confession proofs, readings), a lede
composed from counts only, "on this page" anchors, in four translations (four cards), essays (skip), key voices (six
portraits), how the church read it (five age cards, readings ranked by pages), points in dispute (questions with
positions, no names), who confesses it (three columns by tradition), commentary ladder (seven age cards), chapter heat
(one bar per verse, each a link), share, commentaries with Preview, citations (two bar charts, filters, kind chips,
author cards, "load 250 more"), similar passages, ask. Every figure module has a Methodology note.

### 4.7 Topics

**Index.** Head card (112 px) with "Find a topic" and a 420 px search field; three CSS columns (cards 408 px) of ten part
cards, each an H2 with a Roman numeral in `#9c4d37` and topic links 17 px in 46 px rows, narrower topics indented 20 px.
**Topic page (the topic desk).** Head card (path, H2 48 px, one sentence, "within this topic" links); four anchored
tiles (confession articles 95, works 418, authors 1,198, verses cited 8,676); jump nav (traditions, classic works, about,
key verses, people, reading path, related, full record); "Through time" (five tabs: History, Scripture, A course of
reading, Traditions compared, Concept guides; the History panel is an overview plus a nine-colour shelf legend plus five
tinted age cards holding century rows of stacked bars scaled by the square root of the count); essays (skip); tradition
cards (3 px terracotta top border, verbatim excerpts with citation line, key works); classic treatments by shelf; nine key
verse cards; twelve people; reading path (two numbered cards); related topic chips; the two tabbed blocks (Read, Compare,
Trace, Scripture) for creeds and for works. Page 17,543 px D, 36,666 P. Phone: tiles 2x2, tabs wrap, century rows keep
label, bar, count, chevron.

### 4.8 Search

Signed out, Search and the other server-gated tools show a hero, an in-page panel "Free account required" (H2 19 px,
sentence, outline button, "Sign in" link) and, after a second, the arrival modal. Signed in (from the tour only): a
mode strip (Works, Passages, Scripture, Ask), the search box, a Shelf select, "Filters and order" (author, work,
collection, group), results naming work and author, a Compact density button, and for Passages a switch Exact words /
By idea. Power Search (one product image): a white query box with a dark `Search` button, a SCOPE row ("The whole
library"), a FILTER row ("All 47 works"), the count line "47 works, showing 1 to 25", results grouped by work with a
terracotta shelf label, title, byline and a "Passages in this work" expander.

### 4.9 Research hub and the Ask workspace

**Research hub (`/research/`).** Hero 218 px (compact), a "Free account required" panel, then "RESEARCH TOOLS" in five
groups in three CSS columns (353 px each at D; two columns up to 1023 px; one up to 640): Search and ask (Ask, Power
Search); Read with the commentators (Commentary Decks, Disputed Questions, Page Scans); Look things up (Lexicon, Set
Indexes); Compare and connect (Compare, Connections); Keep your work (Bookmarks, Notebook, Desk). Each row: name 15/600, a
one-line promise 14 px muted, a hollow `Open` button (44 px, 1 px border, fills on hover). Signed in it becomes the
Research desk: a label over a tab strip of seven tabs.

**Ask workspace (`/ask/`).** Reconstructed from the site's own script and stylesheet (the signed-in product is not visible to
anonymous visitors; one cropped answer is public).

| Zone | Geometry and content |
|---|---|
| Frame | fixed layer above everything (z 60), `role=dialog` when overlaid, `main` when standalone, `complementary` when docked; every other child of `body` is inert while modal |
| Sidebar | 272 px, cream, own scroll: brand link, "New conversation", "Search conversations", CONVERSATIONS label with an ARCHIVED toggle, list (title 15 px; second line: Researching, Needs attention, Ready or the date; current row has a 2 px terracotta left border; folders as `details`), foot links (Collections, Open Desk), completion notifications, the note that conversations are saved in this browser. Off-canvas drawer below 900 px |
| Header | history toggle, title (16/600, one line) over a context line, a state pill (34 px, pulsing dot, then a check), icon buttons (search, theme, "..." menu, Library link, close) |
| Chat column | measure 760 px centred; feed padding 36 px |
| Welcome | H1 "Ask the Library" (30-40 px, 600), one line of help, a 2-column grid of four cards (label 11 px caps over a 15 px prompt; hover border terracotta) |
| Turn | question bubble (right-aligned, max 88 %, radius 14/14/4, 17 px); mode line; progress (three pulsing dots, stage text, elapsed timer, the last six completed stages, "Found so far: N works, M passages" with up to eight chips); "Answer" label; an outline card repeating the question (20 px/600) with "Top" and one 13 px jump link per `###` section; answer body 18/1.75 in Source Serif, `###` headings 26 px/600; extras; receipts; "All sources" disclosure; actions (Read sources, Share, Copy answer, Save to notebook, Insert in Desk, Research in Deep, Retry) |
| Citation chip | `padding 0 5px`, 0.78 em, cream fill, 1 px border, 2 px radius, label "p. 384" or "PL 32:659"; the model writes `[slug/p384]` and the client resolves it against the returned sources; hover (220 ms) or focus opens a 460 px card with the paragraph and, beneath it, the Latin of the same paragraph |
| Source pane | the real reader in an iframe beside the chat (default 53 %, range 28-76 %, 9 px handle, keyboard resize), "Back to conversation", "Open reader"; phone: full-screen layer with tabs Conversation / Read source |
| Composer | box (max 760 px, radius 14, focus border ink plus soft shadow); label "Your question"; textarea "Ask anything"; tools row: mode toggle (Ask, Deep research), scope toggle (Whole library, a selection's name, "N selections"), send (44 px circle that becomes a stop square); foot line: save state, usage meter, "Enter to send, Shift+Enter for a new line"; a floating "Latest answer" button after 110 px of scroll |
| Scope popover | "Search within": the nine shelves (two-column checkboxes), English groups, chips of picked authors and works, "Add works or authors" with 150 ms search, "Use the work I am reading", "Include my notebook in Ask and Deep research" |
| Command palette | Ctrl/Cmd+K dialog: new conversation, search within, research mode, browse conversations, open library, plus every conversation |

States and messages: stage texts are humanised tool names ("Searching by meaning", "Reading source pages", "Finding
commentaries", "Tracing reception"); errors keep the partial text ("Any partial answer is saved"); a 5.5-minute client
timeout suggests narrowing the question or Deep research; 429 says the library is busy; an expired session says to sign
in; deep jobs have the states running, paused, complete, stopped, needs attention. Type: Source Serif 17-18 px, labels
11 px caps tracking 0.22 em, radii composer 14, bubble 14/14/4, pill 20, outline card 3, chips 2. Dark: page `#201d1b`,
cream `#2a2624`, ink `#ece7e1`, accent text `#e8a184`. Most controls are 44 px high.

### 4.10 Notebook, Bookmarks, Compare, Connections, Desk (signed-in tools)

Reconstructed from the site's CSS and the public product screenshots; none was operated.

- **Notebook.** Head: H2, count line "3 PASSAGES", filter field "Filter your notes", group buttons Recent / By work; a collection
  bar (cream panel, "New collection", a collection select); entry cards (cite line in 11 px caps, work and saved date in
  italic 22 px, the passage as an italic quote with a sage left rule, a "Your note" textarea, actions Open in the reader,
  Copy citation, Remove with a two-step confirm).
- **Bookmarks.** Head with "9 WORKS SAVED" and sort buttons Recent / Author / Collection; white row cards (title 20 px,
  date label, shelf label in caps, Remove); a places list under a row, the place where you stopped in italic.
- **Compare.** Author bar (chips with name, "c. 354, Latin Fathers" and a remove cross, an "Add an author" field), an empty
  state with six suggested pairs, a topic picker with stance bars and a four-colour legend (asserts green `#3F6B4E`, denies
  red `#A8462B`, reports grey `#8a7f72`, qualifies), a filter fold (View, Works, Stance, Phrase, Export to Desk, Save
  view), then columns (grid, gap 20 px) one per author: head, "26 loaded, of 6,951 in the index", a Methodology note,
  statements grouped by work (quote block with a 2 px rule, provenance line, "INDEX NOTE" gloss, Preview, Save). Phone:
  swipe between authors.
- **Connections.** Find an author, an author index with reader counts, a filter fold, the network (`#graph-frame`) with
  Timeline / Rings / Tradition layouts, zoom and Fit map, a period colour key, an author panel (title, "contested 16 %", "View
  this author's map", "Cited by 489 authors", rows with counts that expand to evidence), "Places to start", Paths, Topics and
  Scripture views, phone list/map switch.
- **Desk.** A workspace bar (Write / Research segmented control, Paper select, Notebook select, "New notebook"), the
  editor with title, word count and save state, a papers list, a four-tab rail of kept material, a source-preview split
  (two columns from 941 px).

### 4.11 Account and pricing

Account: a passwordless form (First name, Last name, E-mail; underline-style inputs 44 px, grid 176 / 176 / 211 px) with a
dark pill "Create free account" and states ("Creating account...", validation lines, "Check your inbox / Almost
there"). In the gate modal the inputs are boxed (white, 6 px radius, 53 px high) and the submit is a text button. The
sign-in portal is a 480 px modal (full sheet on phone). Pricing: a billing toggle pill (352x58 px, Annual selected dark with a
"Save 17 %" badge), two plan cards without boxes separated by a hairline (444 px each, price 62 px/700, italic IM Fell
plan names, check-mark benefit lists), "Other memberships" in four numbered columns (I-IV in italic 28 px terracotta),
"Rather give once?", and separate pages for gifts, group seats (live total), organisations (e-mail domains) and students
(school-e-mail confirmation).

### 4.12 About, Tutorial, How to use, Transparency

- **About (`/manifesto/`).** Hero 293 px; a 664 px column with six tabs in a 3x2 grid (cells 221x64; active filled
  terracotta); each panel opens with a header card (3 px terracotta left border, date, H2 30 px, byline, role) and prose.
  The Changelog panel: counters, a segmented control Open reports / Closed reports, a sort select, rows with date, text,
  a STAFF / REPORTED / FEATURE badge and thumbs counts.
- **Tutorial (`/tutorial/`).** Six numbered cards (664 px, outline circle, title 22 px, blurb, "N STEPS", `Start`), then a
  static explainer of the shelves. The tour card is 360 px (docked at the bottom on phone), eyebrow "STEP n OF m", optional
  MEMBERS pill, title 18 px, body 17 px, an optional dashed "EXAMPLE" box, Skip tour, Back, Next.
- **How to use (`/how-to-use/`).** Hero 192 px; tabs Laity / Pastors / Academics (48 px, underline); each panel is a 2-column
  grid of cards (small-caps feature label, H3 task, one or two sentences, notes such as "Needs a free account" and
  "AI-assisted: answers cite the library's pages", a 546x341 screenshot, a `Try it` link).
- **Transparency (`/transparency/`).** A 664 px column: opening statement, eight commitments (each H2 plus a paragraph), a
  `Report an issue` button, and a closed disclosure listing every machine-translated work alphabetically (title, author,
  year, shelf label) with `Show 50 more`.

### 4.13 Resources, Dictionary, Glossary (open reference surfaces)

- **Resources.** Tab list ARTICLES / PODCASTS, a 560 px search field with Clear, kind filters and sort as quiet text buttons,
  a status line ("494 articles"), a grid of cards (4 / 3 / 2 / 1 columns at 1000 / 800 / 520), each card one link in a new tab (3:2
  image, title 17/600, byline, a "why" line, kind labels); grouped by kind when no query is set; whole state in the URL.
- **Dictionary.** Full-bleed app: a cream header (title, search, counter, A-Z buttons), a 300 px headword list (English title
  with the French title in italic beneath and a size in thousands of characters; "Load more"), and a reading card with
  `Both | English | Francais`, text size, previous/next; Both is two aligned columns. Phone: the article opens as its own
  screen.
- **Glossary.** Hero with a pill search, 27 square letter buttons, results "392 TERMS" with definitions attributed to an
  author and page, `Show 50 more`.

---

## 5. Design language

The look is a warm-paper editorial system: serif everywhere, small-caps labels with generous tracking, hairlines
instead of boxes, terracotta as the single accent, almost no icons. Two token families exist: the Ghost theme
(`screen.min.css`) for the landing and library pages, and the shared "PRDL" system (`prdl-system.css`) for the reader
and sister corpora; on every non-reader page a small stylesheet re-maps the PRDL names to the theme values, so both
agree. The reader then overrides several values and a skin stylesheet restores the brand.

### 5.1 Colour

| Role | Value | Names (theme / PRDL) | Used for |
|---|---|---|---|
| Page ground | `#f6f3f2` | `--color-page` / `--bg` | page, rail, modals, text area |
| Ink | `#2d2927` | `--color-dark` / `--fg` | body text, dark bands, filled buttons |
| Muted | `#6b6660` (theme), `#6f6a64` (PRDL) | `--color-muted` / `--muted` | meta, counts, rail links |
| Hairline | `#d9c6a7` | `--color-card-border` / `--border` | every rule, card and input border |
| Card | `#fffdfa` | `--card` | cards, inputs, popovers, buttons |
| Cream | `#f5efe1` | `--color-cream` | reader toolbar, outline panel, beta band, Ask sidebar |
| Warm | `#f1e0c9` | `--color-background` / `--bg-warm` | PRDL warm panels (the site masthead is `#f1e8d5`) |
| Panel | `#fbf8f3` | none | filter panels, desk heads, side rails |
| Accent | `#c1593c` | `--color-secondary` / `--accent` | fills, active tab, links in the theme |
| Accent, deeper | `#a8462b` (PRDL), `#9c4126` (alert text), `#9c4d37` (Scripture labels), `#ab5239` (reader hover and eyebrows) | `--accent2` | hover of dark pills, errors, small labels |
| Orange | `#ee7d51` | `--color-primary` | accents on dark bands, hero primary button, nav hover |
| Kicker | `#b45f3d` | `--color-primary-text` | small-caps kickers on light ground, MEMBERS pill |
| Highlight | `#fbe9c8` (PRDL), `#f5efe1` (reader) | `--hl` | marked text, current entry |
| Masthead (PRDL) | `#2A231D`, ink `#EFE7DA` | `--masthead` | family strip and dark bands |
| Shadow | `0 1px 2px rgba(45,41,39,.04), 0 6px 20px rgba(45,41,39,.06)` | `--shadow-card` | cards on hover |

Reader themes (toggle cycles Light, Sepia, Dark; with no stored choice the reader follows the OS):

| Theme | bg | fg | muted | border | card | sidebar | highlight | line height |
|---|---|---|---|---|---|---|---|---|
| Light | `#f6f3f2` | `#2d2927` | `#6b6660` | `#d9c6a7` | `#fffdfa` | `#f5efe1` | `#f5efe1` | 1.55 |
| Sepia | `#EEE7D9` | `#302C24` | `#6D6557` | `#D8D0C1` | `#FAF6EC` | `#EEE7D9` | `#E7DFCF` | 1.55 |
| Dark | `#222320` | `#E9E9E5` | `#B0B0A8` | `#454740` | `#2B2C29` | `#242521` | `#373932` | 1.68 |

The masthead and the section bar stay light in every reader theme (the theme belongs to the reading surface). The
PRDL dark set (warm: bg `#211E1A`, card `#2B2722`, ink `#E9E4DB`, accent `#E1855F`, masthead `#15120E`) is declared but the
reader uses the neutral set above; in dark the active tab and current-entry marker are a lifted terracotta `#D79380`
with dark text. User highlights (`mark`): amber `#F0E9D9`/fallback `#fbe9c8`, sage `#e7efe0`, slate `#e5ecf3`, rose
`#f3e0e4`, lilac `#e9e1f2` (dark: `#4d3b1c`, `#2c3a2a`, `#26313f`, `#46282f`, `#372848`; swatch rings `#e8b04b`,
`#8fae6f`, `#7d97bd`, `#d4879a`, `#9a86c4`). Find hits invert the ink (`#2D2927` background, `#FFFDFA` text) with a 2 px
ring on the current hit. Shelf identity colours (library data views): Latin `#A8462B`, Greek `#3E5F8A`, Eastern `#7A6025`,
English `#3F6B4E`, Medieval `#5B4E7A`, Catholic `#8E2F39`, Reformed `#4A6178`, Lutheran `#2F6F62`, Humanism `#6E5A3A`.

**Contrast audit of the reference** (computed by us with the WCAG 2.x formula; the reference's own CSS claims 4.6-5:1
for its muted tier):

| Pair | Ratio | Verdict |
|---|---|---|
| `#2d2927` on `#f6f3f2` | 13.05 | pass |
| `#6f6a64` on `#f6f3f2` / on `#fffdfa` / on `#f5efe1` | 4.85 / 5.27 / 4.67 | pass |
| `#6f6a64` on `#f1e0c9` (muted on warm) | 4.14 | fail |
| `#c1593c` as text on `#f6f3f2` | 3.99 | fail (large text only) |
| white on `#c1593c` (13 px/600 button labels) | 4.41 | fail by a hair |
| `#b45f3d` on `#f6f3f2` (kickers, BETA label) | 4.09 | fail |
| `#ee7d51` on `#f6f3f2` (card date lines) | 2.47 | fail |
| white on `#ee7d51` (hero primary button) | 2.73 | fail |
| `#a8462b` on `#f6f3f2` / `#9c4d37` on `#f6f3f2` | 5.32 / 5.39 | pass |
| `#EFE7DA` on `#2A231D` | 12.61 | pass |
| `#d9c6a7` on `#fffdfa` (input border, needs 3:1 for a UI component) | 1.64 | fail |

Consequence for us: the terracotta `#c1593c` may be used for fills and graphics but not as small text or under white
labels; `#a8462b` carries text and white labels (5.87:1 with white). See `docs/ui-spec-v2.md`, section 2.

### 5.2 Fonts

| Face | Role | Weights | Notes |
|---|---|---|---|
| IM Fell Great Primer | display: hero H1, desk reference titles, gate-modal titles (italic), plan names, numerals | 400, 400 italic | Google Fonts; the CSS rule is "no display face on working surfaces" |
| Source Serif Pro (now published as Source Serif 4) | body and UI everywhere, including small caps, buttons and inputs | 400, 600, 700, italics 400 and 600 | the reader reading text, the library, Scripture, Ask |
| EB Garamond | the reader's own chrome: title 20 px, toolbar buttons 13 px, panel titles | 400, 500, 600, italics | reader only; the Scripture desk section titles name it but it is not loaded (Georgia shows) |
| Source Sans 3 and Atkinson Hyperlegible | optional reading faces "Sans" and "Legible" in `Aa` | | widen the measure (777 to 851 px at 21 px) |
| Old Standard TT | fallback of sister sites | | not seen in use |

Greek and Latin source text renders in the same serif stack (the system's Greek-capable serif). The Authors page H1 and
group names, and the work hub (card title 32.8 px, section H2 26 px, small H3), compute to `ui-serif` (the font variables are not
applied on those templates, measured): a visible inconsistency.

### 5.3 Type scale

| Where | Font and size | Notes |
|---|---|---|
| Theme tokens | `--tfr-display-l` clamp(32px, 4vw, 52px); `-m` clamp(26px, 3vw, 38px); `-s` clamp(22px, 2.4vw, 28px); `--tfr-body` 17px/27.2; `--tfr-meta` 14px; `--tfr-micro` 11px | landing and library |
| Hero H1 | IM Fell 400, 52/56 (P 28.9/32.3, clamp(22px, 7.4vw, 32px)), max 22 ch; inner pages 52/54 | white |
| Section H2 | 38-40 px (landing); 29 px Georgia fallback (desk); 32/600 (desk modules) | |
| Card title | 19/700 (collection); 17 (rows); 28 (door H3, big band rows) | |
| Body | 17/27.2 (page); 15 (door text); 14 (meta, card description); 13 (captions) | |
| Reader title | EB Garamond 20/400; meta 12 | one line, ellipsis |
| Reader text | Source Serif 21/32.55 (1.55); P 16/24.8; measure 37 em; paragraph spacing 0.58 em | parallel works: English 21.84/38 with first-line indent 1.45 em |
| Chapter card title | 29.38/600 (1.42 em); label-only eyebrow 11.5/600 caps tracking 0.22 em; "Chapter I" line 21/600 italic | |
| Outline entry | 14/1.4; current 600; count line 10.5 caps tracking 0.14 em | |
| Scripture verse text | 19/35.15 (P 18/32.4); chapter heading 42/600 | |
| Ask | question 17; answer 18/1.75; `###` 26/600 (P 23); outline-card question 20/600; chips 0.78 em | |

### 5.4 Small-caps label recipes (all uppercase, Source Serif)

| Where | Size / weight / tracking | Colour |
|---|---|---|
| Ghost top nav | 11 / 600 / 1.98 px | `#2d2927`, hover `#ee7d51` |
| Section bar items | 13 / 400 / 1.3 px (brand 600) | `#6b6660`; hover and active `#c1593c` |
| Rail drawer items | 12 / 400 / 0.72 px (P 13 / 0.78) | `#2d2927` |
| Section kicker | 11 / 400 / 3.3 px | `#b45f3d` (on dark `#ee7d51`) |
| Hero eyebrow | 12 / 400 / 3.6 px | white 77 % |
| Card date line; card link | 11 / 600 / 2.42 px; 12 / 600 / 2.64 px | `#ee7d51`; `#c1593c` |
| CTA buttons | 13 / 600 / 1.82 px | white on `#ee7d51` or `#c1593c`; outline `#2d2927` |
| Control labels, filter labels | 10-11 / 600 / 2.2-2.42 px | `#9c4d37` or `#6b6660` |
| Reader left-panel buttons | 10.5 / 400 / 0.84 px | ink |
| Aa row labels | 11 / 600 / 1.76 px | `#6b6660` |
| MEMBERS pill | 10 / 400 / 2.2 px, 1 px border, 3x8 padding | `#b45f3d` |

### 5.5 Spacing, layout and sticky offsets

- Containers: 1,124 px (landing and library); 1,180 px with 28 px gutters (tool pages); 664 px narrow column (About,
  Transparency); reading column `min(46rem, 88%)`, from 1200 px `min(60rem, 92%)`; Scripture grid up to 1,380 px; Ask chat 760 px.
- Band padding 88/0 (P 56/0); hero padding 128/0/120 (landing), 92/0/84 (tool pages), 56/0/40 (Browse); hero heights 192-480 px
  by page (the landing hero is 698 px).
- Bars: masthead 77/61, rail 48/43 (sticky at 76.77), reader toolbar 67/53, thumb bar 61, survey strip 8 px.
- Rows: 44 px minimum touch targets on tool pages and phone; outline rows 56-59 px on phone; rail drawer rows 42 px (D) and 48 px (P).
- Grids: doors 4/2/1; collection cards 4/2/1; shelves 5 per row on D; research hub 3/2/1 columns; resources cards 4/3/2/1.

### 5.6 Radii, borders, elevation

Radii: 3 px (working surfaces: cards, buttons, inputs of the library), 6 px (inputs of tools, dark buttons), 8 px (tool bars, popovers,
images), 12-14 px (dialogs, composer), 2 px (citation chips), 999 px (pills, circular arrows). PRDL: 5, 9, 12, 999. Borders are
1 px `#d9c6a7`; focus ring 2 px (accent or ink) offset 2 px. Shadows are warm brown, never black; most surfaces have none
(the toolbar has `0 10px 22px -20px rgba(42,28,14,.35)`, popovers `0 10px 28px rgba(0,0,0,.12)`, dialogs `0 24px 60px rgba(0,0,0,.25)`).

### 5.7 Motion

Durations .14 s (press `scale(.96)`), .2 s, .3 s; easings `cubic-bezier(.22,1,.36,1)`, `.32,.72,0,1` (drawers, panels),
`.23,1,.32,1` (entrances), `.34,1.56,.64,1` (micro arrivals only). Specific: rail drawer width 300-320 ms; sidebar slide
.26 s; `Aa` popover .16 s; hero sweep 0.55 s once; kicker pulse 2.4 s; loading text shimmer 2.4 s; reveal-on-scroll 13 px
rise over .55 s; Ask dots pulse 1.4 s. Everything is switched off under `prefers-reduced-motion`.

### 5.8 Components and states

| Component | Anatomy | States and notes |
|---|---|---|
| Outline button | 1 px ink or terracotta border, 3 px radius, caps 12-13 px/600, 44 px high | hover fills left to right with `#c1593c` over .28 s; pressed `scale(.96)` |
| Filled button | terracotta or ink fill, white text | hover darkens to about `#a64d34`; ink variant hovers to `#9c4126` |
| Pill button | 999 px radius, 12/600 caps, 44 px | "Create free account" |
| Text link | underlined, terracotta; "NAME arrow" caps links | arrow moves 3 px on hover |
| Segmented control | 1 px border, selected segment filled | roving focus, arrow keys, Home/End |
| Tabs | 13/600 caps with 2-3 px underline in `#9c4d37`, or 14 px with accent underline (work hub), 44 px | manual activation (arrows move focus, Enter or Space activates) |
| Disclosure | closed `details`, 36 px summary with a rotating caret | "Methodology"; opens for print |
| Card | white, 1 px border, 3 px radius, padding 18/20/16 | hover: border terracotta |
| Chip | 1 px border, 3 px radius or 999 px, 13-14 px | selected: ink fill |
| Dialog | centred panel 480-560 px, `#f6f3f2`, 1 px border, 4-14 px radius, close cross, focus trap, Esc | scrim `rgba(45,41,39,.72)` (gates) or `.45` (transparency) |
| Popover and sheet | 460-470 px card; bottom sheet at 700 px (70 % height, 12 px top radius) | Esc closes; scroll closes; opening another closes it |
| Toast | `role=status` line | "Link to this page copied." |
| Citation chip | cream fill, 1 px border, 2 px radius, 0.78 em, terracotta text | hover reverses colours |
| Status pill | bordered small caps (NEEDS REVIEW, REVIEWED, MEMBERS, BETA) | |
| Inputs | white, 1 px `#d9c6a7`, 6 px radius, 16-17 px; underline style on account forms; `type=search` with Clear | focus ring terracotta or ink; 16 px on phones so iOS does not zoom |
| States | loading: shimmering text; empty: modules render nothing, lists say what is missing; error: `role=alert`, 2 px left rule | `aria-live=polite` regions for counts and finds |

### 5.9 Responsive rules

| Width | What changes |
|---|---|
| 640 and below | phone: rail scroller, drawers drop as panels, stacked grids, landing card descriptions hidden |
| 700 and below | scripture, footnote and margin-note previews become bottom sheets |
| 880 and below | reader phone shell (thumb bar, full-width contents, toolbar reduced to the title); also true at 768 px wide |
| 900 | Scripture layout buttons from here up; Ask sidebar becomes a drawer below; resource and card grids step |
| 941 | Desk source split and the Flow switch appear |
| 1100 | outline panel in flow (300 px) and not an overlay (220 px between 881 and 1099); docked Ask; scan resizer |
| 1200 | reading column cap grows |
| 1439 | toolbar "Report" gains " a problem" |
| Pointer queries | `(pointer: coarse)` 44 px targets, tap highlight on references; `(hover: none)` hides the paragraph rail |

### 5.10 Imagery and iconography

Hero and band backgrounds are public-domain landscape and town paintings under dark gradients; shelf cards use title-page
scans or catalogue plates; portraits are engravings or icons (initials when none). The UI uses typographic glyphs and a handful
of small SVG icons (magnifier, link, copy, bookmark, flag, moon). No decorative illustration.

### 5.11 Accessibility observed

Good: skip link, visible focus rings, `aria-expanded`/`aria-controls`/`aria-current` kept in sync, manual-activation tabs,
live regions for counts and toasts, bottom sheets with focus handling, reduced-motion support, 44 px targets, `inert`
background while a modal is open. Weak: several small-caps colours below 4.5:1 (5.1), UI borders below 3:1, the blocking
overlay swallows Esc and has no close control, the overflowing Tools drawer clips "Research" on works with many buttons,
the Scripture and Topics tours light nothing on some steps.

---

## 6. Content model implied by the platform

### 6.1 Entities

Everything is static JSON joined in the browser. The table gives the reference's entities, their main fields, and where
our model stands today (`packages/shared/src/schemas.ts`: `Work`, `Author`, `Edition`, `Licence`, `Provenance`,
`Section`, `Paragraph`; packs signed with Ed25519). "Gap" means an additive schema or catalogue change.

| Entity | Reference fields and files | Our model today | Gap for the target |
|---|---|---|---|
| Work | `slug` (corpus-prefixed `pld-`, `pg-`, `po-`, `eebo-`, or free), `title` (English), `title_en`, `title_la`, `title_orig`, `author` and name forms (`author_en`, `author_la`, `author_gr`), `tradition` (shelf), `party`, `volume`, `kind`, Migne `cols`, `n_pages`, `has_pages`, `has_tei`, `en_only`, `la_chars`/`en_chars`, `dup_of`, `group`; `works-index.json` (19,445 rows) | `Work`: `id`, `slug`, `titleRo`, `titleEn?`, `titleOrig`, `author`, `languageOrig`, `year` | shelves (many-to-many), century (derived), kind of work, tradition/denomination, blurb and "where to start", cover plate, work counts |
| Author | `authors/people.json`, portraits, `enrich/authors/<slug>.json`: profile, `positions[]`, `sources[]` (cites most), `scripture[]`, `quotes[]`, `start[]`, `controversies[]`; neighbours graph; period and tradition tags | `Author`: `name`, `born`, `died`, `tradition` | slug, names per language (`nameRo`, `nameEn`, original), short bio per language, portrait (public-domain image), tradition list |
| Edition and translation | One English text per work; `volume`; edition groups (facsimile and born-digital witnesses); `en_only` for English originals; status record per work: `reports{open,done}`, `review`, `reviewedAt`, `reviewer`, `revisions[{at,summary}]` | `Edition`: `language`, `kind` (source or translation), `sourceEditionId`, `licence`, `provenance` (free text) | structured provenance: kind (AI, human, native, source), model, date, source edition description, review state, reviewer role, checks, corrections list; partial flag (exists as derived) |
| Original text and scans | Source lane (Latin, Greek, Latin beside Greek); page scans `p/<n>.webp`, Migne scans; `scanned-works.json` (4,642 slugs); TEI sidecars | source editions can be installed as editions (`kind: source`) | page anchors per paragraph (printed page or column), page images, scan viewer data |
| Section and paragraph | `pages[{n, la, en, title, loc}]`, `structure[{title, page, depth}]`; block ids `b<page>-<n>`; heading tiers | `Section` (tree through `parentId`), `Paragraph` (`p`, `heading`, `quote`, `note`), `sourceId` alignment; ULID ids | label on sections (article or question number), inline footnote markers, per-paragraph Scripture references |
| Shelf and collection | nine shelves and creeds; volume sets (PL 35 holds 21 works); `workgroups.json`; shelf keys `pl gf po md rc rf lu ed hl` | none | `shelves.json` (slug, labels RO and EN, description, who-line, sort), `work.shelves[]` |
| Century and period | century derived from author dates with overrides; ages for rulers (early church to 1054, medieval 1054-1517, Reformation 1517-1648, post-Reformation 1648-1800, modern) | `year`, `born`, `died` | a derived `century` per work and the age table; undated bucket |
| Tradition and denomination | `traditions.json` (17 records: overview, documents, authors, related), `denominations.json`, `schools.json` | `Author.tradition` (free string) | controlled vocabulary with RO and EN labels; Orthodox branch for our market |
| Creed, confession, catechism | `confessions-index.json`: `{slug, num, title, tradition, year, period, n_pages, type, preview, region}` (680 documents); structured as sections and articles; three-level outline (parts, Lord's Days, questions); proof-text index (321 documents, 7,391 verses, 522 chapters, 20,288 citations) | a creed would be a work with sections | article labels, proof-text references per article, `type` (creed, confession, catechism, council) |
| Scripture reference and citation | parser output `data-scripture-ref` (book, chapter, verses); per-verse citation rows `{author, era, shelf, work, title, how (quotation, explicit, allusion, exegesis), gist, page, link}`; kind totals per book; chapter counts; ASV numbering | RO and EN reference grammars exist in the translation pipeline (`references.ts`) | a runtime parser in `packages/shared`, a citation index built at pack-build time, a versification map |
| Bible text | third-party API for four English translations; Douay-Rheims for the deuterocanon; chapter JSON `{verses[{v, t}]}` | none | licensed or public-domain texts per language, licence record per translation (`bible_translations` in the architecture) |
| Commentary and commentator | commentary map (chapter to page), rank file (key commentators per book, no citation counts), overlays; `commentaries.json` | none | commentary editions mapped to verses; key-commentator list |
| Topic and locus | `loci.json` (10 parts, 45 loci, aliases, find keywords), `treatments.json`, `topic-desk.json`, mined `topic2-all` (198 topics with authors, positions, stance, move) | none | our taxonomy (RO and EN labels, aliases), paragraph-level topic tags |
| Lexicon and glossary entry | term, Latin and Greek forms, senses with defining works, number of works; glossary `term -> [{definition, author, work, page}]` | `content/translation/glossary-ro.csv` is a translation glossary, not a reader lexicon | reader lexicon (later) |
| Dictionary article | `{t, te, fr[], en[], q}`: paired paragraph arrays and a quality flag; `seealso` | the same idea as our aligned editions | a reference-work type if we add one |
| Index of a work | five parts: subjects, persons, Scripture, terms, questions; printed indexes; `src: "mine"` | none | deterministic Scripture part first; rest generated and labelled |
| Cross-citation and reception | resolved citations between works, aggregated per author pair with verbs (refutes, reports, approves, quotes); reception shards; word index; embeddings | none | citation graph over our editions, resolved to the source paragraph |
| Enrichment (machine-written) | `enrich/works/<slug>.json`: blurb, genre, tags, begin, theses, questions, start points, quotes, argument map, `model`, `note`; page summaries, positions with stance | none | per-work guide, labelled with model and date |
| Report and changelog | `/tfr-issue` (names, work, issue type, comment, passage), `/tfr-changes` (id, corpus, work, date, summary, source STAFF, REPORTED or FEATURE, thumbs), `/tfr-most-read` | none | reports table and public changelog (P2) |
| Essay and podcast | `mo-articles.json` (title, url, date, author, kinds, excerpt, keywords, "why", authors served, id maps for verse, topic, work, author, doc) | none | not needed |
| Account and entitlement | Ghost member status `free`, `paid`, `comped`; tiers; labels `source:feature-gate:<key>` | none (no accounts yet) | Supabase Auth, `entitlements` (architecture section 8) |
| User state | see 6.3 | settings store, reading positions per edition | bookmarks, highlights, notes, conversations, sync |

### 6.2 Derived data layers and what they feed

| Layer | Produced by | Feeds |
|---|---|---|
| Per-verse citation index | parser over every paragraph, then classification (quotation, explicit citation, allusion, exegesis) and a machine gist | Scripture panel, Verse Desk, topic key verses, creed proof-texts, reception, work hub Scripture tab |
| Mined positions (author, topic, work, page, stance, move, evidence span) | model extraction over every page | Compare, Every doctrine, topic traditions, author-room Positions, Ask retrieval |
| Resolved citations between works | resolver plus classifier | Connections, Later readers, Reception, cross-work links in the reader |
| Five-part index per work | extraction (`src: mine`) | Index tab, Ask starter questions, search chips |
| Page summaries, questions asked, terms defined | model | Research panel, work analysis |
| Work guide (blurb, theses, argument map, start points) | model, checked against the library | work hub, About-this-work |
| Word index with counts per form | indexing | author-room search, exact-word search |
| Embeddings | embedding model | Power Search, By idea, Related passages, Ask retrieval |
| Per-answer verification | server: support check and exact-quote check | Ask check line |

### 6.3 Client state (all the keys a rebuild must model per user)

Local storage: `fr_lastread`, `fr_theme`, `fr_font`, `fr_lh`, `fr_rdsz_m`, `fr_lasz`, `fr_ensz`, `fr_imz`, `fr_lanes2`, `fr_flow`,
`fr_appx`, `fr_para_split`, `fr_split`, `fr_read_chrome`, `fr_hl_ranges`, `fr_coach_v1`, `fr_collections_v1`, `fr_pincol`,
`fr_pins`, `fr_notebook`, `fr_docs` (Desk papers), `fr_compare_views_v1`, `fr_chats` (mirror of the last 40 conversations),
`fr_ask_notify`, `fr_source_w`, `fr_sd_layout`, `fr_sd_theme`, `fr_cp_follow`, `fr_cp_lang`, `mo-scripture-dev:translation`,
`mo-tfr-uses:v1`, `tfr_tours_done`, survey keys, `mo_tfr_beta_claimed_v1`. Session storage: `fr_cp_off`, `fr_contents_v1:<work>`,
`fr_desk_insert_v1`. IndexedDB `fr-conversations` v1 (conversations, meta). Server side: bookmarks (per member, shared with the
publisher's essay bookmarks), Deep research jobs, shared answers.

### 6.4 Analytics events

`work_open`, `work_depth`, `feature_use{feature: scripture, topics, modernize, notebook, today, browse, search}` to an events
endpoint; Plausible page events; PostHog for identified users; one `tfr_used` event per Central-time day per member.

---

## 7. What the platform does not do and we need

| Need | Reference state | Evidence | Our answer |
|---|---|---|---|
| Romanian | No Romanian text and no Romanian interface; languages are English plus the source languages (Latin, Greek, French); Orthodox content is thin (one Eastern Orthodox document, 157 authors under that tradition) | rail, shelves, traditions | Romanian is a first-class reading and interface language; vocabulary follows the author's tradition (`docs/arhitectura-app-biblica.md`, principle 5) |
| Bilingual interface | English only; no language switch anywhere | all pages | `uiLanguage` and `readingLanguage` are separate settings (ADR-013, `docs/multi-edition-spec.md`) |
| Two translations aligned to one source | One English text per work; the source lane is one language or a Greek and Latin pair; no second translation lane | reader 9.5 | up to three editions per work, every translation aligned paragraph to paragraph by `sourceId`; two translations made from the original, never from each other (ADR-013) |
| Translation transparency at paragraph level | per work only: kind, source language, review state, counts; model, date and reviewer are not disclosed | Transparency dialog | model, date, reviewer role and checks per edition; paragraph flags in the review sheet |
| Human review at scale | about 15,000 machine translations; every inspected one says "needs review" | Transparency dialog | publication policy decided by the owner (OQ-4): beta shows an explicit status; store release only for reviewed editions |
| Offline | none documented: pages fetch JSON at read time (a Genesis 1 view downloads about 9 MB of decoded citation JSON plus other layers) | Scripture data table | signed packs downloaded per edition, read from device storage (ADR-001, ADR-011) |
| Mobile apps | responsive web only; no native apps, no push | whole site | Expo app for iOS, Android and web from one code base |
| Dark mode everywhere | dark only in the reader, the Scripture working surface and Ask; the rest is forced light by a script | landing capture with the OS in dark mode | three themes on every screen |
| Accessible contrast | several text and control pairs fail WCAG AA (5.1) | audit | every text pair at least 4.5:1, control outlines at least 3:1 |
| Server-side conversations | Ask keeps conversations in the browser; the server stores only Deep research jobs and shared answers | Ask storage notes | decide in P2: local first plus Supabase sync |
| Per-user money budgets | a per-member monthly count plus a global daily spend budget that blocks everyone | Ask limits | budgets in money per user (architecture section 6) |
| Self-hosted Scripture | a third-party API; one translation (NIV) disappeared on 7 October 2026 | Scripture data | texts hosted by us with a licence record per translation |
| Romanian Scripture numbering | verses numbered as the ASV; only Psalm superscriptions are mentioned | Scripture data | explicit `versification_maps` from day one |
| Data export | Markdown of notebook and pages; no full-account export | reader panel | DSAR export in P4 |
| Search that understands Romanian | n/a | | Romanian-aware analysis (diacritic folding, stemming; glossary bridge in the gateway today) |

---

## 8. Quirks and drift in the reference (do not copy)

- Counts disagree by surface: 19,921 / 19,763 / 17,903 / 19,445 works; Latin Fathers 7,720 versus 8,989; copy says "ten shelves"
  and "thirty thousand works" while the data has eleven and about twenty thousand. Derive every count from one catalogue.
- Gating copy contradicts itself: tour cards say "Available to members" and show a MEMBERS pill while the dialogs say "free
  during the beta"; the landing lists tradition guides as free while the Guides page is behind the overlay; the Scripture
  free-trial counter described in code and the changelog is a hard gate in practice.
- The Authors H1 and group names, and the whole work hub (card title, section headings), fall back to a system serif; the Scripture
  desk names a font that is not loaded.
- The Scripture tour lights nothing on desktop for six steps; the Topics tour still points at a sidebar that no longer exists.
- Near-duplicate topics in Every doctrine (Election / Predestination / Election and Predestination) because it lists a raw mined layer.
- The Tools drawer overflows and clips "Research" on works with many buttons; the survey strip overlaps the page foot.
- `?sh=pl` shelf filters on Scripture and Topics links are ignored; the Doctrines copy says thirteen curated pages while Topics
  lists 45 loci; `/pins/` is titled "Bookmarks" but is the notebook manager.
- A dark preference is honoured by the reader script even though its own stylesheet comment says the OS must not choose dark.
- Test hooks (`?gate=force`) ship in production.

---

## 9. What could not be verified

- Everything behind an account: the signed-in Ask, Compare, Connections, Notebook, Bookmarks, Desk, Lexicon, Commentary Decks,
  Disputed Questions, Set Indexes, Page Scans, Power Search and Search page (reconstructed from public copy, tours, product images
  and client code; sizes read off 1200-px images are estimates). The Ask engine, models, prompts, quotas and budgets are unknown.
- The Scripture and Topics pages were seen only behind the overlay (DOM, tours, how-to images). The Guides, the Research panel and
  the Scan pane were never operated.
- Real devices: touch gestures, iOS safe areas, landscape and widths from 400 to 760 px; only Chromium emulation at 390x844,
  768x1024, 1024x768 and 1366x900. Print, high contrast and reduced-motion variants were not rendered.
- Hover and active states other than those measured; keyboard order of tab bars; behaviour of `Both` for other languages.
- Work hubs were read for one Migne work (four tabs by text, eleven tab labels); other works and the phone layout of the hub were
  captured only at the first screen.
- Counts are a snapshot of 4 November 2026 (the works index was generated on 27 September 2026) and drift daily.
- Licensing and provenance of the Bible texts, portraits and the machine-translated English were not examined.

---

## 10. Evidence index

All paths are local and gitignored; none is committed. `test-results/tfr/` is under `/home/user/biblicapp/`.

| Path | Holds |
|---|---|
| `test-results/tfr/css/` | `prdl-system.css` and the other stylesheets read (reader engine, skins, work hub, research panel, footnotes, margins) |
| `test-results/tfr/hl/` | landing, library, authors, traditions, guides, dictionary, glossary, about, pricing: 247 screenshots (D and P), extracted DOM and style JSON, page texts |
| `test-results/tfr/reader-shots/`, `reader-data/`, `reader-scripts/` | the reader on seven works, every panel and state, in-between widths, probe scripts |
| `test-results/tfr/st/` | Scripture, Verse Desk, Topics, Doctrines, Lexicon, Search, Commentary Decks, Resources (screenshots, tours, how-to images) |
| `test-results/tfr/ra/` | Research hub, gated shells, author room, tours, 20 public product images of the signed-in tools (`ra/howto/`) |
| `test-results/tfr/wh/` | the work hub capture of this document (`info.json`, `tabs.json`, screenshots) |
| session scratchpad `tfr/*.md` | the four crawl reports this inventory consolidates |
