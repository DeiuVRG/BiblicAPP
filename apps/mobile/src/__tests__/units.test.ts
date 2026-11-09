import { foldText } from '@/search/fold';
import { splitByMatches } from '@/search/highlight';
import { scrollFraction, sectionDepths, sectionNeighbours, toPercent } from '@/reading/navigation';
import { PositionWriter } from '@/reading/position-writer';
import { loadPosition } from '@/reading/position-store';
import { sanitizeSettings } from '@/settings/sanitize';
import { DEFAULT_SETTINGS, createDefaultSettings } from '@/settings/types';
import {
  editionKindLabel,
  editionLabel,
  editionLanguageLabel,
  formatLifespan,
  formatYear,
  languageName,
  licenceLabel,
  licenceNote,
} from '@/i18n/labels';
import { en } from '@/i18n/en';
import { ro } from '@/i18n/ro';
import { splitChapterHeading } from '@/reading/heading';
import { createMemoryStore } from '@/test-support/render';

describe('search folding', () => {
  it('ignores case and Romanian diacritics, both comma-below and cedilla forms', () => {
    expect(foldText('ȘȚĂÂÎ șțăâî ŞŢ')).toBe('staai staai st');
    expect(foldText('Împărăția')).toBe('imparatia');
  });

  it('keeps the length so indexes map back onto the original text', () => {
    const text = 'Împărăția lui Dumnezeu – “Théologie”';
    expect(foldText(text)).toHaveLength(text.length);
  });

  it('splits text into highlighted parts', () => {
    expect(splitByMatches('Împărăția lui Dumnezeu', 'IMPARATIA')).toEqual([
      { text: 'Împărăția', match: true },
      { text: ' lui Dumnezeu', match: false },
    ]);
    expect(splitByMatches('abc', '')).toEqual([{ text: 'abc', match: false }]);
    expect(splitByMatches('aXbxc', 'x').filter((part) => part.match)).toHaveLength(2);
  });
});

describe('reading navigation', () => {
  const sections = [
    { id: 'a', ordinal: 0, kind: 'chapter' as const, heading: 'A' },
    { id: 'b', ordinal: 1, kind: 'section' as const, heading: 'B', parentId: 'a' },
    { id: 'c', ordinal: 2, kind: 'chapter' as const, heading: 'C' },
  ];

  it('finds neighbours and nesting', () => {
    expect(sectionNeighbours(sections, 'b')).toMatchObject({ index: 1, total: 3 });
    expect(sectionNeighbours(sections, 'b')?.previous?.id).toBe('a');
    expect(sectionNeighbours(sections, 'a')?.previous).toBeNull();
    expect(sectionNeighbours(sections, 'c')?.next).toBeNull();
    expect(sectionNeighbours(sections, 'x')).toBeNull();
    expect(sectionDepths(sections).get('b')).toBe(1);
  });

  it('computes progress', () => {
    expect(toPercent(0.456)).toBe(46);
    expect(toPercent(Number.NaN)).toBe(0);
    expect(scrollFraction(500, 1500, 500)).toBe(0.5);
    expect(scrollFraction(0, 300, 500)).toBe(1);
  });
});

