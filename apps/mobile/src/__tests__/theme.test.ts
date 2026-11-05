import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { applyDocumentTheme } from '@/theme/document-theme';
import type { ThemedDocument } from '@/theme/document-theme';
import {
  COLUMN_WIDTH,
  DESKTOP_MIN,
  PHONE_MAX,
  READER_SHELL_MAX,
  SHEET_MAX,
  WIDE_BREAKPOINT,
  XL_MIN,
  bandPadding,
  barInset,
  columnStyle,
  heroPadding,
  layoutFor,
  readingMeasure,
} from '@/theme/layout';
import { buildNavigationTheme } from '@/theme/navigation-theme';
import { palettes, resolveTheme } from '@/theme/palettes';
import type { Palette, ThemeName } from '@/theme/palettes';
import { SETTINGS_KEY } from '@/settings/settings-store';

const luminance = (hex: string): number => {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
};

/** WCAG contrast ratio of two #RRGGBB colours (the alpha of an eight-digit colour is ignored). */
const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};

/** The alpha channel of a #RRGGBBAA colour as a share of 1 (1 for a six-digit colour). */
const alphaOf = (hex: string): number =>
  hex.length === 9 ? Number.parseInt(hex.slice(7, 9), 16) / 255 : 1;

/** The colour without its alpha channel. */
const opaque = (hex: string): string => hex.slice(0, 7);

/** `colour` laid over `base` (both #RRGGBB, `colour` with an alpha), as #RRGGBB. */
const over = (colour: string, base: string): string => {
  const alpha = alphaOf(colour);
  const mix = (shift: number) => {
    const top = (Number.parseInt(colour.slice(1, 7), 16) >> shift) & 255;
    const bottom = (Number.parseInt(base.slice(1, 7), 16) >> shift) & 255;
    return Math.round(top * alpha + bottom * (1 - alpha));
  };
  return `#${[16, 8, 0].map((shift) => mix(shift).toString(16).padStart(2, '0')).join('')}`;
};

type PaletteEntries = [ThemeName, Palette][];
const ENTRIES = Object.entries(palettes) as PaletteEntries;
const NAMES: readonly ThemeName[] = ['light', 'sepia', 'dark'];

/**
 * Every pair of docs/ui-spec-v2.md, section 2.1 ("Contrast, computed with the WCAG 2.x
 * relative-luminance formula"): foreground, background, the ratio it needs and the ratio the spec
 * publishes for light, sepia and dark. A colour that is mistyped changes its ratio and fails here.
 */
const SPEC_PAIRS: readonly (readonly [
  keyof Palette,
  keyof Palette,
  3 | 4.5,
  readonly [number, number, number],
])[] = [
  ['text', 'background', 4.5, [13.05, 11.29, 12.98]],
  ['text', 'surface', 4.5, [14.19, 12.87, 11.54]],
  ['text', 'cream', 4.5, [12.56, 10.58, 12.67]],
  ['text', 'warm', 4.5, [11.14, 9.57, 10.8]],
  ['textMuted', 'background', 4.5, [4.85, 5.79, 7.24]],
  ['textMuted', 'surface', 4.5, [5.27, 6.6, 6.44]],
  ['textMuted', 'cream', 4.5, [4.67, 5.42, 7.07]],
  ['accentStrong', 'background', 4.5, [5.32, 5.34, 7.56]],
  ['accentStrong', 'surface', 4.5, [5.78, 6.09, 6.72]],
  ['accentStrong', 'cream', 4.5, [5.12, 5.0, 7.38]],
  ['accentStrong', 'warm', 4.5, [4.54, 4.52, 6.29]],
  ['onAccent', 'accentStrong', 4.5, [5.87, 6.57, 7.56]],
  ['onHighlight', 'highlight', 4.5, [12.07, 10.47, 9.26]],
  ['text', 'target', 4.5, [12.74, 10.49, 11.35]],
  ['textMuted', 'target', 4.5, [4.74, 5.38, 6.33]],
  ['mastheadInk', 'masthead', 4.5, [12.61, 12.61, 15.21]],
  ['mastheadAccent', 'masthead', 4.5, [5.67, 5.67, 6.84]],
  ['danger', 'background', 4.5, [5.95, 6.06, 7.48]],
  ['danger', 'surface', 4.5, [6.47, 6.91, 6.65]],
  // Outlines and graphics need 3:1 (WCAG 1.4.11).
  ['borderStrong', 'background', 3, [3.56, 3.57, 3.79]],
  ['borderStrong', 'surface', 3, [3.87, 4.07, 3.37]],
  ['borderStrong', 'cream', 3, [3.43, 3.35, 3.7]],
  ['accent', 'background', 3, [3.99, 4.11, 6.3]],
  ['accent', 'surface', 3, [4.34, 4.69, 5.6]],
  ['accent', 'cream', 3, [3.85, 3.85, 6.15]],
];

