import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FIRST_PAINT_FONTS, FONT_GROUPS } from '@/theme/font-sources';
import {
  READING_FONTS,
  fallbackFonts,
  fontFamiliesFor,
  groupForReadingFont,
  hasPolytonicGreek,
  loadFontGroup,
  loadedFonts,
  needsGreekFace,
  readingFaces,
  resetFontGroups,
  splitGreekRuns,
  useAppFonts,
  useFontGroup,
  useGreekFace,
  useLoadedFontGroups,
} from '@/theme/fonts';
import type { FontGroup } from '@/theme/fonts';
import { missingFrom, readCoverage } from '@/test-support/font-cmap';

/** The folder of a font package of @expo-google-fonts, whatever the node_modules layout. */
const packageDir = (name: string) =>
  dirname(require.resolve(`@expo-google-fonts/${name}/package.json`));
const FAMILY_FILE: Record<string, string> = {
  'im-fell-great-primer': 'IMFellGreatPrimer',
  'source-serif-4': 'SourceSerif4',
  'gentium-plus': 'GentiumPlus',
  literata: 'Literata',
  inter: 'Inter',
};
/** The TTF of one face of a package: `ttf('source-serif-4', '400Regular')`. */
const ttf = (name: string, face: string) =>
  join(packageDir(name), face, `${FAMILY_FILE[name]}_${face}.ttf`);

// Romanian letters with comma-below, the quotes of both languages, the dashes, the ellipsis and
// the pilcrow: what the display and text faces must carry.
const ROMANIAN = 'ăâîșțĂÂÎȘȚ„”«»–—…¶§';

beforeEach(() => resetFontGroups());

describe('font families', () => {
  it('shows the fallback until the first-paint set is loaded', () => {
    expect(fontFamiliesFor({ firstPaint: false, groups: new Set() })).toBe(fallbackFonts);
  });

  it('names the first-paint faces: IM Fell display and Source Serif 4 text', () => {
    const fonts = fontFamiliesFor({ firstPaint: true, groups: new Set() });
    expect(fonts).toMatchObject({
      display: 'IMFellGreatPrimer_400Regular',
      displayItalic: 'IMFellGreatPrimer_400Regular_Italic',
      text: 'SourceSerif4_400Regular',
      textItalic: 'SourceSerif4_400Regular_Italic',
      textSemiBold: 'SourceSerif4_600SemiBold',
    });
  });

  it('shows Source Serif 4 in place of a face that is still to load, so text never jumps to another font', () => {
    const fonts = fontFamiliesFor({ firstPaint: true, groups: new Set() });
    expect(fonts.textSemiBoldItalic).toBe('SourceSerif4_400Regular_Italic');
    expect(fonts.literata).toEqual({
      regular: 'SourceSerif4_400Regular',
      italic: 'SourceSerif4_400Regular_Italic',
      semiBold: 'SourceSerif4_600SemiBold',
      bold: 'SourceSerif4_600SemiBold',
    });
    expect(fonts.sans.regular).toBe('SourceSerif4_400Regular');
    expect(fonts.greek).toEqual({
      regular: 'SourceSerif4_400Regular',
      italic: 'SourceSerif4_400Regular_Italic',
    });
  });

  it('switches to the on-demand faces once their group is loaded', () => {
    const fonts = fontFamiliesFor({
      firstPaint: true,
      groups: new Set<FontGroup>(['literata', 'inter', 'gentium', 'serifSemiBoldItalic']),
    });
    expect(fonts).toEqual(loadedFonts);
    expect(fonts.textSemiBoldItalic).toBe('SourceSerif4_600SemiBold_Italic');
    expect(fonts.literata).toEqual({
      regular: 'Literata_400Regular',
      italic: 'Literata_400Regular_Italic',
      semiBold: 'Literata_600SemiBold',
      bold: 'Literata_700Bold',
    });
    expect(fonts.sans).toMatchObject({ regular: 'Inter_400Regular', bold: 'Inter_600SemiBold' });
    expect(fonts.greek).toEqual({
      regular: 'GentiumPlus_400Regular',
      italic: 'GentiumPlus_400Regular_Italic',
    });
  });

  it('picks the faces of the reading font; Source Serif 4 has no 700, so its strong text is the 600', () => {
    expect(readingFaces(loadedFonts, 'serif')).toEqual({
      regular: 'SourceSerif4_400Regular',
      italic: 'SourceSerif4_400Regular_Italic',
      semiBold: 'SourceSerif4_600SemiBold',
      bold: 'SourceSerif4_600SemiBold',
    });
    expect(readingFaces(loadedFonts, 'literata').bold).toBe('Literata_700Bold');
    expect(readingFaces(loadedFonts, 'sans').regular).toBe('Inter_400Regular');
    expect(READING_FONTS).toEqual(['serif', 'literata', 'sans']);
  });

  it('needs a group only for Literata and Inter', () => {
    expect(groupForReadingFont('serif')).toBeNull();
    expect(groupForReadingFont('literata')).toBe('literata');
    expect(groupForReadingFont('sans')).toBe('inter');
  });

  it('asks for the Greek face for ancient Greek editions and for polytonic letters', () => {
    expect(needsGreekFace('grc')).toBe(true);
    expect(needsGreekFace('GRC')).toBe(true);
    expect(needsGreekFace('grc-polyton')).toBe(true);
    expect(needsGreekFace('el')).toBe(false);
    expect(needsGreekFace('la')).toBe(false);
    expect(needsGreekFace(undefined)).toBe(false);
    expect(hasPolytonicGreek('ἐν ἀρχῇ ἦν ὁ λόγος')).toBe(true);
    expect(hasPolytonicGreek('In principio')).toBe(false);
    // Monotonic Greek (U+0370-03FF) is in Source Serif 4.
    expect(hasPolytonicGreek('λόγος')).toBe(false);
  });
});

