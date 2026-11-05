import type { Edition, Licence, Paragraph, Section, Work } from '@biblioteca/shared';

/** One installed edition of a work: the source text, or a translation aligned to it. */
export interface EditionSummary {
  editionId: string;
  packId: string;
  /** Language of the edition's text ("ro", "en", "la"...). */
  language: string;
  kind: Edition['kind'];
  licenceStatus: Licence['status'];
  /** The licence note in the edition's own language; the full licence is on `getEdition`. */
  licenceNote: string;
  /** Translations only: the edition this one is aligned to. */
  sourceEditionId?: string;
  sectionCount: number;
}

/** One row of the library: a work with all its installed editions. */
export interface WorkSummary {
  workId: string;
  slug: string;
  titleRo: string;
  /** English title (see `WorkSchema.titleEn`); absent for works whose original is English. */
  titleEn?: string;
  titleOrig: string;
  authorName: string;
  /** Life dates of the author as the pack records them (null when unknown). */
  authorBorn: number | null;
  authorDied: number | null;
  year: number | null;
  languageOrig: string;
  /** Ordered: translations into Romanian first, then the source edition, then the others. */
  editions: EditionSummary[];
  /** The edition that opens first, for the reading language the list was asked for. */
  primaryEditionId: string;
}

export interface WorkDetail {
  work: Work;
  editions: EditionSummary[];
  primaryEditionId: string;
}

/** An edition with the metadata of its work and the edition record itself (licence, provenance). */
export type EditionDetail = EditionSummary & { work: Work; edition: Edition };

/** Where a section lives: a section id identifies its edition. */
export interface SectionLocation {
  workId: string;
  editionId: string;
  language: string;
}

/**
 * One row of two editions of a work read side by side: the paragraph of each edition that renders the
 * same paragraph of the source edition (docs/ui-spec-v2.md, 8.5). The row is keyed by that source
 * paragraph, so a row exists for every paragraph of the source section even where an edition has not
 * translated it yet: that side is null and the reader shows a placeholder, it never drops the row.
 */
export interface AlignedParagraph {
  /** The id of the source paragraph both sides render (a translation's `sourceId`; a source's own id). */
  sourceId: string;
  /** The paragraph of the section that was asked about; null when that edition has none for this row. */
  paragraph: Paragraph | null;
  /** The paragraph of the other edition; null when it is not translated (yet). */
  other: Paragraph | null;
}

export interface SearchHit {
  workId: string;
  editionId: string;
  /** Language of the edition the hit is in. */
  language: string;
  sectionId: string;
  paragraphId: string;
  sectionHeading: string;
  /** Short excerpt around the match. */
  snippet: string;
}

export type { Edition, Paragraph, Section, Work };