describe('palettes', () => {
  it('has the three palettes with the same tokens', () => {
    const tokens = Object.keys(palettes.light).sort();
    expect(Object.keys(palettes).sort()).toEqual(['dark', 'light', 'sepia']);
    expect(Object.keys(palettes.sepia).sort()).toEqual(tokens);
    expect(Object.keys(palettes.dark).sort()).toEqual(tokens);
  });

  it('keeps Palette flat: every token is a string, and a colour is #RRGGBB or #RRGGBBAA', () => {
    // scripts/generate-icons.mjs and scripts/check-web-theme.mjs read palettes.ts with a regular
    // expression that stops at the first closing brace of a palette: no nested objects.
    for (const [, palette] of ENTRIES) {
      for (const [token, value] of Object.entries(palette)) {
        expect(typeof value).toBe('string');
        if (token !== 'statusBar') expect(value).toMatch(/^#[0-9A-F]{6}([0-9A-F]{2})?$/);
      }
    }
  });

  it('is read correctly by the scripts that parse palettes.ts (six-digit colours only)', () => {
    const source = readFileSync(join(__dirname, '../theme/palettes.ts'), 'utf8');
    for (const [name, palette] of ENTRIES) {
      const block = new RegExp(`\\b${name}:\\s*\\{([^}]*)\\}`).exec(source);
      expect(block).not.toBeNull();
      const read = Object.fromEntries(
        [...block![1]!.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2]]),
      );
      const sixDigit = Object.entries(palette).filter(([, value]) => /^#[0-9A-F]{6}$/.test(value));
      expect(read).toEqual(Object.fromEntries(sixDigit));
      // Eight-digit values are skipped safely.
      expect(read).not.toHaveProperty('scrimDialog');
      expect(read).not.toHaveProperty('accentBar');
    }
  });

  describe.each(SPEC_PAIRS)('%s on %s (needs %s:1)', (foreground, background, needs, published) => {
    it.each(NAMES.map((name, index) => [name, published[index]!] as const))(
      '%s reaches the ratio the spec publishes (%s)',
      (name, ratio) => {
        const palette = palettes[name];
        const measured = contrast(palette[foreground] as string, palette[background] as string);
        expect(measured).toBeCloseTo(ratio, 1);
        expect(Math.round(measured * 100) / 100).toBeCloseTo(ratio, 2);
        // `onAccent` on `accent` is the one pair listed apart (below); every other pair passes.
        expect(measured).toBeGreaterThanOrEqual(needs);
      },
    );
  });

  describe('onAccent on accent (rule 1 of docs/ui-spec-v2.md, 2.1)', () => {
    it('is 4.41:1 in light: a label on an accent fill is allowed only from 24 px', () => {
      expect(contrast(palettes.light.onAccent, palettes.light.accent)).toBeCloseTo(4.41, 2);
      expect(contrast(palettes.light.onAccent, palettes.light.accent)).toBeLessThan(4.5);
      // It still passes 3:1, the bar for large text and graphics.
      expect(contrast(palettes.light.onAccent, palettes.light.accent)).toBeGreaterThanOrEqual(3);
    });

    it.each(['sepia', 'dark'] as const)('reaches 4.5:1 in %s', (name) => {
      expect(contrast(palettes[name].onAccent, palettes[name].accent)).toBeGreaterThanOrEqual(4.5);
    });

    it('is 5.06 in sepia and 6.30 in dark, as published', () => {
      expect(contrast(palettes.sepia.onAccent, palettes.sepia.accent)).toBeCloseTo(5.06, 2);
      expect(contrast(palettes.dark.onAccent, palettes.dark.accent)).toBeCloseTo(6.3, 2);
    });
  });

  describe('forbidden pair: accentStrong on masthead', () => {
    // Never a text colour or a focus ring on dark bands: links and rings there use mastheadAccent
    // or mastheadInk (rule 5).
    it.each([
      ['light', 2.64],
      ['sepia', 2.36],
      ['dark', 8.93],
    ] as const)('is %s %s:1, as published', (name, ratio) => {
      expect(contrast(palettes[name].accentStrong, palettes[name].masthead)).toBeCloseTo(ratio, 2);
    });

    it.each(['light', 'sepia'] as const)('fails 3:1 in %s, so it is never used there', (name) => {
      expect(contrast(palettes[name].accentStrong, palettes[name].masthead)).toBeLessThan(3);
    });

    it('has two allowed pairs for a ring on a dark band', () => {
      for (const name of NAMES) {
        expect(contrast(palettes[name].mastheadInk, palettes[name].masthead)).toBeGreaterThan(12);
        expect(contrast(palettes[name].mastheadAccent, palettes[name].masthead)).toBeGreaterThan(5);
      }
    });
  });

  it.each(ENTRIES)('%s keeps hairlines quieter than control outlines', (_name, palette) => {
    // The rule between entries must not compete with the outline of a control.
    expect(contrast(palette.border, palette.background)).toBeLessThan(
      contrast(palette.borderStrong, palette.background),
    );
  });

  describe('highlight washes', () => {
    const WASHES = ['Amber', 'Sage', 'Slate', 'Rose', 'Lilac'] as const;

    it.each(ENTRIES)('%s: the text on every wash is `text`, at least 8.8:1', (_name, palette) => {
      for (const wash of WASHES) {
        expect(contrast(palette.text, palette[`wash${wash}`])).toBeGreaterThanOrEqual(8.8);
      }
    });

    it.each(ENTRIES)(
      '%s: a wash is decoration, about 1.07:1 to 1.47:1 against the page',
      (_name, palette) => {
        for (const wash of WASHES) {
          const ratio = contrast(palette[`wash${wash}`], palette.background);
          expect(ratio).toBeGreaterThanOrEqual(1.06);
          expect(ratio).toBeLessThanOrEqual(1.48);
        }
      },
    );

    it('uses the amber wash for the search hit and the amber highlight', () => {
      for (const [, palette] of ENTRIES) expect(palette.washAmber).toBe(palette.highlight);
    });

    it('draws the swatch dots with the same colours in every theme', () => {
      for (const [, palette] of ENTRIES) {
        expect([
          palette.washRingAmber,
          palette.washRingSage,
          palette.washRingSlate,
          palette.washRingRose,
          palette.washRingLilac,
        ]).toEqual(['#E8B04B', '#8FAE6F', '#7D97BD', '#D4879A', '#9A86C4']);
      }
    });
  });

  describe('derived tokens', () => {
    it.each(ENTRIES)('%s: scrims, shadows and the hero scrim are #RRGGBBAA', (_name, palette) => {
      for (const token of [
        'scrimDialog',
        'scrimDrawer',
        'shadowEdge',
        'shadowSoft',
        'shadowPopover',
        'shadowDialog',
        'shadowDrawer',
        'heroScrimTop',
        'heroScrimBottom',
        'mastheadInkMuted',
        'mastheadBorder',
        'accentBar',
      ] as const) {
        expect(palette[token]).toMatch(/^#[0-9A-F]{8}$/);
      }
    });

    it('sets the dialog and drawer backdrops at 45 % and 38 % (65 % in dark)', () => {
      expect(alphaOf(palettes.light.scrimDialog)).toBeCloseTo(0.45, 2);
      expect(alphaOf(palettes.sepia.scrimDialog)).toBeCloseTo(0.45, 2);
      expect(alphaOf(palettes.light.scrimDrawer)).toBeCloseTo(0.38, 2);
      expect(alphaOf(palettes.dark.scrimDialog)).toBeCloseTo(0.65, 2);
      expect(alphaOf(palettes.dark.scrimDrawer)).toBeCloseTo(0.65, 2);
    });

    it('sets the shadows at 4 % and 6 % (cards), 12 % / 40 % (popovers), 25 % / 60 % (dialogs), 45 % / 70 % (drawer)', () => {
      for (const [, palette] of ENTRIES) {
        expect(alphaOf(palette.shadowEdge)).toBeCloseTo(0.04, 2);
        expect(alphaOf(palette.shadowSoft)).toBeCloseTo(0.06, 2);
      }
      expect(alphaOf(palettes.light.shadowPopover)).toBeCloseTo(0.12, 2);
      expect(alphaOf(palettes.dark.shadowPopover)).toBeCloseTo(0.4, 2);
      expect(alphaOf(palettes.light.shadowDialog)).toBeCloseTo(0.25, 2);
      expect(alphaOf(palettes.dark.shadowDialog)).toBeCloseTo(0.6, 2);
      expect(alphaOf(palettes.light.shadowDrawer)).toBeCloseTo(0.45, 2);
      expect(alphaOf(palettes.dark.shadowDrawer)).toBeCloseTo(0.7, 2);
    });

    it.each(ENTRIES)(
      '%s: derives the hero ink, border and bar from their base tokens',
      (_name, palette) => {
        expect(opaque(palette.mastheadInkMuted)).toBe(palette.mastheadInk);
        expect(alphaOf(palette.mastheadInkMuted)).toBeCloseTo(0.84, 2);
        expect(opaque(palette.mastheadBorder)).toBe(palette.mastheadInk);
        expect(alphaOf(palette.mastheadBorder)).toBeCloseTo(0.55, 2);
        // The bar is `accent` at 78 %. A hero is dark in every theme, so in dark the bar is the
        // brand terracotta of the light theme: the pale accent of the dark theme (#D79380) leaves
        // the large light text only 2.7:1 over a white pixel under the scrim (ADR-016, amendment 1).
        expect(opaque(palette.accentBar)).toBe(
          _name === 'dark' ? palettes.light.accent : palette.accent,
        );
        expect(alphaOf(palette.accentBar)).toBeCloseTo(0.78, 2);
      },
    );

    it.each(ENTRIES)(
      '%s: the hero scrim keeps text at 4.5:1 even over a pure white pixel',
      (_name, palette) => {
        // 2.8: the upper stop has alpha 0.72 (0.70 would give 4.44:1 in light); dark is stronger.
        expect(alphaOf(palette.heroScrimTop)).toBeCloseTo(_name === 'dark' ? 0.82 : 0.72, 2);
        const top = over(palette.heroScrimTop, '#FFFFFF');
        const bottom = over(palette.heroScrimBottom, '#FFFFFF');
        expect(contrast(palette.mastheadInk, top)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(palette.mastheadInk, bottom)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(palette.mastheadInk, bottom)).toBeGreaterThan(
          contrast(palette.mastheadInk, top),
        );
      },
    );

    it('keeps the large text of the hero on the accent bar at 3:1 (the bar is `accent` at 78 %)', () => {
      for (const [, palette] of ENTRIES) {
        const bar = over(palette.accentBar, palette.masthead);
        expect(contrast(palette.mastheadInk, bar)).toBeGreaterThanOrEqual(3);
      }
    });

    // Check G5 (docs/ui-spec-v2.md 20.3): text over a photograph is 4.5:1 against the lightest 5 %
    // of the pixels behind it (3:1 for the large highlighted line). The worst picture is a white
    // one, so the colours are computed over a pure white pixel, under the top of the scrim (where
    // the kicker sits, and the scrim is at its lightest) and under its bottom.
    describe('over a pure white photograph (the worst case of G5)', () => {
      it.each(ENTRIES)('%s: the ink reaches 4.5:1 at the top of the scrim', (_name, palette) => {
        const top = over(palette.heroScrimTop, '#FFFFFF');
        expect(contrast(palette.mastheadInk, top)).toBeGreaterThanOrEqual(4.5);
      });

      it.each(ENTRIES)(
        '%s: the orange accent ink does not, which is why a hero with a picture uses the ink',
        (_name, palette) => {
          const top = over(palette.heroScrimTop, '#FFFFFF');
          expect(contrast(palette.mastheadAccent, top)).toBeLessThan(4.5);
          // 2.12:1 in light and sepia, 3.97:1 in dark (the scrim is stronger there).
          expect(contrast(palette.mastheadAccent, top)).toBeGreaterThan(2);
        },
      );

      it.each(ENTRIES)(
        '%s: the large light text on the highlight bar keeps 3:1 (the bar is itself over the scrim)',
        (_name, palette) => {
          for (const scrim of [palette.heroScrimTop, palette.heroScrimBottom]) {
            const bar = over(palette.accentBar, over(scrim, '#FFFFFF'));
            expect(contrast(palette.mastheadInk, bar)).toBeGreaterThanOrEqual(3);
          }
        },
      );

      it('would fail in dark with the pale accent of the dark theme as the bar (why the bar changed)', () => {
        const dark = palettes.dark;
        const pale = `${dark.accent}C7`; // accent at 78 %
        const bar = over(pale, over(dark.heroScrimTop, '#FFFFFF'));
        expect(contrast(dark.mastheadInk, bar)).toBeLessThan(3);
      });

      it.each(ENTRIES)(
        '%s: the muted ink of the sub line keeps 4.5:1 below the top',
        (_name, palette) => {
          // The sub line sits under the title, about halfway down the scrim: the colour there is the
          // blend of the two stops at 45 % of the way to 78 % of the hero height.
          const share = 0.45 / 0.78;
          const stops = [palette.heroScrimTop, palette.heroScrimBottom].map((stop) =>
            over(stop, '#FFFFFF'),
          );
          const blend = over(
            `${stops[1]}${Math.round(share * 255)
              .toString(16)
              .padStart(2, '0')}`,
            stops[0]!,
          );
          const sub = over(palette.mastheadInkMuted, blend);
          expect(contrast(sub, blend)).toBeGreaterThanOrEqual(4.5);
        },
      );
    });
  });

  it('follows the system scheme only for the automatic preference', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
    expect(resolveTheme('system', null)).toBe('light');
    expect(resolveTheme('sepia', 'dark')).toBe('sepia');
    expect(resolveTheme('light', 'dark')).toBe('light');
  });

  it('lights the status bar only on the dark palette', () => {
    expect(palettes.light.statusBar).toBe('dark');
    expect(palettes.sepia.statusBar).toBe('dark');
    expect(palettes.dark.statusBar).toBe('light');
  });

  it('keeps the colour of the page and the tint of the panels apart (surface is the card colour)', () => {
    // Migration note of 2.1: `surface` was the tinted block colour (#F3F1EB), it is now the card
    // colour; the tinted panel colour moved to `cream`.
    expect(palettes.light.surface).toBe('#FFFDFA');
    expect(palettes.light.cream).toBe('#F5EFE1');
    expect(palettes.light.background).toBe('#F6F3F2');
  });
});

