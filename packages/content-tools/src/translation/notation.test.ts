import { describe, expect, it } from 'vitest';

import { defined } from '../lib/invariant';
import { UsageError } from '../lib/usage-error';
import { BOOKS } from './books';
import {
  canonicalKey,
  detectForeignNotation,
  extractReferences,
  findUnparsedFragments,
  hasReferenceGrammar,
  parseReferences,
} from './notation';
import { LATIN_BOOK_CITATIONS } from './reference-fixtures';
import {
  canonicalItems,
  detectNonRomanianNotation,
  extractTargetReferences,
  findUnparsedReferenceFragments,
  parseSourceReferences,
} from './references';

const english = (text: string, target: 'ro' | 'en' = 'ro') =>
  parseReferences(text, { source: 'en', target });
const canonicalOf = (text: string, target = 'en') =>
  extractReferences(text, target).map((r) => r.canonical);

describe('English sources, as before', () => {
  const TEXTS = [
    'See Matt. iv. 17; Mk. i. 15; Lk. iv. 43. And Jno. iii. 3, 5; xviii. 36.',
    'Mk. x. 17, with vs. 23 and Matt. xviii. 23 ff.; cf. 1 Cor. xv. 23-28.',
    'in Chap. xxi and Obad. 21, then vs. 19 alone and Lk. i. 17,35; xxiv. 19,49',
    'Is it so? Mark my words, John said so. Job 5 times and Acts 3 days.',
  ];

  it.each(TEXTS)('gives the runs of parseSourceReferences for the pair en -> ro: %s', (text) => {
    expect(english(text)).toEqual(parseSourceReferences(text));
  });

  it('gives the unparsed fragments of the English safety net', () => {
    for (const text of TEXTS) {
      expect(findUnparsedFragments(text, 'en')).toEqual(findUnparsedReferenceFragments(text));
    }
    expect(findUnparsedFragments('as in Matt. xi. 1903 it is clear', 'en')).toHaveLength(1);
  });

  it('reads the Romanian notation of a translation as extractTargetReferences does', () => {
    const text = 'Vezi Mat. 4:17; Mc. 1:15, cu v. 23 și In. 3:3, 5; 18:36 ș.urm. Obad. 21.';
    expect(extractReferences(text, 'ro')).toEqual(extractTargetReferences(text));
  });

  it('flags the same foreign notation in a Romanian translation of an English source', () => {
    for (const text of [
      'Matt. iv. 17; Mk. i. 15 nu, Mat. 4:17 da.',
      'Cf. Jno. 3:16, vs. 5 și Mat. 4:17.',
      'Obad. 21 și v. 5 sunt valide.',
    ]) {
      expect(detectForeignNotation(text, { source: 'en', target: 'ro' })).toEqual(
        detectNonRomanianNotation(text),
      );
    }
  });

  it('does not look for Latin notation in a Romanian translation of an English source', () => {
    expect(detectForeignNotation('Vezi Matth. IV, 17.', { source: 'en', target: 'ro' })).toEqual(
      [],
    );
    expect(detectForeignNotation('Vezi Matth. IV, 17.', { source: 'la', target: 'ro' })).toEqual([
      'Matth. IV, 17',
    ]);
  });
});

describe('English sources and an English target', () => {
  it('writes the references of Vos in the English notation of a translation', () => {
    const runs = english(
      'Matt. iv. 17; Mk. i. 15; Lk. iv. 43, with Jno. iii. 3, 5; xviii. 36, and 1 Cor. xv. 23-28, Matt. xviii. 23 ff.',
      'en',
    );
    expect(runs.map((r) => r.target)).toEqual([
      'Matt. 4:17; Mark 1:15; Luke 4:43',
      'John 3:3, 5; 18:36',
      '1 Cor. 15:23–28',
      'Matt. 18:23 ff.',
    ]);
  });
});

describe('the sources that have a grammar', () => {
  it('are English and Latin; Greek and the other languages have none', () => {
    expect(hasReferenceGrammar('en')).toBe(true);
    expect(hasReferenceGrammar('en-GB')).toBe(true);
    expect(hasReferenceGrammar('la')).toBe(true);
    expect(hasReferenceGrammar('grc')).toBe(false);
    expect(hasReferenceGrammar('de')).toBe(false);
  });

  it('read nothing in a Greek source, whatever the target', () => {
    for (const target of ['ro', 'en']) {
      expect(parseReferences('Matt. iv. 17 καὶ Ioh. 3, 5', { source: 'grc', target })).toEqual([]);
    }
  });

  it('refuse a target language the pipeline has no notation for', () => {
    expect(() => parseReferences('Matt. iv. 17', { source: 'en', target: 'fr' })).toThrow(
      UsageError,
    );
    expect(() => extractReferences('Mat. 4:17', 'la')).toThrow(UsageError);
  });
});

