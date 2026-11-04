import { describe, expect, it } from 'vitest';

import { defined } from '../lib/invariant';
import {
  canonicalItems,
  compareReferences,
  detectNonRomanianNotation,
  extractTargetReferences,
  findUnparsedReferenceFragments,
  parseSourceReferences,
  renderRomanian,
} from './references';

/** [source run, Romanian rendering, canonical items] */
const SPEC_EXAMPLES: [string, string, string[]][] = [
  [
    'Matt. iv. 17; Mk. i. 15; Lk. iv. 43',
    'Mat. 4:17; Mc. 1:15; Lc. 4:43',
    ['Matt 4:17', 'Mark 1:15', 'Luke 4:43'],
  ],
  ['Jno. iii. 3, 5; xviii. 36', 'In. 3:3, 5; 18:36', ['John 3:3', 'John 3:5', 'John 18:36']],
  ['Exodus xix. 4-6', 'Ex. 19:4–6', ['Exod 19:4-6']],
  ['1 Cor. xv. 23-28', '1 Cor. 15:23–28', ['1Cor 15:23-28']],
  ['Matt. xiii. 24-30, 47-50', 'Mat. 13:24–30, 47–50', ['Matt 13:24-30', 'Matt 13:47-50']],
  [
    'Lk. i. 17,35; xxiv. 19,49',
    'Lc. 1:17, 35; 24:19, 49',
    ['Luke 1:17', 'Luke 1:35', 'Luke 24:19', 'Luke 24:49'],
  ],
  ['Matt. xviii. 23 ff.', 'Mat. 18:23 ș.urm.', ['Matt 18:23ff']],
  ['Obad. 21', 'Obad. 21', ['Obad 21']],
  ['Mk. x. 17, with vs. 23', 'Mc. 10:17, cu v. 23', ['Mark 10:17', 'Mark 10:23']],
];

describe('parseSourceReferences: the examples of the specification', () => {
  it.each(SPEC_EXAMPLES)('%s', (source, target, canonical) => {
    const runs = parseSourceReferences(`See ${source}. And so on.`);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ source, target, canonical });
  });

  it('reports offsets that slice the run out of the text', () => {
    const text = 'As in Matt. iv. 17; Mk. i. 15, the kingdom came.';
    const [run] = parseSourceReferences(text);
    expect(run && text.slice(run.start, run.end)).toBe('Matt. iv. 17; Mk. i. 15');
  });

  it('finds several runs in order and renders each one', () => {
    const runs = parseSourceReferences(
      'First Matt. v. 3, then Lk. vi. 20 f. and last Rom. xiv. 17.',
    );
    expect(runs.map((r) => r.target)).toEqual(['Mat. 5:3', 'Lc. 6:20 ș.urm.', 'Rom. 14:17']);
  });
});

