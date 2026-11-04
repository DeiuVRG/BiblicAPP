import { fallbackFonts, loadedFonts } from '@/theme/fonts';
import type { FontFamilies } from '@/theme/fonts';
import {
  ACCENT_VARIANTS,
  HEADING_LEVELS,
  HEADING_VARIANTS,
  MUTED_VARIANTS,
  READING_MAX_FONT_SCALE,
  READING_VARIANTS,
  UI_MAX_FONT_SCALE,
  displayXLPhoneSize,
  lineHeightFor,
  paragraphFontSize,
  typeStyle,
} from '@/theme/typography';
import type { TypeVariant } from '@/theme/typography';

const phone = { fonts: loadedFonts };
const wide = { fonts: loadedFonts, wide: true };

/** Every token of the type scale of docs/ui-spec-v2.md, section 2.3. */
const ALL: readonly TypeVariant[] = [
  'displayXL',
  'displayL',
  'displayM',
  'displayS',
  'displaySItalic',
  'numeral',
  'title',
  'heading',
  'lead',
  'body',
  'meta',
  'caption',
  'original',
  'label',
  'kicker',
  'rail',
  'railBrand',
  'railDrawer',
  'button',
  'chip',
  'chrome',
  'readerTitle',
  'chapterTitle',
  'eyebrow',
  'reading',
  'askAnswer',
];