describe('the notation of an English translation', () => {
  it('reads the standard abbreviations, full names, runs and continuations', () => {
    expect(canonicalOf('See Matt. 4:17; Mark 1:15; Luke 4:43 and John 3:3, 5; 18:36.')).toEqual([
      ['Matt 4:17', 'Mark 1:15', 'Luke 4:43'],
      ['John 3:3', 'John 3:5', 'John 18:36'],
    ]);
    expect(canonicalOf('Matthew 5:3; 1 Corinthians 15:3')).toEqual([['Matt 5:3', '1Cor 15:3']]);
    expect(canonicalOf('Matt. 5:12; 6:20')).toEqual([['Matt 5:12', 'Matt 6:20']]);
    expect(canonicalOf('Rom. 5:12; v. 14')).toEqual([['Rom 5:12', 'Rom 5:14']]);
    expect(canonicalOf('Mark 10:17, with v. 23')).toEqual([['Mark 10:17', 'Mark 10:23']]);
    expect(canonicalOf('John 3:3, vv. 5-7')).toEqual([['John 3:3', 'John 3:5-7']]);
    expect(canonicalOf('Obad. 21 and Jude 3-5')).toEqual([['Obad 21'], ['Jude 3-5']]);
    expect(canonicalOf('Rom. 8:19 ff. and Matt. 18:23 ff.')).toEqual([
      ['Rom 8:19ff'],
      ['Matt 18:23ff'],
    ]);
  });

  it('reads the deuterocanonical books of the Vulgate', () => {
    expect(canonicalOf('Wis. 3:1; Sir. 3:22; 1 Macc. 2:3; Tob. 4:15; Bar. 3:38; Jdt. 8:7')).toEqual(
      [['Wis 3:1', 'Sir 3:22', '1Macc 2:3', 'Tob 4:15', 'Bar 3:38', 'Jdt 8:7']],
    );
  });

  it('reads a chapter named without verses in exactly the abbreviation it renders', () => {
    expect(canonicalOf('in John 13 and Matt. 13, he says')).toEqual([['John 13'], ['Matt 13']]);
    expect(canonicalOf('in Matt 13')).toEqual([]);
  });

  it('keeps the number of the next book out of the verse list', () => {
    expect(canonicalOf('Rom. 5:12, 1 Cor. 15:22 and 2 Tim. 3:16')).toEqual([
      ['Rom 5:12'],
      ['1Cor 15:22'],
      ['2Tim 3:16'],
    ]);
    expect(canonicalOf('1 Cor. 15:22, 3 John 4')).toEqual([['1Cor 15:22'], ['3John 4']]);
    expect(canonicalOf('Rom. 2:5, 3 times')).toEqual([['Rom 2:5', 'Rom 2:3']]);
  });

  it('does not take a time of day, a ratio or a verse number alone for a reference', () => {
    expect(canonicalOf('at 10:30 in the morning, a ratio of 3:1, and 12:30:15')).toEqual([]);
    expect(canonicalOf('the 5:12 train; 18:36 at night')).toEqual([]);
    expect(canonicalOf('Mark my words; Job was patient; the Acts of the Apostles')).toEqual([]);
  });

  it('does not read a Latin or Romanian abbreviation, nor a roman numeral', () => {
    expect(canonicalOf('Matth. 4:17; Marc. 1:15; Ioh. 3:5')).toEqual([]);
    expect(canonicalOf('Matt. iv. 17')).toEqual([]);
    expect(canonicalOf('Mat. 4:17; Mc. 1:15')).toEqual([]);
  });

  it('keeps the Vulgate numbering of the psalms as the source number', () => {
    expect(canonicalOf('Ps. 118:2 and Ps. 118:5')).toEqual([['Ps 118:2'], ['Ps 118:5']]);
  });
});

