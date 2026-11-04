import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { applyDocumentTheme } from '@/theme/document-theme';
import type { ThemedDocument } from '@/theme/document-theme';
import { loadedFonts } from '@/theme/fonts';
import { barInset, columnStyle, layoutFor, WIDE_BREAKPOINT } from '@/theme/layout';
import { buildNavigationTheme } from '@/theme/navigation-theme';
import { palettes, resolveTheme } from '@/theme/palettes';
import type { Palette, ThemeName } from '@/theme/palettes';
import { lineHeightFor, paragraphFontSize, typeStyle } from '@/theme/typography';
import { SETTINGS_KEY } from '@/settings/settings-store';

const luminance = (hex: string): number => {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
};

/** WCAG contrast ratio of two #RRGGBB colours. */
const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};

/** Every pair the UI draws text on: body and muted text, links, buttons, highlights. */
const TEXT_PAIRS: readonly (readonly [keyof Palette, keyof Palette])[] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['accent', 'background'],
  ['accent', 'surface'],
  ['onAccent', 'accent'],
  ['onHighlight', 'highlight'],
  ['text', 'target'],
  ['textMuted', 'target'],
];

describe('palettes', () => {
  it('has the three palettes with the same tokens', () => {
    const tokens = Object.keys(palettes.light).sort();
    expect(Object.keys(palettes).sort()).toEqual(['dark', 'light', 'sepia']);
    expect(Object.keys(palettes.sepia).sort()).toEqual(tokens);
    expect(Object.keys(palettes.dark).sort()).toEqual(tokens);
  });

  describe.each(Object.entries(palettes) as [ThemeName, Palette][])('%s', (_name, palette) => {
    it.each(TEXT_PAIRS)('%s on %s reaches 4.5:1 (WCAG AA)', (foreground, background) => {
      expect(
        contrast(palette[foreground] as string, palette[background] as string),
      ).toBeGreaterThanOrEqual(4.5);
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
});

describe('type scale', () => {
  const phone = { fonts: loadedFonts };
  const wide = { fonts: loadedFonts, wide: true };

  it('sets titles in Literata semi-bold and the display one larger on wide screens', () => {
    expect(typeStyle('display', phone)).toMatchObject({
      fontFamily: 'Literata_600SemiBold',
      fontSize: 30,
      lineHeight: 36,
      letterSpacing: -0.2,
    });
    expect(typeStyle('display', wide)).toMatchObject({ fontSize: 34, lineHeight: 40 });
    expect(typeStyle('title', phone)).toMatchObject({ fontSize: 22, lineHeight: 28 });
    expect(typeStyle('heading', phone)).toMatchObject({ fontSize: 18, lineHeight: 24 });
    expect(typeStyle('chapter', phone)).toMatchObject({ fontSize: 24, lineHeight: 30 });
    expect(typeStyle('headerTitle', phone)).toMatchObject({
      fontFamily: 'Literata_600SemiBold',
      fontSize: 20,
    });
  });

  it('sets reading text in Literata at the size and line height the reader chose', () => {
    expect(typeStyle('body', phone)).toMatchObject({
      fontFamily: 'Literata_400Regular',
      fontSize: 18,
      lineHeight: 29,
    });
    expect(typeStyle('body', { ...phone, readingSize: 22, readingLineHeight: 1.5 })).toMatchObject({
      fontSize: 22,
      lineHeight: 33,
    });
  });

  it('sets labels and buttons in Inter', () => {
    expect(typeStyle('ui', phone)).toMatchObject({
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      lineHeight: 20,
    });
    expect(typeStyle('label', phone)).toMatchObject({
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    });
    expect(typeStyle('caption', phone)).toMatchObject({
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
    });
  });

  it('sets the lead and original titles in Literata italic', () => {
    expect(typeStyle('lead', phone)).toMatchObject({
      fontFamily: 'Literata_400Regular_Italic',
      fontSize: 16,
    });
    expect(typeStyle('original', phone)).toMatchObject({
      fontFamily: 'Literata_400Regular_Italic',
      fontSize: 15,
    });
  });

  it('rounds line heights to whole points and scales paragraph kinds', () => {
    expect(lineHeightFor(18, 1.6)).toBe(29);
    expect(lineHeightFor(14, 1.3)).toBe(18);
    expect(paragraphFontSize('p', 18)).toBe(18);
    expect(paragraphFontSize('note', 18)).toBe(16);
    expect(paragraphFontSize('heading', 20)).toBe(23);
  });
});

describe('layout', () => {
  it('uses 24 px gutters on phones and 40 px from 768 px', () => {
    expect(layoutFor(WIDE_BREAKPOINT - 1)).toMatchObject({ wide: false, gutter: 24 });
    expect(layoutFor(WIDE_BREAKPOINT)).toMatchObject({ wide: true, gutter: 40 });
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

  it('lines a full-width bar up with the edges of the column below it', () => {
    expect(barInset('list', layoutFor(1280))).toBe(200);
    expect(barInset('reading', layoutFor(1280))).toBe(300);
    expect(barInset('list', layoutFor(390))).toBe(24);
    expect(barInset('list', layoutFor(900))).toBe(40);
  });
});

describe('navigation theme', () => {
  const fonts = {
    regular: { fontFamily: 'a', fontWeight: 'normal' as const },
    medium: { fontFamily: 'b', fontWeight: '500' as const },
    bold: { fontFamily: 'c', fontWeight: 'bold' as const },
    heavy: { fontFamily: 'd', fontWeight: '800' as const },
  };

  it.each(Object.entries(palettes) as [ThemeName, Palette][])(
    'is derived from the %s palette',
    (name, palette) => {
      expect(buildNavigationTheme(name, palette, fonts)).toEqual({
        dark: name === 'dark',
        colors: {
          primary: palette.accent,
          background: palette.background,
          card: palette.background,
          text: palette.text,
          border: palette.border,
          notification: palette.accent,
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
    const doc = {
      documentElement: { style: { colorScheme: '', backgroundColor: '' } },
      body: { style: { backgroundColor: '' } },
      head: { appendChild: (node: unknown) => appended.push(node) },
      querySelector: () => (withMeta ? meta : null),
      createElement: () => meta,
    };
    return { doc: doc as unknown as ThemedDocument & typeof doc, meta, appended };
  }

  it.each(Object.entries(palettes) as [ThemeName, Palette][])(
    'paints the page with the %s palette',
    (name, palette) => {
      const { doc, meta, appended } = fakeDocument(false);
      applyDocumentTheme(doc, name, palette);
      expect(doc.documentElement.style.colorScheme).toBe(name === 'dark' ? 'dark' : 'light');
      expect(doc.documentElement.style.backgroundColor).toBe(palette.background);
      expect(doc.body.style.backgroundColor).toBe(palette.background);
      expect(meta.attributes).toEqual({ name: 'theme-color', content: palette.background });
      expect(appended).toEqual([meta]);
    },
  );

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

  it('paints the paper and ink backgrounds before JavaScript runs', () => {
    const style = /<style id="app-theme">([\s\S]*?)<\/style>/.exec(template)?.[1] ?? '';
    const [light, dark] = [...style.matchAll(/background:\s*(#[0-9a-f]{6})/gi)].map((m) =>
      hex(m[1]!),
    );
    expect(light).toBe(hex(palettes.light.background));
    expect(dark).toBe(hex(palettes.dark.background));
    expect(style).toContain('prefers-color-scheme: dark');
    expect(template).toContain('<meta name="color-scheme" content="light dark" />');
  });

  it('paints a theme chosen in Settings, from the key Settings stores it under', () => {
    const script = /<script id="app-theme-stored">([\s\S]*?)<\/script>/.exec(template)?.[1] ?? '';
    expect(script).toContain(`'${SETTINGS_KEY}'`);
    for (const name of ['light', 'sepia', 'dark'] as const) {
      expect(script).toContain(`${name}: '${hex(palettes[name].background)}'`);
    }
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
});
