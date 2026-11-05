import { describe, expect, it } from 'vitest';

import {
  ALL_BOOKS,
  BOOKS,
  ENGLISH_BOOK_PATTERN,
  ENGLISH_TARGET_BOOK_PATTERN,
  LATIN_BOOK_PATTERN,
  ROMANIAN_BOOK_PATTERN,
  bookByCode,
  isEnglishName,
  lookupEnglishBook,
  lookupEnglishTargetBook,
  lookupLatinBook,
  lookupRomanianBook,
  sameRomanianAbbreviation,
} from './books';

// Section 5 of docs/traducere-pipeline.md, verbatim.
const SPEC_CODES =
  'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl ' +
  'Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke ' +
  'John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet ' +
  '1John 2John 3John Jude Rev';
const SPEC_ROMANIAN =
  'Gen. Ex. Lev. Num. Deut. Ios. Jud. Rut 1 Sam. 2 Sam. 1 Împ. 2 Împ. 1 Cron. 2 Cron. Ezra Neem. ' +
  'Est. Iov Ps. Prov. Ecl. Cânt. Is. Ier. Plâng. Ezec. Dan. Osea Ioel Amos Obad. Iona Mica Naum ' +
  'Hab. Țef. Hag. Zah. Mal. Mat. Mc. Lc. In. Fapte Rom. 1 Cor. 2 Cor. Gal. Ef. Fil. Col. 1 Tes. ' +
  '2 Tes. 1 Tim. 2 Tim. Tit Filim. Evr. Iac. 1 Pet. 2 Pet. 1 In. 2 In. 3 In. Iuda Apoc.';

describe('book table', () => {
  it('has the 66 books with the OSIS-like codes of the specification, in order', () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.map((b) => b.code).join(' ')).toBe(SPEC_CODES);
  });

  it('has the Romanian abbreviations of the specification, in the same order', () => {
    expect(BOOKS.map((b) => b.ro).join(' ')).toBe(SPEC_ROMANIAN);
  });

  it('marks exactly the single-chapter books', () => {
    expect(BOOKS.filter((b) => b.singleChapter).map((b) => b.code)).toEqual([
      'Obad',
      'Phlm',
      '2John',
      '3John',
      'Jude',
    ]);
  });

  it('knows the English names listed in the specification', () => {
    const names: [string, string][] = [
      ['Matt', 'Matt'],
      ['Matthew', 'Matt'],
      ['Mt', 'Matt'],
      ['Mk', 'Mark'],
      ['Mark', 'Mark'],
      ['Lk', 'Luke'],
      ['Luke', 'Luke'],
      ['Jno', 'John'],
      ['Jn', 'John'],
      ['John', 'John'],
      ['Is', 'Isa'],
      ['Isa', 'Isa'],
      ['Isaiah', 'Isa'],
      ['Rev', 'Rev'],
      ['Revelation', 'Rev'],
      ['Ex', 'Exod'],
      ['Exod', 'Exod'],
      ['Exodus', 'Exod'],
      ['Ps', 'Ps'],
      ['Psa', 'Ps'],
      ['Psalm', 'Ps'],
      ['Psalms', 'Ps'],
    ];
    for (const [name, code] of names) {
      expect(lookupEnglishBook(undefined, name)?.code, name).toBe(code);
      expect(new RegExp(`^(?:${ENGLISH_BOOK_PATTERN})$`).test(name), name).toBe(true);
    }
  });

  it('keeps the number of numbered books apart from the name', () => {
    expect(lookupEnglishBook('1', 'Cor')?.code).toBe('1Cor');
    expect(lookupEnglishBook('2', 'Corinthians')?.code).toBe('2Cor');
    expect(lookupEnglishBook('1', 'John')?.code).toBe('1John');
    expect(lookupEnglishBook(undefined, 'John')?.code).toBe('John');
    expect(lookupEnglishBook(undefined, 'Cor')).toBeUndefined();
    expect(lookupEnglishBook('3', 'Cor')).toBeUndefined();
    expect(lookupEnglishBook(undefined, 'Song of Solomon')?.code).toBe('Song');
  });

  it('looks up the Romanian abbreviations, with or without the period', () => {
    expect(lookupRomanianBook(undefined, 'Mat')?.code).toBe('Matt');
    expect(lookupRomanianBook('1', 'In')?.code).toBe('1John');
    expect(lookupRomanianBook(undefined, 'In')?.code).toBe('John');
    expect(lookupRomanianBook(undefined, 'Țef')?.code).toBe('Zeph');
    expect(lookupRomanianBook(undefined, 'Ţef')?.code).toBe('Zeph');
    expect(lookupRomanianBook(undefined, 'Matt')).toBeUndefined();
    expect(new RegExp(`^(?:${ROMANIAN_BOOK_PATTERN})$`, 'u').test('Împ')).toBe(true);
  });

  it('tells English abbreviations from Romanian ones', () => {
    const rom = lookupEnglishBook(undefined, 'Rom');
    const mic = lookupEnglishBook(undefined, 'Mic');
    if (!rom || !mic) throw new Error('fixture');
    expect(sameRomanianAbbreviation('Rom.', rom)).toBe(true);
    expect(sameRomanianAbbreviation('Mic.', mic)).toBe(false);
  });
});

