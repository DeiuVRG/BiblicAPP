import { Platform } from 'react-native';

import type { FontGroup } from './font-sources';

export type { FontGroup } from './font-sources';

/** The faces the reader can choose for reading text (the `readingFont` setting). */
export type ReadingFont = 'serif' | 'literata' | 'sans';
export const READING_FONTS: readonly ReadingFont[] = ['serif', 'literata', 'sans'];

/** One face of a reading font family: regular, italic, semi-bold (headings) and bold (strong text). */
export interface ReadingFaces {
  regular: string | undefined;
  italic: string | undefined;
  semiBold: string | undefined;
  bold: string | undefined;
}

/**
 * Family names to put in `fontFamily`. A name is `undefined` on native (the system font) and a
 * web stack on web until the file is loaded; the faces that load on demand fall back to the
 * Source Serif 4 face next to them, so text never jumps to a sans-serif while a font arrives.
 */
export interface FontFamilies {
  /**
   * IM Fell Great Primer 400: hero and band headings, numerals, gate and panel titles (italic).
   * Only weight 400 exists: never ask for a bold weight. It has no arrows, no thin space and no
   * Greek, so display styles never carry those.
   */
  display: string | undefined;
  displayItalic: string | undefined;
  /** Source Serif 4: text and chrome. */
  text: string | undefined;
  textItalic: string | undefined;
  textSemiBold: string | undefined;
  textSemiBoldItalic: string | undefined;
  /** Literata, the "Literata" reading option. */
  literata: ReadingFaces;
  /** Inter, the "Sans" reading option. */
  sans: ReadingFaces;
  /** Gentium Plus: polytonic Greek. */
  greek: { regular: string | undefined; italic: string | undefined };
}

const webSerif = 'Georgia, "Times New Roman", serif';

/** The faces of the family that is shown while nothing is loaded: the web serif, or the system font. */
const system: string | undefined = Platform.OS === 'web' ? webSerif : undefined;

function faces(regular: string | undefined): ReadingFaces {
  return { regular, italic: regular, semiBold: regular, bold: regular };
}

/** Used until the first-paint set is loaded, and when loading fails. */
export const fallbackFonts: FontFamilies = {
  display: system,
  displayItalic: system,
  text: system,
  textItalic: system,
  textSemiBold: system,
  textSemiBoldItalic: system,
  literata: faces(system),
  sans: faces(system),
  greek: { regular: system, italic: system },
};

/** What is loaded: the first-paint set or not, and the groups of on-demand fonts. */
export interface FontState {
  firstPaint: boolean;
  groups: ReadonlySet<FontGroup>;
}

/** The family names for a state of loading (pure: the tests give it any state). */
export function fontFamiliesFor({ firstPaint, groups }: FontState): FontFamilies {
  if (!firstPaint) return fallbackFonts;
  const text = 'SourceSerif4_400Regular';
  const textItalic = 'SourceSerif4_400Regular_Italic';
  const textSemiBold = 'SourceSerif4_600SemiBold';
  const literata = groups.has('literata');
  const inter = groups.has('inter');
  const gentium = groups.has('gentium');
  return {
    display: 'IMFellGreatPrimer_400Regular',
    displayItalic: 'IMFellGreatPrimer_400Regular_Italic',
    text,
    textItalic,
    textSemiBold,
    textSemiBoldItalic: groups.has('serifSemiBoldItalic')
      ? 'SourceSerif4_600SemiBold_Italic'
      : textItalic,
    literata: literata
      ? {
          regular: 'Literata_400Regular',
          italic: 'Literata_400Regular_Italic',
          semiBold: 'Literata_600SemiBold',
          bold: 'Literata_700Bold',
        }
      : { regular: text, italic: textItalic, semiBold: textSemiBold, bold: textSemiBold },
    sans: inter
      ? {
          regular: 'Inter_400Regular',
          // Inter has no italic file: the Source Serif italic keeps the emphasis.
          italic: textItalic,
          semiBold: 'Inter_600SemiBold',
          bold: 'Inter_600SemiBold',
        }
      : { regular: text, italic: textItalic, semiBold: textSemiBold, bold: textSemiBold },
    greek: gentium
      ? { regular: 'GentiumPlus_400Regular', italic: 'GentiumPlus_400Regular_Italic' }
      : { regular: text, italic: textItalic },
  };
}