describe('type scale', () => {
  it('defines every token with a size, a line height and a family', () => {
    for (const variant of ALL) {
      for (const options of [phone, wide]) {
        const style = typeStyle(variant, options);
        expect(style.fontSize).toBeGreaterThan(0);
        expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
        expect(style.fontFamily).toBeTruthy();
      }
    }
  });

  it('never asks for a font weight: every weight is a file of its own (IM Fell has only 400)', () => {
    for (const variant of ALL) {
      for (const options of [phone, wide]) {
        expect(typeStyle(variant, options)).not.toHaveProperty('fontWeight');
      }
    }
  });

  describe('display type (IM Fell Great Primer 400)', () => {
    it.each([
      ['displayXL', 29, 33, 52, 56],
      ['displayL', 32, 36, 52, 56],
      ['displayM', 26, 30, 38, 42],
      ['displayS', 22, 26, 28, 32],
      ['numeral', 36, 40, 46, 50],
    ] as const)(
      '%s is %i/%i on a phone and %i/%i wide',
      (variant, size, line, wideSize, wideLine) => {
        expect(typeStyle(variant, phone)).toEqual({
          fontFamily: 'IMFellGreatPrimer_400Regular',
          fontSize: size,
          lineHeight: line,
        });
        expect(typeStyle(variant, wide)).toEqual({
          fontFamily: 'IMFellGreatPrimer_400Regular',
          fontSize: wideSize,
          lineHeight: wideLine,
        });
      },
    );

    it('sets the panel and gate titles in the italic face, never a synthesised one', () => {
      expect(typeStyle('displaySItalic', phone)).toMatchObject({
        fontFamily: 'IMFellGreatPrimer_400Regular_Italic',
        fontSize: 22,
        lineHeight: 26,
      });
      expect(typeStyle('displaySItalic', wide)).toMatchObject({ fontSize: 28, lineHeight: 32 });
    });

    it('sizes the landing title on a phone as clamp(22, 7.4vw, 32)', () => {
      expect(displayXLPhoneSize(undefined)).toBe(29);
      expect(displayXLPhoneSize(390)).toBe(29);
      expect(displayXLPhoneSize(300)).toBe(22);
      expect(displayXLPhoneSize(320)).toBe(24);
      expect(displayXLPhoneSize(500)).toBe(32);
      expect(typeStyle('displayXL', { fonts: loadedFonts, width: 390 })).toMatchObject({
        fontSize: 29,
        lineHeight: 33,
      });
      expect(typeStyle('displayXL', { fonts: loadedFonts, width: 300 })).toMatchObject({
        fontSize: 22,
        lineHeight: 25,
      });
      // The wide size does not follow the window.
      expect(typeStyle('displayXL', { fonts: loadedFonts, wide: true, width: 1366 })).toMatchObject(
        {
          fontSize: 52,
          lineHeight: 56,
        },
      );
    });
  });

  describe('text and chrome (Source Serif 4)', () => {
    it('sets titles and headings in the 600 face', () => {
      expect(typeStyle('title', phone)).toEqual({
        fontFamily: 'SourceSerif4_600SemiBold',
        fontSize: 20,
        lineHeight: 26,
      });
      expect(typeStyle('title', wide)).toMatchObject({ fontSize: 22, lineHeight: 28 });
      expect(typeStyle('heading', phone)).toMatchObject({ fontSize: 18, lineHeight: 24 });
      expect(typeStyle('heading', wide)).toMatchObject({ fontSize: 20, lineHeight: 26 });
    });

    it('sets the lead and the original title in the italic face', () => {
      expect(typeStyle('lead', phone)).toMatchObject({
        fontFamily: 'SourceSerif4_400Regular_Italic',
        fontSize: 16,
        lineHeight: 24,
      });
      expect(typeStyle('lead', wide)).toMatchObject({ fontSize: 17, lineHeight: 26 });
      expect(typeStyle('original', phone)).toMatchObject({
        fontFamily: 'SourceSerif4_400Regular_Italic',
        fontSize: 15,
        lineHeight: 22,
      });
    });

    it('sets page text, meta lines and captions in the 400 face', () => {
      expect(typeStyle('body', phone)).toEqual({
        fontFamily: 'SourceSerif4_400Regular',
        fontSize: 17,
        lineHeight: 27,
      });
      expect(typeStyle('body', wide)).toMatchObject({ fontSize: 17, lineHeight: 27.2 });
      expect(typeStyle('meta', phone)).toMatchObject({ fontSize: 14, lineHeight: 20 });
      expect(typeStyle('meta', wide)).toMatchObject({ fontSize: 14, lineHeight: 21 });
      expect(typeStyle('caption', phone)).toMatchObject({ fontSize: 13, lineHeight: 18 });
      expect(typeStyle('caption', wide)).toMatchObject({ fontSize: 13, lineHeight: 19 });
    });

    it('sets the chrome and the reader title in the 400 face', () => {
      expect(typeStyle('chrome', phone)).toMatchObject({ fontSize: 13, lineHeight: 16 });
      expect(typeStyle('readerTitle', phone)).toMatchObject({ fontSize: 16, lineHeight: 20 });
      expect(typeStyle('readerTitle', wide)).toMatchObject({ fontSize: 20, lineHeight: 25 });
    });
  });

  describe('small caps (uppercase by style, with tracking)', () => {
    it.each([
      ['label', 'SourceSerif4_600SemiBold', 11, 16, 2.4],
      ['kicker', 'SourceSerif4_400Regular', 12, 16, 3.6],
      ['button', 'SourceSerif4_600SemiBold', 13, 16, 1.8],
      ['chip', 'SourceSerif4_600SemiBold', 11, 14, 1.5],
      ['eyebrow', 'SourceSerif4_600SemiBold', 11.5, 16, 2.5],
    ] as const)('%s is %s %s/%s with tracking %s', (variant, family, size, line, tracking) => {
      for (const options of [phone, wide]) {
        expect(typeStyle(variant, options)).toEqual({
          fontFamily: family,
          fontSize: size,
          lineHeight: line,
          letterSpacing: tracking,
          textTransform: 'uppercase',
        });
      }
    });

    it('sets the section bar items in 12.5 with 0.75 tracking on a phone and 13 with 1.3 wide', () => {
      expect(typeStyle('rail', phone)).toEqual({
        fontFamily: 'SourceSerif4_400Regular',
        fontSize: 12.5,
        lineHeight: 16,
        letterSpacing: 0.75,
        textTransform: 'uppercase',
      });
      expect(typeStyle('rail', wide)).toMatchObject({ fontSize: 13, letterSpacing: 1.3 });
      // The brand item is the 600 face: 12 with 0.84 on a phone, like the rest wide.
      expect(typeStyle('railBrand', phone)).toMatchObject({
        fontFamily: 'SourceSerif4_600SemiBold',
        fontSize: 12,
        letterSpacing: 0.84,
      });
      expect(typeStyle('railBrand', wide)).toMatchObject({ fontSize: 13, letterSpacing: 1.3 });
    });

    it('sets the drawer items in 13/18 with 0.78 on a phone and 12/16 with 0.72 wide', () => {
      expect(typeStyle('railDrawer', phone)).toMatchObject({
        fontSize: 13,
        lineHeight: 18,
        letterSpacing: 0.78,
        textTransform: 'uppercase',
      });
      expect(typeStyle('railDrawer', wide)).toMatchObject({
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 0.72,
      });
    });
  });

  describe('reading', () => {
    it('sets reading text in Source Serif 4 at the size and line height the reader chose', () => {
      expect(typeStyle('reading', phone)).toEqual({
        fontFamily: 'SourceSerif4_400Regular',
        fontSize: 17,
        lineHeight: 26,
      });
      expect(
        typeStyle('reading', { ...phone, readingSize: 22, readingLineHeight: 1.5 }),
      ).toMatchObject({ fontSize: 22, lineHeight: 33 });
    });

    it('follows the reading font: Literata, Inter, or Source Serif 4', () => {
      expect(typeStyle('reading', { ...phone, readingFont: 'literata' }).fontFamily).toBe(
        'Literata_400Regular',
      );
      expect(typeStyle('reading', { ...phone, readingFont: 'sans' }).fontFamily).toBe(
        'Inter_400Regular',
      );
      expect(typeStyle('reading', { ...phone, readingFont: 'serif' }).fontFamily).toBe(
        'SourceSerif4_400Regular',
      );
    });

    it('sets the chapter title at 1.24 em of the reading size on a phone and 1.42 em wide', () => {
      expect(typeStyle('chapterTitle', { ...phone, readingSize: 17 })).toEqual({
        fontFamily: 'SourceSerif4_600SemiBold',
        fontSize: 21,
        lineHeight: 26,
      });
      expect(typeStyle('chapterTitle', { ...wide, readingSize: 20 })).toMatchObject({
        fontSize: 28,
        lineHeight: 35,
      });
    });

    it('sets the Ask answer at 17 with 1.7 on a phone and 18 with 1.75 wide', () => {
      expect(typeStyle('askAnswer', phone)).toEqual({
        fontFamily: 'SourceSerif4_400Regular',
        fontSize: 17,
        lineHeight: 29,
      });
      expect(typeStyle('askAnswer', wide)).toMatchObject({ fontSize: 18, lineHeight: 32 });
    });
  });

  it('shows the web serif, or the system font, until the fonts are loaded', () => {
    for (const variant of ALL) {
      const family = typeStyle(variant, { fonts: fallbackFonts }).fontFamily;
      expect(family === undefined || /Georgia/.test(family)).toBe(true);
    }
  });

  it('rounds line heights to whole points and scales paragraph kinds', () => {
    expect(lineHeightFor(18, 1.6)).toBe(29);
    expect(lineHeightFor(14, 1.3)).toBe(18);
    expect(paragraphFontSize('p', 18)).toBe(18);
    expect(paragraphFontSize('note', 18)).toBe(16);
    expect(paragraphFontSize('heading', 20)).toBe(23);
  });

  it('caps system font scaling at 1.5 for chrome and 1.6 for reading text', () => {
    expect(UI_MAX_FONT_SCALE).toBe(1.5);
    expect(READING_MAX_FONT_SCALE).toBe(1.6);
    expect([...READING_VARIANTS].sort()).toEqual([
      'askAnswer',
      'chapterTitle',
      'eyebrow',
      'reading',
    ]);
  });

  it('names headings, and keeps muted and accent variants apart from them', () => {
    expect([...HEADING_VARIANTS].sort()).toEqual(Object.keys(HEADING_LEVELS).sort());
    // One level 1 per screen: the hero titles; band titles are level 2, card and panel titles 3.
    expect(HEADING_LEVELS.displayXL).toBe(1);
    expect(HEADING_LEVELS.displayL).toBe(1);
    expect(HEADING_LEVELS.displayM).toBe(2);
    expect(HEADING_LEVELS.displayS).toBe(3);
    for (const variant of HEADING_VARIANTS) {
      expect(MUTED_VARIANTS.has(variant)).toBe(false);
      expect(ACCENT_VARIANTS.has(variant)).toBe(false);
    }
    expect([...ACCENT_VARIANTS].sort()).toEqual(['eyebrow', 'kicker']);
  });

  it('is built from a families object that any state of loading can supply', () => {
    const custom: FontFamilies = { ...loadedFonts, text: 'Custom_400' };
    expect(typeStyle('body', { fonts: custom }).fontFamily).toBe('Custom_400');
  });
});