// The standard English abbreviations of an English translation (Chicago style), in canonical order.
const SPEC_ENGLISH =
  'Gen. Exod. Lev. Num. Deut. Josh. Judg. Ruth 1 Sam. 2 Sam. 1 Kings 2 Kings 1 Chron. 2 Chron. ' +
  'Ezra Neh. Esther Job Ps. Prov. Eccles. Song of Sol. Isa. Jer. Lam. Ezek. Dan. Hosea Joel Amos ' +
  'Obad. Jonah Mic. Nah. Hab. Zeph. Hag. Zech. Mal. Matt. Mark Luke John Acts Rom. 1 Cor. 2 Cor. ' +
  'Gal. Eph. Phil. Col. 1 Thess. 2 Thess. 1 Tim. 2 Tim. Titus Philem. Heb. James 1 Pet. 2 Pet. ' +
  '1 John 2 John 3 John Jude Rev.';

describe('English notation of a translation', () => {
  it('renders the 66 books with the standard English abbreviations, in the same order', () => {
    expect(BOOKS.map((b) => b.en).join(' ')).toBe(SPEC_ENGLISH);
  });

  it('reads back every abbreviation it renders', () => {
    for (const book of ALL_BOOKS) {
      const numbered = /^([123]) (.+?)\.?$/.exec(book.en);
      const number = numbered?.[1];
      const name = numbered ? (numbered[2] ?? '') : book.en.replace(/\.$/, '');
      expect(lookupEnglishTargetBook(number, name)?.code, book.en).toBe(book.code);
      expect(isEnglishName(number, name), book.en).toBe(true);
      expect(
        new RegExp(`^(?:${ENGLISH_TARGET_BOOK_PATTERN})$`).test(name.replace(/ /g, ' ')),
        name,
      ).toBe(true);
    }
  });

  it('reads the full names and the old abbreviations too', () => {
    expect(lookupEnglishTargetBook(undefined, 'Matthew')?.code).toBe('Matt');
    expect(lookupEnglishTargetBook('1', 'Corinthians')?.code).toBe('1Cor');
    expect(lookupEnglishTargetBook(undefined, 'Song of Solomon')?.code).toBe('Song');
    expect(lookupEnglishTargetBook(undefined, 'Jno')?.code).toBe('John');
  });

  it('does not take Latin abbreviations for English ones', () => {
    for (const latin of [
      'Matth',
      'Marc',
      'Luc',
      'Ioh',
      'Joh',
      'Act',
      'Hebr',
      'Iac',
      'Apoc',
      'Thren',
    ]) {
      expect(isEnglishName(undefined, latin), latin).toBe(false);
    }
    expect(isEnglishName('1', 'Cor')).toBe(true);
    expect(isEnglishName('1', 'Reg')).toBe(false);
  });
});

describe('deuterocanonical books of the Vulgate', () => {
  it('are seven books after the 66, with codes, English and Romanian abbreviations', () => {
    const extras = ALL_BOOKS.slice(66);
    expect(ALL_BOOKS).toHaveLength(73);
    expect(extras.map((b) => b.code)).toEqual([
      'Tob',
      'Jdt',
      'Wis',
      'Sir',
      'Bar',
      '1Macc',
      '2Macc',
    ]);
    expect(extras.map((b) => b.en)).toEqual([
      'Tob.',
      'Jdt.',
      'Wis.',
      'Sir.',
      'Bar.',
      '1 Macc.',
      '2 Macc.',
    ]);
    expect(extras.map((b) => b.ro)).toEqual([
      'Tob.',
      'Iudt.',
      'Înț.',
      'Sir.',
      'Bar.',
      '1 Mac.',
      '2 Mac.',
    ]);
    expect(bookByCode('Wis')?.en).toBe('Wis.');
    expect(bookByCode('Nope')).toBeUndefined();
  });

  it('are read in a Romanian and an English translation but not in an English source', () => {
    expect(lookupRomanianBook(undefined, 'Înț')?.code).toBe('Wis');
    expect(lookupRomanianBook(undefined, 'Înţ')?.code).toBe('Wis');
    expect(lookupRomanianBook('1', 'Mac')?.code).toBe('1Macc');
    expect(lookupEnglishTargetBook(undefined, 'Sirach')?.code).toBe('Sir');
    expect(lookupEnglishTargetBook('2', 'Macc')?.code).toBe('2Macc');
    expect(lookupEnglishBook(undefined, 'Sirach')).toBeUndefined();
    expect(lookupEnglishBook(undefined, 'Wisdom')).toBeUndefined();
    expect(new RegExp(`^(?:${ENGLISH_BOOK_PATTERN})$`).test('Wisdom')).toBe(false);
    expect(new RegExp(`^(?:${ENGLISH_TARGET_BOOK_PATTERN})$`).test('Wisdom')).toBe(true);
  });
});

