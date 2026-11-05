import { isPartialEdition } from '@/content/editions';
import { workTitle } from '@/content/titles';
import type { EditionSummary } from '@/content/types';
import { baseLanguage } from '@/i18n/language';
import type { ReadingLanguage } from '@/i18n/language';
import { editionLabel, formatYear, languageName } from '@/i18n/labels';
import type { Strings } from '@/i18n/strings';

import { groupName, shelfLabel } from './model';
import type { LibraryModel, LibraryWork } from './model';

// What the rows and cards of the library say about a work, in the interface language (the strings)
// and the reading language (the titles and the names): one place, so every surface says it alike.

/** The name a work is filed under, in the reading language ("Geerhardus Vos", "Conciliul din Niceea I"). */
export function groupNameOf(
  model: LibraryModel,
  work: LibraryWork,
  language: ReadingLanguage,
): string {
  const group = model.groupByKey.get(work.groupKey);
  return group ? groupName(group, language) : work.summary.authorName;
}

/** The title of a work in the reading language. */
export function titleOf(work: LibraryWork, language: ReadingLanguage): string {
  return workTitle(work.summary, language);
}

/** "Geerhardus Vos · 1903 · Engleză": who, when, in what language (shown in capitals by style). */
export function fullMeta(
  model: LibraryModel,
  work: LibraryWork,
  language: ReadingLanguage,
  t: Strings,
): string {
  return [
    groupNameOf(model, work, language),
    formatYear(work.year, t),
    languageName(work.summary.languageOrig, t),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Geerhardus Vos · 1903": the short line of the curated bands (group and date). */
export function shortMeta(
  model: LibraryModel,
  work: LibraryWork,
  language: ReadingLanguage,
  t: Strings,
): string {
  return [groupNameOf(model, work, language), formatYear(work.year, t)].filter(Boolean).join(' · ');
}

export interface EditionBadge {
  key: string;
  /** "RO", "EN", "LA": the code of the language. */
  code: string;
  /** "Română · traducere": what a screen reader says. */
  label: string;
  partial: boolean;
}

/** The badges of the editions of a work, in display order, with the partial ones marked. */
export function editionBadges(editions: readonly EditionSummary[], t: Strings): EditionBadge[] {
  return editions.map((edition) => ({
    key: edition.editionId,
    code: baseLanguage(edition.language).toUpperCase(),
    label: editionLabel(edition, t),
    partial: isPartialEdition(edition, editions),
  }));
}

/** The label of a shelf by slug, in the reading language ("" for one the model does not have). */
export function shelfLabelOf(model: LibraryModel, slug: string, language: ReadingLanguage): string {
  const shelf = model.shelves.find((candidate) => candidate.slug === slug);
  return shelf ? shelfLabel(shelf, language) : '';
}

/** The accessible name of a row or a card: the title, who wrote it and the editions. */
export function workAccessibleName(
  title: string,
  meta: string,
  editions: readonly EditionBadge[],
  t: Strings,
): string {
  const list = editions
    .map((edition) =>
      edition.partial ? `${edition.label}, ${t.work.partial.toLowerCase()}` : edition.label,
    )
    .join('; ');
  return `${t.library.openWork(title)}. ${meta}. ${t.library.editions}: ${list}`;
}
