import { describe, expect, it } from 'vitest';

import { Bm25Index } from './bm25';

const docs = [
  ['kingdom', 'heaven', 'kingdom'],
  ['kingdom', 'god', 'rule', 'rule', 'rule', 'rule', 'rule', 'rule'],
  ['grace', 'faith'],
  ['faith'],
];

describe('Bm25Index', () => {
  const index = new Bm25Index(docs);

  it('ranks by term frequency and rarity', () => {
    const hits = index.search(['kingdom', 'heaven']);
    expect([...hits.keys()].sort()).toEqual([0, 1]);
    expect(hits.get(0)!.score).toBeGreaterThan(hits.get(1)!.score);
  });

  it('weighs a rare term above a common one', () => {
    expect(index.idf('grace')!).toBeGreaterThan(index.idf('faith')!);
    expect(index.idf('missing')).toBeNull();
    expect(index.documentFrequency('faith')).toBe(2);
  });

  it('normalises for document length', () => {
    // Same single occurrence of "faith": the shorter document scores higher.
    const hits = index.search(['faith']);
    expect(hits.get(3)!.score).toBeGreaterThan(hits.get(2)!.score);
  });

  it('adds up the idf of the matched terms for coverage checks', () => {
    const hit = index.search(['kingdom', 'heaven']).get(0)!;
    expect(hit.matchedIdf).toBeCloseTo(index.idf('kingdom')! + index.idf('heaven')!);
  });

  it('lets a term count for less when it comes with a weight', () => {
    const full = index.search(new Map([['kingdom', 1]])).get(0)!.score;
    const half = index.search(new Map([['kingdom', 0.5]])).get(0)!.score;
    expect(half).toBeCloseTo(full / 2, 10);
    // A list is a map in which every term weighs 1.
    expect(index.search(new Map([['kingdom', 1]])).get(0)!.score).toBe(
      index.search(['kingdom']).get(0)!.score,
    );
    // A synonym adds to a document that has it without outweighing the word itself.
    const withSynonym = index.search(
      new Map([
        ['kingdom', 1],
        ['heaven', 0.5],
      ]),
    );
    expect(withSynonym.get(0)!.score).toBeCloseTo(
      full + index.search(new Map([['heaven', 0.5]])).get(0)!.score,
      10,
    );
    expect(withSynonym.get(1)!.score).toBeCloseTo(index.search(['kingdom']).get(1)!.score, 10);
  });

  it('skips documents the caller does not accept', () => {
    const hits = index.search(['kingdom'], (doc) => doc !== 0);
    expect([...hits.keys()]).toEqual([1]);
  });

  it('counts a repeated query term once and copes with an empty index', () => {
    expect(index.search(['kingdom', 'kingdom']).get(0)!.score).toBe(
      index.search(['kingdom']).get(0)!.score,
    );
    expect(new Bm25Index([]).search(['x']).size).toBe(0);
  });
});
