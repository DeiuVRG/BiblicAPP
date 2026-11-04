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

- The library shows **one row per work**. The row shows the Romanian title, the author line and
  the available editions as short labels ("Română · traducere", "Engleză · original"). The primary
  edition of a work is the Romanian translation when one is installed, otherwise the source.
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

## Routes and state

- `work/[id]` stays keyed by work id; the selected edition is a `?edition=<editionId>` search param
  with the primary edition as default (typed routes: keep the param optional).
- `read/[id]/[section]` stays; `id` is the work id, `section` identifies the edition through
  `locateSection`. If `section` does not belong to `id`, show the not-found state.
- Reading position (`src/reading/position-store.ts`): key by edition id; keep reading the old
  work-keyed entry once as a fallback for the source edition (migration without data loss).
- i18n (`src/i18n/ro.ts`): labels for "traducere"/"original" (reuse `editionKind`), the segmented
  control accessibility labels, and the search language label.

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
