import { baseLanguage } from '@/i18n/language';
import type { ReadingLanguage } from '@/i18n/language';

/** The title fields of a work (both `Work` and `WorkSummary` have them). */
export interface WorkTitles {
  titleRo: string;
  titleEn?: string;
  titleOrig: string;
  languageOrig: string;
}

/**
 * The title of a work in the reading language: `titleRo` for Romanian; for English the `titleEn`
 * of the work, or the original title when the original is English; `titleRo` when neither exists.
 */
export function workTitle(work: WorkTitles, readingLanguage: ReadingLanguage): string {
  if (readingLanguage === 'ro') return work.titleRo;
  if (work.titleEn !== undefined && work.titleEn.trim() !== '') return work.titleEn;
  if (baseLanguage(work.languageOrig) === 'en' && work.titleOrig.trim() !== '') {
    return work.titleOrig;
  }
  return work.titleRo;
}

/** The original title, to show under the title of the work, or null when it adds nothing. */
export function originalTitleToShow(work: WorkTitles, shown: string): string | null {
  const original = work.titleOrig.trim();
  return original !== '' && original !== shown ? work.titleOrig : null;
}