describe('settings sanitising', () => {
  it('clamps and falls back to defaults', () => {
    // `lineHeight` is what an older version stored as the line spacing.
    expect(sanitizeSettings({ fontSize: 5, lineHeight: 9, theme: 'dark' })).toEqual({
      ...DEFAULT_SETTINGS,
      fontSize: 14,
      lineSpacing: 2,
      theme: 'dark',
    });
    expect(sanitizeSettings({ fontSize: 99 }).fontSize).toBe(34);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ fontSize: '20', theme: 'x' })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps "no size chosen yet" (null), so the window decides until the reader chooses', () => {
    expect(DEFAULT_SETTINGS.fontSize).toBeNull();
    expect(sanitizeSettings({ fontSize: null }).fontSize).toBeNull();
    expect(sanitizeSettings({ fontSize: 22.4 }).fontSize).toBe(22);
  });

  it('keeps the three presets of the line spacing and a number of the stepper, and nothing else', () => {
    for (const lineSpacing of ['compact', 'normal', 'relaxed'] as const) {
      expect(sanitizeSettings({ lineSpacing }).lineSpacing).toBe(lineSpacing);
    }
    expect(sanitizeSettings({ lineSpacing: 1.74 }).lineSpacing).toBe(1.7);
    expect(sanitizeSettings({ lineSpacing: 0.2 }).lineSpacing).toBe(1.3);
    expect(sanitizeSettings({ lineSpacing: 'airy' }).lineSpacing).toBe('normal');
    expect(sanitizeSettings({ lineSpacing: Number.NaN }).lineSpacing).toBe('normal');
    // The preset wins over a stale number stored beside it.
    expect(sanitizeSettings({ lineSpacing: 'relaxed', lineHeight: 1.4 }).lineSpacing).toBe(
      'relaxed',
    );
  });

  it('keeps a well-formed reading pair and drops a malformed one', () => {
    expect(sanitizeSettings({ readerPair: 'ro+en' }).readerPair).toBe('ro+en');
    expect(sanitizeSettings({ readerPair: 'en+orig' }).readerPair).toBe('en+orig');
    expect(sanitizeSettings({ readerPair: 'ro+ro' }).readerPair).toBeNull();
    expect(sanitizeSettings({ readerPair: 'ro' }).readerPair).toBeNull();
    expect(sanitizeSettings({ readerPair: 'RO+EN' }).readerPair).toBeNull();
    expect(sanitizeSettings({ readerPair: 7 }).readerPair).toBeNull();
    expect(sanitizeSettings({ readerPair: null }).readerPair).toBeNull();
  });

  it('keeps a valid reading language and interface language', () => {
    expect(sanitizeSettings({ readingLanguage: 'en', uiLanguage: 'en' })).toMatchObject({
      readingLanguage: 'en',
      uiLanguage: 'en',
    });
    expect(sanitizeSettings({ readingLanguage: 'ro', uiLanguage: 'system' })).toMatchObject({
      readingLanguage: 'ro',
      uiLanguage: 'system',
    });
  });

  it('ignores a language it does not know, and a reading language of "system"', () => {
    const english = createDefaultSettings('en-GB');
    expect(sanitizeSettings({ readingLanguage: 'fr', uiLanguage: 'de' }, english)).toMatchObject({
      readingLanguage: 'en',
      uiLanguage: 'system',
    });
    // Reading language is ro or en: "system" belongs to the interface language only.
    expect(sanitizeSettings({ readingLanguage: 'system' }, english).readingLanguage).toBe('en');
    expect(sanitizeSettings({ readingLanguage: 7, uiLanguage: null }, english)).toMatchObject({
      readingLanguage: 'en',
      uiLanguage: 'system',
    });
  });

  it('gives settings stored before the languages existed the defaults of the device', () => {
    const stored = { fontSize: 20, lineHeight: 1.5, theme: 'sepia' };
    const kept = { fontSize: 20, lineSpacing: 1.5, theme: 'sepia' };
    expect(sanitizeSettings(stored, createDefaultSettings('ro-RO'))).toEqual({
      ...kept,
      readingFont: 'serif',
      readingLanguage: 'ro',
      uiLanguage: 'system',
      readerPair: null,
    });
    expect(sanitizeSettings(stored, createDefaultSettings('en-US'))).toEqual({
      ...kept,
      readingFont: 'serif',
      readingLanguage: 'en',
      uiLanguage: 'system',
      readerPair: null,
    });
  });
});

describe('default settings', () => {
  it('read Romanian on a Romanian device and English on any other, an unknown one included', () => {
    expect(createDefaultSettings('ro-RO').readingLanguage).toBe('ro');
    expect(createDefaultSettings('ro').readingLanguage).toBe('ro');
    expect(createDefaultSettings('en-US').readingLanguage).toBe('en');
    expect(createDefaultSettings('de-DE').readingLanguage).toBe('en');
    expect(createDefaultSettings(undefined).readingLanguage).toBe('en');
    expect(createDefaultSettings('').readingLanguage).toBe('en');
  });

  it('follow the device for the interface, whatever the device', () => {
    expect(createDefaultSettings('en-US').uiLanguage).toBe('system');
    expect(createDefaultSettings('ro-RO').uiLanguage).toBe('system');
  });

  it('use the (pinned) Romanian device of the tests', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      fontSize: null,
      lineSpacing: 'normal',
      theme: 'system',
      readingFont: 'serif',
      readingLanguage: 'ro',
      uiLanguage: 'system',
      readerPair: null,
    });
  });
});

