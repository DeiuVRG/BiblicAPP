import { describe, expect, it } from 'vitest';

import {
  BOOKS,
  ENGLISH_BOOK_PATTERN,
  ROMANIAN_BOOK_PATTERN,
  lookupEnglishBook,
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