describe('parseSourceReferences: grammar details', () => {
  const one = (text: string) => {
    const runs = parseSourceReferences(text);
    expect(runs).toHaveLength(1);
    return defined(runs[0], 'the run');
  };

  it('accepts a missing period after the book, full names and a number prefix', () => {
    expect(one('Matt v. 6, 10').canonical).toEqual(['Matt 5:6', 'Matt 5:10']);
    expect(one('Acts i. 8').canonical).toEqual(['Acts 1:8']);
    expect(one('Isaiah liii. 5').canonical).toEqual(['Isa 53:5']);
    expect(one('2 Tim. iii. 16').canonical).toEqual(['2Tim 3:16']);
    expect(one('1 Jno. iv. 8').canonical).toEqual(['1John 4:8']);
    expect(one('Song of Solomon ii. 1').canonical).toEqual(['Song 2:1']);
  });

  it('accepts no space after the chapter period and en dash ranges', () => {
    expect(one('Mk. ix.43').canonical).toEqual(['Mark 9:43']);
    expect(one('Rom. viii. 18–23').canonical).toEqual(['Rom 8:18-23']);
  });

  it('treats single-chapter books as book + verses', () => {
    expect(one('Jude 3-5').canonical).toEqual(['Jude 3-5']);
    expect(one('Philem. 10').canonical).toEqual(['Phlm 10']);
    expect(one('2 John 5').canonical).toEqual(['2John 5']);
    expect(one('Obad. 21; Ps. xcvii. 1').canonical).toEqual(['Obad 21', 'Ps 97:1']);
  });

  it('continues a run with a bare chapter after ";" and after "and"', () => {
    expect(one('Matt. v. 12; vi. 20').canonical).toEqual(['Matt 5:12', 'Matt 6:20']);
    const run = one('Matt. xvi. 18 and xviii. 17');
    expect(run.canonical).toEqual(['Matt 16:18', 'Matt 18:17']);
    expect(run.target).toBe('Mat. 16:18 și 18:17');
  });

  it('lets a bare chapter inherit the book across books of one run', () => {
    const run = one('Is. xxiv. 21; xliii. 15; Mic. ii. 12; iv. 6; Obad. 21');
    expect(run.canonical).toEqual(['Isa 24:21', 'Isa 43:15', 'Mic 2:12', 'Mic 4:6', 'Obad 21']);
  });

  it('continues with vs. / ver. after a connective', () => {
    expect(one('Mk. x. 17, with vs. 23').canonical).toEqual(['Mark 10:17', 'Mark 10:23']);
    expect(one('Jno. iii. 3; ver. 5').canonical).toEqual(['John 3:3', 'John 3:5']);
    expect(one('Jno. iii. 3, vss. 5-7').target).toBe('In. 3:3, vv. 5–7');
    expect(one('Jno. iii. 3 and vs. 5').target).toBe('In. 3:3 și v. 5');
  });

  it('reads two numbers separated by white space as a range whose dash was lost', () => {
    const run = one('Lk. vi. 32 35.');
    expect(run.canonical).toEqual(['Luke 6:32-35']);
    expect(run.source).toBe('Lk. vi. 32 35');
  });

  it('does not swallow a following book that starts with a number', () => {
    const runs = parseSourceReferences('Matt. i. 1 2 Cor. xi. 3');
    expect(runs.map((r) => r.canonical)).toEqual([['Matt 1:1'], ['2Cor 11:3']]);
  });

  it('keeps ff. and f. as "ff" and renders both as ș.urm.', () => {
    expect(one('Lk. i. 5 f.').canonical).toEqual(['Luke 1:5ff']);
    expect(one('Lk. i. 5 f.').target).toBe('Lc. 1:5 ș.urm.');
    expect(one('Mk. iv. 3, 9 ff.').canonical).toEqual(['Mark 4:3', 'Mark 4:9ff']);
  });

  it('parses a chapter named without verses', () => {
    const runs = parseSourceReferences(
      'Matt. xiii, Mk. iv. Lk. viii. And 1 Cor. xv, where he says',
    );
    expect(runs.map((r) => r.canonical)).toEqual([
      ['Matt 13'],
      ['Mark 4'],
      ['Luke 8'],
      ['1Cor 15'],
    ]);
    expect(runs.map((r) => r.target)).toEqual(['Mat. 13', 'Mc. 4', 'Lc. 8', '1 Cor. 15']);
  });

  it('takes a bare chapter at the start of a run as a reference without a book', () => {
    const run = one('in the other passage, xviii. 36.');
    expect(run).toMatchObject({ source: 'xviii. 36', target: '18:36', canonical: ['18:36'] });
    const several = one('only in vi. 33; xii. 28; xxi. 31, 43, does he write');
    expect(several.canonical).toEqual(['6:33', '12:28', '21:31', '21:43']);
  });

  it('lets vs. inherit the last reference of the paragraph, or stay unresolved', () => {
    const inherited = parseSourceReferences(
      'In 1 Cor. xv, he says “all in all,” vs. 28, cf. Rev. xi. 15.',
    );
    expect(inherited.map((r) => r.canonical)).toEqual([['1Cor 15'], ['1Cor 15:28'], ['Rev 11:15']]);
    const alone = parseSourceReferences('as it is loosed in heaven,” vs. 19. It would not be');
    expect(alone.map((r) => r.canonical)).toEqual([['vs 19']]);
    expect(alone[0]?.target).toBe('v. 19');
  });

  it('does not take ordinary words for references', () => {
    for (const text of [
      'Is it so? Is v the fifth letter?',
      'Mark my words, John said so.',
      'He was born in 1862 (b. 1862, d. 1949) and wrote c. 1903.',
      'Is. This is not a reference. i. e. neither is this.',
      'the line c. 5 and l. 7 are circa and line',
      'Job 5 times and Acts 3 days',
      'Matt. xi. 1903',
    ]) {
      expect(parseSourceReferences(text), text).toEqual([]);
    }
  });

  it('rejects roman numerals that are not valid chapters', () => {
    expect(parseSourceReferences('Matt. iiii. 3')).toEqual([]);
    expect(parseSourceReferences('Matt. Xi. 3')).toEqual([]);
    expect(parseSourceReferences('Matt. cc. 3')).toEqual([]);
    expect(parseSourceReferences('Matt. IV. 3').map((r) => r.canonical)).toEqual([['Matt 4:3']]);
  });

  it('is deterministic and stateless between calls', () => {
    const text = 'Matt. iv. 17; Mk. i. 15 and xviii. 36 and vs. 4.';
    expect(parseSourceReferences(text)).toEqual(parseSourceReferences(text));
  });
});