describe('splitGreekRuns (polytonic Greek quoted in a text that is not Greek)', () => {
  const joined = (text: string) =>
    splitGreekRuns(text)
      .map((run) => run.text)
      .join('');
  const greek = (text: string) =>
    splitGreekRuns(text)
      .filter((run) => run.greek)
      .map((run) => run.text);

  it('gives the text back whole, whatever it holds', () => {
    for (const text of [
      '',
      'Plain English.',
      'The word ἐκκλησία (church) is used; ἐν ἀρχῇ ἦν ὁ λόγος, says John.',
      'λόγος and ἀγάπη',
      'Ἰησοῦς Χριστός.',
    ]) {
      expect(joined(text)).toBe(text);
    }
    expect(splitGreekRuns('')).toEqual([{ text: '', greek: false }]);
  });

  it('is one non-Greek run for a text with no Greek Extended letters', () => {
    expect(splitGreekRuns('In the beginning was the Word.')).toEqual([
      { text: 'In the beginning was the Word.', greek: false },
    ]);
    // Monotonic Greek is in Source Serif 4: it stays in the reading face.
    expect(splitGreekRuns('The letter λ and the word λόγος')).toEqual([
      { text: 'The letter λ and the word λόγος', greek: false },
    ]);
  });

  it('marks a polytonic word as a Greek run and leaves the rest', () => {
    expect(splitGreekRuns('the church (ἐκκλησία) of God')).toEqual([
      { text: 'the church (', greek: false },
      { text: 'ἐκκλησία', greek: true },
      { text: ') of God', greek: false },
    ]);
  });

  it('keeps a Greek phrase in one run, with the spaces and the punctuation between its words', () => {
    expect(greek('John writes ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν — then stops.')).toEqual([
      'ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν',
    ]);
    // The monotonic word inside a polytonic phrase goes with it, so the phrase is in one face.
    expect(greek('ἐν λόγος')).toEqual(['ἐν λόγος']);
  });

  it('does not take the punctuation after the last Greek word, or the Latin words after it', () => {
    expect(greek('ἐκκλησία, and more')).toEqual(['ἐκκλησία']);
    expect(greek('say ἐκκλησία.')).toEqual(['ἐκκλησία']);
  });

  it('finds the several phrases of one paragraph', () => {
    expect(greek('First ἐκκλησία, then something else, then ἀγάπη.')).toEqual([
      'ἐκκλησία',
      'ἀγάπη',
    ]);
  });

  it('has no Greek run in Romanian or Latin text', () => {
    expect(greek('Împărăția lui Dumnezeu este aproape.')).toEqual([]);
    expect(greek('In principio erat Verbum')).toEqual([]);
  });
});

