import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { centuryOfYear, englishOrdinal, formatCentury, toRoman } from '@/i18n/centuries';
import { CEDILLA, findCedillas, fixCedillas } from '@/i18n/diacritics';
import { en } from '@/i18n/en';
import sameInBoth from '@/i18n/i18n-same.json';
import { formatCenturyLabel } from '@/i18n/labels';
import { NBSP, count, formatNumber, pluralCategory } from '@/i18n/plural';
import { ro } from '@/i18n/ro';
import { tableOutputs, tableTexts, tableValue } from '@/test-support/string-tables';

/** A text with its no-break spaces written as ordinary ones, for comparing with the spec. */
const plain = (text: string) => text.replaceAll(NBSP, ' ');

describe('pluralCategory (hand-written CLDR rules: Hermes has no Intl.PluralRules)', () => {
  it('is the same as Intl.PluralRules on Node for n = 0 to 1000, in Romanian and English', () => {
    expect(typeof Intl.PluralRules).toBe('function');
    for (const language of ['ro', 'en'] as const) {
      const native = new Intl.PluralRules(language);
      const different: string[] = [];
      for (let n = 0; n <= 1000; n += 1) {
        if (pluralCategory(n, language) !== native.select(n)) {
          different.push(`${language} ${n}: ${pluralCategory(n, language)} vs ${native.select(n)}`);
        }
      }
      expect(different).toEqual([]);
    }
  });

  it('agrees with Intl.PluralRules on larger numbers and on decimals too', () => {
    for (const language of ['ro', 'en'] as const) {
      const native = new Intl.PluralRules(language);
      for (const n of [
        1001, 1019, 1020, 2000, 10101, 100019, 100020, 1000000, 0.5, 1.5, 2.5, 20.5,
      ]) {
        expect(pluralCategory(n, language)).toBe(native.select(n));
      }
    }
  });

  it('follows the Romanian rule: one for 1, few for 0 and for 1 to 19 mod 100, other from 20 (with "de")', () => {
    expect(
      [0, 1, 2, 12, 19, 20, 21, 100, 101, 111, 119, 120, 1000, 1001].map((n) =>
        pluralCategory(n, 'ro'),
      ),
    ).toEqual([
      'few',
      'one',
      'few',
      'few',
      'few',
      'other',
      'other',
      'other',
      'few',
      'few',
      'few',
      'other',
      'other',
      'few',
    ]);
  });

  it('follows the English rule: one for 1, other for everything else, 0 included', () => {
    expect([0, 1, 2, 5, 11, 21, 100].map((n) => pluralCategory(n, 'en'))).toEqual([
      'other',
      'one',
      'other',
      'other',
      'other',
      'other',
      'other',
    ]);
  });
});