describe('renderRomanian', () => {
  it('renders the run of a parse result', () => {
    const [run] = parseSourceReferences('Jno. iii. 3, 5; xviii. 36');
    expect(run && renderRomanian(run)).toBe('In. 3:3, 5; 18:36');
  });

  it('uses the Romanian abbreviation of every book of the table', () => {
    const books: [string, string][] = [
      ['Gen. i. 1', 'Gen. 1:1'],
      ['Ex. iii. 14', 'Ex. 3:14'],
      ['Josh. i. 8', 'Ios. 1:8'],
      ['Judg. vi. 12', 'Jud. 6:12'],
      ['Ruth i. 16', 'Rut 1:16'],
      ['1 Sam. xvi. 7', '1 Sam. 16:7'],
      ['2 Kings ii. 11', '2 Împ. 2:11'],
      ['1 Chron. xxix. 11', '1 Cron. 29:11'],
      ['Neh. viii. 8', 'Neem. 8:8'],
      ['Esther iv. 14', 'Est. 4:14'],
      ['Job xix. 25', 'Iov 19:25'],
      ['Eccl. xii. 13', 'Ecl. 12:13'],
      ['Cant. ii. 4', 'Cânt. 2:4'],
      ['Jer. xxxi. 31', 'Ier. 31:31'],
      ['Lam. iii. 22', 'Plâng. 3:22'],
      ['Ezek. xxxvi. 26', 'Ezec. 36:26'],
      ['Hos. vi. 6', 'Osea 6:6'],
      ['Joel ii. 28', 'Ioel 2:28'],
      ['Jonah iii. 5', 'Iona 3:5'],
      ['Mic. v. 2', 'Mica 5:2'],
      ['Nah. i. 7', 'Naum 1:7'],
      ['Zeph. iii. 17', 'Țef. 3:17'],
      ['Zech. ix. 9', 'Zah. 9:9'],
      ['Mal. iii. 1', 'Mal. 3:1'],
      ['Mk. i. 1', 'Mc. 1:1'],
      ['Lk. i. 1', 'Lc. 1:1'],
      ['Jno. i. 1', 'In. 1:1'],
      ['Acts ii. 1', 'Fapte 2:1'],
      ['Eph. ii. 8', 'Ef. 2:8'],
      ['Phil. ii. 5', 'Fil. 2:5'],
      ['1 Thess. iv. 16', '1 Tes. 4:16'],
      ['Titus ii. 11', 'Tit 2:11'],
      ['Philem. 10', 'Filim. 10'],
      ['Heb. xi. 1', 'Evr. 11:1'],
      ['Jas. ii. 17', 'Iac. 2:17'],
      ['1 Pet. i. 3', '1 Pet. 1:3'],
      ['3 Jno. 4', '3 In. 4'],
      ['Jude 3', 'Iuda 3'],
      ['Rev. xxii. 20', 'Apoc. 22:20'],
    ];
    for (const [source, target] of books) {
      expect(parseSourceReferences(source)[0]?.target, source).toBe(target);
    }
  });
});

