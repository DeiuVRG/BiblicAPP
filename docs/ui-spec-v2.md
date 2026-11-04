# UI specification v2: reference-aligned, bilingual, ours

Status: specification for the interface pass requested by the owner on 4 November 2026 ("the app does not look like the
platform I showed you"; ADR-014 in `docs/decizii.md`). It targets `apps/mobile` (Expo: web, Android, iOS) and the Ask
screen on top of the gateway described in `docs/ask-api.md`. The reference is The Faith Received; what it is and does is
in `docs/the-faith-received-inventory.md` (feature IDs such as RD-26 point there). The plan is in `docs/roadmap-v2.md`.

How this relates to earlier documents: `docs/design-spec.md` ("editorial calm", Literata and Inter, burgundy accent)
stays valid for behaviour that this document does not change (routes keep working, settings keys keep working, the
no-hardcoded-colours test stays); its palette, type scale and layout sections are superseded here. `docs/multi-edition-spec.md`
(editions, reading language, interface language) is the data and behaviour base of the bilingual features below.

## Contents

1. [Principles and deviations](#1-principles-and-deviations)
2. [Design tokens](#2-design-tokens)
3. [Components](#3-components)
4. [Navigation shell](#4-navigation-shell)
5. [Landing](#5-landing)
6. [Library: shelves, centuries, search by name](#6-library-shelves-centuries-search-by-name)
7. [Work hub](#7-work-hub)
8. [Reader](#8-reader)
9. [Ask](#9-ask)
10. [Search](#10-search)
11. [Scripture view](#11-scripture-view) (later)
12. [Topics](#12-topics) (later)
13. [Other research tools](#13-other-research-tools) (later)
14. [Account, settings, consent](#14-account-settings-consent)
15. [About, help, transparency pages](#15-about-help-transparency-pages)
16. [Membership](#16-membership) (later)
17. [Language and content rules](#17-language-and-content-rules)
18. [Accessibility](#18-accessibility)
19. [Platform notes](#19-platform-notes)
20. [Acceptance criteria](#20-acceptance-criteria)
21. [Phase map and open questions](#21-phase-map-and-open-questions)

Phase tags used throughout: **[P1]** Beta 1 (navigation shell, landing, library, work hub, reader parity, Ask v1,
bilingual books); **[P2]**, **[P3]**, **[P4]** later phases of `docs/roadmap-v2.md`. A screen or part without a tag
is P1. Romanian strings are given as the product copy (the owner approves wording); the working product name is
"Biblioteca" (the app name today), final name is open question OQ-1.

---

## 1. Principles and deviations

1. **Looks like the reference, stays ours.** Same structure (two stacked bars, small-caps labels, hairlines instead of
   boxes, one terracotta accent, serif everywhere, almost no icons), our own name, copy, art and data.
2. **The reading rule is the product.** Every work is offered in Romanian and English whatever the original language
   (CLAUDE.md, ADR-013). Reading language and interface language are separate settings. Side-by-side reading of two
   editions, aligned paragraph to paragraph, is a primary control, not a hidden tool.
3. **Trust before text.** The way a text was made is stated before the text (Transparency panel). Everything computed or
   generated carries a "Metodologie / Methodology" note or an AI label. A quotation that cannot be found is called out,
   never silently kept.
4. **Nothing dead.** A module with no data renders nothing. A navigation item appears only when its screen is live
   (feature flags per section). Every link goes to something that exists.
5. **Accessibility floor.** Text 4.5:1, control outlines and focus rings 3:1, 44 px targets, visible focus, reduced motion,
   keyboard parity on web, screen-reader names for every control (section 18).
6. **One code base.** Expo for web, Android and iOS. Web-only enhancements are progressive; native gets an equivalent
   (section 19).
7. **Local first.** Reading, search, bookmarks and highlights work offline from signed packs. The network is for Ask,
   downloads and (later) sync.
8. **Tokens only.** Components read colours, sizes and fonts from the theme; the existing test that forbids colour literals
   outside the palette file stays.
9. **Two languages everywhere.** Every string exists in `ro.ts` and `en.ts` (the `Strings` type makes a missing key a
   type error). Romanian uses comma-below `ș` and `ț`, correct plural categories and century formats (section 17).
10. **Derived counts.** Every count on screen comes from one catalogue query (the reference's counts disagree by surface).

### Deviations from the reference (each has a reason)

| ID | Reference | Ours | Reason |
|---|---|---|---|
| D-01 | Dark and sepia only in the reader (everything else forced light) | Light, sepia and dark on every screen | design-spec 2.5, owner priority on dark mode; costs nothing with tokens |
| D-02 | Language cycle hidden in the Tools drawer | Language control in the reader toolbar (and under the title on phone) | bilingual reading is the product rule |
| D-03 | Fixed publisher masthead above the bar | Our brand bar, scrolls away; the section bar stays sticky | one product, less chrome (the bar's height is regained as soon as the page scrolls) |
| D-04 | `#c1593c` as text and under white labels (3.99:1 and 4.41:1) | `accent` for fills and graphics, `accentStrong #A8462B` for text and white-label fills | the 4.5:1 rule (inventory 5.1) |
| D-05 | 1 px `#d9c6a7` control outlines (1.6:1) | `borderStrong` for control outlines (at least 3:1), `border` for hairlines | WCAG 1.4.11 |
| D-06 | "Search whole work" is a gated server call | Find in text covers the whole edition, locally, free | the pack is on the device |
| D-07 | Transparency names kind, source language, review state, counts | also model, date, reviewer role, checks performed, source edition (section 8.6) | architecture: "model, reviewer, what was checked" |
| D-08 | Blocking account overlay on Scripture, Topics, Guides | No overlay. Ask is open in the beta; later gates are in-context dismissible sheets | the overlay swallows Esc and is soft in effect |
| D-09 | Source pane is an iframe of the reader | An embedded reader component; citations open RO and EN side by side | no iframe on native; aligned editions |
| D-10 | Arbitrary text selection with a floating bar | Paragraph actions (hover rail on web, long-press sheet on native) in P1; range selection on web in P2 | React Native `Text` has no custom selection toolbar |
| D-11 | Every rail item always visible | Items appear when their screen is live; a review flag shows all with a "Curând" pill | "nothing dead" |
| D-12 | Reader chrome in EB Garamond, text in Source Serif Pro | Source Serif 4 for text and chrome, IM Fell Great Primer only for display | fewer fonts to ship |
| D-13 | Flow vs Pages layout | Not offered (we have sections, not printed pages) | no printed-page data yet |
| D-14 | Continuous scroll of the whole work | One chapter per screen in P1 (end-of-chapter "next" card); continuous flow option in P2 | keeps deep links and position store; virtualisation work in P2 |

---

## 2. Design tokens

### 2.1 Colour (three themes)

Names keep the existing `Palette` fields (`background`, `surface`, `text`, `textMuted`, `border`, `borderStrong`, `accent`,
`onAccent`, `highlight`, `onHighlight`, `target`, `statusBar`); new fields are marked (new). Values derive from the
reference palette (`prdl-system.css`, the reader themes) and were adjusted only where a pair failed contrast. Migration note: `surface` changes meaning. Today it is the tinted block colour (`#F3F1EB` in light); it becomes the card colour (`#FFFDFA`), and the tinted panel colour moves to `cream`. `accent` keeps its role of "the brand colour" but is no longer used for text; text and links move to `accentStrong`.

| Token | Light "Paper" | Sepia | Dark "Ink" | Role |
|---|---|---|---|---|
| `background` | `#F6F3F2` | `#EEE7D9` | `#222320` | page ground, section bar, text area |
| `surface` | `#FFFDFA` | `#FAF6EC` | `#2B2C29` | cards, inputs, popovers, toolbar buttons |
| `cream` (new) | `#F5EFE1` | `#E8E0CF` | `#242521` | brand bar, reader toolbar, outline panel, beta band |
| `warm` (new) | `#F1E0C9` | `#E2D5BB` | `#33302A` | warm bands and plates (text on it: `text` only) |
| `text` | `#2D2927` | `#302C24` | `#E9E9E5` | body text |
| `textMuted` | `#6F6A64` | `#5F574A` | `#B0B0A8` | meta, counts, inactive items (never on `warm` or `highlight`) |
| `border` | `#D9C6A7` | `#D8D0C1` | `#454740` | hairlines, card borders, separators |
| `borderStrong` | `#8A7F6E` | `#857759` | `#7C7D73` | outline of controls (inputs, segmented, secondary buttons) |
| `accent` (brand) | `#C1593C` | `#B5502F` | `#D79380` | fills without text, focus underline of tabs, graphics |
| `accentStrong` (new) | `#A8462B` | `#9C4126` | `#E3A58F` | links, small-caps labels, primary-button fill, citation chips |
| `accentHover` (new) | `#8F3B23` | `#823620` | `#EBB6A3` | hover and pressed of `accentStrong` |
| `onAccent` | `#FFFFFF` | `#FFFFFF` | `#222320` | label on `accentStrong` (and on `accent` in sepia and dark) |
| `highlight` | `#FBE9C8` | `#F0DFA8` | `#4D3B1C` | search hits and amber highlight |
| `onHighlight` | `#2D2927` | `#302C24` | `#F3EEE2` | text on `highlight` |
| `target` | `#F7F1DC` | `#E7DFCF` | `#2F2D22` | paragraph a link jumped to (fades in 300 ms) |
| `masthead` (new) | `#2A231D` | `#2A231D` | `#15120E` | dark bands (landing hero overlay, "Autori" band, footer) |
| `mastheadInk` (new) | `#EFE7DA` | `#EFE7DA` | `#EFE7DA` | text on `masthead` |
| `mastheadAccent` (new) | `#EE7D51` | `#EE7D51` | `#EE7D51` | kickers and numerals on `masthead` |
| `danger` (new) | `#9C4126` | `#8F3B23` | `#EBA08C` | error text |
| `statusBar` | dark | dark | light | |

Highlight washes (user highlights, five colours; the text on every wash is `text`, at least 8.8:1):

| Wash | Light | Sepia | Dark | Swatch ring |
|---|---|---|---|---|
| amber | `#FBE9C8` | `#F0DFA8` | `#4D3B1C` | `#E8B04B` |
| sage | `#E7EFE0` | `#D9E3CC` | `#2C3A2A` | `#8FAE6F` |
| slate | `#E5ECF3` | `#D3DEE8` | `#26313F` | `#7D97BD` |
| rose | `#F3E0E4` | `#EAD0D5` | `#46282F` | `#D4879A` |
| lilac | `#E9E1F2` | `#DDD2EA` | `#372848` | `#9A86C4` |

Shelf identity colours (library data views, P3): Latin `#A8462B`, Greek `#3E5F8A`, Eastern `#7A6025`, English `#3F6B4E`,
Medieval `#5B4E7A`, Catholic `#8E2F39`, Reformed `#4A6178`, Lutheran `#2F6F62`, Humanism `#6E5A3A`; lifted variants in dark
are chosen at implementation with the same contrast test. They colour bars and swatches only, never text.

**Contrast, computed with the WCAG 2.x relative-luminance formula** (the script is in the implementation task;
`apps/mobile/src/__tests__/theme.test.ts` already holds the helper and must list these pairs):

| Pair (foreground on background) | Needs | Light | Sepia | Dark | Use |
|---|---|---|---|---|---|
| `text` on `background` | 4.5 | 13.05 | 11.29 | 12.98 | body text |
| `text` on `surface` | 4.5 | 14.19 | 12.87 | 11.54 | body text |
| `text` on `cream` | 4.5 | 12.56 | 10.58 | 12.67 | body text |
| `text` on `warm` | 4.5 | 11.14 | 9.57 | 10.80 | body text |
| `textMuted` on `background` | 4.5 | 4.85 | 5.79 | 7.24 | muted text |
| `textMuted` on `surface` | 4.5 | 5.27 | 6.60 | 6.44 | muted text |
| `textMuted` on `cream` | 4.5 | 4.67 | 5.42 | 7.07 | muted text |
| `accentStrong` on `background` | 4.5 | 5.32 | 5.34 | 7.56 | links, labels |
| `accentStrong` on `surface` | 4.5 | 5.78 | 6.09 | 6.72 | links, labels, chips |
| `accentStrong` on `cream` | 4.5 | 5.12 | 5.00 | 7.38 | links, labels |
| `accentStrong` on `warm` | 4.5 | 4.54 | 4.52 | 6.29 | labels on plates |
| `onAccent` on `accentStrong` | 4.5 | 5.87 | 6.57 | 7.56 | primary button label |
| `onAccent` on `accent` | 4.5 | **4.41** | 5.06 | 6.30 | see rule below |
| `onHighlight` on `highlight` | 4.5 | 12.07 | 10.47 | 9.26 | search hit |
| `text` on `target` | 4.5 | 12.74 | 10.49 | 11.35 | jumped-to paragraph |
| `textMuted` on `target` | 4.5 | 4.74 | 5.38 | 6.33 | muted inside it |
| `mastheadInk` on `masthead` | 4.5 | 12.61 | 12.61 | 15.21 | dark band text |
| `mastheadAccent` on `masthead` | 4.5 | 5.67 | 5.67 | 6.84 | kickers on dark bands |
| `danger` on `background` | 4.5 | 5.95 | 6.06 | 7.48 | error text |
| `danger` on `surface` | 4.5 | 6.47 | 6.91 | 6.65 | error text on cards |
| `borderStrong` on `background` | 3 | 3.56 | 3.57 | 3.79 | control outline |
| `borderStrong` on `surface` | 3 | 3.87 | 4.07 | 3.37 | control outline |
| `borderStrong` on `cream` | 3 | 3.43 | 3.35 | 3.70 | control outline |
| `accent` on `background` | 3 | 3.99 | 4.11 | 6.30 | focus underline, graphics |
| `accent` on `surface` | 3 | 4.34 | 4.69 | 5.60 | graphics |
| `accent` on `cream` | 3 | 3.85 | 3.85 | 6.15 | graphics |

Rules that follow from the table: (1) In the light theme a label on an `accent` fill is not allowed below 24 px (or
18.66 px bold); small labels sit on `accentStrong`. (2) `textMuted` is not placed on `warm` or `highlight` (4.14:1 and
4.49:1 in light). (3) Text over a photograph sits on a scrim that makes the lightest 5 % of the covered area at least
4.5:1 against the text (checked by sampling the screenshot, section 20). (4) Colour never carries meaning alone:
statuses have text, and stance or shelf colours always come with a label.

### 2.2 Fonts

| Role | Family (package) | Files bundled | Notes |
|---|---|---|---|
| Display | IM Fell Great Primer (`@expo-google-fonts/im-fell-great-primer` 0.4.0) | `400Regular`, `400Regular_Italic` (207 + 239 KB) | hero and band headings, stat numerals, gate and panel titles (italic). Only weight 400 exists: never request a bold weight (Android synthesises it badly). Verified: covers `ă â î ș ț Ă Â Î Ș Ț`, `„ ” « »`, dashes, ellipsis, pilcrow |
| Text and UI | Source Serif 4 (`@expo-google-fonts/source-serif-4` 0.4.2) | `400Regular`, `400Regular_Italic`, `600SemiBold`, `600SemiBold_Italic`, `700Bold` (322 + 203 + 322 + 203 + 322 KB) | the family the reference calls Source Serif Pro; covers Romanian comma-below letters (verified) |
| Reading option | Literata (already bundled, `@expo-google-fonts/literata`) | existing five files | stays as a choice in Settings and `Aa` ("Literata") |
| Sans option | Inter (already bundled) | existing three files | not used for chrome any more; kept only as the "Sans" reading option. Remove it in P2 if unused |
| Greek originals | Gentium Plus (`@expo-google-fonts/gentium-plus` 0.4.0) | `400Regular`, `400Regular_Italic` (780 + 829 KB) | used for a reading lane whose edition language is `grc` (and any text with Greek Extended letters). Source Serif 4 covers basic Greek (U+0370-03FF) but **not** polytonic Greek (U+1F00-1FFF), verified with a cmap check; Gentium Plus covers polytonic Greek and the Romanian letters. Loaded only when a Greek edition is installed |

About 1.8 MB of TTF for the display and text families before compression (plus about 0.8 MB for Gentium Plus regular when Greek editions are installed; Latin needs nothing extra: Source Serif 4 has the long s, `æ`, `œ` and macrons). Splash (native) and a blank page (web, the HTML
template paints the background) are held until fonts are ready, as today. Web fallbacks: `Georgia, "Times New Roman", serif`.
The reference's EB Garamond is not used (D-12).

### 2.3 Type scale

Sizes in points (RN) or CSS px (web). Phone is below 768 px wide, "wide" from 768 px. System font scaling applies on top and
is capped at 1.5 for UI (existing `UI_MAX_FONT_SCALE`); reading text honours it fully.

| Token | Family and weight | Phone size / line | Wide size / line | Tracking | Use |
|---|---|---|---|---|---|
| `displayXL` | IM Fell 400 | 29 / 33 (`clamp(22, 7.4vw, 32)`) | 52 / 56 | 0 | landing hero H1 |
| `displayL` | IM Fell 400 | 32 / 36 | 52 / 56 | 0 | page hero H1 |
| `displayM` | IM Fell 400 | 26 / 30 | 38 / 42 | 0 | band H2 |
| `displayS` | IM Fell 400 (italic for panel and gate titles) | 22 / 26 | 28 / 32 | 0 | card and panel titles |
| `numeral` | IM Fell 400 | 36 / 40 | 46 / 50 | 0 | stat figures, ordinal numerals |
| `title` | Source Serif 4 600 | 20 / 26 | 22 / 28 | 0 | library row and work titles |
| `heading` | Source Serif 4 600 | 18 / 24 | 20 / 26 | 0 | section headings, tab panels |
| `lead` | Source Serif 4 400 italic | 16 / 24 | 17 / 26 | 0 | editorial lead lines |
| `body` | Source Serif 4 400 | 17 / 27 | 17 / 27.2 | 0 | page text (not the reader) |
| `meta` | Source Serif 4 400 | 14 / 20 | 14 / 21 | 0 | meta lines, descriptions |
| `caption` | Source Serif 4 400 | 13 / 18 | 13 / 19 | 0 | notes, captions |
| `original` | Source Serif 4 400 italic | 15 / 22 | 15 / 22 | 0 | original title under a title |
| `label` | Source Serif 4 600, uppercase | 11 / 16 | 11 / 16 | 2.4 | filter labels, card kickers, stat captions |
| `kicker` | Source Serif 4 400, uppercase | 12 / 16 | 12 / 16 | 3.6 | hero eyebrow, section kicker |
| `rail` | Source Serif 4 400, uppercase (brand 600) | 12.5 / 16 | 13 / 16 | 1.3 | section bar items |
| `railDrawer` | Source Serif 4 400, uppercase | 13 / 18 | 12 / 16 | 0.78 / 0.72 | drawer items |
| `button` | Source Serif 4 600, uppercase | 13 / 16 | 13 / 16 | 1.8 | CTAs |
| `chip` | Source Serif 4 600, uppercase | 11 / 14 | 11 / 14 | 1.5 | status chips and badges |
| `chrome` | Source Serif 4 400 | 13 / 16 | 13 / 16 | 0 | reader toolbar buttons |
| `readerTitle` | Source Serif 4 400 | 16 / 20 | 20 / 25 | 0 | reader toolbar title |
| `chapterTitle` | Source Serif 4 600 | 1.24 em of reading size | 1.42 em | 0 | chapter card title |
| `eyebrow` | Source Serif 4 600, uppercase | 11.5 / 16 | 11.5 / 16 | 2.5 | chapter card eyebrow ("CAPITOLUL I") |
| `reading` | user font (Source Serif 4, Literata or Inter) | user size x line height | | 0 | reader text |
| `askAnswer` | Source Serif 4 400 | 17 / 1.7 | 18 / 1.75 | 0 | Ask answer body |

Reader defaults (new installs): font size 17 on phone and 20 on screens 1100 px and wider (range 14-34, step 1; existing
users keep their value); line spacing presets compact 1.45, normal 1.55 (dark 1.68), relaxed 1.85; measure `37 em`
capped by the container (so the line widens with the font, like the reference); paragraph spacing 0.58 em; no first-line
indent in single-lane mode, 1.45 em indent for running paragraphs in two-lane mode.

### 2.4 Spacing, layout, breakpoints

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 88. Gutters stay 24 (below 768) and 40 (768 and up).
- Containers (content width, gutters added): `wide` 1124 (landing, library, work hub), `tool` 1180 (filter panels), `list` 880,
  `narrow` 664 (About, Transparency), `reading` 37 em (cap 960), `two-lane` 1440, `ask` 760 (chat measure).
- Band padding: 88 vertical on wide, 56 on phone. Hero padding: 128/120 (landing), 92/84 (inner pages), 56/40 (library
  hero); phone 68/60 and 56/52.
- Breakpoints (window width): phone up to 640; sheet up to 700 (previews become bottom sheets); reader phone shell up to 880
  (new constant `READER_SHELL_MAX = 880`); `wide` from 768 (existing `WIDE_BREAKPOINT`); desktop from 1100 (new `DESKTOP_MIN = 1100`:
  outline in flow, docked Ask); `xl` from 1200 (reading cap grows to 960).
- Bar heights: brand bar 64 (phone 56); section bar 48 (phone 43); reader toolbar 67 (phone 53); thumb bar 61 plus the
  bottom safe area; progress bar 3.

### 2.5 Radii, borders, elevation

Radii: `xs` 2 (citation chips), `sm` 3 (cards, buttons, hairline controls), `md` 6 (inputs, dark buttons), `lg` 12 (sheets),
`xl` 14 (dialogs, composer), `pill` 999. Borders: `border` 1 px for hairlines (web 1 px, native `hairlineWidth`),
`borderStrong` 1 px for control outlines. Focus ring: 2 px `accentStrong`, offset 2 (web outline; native 2 px border on
the focused control). Elevation: none by default; cards on hover `0 1px 2px rgba(45,41,39,.04), 0 6px 20px rgba(45,41,39,.06)`
(web); popovers `0 10px 28px rgba(0,0,0,.12)`; dialogs `0 24px 60px rgba(0,0,0,.25)`; native uses a plain border plus
`elevation: 2` on popovers only.

### 2.6 Motion

Durations 140 ms (press), 200 ms, 300 ms; easing `cubic-bezier(.22,1,.36,1)` (default), `(.32,.72,0,1)` (drawers, panels),
`(.23,1,.32,1)` (entrances). Specific: press `scale(.96)` on web and opacity 0.7 on native; section drawer 300 ms; hero
highlight sweep 550 ms after a 250 ms delay, once; kicker pulse 2.4 s; loading text shimmer 2.4 s; target-paragraph fade 300 ms;
Ask progress dots 1.4 s. With reduced motion (`prefers-reduced-motion` on web, the OS setting on native) the sweep, pulse,
shimmer and drawer transitions are off and state changes are instant.

### 2.7 Icons

Typographic glyphs where the font has them (`‹ › × ← →`, "Aa"); otherwise one `Icon` component with 1.5 px strokes on a
20 px grid: menu, close, chevron (four directions), search, link, copy, bookmark (outline and filled), flag, theme
(half-circle, sun, moon), send (arrow up), stop, external, check, info. Drawn with `react-native-svg` only after the
CLAUDE.md native-module check (new architecture, 16 KB page alignment on the pinned version); until then they are built from
`View` shapes. No decorative illustration anywhere.

### 2.8 Art direction

Hero and band images are public-domain paintings or engravings chosen by us (open-access museum collections; each
licence checked per image and credited on the About page), never the reference's images. Treatment: WebP at most 200 KB,
dark gradient scrim `linear-gradient(#2d29274d, #2d2927e0 78%)`, centre-weighted crop, no text baked in. Fallback when an
image is missing or loading: flat `masthead` with the display type. Shelf plates are typographic tiles (shelf name in
`displayS` on `warm`, hairline border) until real plates exist. Portraits: public-domain engravings or none (initials on
`warm`).

---

## 3. Components

Every component reads the theme (`useTheme()`), is keyboard operable on web, has an accessible name in both languages and a
`testID` (becomes `data-testid` on web; names in section 20.2). States: hover (web) changes colour, never layout; pressed =
`scale(.96)` on web and opacity 0.7 on native; focus = the 2 px ring; disabled = 60 % opacity without hover.

| Component | Anatomy and behaviour | Variants and notes |
|---|---|---|
| `Button` | label in `button` style, radius 3, min height 44 (48 for the primary on phone) | `primary` (fill `accentStrong`, label `onAccent`); `outline` (1 px `borderStrong`, label `text`; on hover a fill sweeps left to right in 280 ms to `accentStrong` and the label turns `onAccent`); `ghost` (on dark bands: 1 px border at 55 % `mastheadInk`); `text` (underlined `accentStrong` link; the "NAME ›" caps variant moves its arrow 3 px on hover); `pill` (999 radius, account forms, P2). Loading: label becomes "..." and `aria-busy` |
| `Chip` | `chip` style, 1 px `border`, radius 999 (language and edition badges) or 3 (kind chips) | selected: fill `text`, label `background` (the reference's ink fill); status pill: bordered caps in `accentStrong` ("NEVERIFICATĂ") |
| `Tabs` | row of text tabs 14 px, 46 px high; active 600 `text` with a 2 px `accent` underline; inactive 400 `textMuted` | roving tabindex, arrows move focus, Enter or Space activates (manual activation, like the reference); scrolls horizontally on phone with an edge fade; counts appear in the label ("Cuprins · 11") |
| `Segmented` | existing control, re-skinned: 1 px `borderStrong`, radius 3, selected segment filled `accentStrong` with `onAccent` | wraps to two rows below 84 px per option (existing rule); radio-group semantics |
| `Disclosure` | closed by default; 36 px summary in `meta` with a `›` that rotates 90 degrees; body in `caption` | the "Metodologie" note; opens for print on web |
| `Dialog` | centred panel 480 wide (Transparency 560), `background`, 1 px `border`, radius 12, close ×, scrim `rgba(34,35,32,.45)`; phone: 358 wide at 16 px margins | focus trap, Esc closes, focus returns to the trigger; the page behind is inert |
| `Sheet` | bottom sheet up to 700 px width: full width, max height 70 %, top radius 12, bottom safe-area padding | replaces popovers on touch; drag-free (close button, scrim tap, Esc) |
| `Popover` | 460 px card under its trigger, flips above when it does not fit | opens on hover (120-220 ms) or focus or tap (pinned); Esc, scroll or opening another closes it; touch uses `Sheet` |
| `Toast` | `role=status` line at the bottom, 3 s | "Link copiat." |
| `CitationChip` | numeral in a pill (min 22 x 22 visible, 44 x 44 hit area), `cream` fill, 1 px `border`, radius 2, `accentStrong` 600 | hover or focus opens the preview (9.6); variant "unsent page" has a dashed border; unresolved reference is plain text "[?]" with a tooltip |
| `Hero` | background image under a scrim, kicker, H1, sub, buttons; `HighlightedLine` sweeps a bar of `accent` at 78 % behind the second line (large white text, 3:1 holds) | reduced motion: bar static |
| `Band` | full-width section with a background (`background`, `cream`, `warm`, `masthead`) and a centred container | padding from 2.4; alternate backgrounds to mark rhythm |
| `LibraryRow` | title (`title`, 600), italic original title (`original`), meta line (`label`: author, year, century), right-aligned edition badges; hairline between rows; the whole row is the link | hover: title in `accentStrong`, underlined |
| `WorkCard` | 1 px `border`, radius 3, padding 18/20/16; lines: group (caps `accentStrong`), era (caps `textMuted`), title (`title`), description (`meta`, hidden on phone), edition badges, "CITEȘTE ›" | hover: border `accent`, arrow +3 px |
| `ShelfCard` | typographic plate (shelf name in `displayS` on `warm`), name, count line (`meta`), who-line (italic 12 px, two lines max) | hidden when the shelf has no work |
| `StatTile` | `numeral` over a `label` caption in a 1 px bordered tile 220 x 76 | work hub and landing |
| `StartList` | numbered circles 1.7 rem, a terracotta underlined link and one sentence of why | "Unde să începi" |
| `SearchField` | 48 px (44 min), 1 px `borderStrong`, radius 6, 16 px text (no iOS zoom), clear button inside, `type=search` | focus ring replaces the border |
| `FoldCard` | chapter card, section 8.4 | |
| `ProgressBar` | 3 px, `text` fill on `border` track, fixed to the bottom of the reader | |
| `ThumbBar` | phone reader only: 61 px, `surface`, 1 px top border, four cells | 8.12 |
| `LanguageSwitch` | interface language `RO` and `EN`, two segments, 32 px high | brand bar |
| `ThemeButton` | cycles Light, Sepia, Dark, then Auto; shows the current state in its accessible name | brand bar; Settings has the full selector |
| `EmptyState` / `ErrorState` / `LoadingText` | centred serif title and one action / `role=alert` with a 2 px left rule in `danger` / shimmering text | lists say what is missing; modules without data render nothing |

---

## 4. Navigation shell

### 4.1 Brand bar (the masthead)

Replaces the publisher's masthead of the reference (inventory SH-01). Height 64 (phone 56), background `cream`, 1 px `border`
below, scrolls away with the page (the section bar stays). Content: left, the mark and the wordmark "Biblioteca" in `displayS`
italic (link to `/`); right, in order: search icon button (opens `/search`, shortcut `/`), `LanguageSwitch` (RO | EN), `ThemeButton`,
the primary `Button` "Întreabă" / "Ask" (small, `accentStrong`), and later "Intră / Sign in" [P2] and "Susține / Support" [P4]. On
phone the right side is the "Întreabă" button and a menu button that opens a right-hand drawer (304 px, 260 ms slide, close ×)
with the language switch, the theme selector, About links, Settings and (later) account. The brand bar is not shown inside the
reader (the reader has its own toolbar; the section bar does show, see 8.1).

### 4.2 Section bar (the "rail")

Sticky under the brand bar (web `position: sticky; top: 0`; native: rendered outside the scroll view). Height 48 (phone 43),
background `background`, 1 px `border` below, items in `rail` style (small caps, tracking 1.3), colour `textMuted`; the brand
item "BIBLIOTECA | ACASĂ" has "BIBLIOTECA" in 600 `text` and "| ACASĂ" in 400 `textMuted`. Hover, pressed and the open state use
`accentStrong`; the current item uses `text`. A drawer item shows `›` (closed) or `‹` (open) after its label.

| Key (`testID`) | RO | EN | Route | Drawer | Phase |
|---|---|---|---|---|---|
| `home` | BIBLIOTECA / ACASĂ | LIBRARY / HOME | `/` | | P1 |
| `search` | CĂUTARE | SEARCH | `/search` | | P1 |
| `read` | CITEȘTE › | READ › | | Selecție `/library` [P1]; Toată biblioteca `/library/all` [P1]; Autori `/authors` [P1]; Tradiții `/traditions` [P2]; Ghiduri `/guides` [P3]; Dicționar [only when a reference work exists] | P1 |
| `scripture` | SCRIPTURA | SCRIPTURE | `/scripture` | | P2 |
| `topics` | TEME | TOPICS | `/topics` | | P3 |
| `research` | CERCETARE › | RESEARCH › | | Întreabă `/ask` [P1]; Marcaje `/bookmarks` [P1]; Caiet `/notebook` [P2]; Căutare după sens `/search?mode=meaning` [P2]; Compară, Conexiuni, Lexicon, Comentarii, Întrebări disputate, Indexuri, Scanări, Birou [P3] | P1 |
| `resources` | RESURSE | RESOURCES | `/resources` | | later |
| `about` | DESPRE › | ABOUT › | | Despre bibliotecă `/about` [P1]; Transparență `/about/transparency` [P1]; Cum se folosește `/about/how-to` [P2]; Tur ghidat `/about/tour` [P3] | P1 |

In P1 the bar therefore shows five items (home, search, read, research, about) and the Research drawer two. Items and drawer
entries are switched on by feature flags (`features` in the app config); a build flag `EXPO_PUBLIC_SHOW_ALL_SECTIONS=1` shows
all of them with a "Curând / Soon" pill for design review, and the destination renders the Coming state (a centred title and
one sentence). The order is always the reference's order.

### 4.3 Drawers

- Desktop (above 640): the drawer opens along the bar: it is hidden until first use, then its width animates from 0 to its
  content width in 300 ms (premium curve), the other items slide left, and the caret flips. Items are 12 px caps, tracking
  0.72, gap 18, 42 px high. When the open drawer is wider than the window (Research with twelve items) the bar scrolls
  sideways and a hairline scroll cue with a thumb appears under it.
- Phone (up to 640): the drawer drops as a full-width panel under the bar (`background`, shadow
  `0 14px 28px -18px rgba(0,0,0,.45)`, one 48 px row per entry, 13 px caps, tracking 0.78, hairlines between); opened
  synchronously (no animation frame). The panel is rendered as a child of the bar container so a scrolling bar cannot clip it.
- Rules: one drawer open at a time; `aria-expanded` and `aria-controls` kept in sync; Esc closes it and returns focus to its
  toggle; a press outside, a route change or crossing 640 px (rotation) closes it; Left and Right arrows move between bar items,
  Down opens a drawer and moves focus to its first entry. The link whose route matches gets `aria-current="page"`, its group
  toggle gets the darker current style.
- The bar scrolls horizontally on phone (hidden scrollbar, padding 2/34/3/16, gap 14-16) with a 24 px edge fade on the right
  as the scroll cue; the first three items fit without scrolling.

### 4.4 Routes

| Route | Screen | Phase | Notes |
|---|---|---|---|
| `/` | Landing | P1 | new; today's library screen moves to `/library/all` |
| `/library` | Selecție (curated Browse) | P1 | |
| `/library/all` | Toată biblioteca (filters in the query string) | P1 | `shelf`, `century`, `tradition`, `lang`, `q`, `letter`, `view=author\|century`, `page`; defaults omitted; written with `replaceState` |
| `/authors`, `/authors/[slug]` | Authors index, author page | P1 (simple), P2 (room) | |
| `/traditions`, `/traditions/[slug]` | Traditions | P2 | |
| `/work/[id]` | Work hub | P1 | existing; `?edition=<editionId>`; `#<tab>` for the tab |
| `/read/[id]/[section]` | Reader | P1 | existing; `?p=<paragraphId>`, `?q=<words>`, new `?lang=<edition language>` and `?pair=<lang>+<lang>` for two lanes |
| `/search` | Search | P1 | `?q=`, `?mode=works\|passages\|scripture\|meaning` |
| `/ask` | Ask | P1 | `?q=`, `?scope=work:<id>\|edition:<id>`, `?lang=ro\|en`, `?chat=<id>`, `?share=<id>` [P2] |
| `/bookmarks` | Bookmarks | P1 | local |
| `/about`, `/about/transparency` | About, policy page | P1 | |
| `/about/how-to`, `/about/tour` | Help | P2, P3 | |
| `/settings` | Settings | P1 | existing |
| `/scripture`, `/scripture/desk` | Scripture, Verse Desk | P2, P3 | `?ref=john.3.16&t=<translation>` |
| `/topics`, `/topics/[slug]` | Topics | P3 | |
| `/notebook`, `/desk`, `/research/*` | Notebook and the other tools | P2-P3 | |
| `/passage/[id]` | Passage permalink | P2 | resolves a source-paragraph id to the edition in the visitor's reading language |
| `/account` | Account | P2 | |

Static hosting keeps working through `404.html` (GitHub Pages) and the same rewrite on the custom domain.

### 4.5 Strings of the shell (RO / EN)

| Key | RO | EN |
|---|---|---|
| nav.home | Acasă | Home |
| nav.search | Căutare | Search |
| nav.read / curated / all / authors / traditions / guides / dictionary | Citește / Selecție / Toată biblioteca / Autori / Tradiții / Ghiduri / Dicționar | Read / Curated / Full library / Authors / Traditions / Guides / Dictionary |
| nav.scripture / topics / resources | Scriptura / Teme / Resurse | Scripture / Topics / Resources |
| nav.research / ask / semantic / compare / connections / decks / disputed / lexicon / indexes / scans / bookmarks / notebook / desk | Cercetare / Întreabă / Căutare după sens / Compară / Conexiuni / Comentarii / Întrebări disputate / Lexicon / Indexuri / Scanări / Marcaje / Caiet / Birou | Research / Ask / Search by meaning / Compare / Connections / Commentary decks / Disputed questions / Lexicon / Set indexes / Page scans / Bookmarks / Notebook / Desk |
| nav.about / aboutLibrary / transparency / howTo / tour | Despre / Despre bibliotecă / Transparență / Cum se folosește / Tur ghidat | About / About the library / Transparency / How to use / Guided tour |
| soon | Curând | Soon |
| menu.open / close | Deschide meniul / Închide meniul | Open menu / Close menu |

---

## 5. Landing

Route `/`. Purpose: say what the library is, show named works before any count, show the shelves, explain how it is free,
send people to reading or to Ask. One scrolling page; bands in the order below (inventory 4.1 has the reference's).

| # | Band | Background | Content | Phase |
|---|---|---|---|---|
| 1 | Hero | image under scrim, `masthead` fallback | kicker (`kicker`: "¶ BIBLIOTECA" and a BETA pill), H1 `displayXL` in two lines with the highlight sweep on line two, sub (`body` 17, 84 % `mastheadInk`, max 527), buttons `primary` "ÎNCEPE LECTURA" (to `/library`) and `ghost` "ÎNTREABĂ BIBLIOTECA" (to `/ask`), two text links ("Despre Bibliotecă ›", "Tur ghidat ›" when the tour exists). Height 560-640 wide, content-sized on phone | P1 |
| 2 | Doors | `background` | one door per live section: Citește, Întreabă, then Scriptura [P2] and Teme [P3]; each H3 `displayS`, text `meta`, link line "NUME ›" in `railDrawer` caps. Layout `auto-fit, minmax(240px, 1fr)` so two doors share the width; hairlines between on phone | P1 |
| 3 | Free statement | `background` | one paragraph: all books are free to read; Ask is open during the beta and will ask for a free account afterwards. No pricing in P1 | P1 (pricing block P4) |
| 4 | Editorial split | `cream` | public-domain image (framed, 3 px `text` border) and kicker, H2 `displayM`, one paragraph of our own words about writing meant to be used, button `outline` "CITEȘTE" | P1 |
| 5 | Figures and audiences | `masthead` over an image, scrim 78-86 % | four `StatTile` figures computed from the catalogue (works, editions, languages, "Gratuit"); H2 "Cui se adresează"; three columns Mireni, Păstori, Cercetători (`heading`, `body`); stacks below 900 | P1 |
| 6 | "În bibliotecă" | `background`, top hairline | a grid of `WorkCard` for every work (up to 12, newest or curated first); 4 columns wide, 2 below 1100, 1 below 600; link "RĂSFOIEȘTE TOATĂ BIBLIOTECA ›" | P1 |
| 7 | "Studiu" | `masthead` | two-lane reading preview (a static picture of our reader in Both mode, generated by the screenshot script) beside kicker "STUDIU", H2 "Citește traducerea lângă original.", text, button `outline` "ÎNCEARCĂ" opening a sample section in Both mode | P1 |
| 8 | "Rafturile" | `background` | `ShelfCard` per shelf that holds works, 5 per row wide, 1 per row phone; counts as "N lucrări" (plural rules, 17.2); button `primary` "TOATĂ BIBLIOTECA" | P1 |
| 9 | "Explorează biblioteca" | `background`, top hairline | rows (label 15/600 and a clause) for the live sections only, three columns wide | P2 |
| 10 | Membership | | plans, toggle, other memberships | P4 |
| 11 | Beta band | `cream` | "BETA" kicker (17 px, tracking 5), one sentence, `outline` "TRIMITE FEEDBACK" (a mail link in P1, the form in P2) | P1 |
| 12 | Transparency band | `background`, narrow container | H2 "Angajamentul nostru de transparență", short paragraph, `primary` "CITEȘTE ANGAJAMENTUL" to `/about/transparency` | P1 |
| 13 | Footer | `background` | links (Despre, Transparență, Contact, Termeni and Confidențialitate in P4), language switch, version | P1 |

Copy (our own words; the owner approves). H1: RO "Tradiția creștină, / în limba ta." EN "The Christian tradition, / in your language." Sub: RO "Cărți
creștine vechi, în română și în engleză, cu originalul alături. Un asistent răspunde numai din texte, cu trimiteri la paragraf."
EN "Classic Christian books in Romanian and English, with the original beside them. An assistant answers only from the texts,
with citations to the paragraph." Doors: Citește (RO "Răsfoiește rafturile sau caută după autor și titlu.", EN "Browse the shelves
or search by author and title."), Întreabă (RO "Pune o întrebare și citește un răspuns cu trimiteri la paragrafele bibliotecii.",
EN "Ask a question and read an answer that cites the library's paragraphs.").

Behaviour: hero sweep and kicker pulse (reduced-motion safe); counts replaced once the catalogue is read (no layout jump: the
tiles reserve their height); every card and door is a link; the page works offline from the installed packs (the catalogue is
local; the hero image falls back to `masthead`). Phone: the section bar is the only fixed chrome; hero text 29/33; buttons
stacked (12 px gap); collection cards drop description and arrow (119 px tall); all grids one column except the figures (2 x 2).
Dark: bands map to `background`, `cream`, `masthead`; images get a 10 % darker scrim.

---

## 6. Library: shelves, centuries, search by name

Reference: inventory LB-01 to LB-14. The library list no longer shows a licence chip (task "Finisare UI"); the licence lives on
the work hub and in the Transparency panel. Everything here reads one signed catalogue (6.8) and the installed packs, so it works
offline and every count agrees with every other count.

### 6.1 Selecție (curated Browse), `/library` [P1]

- Hero (`displayL`, 380 px wide, content-sized on phone): eyebrow "BIBLIOTECA", H1 RO "Ce vrei să citești?" / EN "What would you like to read?",
  a joined search form (`SearchField` 660 px plus a `Button` "CAUTĂ" 121 px) with placeholder RO "Caută o lucrare sau un autor", and
  buttons: `primary` "TOATĂ BIBLIOTECA", `outline` "AUTORI", "TRADIȚII" [P2], "GHIDURI" [P3] (wrap to a second row at 780 px, two columns
  on phone). Submitting goes to `/library/all?q=` (it does not need an account).
- Folding bands (`details`, open by default, chevron at the far right of the header; header = `label` and `displayM`). A band
  renders only when it has at least one item.

| Band | Background | Label and H2 (RO) | Content |
|---|---|---|---|
| 1 | `cream` | CREZURI ȘI CATEHISME / "Ce mărturisește Biserica" | works of the `creeds` shelf, rows with 28 px titles (`displayS`), original title, "GRUP · DATĂ" meta |
| 2 | `background` | ÎNCEPE AICI / "Lucrări de citit întâi" | the editorial list `start-here` (up to 10, two columns) |
| 3 | `masthead` | AUTORI / "Autori pe care îi poți citi" | up to 30 authors, three columns, names in `mastheadInk` 28 px with "NUME COMPLET · n. AN"; link "TOȚI AUTORII ›" |
| 4 | `cream` | PĂRINȚII BISERICII / "Citește Părinții Bisericii" | works of the `fathers` shelf, three columns, "AUTOR · DATĂ" |
| 5 | `background` | GHIDURI | guide teasers [P3] |
| 6 | `warm` | RAFTURI / "Toate tradițiile prezente aici" | one block per shelf with five featured works (title, italic original title, author) and a footer line "TOATE N LUCRĂRILE ›" |

Row anatomy: `LibraryRow` (6.2). Phone: one column, fold headers keep the chevron.

### 6.2 Toată biblioteca, `/library/all` [P1]

Reference: LB-02 to LB-07. Zones top to bottom:

1. Hero: eyebrow "BIBLIOTECA · TOATE LUCRĂRILE", H1 "Toate lucrările bibliotecii" / "Every work in the library", one sentence, button "AUTORI".
2. "Răsfoiește rafturile" fold: a 62 px row (`cream`, 1 px `border`, radius 3) with H2 "Răsfoiește rafturile" and "N RAFTURI" and a chevron; opens to a
   three-column grid of `ShelfCard` (one column on phone); choosing a shelf sets `?shelf=` and replaces the fold with a left-arrow link
   "← Toate rafturile". Each card has a "Studiază raftul" disclosure [P2] (Ask this shelf first).
3. View tabs (`Tabs`, 16 px): "După autor" (default) and "După secol".
4. Filter panel (`cream`, 1 px `border`, radius 3, padding 20): `SearchField` (placeholder "Caută după autor sau titlu...", 180 ms
   debounce, aria-label "Caută în bibliotecă după autor sau titlu"); a **count line** in `label` style that always says what the list is
   ("12 LUCRĂRI ÎN TOATĂ BIBLIOTECA", "3 LUCRĂRI CU „AUGUSTIN” ÎN TOATĂ BIBLIOTECA", "2 LUCRĂRI ÎN RAFTUL PĂRINȚII BISERICII ȘI SECOLUL V");
   selects with `label` captions in `accentStrong`: RAFT, SECOL (with counts), TRADIȚIE (with counts), LIMBA ORIGINALULUI, DISPONIBILITATE
   (Toate, Română, English, Traducere parțială); on the right "N lucrări fără dată" when there are any. Any filter resets letter and page.
5. A-Z bar: "TOATE 12", then letters with counts (`label`, count 9 px); letters without authors are omitted; the active letter is bold and
   underlined; hit areas are 44 px high; two rows wide, one scrolling strip on phone. Letters are the folded first letter of the sort name
   (`Intl.Collator('ro')` orders, diacritics fold: `Ș` and `S` share the bar entry `S`).
6. The list: authors alphabetically, two columns wide (one phone). Each author is a `details` accordion: chevron, name (13/600 caps,
   `accentStrong`), "N lucrări" right-aligned. Opened: link "DESPRE <NUME> ›" (to `/authors/[slug]`), then one `LibraryRow` per work. When the result
   has twelve authors or fewer, every accordion starts open (at our scale a wall of closed accordions is worse than a list).
   Pager `← ANTERIOARA | 1 2 3 | URMĂTOAREA →` only above 100 authors.

`LibraryRow` anatomy: title in the reading language (`workTitle`), italic original title when different, a meta line in `label`
style ("GEERHARDUS VOS · 1903 · ENGLEZĂ"), on the right the edition badges ("RO", "EN", "LA" as `Chip`; a "PARȚIAL" chip when an edition is
partial) and, in the reference, the volume citation: ours shows the shelf label on wide screens. No licence chip. The row's accessible name lists title, author
and editions (existing pattern in `library-screen.tsx`).

**By century** (tab "După secol"): the text "Alege un secol pentru a vedea ce conține raftul din el." and tiles for the centuries that have
works (a tile is 73 x 55 at least: Roman numeral in `numeral`, caption "N lucrări"); choosing one sets `?century=` and returns to "După
autor". A note "N lucrări nu au dată" appears when needed. Centuries without works are not drawn.

**Empty result:** `EmptyState` "Nicio lucrare nu corespunde filtrelor." with a `text` button "Șterge filtrele". **Loading:** existing `LoadingView`.
**Phone:** filters stack one control per row, the A-Z bar is a strip, the list is one column. The whole state lives in the URL (4.4).

### 6.3 Shelves [P1]

Shelves are editorial groupings (a work can sit on several). Proposed starting set, labels in both languages (decision OQ-3: the
owner confirms or replaces it, in particular the place of an Orthodox shelf for the Romanian market):

| Slug | RO | EN | First candidates |
|---|---|---|---|
| `creeds` | Crezuri, mărturisiri și catehisme | Creeds, confessions and catechisms | creeds, Heidelberg Catechism, Westminster Shorter Catechism |
| `fathers` | Părinții Bisericii | Church Fathers | Augustine |
| `medieval` | Evul Mediu | The Middle Ages | Anselm, Bernard, Aquinas |
| `reformation` | Reforma | The Reformation | Hubmaier, Valdés, Grotius |
| `puritans` | Puritani și teologi englezi | Puritans and English divines | |
| `modern` | Teologie modernă | Modern theology | Vos, Schleiermacher |
| `devotional` | Viață duhovnicească | Spiritual life | Imitation-type works |
| `orthodox` | Ortodoxie | Orthodox writers | to be sourced |

A shelf page is `/library/all?shelf=<slug>` with a shelf hero (eyebrow "BIBLIOTECA · RAFT", H1 the shelf name, the description) and the
same list. A shelf with no work is not shown anywhere. A `ShelfCard` shows a typographic plate, the name, "N lucrări" (plural rules),
and a who-line of up to five author surnames in italic (`label`-adjacent 12 px, two lines at most).

### 6.4 Centuries [P1]

`century = ceil(year / 100)` of the work's original year; when the year is missing the author's active midpoint; otherwise "no date".
Display RO short "sec. V", long "secolul al V-lea" (first century: "secolul I"); EN "5th century". Century tiles and the SECOL select use
the short form; the count line uses the long form.

### 6.5 Search by name [P1]

Ranking, as in the reference: authors whose name matches, then works that name them, then works matching the title or the meta;
accents and case fold (existing `search/fold.ts`); 180 ms debounce; matches highlighted in the row; `/` focuses the field on web; Esc
clears it. The same logic powers the hero form of 6.1 and the "Lucrări" mode of Search (section 10).

### 6.6 Authors [P1 simple, P2 room]

`/authors`: hero (eyebrow "BIBLIOTECA · AUTORI", H1 "Autori"), a filter card with one field "Caută un autor după nume" (period and order selects [P2]),
a result line ("N autori"), then rows: name in the reading language, "n. 354 · Părinții Bisericii · latină", "N lucrări" right-aligned. `/authors/[slug]`:
name (`displayL`), dates and tradition, a short biography (two or three sentences, labelled "Prezentare editorială" or, if generated,
"Text generat cu AI" with a `Disclosure` "Metodologie"), "Întreabă despre acest autor" (opens `/ask?scope=edition:<ids>` over the author's editions),
and the works as `LibraryRow`. The author room of the reference (quick facts, picks, cites most and cited by, tabs) is P2-P3.

### 6.7 Traditions [P2]

`/traditions`: a hairline list of rows (name 21 px, one-line description, meta "DIN <AN> · N DOCUMENTE · N AUTORI"); detail page with the
overview, related traditions, documents by year with a type tag (crez, mărturisire, catehism), authors by birth. Needs the controlled
vocabulary of 6.8.

### 6.8 Catalogue data (signed)

A signed `catalogue.json` ships next to the packs (same Ed25519 key, verified at load; built from `content/catalogue/*.json` by
`content-tools`). It is the single source for counts and lists.

```
shelves[]:   { slug, order, labelRo, labelEn, descRo, descEn }
traditions[]: { slug, parent?, labelRo, labelEn, descRo, descEn, from? }                      (P2)
authors[]:   { slug, nameRo, nameEn, nameOrig, born, died, tradition, bioRo, bioEn, bioKind: 'editorial'|'ai' }
works[]:     { workId, slug, authorSlug, shelves[], kind, centuryOverride?, blurbRo, blurbEn, blurbKind, start[]: { paragraphId, whyRo, whyEn } }
```

`kind` is one of treatise, sermons, commentary, letters, catechism, creed, devotional, history, polemic. Counts, century, A-Z letters and
the who-lines are derived at load. A work without a catalogue entry still lists (shelf "Altele", no blurb), so a pack never disappears for a
missing editorial record.

---

## 7. Work hub

Route `/work/[id]` (exists; extended). Reference: WK-01 to WK-15 and inventory 4.4. One page per work that explains it and opens it.

**Zones, top to bottom**

1. Header row (existing app header on native; on web the brand bar and section bar above): breadcrumb line with the author's name (`meta`, link to `/authors/[slug]`).
2. **Card** (`surface`, 1 px `border`, radius 3, padding 24 wide / 20 phone): title (`displayM`, IM Fell 34/40 wide, 30/36 phone, balanced lines), original
   title (`original`), author link (`accentStrong`) with lifespan, then a line of `Chip`: kind ("Tratat", "Predici"), shelf; two or three `StatTile`
   (SECȚIUNI 11, CUVINTE ~29.600, CITATE BIBLICE 361 [P2]).
3. **Editions**: the existing `Segmented` (labels "Română · traducere", "English · original", "Latină · original", "Alăturat" is not here: it is a reader action) and, when
   the selected edition is partial, a `Chip` "Traducere parțială" with "N din M secțiuni".
4. **Transparency row**: a status `Chip` for the selected edition ("TRADUCERE AI · NEVERIFICATĂ", "TRADUCERE · VERIFICATĂ", "TEXT ORIGINAL") and a `text` button
   "Detalii" that opens the same Transparency panel as the reader (8.6). The licence note appears here (existing `licenceNote`) under the row.
5. **Actions**: `primary` "Începe lectura" / "Continuă lectura" (existing; full width on phone, max 320 wide); `outline` "Citește în două limbi" (opens the reader with
   `?pair=ro+en`, only when two editions are installed); `outline` "Întreabă despre această carte" (opens `/ask?scope=work:<id>`); `text` "Descarcă pentru offline" [P2].
6. **Tab strip** (`Tabs`, sticky under the section bar, 47 px; counts in labels; hash `#overview`, `#contents`...). Tabs by phase:

| Tab (RO / EN) | Content | Phase |
|---|---|---|
| Prezentare / Overview | blurb (`body`, max 70 ch, label "Prezentare editorială" or "Text generat cu AI" plus `Disclosure` "Metodologie") and `StartList` "Unde să începi" (3-5 entries: section title or paragraph, one sentence of why, link into the reader); kind tags; two columns from 960 px (1.15fr / 1fr, gap 56) | P1 |
| Cuprins / Contents | the section tree: numeral column (44 px, `heading` 600 tabular, so roman numerals read clearly), heading, optional one-line summary [P2], a marker on the section the reader was in ("în curs") and a check on finished ones; rows 56 px on phone | P1 |
| Scriptura / Scripture | counts by kind (quotation, citation, allusion) and per book, each opening the Scripture view [P2] | P2 |
| Index / Index | the five parts (Subiecte, Persoane, Scriptură, Termeni, Întrebări) with counts, find field, page buttons | P2 (Scripture part), P3 |
| Argument, Citate, Cititori de mai târziu, Teme, Poziții, Surse citate, Nume | as the reference (inventory WK-04 to WK-12) | P3 |

7. **"Despre această carte" disclosures**: edition details (source, licence, version, revision, size), "Descarcă" [P2].

**Data needed**: `work` and editions (exist); catalogue entry (6.8: shelves, kind, blurb, `start[]`); provenance of the selected edition (8.6); counts derived from paragraphs
(sections, words); positions from the position store. Missing data renders nothing (no empty tabs: a tab appears only when it has content).

**Phone**: the card and tiles stack in one column; the tab strip scrolls horizontally; actions stack; the transparency row wraps under the chip.
**States**: not found ("Lucrarea nu a fost găsită." with a link to the library); loading; the page keeps the existing `PageTitle` for the browser tab.

---

## 8. Reader

Route `/read/[id]/[section]` (exists). Reference: RD-01 to RD-56 and TR-01 to TR-12. The reader keeps its data flow (the section id identifies the edition; the
position store is keyed by edition; deep links `?p=` and `?q=` keep working) and gets the reference's structure and controls. D-14: one chapter per screen in P1,
with an end-of-chapter "next" card; a continuous-flow option follows in P2.

### 8.1 Zones

| Zone | Desktop, 1100 and up | 881 to 1099 | Phone shell, 880 and below |
|---|---|---|---|
| Brand bar | not shown in the reader | not shown | not shown |
| Section bar | 48, sticky; leaves together with the toolbar in focus mode | same | 43; leaves on scroll down, returns on scroll up |
| Toolbar | 67 (`cream`, 1 px `border` below), padding 10/24 | 65 | 53, title block only |
| Outline panel | 300 in the flow, `cream`, own scroll | 220 overlay, starts closed, scrim | full-width drawer from the left |
| Text | one scroller; column `min(37 em, 960)`, padding 41.6/54/64 | column 736 at 1024 | padding 16/12/85 |
| Docked Ask [P2] | right panel `clamp(390px, 34vw, 500px)` | full-screen sheet | full-screen sheet |
| Progress | 3 px at the very bottom, full width | same | same (above the thumb bar's safe area) |
| Thumb bar | none | none | 61 plus bottom safe area |

```
+--------------------------------------------------------------------------------+
| section bar   BIBLIOTECA | ACASĂ   CĂUTARE  CITEȘTE ›  CERCETARE ›  DESPRE ›        48
+--------------------------------------------------------------------------------+
| [☰] Titlul lucrării                 [‹][›][ 3 / 11 ] [Transparență AI] [RO|EN|⇄] [⌕] [Aa|Unelte ›]   67
|     Autor  1862-1949  Română · traducere
+-------------+------------------------------------------------------------------+
| ASCUNDE CUPRINSUL | DESFĂȘOARĂ  |  scroller                                          |
| [Cuprins|Index|Bibliotecă]     |   [ CAPITOLUL I            Introducere ]        |
| [Caută în cuprins]             |   paragraphs, 37 em measure, one or two lanes   |
| [Arată curentul]               |                                                 |
| 11 INTRĂRI ÎN CUPRINS          |   (find bar sticks to the top here)             |
| | intrarea curentă (bară)      |   [ Capitolul următor: II. ... › ]              |
+-------------+------------------------------------------------------------------+
                                         progress bar 3 px (fixed bottom)
```

Layers and Esc: Esc closes the topmost layer in this order: find bar, `Aa` panel, Tools drawer, Transparency dialog, previews, expand-contents overlay, report form,
keyboard help, Ask panel; with nothing open on a window narrower than 1100 it hides the outline. On desktop the section bar and the toolbar stay pinned while reading (the brand bar, which the reader does not show, is the only bar that would scroll away); on phone everything except the progress bar leaves on scrolling down and returns on the first upward scroll (threshold 56 px down).

### 8.2 Toolbar

Background `cream`; controls are 36 px high, `surface` fill, 1 px `borderStrong`, radius 3, `chrome` text; press `scale(.96)`.

| # | Control | Name (RO / EN) | Behaviour | Phase |
|---|---|---|---|---|
| 1 | Outline toggle, 40 x 36, glyph "☰" (icon) | Cuprins / Contents | toggles the outline panel; keys `[` and `]` | P1 |
| 2 | Title block | | line 1 `readerTitle` (one line, ellipsis); line 2 (12 px, `textMuted`): author link, dates, and the edition label ("Română · traducere") when the work has several editions | P1 |
| 3 | Previous / next, 70 x 36 joined segment, glyphs `‹ ›` (22 px) | Capitolul anterior, următor / Previous, next chapter | moves inside the edition; keys ← and → (ignored in inputs) | P1 |
| 4 | Counter, 87 x 36: input and "/ 11" | Număr secțiune / Section number | Enter jumps; letters and out-of-range numbers are ignored | P1 |
| 5 | Transparency, 93 x 36 | Transparență (Transparență AI for machine translations) / Transparency (AI transparency) | opens the panel (8.6); border and text `accentStrong` while open | P1 |
| 6 | Language control | RO, EN, Original, and "⇄" Alăturat / side by side | segmented, hidden when the work has one edition; "⇄" toggles two lanes; the pair menu is in 8.5 | P1 |
| 7 | Search, 40 x 36, magnifier | Caută în text (/) / Find in text (/) | opens the find bar (8.11) | P1 |
| 8 | `Aa`, 44 x 36, joined with 9 | Text / Text | opens the typography sheet (8.7) | P1 |
| 9 | `Unelte ›`, 66 x 36 | Unelte / Tools | opens the tools panel (8.8); the chevron points left when shut | P1 |

While the Tools drawer is open the title block and the counter fold away (as in the reference). Disabled controls are not hidden except where noted.

### 8.3 Outline panel

Desktop (300 px, `cream`, 1 px `border` on the right, own scroll; the top block is sticky):

- Action row (two buttons, 129.5 x 32, 10.5 px caps, tracking 0.84): "ASCUNDE CUPRINSUL" and, in P2, "DESFĂȘOARĂ CUPRINSUL" (opens the full-page overlay: a three-column ruled grid for a flat outline, or one
  card per top-level section for a hierarchical one; header "Cuprins" and "Restrânge cuprinsul").
- Tab strip (30 px, joined segments; active filled `accentStrong` with `onAccent`): "Cuprins" (P1), "Index" (P2, the five-part index of the work), "Bibliotecă" (P2, an author-to-works tree with a filter field).
- Search "Caută în cuprins" (34 px; filters headings live; "N titluri găsite"; "Niciun titlu nu se potrivește."; Clear; Esc clears; Down focuses the first match, Enter opens it).
- Actions row (28 px, joined): "Arată curentul" (scrolls to and expands the current entry; disabled until known), "Desfășoară tot", "Pliază tot" (the last two only for hierarchical outlines).
- Count line (10.5 px caps, tracking 1.47, `role=status`): "11 INTRĂRI ÎN CUPRINS".
- Entries: 14/1.4, padding 5/8.8/5/8, radius 5; depth indent 8, 21.6, 35.2 and 0.85 rem per further level; a 20 px chevron button on branches (`aria-label` "Desfășoară <titlu>");
  titles wrap (the full heading is the accessible name). The current entry is 600 `text` with a 2 px left bar in `accentStrong` and `aria-current="location"`; the marker follows the reading position.
  Hover turns the text `accentStrong`. Choosing an entry navigates; on 1100 and wider the panel stays open (the reference closes it, a small deviation), below that it closes.

Phone: a full-width drawer (z above the thumb bar) with a 44 px head "Cuprins" and a 28 px close, the buttons, chips "Autori" and "Scriptura" [P2], a 44 px tab strip, a 42 px search
field (16 px), "Arată curentul" as a text link and entries at 16 px in 56-59 px rows; scrim `rgba(45,41,39,.38)`; choosing an entry closes the drawer. Query and open branches are kept
per work for the session.

### 8.4 Text area and chapter cards

- Column: `min(37 em, 100%)` centred, so the line widens with the font size. Paragraph spacing 0.58 em, left aligned. Kinds: `p` (reading style), `quote` (indent 1.2 em, 3 px left rule `border`),
  `note` (0.88 em, `textMuted`), `heading` (inline subheading, 1.15 em, 600).
- **Chapter card** (tier 1: a section of kind chapter with no parent): `surface`, 1 px `border`, radius 3, padding 16/20, margin 48 above and 26 below, inset 54 px each side when the column allows. An `eyebrow`
  line ("CAPITOLUL I", `accentStrong`) over the title (`chapterTitle`, 1.42 em/600; long titles shrink to 1.1 em/500). The heading comes from `splitChapterHeading` (numeral and title). A "§" anchor sits 18 px
  left of the card (opacity 0, 0.85 on hover or focus); pressing it copies the link to the section and shows "Link copiat." Cards are not collapsible in P1 (D-14); in continuous flow [P2] a 32 x 32 fold chevron
  appears at the right edge and "Pliază tot" in Tools folds every card.
- Tier 2 (section with a chapter parent): a top rule (1 px `border`), padding 16/40/0/0, margin 2 em/0.8 em, title 1.2 em/600. Tier 3: no rule, title 1.04 em/600 (line 1.4), margin 1.6 em/0.45 em. A heading that is only
  a label (for example "ZIUA DOMNULUI 1") becomes a label-only card (eyebrow only) and the next heading is promoted into the same card.
- Paragraph affordances: the target paragraph of a link has the `target` wash (fade 300 ms, `testID="target-paragraph"` as today); search hits use `highlight`; the margin marker (a "¶ 12" button, the paragraph ordinal) appears on hover or focus on web and copies the citation.
- End of chapter: a hairline and a card "Capitolul următor: <titlu> ›" (the next section of the same edition); at the end of the work "Ai ajuns la sfârșitul lucrării." with "La cuprins" and, in P1, "Întreabă despre această carte".
- Scripture references: detected in every paragraph (RO and EN grammars) and indexed for the work hub counts; in P1 they are not styled as links (no Bible text installed). [P2] they are underlined (1 px `textMuted`, offset 3) and
  open a 460 px preview (reference, bottom sheet at 700 px) with the verse text and the links "Deschide capitolul" and "Vezi citările în bibliotecă".
- A partial translation shows a muted line under the title block: "Această traducere este în lucru: N din M secțiuni." and the outline lists only the translated sections (existing behaviour).

### 8.5 Bilingual reading (single lane, two lanes)

This is the control that makes the product ours. Reference RD-26 is the starting point (rows of aligned paragraphs, a 0.44/0.56 grid, stacked on phone); ours aligns exactly because every translated paragraph carries `sourceId`.

- **Single lane**: the language control of the toolbar chooses the edition (RO, EN, Original when installed). Switching opens the aligned section of the other edition and scrolls to the paragraph aligned
  with the one in view, so the reader keeps their place; the URL gets `?lang=`.
- **Two lanes** ("⇄"): the pair is chosen in a small menu (`Popover`, `Sheet` on phone): "Română + English" (default: the reading language first), "Română + Original", "English + Original" when three
  editions exist; the choice is remembered per work and as a default (`settings.reader.pair`). The URL gets `?pair=ro+en`.
- **Desktop and wide tablet (900 and up)**: one row per aligned source paragraph; left lane = first edition of the pair, right = second; grid 50/50 by default, a drag handle on the gap changes it between 35 and 65 percent
  (double-click resets; keyboard: Left/Right on the focused handle); a 1 px `border` divider; each lane has a sticky `label` header ("ROMÂNĂ · TRADUCERE", "ENGLISH · ORIGINAL"); heading cards appear in both lanes; the container grows to 1440. Row height is the taller lane.
- **Phone and narrow screens**: the lanes stack inside each row, first lane above second, each block under a muted lane label ("Română", "English").
- **Gaps**: a paragraph missing in one lane (partial translation) shows a muted italic line "Traducerea acestui pasaj nu este încă disponibilă." in that lane; rows are never dropped.
- **Actions** act on the paragraph of the lane they belong to; copy-with-citation includes the edition language. Lane font-size sliders (70-150 %) [P2]; a "balance" slider is in `Aa` [P1].
- **Data**: the repository gains `getAlignedSection(sectionId, otherEditionId)` and `getAlignedParagraphs(sectionId, otherEditionId)` (pairs by `sourceId`; for a translation pair both point at the source id); search, citations and the Ask `aligned` field use the same mapping.

### 8.6 Transparency panel (TR-01 to TR-08)

`Dialog` 560 wide (phone: sheet), opened from the toolbar button (and the work hub). Content, top to bottom:

1. Title row: caret and `label` "TRANSPARENȚĂ" or "TRANSPARENȚĂ AI" (`accentStrong`, tracking 1.43).
2. Facts line (`meta`, `textMuted`, dot separated): "Tradusă cu AI din engleză · Neverificată · 1 raport deschis".
3. Lead note (3 px left rule `accent`; a bold lead sentence and a paragraph) by provenance kind (copy below).
4. Rows (label in `label` style, value in `meta`; hairline between):
   - SURSA (new): the source edition ("Textul-sursă: <titlu>, <ediția>; <proveniența scanării>") with a text button "Vezi ediția-sursă" (switches the reader to it).
   - TRADUCEREA (new, translations only): model and date ("claude-sonnet-5-5, 4 noiembrie 2026"), the passes ("ciornă, critic independent, revizie") and the automatic checks that ran (paragraph parity,
     Bible-reference parity, glossary, calques) with the number of open flags.
   - VERIFICARE: a `Chip` "NEVERIFICATĂ" or "VERIFICATĂ" (with the date), and a sentence naming the reviewer role: "Niciun revizor nu a citit încă traducerea față de original." / "Un revizor (teolog, filolog) a citit traducerea față de original la <data>." For
     a work that is not a translation: "Niciun redactor nu a citit încă lucrarea față de sursă." / "Un redactor a citit lucrarea față de sursă." The role is shown, the name only with consent. (The reference words this row as a translation committee; we have no committee, so the text names a reviewer.)
   - PROBLEME RAPORTATE [P2]: "Nicio problemă raportată încă" or "N deschise · M rezolvate".
   - CORECTURI: "Nimic nu a fost modificat încă în această lucrare." or a list (date, what changed), newest first, five per page with "Mai noi / Mai vechi".
5. A full-width outline button "⚑ Raportează o problemă cu această lucrare" (P1: opens a prefilled mail with the citation; P2: the form with a bot check).
6. A text link "Angajamentul nostru de transparență" (to `/about/transparency`).

Closing: ×, scrim, Esc, the trigger again; focus moves to the close button on open and back on close; `aria-modal`. Not gated.

Lead notes (our words; RO / EN):

| Kind | RO | EN |
|---|---|---|
| `ai` | "Această traducere a fost făcută de o mașină." Textul în română a fost produs cu inteligență artificială din <limba sursei>. Dacă panoul nu spune altceva, nu a fost verificat de un traducător. Ca să verifici tu, alege "Alăturat": originalul stă lângă traducere, paragraf cu paragraf. | "This translation was made by a machine." The text was produced with artificial intelligence from <source language>. Unless this panel says otherwise, no translator has reviewed it. To check it yourself, choose "Side by side": the original sits next to the translation, paragraph by paragraph. |
| `human` | "Această traducere a fost făcută de oameni." <credit sau "Numele traducătorului nu este încă înregistrat."> Nu s-a folosit inteligență artificială. | "This translation was made by people." <credit or "The translator's name is not recorded yet."> No artificial intelligence was used. |
| `native` | "Această lucrare a fost scrisă în <limba>." Nimic nu a fost tradus. | "This work was written in <language>." Nothing was translated. |
| `source` | "Acesta este textul original." <descrierea ediției: scanare, transcriere, curățare> | "This is the original text." <edition description: scan, transcription, cleaning> |
| `transcription` | "Aceasta este o transcriere a ediției tipărite, nu o traducere." Textul a fost recunoscut automat din scanare și curățat; nu a fost colaționat integral cu pagina tipărită. | "This is a transcription of the printed edition, not a translation." The text was recognised automatically from a scan and cleaned; it has not been fully collated with the printed page. |
| `unknown` | "Nu am înregistrat încă cum a fost făcut acest text." Folosește "Raportează o problemă" dacă știi. | "We have not recorded how this text was made yet." Use "Report a problem" if you know. |

**Data** (additive to `ProvenanceSchema`; absent fields fall back to the edition kind and the free-text note): `kind` (`ai`, `human`, `native`, `source`, `transcription`, `unknown`), `sourceLanguage`, `model`, `generatedAt`,
`passes[]`, `checks[]` ({ code, status }), `sourceDescription`, `review` ({ state: `needs-review` | `reviewed`, `at`, `roleNote` }), `corrections[]` ({ at, summary }). A change of review state or a correction bumps the pack revision (signed).

### 8.7 Typography sheet (`Aa`)

Popover 340 wide under the button (right-aligned; phone: a fixed sheet). Rows have `label` captions in a 3.4 rem column and apply live and persist in the settings store.

| Row | Controls | Notes |
|---|---|---|
| FONT | Serif / Literata / Sans | Source Serif 4 (default), Literata, Inter; Sans widens the measure (reference: 777 to 851 px at 21 px) |
| SPAȚIERE | Strâns / Normal / Aerisit | 1.45 / 1.55 (dark 1.68) / 1.85; the existing 1.3-2.0 stepper stays in Settings |
| TEXT | A- button, slider, A+ button | 14-34, step 1, value shown; defaults 17 phone, 20 wide |
| TEMĂ | Auto / Luminos / Sepia / Întunecat | also cycles from Tools |
| LIMBI (two lanes only) | "Echilibru" slider 35-65 | lane sizes 70-150 % [P2] |
| NOTE (works with notes) [P2] | La cerere / Toate | |
| Phone only | buttons Anterior, Următor, Despre această carte | the phone toolbar has no counter or arrows |

### 8.8 Tools panel (`Unelte`)

Desktop: a drawer that opens to the left of `Aa` and `Unelte` (width 0 to content in 320 ms, premium curve; title block and counter fold away; Esc closes and returns focus). Phone: a horizontal strip (cells 60-90 px, icon over a 12 px
label) revealed over Contents and Search from the left edge of the thumb bar. Items, in order:

| Item (RO) | Behaviour | Phase |
|---|---|---|
| Limba (phone) | opens the language sheet | P1 |
| Pliază tot / Desfășoară tot | folds or unfolds every card | P2 (continuous flow) |
| Temă | cycles Light, Sepia, Dark | P1 |
| Copiază linkul | copies the link to the section (and the first visible paragraph); toast "Link copiat." | P1 |
| Marcaj / Marcat | toggles the work bookmark (local) | P1 |
| Raportează | report (8.6, step 5) | P1 |
| Ascunde bara | focus mode with a "ARATĂ BARA" button that remembers the choice | P2 |
| La început | first section, scroll 0 | P1 |
| Întreabă | opens Ask scoped to this work (P1: the Ask page; P2: docked panel) | P1 |
| Cercetare | the research panel (Work, Search, Passage, Saved, Ask) | P2-P3 |
| Scanare | the scan lane | P3 |
| Descarcă | offline download of the edition | P2 |

### 8.9 Paragraph actions and selection

- **Web, pointer devices**: hovering a paragraph shows a rail 30 px left of the text with two 24 x 24 buttons (link: "Copiază linkul către acest paragraf"; copy: "Copiază paragraful cu citare"); the face flashes a check for 1.1 s; hidden where `hover: none`.
- **Native and touch**: a long press (500 ms) on a paragraph opens a `Sheet` with: Evidențiază (five wash swatches and "Șterge evidențierea"), Copiază cu citare, Copiază linkul, Întreabă despre acest pasaj, Raportează; Notă and Salvează [P2].
- **Citation format**: "Autor, Titlu, secțiune. — <URL>" where the URL is `<origin>/read/<workId>/<sectionId>?p=<paragraphId>`; copy-with-citation puts the paragraph text first, a blank line, then "— <citare>" and, when the work has several editions, "(ediția română)".
  Passage permalinks `/passage/<id>` [P2] resolve to the edition in the visitor's reading language.
- **Ask from a paragraph**: opens `/ask?scope=work:<id>&passage=<paragraphId>`; the composer shows a passage card (citation, the text as a quote, ×) and sends it with the question.
- **Range selection** (web) [P2]: a floating bar under the selection (595 x 50, `surface`, 1 px `border`, radius 8) with five swatches, Remove, Copiază, Link, Întreabă, Notă, Salvează, Raportează; on phones it spreads across the width with 44 px buttons.

### 8.10 Bookmarks, highlights, notebook affordances

- **Bookmark a work** (P1, local): Tools "Marcaj" and the work hub. Stored as `{ workId, editionId, addedAt }` in the key-value store. `/bookmarks` lists them (title, author, edition label, place such as "Capitolul III", a `text` button "Elimină" with a two-step confirm
  that arms in `danger` colour) with sort buttons Recente / Autor. Empty state: a sentence and a link to the library. Synced with the account in P2.
- **Highlights** (P1, local): paragraph-level, five washes, stored as `{ editionId, paragraphId, color, at }`; drawn as the wash behind the paragraph; a second tab on `/bookmarks`, "Evidențieri", lists them with "Deschide" [P2 for the list].
- **Notebook** [P2]: "Notă" and "Salvează" create entries (cite line, the passage, your note, collection) listed in the reader's research panel (tab "Salvate", grouped Note, Evidențieri, Referințe) and on `/notebook` (section 13). Until P2 these two actions are not shown.
- **Reading place**: kept automatically per edition (exists); an explicit "Salvează locul" action joins the notebook in P2.

### 8.11 Find in text

Opened by the toolbar button, `/`, Ctrl/Cmd+K or Ctrl/Cmd+Shift+F; sticky at the top of the scroller (desktop 850 x 107 centred over the column; phone full width under the toolbar). Contents: an input "Caută în text" (16 px on phone), buttons ↑ ↓ ×
(↑ ↓ disabled until there are matches), a status ("Caută un cuvânt sau o expresie", "Apasă Enter pentru a căuta „ab”", "1 din 27", "Niciun rezultat"; `role=status`) and a help line "Caută în toată ediția, fără conexiune la internet.". Searching starts at three characters after
250 ms (Enter forces one or two); Enter and Shift+Enter step; each hit opens its section and scrolls to its paragraph; Esc closes the bar and restores the position. Hits use `highlight`; the current hit has a 2 px `accentStrong` ring. The route parameter `?q=` opens the bar with the words.
Scope: the edition on screen (in two lanes, the first lane); the existing index and folding (`search/fold.ts`) are reused. The reference's gated "search whole work" does not exist here (D-06).

### 8.12 Phone behaviour

Shell: brand-less; section bar 43 (hides on scroll down); toolbar 53 (title and the second line only); text 17/27 with 12 px side padding; **thumb bar** 61 px (plus safe area): five cells when the work has two or more editions, four otherwise: Cuprins, Caută, Limba, Text, Unelte
(each a 20 x 20 icon over a 12/600 label, no uppercase, `textMuted`; the active cell is `text` on a `cream` fill, radius 4); tapping toggles the matching panel; Contents and Search fold away while the Tools strip is open. "Limba" opens a sheet with the language control and the "Alăturat" switch.
Previews and menus are bottom sheets from 700 px down; the outline is a full-width drawer; no swipe between chapters (the reference has none either); popovers close on scroll; tap targets are 44 px (outline rows 56). Text size and theme persist as on desktop.

### 8.13 Keyboard (web)

| Key | Effect |
|---|---|
| ← / → | previous / next chapter (ignored in inputs) |
| `[` / `]` | toggle the outline |
| `/`, Ctrl/Cmd+K, Ctrl/Cmd+Shift+F | open find |
| Enter / Shift+Enter | next / previous hit |
| Ctrl/Cmd+Shift+A | open Ask for this work |
| `?` | shortcut help [P2] |
| Esc | close the topmost layer (8.1) |
| Tab order | section bar, outline, skip link "Treci la text", toolbar, text |

### 8.14 States

Loading: shimmering "Se încarcă textul..."; not found: "Secțiunea nu a fost găsită." with a link to the library; error: existing message with a retry; offline: reading continues from the installed edition (nothing to show); a translation still in progress: 8.4.

---

## 9. Ask

Route `/ask`. Reference: AK-01 to AK-31 and inventory 4.9. The contract is the gateway of `docs/ask-api.md` (`POST /v1/ask` as Server-Sent Events, `GET /v1/library`). What the screen is for: a conversational page that answers in
the **reading language** and **cites paragraphs of our library**; the sources are cards that open the reader at the paragraph. It is open during the beta (no account; a per-IP limit and a spend limit protect the cost) and will ask for a free
account later (9.10). It never fakes activity: every stage shown comes from an event actually received.

### 9.1 Entry points

| Door | Behaviour | Phase |
|---|---|---|
| Section bar: Cercetare, Întreabă | opens `/ask` | P1 |
| Brand bar button "Întreabă"; landing hero and door | opens `/ask` (optionally `?q=` from a hero box) | P1 |
| Work hub "Întreabă despre această carte"; reader Tools "Întreabă"; reader end-of-work card | `/ask?scope=work:<id>` | P1 |
| Author page "Întreabă despre acest autor" | `/ask?scope=edition:<ids>` | P1 |
| Paragraph action "Întreabă despre acest pasaj" | `/ask?scope=work:<id>&passage=<paragraphId>` | P1 |
| Search "Întreabă" mode | passes the query as `?q=` (prefilled, not sent) | P1 |
| Ctrl/Cmd+Shift+A (web) | opens Ask from anywhere (for the open work if in the reader) | P1 |
| Reader docked panel (1100 and up) | the same conversation beside the book; citations scroll the book | P2 |
| Shelf "Studiază raftul", Scripture verse "Întreabă despre acest verset" | scope or question preset | P2 |

### 9.2 Layout

The screen sits under the section bar like any other (the reference's workspace covers the whole window; ours does not, so navigation stays reachable).

- **Wide (1100 and up)**: a header row (title = the first question, context line "Toată biblioteca" or "Despre: <lucrare>", a `text` button "Conversație nouă"); the chat column (measure 760, centred; feed padding 36); the composer fixed at the foot of the column; the **source pane** opens
  to the right (default 45 % of the width, range 28-76 %). A history sidebar of 272 px [P2] sits at the left (`cream`, conversation list, search, folders, archive).
- **Tablet and phone (below 1100)**: one column; the source opens as a full-screen layer with two tabs "Conversație | Citește sursa" (2 px `accent` underline on the selected one); the history is a drawer [P2].
- Feed padding `36 px max(24, (100% - 760) / 2)`; composer area `18 px max(24, ...) 14`; a floating button "Ultimul răspuns ↓" (44 px, `text` fill) appears when the feed is more than 110 px from the bottom.

### 9.3 Welcome state

H1 `displayM` "Întreabă biblioteca" / "Ask the Library"; one line (RO "Pune o întrebare. Răspunsul vine numai din cărțile bibliotecii, cu trimiteri la paragraf." EN "Ask a question. The answer comes only from the library's books, with citations to the
paragraph."); then a 2-column grid (one column on phone, gap 12) of four suggestion cards (white, 1 px `border`, padding 14/16/15; a `label` over a 15 px prompt; hover border `accent`). The four groups, one random prompt each, shuffled on every render and never the one
shown before: "O doctrină", "O idee prin texte", "Ce să citesc", "Un pasaj". Pressing a card fills the composer and focuses it; it never sends.

Suggestions live in `content/ask/suggestions.<lang>.json`; a test sends each one through the retrieval of the installed packs and fails when any returns no source (a suggestion the library cannot answer is a broken promise). In-book variant (scope = a work): H1 "Întreabă despre această carte",
one line "Alege un paragraf din carte sau întreabă despre lucrare în ansamblu.", three groups of two ("Urmărește argumentul", "Înțelege termenii", "Studiază sursele") built from templates with the work's title and author. Narrowed variant: H1 "Întreabă în <domeniu>" and "Răspunsul folosește numai această selecție. Schimbă domeniul ca să cauți în toată biblioteca."

### 9.4 Composer

- A visible label "Întrebarea ta" (12/600, `textMuted`), a textarea (placeholder "Întreabă orice din textele bibliotecii", 17/1.5, grows to 170 px or 26 % of the viewport, max 2,000 characters with a counter from 1,800), draft saved after 300 ms per conversation.
- Tools row: **scope chip** ("Toată biblioteca", a work title, an author; opens a popover with a radio list: whole library, a work, an author; P2 adds shelves, several selections and "Include caietul meu") and **answer-language chip** ("RO" / "EN"; default = the reading language, not the interface
  language; sent as `language`), a spacer, and the send button (44 px circle, arrow up; `accentStrong`; becomes a stop square with the name "Oprește" while an answer streams).
- Enter sends on hardware keyboards, Shift+Enter inserts a newline, Enter never sends on touch devices. Sending is disabled when the text is empty, over 2,000 characters, or the device is offline (message "Întreabă are nevoie de conexiune la internet. Lectura funcționează și fără.").
- Foot line (12 px, `textMuted`): "Întrebarea ta este trimisă unui serviciu AI. Nu introduce date personale." and (hidden on touch) "Enter pentru a trimite · Shift+Enter pentru rând nou". When `RateLimit-Remaining` is 5 or less: "Mai poți pune N întrebări în următoarele 10 minute." The meter is hidden when the number is unknown.
- First use shows a one-time `Dialog` "Cum funcționează Întreabă": answers come only from the library's texts; a service provider (Anthropic) processes the question; do not enter personal data; no account is needed in the beta; link to the transparency page; button "Am înțeles" (stored locally; becomes the versioned consent of P2).

### 9.5 One turn

Top to bottom, per `article` (`testID="ask-turn"`):

1. **Question bubble**: right-aligned, max 88 % wide (94 % phone), `background` with a 1 px `border`, radius 14/14/4, padding 14/18, 17 px. A passage card above it when a passage was attached ("Pasaj ales · <citare>", collapsible, with "Citește pasajul").
2. **Mode line**: right-aligned `label` "ÎNTREABĂ · RO" (mode and answer language).
3. **Progress** while running (`role=status`, `aria-live=polite`): three pulsing 5 px dots; the stage text; an elapsed timer ("12 s"). The stages are those of the events: before `sources` "Caut în bibliotecă..."; on `sources` "Am găsit N pasaje în M lucrări." with up to eight chips "Autor · Lucrare" (60 characters; each opens the source in the pane) and "și încă N";
   on the first `delta` "Scriu răspunsul..."; after the last `delta` and before `done` "Verific citările...". Nothing else is invented.
4. **Answer label**: a "Răspuns" line (13 px, `textMuted`) over the body.
5. **Outline card** [P1 only for long answers]: the question again (20/600) with "Sus ↑" and one 13 px jump link per heading when the answer has two or more headings or is taller than 1.5 feed heights.
6. **Answer body** (`askAnswer`, 17-18 px): Markdown-lite rebuilt from escaped text on every delta and diffed in place (no flicker): headings (all levels render as `h3`, 23-26 px/600), paragraphs (1.05 em apart), lists (1.3 em indent), blockquotes (1 px left rule, 20 px padding; the model quotes in a blockquote and the chip follows), bold and italic, simple tables
   in a focusable horizontally scrolling region "Tabel din răspuns"; no diagrams in P1. While streaming the feed stays pinned to the bottom; when the answer lands it jumps to the **start of the answer** (not the end) once.
7. **Citation chips** replace markers `[1]`, `[2][4]`, `[1, 3]`, `[2-4]` (up to ten numbers, as the gateway parses them) as they complete. A marker that names no source renders as plain "[?]" with the title "Sursă inexistentă" and is not a button.
8. **AI label** (always, `caption`): "Răspuns generat cu AI din textele bibliotecii. Poate greși: verifică sursele." with a `text` button "Raportează" (P1 mail with the request id and the question hash; P2 form).
9. **Check line and notices** from `done` (9.12): "Citate verificate cuvânt cu cuvânt: 3 din 3." (only when `quotations.checked > 0`); when `quotations.unverified > 0` a notice (2 px left rule `accentStrong`, 13 px): "Un citat din acest răspuns nu a fost găsit în pasajele citate. Citește sursele înainte să te bazezi pe el." (plural for several);
   when `invalidCitations > 0` a caption "N trimiteri la surse inexistente au fost ignorate." The reference's per-sentence "în parte / neconfirmat" badges and "Lacune în dovezi" need the second server pass [P2].
10. **Receipts**: up to three full-width rows (min 64 px, hairline between) for the first three works the answer actually cites, in citation order: work title and section, author, edition badge, a chevron; pressing one opens the source in the pane. Then a disclosure "Toate sursele · N pasaje · M lucrări · K citate": one `details` per work (first open),
   each passage a card (author, work title, section, language badges, the excerpt in italic 14 px, the `matchedRefs` as a chip "Citează Mat. 4:17", buttons "Citește aici" and a link "Deschide în carte").
11. **Actions** (`text` buttons, 44 px): "Copiază răspunsul" (text plus a numbered list of sources with links), "Reia întrebarea" (after an error or a stop), "Întreabă mai departe" (focuses the composer); "Distribuie" and "Salvează în caiet" [P2]; "Cercetare aprofundată" [P3].
12. A small `Disclosure` "Detalii" with the model and the request id (support and bug reports); token usage is not shown to readers.

Not covered (`stopReason: not_covered`): the body is replaced by "Biblioteca nu acoperă încă acest subiect." and a short list "Ce conține acum" from `GET /v1/library` (title, author, edition badges) with two example questions built from the installed works. Cut at the limit (`max_tokens`): a caption "Răspunsul a fost tăiat la limită." and a `text` button "Întreabă mai îngust".

### 9.6 Citation chip and preview

- Chip: numeral, `accentStrong` 600, `cream` fill, 1 px `border`, radius 2, visible size 22 x 22 with a 44 x 44 hit area; accessible name "Sursa 1: <lucrare>, <secțiune>". Consecutive chips are grouped with a thin space. A chip whose passage was not among those sent is not possible here (the gateway only numbers sent sources), so no dashed variant is needed in P1.
- **Preview** (fine pointers, after 220 ms of hover or on focus; Esc closes; touch opens a `Sheet`): a 460 px `Popover` with the header "Autor · *Lucrare* · secțiune" (13 px muted), the paragraph in the shown language (the excerpt, at most about 480 characters, the quoted words marked with `highlight`), then, under a `label` "ENGLISH · ORIGINAL" or "ROMÂNĂ · TRADUCERE",
  the same passage from each `aligned` edition (the Romanian-English pair is the preview; the reference shows English beside Latin), then the actions "Citește în carte" and "Citește aici" (when the pane exists).
- **Link target**: `/read/<workId>/<sectionId>?p=<paragraphId>&q=<first quoted string of at least 20 characters in the sentence that carries the marker, if any>&lang=<shown language>`; the aligned version uses its own ids. The reader highlights the paragraph (`target`) and the words (`q`). Back returns to the conversation with scroll position and focus restored (the conversation is in local storage; the route keeps `?chat=`).

### 9.7 Source pane

Wide: the right pane holds `ReaderPane`, the reader screen as a component without the section bar, outline panel or thumb bar: a slim header (a "‹" "Înapoi la conversație", the title "Pasaj sursă · <lucrare>", links "Deschide cartea" and a close ×), the section scrolled to the cited paragraph with the `target` wash,
and a lane toggle "RO | EN | ⇄" when the passage has aligned editions. A 9 px handle (`role=separator`, `aria-valuemin 28`, `aria-valuemax 76`; Left/Right move 3 %, Home and End jump, Enter, Space or double-click reset to 45 %) resizes it; the width is remembered. Opening a source pushes one history entry. Status line "Se deschide pasajul..." and, after 15 s, "Pasajul se încarcă greu. Îl poți deschide în carte." Phone: the full-screen layer with the two tabs of 9.2.

### 9.8 States and errors

| Situation | Copy and behaviour |
|---|---|
| Offline | composer disabled with "Întreabă are nevoie de conexiune la internet. Lectura funcționează și fără." |
| 429 `rate_limited` | "Ai pus multe întrebări într-un timp scurt. Încearcă din nou peste 42 s." (countdown from `Retry-After`); the question stays in the composer |
| 503 `provider_busy`, `library_unavailable`, `shutting_down` | "Biblioteca este ocupată. Încearcă din nou peste câteva secunde." with "Reia întrebarea" |
| 504 `timeout` | "Răspunsul a durat prea mult. Textul primit este păstrat." with "Reia întrebarea" |
| `error` event `refused` | "Modelul nu a putut răspunde la această întrebare. Reformulează-o." |
| Stream ended without `done` | "Răspunsul s-a oprit. Textul primit este păstrat." with "Reia întrebarea" |
| User pressed Stop | "Oprit. Textul primit este păstrat." |
| Unknown or invalid request | generic "Ceva nu a mers. Încearcă din nou." and the request id in "Detalii" |

Partial text is always kept and shown. Errors use `ErrorState` (`role=alert`, 2 px left rule in `danger`). `aria-live` announces "Răspuns complet" and errors; toasts are not used for answers.

### 9.9 Conversations

P1: one active conversation, saved locally (survives a reload; the last 6 turns are sent to the gateway, which uses 6, while the screen keeps up to 20), a `text` button "Conversație nouă", draft autosave. P2: the history sidebar (list with title and state or date, search, folders, archive, "Șterge arhivate", Markdown export "Descarcă conversația"),
rename and delete in an options menu, a command palette (Ctrl/Cmd+K) with "Conversație nouă", "Domeniu", "Deschide biblioteca"; storage decision local-first versus Supabase (roadmap, decision D-P2-1). P3: Deep research jobs.

### 9.10 Gate and limits

- **Beta [P1]**: no account, no gate. Protection: the gateway's per-IP limit (20 questions per 10 minutes by default) and an Anthropic spend limit on a dedicated workspace; the first-use notice (9.4).
- **After the beta [P2]**: anonymous readers meet an in-context `Sheet` (never a blocking overlay; Esc and a visible close work): eyebrow "GRATUIT ÎN BETA" while the beta lasts, title "Întreabă are nevoie de un cont gratuit", one sentence, an e-mail field and "Trimite codul" (a one-time code by e-mail, the architecture's choice for mobile; a link on web), "Ai deja cont? Intră". The request carries the session token; the gateway checks consent version,
  budget and limits (403 before any provider call). A usage meter under the composer shows "N din M întrebări folosite luna aceasta" and is hidden when unknown; a spent budget shows "Ai folosit întrebările acestei luni. Revin la <data>." Free accounts answer on the small model (label "Răspuns rapid"), members on the large one; the decision is OQ-8.

### 9.11 Contract mapping

| Screen element | Gateway field or event |
|---|---|
| request | `{ question, language (answer language), conversation (last turns), editionIds (scope) }` |
| Progress "Am găsit N pasaje în M lucrări", chips | `sources` event (first, once) |
| Answer text | `delta` events (concatenate; pieces may cut a word or a marker) |
| Chips, receipt order | markers `[n]` in the text; `citation` events (`sourceIndex`, `text`, `offset`) mark the cited sources and the sentence |
| Preview, source cards | `sources[]`: `id` (passage id, shared by all language versions), `workId`, `editionId`, `sectionId`, `paragraphId`, `workTitle`, `sectionHeading`, `language`, `excerpt`, `kind`, `author`, `tradition`, `matchedRefs`, `aligned[]` |
| Check line and notices | `done.quotations { checked, unverified }`, `done.invalidCitations`, `done.stopReason` (`end_turn`, `max_tokens`, `not_covered`, ...) |
| Details | `done.model`, `done.requestId` |
| Errors | `error { code, message, retryAfterSeconds? }`; HTTP 400, 413, 415, 429, 503, 504 on the non-streaming path |
| Rate meter | `RateLimit-Limit`, `RateLimit-Remaining` headers |
| "Ce conține acum", scope lists | `GET /v1/library` (works, editions with `partial`, languages) |

Gateway changes the screen would like (none blocks P1): the unverified quotation strings in `done` (to list them); a `progress` event with stage and counts (for hybrid retrieval and Deep research); support-check counts `check { claims, supported, partial }`; scope by work or shelf instead of edition ids; an attached `passage`; conversation and usage endpoints once accounts exist. Until a `passage` field exists the client sends the attached passage inside the question as quoted text, trimmed so that the whole question stays within the gateway's 2,000 characters.

### 9.12 Phase notes

P1 ships 9.1-9.11 except the sidebar, the docked panel, share, notebook, Deep research, the palette and the meter. P2 adds the second-pass support check with in-place badges, the docked reader panel, history, share (public noindex page with "shared by a reader, not reviewed by us"), the account gate and meter, scope by shelf and author lists. P3 adds Deep research (a server job up to 10 minutes with pause and continue, report and evidence downloads), "Include my notebook" and the command palette.

---

## 10. Search

Route `/search` (exists: local search over the installed packs). P1 keeps that engine and gives it the reference's shell.

- Page: eyebrow "CĂUTARE", H1 `displayL` "Căutare" (compact hero), a large `SearchField` (placeholder "Caută o lucrare, un autor sau un pasaj"), a `Segmented` of modes: "Lucrări" (works and authors by name: the engine of 6.5), "Pasaje" (words in the texts: the existing search), "Scriptură" [P2] (a verse or range; the gateway's
  reference parser boosts it), "Întreabă" (hands the query to `/ask?q=`), and, in P2, "După sens" (a server search by meaning).
- Filters row (`label` captions): RAFT, LIMBĂ (edition language), and in P2 "Cuvinte exacte | După idee" and "Compact".
- Results: a count line ("12 rezultate în 3 lucrări"), results grouped by work (title, author, edition badges), each passage a row with the section heading, a language badge and the snippet with the match marked (`highlight`); the existing "Primele N rezultate" cap note. Opening a hit goes to the reader at the paragraph with `?q=`. In "După sens" [P2] results are grouped by work (25 per page) with a "Pasaje în această lucrare" expander.
- States: hint ("Scrie cel puțin 2 caractere. Căutarea ignoră majusculele și diacriticele."), searching, no results, offline (the local modes still work; "După sens" says it needs a connection).
- Keyboard: `/` focuses the field from anywhere on web, Esc clears, Down moves into the results, Enter opens. URL: `?q=&mode=&shelf=&lang=`.

---

## 11. Scripture view

Later: P2 v1, P3 the rest. Reference: SC-01 to SC-32. It needs Bible texts (decision OQ-5) and the Scripture citation index; until a Bible pack is installed the section is hidden (4.2).

- Route `/scripture?ref=john.3.16&t=<translation>`; one template for every verse; the parser accepts how people type references in Romanian and English ("In 3:16", "Ioan 3, 16", "1 Cor 13", "Ps 22").
- **Bar** (not sticky): division tabs (Vechiul Testament, Noul Testament, Apocrifele when a text exists; manual activation), Carte and Capitol selects, Traducere select (the installed Bible packs, grouped by language), a "Comentarii (N)" toggle [P3], two 44 px circular previous/next buttons walking Genesis to Revelation as one chain.
- **Text card**: chapter header (book eyebrow 11 px caps in `mastheadAccent` on dark or `accentStrong`, "Capitolul 8" at 42 px/600), the hint "Alege un verset ca să vezi unde îl citează biblioteca.", then the verses at the reader's size and spacing; each verse is a button (`aria-pressed`), verse numbers superscript 11 px/700; the active verse has an 18 % `accent` wash and a 2 px underline.
- **Pane** (900 and up, right column; below that it opens inline after the verse's paragraph as accordion rows): tabs "Citări" [P2], "Comentariu", "Receptare" [P3] and a button "Biroul versetului" [P3]. *Citări* [P2]: eyebrow "VERSET", the reference as H2 (26/600), close ×, the headline "N citări în bibliotecă", a lucrare select, a list of cards (work, section, the paragraph that cites the verse with the reference marked, a kind chip
  when classified [P3], "Citește în carte"), and "Întreabă despre acest verset" (opens Ask with the question "Ce spun cărțile bibliotecii despre <referință>?" prefilled, not sent). With no verse open the pane shows "Acest capitol în bibliotecă": counts, "x din y versete citate" and the most-cited verses with bars.
- **Layout modes** (50/50, 40/60, 60/40, only text, only panel; from 900 up) [P3]; the dark mode is the global theme (SC-17).
- **Data**: signed Bible packs with a licence record per translation (flags checked at publication), a versification map from day one (Romanian Psalms follow another count; the reference only mentions superscriptions), the paragraph-to-reference index built at pack-build time with the RO and EN parsers, the Fidela/KJV style attribution line under the text.
- **Verse Desk** [P3]: one verse and everything the library holds on it: the head with the reference, verse and translations, a century ruler and tiles composed from counts, key voices, how each age read it, creeds that cite it, the commentary ladder, chapter heat, citations with filters, similar passages, ask. Every figure carries a Methodology note; modules without data render nothing.

---

## 12. Topics

Later (P3). Reference: TP-01 to TP-13.

- `/topics`: a find field with aliases in both languages, and ten numbered part cards (Roman numeral in `accentStrong`, H2 20/600, topic links in 46 px rows, narrower topics indented), three columns wide, one on phone. The taxonomy is ours (decision OQ-6): the reference orders loci in a Reformed-scholastic sequence; a Romanian Orthodox and Evangelical audience may need another order or two
  taxonomies. Stored as `topics.json` (slug, parent, labels and aliases in RO and EN, order).
- `/topics/[slug]`: head card (path "TOATE TEMELE · PARTEA VII", H2 48/600, one sentence, "în această temă" links), four computed counts as anchors (documente, lucrări, autori, versete), a jump nav, "Prin timp" (stacked bars per century in shelf colours, square-root scaled, five tinted ages, with a Methodology note), "Cum tratează fiecare tradiție" (one card per tradition with excerpts and key works; says plainly
  when a tradition has none), "Pasaje din bibliotecă" (paragraphs tagged with the topic, grouped by shelf and century, each opening the reader), key verses, a reading path ("Începe aici", "Mai adânc"), related topics, and "Întreabă despre această temă" (Ask with the topic's works as scope). Generated overviews carry the AI label and a Methodology note.
- Data: topic tags per paragraph (pre-mined and labelled), the taxonomy file, the Scripture index for key verses.

---

## 13. Other research tools

Later. Each follows the reference (inventory RS area); this section fixes what is ours.

| Tool | Specification | Phase |
|---|---|---|
| Bookmarks | `/bookmarks` as in 8.10; synced in P2 | P1 / P2 |
| Notebook (`/notebook`) | collections of entries (cite line in `label` style, work and saved date in italic, the passage as a quote with a left rule, a "Nota ta" textarea, actions "Deschide în carte", "Copiază citarea", "Elimină" with a two-step confirm); head with the count line and "Recente / După lucrare"; filter field; export as Markdown. Item kinds: work, passage, note, Ask answer, reading place. Local first, synced through the account | P2 |
| Research panel in the reader | tabs Lucrare, Căutare, Pasaj, Salvate, Întreabă; the docked Ask is its fifth tab | P2-P3 |
| Compare (`/research/compare`) | two to four authors, one topic, columns grouped by work, stance bars; needs mined positions; every statement has "Citește sursa" and a Methodology note; a topic match is never presented as a citation | P3 |
| Connections | citation map (authors as points, citations as lines; Timeline, Rings, Tradition layouts), author panel with evidence; needs a resolved citation graph and enough works | P3-P5 |
| Lexicon (`/research/lexicon`) | term search in RO, EN, Latin, Greek; entries with forms, numbered senses and "Definit de" rows opening a paragraph; labelled "Adunat automat din textele bibliotecii" | P3 |
| Desk (`/desk`) | Write and Research modes, paper and notebook pickers, a rail of kept material, quotations that keep their citation links, a source preview split from 941 px | P3-P4 |
| Commentary decks, Disputed questions, Set indexes, Page scans | as the reference when the data exists (we hold the source PDFs, so scans come first) | P3+ |

---

## 14. Account, settings, consent

**Settings** (`/settings`, exists; P1 changes). Sections with `label` headings: CITIRE (text size 14-34 with the stepper, line spacing presets and the fine stepper, theme, reading font, reading language, default lane pair, interface language: existing controls plus the new ones), DATE ȘI AI (the state of the Ask notice with a "Revocă" button; P2: the versioned AI consent, analytics consent in P4),
OFFLINE [P2] (installed editions with sizes and "Elimină"; "Descarcă" for the rest), CONT [P2] (sign in or out, e-mail, "Tradiția mea (opțional)", delete account, export data in P4), DESPRE (app version, content packs verified and rejected, fonts: "IM Fell Great Primer, Source Serif 4, Literata și Inter, sub licența SIL Open Font", art credits, links to Transparență and licences).

**Consent and account screens the architecture asks for from the start** (CLAUDE.md priority 3: built early because retrofitting costs more): the Ask notice (P1, local), the versioned AI consent (P2, server record, 403 before any provider call when missing), sign-in by e-mail code (P2), account deletion screen in the app and on the web (P2; the compliance review is P4),
analytics consent (P4). They use `Dialog` and `Sheet` and are never blocking overlays without a close or a way back to reading.

---

## 15. About, help, transparency pages

- **`/about`** [P1]: `narrow` column under a 293 px hero (eyebrow "BIBLIOTECA · DESPRE", H1 "Despre bibliotecă"). Sections (`heading`): what the library is; how the translations are made (short, links to the policy); what Ask does and does not do (answers only from the texts, with citations; a tool for finding and checking, not a substitute for teaching or for church life; our own wording);
  sources and licences with art credits; contact and feedback (mail link); version. [P2] six hash tabs like the reference (What, why and how; Story; Transparency; Changelog; Most read; Credits). Header card per tab (3 px `accent` left border).
- **`/about/transparency`** [P1]: the policy page. Eight commitments, each an H2 and a short paragraph (final wording is the owner's): (1) a machine translation is marked as one, before the text starts; (2) the original is one tap away, paragraph by paragraph; (3) two translations are made from the original, never one from the other; (4) public-domain reference translations only help us check ours and are never copied; (5) anyone can report a problem; (6) the number of reports, open and settled, is public [P2];
  (7) corrections are dated and public; (8) each work states its status, Verificată or Neverificată. A ninth short block on Ask (answers cite and are checked; AI is labelled). Then a `Button` "Raportează o problemă" and a closed `Disclosure` "Toate lucrările traduse cu AI" listing each edition (title, author, language pair, model, date, status), 50 at a time when it grows.
- **`/about/how-to`** [P2]: tabs Mireni, Păstori, Cercetători; two-column cards (feature label, task H3, one or two sentences, a note such as "Răspunsurile Întreabă citează paragrafele bibliotecii", a real screenshot of our app, a "Încearcă" link). **`/about/tour`** [P3]: guided tours (spotlight, "Pasul n din m", Skip, Back, Next; done ticks in local storage).

---

## 16. Membership

Later (P4); until then there is no price anywhere. Principles: texts stay free to read; membership pays for translation work and the study tools (larger Ask model and budget, notebook sync, offline packs of members' editions, later Deep research) per `docs/arhitectura-app-biblica.md` section 8. Screens: a plan block with an annual-first toggle (RON; the numbers are decision OQ-11),
a "De ce plătim?" page, an in-app paywall sheet (RevenueCat paywalls on iOS and Android, Paddle overlay on web), a "Susține" entry in the brand bar, restore purchases in Settings. Reading is never blocked by a paywall; there are no streaks or pressure copy. The reference's gift, group, organisation and student plans are not planned before P5.

---

## 17. Language and content rules

1. **Two settings**: `readingLanguage` (ro, en; default from the device locale, existing) chooses the edition that opens first, the title shown and the Ask answer language; `uiLanguage` (system, ro, en) chooses the interface. Every string is in `ro.ts` and `en.ts`. `document.documentElement.lang` follows the interface language; each reading lane carries the `lang` of its edition.
2. **Plurals** (`Intl.PluralRules('ro')`, categories `one`, `few`, `other`; `other` takes "de"): 1 lucrare, 2 lucrări, 12 lucrări, 20 de lucrări; 1 pasaj, 3 pasaje, 20 de pasaje; 1 ediție, 2 ediții, 20 de ediții; 1 secțiune, 5 secțiuni, 100 de secțiuni; 1 sursă, 4 surse, 30 de surse; 1 rezultat, 2 rezultate, 20 de rezultate; 1 autor, 3 autori, 20 de autori. English: one / other. A helper `count(n, forms)` is the only way counts are written.
3. **Centuries and dates**: RO short "sec. V", long "secolul al V-lea" (first: "secolul I"); EN "5th century"; ranges with an en dash ("1862-1949" rendered "1862–1949"); "n. 354", "m. 430" in Romanian, "b." and "d." in English; before Christ "î.Hr." and "BC" (existing tables).
4. **Names**: authors and works are shown by the form of the reading language (`nameRo`, `nameEn`, `titleRo`, `titleEn`) and by tradition: Augustin / Augustine, Toma d'Aquino / Thomas Aquinas, Ioan Gură de Aur / John Chrysostom, Atanasie cel Mare / Athanasius, Vasile cel Mare / Basil the Great, Ioan Calvin / John Calvin. The original title stays in italic under the title when it differs.
5. **Diacritics and collation**: comma-below `ș ț Ș Ț` only; a test fails on cedilla forms in the string tables and the catalogue; sorting with `Intl.Collator('ro')`; search folds case and diacritics (existing `fold`); the A-Z bar uses the folded first letter.
6. **Typography of strings**: Romanian quotes „ ” and English “ ”; the ellipsis character; sentence case in sentences, small caps by style (`textTransform`), never typed in capitals; a no-break space between a number and its unit.
7. **Edition labels** (existing): "Română · traducere", "English · original", "Latină · original", "Română · traducere parțială"; status chips "Verificată", "Neverificată", "Parțială".
8. **Tone**: informal "tu" in the interface ("Ce vrei să citești?"); neutral, short sentences; no marketing superlatives; every generated block labelled (open question OQ-12 on formal register).
9. **UI vocabulary**: lucrare / work, ediție / edition, traducere / translation, original, raft / shelf, autor, tradiție, capitol and secțiune / chapter and section, paragraf, pasaj / passage, sursă / source, citare / citation, Scriptură, verset / verse, caiet / notebook, marcaj / bookmark, evidențiere / highlight.

---

## 18. Accessibility

- Contrast and non-text contrast as in 2.1; colour never alone; error and status text always present.
- Targets 44 x 44 (inline links in running text and citation chips have a 44 px hit area); focus visible everywhere (2 px `accentStrong`, offset 2); no focus trap except inside `Dialog` and `Sheet`; Esc and the visible close always work.
- Structure: one `h1` per screen; the section bar is `navigation` with the name "Secțiuni"; the reader has a skip link "Treci la text"; `main` holds the screen; tabs follow the manual-activation pattern; drawers use `aria-expanded` and `aria-controls`; live regions (`role=status`, `polite`) for counts, find results, Ask progress and "Răspuns complet".
- Reading: system font scaling is honoured fully for text and capped at 1.5 for chrome; line spacing and size are user settings; two lanes stack rather than shrink below 900; each lane has a `lang` attribute; soft hyphens are not required.
- Hover is never the only way: every hover preview has a focus and a tap equivalent; the paragraph rail has the long-press sheet on touch.
- Motion: all animation respects reduced motion (2.6); nothing flashes.
- The drag handles (lane split, source pane) are operable with arrow keys and have a value.
- Screen-reader names exist in both languages for every icon-only control; the test of 20.3 (G6, G7, G9) checks them.

---

## 19. Platform notes

| Reference mechanism | Web (react-native-web) | Android and iOS |
|---|---|---|
| Sticky bars | `position: sticky` for the section bar and the work-hub tab strip | the bar sits outside the scroll view; the tab strip uses sticky headers of the list |
| Hide on scroll | scroll listener with direction and threshold (56 px) | `onScroll` on the list with `Animated` translate |
| Drawers | width animation (desktop), panel under the bar (phone) | the phone panel on all native screens |
| Hover previews and the paragraph rail | pointer events with delay | not used; `Sheet` on tap or long press |
| Text selection bar | DOM selection API [P2] | `selectable` text gives the system copy only; custom actions through the paragraph sheet |
| Backdrop blur, `content-visibility`, CSS columns | allowed where harmless | not available: opaque colours, list windowing, flex-wrap grids |
| Fixed progress bar | `position: fixed` | absolute view above the safe area |
| Streaming (SSE) | `fetch` with a reader and one `TextDecoder({stream: true})` | `import { fetch } from 'expo/fetch'` with the same decoder; a test splits a chunk inside "ș" (architecture, section 4) |
| Keyboard shortcuts | yes | n/a (hardware keyboards on tablets may reuse the web map later) |
| Local stores | key-value store (existing); conversations and highlights in the same store, size-capped | same |
| Deep links and static hosting | `404.html` rewrite on GitHub Pages and the custom domain | universal links and app links (P2) |
| Icons | `Icon` component (2.7) | same |

New native modules follow CLAUDE.md: check new-architecture compatibility and 16 KB page alignment before adding (`react-native-svg` is the only candidate here). Fonts load with `expo-font` as today; the HTML template keeps the page background so there is no flash.

---

## 20. Acceptance criteria

### 20.1 Method

A reviewer runs the checks with Playwright against the static web export and reads the screenshots. Build: `pnpm --filter mobile export:web`. Serve with the helpers of `scripts/lib/web-export.mjs`. For Ask start the gateway in mock mode
(`AI_PROVIDER=mock pnpm --filter @biblioteca/api dev`, `EXPO_PUBLIC_ASK_API_URL=http://localhost:8787`) and use a small stub server for the error and edge cases. Content: the committed packs (fixture **F-1**: the Vos English source and the Romanian translation) and, for list behaviour, a synthetic catalogue built in tests
(fixture **F-2**: 15 authors, six shelves, centuries 5 to 20; enabled with a test-only build flag). New script: `scripts/check-ui-v2.mjs` (reuses `launchChromium`, `serveExport`, `waitForScreen`) writes `test-results/ui-v2/report.json` (one entry per check id with pass or fail and the measured value) and the screenshots.

Screens are captured at **1366x900** and **390x844** (device scale factor 1, the sizes of the reference capture so a side-by-side with `test-results/tfr/` is possible) and at 1024x768 for the shell and the reader; themes light, sepia, dark (stored setting plus `colorScheme`); every shot in a fresh context (empty storage).
Naming: `docs/screenshots/v2/<screen>-<theme>-<size>.png`, where size is `desktop`, `tablet` or `phone`. Screens: `landing`, `library`, `library-all`, `work`, `reader`, `reader-lanes`, `reader-aa`, `reader-tools`, `reader-outline` (phone), `transparency`, `ask-welcome`, `ask-answer`, `ask-preview`, `ask-source`, `search`, `bookmarks`, `settings`, `about`, `about-transparency`.
Minimum matrix: every screen in light and dark at desktop and phone; landing, work and reader also in sepia.
Convention: labels shown in capitals in this document (SECȚIUNI, CAPITOLUL I, "ÎNCEPE LECTURA") are sentence case in the DOM and uppercase by style; checks compare the DOM text case-insensitively and read the computed `text-transform`.

### 20.2 Test IDs (`testID`, `data-testid` on web)

| Area | IDs |
|---|---|
| Shell | `brand-bar`, `section-bar`, `section-item-<key>` (home, search, read, scripture, topics, research, resources, about), `section-drawer-<key>`, `drawer-entry-<key>-<route>`, `language-switch`, `theme-button`, `ask-button` |
| Landing | `hero`, `hero-title`, `hero-highlight`, `hero-cta-primary`, `hero-cta-secondary`, `door-<key>`, `stat-<key>`, `work-card-<slug>`, `shelf-card-<slug>`, `beta-band`, `transparency-band` |
| Library | `library-search`, `library-count`, `filter-<shelf\|century\|tradition\|lang\|availability>`, `az-bar`, `az-<letter>`, `author-accordion-<slug>`, `library-row-<workSlug>`, `century-tile-<n>`, `view-tab-<author\|century>` |
| Work hub | `work-card`, `work-title`, `edition-switch`, `status-chip`, `transparency-open`, `work-cta-start`, `work-cta-lanes`, `work-cta-ask`, `work-tabs`, `tab-<key>`, `contents-row-<sectionId>`, `start-list` |
| Reader | `reader-toolbar`, `outline-panel`, `outline-tab-<key>`, `outline-search`, `outline-count`, `outline-entry-<sectionId>`, `reader-title`, `reader-counter`, `lang-<ro\|en\|orig>`, `lang-pair-toggle`, `transparency-button`, `find-button`, `aa-button`, `tools-button`, `reader-text`, `chapter-card`, `paragraph-<paragraphId>`, `lane-left`, `lane-right`, `lane-label-<lang>`, `target-paragraph` (exists), `find-bar`, `find-status`, `thumb-bar`, `thumb-cell-<key>`, `progress-bar`, `next-chapter-card` |
| Transparency | `transparency-panel`, `transparency-lead`, `transparency-review`, `transparency-corrections`, `transparency-report` |
| Ask | `ask-welcome`, `ask-suggestion-<n>`, `ask-composer`, `ask-input`, `ask-send`, `ask-stop`, `ask-scope-chip`, `ask-lang-chip`, `ask-turn`, `ask-progress`, `ask-answer`, `ask-cite-<n>`, `ask-preview`, `ask-receipts`, `ask-sources`, `ask-ai-label`, `ask-notice-unverified`, `ask-error`, `ask-source-pane`, `ask-split-handle`, `ask-new`, `ask-first-use` |
| Search | `search-input`, `search-mode-<key>`, `search-count`, `search-result-<n>` |

### 20.3 Global checks (every screen, every size and theme in the matrix)

| ID | Check | How | Expected |
|---|---|---|---|
| G1 | No horizontal page scroll | `scrollWidth <= innerWidth` for `html` and `body` | true; only the section bar, the tab strips and the A-Z strip scroll sideways inside their own container |
| G2 | Fonts | `document.fonts.check` and computed `font-family` of the hero title, a body paragraph and a rail item | IM Fell Great Primer, Source Serif 4 (or the chosen reading font); `document.fonts.status === 'loaded'` before the shot; no fallback flash (screenshot taken after fonts) |
| G3 | Tokens | computed colours of: page background, section-bar border, primary button fill and label, link colour, reading text | equal the theme's `background`, `border`, `accentStrong`, `onAccent`, `accentStrong`, `text` (exact rgb) |
| G4 | Text contrast | walk every visible text leaf, resolve its effective background (first opaque ancestor), compute the WCAG ratio | at least 4.5 (3 for text of 24 px or more, or 18.66 px bold); text over images is exempt and checked in G5 |
| G5 | Text over photographs | sample the screenshot behind each hero text box (lightest 5 % of pixels) | at least 4.5 against the text colour |
| G6 | Tap targets (phone) | bounding boxes of `a, button, [role=button], [role=tab], input, select` | at least 44 x 44, except inline links in paragraphs (hit area 44 by padding) |
| G7 | Focus | press Tab five times from the top | each focused element has an outline of 2 px `accentStrong` (or the native equivalent) and is not clipped |
| G8 | Keyboard and layers | open each drawer, dialog and sheet; press Esc | closes; focus returns to the trigger; nothing else closes |
| G9 | Languages | run with UI RO and with UI EN | all labels change; no raw keys; `html[lang]` follows; no string equal in both tables unless a proper noun; key parity test (`i18n.test.tsx`) green |
| G10 | Diacritics | regex over `document.body.innerText` and the string tables | no U+015E, U+015F, U+0162, U+0163 |
| G11 | Console and network | collect `console.error`, `pageerror`, failed requests | none, except the Ask API when it is stubbed offline |
| G12 | Reduced motion | emulate `prefers-reduced-motion: reduce` | hero sweep and kicker pulse absent (no running animation), drawer opens without transition |
| G13 | No dead links | click every section-bar item and drawer entry | each lands on a screen with an `h1` and no "not found"; items of features that are not live are not rendered |
| G14 | Themes | repeat the page background and surface checks in sepia and dark | backgrounds equal the tokens; no `#fff` surface in dark; `color-scheme` meta and `body` background agree before JS (existing `check-web-theme.mjs`) |

### 20.4 Per-screen checks

**Shell**

| ID | Check | Expected |
|---|---|---|
| S1 | 1366x900: brand bar and section bar | brand bar 64 px (plus or minus 1), `cream`; section bar directly below, 48 px, 1 px `border` under it; items in the order home, search, read, research, about (P1 flags); text uppercase, 13 px, letter spacing 1.3 px, `textMuted`; "BIBLIOTECA" 600 |
| S2 | 390x844: section bar | 43 px; scrolls horizontally inside itself; first three items fully visible; an edge fade element present; the page does not scroll sideways |
| S3 | Drawer (desktop) | pressing `read` opens a drawer of three entries within 400 ms; `aria-expanded=true`; the caret flips; Esc closes and focus returns to the toggle; ArrowRight moves to the next bar item |
| S4 | Drawer (phone) | a full-width panel directly under the bar with 48 px rows, a child of the bar container, visible in the first frame after the press (no animation frame wait) |
| S5 | Current location | on `/library/all` the `read` toggle has the current style and the entry "Toată biblioteca" has `aria-current=page` |
| S6 | Interface language | switching RO to EN changes CITEȘTE to READ, `html[lang]` to `en`, persists after reload |
| S7 | Review build | with `EXPO_PUBLIC_SHOW_ALL_SECTIONS=1` all eight items show; unfinished ones carry "Curând" and open a Coming screen (not a 404) |
| S8 | Scroll | after scrolling 600 px the brand bar is gone and the section bar is still at y = 0 |

**Landing**

| ID | Check | Expected |
|---|---|---|
| L1 | Hero title | IM Fell Great Primer; 52 px at 1366, 29 px (plus or minus 1) at 390; two lines; the highlight bar's width equals the second line's width (plus or minus 4 px) after 1.5 s; under reduced motion it is full from the first frame |
| L2 | Hero buttons | primary fill `accentStrong`, label white, 44 px or more high; "ÎNCEPE LECTURA" goes to `/library`, "ÎNTREABĂ BIBLIOTECA" to `/ask` |
| L3 | Doors | exactly two (Citește, Întreabă) in P1, equal widths (plus or minus 2 px) at 1366; each is a link that works |
| L4 | Figures | four tiles; works, editions and languages equal the counts computed from the packs |
| L5 | Collection | one `WorkCard` per work with "RO" and "EN" badges; at 390 the description and arrow are not displayed and the card is 140 px high or less |
| L6 | Shelves | only shelves that hold works; counts follow the plural rule ("1 lucrare"); each links to `/library/all?shelf=` |
| L7 | Bands | beta band and transparency band present; the button goes to `/about/transparency` |
| L8 | Offline | after load, `setOffline(true)` and reload from cache: the catalogue sections still render |

**Library**

| ID | Check | Expected |
|---|---|---|
| B1 | `/library` | H1 present; the hero form submits to `/library/all?q=`; a band renders only if it has items (F-1: authors and shelves bands; F-2: all that apply) |
| B2 | Count line | on `/library/all` it states what the list is; text matches `^\d+ (lucrare\|lucrări\|de lucrări) în toată biblioteca$` |
| B3 | Search by name | typing "vos" updates the count line ("1 lucrare cu „vos” în toată biblioteca"), highlights the match, and the A-Z bar lists only letters that have authors |
| B4 | URL state | choosing SECOL = XX gives `century=20` in the URL; reload restores it; default values never appear in the URL |
| B5 | By century | the tab shows tiles only for centuries that have works; a tile sets `century` and returns to "După autor" |
| B6 | Row anatomy | title in the reading language (switch the reading language to EN and the English title shows), italic original title when different, uppercase meta line, edition chips; no licence text anywhere in rows (no match for /licen/i) |
| B7 | Accordions | F-1 (1 author) open; F-2 (15 authors) all closed at first; a search that leaves 12 or fewer authors opens them |
| B8 | Empty | a query with no match shows "Nicio lucrare nu corespunde filtrelor." and "Șterge filtrele" restores the list |
| B9 | Phone | filter controls are full width and stacked; the A-Z bar scrolls inside its container only |

**Work hub**

| ID | Check | Expected |
|---|---|---|
| W1 | Card | title IM Fell Great Primer (34/40 wide, 30/36 phone); italic original title; author link; kind chip; tiles SECȚIUNI (= sections of the selected edition) and CUVINTE (rounded word count) |
| W2 | Editions | the switch changes the contents, the status chip and the start target; `?edition=` is written; the partial chip shows for the Romanian edition while it has fewer sections than the source |
| W3 | Transparency row | chip text matches the provenance kind; "Detalii" opens the same `transparency-panel` as the reader |
| W4 | Actions | first visit "Începe lectura", after reading "Continuă lectura"; "Citește în două limbi" opens the reader with `pair=`; "Întreabă despre această carte" opens `/ask?scope=work:<id>`; no offline button in P1 |
| W5 | Tabs | after scrolling 600 px the strip's top equals the section bar's bottom (plus or minus 1); "Prezentare" is 600 with a 2 px `accent` underline; only tabs with content exist; counts in labels |
| W6 | Contents | numeral column 44 px, numerals 600 and at least 15 px; the section read last is marked |
| W7 | Phone | the tab strip scrolls inside itself; the actions stack; the primary button is full width |

**Reader**

| ID | Check | Expected |
|---|---|---|
| R1 | Zones (1366x900) | toolbar 67 px (plus or minus 1), outline panel 300 px, reading column no wider than 37 em of the font size |
| R2 | Toolbar | controls in the order outline, title, prev/next, counter, Transparență, language, search, Aa, Unelte; each 36 px high; accessible names in both languages; with a one-edition work the language control is absent |
| R3 | Type | paragraph in Source Serif 4; default size 20 at 1366 and 17 at 390 for a fresh profile; line height 1.55 in light |
| R4 | Chapter card | eyebrow "Capitolul I" (uppercase by style); title 600 at 1.42 em (plus or minus 1 px); 1 px `border`; fill `surface` |
| R5 | Outline | tab row, search field, count line "11 intrări în cuprins"; the current entry has `aria-current=location`, 600 and a 2 px left bar in `accentStrong`; typing filters; "Arată curentul" scrolls to it |
| R6 | Language switch | choosing EN opens the aligned section and keeps the aligned paragraph (the paragraph in view has the same `data-source-id`); `?lang=en` in the URL; reload keeps it |
| R7 | Two lanes | at 1366 two columns, each row's two blocks the same height (plus or minus 1), left and right paragraph share a `data-source-id`, lane labels and a hairline divider; at 390 the lanes stack with lane labels |
| R8 | Gaps | in the partial Romanian edition the rows of untranslated paragraphs show the placeholder; the row count equals the source paragraph count |
| R9 | Transparency | the button reads "Transparență AI" for the Romanian Vos edition; the dialog is 560 px (plus or minus 2) with the rows SURSA, TRADUCEREA, VERIFICARE, CORECTURI; Esc closes; focus returns |
| R10 | Aa | size 24 gives 24 px paragraphs at once and after reload; "Aerisit" gives line height 1.85; font Literata changes the family; theme Sepia gives background `#EEE7D9` |
| R11 | Find | `/` opens the bar focused; "împărăția" gives "1 din N" with N at least 1; Enter moves on; Esc closes and the scroll position returns |
| R12 | Keyboard | → opens the next chapter; `[` toggles the outline; Tab starts in the section bar |
| R13 | Phone shell (390x844) | toolbar 53 px; thumb bar 61 px with five cells for a bilingual work (four otherwise); the section bar hides after 600 px down and returns after 100 px up; the outline drawer is 390 px wide and closes after choosing an entry; Language and Text open as bottom sheets |
| R14 | Citation | hovering a paragraph shows the rail; the copy button puts on the clipboard text matching `^[\s\S]+\n\n— .+\. — https?://\S+/read/\S+\?p=\S+$` |
| R15 | Deep link | `?p=<id>&q=words` scrolls the paragraph into view and gives it the `target` background (within 8 rgb units of the token); the words are marked |
| R16 | Local state | "Marcaj" adds the work to `/bookmarks`; a highlight survives a reload |
| R17 | Chapter end | the next-chapter card opens the next section; at the last section the end-of-work message shows "Întreabă despre această carte" |
| R18 | Progress | the 3 px bar at the bottom grows with scroll |
| R19 | Resume | leaving and coming back opens at the same paragraph (plus or minus one) |

**Transparency panel**

| ID | Check | Expected |
|---|---|---|
| T1 | Kinds | for each provenance kind fixture (ai, human, native, source, transcription, unknown) the lead sentence matches the table in 8.6 in RO and EN |
| T2 | Review | the chip reads NEVERIFICATĂ or VERIFICATĂ with the date when reviewed; the sentence names a reviewer (translations) or an editor (other kinds) and shows the role only when reviewed |
| T3 | Corrections | empty text when none; with six corrections five show and "Mai vechi" works |
| T4 | Report | the button builds a mail link whose body contains the citation of the open section |
| T5 | Phone | a sheet at most 70 % of the viewport high, scrollable, with focus on its close button |

**Ask** (mock gateway, fixture F-1)

| ID | Check | Expected |
|---|---|---|
| A1 | Welcome | H1 "Întreabă biblioteca"; four suggestion cards (2 x 2 wide); the composer is fully visible without scrolling at 1366x900 and at 390x844 |
| A2 | Suggestion | pressing a card fills the textarea with its prompt and sends no request |
| A3 | Send | the request body has `language` = reading language and the typed `question`; no `editionIds` for the whole library; "Am găsit N pasaje" appears before the first text; the stop button replaces send while streaming and aborts the request ("Oprit.") |
| A4 | Stream | the answer text grows over at least two observations; no raw `[1]` remains in the final text; chips exist |
| A5 | Chips | each chip is a button named "Sursa n: ..." with a 44 x 44 hit area; hover (desktop) opens the preview within 400 ms with the excerpt and, for sources with `aligned`, the other language under its label; Esc closes it and focus returns to the chip |
| A6 | Open in book | "Citește în carte" opens `/read/<workId>/<sectionId>?p=<paragraphId>`; the paragraph is in view with the `target` wash; Back returns to `/ask` with the same number of turns and scroll within 40 px |
| A7 | Source pane | 1366: "Citește aici" opens a pane 45 % wide (plus or minus 3) with the cited paragraph; dragging the handle 100 px changes the width, which is remembered after reload; double-click resets; 390: a full-screen layer with the tabs "Conversație" and "Citește sursa" |
| A8 | Receipts | at most three rows in citation order; "Toate sursele" counts equal the `sources` event (N passages, M works) |
| A9 | Labels | the AI label is under every answer; "Raportează" builds a mail link containing the request id |
| A10 | Notices | a stub with `quotations.unverified = 1` shows the notice with the exact wording; `invalidCitations = 2` shows the caption |
| A11 | Not covered | a stub with `stopReason = not_covered` replaces the body with the message and lists the works of `/v1/library` |
| A12 | Errors | 429 with `Retry-After: 5` shows a falling countdown and keeps the question; 503 shows the message and "Reia întrebarea" works; a stream cut shows "Răspunsul s-a oprit" and keeps the text |
| A13 | Language | UI EN with reading RO: the language chip reads RO; switching it to EN sends `language: "en"` |
| A14 | Scope | opened from a work hub the context line reads "Despre: <titlu>" and `editionIds` equal the work's edition ids; the chip set to the whole library removes `editionIds` |
| A15 | First use | the notice dialog shows once, traps focus, "Am înțeles" stores it, Esc closes without storing |
| A16 | Keys | Enter sends and Shift+Enter inserts a newline on desktop; with touch emulation Enter does not send |
| A17 | Persistence | the conversation survives a reload; "Conversație nouă" clears it |
| A18 | Limits | a response header `RateLimit-Remaining: 3` shows the caption "Mai poți pune 3 întrebări ..." |
| A19 | Suggestions | every prompt in `suggestions.ro.json` and `suggestions.en.json` returns at least one source on the installed packs (unit test) |

**Search, Settings, About, Bookmarks**

| ID | Check | Expected |
|---|---|---|
| Q1 | Search | three or more characters give results grouped by work with the match marked; "Lucrări" finds works by name; `/` focuses the field; a hit opens the reader with `?q=` |
| Q2 | Settings | the font line names IM Fell Great Primer, Source Serif 4, Literata and Inter; theme and reading font persist; the Ask notice state and "Revocă" work |
| Q3 | About | `/about/transparency` lists the Romanian Vos edition with its status, shows the eight commitment headings and the report button |
| Q4 | Bookmarks | a bookmarked work appears with title, author, edition label and place; "Elimină" needs two presses |

### 20.5 Look checklist (read the screenshots next to the reference captures)

For each screen in the matrix a reviewer confirms by eye: warm paper ground, not white; hairlines and spacing instead of boxes; small caps with generous tracking on bars and labels; terracotta only on the active or selected state, links and the primary action; IM Fell only in large display type; no icon without a text name;
cards have 3 px corners; the reader toolbar and outline look like inventory 4.5; the two-lane view reads as one aligned page; Ask looks like a page of a book with chips, not a chat bubble wall; dark and sepia keep the same hierarchy; nothing is cut off at 390 px.

---

## 21. Phase map and open questions

### 21.1 Phase map

| Area | P1 (Beta 1) | P2 | P3 | P4 and later |
|---|---|---|---|---|
| Shell | brand bar, section bar with live items, drawers, themes, UI language, footer | account entries, keyboard help, more items | tour, all items | membership entry |
| Landing | all bands except pricing and "Explorează" | "Explorează biblioteca" | | membership block |
| Library | Selecție, Toată biblioteca (shelves, centuries, A-Z, search by name), Authors (simple), signed catalogue | Traditions, author room, Library tab | Guides, Dictionary pattern | |
| Work hub | card, editions, transparency row, Prezentare, Cuprins | Scriptura, Index (Scripture part), downloads | the other tabs | |
| Reader | toolbar, outline, chapter cards, one or two lanes, Aa, Tools, find, Transparency, paragraph actions, bookmarks, local highlights, phone shell, keyboard | continuous flow, expand contents, footnotes, Scripture previews, range selection, docked Ask, notebook actions, focus mode | scans, margin notes, cross-work citations, Define | quote images, Modernize equivalent |
| Ask | page, SSE, chips, preview, source pane, scope by work or author, labels, errors, first-use notice, local conversation | history, share, docked panel, support check, account gate, meter, scope by shelf | Deep research, notebook, palette | |
| Search | local works and passages | Scripture mode, by meaning | | |
| Scripture | | v1 (reader, citations list) | Verse Desk, commentary pane | |
| Topics | | | index and topic page | |
| Notebook, Desk, Compare, Connections, Lexicon | | Notebook | Compare, Lexicon, Desk, Connections | |
| Account and consent | Ask notice (local) | sign-in, AI consent, deletion screen | | analytics consent, export |
| Membership | | | | plans, paywall |
| Books | Vos RO and EN; first Latin work in EN and RO; first creeds shelf (roadmap) | more works | | |

### 21.2 Open questions for the owner

| ID | Question | Why it matters | Default if unanswered |
|---|---|---|---|
| OQ-1 | The product name, wordmark and domain | brand bar, landing, emails, store listing | "Biblioteca" |
| OQ-2 | Hero and band art: which public-domain paintings (credits on About) | landing look and licence record | we propose a short list; the owner picks |
| OQ-3 | The shelf taxonomy of 6.3, in particular an Orthodox shelf | catalogue and landing | the eight shelves of 6.3 |
| OQ-4 | Publication policy for AI translations that no human has reviewed: show them in the beta with the explicit status "Neverificată" (as the reference does) or hold them back | trust and reputation in an Orthodox-majority market | beta shows them with the status; store release only reviewed editions |
| OQ-5 | Bible texts: which Romanian and English translations, permissions and the public-domain fallbacks (KJV, ASV, WEB for English; historical Romanian Bibles) | Scripture view, previews, Ask context | English public-domain first; Romanian when a licence arrives |
| OQ-6 | The Topics taxonomy (order and labels; one or two) | Topics, topic tags | defer to P3, draft from the reference's loci adapted by the owner |
| OQ-7 | The reading faces: keep Literata and Inter as options or drop Inter | bundle size | keep Literata, drop Inter in P2 if unused |
| OQ-8 | Ask tiers: model for free accounts and members, and the monthly budgets | cost and quality | per the architecture: Haiku free, Sonnet members |
| OQ-9 | Who reviews Romanian and English translations, and who owns the glossary per tradition | the Verificată status | owner names reviewers before P2 |
| OQ-10 | The feedback and report inbox address | P1 mail links | owner provides |
| OQ-11 | Pricing in RON and the plan set | P4 | per architecture section 11 |
| OQ-12 | Register of address in Romanian ("tu" or "dumneavoastră") | all copy | "tu" |
