import type { Section } from '@biblioteca/shared';

import { splitChapterHeading } from '@/reading/heading';

// The card that opens a section (docs/ui-spec-v2.md, 8.4): a chapter is a card with an eyebrow
// ("CAPITOLUL I") over its title; a section inside a chapter is a title under a rule, and one level
// further a smaller title. Pure: the component draws it.

export interface ChapterCardModel {
  /** 1: a card; 2: a title under a top rule; 3: a smaller title, no rule. */
  tier: 1 | 2 | 3;
  /** "Capitolul I": the word and the numeral of the heading; null when the heading has no numeral. */
  eyebrow: string | null;
  title: string;
  /** A long title is set smaller (1.1 em, 500). */
  long: boolean;
}

/** Over this many characters a title is set at 1.1 em instead of 1.42 em. */
export const LONG_TITLE = 80;

export function chapterCardModel(
  section: Pick<Section, 'heading' | 'kind'>,
  depth: number,
  words: { chapter: string; section: string },
): ChapterCardModel {
  const { numeral, title } = splitChapterHeading(section.heading);
  const word = section.kind === 'chapter' ? words.chapter : words.section;
  const shown = title.trim() === '' ? section.heading : title;
  return {
    tier: depth <= 0 ? 1 : depth === 1 ? 2 : 3,
    eyebrow: numeral === '' ? null : `${word} ${numeral}`,
    title: shown,
    long: shown.length > LONG_TITLE,
  };
}