describe('reading font setting', () => {
  it('keeps the three faces the reader can choose and nothing else', () => {
    for (const readingFont of ['serif', 'literata', 'sans'] as const) {
      expect(sanitizeSettings({ readingFont }).readingFont).toBe(readingFont);
    }
    expect(sanitizeSettings({ readingFont: 'comic' }).readingFont).toBe('serif');
    expect(sanitizeSettings({ readingFont: 7 }).readingFont).toBe('serif');
    expect(sanitizeSettings({}).readingFont).toBe('serif');
    expect(createDefaultSettings('en-US').readingFont).toBe('serif');
  });
});

describe('PositionWriter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('writes nothing before enable, then debounces', async () => {
    const store = createMemoryStore();
    const writer = new PositionWriter(store, 'edition-1', 's1');
    writer.track('p3');
    jest.advanceTimersByTime(2000);
    expect(store.data.size).toBe(0);

    writer.enable();
    expect(await loadPosition(store, 'edition-1')).toMatchObject({
      sectionId: 's1',
      paragraphId: 'p3',
    });

    writer.track('p4');
    writer.track('p5');
    expect(await loadPosition(store, 'edition-1')).toMatchObject({ paragraphId: 'p3' });
    jest.advanceTimersByTime(600);
    expect(await loadPosition(store, 'edition-1')).toMatchObject({ paragraphId: 'p5' });
  });

  it('flushes pending writes', async () => {
    const store = createMemoryStore();
    const writer = new PositionWriter(store, 'edition-1', 's1');
    writer.enable();
    writer.track('p9');
    writer.flush();
    expect(await loadPosition(store, 'edition-1')).toMatchObject({ paragraphId: 'p9' });
  });
});

describe('labels', () => {
  it('formats languages, years and lifespans in Romanian', () => {
    expect(languageName('grc', ro)).toBe('Greaca veche');
    expect(languageName('xx-YY', ro)).toBe('XX-YY');
    expect(languageName('EN-gb', ro)).toBe('Engleză');
    expect(formatYear(-5, ro)).toBe('5 î.Hr.');
    expect(formatYear(1903, ro)).toBe('1903');
    expect(formatYear(null, ro)).toBe('');
    expect(formatLifespan(1862, 1949, ro)).toBe('1862–1949');
    expect(formatLifespan(1862, null, ro)).toBe('n. 1862');
    expect(formatLifespan(null, 1949, ro)).toBe('m. 1949');
    expect(formatLifespan(null, null, ro)).toBe('');
  });

  it('formats languages, years and lifespans in English', () => {
    expect(languageName('grc', en)).toBe('Ancient Greek');
    expect(languageName('la', en)).toBe('Latin');
    expect(languageName('xx-YY', en)).toBe('XX-YY');
    expect(formatYear(-5, en)).toBe('5 BC');
    expect(formatLifespan(1862, 1949, en)).toBe('1862–1949');
    expect(formatLifespan(1862, null, en)).toBe('b. 1862');
    expect(formatLifespan(null, 1949, en)).toBe('d. 1949');
  });

  it('writes the two reading languages in their own language, in either interface language', () => {
    for (const table of [ro, en]) {
      expect(editionLanguageLabel('ro', table)).toBe('Română');
      expect(editionLanguageLabel('en', table)).toBe('English');
      expect(editionLanguageLabel('en-GB', table)).toBe('English');
    }
    // Any other language is named in the interface language.
    expect(editionLanguageLabel('la', ro)).toBe('Latină');
    expect(editionLanguageLabel('la', en)).toBe('Latin');
    expect(editionLanguageLabel('xx', en)).toBe('XX');
  });

  it('labels an edition with its language and what it is', () => {
    expect(editionLabel({ language: 'ro', kind: 'translation' }, ro)).toBe('Română · traducere');
    expect(editionLabel({ language: 'en', kind: 'source' }, ro)).toBe('English · original');
    expect(editionLabel({ language: 'la', kind: 'source' }, ro)).toBe('Latină · original');
    expect(editionLabel({ language: 'ro', kind: 'translation' }, en)).toBe('Română · translation');
    expect(editionLabel({ language: 'la', kind: 'source' }, en)).toBe('Latin · original');
  });

  it('names licence statuses and edition kinds in the interface language', () => {
    expect(licenceLabel('public-domain', ro)).toBe('Domeniu public');
    expect(licenceLabel('public-domain', en)).toBe('Public domain');
    expect(editionKindLabel('translation', ro)).toBe('Traducere');
    expect(editionKindLabel('source', en)).toBe('Original');
  });

  it('picks the licence note in the interface language and falls back to the note itself', () => {
    const licence = { note: 'English note', noteRo: 'Notă în română', noteEn: 'Note in English' };
    expect(licenceNote(licence, 'ro')).toBe('Notă în română');
    expect(licenceNote(licence, 'en')).toBe('Note in English');
    expect(licenceNote({ note: 'Only note' }, 'ro')).toBe('Only note');
    expect(licenceNote({ note: 'Only note', noteRo: 'Doar româna' }, 'en')).toBe('Only note');
    expect(licenceNote({ note: 'Only note', noteRo: '  ' }, 'ro')).toBe('Only note');
    expect(licenceNote({ note: '' }, 'en')).toBe('');
  });
});