describe('extractTargetReferences', () => {
  const extract = (text: string) => canonicalItems(extractTargetReferences(text));

  it('maps the Romanian notation back to the canonical items', () => {
    for (const [, target, canonical] of SPEC_EXAMPLES) {
      expect(extract(`Vezi ${target}. Apoi altceva.`), target).toEqual(canonical);
    }
  });

  it('reads ; chapter continuation, v./vv. continuation and ș.urm.', () => {
    expect(extract('Mat. 5:12; 6:20; Lc. 6:23')).toEqual(['Matt 5:12', 'Matt 6:20', 'Luke 6:23']);
    expect(extract('In. 3:3, vv. 5–7')).toEqual(['John 3:3', 'John 3:5-7']);
    expect(extract('cf. Mc. 10:17, cu v. 23')).toEqual(['Mark 10:17', 'Mark 10:23']);
    expect(extract('Mat. 18:23 ș.urm. și Lc. 1:5 ș. urm.')).toEqual(['Matt 18:23ff', 'Luke 1:5ff']);
    expect(extract('Mat. 16:18 și 18:17')).toEqual(['Matt 16:18', 'Matt 18:17']);
  });

  it('accepts hyphen and en dash, cedilla spellings and a missing period before a colon', () => {
    expect(extract('Ex. 19:4-6')).toEqual(['Exod 19:4-6']);
    expect(extract('Mat 4:17')).toEqual(['Matt 4:17']);
    expect(extract('Țef. 3:17 şi Mat. 5:3 ş.urm.')).toEqual(['Zeph 3:17', 'Matt 5:3ff']);
  });

  it('reads single-chapter books, named chapters and bookless references', () => {
    expect(extract('Obad. 21; Ps. 97:1')).toEqual(['Obad 21', 'Ps 97:1']);
    expect(extract('Obad. 1:21')).toEqual(['Obad 21']);
    expect(extract('Mat. 13, Mc. 4. Lc. 8.')).toEqual(['Matt 13', 'Mark 4', 'Luke 8']);
    expect(extract('în celălalt pasaj, 18:36.')).toEqual(['18:36']);
  });

  it('lets v. inherit the last reference of the paragraph', () => {
    expect(extract('1 Cor. 15, unde spune „totul în toți”, v. 28, cf. Apoc. 11:15')).toEqual([
      '1Cor 15',
      '1Cor 15:28',
      'Rev 11:15',
    ]);
  });

  it('does not take ordinary Romanian text for references', () => {
    for (const text of [
      'În 3 zile a venit. Mica și Iov și Rut au plecat, iar Fapte sunt cunoscute.',
      'Anul 1903 a fost greu, la 12:30:15 nu s-a întâmplat nimic.',
      'Cartea lui Iuda este scurtă. Vezi mai jos Mat. și Mc. fără numere.',
      'Capitolul 5, versetul 3 și raportul 3.5:1.',
    ]) {
      expect(extract(text), text).toEqual([]);
    }
  });

  it('round-trips every run of the source through the Romanian rendering', () => {
    const samples = SPEC_EXAMPLES.map(([source]) => source).concat([
      'Is. xxiv. 21; xliii. 15; lii. 7; Mic. ii. 12; iv. 6; Obad. 21; Ps. xcvii. 1; xcix. 1',
      'Matt. xvi. 18 and xviii. 17',
      'Lk. vi. 32 35',
      'xxii. 1-14',
      'Matt. xiii',
      'Rev. i. 18',
    ]);
    for (const sample of samples) {
      for (const run of parseSourceReferences(sample)) {
        expect(extract(run.target), sample).toEqual(run.canonical);
      }
    }
  });
});

