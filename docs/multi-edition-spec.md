# Several editions of one work in the app (source + translation)

Status: specification for the change that must land before a translated pack is bundled next to
its source pack. Context: `docs/traducere-pipeline.md` (translations are separate editions aligned
by `sourceId`), `docs/decizii.md` ADR-012.

## Problem

`createInMemoryRepository` (apps/mobile/src/content/repository.ts) keys works by `work.id` and
lists one library row per pack. Two packs of the same work (edition `en` = source, edition `ro`
= translation) would overwrite each other in `byWork`/`packIds`, and `getSections(workId)` could
not say which edition it means. Reading positions are stored per work, but a position in the
Romanian edition is meaningless in the English one.

## Target behaviour

- Product rule (owner, 4 November 2026): every work is offered for reading in **Romanian and in
  English**, whatever the original language. A work therefore has up to three editions installed:
  `ro` (translation), `en` (source or translation) and, optionally, the original (`la`, `grc`,
  `de`, …) for readers who want it.
- The user chooses a **reading language** in Settings (`readingLanguage: 'ro' | 'en'`, default
  from the device locale: `ro` when the device is Romanian, else `en`). The primary edition of a
  work is the installed edition in the reading language; fallback order `ro → en → source`.
- The **interface language** follows the same rule: `uiLanguage: 'system' | 'ro' | 'en'`, with an
  `en.ts` string table next to `ro.ts` and `t` resolved from the current UI language (the string
  table type `Strings` is shared; a missing key is a type error). Titles of works keep both
  `titleRo` and `titleOrig`; the library shows the title in the reading language when it has one
  (`titleRo` for `ro`, `titleOrig` when the original is English, otherwise the `en` edition's
  heading from its pack — see "Edition titles" below).
