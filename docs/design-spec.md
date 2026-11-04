# Visual design and dark mode (web, Android, iOS)

Status: specification for the design pass requested by the owner on 4 November 2026 ("cleaner,
more pleasant, editorial, like mereorthodoxy.com; dark mode is not applied"). Applies to
`apps/mobile`. Functional behaviour (routes, repository, settings keys) stays as it is; this pass
changes appearance, layout and the web rendering mode.

## 1. Diagnosis of the dark-mode bug (verified with Playwright on the export)

With `web.output: 'static'` every route is pre-rendered at build time with the light palette
(there is no `matchMedia` at build time). In the browser, `useColorScheme()` returns `dark`
during hydration, so React's virtual tree has dark inline styles while the server HTML has light
ones. React 19 in production does **not** repair attribute/style mismatches during hydration: the
DOM keeps the light styles, and later re-renders with the same dark props produce no DOM update.
Everything rendered after hydration (the library rows, header links, separators) gets dark
colours; everything that was in the pre-rendered HTML (navigation header, screen container,
`Screen` background) stays light. Result: light grey text on a white page.

Fix (do all three):

1. `web.output: 'single'` in `app.config.ts` (SPA, no pre-rendering, no hydration). GitHub Pages
   deep links keep working through `404.html`: `scripts/prepare-pages.mjs` now simply copies
   `index.html` to `404.html` (remove the hydration-stripping logic and its comment in
   `docs/decizii.md` ADR-CI; `scripts/smoke-web.mjs` keeps its deep-link check). `_sitemap` is not
   generated any more; nothing depends on it.
2. The document itself follows the theme: on web, an effect in the root layout sets
   `document.documentElement.style.colorScheme` and `document.body.style.backgroundColor` from the
   active palette (so the area outside the app root and the scrollbars match), and the HTML
   template declares `<meta name="color-scheme" content="light dark">` plus a `<style>` with
   `html, body { background: #FBFAF7 } @media (prefers-color-scheme: dark) { html, body {
   background: #141311 } }` so there is no white flash before JavaScript runs. Use `app/+html.tsx`
   if the single output honours it in SDK 58 (verify in the export); otherwise inject the style
   at runtime in the same effect and accept the flash only on first load.
3. React Navigation gets the theme too: wrap the `Stack` in `ThemeProvider` from
   `@react-navigation/native` with `colors` derived from the palette (`background`, `card` =
   background, `text`, `border`, `primary` = accent, `notification` = accent) so that headers,
   back buttons and transitions never fall back to the default light/dark navigation theme.

Verification: `test-results/dark-check.mjs`-style Playwright run on the export with
`colorScheme: 'dark'` and `'light'`: the header title colour, the screen background and the body
background must come from the same palette in both schemes, on the library, work, reader and
settings routes, after a full load and after client-side navigation.

## 2. Design language ("editorial calm")

The reference is an editorial magazine site: generous whitespace, a serif for everything that is
a title or reading text, a quiet sans for labels, almost no colour, thin rules instead of boxes,
no icons except typographic ones. The app must feel like a well-set book, in light, sepia and
dark.

### 2.1 Type

- Serif: Literata (already bundled). Add the weights `Literata_500Medium` and
  `Literata_600SemiBold` from `@expo-google-fonts/literata` (already a dependency) for titles;
  keep 400/400 italic/700.
- Sans: Inter 400/500/600 (already bundled) for labels, buttons, metadata.
- Scale (phone / web ≥ 768 px):
  - display (work title on the work page): Literata 600, 30/36 (34/40 on web), letterSpacing −0.2
  - title (screen titles, library entry titles): Literata 600, 22/28
  - heading (section headings in settings, TOC headings): Literata 600, 18/24
  - body (reading text): Literata 400, user size (default 18) × user line height (default 1.6)
  - ui (buttons, segmented controls): Inter 500, 15/20
  - label (metadata, chips): Inter 500, 12/16, uppercase, letterSpacing 1.2, muted colour
  - caption (secondary lines): Inter 400, 13/18, muted colour
- Reading measure: paragraphs are limited to 680 px (web) / full width minus 24 px gutters
  (phone); the header of the reader shows the chapter heading in Literata 600 24/30, with the
  roman numeral kept as in the source.

### 2.2 Colour (three palettes, WCAG AA for text and muted text)

| token       | light (paper) | sepia      | dark (ink)  |
| ----------- | ------------- | ---------- | ----------- |
| background  | #FBFAF7       | #F4ECD8    | #141311     |
| surface     | #F3F1EB       | #EADFC4    | #1E1D1A     |
| text        | #141414       | #3B2F1E    | #E9E6DF     |
| textMuted   | #66645E       | #65553B    | #A5A29A     |
| border      | #E3E0D8       | #D2C3A0    | #2E2C27     |
| accent      | #7A2E2A       | #7A3E12    | #E0A58B     |
| onAccent    | #FFFFFF       | #FFFFFF    | #1A120F     |
| highlight   | #F3E3A6       | #F0CE70    | #5A4A12     |
| onHighlight | #141414       | #3B2F1E    | #FFFFFF     |
| target      | #F7F1DC       | #EFE0B5    | #2A2718     |
| statusBar   | dark          | dark       | light       |

Accent is used only for links, the primary button and the active segment. No gradients, no
shadows except a 1 px border on web hover. Check every text/background pair with a contrast
script in the tests (`units.test.ts` already has a contrast helper or add one).

### 2.3 Layout

- Web: content column centred, max width 880 px for lists and 680 px for reading text; gutters
  24 px (phone) / 40 px (≥ 768 px). The navigation header spans the full width with the same
  gutters; header title in Literata 600 20 px; header links in Inter 500 15 px, accent colour,
  underline on hover.
- Phone: 20 px gutters, safe-area aware bottom padding on lists (the reader already handles it).
- Separators: hairline in `border`; rows have 16 px vertical padding and a hover background
  `surface` on web; pressed state opacity 0.7.
- Buttons: primary = accent background, onAccent text, 48 px height, radius 6; secondary = 1 px
  border in `border`, text colour; text buttons for previous/next with typographic arrows (← →).
- Chips (licence status, language): Inter 500 12 px uppercase, 1 px border, radius 999, muted
  text; no background.

### 2.4 Screens

- Library: a short editorial lead under the title ("Cărți vechi, traduse cu grijă." as `t.library.subtitle`
  is fine to keep but set in Literata italic 16, muted), then one entry per work: title (title
  style), original title (Literata italic 15, muted) when different, metadata label line (author ·
  year · language, label style), chips for licence and, later, editions. Entries separated by
  hairlines, not cards.
- Work page: display title, original title italic, author with lifespan (caption), a two-column
  metadata block (label + value) for edition, language, licence; primary button "Începe lectura" /
  "Continuă lectura" full width on phone and max 320 px on web; "Cuprins" heading; TOC rows with
  the chapter numeral in label style and the heading in body serif; the current chapter marked
  with the accent rule on the left.
- Reader: paper background; chapter heading; paragraphs in the reading font; progress line
  ("2 din 11 · 9 %") in label style at the top right; bottom bar with previous/next text buttons
  and the "Aa" typography button; the typography sheet uses the same segmented controls as
  Settings. Search highlight uses `highlight`/`onHighlight`; the jumped-to paragraph uses
  `target` with a 300 ms fade.
- Search: input with a 1 px border, radius 6, 48 px; results as entries with the chapter in label
  style and the snippet in body serif with the match highlighted.
- Settings: sections with label-style headings (CITIRE, TEMA, DESPRE…), rows with the control on
  the right; the preview paragraph in the reading font on a `surface` block; the version and pack
  counts in caption style.
- Not found: centred, serif title, text button back to the library.

### 2.5 Dark mode and sepia

The three palettes are first-class: every component reads colours from `useTheme()`; no hard
coded colours anywhere (grep for `#` in `src/**/*.tsx` must only hit the palette file). The status
bar follows `statusBar`. The web body and `color-scheme` follow the active palette (section 1).

## 3. Deliverables and verification

- Code in `apps/mobile/src/theme/*` (palettes, type scale as a `typography.ts` module used by
  `AppText`), `components/*`, `features/*`, `app/_layout.tsx`, `app/+html.tsx` (if honoured),
  `app.config.ts`, `scripts/prepare-pages.mjs`, `docs/decizii.md` (ADR-UI amended with the new
  rendering mode and the design tokens), README screenshots replaced.
- Tests: existing Jest tests updated (no behaviour change expected except the navigation theme);
  a test that every palette pair meets 4.5:1; the Playwright smoke still passes on the export;
  the dark-mode check above passes (add it as `scripts/check-web-theme.mjs`, run in CI after the
  smoke).
- Screenshots in `docs/screenshots/`: library, work, reader, settings × light and dark, at
  390×844 (phone) and 1280×800 (desktop), taken with Playwright at deviceScaleFactor 2.
- Commands: `pnpm --filter mobile typecheck && pnpm --filter mobile lint && pnpm --filter mobile
  test && pnpm format:check && pnpm --filter mobile export:web && node scripts/smoke-web.mjs &&
  node scripts/check-web-theme.mjs`.

## 4. Amendments (4 November 2026, after implementation and two reviews)

Sections 1 to 3 stay as the original brief. Where the shipped design differs, this section is the
authority; `docs/decizii.md` (ADR-UI, amendments 1 and 2) has the reasoning and the checks.

- **Gutters.** One token per width: 24 px below 768 px and 40 px from 768 px (2.3 said 20 px in one
  place and 24 px in two others). Column widths (880 / 680) are content widths, gutters on top.
- **Navigation header (web).** The bar and its rule span the full width, but its content is lined
  up with the column of the screen below (880 px; 680 px on the reader and Settings), not with the
  window edge. iOS and Android keep the native header.
- **Reader header.** The work's title is a running head, not the 600 20 header title of 2.1: Literata
  italic 15/22 in the muted colour, on two lines on phones, so that the chapter heading stays the
  first thing the eye meets and the title is never cut off mid-word.
- **Work page.** The header says "Lucrare" (the work's title is the display title below it). The
  metadata block has a fourth row, "Original" (language and year of the original). The display
  title is balanced (no one-word last line) and caption paragraphs are limited to 600 px.
- **Accent.** Also used for text buttons and the web back arrow (the typographic arrows, "Aa", the
  header links), which are links in the typographic sense, besides the links, the primary button,
  the active segment and the current-chapter rule of 2.2 and 2.4.
- **Control outlines.** A second border token, `borderStrong` (light `#8A877F`, sepia `#8A7852`,
  dark `#6F6C64`; at least 3:1 on `background` and on `surface`, tested), for the outline of the
  search field, the steppers, the segmented control and secondary buttons. `border` (2.2) stays
  for hairlines, chips and the rule of a quotation. The 1.3:1 outline of 2.3 left the steppers
  barely visible on the reader panel and the search field below WCAG 1.4.11.
- **Focus.** One keyboard focus ring for the whole web app: 2 px, in the accent colour (2.2 allowed
  a border only on hover). On a text field it replaces the border instead of doubling it.
- **Settings.** Section headings are label-style (2.4); the "heading" style of 2.1 is for the table
  of contents. Rows stack the label above the control below 380 px.
- **Segmented control.** Wraps into two rows when its options would get less than 84 px each
  (narrow phones, large system fonts). On web it works like a native radio group: one tab stop,
  arrow keys, Home and End, Space.
- **Search.** The clear button sits inside the field. A result names the work only when the
  results come from more than one work.
- **Document.** The HTML template is `public/index.html` (an `app/+html.tsx` is ignored with
  `output: 'single'`) and paints from CSS variables, so `<html>` and `<body>` agree before any
  JavaScript runs. `ThemeProvider` comes from `expo-router`. Each screen names the browser tab
  ("Setări · Biblioteca"). The scrollbars follow the palette.
- **App icons.** The Expo template artwork is replaced by a Literata "B" with a short accent rule
  (paper on ink); `scripts/generate-icons.mjs` draws every icon and splash image.