describe('chapter headings', () => {
  it('splits a Roman numeral from the title, as printed in the source', () => {
    expect(splitChapterHeading('I. Introductory')).toEqual({ numeral: 'I', title: 'Introductory' });
    expect(splitChapterHeading('IV. The Present and the Future Kingdom')).toEqual({
      numeral: 'IV',
      title: 'The Present and the Future Kingdom',
    });
    expect(splitChapterHeading('XVIII. Concluding')).toEqual({
      numeral: 'XVIII',
      title: 'Concluding',
    });
  });

  it('leaves headings without a numeral alone', () => {
    expect(splitChapterHeading('Preface')).toEqual({ numeral: '', title: 'Preface' });
    expect(splitChapterHeading('Capitolul 1. Început')).toEqual({
      numeral: '',
      title: 'Capitolul 1. Început',
    });
    // Words made of numeral letters, and malformed numerals, are not numerals.
    expect(splitChapterHeading('CIVIL. Law')).toEqual({ numeral: '', title: 'CIVIL. Law' });
    expect(splitChapterHeading('IIII. Four')).toEqual({ numeral: '', title: 'IIII. Four' });
    expect(splitChapterHeading('V.')).toEqual({ numeral: '', title: 'V.' });
    expect(splitChapterHeading('')).toEqual({ numeral: '', title: '' });
  });
});

describe('progress text', () => {
  it('writes a percentage with a no-break space, as in "2 din 11 · 9 %"', () => {
    expect(ro.reader.percent(9)).toBe('9\u00a0%');
    expect(ro.reader.position(2, 11, 9)).toBe('2 din 11 · 9\u00a0%');
    expect(ro.reader.position(2, 11, 9).replace('\u00a0', ' ')).toBe('2 din 11 · 9 %');
  });

  it('writes it the English way: "2 of 11 · 9%"', () => {
    expect(en.reader.percent(9)).toBe('9%');
    expect(en.reader.position(2, 11, 9)).toBe('2 of 11 · 9%');
  });
});

describe('app version', () => {
  it('package.json and app.config.ts declare the same version, and it is readable', () => {
    const config = jest.requireActual('../../app.config').default as { version?: string };
    const { version } = jest.requireActual('../../package.json') as { version: string };
    expect(config.version).toBe(version);
    const { getAppVersion } =
      jest.requireActual<typeof import('@/content/app-version')>('@/content/app-version');
    expect(getAppVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