describe('what a translation can show of a canonical item', () => {
  it('canonicalKey drops the marker of Vulgate numbering and nothing else', () => {
    expect(canonicalKey('Ps 118:2 vulgate')).toBe('Ps 118:2');
    expect(canonicalKey('1Kgs 2:3 vulgate')).toBe('1Kgs 2:3');
    expect(canonicalKey('Ps 118 vulgate')).toBe('Ps 118');
    expect(canonicalKey('Matt 4:17')).toBe('Matt 4:17');
    expect(canonicalKey('vs 14')).toBe('vs 14');
    expect(canonicalKey('Obad 21')).toBe('Obad 21');
  });

  it('a Latin citation written back in either notation gives the same canonical items', () => {
    for (const [citation, canonical] of LATIN_BOOK_CITATIONS) {
      for (const target of ['en', 'ro'] as const) {
        const [run] = parseReferences(`ut ${citation}, dicit`, { source: 'la', target });
        const back = extractReferences(defined(run, citation).target, target);
        expect(
          back.map((r) => r.canonical),
          `${citation} -> ${run?.target} (${target})`,
        ).toEqual([[canonicalKey(canonical)]]);
      }
    }
  });

  it('generated Latin citations of every book read back to the same items in either notation', () => {
    // A small deterministic generator (a linear congruential sequence): book, chapter in roman
    // (either case) or Arabic numerals, the separators of the editions, verse lists, ranges and
    // "and the following".
    let seed = 987654321;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const int = (from: number, to: number): number => from + Math.floor(next() * (to - from + 1));
    const pick = <T>(items: readonly T[]): T =>
      defined(items[Math.floor(next() * items.length)], 'item');
    const roman = (value: number): string => {
      const table: [number, string][] = [
        [40, 'XL'],
        [10, 'X'],
        [9, 'IX'],
        [5, 'V'],
        [4, 'IV'],
        [1, 'I'],
      ];
      let rest = value;
      let out = '';
      for (const [size, letters] of table) {
        while (rest >= size) {
          out += letters;
          rest -= size;
        }
      }
      return out;
    };
    const heads = [
      ...new Set(
        LATIN_BOOK_CITATIONS.map(([citation]) => /^(.*?\p{L}\.?)\s+\d/u.exec(citation)?.[1] ?? ''),
      ),
    ];
    const singleChapter = new Set(['Iud.', 'Jud.', 'Abd.', 'Philem.']);
    expect(heads.length).toBeGreaterThan(80);
    expect(heads).not.toContain('');

    for (let i = 0; i < 600; i += 1) {
      const head = pick(heads);
      const single = singleChapter.has(head);
      const chapter = int(1, 40);
      const numeral = next() < 0.4;
      const written = numeral
        ? next() < 0.5
          ? roman(chapter).toLowerCase()
          : roman(chapter)
        : String(chapter);
      const separator = numeral ? pick([', ', '. ', ',']) : pick([', ', ':', ',']);
      let verse = int(1, 20);
      const verses = Array.from({ length: int(1, 3) }, () => {
        const item = next() < 0.3 ? `${verse}-${verse + int(1, 4)}` : String(verse);
        verse += int(6, 9);
        return item;
      });
      const list = verses.join(pick([', ', ', ', ' et ']));
      const following = next() < 0.2 ? ` ${pick(['sq.', 'sqq.', 'ff.'])}` : '';
      const citation = single
        ? `${head} ${list}${following}`
        : `${head} ${written}${separator}${list}${following}`;
      for (const target of ['en', 'ro'] as const) {
        const runs = parseReferences(`Ut dicitur ${citation}, et sic.`, { source: 'la', target });
        expect(runs, citation).toHaveLength(1);
        const run = defined(runs[0], citation);
        const back = extractReferences(run.target, target);
        expect(back, `${citation} -> ${run.target}`).toHaveLength(1);
        expect(back[0]?.canonical, `${citation} -> ${run.target} (${target})`).toEqual(
          run.canonical.map(canonicalKey),
        );
      }
    }
  });

  it('a long Latin run written back in either notation gives the same canonical items', () => {
    const text =
      'Rom. v. 12, 14; vi. 3 sqq.; ibid. 9 cum v. 11. Ioh. 3, 5 et v. 7; 4, 14. 1 Cor. 15, 22-24 et Ps. 118, 2.';
    for (const target of ['en', 'ro'] as const) {
      const runs = parseReferences(text, { source: 'la', target });
      const sent = runs.map((r) => r.target).join(' // ');
      const back = extractReferences(sent, target);
      expect(back.map((r) => r.canonical)).toEqual(runs.map((r) => r.canonical.map(canonicalKey)));
    }
  });

  it('the bookless references of a run are items of the run, not lost', () => {
    const runs = parseReferences('Rom. 5, 12; ibid. 14. Cf. v. 3', { source: 'la', target: 'en' });
    expect(canonicalItems(runs)).toEqual(['Rom 5:12', 'Rom 5:14', 'Rom 5:3']);
  });

  it('every one of the 66 books has an English abbreviation that reads back', () => {
    for (const book of BOOKS) {
      const single = book.singleChapter;
      const text = single ? `${book.en} 3` : `${book.en} 3:4`;
      const runs = extractReferences(text, 'en');
      expect(
        runs.map((r) => r.canonical),
        text,
      ).toEqual([[single ? `${book.code} 3` : `${book.code} 3:4`]]);
    }
  });
});