describe('the first-paint set and the groups', () => {
  it('waits for five files only: IM Fell 400 and italic, Source Serif 4 400, italic and 600', () => {
    expect(Object.keys(FIRST_PAINT_FONTS).sort()).toEqual([
      'IMFellGreatPrimer_400Regular',
      'IMFellGreatPrimer_400Regular_Italic',
      'SourceSerif4_400Regular',
      'SourceSerif4_400Regular_Italic',
      'SourceSerif4_600SemiBold',
    ]);
  });

  it('loads the rest on demand, in four groups', () => {
    expect(Object.keys(FONT_GROUPS).sort()).toEqual([
      'gentium',
      'inter',
      'literata',
      'serifSemiBoldItalic',
    ]);
    expect(Object.keys(FONT_GROUPS.literata)).toHaveLength(5);
    expect(Object.keys(FONT_GROUPS.inter)).toHaveLength(3);
    expect(Object.keys(FONT_GROUPS.gentium)).toEqual([
      'GentiumPlus_400Regular',
      'GentiumPlus_400Regular_Italic',
    ]);
    expect(Object.keys(FONT_GROUPS.serifSemiBoldItalic)).toEqual([
      'SourceSerif4_600SemiBold_Italic',
    ]);
    // No bold weight of Source Serif 4 or Gentium Plus before P2.
    const names = [
      ...Object.keys(FIRST_PAINT_FONTS),
      ...Object.values(FONT_GROUPS).flatMap(Object.keys),
    ];
    expect(names.filter((name) => /700Bold/.test(name) && !/^Literata/.test(name))).toEqual([]);
  });

  it('keeps the first paint under 1.4 MB of font files (the spec says about 1.3 MB)', () => {
    const files = [
      ttf('im-fell-great-primer', '400Regular'),
      ttf('im-fell-great-primer', '400Regular_Italic'),
      ttf('source-serif-4', '400Regular'),
      ttf('source-serif-4', '400Regular_Italic'),
      ttf('source-serif-4', '600SemiBold'),
    ];
    const total = files.reduce((sum, file) => sum + statSync(file).size, 0);
    expect(total).toBeGreaterThan(1_200_000);
    expect(total).toBeLessThan(1_400_000);
  });
});

describe('loadFontGroup', () => {
  it('loads a group once and says so', async () => {
    const loader = jest.fn().mockResolvedValue(undefined);
    await expect(loadFontGroup('literata', loader)).resolves.toBe(true);
    await expect(loadFontGroup('literata', loader)).resolves.toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(Object.keys(loader.mock.calls[0]![0])).toEqual(Object.keys(FONT_GROUPS.literata));
  });

  it('gives callers that ask while it loads the same promise', async () => {
    let finish!: () => void;
    const loader = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = loadFontGroup('gentium', loader);
    const second = loadFontGroup('gentium', loader);
    expect(second).toBe(first);
    await Promise.resolve(); // the loader is called a tick later
    finish();
    await expect(first).resolves.toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reports a failure as false, never throws, and lets the group be asked for again', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(loadFontGroup('inter', failing)).resolves.toBe(false);
    const working = jest.fn().mockResolvedValue(undefined);
    await expect(loadFontGroup('inter', working)).resolves.toBe(true);
    expect(working).toHaveBeenCalledTimes(1);
  });

  it('survives a loader that throws at once', async () => {
    const throwing = jest.fn(() => {
      throw new Error('no font module');
    });
    await expect(loadFontGroup('inter', throwing)).resolves.toBe(false);
  });
});

describe('font groups in components', () => {
  function Probe({ group }: { group: FontGroup | null }) {
    useFontGroup(group);
    const loaded = useLoadedFontGroups();
    return <Text testID="loaded">{[...loaded].sort().join(',')}</Text>;
  }

  it('re-renders what reads the loaded groups when one arrives', async () => {
    const loader = jest.fn().mockResolvedValue(undefined);
    await render(<Probe group={null} />);
    expect(screen.getByTestId('loaded')).toHaveTextContent('');
    await act(async () => {
      await loadFontGroup('inter', loader);
    });
    expect(screen.getByTestId('loaded')).toHaveTextContent('inter');
    await act(async () => {
      await loadFontGroup('gentium', loader);
    });
    expect(screen.getByTestId('loaded')).toHaveTextContent('gentium,inter');
  });

  it('asks for a group when a component needs one (the bundled loader answers under Jest)', async () => {
    await render(<Probe group="literata" />);
    // expo-font's loadAsync resolves in the Jest environment: the group shows up as loaded.
    expect(await screen.findByText('literata')).toBeTruthy();
  });
});

describe('useGreekFace', () => {
  function Probe({ language, text }: { language?: string; text?: string }) {
    const greek = useGreekFace(language, text);
    const loaded = useLoadedFontGroups();
    return (
      <Text testID="state">
        {greek ? 'greek' : 'none'}:{[...loaded].join(',')}
      </Text>
    );
  }

  it('is wanted for an ancient Greek edition, and loads the group', async () => {
    await render(<Probe language="grc" text="In principio" />);
    expect(await screen.findByText('greek:gentium')).toBeTruthy();
  });

  it('is wanted for polytonic letters in a text of any other language (the Vos English pack quotes them)', async () => {
    await render(<Probe language="en" text="the word ἐκκλησία" />);
    expect(await screen.findByText('greek:gentium')).toBeTruthy();
  });

  it('is not wanted for text without them, or without a text to look at', async () => {
    await render(<Probe language="en" text="the word church, λόγος" />);
    await act(async () => {});
    expect(screen.getByTestId('state')).toHaveTextContent('none:');
    await render(<Probe language="en" />);
    await act(async () => {});
    expect(screen.getByTestId('state')).toHaveTextContent('none:');
  });
});

