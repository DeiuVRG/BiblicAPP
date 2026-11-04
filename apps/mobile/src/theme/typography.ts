import type { Paragraph } from '@biblioteca/shared';

import { readingFaces } from './font-families';
import type { FontFamilies, ReadingFont } from './font-families';

/**
 * The type scale of docs/ui-spec-v2.md, section 2.3. Display type is IM Fell Great Primer (only
 * weight 400); text and chrome are Source Serif 4; `reading` is the face the reader chose. Sizes
 * are in points; system font scaling is applied on top and capped by the components
 * (`UI_MAX_FONT_SCALE`, `READING_MAX_FONT_SCALE`). Labels shown in capitals are sentence case in
 * the DOM and uppercase by style (`textTransform`).
 */
export type TypeVariant =
  | 'displayXL' // landing hero H1
  | 'displayL' // page hero H1
  | 'displayM' // band H2
  | 'displayS' // card and panel titles
  | 'displaySItalic' // panel and gate titles, the brand wordmark
  | 'numeral' // stat figures, ordinal numerals
  | 'title' // library row and work titles
  | 'heading' // section headings, tab panels
  | 'lead' // editorial lead lines
  | 'body' // page text (not the reader)
  | 'meta' // meta lines, descriptions, setting labels
  | 'caption' // notes, captions
  | 'original' // original title under a title
  | 'label' // filter labels, card kickers, stat captions
  | 'kicker' // hero eyebrow, section kicker
  | 'rail' // section bar items
  | 'railBrand' // the brand item of the section bar
  | 'railDrawer' // drawer items
  | 'button' // CTAs
  | 'chip' // status chips and badges
  | 'chrome' // reader toolbar buttons
  | 'readerTitle' // reader toolbar title
  | 'chapterTitle' // chapter card title
  | 'eyebrow' // chapter card eyebrow ("CAPITOLUL I")
  | 'reading' // reader text: the reader's face, size and line height
  | 'askAnswer'; // Ask answer body