describe('Latin names of the Vulgate', () => {
  const code = (number: string | undefined, name: string) =>
    lookupLatinBook(number, name)?.book.code;

  // Every abbreviation of the specification of P1-C2, with the code it must give.
  const SPEC: [string | undefined, string, string][] = [
    [undefined, 'Matth', 'Matt'],
    [undefined, 'Marc', 'Mark'],
    [undefined, 'Luc', 'Luke'],
    [undefined, 'Ioh', 'John'],
    [undefined, 'Joh', 'John'],
    [undefined, 'Act', 'Acts'],
    [undefined, 'Rom', 'Rom'],
    ['1', 'Cor', '1Cor'],
    ['2', 'Cor', '2Cor'],
    [undefined, 'Gal', 'Gal'],
    [undefined, 'Eph', 'Eph'],
    [undefined, 'Ephes', 'Eph'],
    [undefined, 'Phil', 'Phil'],
    [undefined, 'Philipp', 'Phil'],
    [undefined, 'Col', 'Col'],
    [undefined, 'Coloss', 'Col'],
    ['1', 'Thess', '1Thess'],
    ['2', 'Thessal', '2Thess'],
    ['1', 'Tim', '1Tim'],
    ['2', 'Tim', '2Tim'],
    [undefined, 'Tit', 'Titus'],
    [undefined, 'Hebr', 'Heb'],
    [undefined, 'Iac', 'Jas'],
    [undefined, 'Jac', 'Jas'],
    ['1', 'Petr', '1Pet'],
    ['2', 'Petr', '2Pet'],
    [undefined, 'Iud', 'Jude'],
    [undefined, 'Jud', 'Jude'],
    [undefined, 'Apoc', 'Rev'],
    [undefined, 'Gen', 'Gen'],
    [undefined, 'Exod', 'Exod'],
    [undefined, 'Lev', 'Lev'],
    [undefined, 'Num', 'Num'],
    [undefined, 'Deut', 'Deut'],
    [undefined, 'Ios', 'Josh'],
    [undefined, 'Jos', 'Josh'],
    [undefined, 'Iudic', 'Judg'],
    [undefined, 'Judic', 'Judg'],
    [undefined, 'Ruth', 'Ruth'],
    ['1', 'Reg', '1Sam'],
    ['2', 'Reg', '2Sam'],
    ['3', 'Reg', '1Kgs'],
    ['4', 'Reg', '2Kgs'],
    ['1', 'Par', '1Chr'],
    ['2', 'Paral', '2Chr'],
    [undefined, 'Esdr', 'Ezra'],
    ['1', 'Esdr', 'Ezra'],
    ['2', 'Esdr', 'Neh'],
    [undefined, 'Neh', 'Neh'],
    [undefined, 'Tob', 'Tob'],
    [undefined, 'Iudith', 'Jdt'],
    [undefined, 'Esth', 'Esth'],
    [undefined, 'Iob', 'Job'],
    [undefined, 'Job', 'Job'],
    [undefined, 'Ps', 'Ps'],
    [undefined, 'Psal', 'Ps'],
    [undefined, 'Prov', 'Prov'],
    [undefined, 'Eccl', 'Eccl'],
    [undefined, 'Eccle', 'Eccl'],
    [undefined, 'Cant', 'Song'],
    [undefined, 'Sap', 'Wis'],
    [undefined, 'Eccli', 'Sir'],
    [undefined, 'Sir', 'Sir'],
    [undefined, 'Is', 'Isa'],
    [undefined, 'Isa', 'Isa'],
    [undefined, 'Ier', 'Jer'],
    [undefined, 'Jer', 'Jer'],
    [undefined, 'Thren', 'Lam'],
    [undefined, 'Bar', 'Bar'],
    [undefined, 'Ezech', 'Ezek'],
    [undefined, 'Dan', 'Dan'],
    [undefined, 'Os', 'Hos'],
    [undefined, 'Osee', 'Hos'],
    [undefined, 'Ioel', 'Joel'],
    [undefined, 'Am', 'Amos'],
    [undefined, 'Abd', 'Obad'],
    [undefined, 'Ion', 'Jonah'],
    [undefined, 'Mich', 'Mic'],
    [undefined, 'Nah', 'Nah'],
    [undefined, 'Hab', 'Hab'],
    [undefined, 'Soph', 'Zeph'],
    [undefined, 'Agg', 'Hag'],
    [undefined, 'Zach', 'Zech'],
    [undefined, 'Mal', 'Mal'],
    ['1', 'Mach', '1Macc'],
    ['2', 'Mach', '2Macc'],
    ['1', 'Ioh', '1John'],
    ['2', 'Joh', '2John'],
    ['3', 'Ioh', '3John'],
  ];

  it.each(SPEC)('%s %s is %s', (number, name, expected) => {
    expect(code(number, name)).toBe(expected);
    expect(new RegExp(`^(?:${LATIN_BOOK_PATTERN})$`).test(name), name).toBe(true);
  });

  it('gives every canonical code to some Latin name, the 66 books and the Vulgate extras', () => {
    const reached = new Set<string>();
    for (const [number, name] of SPEC.map(([n, name]) => [n, name] as const)) {
      const found = lookupLatinBook(number, name);
      if (found) reached.add(found.book.code);
    }
    reached.add(lookupLatinBook(undefined, 'Philem')?.book.code ?? '');
    reached.add(lookupLatinBook('1', 'Mach')?.book.code ?? '');
    for (const book of ALL_BOOKS) expect(reached.has(book.code), book.code).toBe(true);
  });

  it('needs the number of a numbered book, and rejects a number the book does not have', () => {
    expect(code(undefined, 'Cor')).toBeUndefined();
    expect(code(undefined, 'Reg')).toBeUndefined();
    expect(code(undefined, 'Par')).toBeUndefined();
    expect(code('3', 'Cor')).toBeUndefined();
    expect(code('5', 'Reg')).toBeUndefined();
    expect(code('1', 'Rom')).toBeUndefined();
    expect(code('3', 'Esdr')).toBeUndefined();
  });

  it('keeps the numbering of the Vulgate: marks psalms, Kings and Esdras, and says so', () => {
    expect(lookupLatinBook(undefined, 'Ps')).toMatchObject({ vulgate: true });
    expect(lookupLatinBook(undefined, 'Ps')?.note).toMatch(
      /Vulgate psalm numbering.*do not renumber/,
    );
    for (const number of ['1', '2', '3', '4']) {
      expect(lookupLatinBook(number, 'Reg')?.vulgate, number).toBe(true);
    }
    expect(lookupLatinBook('3', 'Reg')?.note).toMatch(/3 and 4 Reg\. are 1 and 2 Kings/);
    expect(lookupLatinBook('2', 'Esdr')?.vulgate).toBe(true);
    expect(lookupLatinBook('2', 'Esdr')?.note).toMatch(/2 Esdr\. is Nehemiah/);
    // Paralipomenon is only another name of Chronicles
    expect(lookupLatinBook('1', 'Par')).toMatchObject({ vulgate: false });
    expect(lookupLatinBook('1', 'Par')?.note).toBeUndefined();
    expect(lookupLatinBook(undefined, 'Rom')?.vulgate).toBe(false);
  });

  it('warns that Iud./Jud. is Jude and not Judges', () => {
    expect(lookupLatinBook(undefined, 'Iud')?.note).toMatch(/Epistle of Jude.*Judges is Iudic/);
    expect(lookupLatinBook(undefined, 'Iudic')?.note).toBeUndefined();
    expect(lookupLatinBook(undefined, 'Iud')?.book.singleChapter).toBe(true);
    expect(lookupLatinBook(undefined, 'Iudic')?.book.singleChapter).toBe(false);
  });

  it('is case sensitive and has no entry for ambiguous short forms', () => {
    expect(code(undefined, 'matth')).toBeUndefined();
    for (const name of ['Ez', 'Jo', 'Ap', 'Mr', 'Ro'])
      expect(code(undefined, name), name).toBeUndefined();
  });
});
