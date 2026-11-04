import type { ReadingLanguage } from '@/i18n/language';

import type { EditionSummary } from './types';

// Pure rules about the editions of one work. No React, no repository: the repository applies
// them when it builds its summaries and the screens use them on the summaries they hold.

type OrderFields = Pick<EditionSummary, 'language' | 'kind'>;

/** Translations into Romanian come first, then the source edition, then everything else. */
function rank(edition: OrderFields): number {
  if (edition.kind === 'translation' && edition.language === 'ro') return 0;
  if (edition.kind === 'source') return 1;
  return 2;
}

/**
 * The editions of a work in display order. The order is explicit about ties (editions of equal
 * rank keep the order they came in), so it does not depend on the engine's sort being stable.
 */
export function orderEditions<T extends OrderFields>(editions: readonly T[]): T[] {
  return editions
    .map((edition, index) => ({ edition, index }))
    .sort((a, b) => rank(a.edition) - rank(b.edition) || a.index - b.index)
    .map(({ edition }) => edition);
}

/**
 * The edition that opens first for a reading language: the installed edition in that language;
 * failing that, the first of Romanian, English and the source edition that is installed; failing
 * that, the first edition. Undefined only for a work without editions.
 */
export function pickPrimaryEdition<T extends Pick<EditionSummary, 'language' | 'kind'>>(
  editions: readonly T[],
  readingLanguage: ReadingLanguage,
): T | undefined {
  const inLanguage = (language: string) =>
    editions.find((edition) => edition.language === language);
  return (
    inLanguage(readingLanguage) ??
    inLanguage('ro') ??
    inLanguage('en') ??
    editions.find((edition) => edition.kind === 'source') ??
    editions[0]
  );
}

/**
 * A translation that covers fewer sections than its source edition is partial. Without the source
 * edition installed there is nothing to compare with, so the edition counts as complete.
 */
export function isPartialEdition(
  edition: Pick<EditionSummary, 'kind' | 'sourceEditionId' | 'sectionCount'>,
  editions: readonly Pick<EditionSummary, 'editionId' | 'sectionCount'>[],
): boolean {
  if (edition.kind !== 'translation' || edition.sourceEditionId === undefined) return false;
  const source = editions.find((candidate) => candidate.editionId === edition.sourceEditionId);
  return source !== undefined && edition.sectionCount < source.sectionCount;
}