describe('useAppFonts (what the root layout waits for)', () => {
  function Probe() {
    const { ready, families } = useAppFonts();
    return (
      <>
        <Text testID="ready">{String(ready)}</Text>
        <Text testID="display">{String(families.display)}</Text>
        <Text testID="literata">{String(families.literata.regular)}</Text>
      </>
    );
  }

  it('is ready once the first-paint set is loaded, and then names the first-paint faces', async () => {
    await render(<Probe />);
    expect(await screen.findByText('true')).toBeTruthy();
    expect(screen.getByTestId('display')).toHaveTextContent('IMFellGreatPrimer_400Regular');
    // Literata is not awaited: until it is asked for, its slot shows Source Serif 4.
    expect(screen.getByTestId('literata')).toHaveTextContent('SourceSerif4_400Regular');
  });

  it('follows the on-demand groups: Literata shows up once it has loaded', async () => {
    await render(<Probe />);
    await screen.findByText('true');
    await act(async () => {
      await loadFontGroup('literata', jest.fn().mockResolvedValue(undefined));
    });
    expect(screen.getByTestId('literata')).toHaveTextContent('Literata_400Regular');
  });
});

describe('glyph coverage of the shipped files (docs/ui-spec-v2.md, section 2.2)', () => {
  const display = readCoverage(ttf('im-fell-great-primer', '400Regular'));
  const displayItalic = readCoverage(ttf('im-fell-great-primer', '400Regular_Italic'));
  const serif = readCoverage(ttf('source-serif-4', '400Regular'));
  const serifSemiBold = readCoverage(ttf('source-serif-4', '600SemiBold'));
  const gentium = readCoverage(ttf('gentium-plus', '400Regular'));
  const literata = readCoverage(ttf('literata', '400Regular'));
  const inter = readCoverage(ttf('inter', '400Regular'));

  it('reads a cmap the way fontconfig does (spot checks)', () => {
    expect(serif.has(0x219)).toBe(true); // ș
    expect(serif.has(0x21b)).toBe(true); // ț
    // The number of code points `fc-scan` counts for these pinned files.
    expect(serif.size).toBe(918);
    expect(display.size).toBe(354);
    expect(gentium.size).toBe(2783);
    expect(gentium.has(0x1f00)).toBe(true); // polytonic alpha with psili
  });

  it('gives IM Fell Great Primer the Romanian letters, the quotes, the dashes, the ellipsis and the pilcrow', () => {
    expect(missingFrom(display, ROMANIAN)).toBe('');
    expect(missingFrom(displayItalic, ROMANIAN)).toBe('');
  });

  it('gives IM Fell Great Primer no arrows, no thin space and no Greek: display styles never carry those', () => {
    expect(missingFrom(display, '←→↑↓ ')).toBe('←→↑↓ ');
    expect(missingFrom(display, 'λόγος')).not.toBe('');
  });

  it('gives Source Serif 4 the Romanian letters, the arrows, the angle quotes, the section sign and the long s', () => {
    for (const covered of [serif, serifSemiBold]) {
      expect(missingFrom(covered, ROMANIAN)).toBe('');
      expect(missingFrom(covered, '←→↑↓‹›×§¶ſæœ')).toBe('');
      // Basic Greek is there, so a monotonic Greek word does not fall back.
      expect(missingFrom(covered, 'λόγος')).toBe('');
    }
  });

  it('leaves polytonic Greek to Gentium Plus (Source Serif 4 has none)', () => {
    const polytonic = 'ἐν ἀρχῇ ἦν ὁ λόγος';
    expect(missingFrom(serif, polytonic)).not.toBe('');
    expect(missingFrom(gentium, polytonic)).toBe('');
    expect(missingFrom(gentium, ROMANIAN)).toBe('');
  });

  it('keeps the Romanian comma-below letters in the two reading options', () => {
    expect(missingFrom(literata, 'ăâîșțĂÂÎȘȚ')).toBe('');
    expect(missingFrom(inter, 'ăâîșțĂÂÎȘȚ')).toBe('');
  });

  it('has no ☰ ⌕ ⇄ ⚑ in any font: those are Icon components, never font glyphs', () => {
    for (const covered of [display, serif, serifSemiBold, gentium]) {
      expect(missingFrom(covered, '☰⌕⇄⚑')).toBe('☰⌕⇄⚑');
    }
  });
});