describe('layout', () => {
  it('uses 24 px gutters on phones and 40 px from 768 px', () => {
    expect(layoutFor(WIDE_BREAKPOINT - 1)).toMatchObject({ wide: false, gutter: 24 });
    expect(layoutFor(WIDE_BREAKPOINT)).toMatchObject({ wide: true, gutter: 40 });
  });

  it('names the breakpoints of the spec', () => {
    expect([PHONE_MAX, SHEET_MAX, WIDE_BREAKPOINT, READER_SHELL_MAX, DESKTOP_MIN, XL_MIN]).toEqual([
      640, 700, 768, 880, 1100, 1200,
    ]);
  });

  it('limits lists to 880 px and reading text to 680 px, gutters excluded', () => {
    expect(columnStyle('list', layoutFor(1280))).toMatchObject({
      width: '100%',
      maxWidth: 880 + 80,
      alignSelf: 'center',
      paddingHorizontal: 40,
    });
    expect(columnStyle('reading', layoutFor(1280))).toMatchObject({ maxWidth: 680 + 80 });
    expect(columnStyle('reading', layoutFor(390))).toMatchObject({
      maxWidth: 680 + 48,
      paddingHorizontal: 24,
    });
  });

  it('has the container widths of the spec', () => {
    expect(COLUMN_WIDTH).toMatchObject({
      wide: 1124,
      tool: 1180,
      list: 880,
      narrow: 664,
      twoLane: 1440,
      ask: 760,
    });
  });

  it('lines a full-width bar up with the edges of the column below it', () => {
    expect(barInset('list', layoutFor(1280))).toBe(200);
    expect(barInset('reading', layoutFor(1280))).toBe(300);
    expect(barInset('list', layoutFor(390))).toBe(24);
    expect(barInset('list', layoutFor(900))).toBe(40);
  });

  it('pads a band by 88 on wide screens and 56 on a phone', () => {
    expect(bandPadding(true)).toBe(88);
    expect(bandPadding(false)).toBe(56);
  });

  it('pads a hero by the kind of page: 128/120, 92/84, 56/40, and less on a phone', () => {
    expect(heroPadding('landing', true)).toEqual({ top: 128, bottom: 120 });
    expect(heroPadding('landing', false)).toEqual({ top: 68, bottom: 60 });
    expect(heroPadding('page', true)).toEqual({ top: 92, bottom: 84 });
    expect(heroPadding('page', false)).toEqual({ top: 56, bottom: 52 });
    expect(heroPadding('library', true)).toEqual({ top: 56, bottom: 40 });
  });

  it('widens the reading line with the font: 37 em, never more than 960', () => {
    expect(readingMeasure(17)).toBe(629);
    expect(readingMeasure(20)).toBe(740);
    expect(readingMeasure(34)).toBe(960);
    expect(readingMeasure(14)).toBe(518);
  });
});

