import type { Edition, Paragraph, Section, Work } from '@biblioteca/shared';

/** One row of the library list: a work together with the installed edition. */
export interface WorkSummary {
  workId: string;
  slug: string;
  titleRo: string;
  titleOrig: string;
  authorName: string;
  year: number | null;
  languageOrig: string;
  editionId: string;
  editionLanguage: string;
  licenceStatus: Edition['licence']['status'];
}

export interface WorkDetail {
  work: Work;
  edition: Edition;
  packId: string;
  sectionCount: number;
}

export interface SearchHit {
  workId: string;
  sectionId: string;
  paragraphId: string;
  sectionHeading: string;
  /** Short excerpt around the match. */
  snippet: string;
}

export type { Edition, Paragraph, Section, Work };
