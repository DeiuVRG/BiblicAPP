import { describe, expect, it } from 'vitest';

import {
  BOOK_CODES,
  cutRanges,
  extractReferences,
  lookupBook,
  parseReferences,
  parseRoman,
  refKey,
  refMatchWeight,
} from './scripture';

const refs = (text: string, language?: 'en' | 'ro' | 'any') =>
  extractReferences(text, language !== undefined ? { language } : {}).map(refKey);

describe('book names', () => {
  it('knows 66 books and no name belongs to two of them', () => {
    expect(BOOK_CODES).toHaveLength(66);
    for (const language of ['en', 'ro', 'any'] as const) {
      // Building the matcher throws or silently shadows on a clash; look every name up and
      // check that it comes back to the book that lists it.
      expect(lookupBook('Matthew', language) ?? lookupBook('Matei', language)).toBe('Matt');
    }
    expect(lookupBook('Matt.')).toBe('Matt');
    expect(lookupBook('Matei')).toBe('Matt');
    expect(lookupBook('Mat.')).toBe('Matt');
    expect(lookupBook('1 Corinteni')).toBe('1Cor');
    expect(lookupBook('I Corinthians')).toBe('1Cor');
    expect(lookupBook('Faptele Apostolilor')).toBe('Acts');
    expect(lookupBook('Cântarea Cântărilor')).toBe('Song');
    expect(lookupBook('Cantarea Cantarilor')).toBe('Song');
  });
});

describe('the same reference in English, Romanian and old-style notation', () => {
  it.each([
    ['Mat. 4:17', 'Matt 4:17'],
    ['Matthew 4:17', 'Matt 4:17'],
    ['Matei 4:17', 'Matt 4:17'],
    ['matei 4:17', 'Matt 4:17'],
    ['Matt. iv. 17', 'Matt 4:17'],
    ['Mt 4.17', 'Matt 4:17'],
    ['Ioan 3,16', 'John 3:16'],
    ['Jno. iii. 16', 'John 3:16'],
    ['In. 3:16', 'John 3:16'],
    ['Evrei 11:1', 'Heb 11:1'],
    ['1 Împ. 3:5', '1Kgs 3:5'],
    ['1 Cor. xv. 22', '1Cor 15:22'],
    ['I Corinthians 13:4-7', '1Cor 13:4-7'],
    ['Psalm 23', 'Ps 23'],
    ['Psalmul 23:1', 'Ps 23:1'],
    ['Rom 8', 'Rom 8'],
    ['Apocalipsa 21:1-4', 'Rev 21:1-4'],
  ])('%s -> %s', (text, expected) => {
    expect(refs(text).join(' | ')).toBe(expected);
  });

  it('reads runs of references the way the texts write them', () => {
    expect(refs('Matt. iv. 17; Mk. i. 15; Lk. iv. 43.')).toEqual([
      'Matt 4:17',
      'Mark 1:15',
      'Luke 4:43',
    ]);
    expect(refs('Jno. iii. 3, 5; xviii. 36')).toEqual(['John 3:3', 'John 3:5', 'John 18:36']);
    expect(refs('In. 3:3, 5; 18:36', 'ro')).toEqual(['John 3:3', 'John 3:5', 'John 18:36']);
    expect(refs('Mat. 4:17; Mc. 1:15; Lc. 4:43', 'ro')).toEqual([
      'Matt 4:17',
      'Mark 1:15',
      'Luke 4:43',
    ]);
    expect(refs('Matt. v. 3, vi. 5')).toEqual(['Matt 5:3', 'Matt 6:5']);
    expect(refs('Rom. v. 12, 1 Cor. xv. 22')).toEqual(['Rom 5:12', '1Cor 15:22']);
    expect(refs('Matt. xiii')).toEqual(['Matt 13']);
  });

  it('expands chapter ranges and treats single-chapter books as verses', () => {
    expect(refs('Matei 5-7')).toEqual(['Matt 5', 'Matt 6', 'Matt 7']);
    expect(refs('Jude 5')).toEqual(['Jude 1:5']);
    expect(refs('Iuda 1:5-7')).toEqual(['Jude 1:5-7']);
  });

  it('reports where the reference sits so that it can be cut out of the question', () => {
    const question = 'Ce înseamnă Mat. 4:17 pentru noi?';
    const { text, refs: found } = parseReferences(question);
    expect(found).toHaveLength(1);
    expect(text.slice(found[0]?.start, found[0]?.end)).toBe('Mat. 4:17');
    expect(cutRanges(text, found).replace(/\s+/g, ' ')).toBe('Ce înseamnă pentru noi?');
  });
});

describe('what is not a reference', () => {
  it.each([
    'there were numbers 5 and 6',
    'we met in 3 days',
    'in 1903 the book appeared',
    'the job 3 people did',
    'Mark I think so',
    'is 5 enough',
    'est 3',
    'what about chapter 4',
  ])('%s', (text) => {
    expect(refs(text)).toEqual([]);
  });

  it('lets ambiguous names in only with a capital and a verse', () => {
    expect(refs('Job 3:1')).toEqual(['Job 3:1']);
    expect(refs('job 3:1')).toEqual([]);
    expect(refs('Job 3')).toEqual([]);
    expect(refs('Is. liii. 5')).toEqual(['Isa 53:5']);
  });

  it('rejects chapters and verses out of range', () => {
    expect(refs('Matt 400:1')).toEqual([]);
    // A verse that cannot exist leaves the chapter, which is still a fair thing to look for.
    expect(refs('Matt 4:999')).toEqual(['Matt 4']);
    expect(parseRoman('iiii')).toBeNull();
    expect(parseRoman('ic')).toBeNull();
    expect(parseRoman('xviii')).toBe(18);
    expect(parseRoman('cl')).toBe(150);
    expect(parseRoman('cli')).toBeNull();
  });
});

describe('matching', () => {
  const verse = (book: string, chapter: number, from: number, to = from) => ({
    book,
    chapter,
    from,
    to,
  });
  const chapter = (book: string, c: number) => ({ book, chapter: c, from: null, to: null });

  it('weighs the same verse above the same chapter above nothing', () => {
    expect(refMatchWeight(verse('Matt', 4, 17), verse('Matt', 4, 17))).toBe(1);
    expect(refMatchWeight(verse('Matt', 4, 17), verse('Matt', 4, 15, 20))).toBe(1);
    expect(refMatchWeight(verse('Matt', 4, 17), chapter('Matt', 4))).toBeCloseTo(0.35);
    expect(refMatchWeight(verse('Matt', 4, 17), verse('Matt', 4, 1))).toBeCloseTo(0.2);
    expect(refMatchWeight(chapter('Matt', 4), verse('Matt', 4, 1))).toBeCloseTo(0.6);
    expect(refMatchWeight(chapter('Matt', 4), chapter('Matt', 4))).toBe(1);
    expect(refMatchWeight(verse('Matt', 4, 17), verse('Matt', 5, 17))).toBe(0);
    expect(refMatchWeight(verse('Matt', 4, 17), verse('Mark', 4, 17))).toBe(0);
  });
});