export interface TypeStyle {
  fontFamily: string | undefined;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

/** Font scaling is respected, but capped so layouts stay usable at the largest system sizes. */
export const UI_MAX_FONT_SCALE = 1.5;
/** Reading text honours the system font scale up to a higher cap, so very large settings stay usable. */
export const READING_MAX_FONT_SCALE = 1.6;

/** Variants that are reading text: they scale up to `READING_MAX_FONT_SCALE`. */
export const READING_VARIANTS: ReadonlySet<TypeVariant> = new Set<TypeVariant>([
  'reading',
  'askAnswer',
  'chapterTitle',
  'eyebrow',
]);

/** The colour a variant reads in by default. */
export type TextTone = 'text' | 'muted' | 'accent' | 'danger';

/** Variants that read in the muted colour unless told otherwise. */
export const MUTED_VARIANTS: ReadonlySet<TypeVariant> = new Set<TypeVariant>([
  'lead',
  'original',
  'label',
  'caption',
  'rail',
]);

/** Variants that read in the accent colour (`accentStrong`; `mastheadAccent` on dark bands). */
export const ACCENT_VARIANTS: ReadonlySet<TypeVariant> = new Set<TypeVariant>([
  'kicker',
  'eyebrow',
]);

/** Variants that name a part of the page (exposed as headings to assistive technology). */
export const HEADING_VARIANTS: ReadonlySet<TypeVariant> = new Set<TypeVariant>([
  'displayXL',
  'displayL',
  'displayM',
  'displayS',
  'displaySItalic',
  'title',
  'heading',
  'chapterTitle',
]);

/** Outline level of the heading variants (react-native-web renders every heading as h1 otherwise). */
export const HEADING_LEVELS: Partial<Record<TypeVariant, number>> = {
  displayXL: 1,
  displayL: 1,
  displayM: 2,
  displayS: 3,
  displaySItalic: 3,
  title: 2,
  heading: 3,
  chapterTitle: 2,
};

export interface TypeOptions {
  fonts: FontFamilies;
  /** Web and tablet widths (768 px and up) use the larger sizes. */
  wide?: boolean;
  /** The window width: `displayXL` on a phone is `clamp(22, 7.4vw, 32)`; 29 when not given. */
  width?: number;
  /** The reader's font size, used by `reading` and `chapterTitle` (default 17). */
  readingSize?: number;
  /** The reader's line height as a multiple of the font size, used by `reading` (default 1.55). */
  readingLineHeight?: number;
  /** The reader's face, used by `reading` (default Source Serif 4). */
  readingFont?: ReadingFont;
}

/** Line height in points for a font size and a multiple, rounded to whole points. */
export function lineHeightFor(fontSize: number, multiple: number): number {
  return Math.round(fontSize * multiple);
}

/** Size of the landing hero title on a phone: 7.4 % of the window width, between 22 and 32. */
export function displayXLPhoneSize(width: number | undefined): number {
  if (width === undefined) return 29;
  return Math.min(32, Math.max(22, Math.round(width * 0.074)));
}

export function typeStyle(variant: TypeVariant, options: TypeOptions): TypeStyle {
  const {
    fonts,
    wide = false,
    width,
    readingSize = 17,
    readingLineHeight = 1.55,
    readingFont = 'serif',
  } = options;
  const pick = <T>(phone: T, large: T): T => (wide ? large : phone);
  switch (variant) {
    case 'displayXL': {
      if (wide) return { fontFamily: fonts.display, fontSize: 52, lineHeight: 56 };
      const size = displayXLPhoneSize(width);
      return {
        fontFamily: fonts.display,
        fontSize: size,
        lineHeight: Math.round((size * 33) / 29),
      };
    }
    case 'displayL':
      return {
        fontFamily: fonts.display,
        fontSize: pick(32, 52),
        lineHeight: pick(36, 56),
      };
    case 'displayM':
      return { fontFamily: fonts.display, fontSize: pick(26, 38), lineHeight: pick(30, 42) };
    case 'displayS':
      return { fontFamily: fonts.display, fontSize: pick(22, 28), lineHeight: pick(26, 32) };
    case 'displaySItalic':
      return { fontFamily: fonts.displayItalic, fontSize: pick(22, 28), lineHeight: pick(26, 32) };
    case 'numeral':
      return { fontFamily: fonts.display, fontSize: pick(36, 46), lineHeight: pick(40, 50) };
    case 'title':
      return { fontFamily: fonts.textSemiBold, fontSize: pick(20, 22), lineHeight: pick(26, 28) };
    case 'heading':
      return { fontFamily: fonts.textSemiBold, fontSize: pick(18, 20), lineHeight: pick(24, 26) };
    case 'lead':
      return { fontFamily: fonts.textItalic, fontSize: pick(16, 17), lineHeight: pick(24, 26) };
    case 'body':
      return { fontFamily: fonts.text, fontSize: 17, lineHeight: pick(27, 27.2) };
    case 'meta':
      return { fontFamily: fonts.text, fontSize: 14, lineHeight: pick(20, 21) };
    case 'caption':
      return { fontFamily: fonts.text, fontSize: 13, lineHeight: pick(18, 19) };
    case 'original':
      return { fontFamily: fonts.textItalic, fontSize: 15, lineHeight: 22 };
    case 'label':
      return {
        fontFamily: fonts.textSemiBold,
        fontSize: 11,
        lineHeight: 16,
        letterSpacing: 2.4,
        textTransform: 'uppercase',
      };
    case 'kicker':
      return {
        fontFamily: fonts.text,
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 3.6,
        textTransform: 'uppercase',
      };
    case 'rail':
      return {
        fontFamily: fonts.text,
        fontSize: pick(12.5, 13),
        lineHeight: 16,
        letterSpacing: pick(0.75, 1.3),
        textTransform: 'uppercase',
      };
    case 'railBrand':
      return {
        fontFamily: fonts.textSemiBold,
        fontSize: pick(12, 13),
        lineHeight: 16,
        letterSpacing: pick(0.84, 1.3),
        textTransform: 'uppercase',
      };
    case 'railDrawer':
      return {
        fontFamily: fonts.text,
        fontSize: pick(13, 12),
        lineHeight: pick(18, 16),
        letterSpacing: pick(0.78, 0.72),
        textTransform: 'uppercase',
      };
    case 'button':
      return {
        fontFamily: fonts.textSemiBold,
        fontSize: 13,
        lineHeight: 16,
        letterSpacing: 1.8,
        textTransform: 'uppercase',
      };
    case 'chip':
      return {
        fontFamily: fonts.textSemiBold,
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
      };
    case 'chrome':
      return { fontFamily: fonts.text, fontSize: 13, lineHeight: 16 };
    case 'readerTitle':
      return { fontFamily: fonts.text, fontSize: pick(16, 20), lineHeight: pick(20, 25) };
    case 'chapterTitle': {
      const size = Math.round(readingSize * pick(1.24, 1.42));
      return {
        fontFamily: fonts.textSemiBold,
        fontSize: size,
        lineHeight: lineHeightFor(size, 1.25),
      };
    }
    case 'eyebrow':
      return {
        fontFamily: fonts.textSemiBold,
        fontSize: 11.5,
        lineHeight: 16,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
      };
    case 'askAnswer': {
      const size = pick(17, 18);
      return {
        fontFamily: fonts.text,
        fontSize: size,
        lineHeight: lineHeightFor(size, pick(1.7, 1.75)),
      };
    }
    case 'reading':
    default:
      return {
        fontFamily: readingFaces(fonts, readingFont).regular,
        fontSize: readingSize,
        lineHeight: lineHeightFor(readingSize, readingLineHeight),
      };
  }
}

/** Font size of a paragraph of the given kind for the reader's base size. */
export function paragraphFontSize(kind: Paragraph['kind'], baseSize: number): number {
  if (kind === 'note') return Math.round(baseSize * 0.88);
  if (kind === 'heading') return Math.round(baseSize * 1.15);
  return baseSize;
}