- The library shows **one row per work**. The row shows the title in the reading language, the
  author line and the available editions as short labels ("Română · traducere", "English ·
  original", "Latină · original"). The primary edition is the one in the reading language.
- The work page shows the editions as a segmented control (hidden when there is only one), the
  metadata of the selected edition (kind, language, licence note) and the table of contents of the
  selected edition. "Începe lectura" / "Continuă lectura" open the selected edition; the continue
  position is the one saved for that edition.
- The reader is edition-scoped: previous/next move inside the edition's sections; the header shows
  the work title and, when the work has several editions, a small language label. Deep links keep
  working: a section id identifies its edition.
- Search results show the edition language next to the section heading; opening a hit opens that
  edition.
- Settings "Pachete de conținut" count stays per pack.

## Repository API

```ts
interface EditionSummary {
  editionId: string; packId: string; language: string; kind: 'source' | 'translation';
  licenceStatus: Licence['status']; licenceNote: string; sourceEditionId?: string; sectionCount: number;
}
interface WorkSummary {                 // one per work
  workId, slug, titleRo, titleOrig, authorName, year, languageOrig,
  editions: EditionSummary[];           // ordered: translations into 'ro' first, then source, then others
  primaryEditionId: string;
}
interface WorkDetail { work: Work; editions: EditionSummary[]; primaryEditionId: string }
interface SectionLocation { workId: string; editionId: string; language: string }

interface ContentRepository {
  listWorks(): Promise<WorkSummary[]>;
  getWork(workId: string): Promise<WorkDetail | null>;
  getEdition(editionId: string): Promise<(EditionSummary & { work: Work; edition: Edition }) | null>;
  getSections(editionId: string): Promise<Section[]>;          // was workId
  getParagraphs(sectionId: string): Promise<Paragraph[]>;
  locateSection(sectionId: string): Promise<SectionLocation | null>;
  search(query: string): Promise<SearchHit[]>;                 // SearchHit gains editionId + language
}
```

Two packs with the same `work.id` are merged into one work; packs with the same `edition.id` are a
verification error (`duplicate-edition`, the second one is rejected and reported like a bad
signature, with its packId). Section and paragraph ids must be unique across all installed packs;
a collision rejects the later pack (`duplicate-id`).

## Edition titles

`Work` has `titleRo` and `titleOrig` only. An English translation of a Latin work needs an English
title: add an optional `titleEn` to `WorkSchema` (additive; source packs are unchanged when the
field is absent) and have `translation-merge` fill it from the translated edition's metadata
(`translation-<lang>/edition.json` → `workTitle`). The library picks `titleRo` / `titleEn` /
`titleOrig` by reading language, falling back to `titleRo`.

## Routes and state

- `work/[id]` stays keyed by work id; the selected edition is a `?edition=<editionId>` search param
  with the primary edition as default (typed routes: keep the param optional).
- `read/[id]/[section]` stays; `id` is the work id, `section` identifies the edition through
  `locateSection`. If `section` does not belong to `id`, show the not-found state.
- Reading position (`src/reading/position-store.ts`): key by edition id; keep reading the old
  work-keyed entry once as a fallback for the source edition (migration without data loss).
- i18n (`src/i18n/ro.ts`, new `src/i18n/en.ts`): labels for "traducere"/"original" (reuse
  `editionKind`), the segmented control accessibility labels, the search language label, the
  reading-language and interface-language settings. Every string exists in both tables.

## Tests

- repository: two packs of one work → one `WorkSummary` with two editions and the `ro` one primary;
  `getSections` per edition; `locateSection`; duplicate edition id rejected; duplicate section id
  across packs rejected; search hits carry the edition.
- work screen: segmented control switches the TOC and the start button target; hidden with one
  edition.
- reader: prev/next stay inside the edition; deep link to a section of the other edition works.
- position store migration.
- Existing tests keep passing; the Playwright smoke (`scripts/smoke-web.mjs`) still finds the
  library row, the TOC and the reader with the single bundled pack.

## Out of scope

Side-by-side source/translation view, the "Transparența traducerii" panel, paragraph-level
alignment navigation (the `sourceId` data is already in the packs for these), downloading packs.

## Amendments (4 November 2026, after the design pass and the pilot translation)

- The design pass (`docs/design-spec.md`, section 4) changed the components and screens: read the
  current code (`components/app-header.tsx`, `column.tsx`, `chip.tsx`, `segmented-control.tsx`,
  `setting-row.tsx`, `theme/typography.ts`, `theme/layout.ts`, `features/**`) and keep its design
  language; the edition switch on the work page uses the existing `SegmentedControl`; edition
  labels use the existing `Chip`.
- A partial Romanian pack exists: `apps/mobile/assets/packs/vos-1903-kingdom-ro` (edition
  `kind: 'translation'`, `sourceEditionId` of the English edition, 1 of 11 sections for now).
  Bundle it in `bundled-packs.ts` once the repository handles two editions of one work. An edition
  whose section count is smaller than its source edition's (when the source is installed) is
  **partial**: show a chip "Traducere parțială" / "Partial translation" on the work page and the
  library entry, and list only its sections in the TOC.
- Licence notes are prose in the edition's own language. Add optional `noteRo` and `noteEn` to
  `LicenceSchema` (additive; absent in existing packs); the UI shows the note matching the
  interface language, falling back to `note`. For the Vos English edition, add `noteRo` to
  `content/works/vos-1903-kingdom/work.json` and `edition-en.json` (Romanian translation of the
  existing note) and rebuild the pack with `build-pack` (`content/keys/dev.key` is present in
  this container; the revision bumps to 3; `committed-content.test.ts` must stay green, it
  compares the pack with the edition file). The Romanian edition's note is already Romanian; add
  its `noteEn`.
- `titleEn` on `WorkSchema` (section "Edition titles") is still required; for Vos it equals
  `titleOrig`.
- Interface language: the reading-language default and the interface-language default both come
  from the device locale (`expo-localization` is not a dependency; use
  `Intl.DateTimeFormat().resolvedOptions().locale` with a try/catch and `navigator.language` on
  web; Hermes supports `Intl.DateTimeFormat`). Persist both in the existing settings store with
  the sanitiser pattern of `settings/sanitize.ts`.
- `scripts/check-web-theme.mjs`, `scripts/smoke-web.mjs` and `scripts/screenshots-web.mjs` must
  keep passing; update their selectors if the library row or the work page structure changes, and
  re-take the screenshots at the end (`node scripts/screenshots-web.mjs`).