describe('navigation theme', () => {
  const fonts = {
    regular: { fontFamily: 'a', fontWeight: 'normal' as const },
    medium: { fontFamily: 'b', fontWeight: '500' as const },
    bold: { fontFamily: 'c', fontWeight: 'bold' as const },
    heavy: { fontFamily: 'd', fontWeight: '800' as const },
  };

  it.each(ENTRIES)(
    'is derived from the %s palette (links and highlights are accentStrong)',
    (name, palette) => {
      expect(buildNavigationTheme(name, palette, fonts)).toEqual({
        dark: name === 'dark',
        colors: {
          primary: palette.accentStrong,
          background: palette.background,
          card: palette.background,
          text: palette.text,
          border: palette.border,
          notification: palette.accentStrong,
        },
        fonts,
      });
    },
  );
});

describe('document theme (web)', () => {
  function fakeDocument(withMeta: boolean) {
    const meta = {
      attributes: {} as Record<string, string>,
      setAttribute(k: string, v: string) {
        this.attributes[k] = v;
      },
    };
    const appended: unknown[] = [];
    const properties: Record<string, string> = {};
    const doc = {
      documentElement: {
        style: {
          colorScheme: '',
          backgroundColor: '',
          setProperty: (name: string, value: string) => {
            properties[name] = value;
          },
        },
      },
      body: { style: { backgroundColor: '' } },
      head: { appendChild: (node: unknown) => appended.push(node) },
      querySelector: () => (withMeta ? meta : null),
      createElement: () => meta,
    };
    return { doc: doc as unknown as ThemedDocument & typeof doc, meta, appended, properties };
  }

  it.each(ENTRIES)('paints the page with the %s palette', (name, palette) => {
    const { doc, meta, appended, properties } = fakeDocument(false);
    applyDocumentTheme(doc, name, palette);
    expect(doc.documentElement.style.colorScheme).toBe(name === 'dark' ? 'dark' : 'light');
    expect(doc.documentElement.style.backgroundColor).toBe(palette.background);
    expect(doc.body.style.backgroundColor).toBe(palette.background);
    // What the template's CSS reads (page background, the focus ring that is accentStrong and the
    // ring on dark bands) and the scrollbars.
    expect(properties).toEqual({
      '--app-background': palette.background,
      '--app-accent': palette.accentStrong,
      '--app-masthead-ink': palette.mastheadInk,
      'scrollbar-color': `${palette.borderStrong} ${palette.background}`,
    });
    expect(meta.attributes).toEqual({ name: 'theme-color', content: palette.background });
    expect(appended).toEqual([meta]);
  });

  it('updates an existing theme-color tag instead of adding another', () => {
    const { doc, meta, appended } = fakeDocument(true);
    applyDocumentTheme(doc, 'dark', palettes.dark);
    expect(meta.attributes).toEqual({ content: palettes.dark.background });
    expect(appended).toEqual([]);
  });
});

