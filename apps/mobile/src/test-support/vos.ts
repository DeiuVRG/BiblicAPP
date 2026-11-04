import type { Section } from '@biblioteca/shared';

import type { ContentRepository } from '@/content/repository';
import type { EditionSummary, WorkSummary } from '@/content/types';
import type { ReadingLanguage } from '@/i18n/language';

/** The Vos work as the bundled packs install it: the English source and the Romanian translation. */
export interface VosEditions {
  work: WorkSummary;
  english: EditionSummary;
  romanian: EditionSummary;
  englishSections: Section[];
  romanianSections: Section[];
}

export async function vosEditions(
  repository: ContentRepository,
  readingLanguage: ReadingLanguage = 'ro',
): Promise<VosEditions> {
  const [work] = await repository.listWorks(readingLanguage);
  const english = work?.editions.find((edition) => edition.language === 'en');
  const romanian = work?.editions.find((edition) => edition.language === 'ro');
  if (!work || !english || !romanian) throw new Error('the bundled Vos editions are missing');
  const [englishSections, romanianSections] = await Promise.all([
    repository.getSections(english.editionId),
    repository.getSections(romanian.editionId),
  ]);
  return { work, english, romanian, englishSections, romanianSections };
}