describe('foreign notation in an English translation (REF_FORMAT)', () => {
  const foreign = (text: string, source = 'la') =>
    detectForeignNotation(text, { source, target: 'en' });

  it('flags roman-numeral chapters and Latin abbreviations', () => {
    expect(
      foreign('Matt. 4:17 is fine. Matth. IV, 17 is not. Rom. v. 12 is not. Obad. 21 is.'),
    ).toEqual(['Matth. IV, 17', 'Rom. v. 12']);
    expect(foreign('See Ioh. 3, 5 and Marc. 1:15 and 1 Cor. 15:22 and Luc. 4, 43.')).toEqual([
      'Ioh. 3, 5',
      'Marc. 1:15',
      'Luc. 4, 43',
    ]);
    expect(foreign('Matt. iv. 17; Mk. i. 15', 'grc')).toEqual(['Matt. iv. 17; Mk. i. 15']);
  });

  it('flags a comma between chapter and verse, which is the Latin way', () => {
    expect(foreign('Matt. 4, 17 and John 3:16')).toEqual(['Matt. 4, 17']);
    expect(foreign('Ps. 118:2 and Ps. CXVIII, 2')).toEqual(['Ps. CXVIII, 2']);
  });

  it('accepts what is valid in English: abbreviations, full names, single-chapter books', () => {
    for (const text of [
      'Matt. 4:17; Mark 1:15; Luke 4:43',
      'Matthew 5:3 and John 3:16',
      'Obad. 21 and Jude 3 and 2 John 5',
      '1 Cor. 15:22; Rom. 5:12; v. 14',
      'Ps. 118:2 (Vulgate numbering) and Wis. 3:1',
      'no reference at all, only 3:16 p.m. and Mark my words',
    ]) {
      expect(foreign(text), text).toEqual([]);
    }
  });
});

describe('foreign notation in a Romanian translation of a Latin source', () => {
  const foreign = (text: string) => detectForeignNotation(text, { source: 'la', target: 'ro' });

  it('flags the Latin notation as well as the English one', () => {
    expect(foreign('Mat. 4:17 e bine. Matth. IV, 17 nu. Rom. v. 12 nu. Obad. 21 e bine.')).toEqual([
      'Matth. IV, 17',
      'Rom. v. 12',
    ]);
    expect(foreign('Vezi Ioh. 3, 5 și Mc. 1:15 și 1 Cor. 15:22.')).toEqual(['Ioh. 3, 5']);
    expect(foreign('Cf. Matt. 3:17, vs. 5.')).toEqual(['Matt. 3:17, vs. 5']);
  });

  it('accepts the Romanian notation, with the deuterocanonical books', () => {
    expect(foreign('Mat. 4:17; Mc. 1:15, cu v. 23 și Înț. 3:1; Sir. 3:22; 1 Mac. 2:3.')).toEqual(
      [],
    );
  });
});

describe('reference-like fragments of the sources', () => {
  it('uses the grammar of the language of the source', () => {
    expect(findUnparsedFragments('Rom. v. 12 and xii. 3', 'en')).toHaveLength(0);
    expect(findUnparsedFragments('Par. 3, 4', 'la')).toHaveLength(1);
    expect(findUnparsedFragments('Par. 3, 4', 'grc')).toEqual([]);
  });

  it('takes the runs it is given, so that nothing is parsed twice', () => {
    const text = 'Ioh. 3, 5 and Rom. 5, 12';
    const runs = parseReferences(text, { source: 'la', target: 'en' });
    expect(findUnparsedFragments(text, 'la', runs)).toEqual([]);
    expect(findUnparsedFragments(text, 'la', [])).not.toEqual([]);
  });
});