describe('count (the only way a count is written)', () => {
  it('writes the Romanian examples of the spec (17.2)', () => {
    const cases: [keyof typeof ro.counts, number[], string[]][] = [
      ['works', [1, 2, 12, 20], ['1 lucrare', '2 lucrări', '12 lucrări', '20 de lucrări']],
      ['passages', [1, 3, 20], ['1 pasaj', '3 pasaje', '20 de pasaje']],
      ['editions', [1, 2, 20], ['1 ediție', '2 ediții', '20 de ediții']],
      ['sections', [1, 5, 100], ['1 secțiune', '5 secțiuni', '100 de secțiuni']],
      ['sources', [1, 4, 30], ['1 sursă', '4 surse', '30 de surse']],
      ['results', [1, 2, 20], ['1 rezultat', '2 rezultate', '20 de rezultate']],
      ['authors', [1, 3, 20], ['1 autor', '3 autori', '20 de autori']],
    ];
    for (const [noun, numbers, expected] of cases) {
      expect(numbers.map((n) => plain(ro.counts[noun](n)))).toEqual(expected);
    }
  });

  it('writes the English examples: one and other', () => {
    expect(en.counts.works(1)).toBe(`1${NBSP}work`);
    expect([0, 1, 2, 20].map((n) => plain(en.counts.works(n)))).toEqual([
      '0 works',
      '1 work',
      '2 works',
      '20 works',
    ]);
    expect(plain(en.counts.sections(1))).toBe('1 section');
    expect(plain(en.counts.sources(2))).toBe('2 sources');
    expect(plain(en.counts.authors(3))).toBe('3 authors');
  });

  it('puts a no-break space between the number and the noun', () => {
    expect(ro.counts.works(20)).toBe(`20${NBSP}de lucrări`);
    expect(en.counts.results(5)).toBe(`5${NBSP}results`);
  });

  it('handles the edges of the Romanian rule: 0, 101 to 119, 120, 1001', () => {
    expect(plain(ro.counts.works(0))).toBe('0 lucrări');
    expect(plain(ro.counts.works(101))).toBe('101 lucrări');
    expect(plain(ro.counts.works(119))).toBe('119 lucrări');
    expect(plain(ro.counts.works(120))).toBe('120 de lucrări');
    expect(plain(ro.counts.works(21))).toBe('21 de lucrări');
    expect(plain(ro.counts.works(1001))).toBe('1.001 lucrări');
    expect(plain(ro.counts.works(1000))).toBe('1.000 de lucrări');
  });

  it('groups thousands with a point in Romanian and a comma in English', () => {
    expect(formatNumber(1234567, 'ro')).toBe('1.234.567');
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
    expect(formatNumber(999, 'ro')).toBe('999');
    expect(formatNumber(-1500, 'en')).toBe('-1,500');
    expect(formatNumber(1500.5, 'ro')).toBe('1.500,5');
  });

  it('falls back to `other` when a language has no `few`', () => {
    expect(plain(count(0, { one: 'work', other: 'works' }, 'ro'))).toBe('0 works');
  });

  it('is what the screens use: results, the cap and the rejected packs', () => {
    expect(plain(ro.search.results(1))).toBe('1 rezultat');
    expect(plain(ro.search.results(20))).toBe('20 de rezultate');
    expect(plain(ro.search.resultsCapped(50))).toBe('Primele 50 de rezultate');
    expect(plain(en.search.resultsCapped(50))).toBe('First 50 results');
    expect(plain(ro.library.unverified(2))).toBe(
      '2 pachete de conținut nu au putut fi verificate și nu sunt afișate.',
    );
    expect(plain(ro.library.unverified(20))).toBe(
      '20 de pachete de conținut nu au putut fi verificate și nu sunt afișate.',
    );
    expect(ro.library.unverified(1)).toBe(
      'Un pachet de conținut nu a putut fi verificat și nu este afișat.',
    );
    expect(plain(en.library.unverified(3))).toBe(
      '3 content packs could not be verified and are not shown.',
    );
  });
});

describe('centuries (17.3)', () => {
  it('numbers the century of a year: 354 is the 4th, 1903 the 20th, 100 the 1st, 101 the 2nd', () => {
    expect([1, 100, 101, 354, 430, 1000, 1001, 1903, 2000].map(centuryOfYear)).toEqual([
      1, 1, 2, 4, 5, 10, 11, 20, 20,
    ]);
    // Before Christ: negative; 5 BC and 100 BC are the 1st century BC, 101 BC the 2nd.
    expect([-5, -100, -101, -430].map(centuryOfYear)).toEqual([-1, -1, -2, -5]);
  });

  it('writes Roman numerals', () => {
    expect([1, 4, 5, 9, 14, 19, 20, 21, 39, 49, 1994].map(toRoman)).toEqual([
      'I',
      'IV',
      'V',
      'IX',
      'XIV',
      'XIX',
      'XX',
      'XXI',
      'XXXIX',
      'XLIX',
      'MCMXCIV',
    ]);
    expect(toRoman(0)).toBe('0');
    expect(toRoman(5000)).toBe('5000');
  });

  it('writes English ordinals: 1st, 2nd, 3rd, 4th, 11th to 13th, 21st, 22nd', () => {
    expect([1, 2, 3, 4, 5, 10, 11, 12, 13, 20, 21, 22, 23, 101, 111].map(englishOrdinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '5th',
      '10th',
      '11th',
      '12th',
      '13th',
      '20th',
      '21st',
      '22nd',
      '23rd',
      '101st',
      '111th',
    ]);
  });

  it('writes Romanian short "sec. V" and long "secolul al V-lea", the first one "secolul I"', () => {
    expect(formatCentury(5, 'ro', 'short')).toBe('sec. V');
    expect(formatCentury(5, 'ro', 'long')).toBe('secolul al V-lea');
    expect(formatCentury(1, 'ro', 'short')).toBe('sec. I');
    expect(formatCentury(1, 'ro', 'long')).toBe('secolul I');
    expect(formatCentury(20, 'ro', 'long')).toBe('secolul al XX-lea');
    expect(ro.dates.centuryShort(16)).toBe('sec. XVI');
    expect(ro.dates.centuryLong(4)).toBe('secolul al IV-lea');
  });

  it('writes English "5th century", one form for both styles', () => {
    expect(formatCentury(5, 'en', 'short')).toBe('5th century');
    expect(formatCentury(5, 'en', 'long')).toBe('5th century');
    expect(formatCentury(21, 'en', 'long')).toBe('21st century');
    expect(en.dates.centuryShort(12)).toBe('12th century');
  });

  it('writes a century before Christ with î.Hr. and BC', () => {
    expect(formatCentury(-5, 'ro', 'short')).toBe('sec. V î.Hr.');
    expect(formatCentury(-5, 'ro', 'long')).toBe('secolul al V-lea î.Hr.');
    expect(formatCentury(-1, 'ro', 'long')).toBe('secolul I î.Hr.');
    expect(formatCentury(-5, 'en', 'short')).toBe('5th century BC');
  });

  it('is what the label helper uses, and says nothing for an unknown century', () => {
    expect(formatCenturyLabel(5, ro)).toBe('sec. V');
    expect(formatCenturyLabel(5, ro, 'long')).toBe('secolul al V-lea');
    expect(formatCenturyLabel(5, en, 'long')).toBe('5th century');
    expect(formatCenturyLabel(null, ro)).toBe('');
    expect(formatCenturyLabel(undefined, en)).toBe('');
  });
});