/** Everything loaded (the tests, which render without waiting for fonts, use this one). */
export const loadedFonts: FontFamilies = fontFamiliesFor({
  firstPaint: true,
  groups: new Set<FontGroup>(['serifSemiBoldItalic', 'literata', 'inter', 'gentium']),
});

/**
 * The faces of the reader's chosen reading font. Source Serif 4 has no 700 before P2, so its
 * strong text is the 600; Literata's is its 700.
 */
export function readingFaces(fonts: FontFamilies, readingFont: ReadingFont): ReadingFaces {
  switch (readingFont) {
    case 'literata':
      return fonts.literata;
    case 'sans':
      return fonts.sans;
    case 'serif':
    default:
      return {
        regular: fonts.text,
        italic: fonts.textItalic,
        semiBold: fonts.textSemiBold,
        bold: fonts.textSemiBold,
      };
  }
}

/** The group a reading font needs, if any: Source Serif 4 is in the first-paint set. */
export function groupForReadingFont(readingFont: ReadingFont): FontGroup | null {
  return readingFont === 'serif' ? null : readingFont === 'literata' ? 'literata' : 'inter';
}

/** True for a language whose text needs the Greek face (ancient Greek: `grc`). */
export function needsGreekFace(language: string | undefined): boolean {
  return (language ?? '').toLowerCase().split(/[-_]/)[0] === 'grc';
}

/** True when the text has Greek Extended letters (U+1F00 to U+1FFF), which Source Serif 4 lacks. */
export function hasPolytonicGreek(text: string): boolean {
  return /[ἀ-῿]/.test(text);
}

/** A stretch of text, and whether it is polytonic Greek (to be set in Gentium Plus). */
export interface GreekRun {
  text: string;
  greek: boolean;
}

// One Greek word: Greek and Coptic (U+0370 to U+03FF) or Greek Extended letters, with their
// combining marks. A phrase is words joined by spaces and the punctuation that sits between them.
const GREEK_WORD =
  '[\\u0370-\\u03FF\\u1F00-\\u1FFF][\\u0300-\\u036F\\u0370-\\u03FF\\u1F00-\\u1FFF]*';
const GREEK_PHRASE = new RegExp(
  `${GREEK_WORD}(?:[\\s,.;:·'’"“”()\\u2010-\\u2015-]+${GREEK_WORD})*`,
  'gu',
);

/**
 * Splits text into the runs that need the Greek face and the rest, for a text that is not a Greek
 * edition but quotes Greek words (an English or Romanian book that gives "ἐκκλησία"). A run is a
 * whole Greek phrase (words, and the spaces and punctuation between them, so that the phrase is
 * set in one face) that has at least one Greek Extended letter; a phrase of basic Greek only
 * (Source Serif 4 has it) stays in the reading face. The runs joined give the text back.
 */
export function splitGreekRuns(text: string): GreekRun[] {
  const runs: GreekRun[] = [];
  let cursor = 0;
  const push = (piece: string, greek: boolean) => {
    if (piece === '') return;
    const last = runs.at(-1);
    if (last && last.greek === greek) last.text += piece;
    else runs.push({ text: piece, greek });
  };
  for (const match of text.matchAll(GREEK_PHRASE)) {
    const phrase = match[0];
    const at = match.index ?? 0;
    push(text.slice(cursor, at), false);
    push(phrase, hasPolytonicGreek(phrase));
    cursor = at + phrase.length;
  }
  push(text.slice(cursor), false);
  return runs.length > 0 ? runs : [{ text, greek: false }];
}