describe('compareReferences', () => {
  it('has no difference for equal multisets, whatever the order', () => {
    expect(compareReferences(['a', 'b', 'a'], ['a', 'a', 'b'])).toEqual({ missing: [], extra: [] });
  });

  it('counts repeated items as a multiset', () => {
    expect(compareReferences(['a', 'a', 'b'], ['a', 'b'])).toEqual({ missing: ['a'], extra: [] });
    expect(compareReferences(['a'], ['a', 'a'])).toEqual({ missing: [], extra: ['a'] });
  });

  it('lists missing items in source order and extra items in target order', () => {
    expect(compareReferences(['x', 'y', 'z'], ['q', 'y', 'p'])).toEqual({
      missing: ['x', 'z'],
      extra: ['q', 'p'],
    });
  });
});

describe('detectNonRomanianNotation', () => {
  it('flags roman numerals, English abbreviations and vs.', () => {
    expect(detectNonRomanianNotation('Vezi Matt. iv. 17 și Mat. iv. 17.')).toEqual([
      'Matt. iv. 17',
      'iv. 17',
    ]);
    expect(detectNonRomanianNotation('Vezi Jno. 3:16 și Mic. 2:12, John 3:16, Lk. 4:43.')).toEqual([
      'Jno. 3:16',
      'Mic. 2:12',
      'John 3:16',
      'Lk. 4:43',
    ]);
    expect(detectNonRomanianNotation('cf. Mc. 10:17, cu vs. 23')).toEqual(['vs. 23']);
    expect(detectNonRomanianNotation('Evr. 11:1 și Rev. 21:1 și Job 3:1')).toEqual([
      'Rev. 21:1',
      'Job 3:1',
    ]);
  });

  it('leaves valid Romanian notation alone, including abbreviations shared with English', () => {
    expect(
      detectNonRomanianNotation(
        'Mat. 4:17; Mc. 1:15; Lc. 4:43, In. 3:3, v. 5, vv. 7–9, Rom. 5:1, Ps. 23:1, Gen. 1:1, ' +
          '1 Cor. 15:23–28, Is. 53:5, Ex. 3:14, Amos 5:24, Dan. 7:13, Obad. 21.',
      ),
    ).toEqual([]);
  });
});

describe('findUnparsedReferenceFragments', () => {
  it('is empty when every reference-like fragment parsed', () => {
    expect(
      findUnparsedReferenceFragments(
        'See Matt. iv. 17; Mk. i. 15, and xviii. 36, vs. 4, Matt. xiii.',
      ),
    ).toEqual([]);
  });

  it('reports malformed references and numbers left after a run', () => {
    const text = 'Compare Matt. xi. 1903 and Lk. vi. 32 7 men or Rom. 5 and iv. x.';
    const found = findUnparsedReferenceFragments(text);
    expect(found.map((f) => f.text.slice(0, 14))).toEqual([
      'Matt. xi. 1903',
      '7 men or Rom. ',
      'Rom. 5 and iv.',
    ]);
  });

  it('reports a verse marker without a reference', () => {
    expect(
      findUnparsedReferenceFragments('the verses vv. 3 and so on').map((f) => f.index),
    ).toEqual([11]);
  });
});