describe('cedilla lint (17.5, G10)', () => {
  it('finds the four cedilla characters and no other', () => {
    expect(CEDILLA.test('ş')).toBe(true);
    expect(CEDILLA.test('Ş')).toBe(true);
    expect(CEDILLA.test('ţ')).toBe(true);
    expect(CEDILLA.test('Ţ')).toBe(true);
    for (const fine of ['ș', 'ț', 'Ș', 'Ț', 'ă', 'â', 'î', 's', 't', 'ç']) {
      expect(CEDILLA.test(fine)).toBe(false);
    }
    expect(findCedillas('Biblioteca ştiinţei, şi ţara')).toBe('şţ');
    expect(findCedillas('Biblioteca științei')).toBe('');
  });

  it('turns cedilla forms into comma-below letters', () => {
    expect(fixCedillas('ŞşŢţ')).toBe('ȘșȚț');
    expect(fixCedillas('știință')).toBe('știință');
  });

  it('fails on a cedilla form in any string of the Romanian or the English table', () => {
    const offences: string[] = [];
    for (const [name, table] of [
      ['ro', ro],
      ['en', en],
    ] as const) {
      for (const { path, text } of tableTexts(table)) {
        const found = findCedillas(text);
        if (found) offences.push(`${name}.${path}: ${found}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('fails on a cedilla form in the source files of the app (the catalogue joins in P1a phase 2)', () => {
    const src = join(__dirname, '..');
    const files = (readdirSync(src, { recursive: true }) as string[])
      .filter((file) => /\.(ts|tsx|json)$/.test(file))
      .filter((file) => !file.split(sep).includes('__tests__'))
      .filter((file) => file !== join('i18n', 'diacritics.ts'));
    expect(files.length).toBeGreaterThan(50);
    const offences = files
      .filter((file) => findCedillas(readFileSync(join(src, file), 'utf8')) !== '')
      .map((file) => relative(src, join(src, file)));
    expect(offences).toEqual([]);
  });
});

describe('i18n-same.json (G9: nothing is the same in both languages unless it is listed)', () => {
  const listed = Object.keys(sameInBoth);

  /** The paths whose Romanian and English texts are all equal (a function by what it gives for samples). */
  function equalPaths(): string[] {
    const paths = new Set(tableTexts(ro).map((entry) => entry.path));
    return [...paths].filter((path) => {
      const romanian = tableOutputs(ro, path);
      const english = tableOutputs(en, path);
      return (
        romanian.length > 0 &&
        romanian.length === english.length &&
        romanian.every((text, index) => text === english[index])
      );
    });
  }

  it('lists every key whose Romanian and English strings are equal', () => {
    expect(equalPaths().filter((path) => !listed.includes(path))).toEqual([]);
  });

  it('lists only keys that exist and are equal (no stale entries)', () => {
    for (const path of listed) {
      expect(tableValue(ro, path)).toBeDefined();
      expect(tableValue(en, path)).toBeDefined();
    }
    expect(listed.filter((path) => !equalPaths().includes(path))).toEqual([]);
  });

  it('gives a reason for every entry', () => {
    for (const reason of Object.values(sameInBoth)) expect(reason.trim().length).toBeGreaterThan(5);
  });
});
