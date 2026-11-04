import type { Paragraph } from '@biblioteca/shared';

import type { FontFamilies } from './fonts';

/**
 * The type scale of the app ("editorial calm"): a serif (Literata) for titles and reading text,
 * a quiet sans (Inter) for labels, buttons and metadata. Sizes are in points; system font scaling
 * is applied on top and capped by the components (see `UI_MAX_FONT_SCALE`).
 */
export type TypeVariant =
  | 'display' // work title on the work page
  | 'chapter' // chapter heading in the reader
  | 'headerTitle' // navigation header title
  | 'title' // screen titles, library entry titles
  | 'heading' // section headings: table of contents, settings
  | 'lead' // short editorial lead under a title
  | 'original' // original title of a work
  | 'body' // reading text: the size and line height the reader chose
  | 'ui' // buttons, links, segmented controls
  | 'label' // metadata, chips, section labels
  | 'caption'; // secondary lines

export interface TypeStyle {
  fontFamily: string | undefined;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

/** Variants that read in the muted colour unless told otherwise. */
export const MUTED_VARIANTS: ReadonlySet<TypeVariant> = new Set<TypeVariant>([
  'lead',
  'original',
  'label',
  'caption',
]);

/** Variants that name a part of the page (exposed as headings to assistive technology). */
export const HEADING_VARIANTS: ReadonlySet<TypeVariant> = new Set<TypeVariant>([
  'headerTitle',
  'display',
  'chapter',
  'title',
  'heading',
]);

export interface TypeOptions {
  fonts: FontFamilies;
  /** Web and tablet widths (768 px and up) use the larger display size. */
  wide?: boolean;
  /** The reader's font size, used by `body` (default 18). */
  readingSize?: number;
  /** The reader's line height as a multiple of the font size, used by `body` (default 1.6). */
  readingLineHeight?: number;
}

/** Line height in points for a font size and a multiple, rounded to whole points. */
export function lineHeightFor(fontSize: number, multiple: number): number {
  return Math.round(fontSize * multiple);
}

export function typeStyle(variant: TypeVariant, options: TypeOptions): TypeStyle {
  const { fonts, wide = false, readingSize = 18, readingLineHeight = 1.6 } = options;
  switch (variant) {
    case 'display':
      return {
        fontFamily: fonts.readingSemiBold,
        fontSize: wide ? 34 : 30,
        lineHeight: wide ? 40 : 36,
        letterSpacing: -0.2,
      };
    case 'chapter':
      return { fontFamily: fonts.readingSemiBold, fontSize: 24, lineHeight: 30 };
    case 'headerTitle':
      return { fontFamily: fonts.readingSemiBold, fontSize: 20, lineHeight: 26 };
    case 'title':
      return { fontFamily: fonts.readingSemiBold, fontSize: 22, lineHeight: 28 };
    case 'heading':
      return { fontFamily: fonts.readingSemiBold, fontSize: 18, lineHeight: 24 };
    case 'lead':
      return { fontFamily: fonts.readingItalic, fontSize: 16, lineHeight: 24 };
    case 'original':
      return { fontFamily: fonts.readingItalic, fontSize: 15, lineHeight: 22 };
    case 'ui':
      return { fontFamily: fonts.uiMedium, fontSize: 15, lineHeight: 20 };
    case 'label':
      return {
        fontFamily: fonts.uiMedium,
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
      };
    case 'caption':
      return { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18 };
    case 'body':
    default:
      return {
        fontFamily: fonts.reading,
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