describe('web template and splash', () => {
  const template = readFileSync(join(__dirname, '../../public/index.html'), 'utf8');
  const hex = (value: string) => value.toLowerCase();

  const style = /<style id="app-theme">([\s\S]*?)<\/style>/.exec(template)?.[1] ?? '';
  const script = /<script id="app-theme-stored">([\s\S]*?)<\/script>/.exec(template)?.[1] ?? '';

  /** The value of a CSS custom property declared in `css` (lower-cased), in order of appearance. */
  const variables = (css: string, name: string) =>
    [...css.matchAll(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'gi'))].map((m) => hex(m[1]!));

  it('paints the paper and ink backgrounds before JavaScript runs', () => {
    // Light first, then the dark scheme's override inside the media query.
    expect(variables(style, '--app-background')).toEqual([
      hex(palettes.light.background),
      hex(palettes.dark.background),
    ]);
    expect(style).toContain('prefers-color-scheme: dark');
    expect(template).toContain('<meta name="color-scheme" content="light dark" />');
  });

  it('gives <html> and <body> the same background, so the first paint cannot show two colours', () => {
    expect(style).toMatch(/html,\s*body\s*\{\s*background:\s*var\(--app-background\);?\s*\}/);
  });

  it('draws one themed focus ring for keyboard focus, in the accentStrong of the scheme', () => {
    expect(variables(style, '--app-accent')).toEqual([
      hex(palettes.light.accentStrong),
      hex(palettes.dark.accentStrong),
    ]);
    expect(style).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--app-accent\)/);
  });

  it('re-colours the ring on masthead bands with the ink of the band, and prints a disclosure open', () => {
    expect(style).toMatch(
      /\[data-band='masthead'\]\s*\{\s*--app-accent:\s*var\(--app-masthead-ink,\s*#efe7da\)/i,
    );
    // The fallback is the band ink of the palettes.
    expect(hex(palettes.light.mastheadInk)).toBe('#efe7da');
    expect(style).toMatch(
      /@media print\s*\{\s*\[data-disclosure-body\]\s*\{\s*display:\s*flex !important/,
    );
  });

  it('keeps the ring of a field on a dark band on the band: 2 px outside the field, not over its light fill', () => {
    // A field's ring sits over its border (-1 px), which on a dark band put half of the ring on the
    // field's light fill, where the ink of the band is 1.2:1: the focus looked like a paler rim.
    expect(style).toMatch(/input:focus-visible,\s*textarea:focus-visible\s*\{\s*outline-offset:\s*-1px/);
    expect(style).toMatch(
      /\[data-band='masthead'\] input:focus-visible,\s*\[data-band='masthead'\] textarea:focus-visible\s*\{\s*outline-offset:\s*2px/,
    );
    // The band rule comes after the field rule and is more specific, so it wins.
    expect(style.indexOf("[data-band='masthead'] input:focus-visible")).toBeGreaterThan(
      style.indexOf('input:focus-visible,\n      textarea:focus-visible'),
    );
  });

  it('paints a theme chosen in Settings, from the key Settings stores it under', () => {
    expect(script).toContain(`'${SETTINGS_KEY}'`);
    for (const name of NAMES) {
      expect(script).toContain(
        `${name}: { background: '${hex(palettes[name].background)}', accent: '${hex(palettes[name].accentStrong)}' }`,
      );
    }
    // It must reach <body> too, through the variables the stylesheet reads.
    expect(script).toContain("setProperty('--app-background'");
    expect(script).toContain("setProperty('--app-accent'");
  });

  it('keeps the placeholders Expo fills in', () => {
    expect(template).toContain('<html lang="%LANG_ISO_CODE%">');
    expect(template).toContain('<title>%WEB_TITLE%</title>');
    expect(template).toContain('<div id="root"></div>');
  });

  it('exports the web build as a single page in Romanian, with splash colours from the palettes', () => {
    const config = jest.requireActual('../../app.config').default as {
      web?: { output?: string; lang?: string };
      plugins?: unknown[];
    };
    expect(config.web).toMatchObject({ output: 'single', lang: 'ro' });
    const splash = config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    ) as [string, { backgroundColor: string; dark: { backgroundColor: string } }];
    expect(hex(splash[1].backgroundColor)).toBe(hex(palettes.light.background));
    expect(hex(splash[1].dark.backgroundColor)).toBe(hex(palettes.dark.background));
  });

  it('puts the adaptive icon on the ink background of the app, not the Expo template colour', () => {
    const config = jest.requireActual('../../app.config').default as {
      android?: { adaptiveIcon?: { backgroundColor?: string } };
    };
    expect(hex(config.android?.adaptiveIcon?.backgroundColor ?? '')).toBe(
      hex(palettes.dark.background),
    );
  });
});
