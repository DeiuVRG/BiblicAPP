import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildLibrary } from '../library/library';
import { loadPacks, loadTrustedKeys } from '../library/packs';
import { ASK_CONTENT_DIR, DEFAULT_KEYS_DIR, DEFAULT_PACKS_DIR } from '../paths';
import {
  GATES,
  evaluateGates,
  languageGap,
  parseEvalSet,
  runEval,
  serialiseReport,
  summarise,
} from './eval';
import type { EvalReport, QuestionResult } from './eval';

const setBytes = readFileSync(join(ASK_CONTENT_DIR, 'eval-v0.json'));
const set = parseEvalSet(JSON.parse(setBytes.toString('utf8')) as unknown);
const loaded = loadPacks(DEFAULT_PACKS_DIR, loadTrustedKeys(DEFAULT_KEYS_DIR).keys);
const library = buildLibrary(loaded.packs);
const options = { file: 'content/ask/eval-v0.json', bytes: setBytes, packs: loaded.packs };

/** One run is shared by the tests that only read it; the determinism test makes its own. */
let shared: Promise<EvalReport> | undefined;
const sharedRun = (): Promise<EvalReport> => (shared ??= runEval(library, set, options));

describe('the evaluation set v0', () => {
  it('has 20 Romanian and 20 English questions, numbered within their language', () => {
    expect(set.questions).toHaveLength(40);
    for (const language of ['ro', 'en'] as const) {
      const own = set.questions.filter((question) => question.language === language);
      expect(own.map((question) => question.id)).toEqual(
        Array.from({ length: 20 }, (_, i) => `${language}-${String(i + 1).padStart(2, '0')}`),
      );
    }
  });

  it('asks 14 subjects in both languages, so that the gap between them can be measured', () => {
    const topics = (language: string) =>
      new Set(set.questions.filter((q) => q.language === language).map((q) => q.topic));
    const shared = [...topics('ro')].filter((topic) => topics('en').has(topic));
    expect(shared).toHaveLength(14);
    for (const topic of shared) {
      const pair = set.questions.filter((q) => q.topic === topic);
      expect(pair.map((q) => q.language).sort()).toEqual(['en', 'ro']);
      // Same subject, same place in the book.
      expect(pair[0]!.expectedSectionOrdinals, topic).toEqual(pair[1]!.expectedSectionOrdinals);
      expect(pair[0]!.expectedWorkIds, topic).toEqual(pair[1]!.expectedWorkIds);
    }
  });

  it('expects only works and sections the installed library has', () => {
    for (const question of set.questions) {
      for (const workId of question.expectedWorkIds) {
        const work = library.worksById.get(workId);
        expect(work, `${question.id}: ${workId}`).toBeDefined();
        const source = work!.editions.find((edition) => edition.kind === 'source')!;
        for (const ordinal of question.expectedSectionOrdinals ?? []) {
          expect(ordinal, `${question.id}: section ${ordinal}`).toBeLessThan(source.sectionCount);
        }
      }
      expect(new Set(question.expectedSectionOrdinals ?? []).size).toBe(
        (question.expectedSectionOrdinals ?? []).length,
      );
    }
  });

  it('is written in the language it says: Romanian questions use Romanian letters or words', () => {
    for (const question of set.questions.filter((q) => q.language === 'ro')) {
      expect(question.question, question.id).toMatch(/[ăâîșț]|\b(ce|cum|de ce|care|este|are)\b/i);
      expect(question.question, question.id).not.toMatch(/[şţ]/);
    }
    for (const question of set.questions.filter((q) => q.language === 'en')) {
      expect(question.question, question.id).not.toMatch(/[ăâîșț]/);
    }
  });
});

describe('parseEvalSet', () => {
  const question = {
    id: 'en-01',
    language: 'en',
    topic: 'a-topic',
    question: 'Is it?',
    expectedWorkIds: ['W1'],
  };
  const wrap = (...questions: object[]) => ({ version: 0, description: 'x', questions });

  it('accepts a minimal set', () => {
    expect(parseEvalSet(wrap(question)).questions).toHaveLength(1);
  });

  it.each([
    ['a duplicate id', wrap(question, question)],
    ['an id of another language', wrap({ ...question, id: 'ro-01' })],
    ['a language that is not offered', wrap({ ...question, language: 'fr', id: 'fr-01' })],
    ['no expected work', wrap({ ...question, expectedWorkIds: [] })],
    ['an unknown key', wrap({ ...question, expected: 1 })],
    ['a topic asked twice in a language', wrap(question, { ...question, id: 'en-02' })],
    ['an empty question', wrap({ ...question, question: '   ' })],
    ['an empty list of sections', wrap({ ...question, expectedSectionOrdinals: [] })],
    ['a negative section', wrap({ ...question, expectedSectionOrdinals: [-1] })],
    ['another version', { ...wrap(question), version: 1 }],
  ])('refuses %s', (_label, json) => {
    expect(() => parseEvalSet(json)).toThrow(/Invalid evaluation set/);
  });
});

describe('the numbers', () => {
  const result = (overrides: Partial<QuestionResult>): QuestionResult => ({
    id: 'en-01',
    language: 'en',
    topic: 't',
    sources: 10,
    works: ['W'],
    sections: [1],
    shown: { en: 10 },
    expectedWorkHit: true,
    expectedSectionHit: true,
    firstExpectedRank: 1,
    citations: 2,
    invalidCitations: 0,
    quotations: { checked: 2, unverified: 0, uncited: 0 },
    stopReason: 'end_turn',
    ...overrides,
  });

  it('counts each check over the questions it applies to', () => {
    const summary = summarise([
      result({}),
      result({ firstExpectedRank: 3 }),
      result({ expectedSectionHit: false, firstExpectedRank: null }),
      result({ expectedSectionHit: null, firstExpectedRank: null }), // no expected section
      result({
        sources: 0,
        citations: 0,
        expectedWorkHit: false,
        expectedSectionHit: false,
        firstExpectedRank: null,
        stopReason: 'not_covered',
      }),
      result({ invalidCitations: 1 }),
      result({ quotations: { checked: 2, unverified: 1, uncited: 0 } }),
    ]);
    expect(summary.questions).toBe(7);
    expect(summary.sourcesPresent).toEqual({ passed: 6, total: 7, rate: 0.8571 });
    expect(summary.withCitation).toEqual({ passed: 6, total: 7, rate: 0.8571 });
    expect(summary.citationsInRange).toEqual({ passed: 6, total: 7, rate: 0.8571 });
    expect(summary.quotationsVerified).toEqual({ passed: 6, total: 7, rate: 0.8571 });
    expect(summary.expectedWorkHit.passed).toBe(6);
    // Six questions name a section (the fourth does not); four of them reach it, all in the first three.
    expect(summary.expectedSectionHit).toEqual({ passed: 4, total: 6, rate: 0.6667 });
    expect(summary.expectedSectionTop3.passed).toBe(4);
    // Reciprocal ranks of those six: 1, 1/3, 0, 0, 1, 1.
    expect(summary.sectionMrr).toBe(0.5556);
  });

  it('is zero, not NaN, for nothing', () => {
    const summary = summarise([]);
    expect(summary.sourcesPresent).toEqual({ passed: 0, total: 0, rate: 0 });
    expect(summary.sectionMrr).toBe(0);
  });

  it('compares the two languages on the subjects they share', () => {
    const gap = languageGap([
      result({ topic: 'a', language: 'en', expectedSectionHit: true }),
      result({ topic: 'a', language: 'ro', expectedSectionHit: true }),
      result({ topic: 'b', language: 'en', expectedSectionHit: true }),
      result({ topic: 'b', language: 'ro', expectedSectionHit: false }),
      result({ topic: 'c', language: 'en', expectedSectionHit: false }),
      result({ topic: 'c', language: 'ro', expectedSectionHit: true }),
      result({ topic: 'd', language: 'en', expectedSectionHit: false }),
      result({ topic: 'd', language: 'ro', expectedSectionHit: false }),
      result({ topic: 'e', language: 'en', expectedSectionHit: null }), // no section named
      result({ topic: 'e', language: 'ro', expectedSectionHit: true }),
      result({ topic: 'f', language: 'ro', expectedSectionHit: true }), // asked in one language only
    ]);
    expect(gap).toEqual({
      pairs: 4,
      bothHit: 1,
      onlyEnglishHit: 1,
      onlyRomanianHit: 1,
      neitherHit: 1,
    });
  });

  it('fails a gate that is below its threshold, and only that gate', () => {
    const good = result({});
    const bad = result({ citations: 0 });
    const all = [...Array.from({ length: 8 }, () => good), bad, bad]; // 80 % with a citation
    const gates = evaluateGates(summarise(all));
    expect(gates.map((gate) => [gate.name, gate.pass])).toEqual([
      ['sourcesPresent', true],
      ['withCitation', false],
      ['quotationsVerified', true],
    ]);
    expect(gates.find((gate) => gate.name === 'withCitation')).toMatchObject({
      value: 0.8,
      threshold: GATES.withCitation,
    });
  });
});

describe('running it', () => {
  it('passes the structural checks with the mock provider', async () => {
    const report = await sharedRun();
    expect(report.provider).toBe('mock');
    expect(report.questions).toHaveLength(40);
    const all = report.summary.all;
    for (const check of [
      'sourcesPresent',
      'withCitation',
      'citationsInRange',
      'quotationsVerified',
    ] as const) {
      expect(all[check], check).toMatchObject({ passed: 40, total: 40, rate: 1 });
    }
    expect(all.expectedWorkHit.rate).toBe(1);
    expect(report.ok).toBe(true);
    expect(report.gates.every((gate) => gate.pass)).toBe(true);
    // Every answer cites and quotes without inventing anything.
    for (const question of report.questions) {
      expect(question.stopReason, question.id).toBe('end_turn');
      expect(question.citations, question.id).toBeGreaterThanOrEqual(1);
      expect(question.quotations.unverified, question.id).toBe(0);
    }
  });

  it('finds its expected sections for most questions (a floor, not a target)', async () => {
    const all = (await sharedRun()).summary.all;
    expect(all.expectedSectionHit.rate).toBeGreaterThanOrEqual(0.85);
    expect(all.expectedSectionTop3.rate).toBeGreaterThanOrEqual(0.7);
  });

  it('gives the same report every time, with no timestamp, request id or score in it', async () => {
    const first = serialiseReport(await sharedRun());
    const second = serialiseReport(await runEval(library, set, options));
    expect(second).toBe(first);
    expect(first.endsWith('}\n')).toBe(true);
    expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/);
    expect(first).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    expect(first).not.toMatch(/"(?:score|time|timestamp|createdAt|requestId|durationMs)"/);
  });
});

describe('the committed report', () => {
  const committed = JSON.parse(
    readFileSync(join(ASK_CONTENT_DIR, 'eval-v0.report.json'), 'utf8'),
  ) as EvalReport;

  it('was made from the questions in the set: regenerate it when they change', async () => {
    const fresh = await sharedRun();
    expect(
      committed.evalSet,
      'content/ask/eval-v0.json changed: run `pnpm --filter @biblioteca/api eval` and commit the report',
    ).toEqual(fresh.evalSet);
  });

  it('is what a fresh run gives, as long as the packs are the ones it was made on', async () => {
    const fresh = await sharedRun();
    if (JSON.stringify(committed.library) !== JSON.stringify(fresh.library)) {
      // The content has moved on (a translation grew): not a failure, a reminder.
      console.warn(
        'content/ask/eval-v0.report.json was made on other packs than the installed ones: run `pnpm --filter @biblioteca/api eval` and commit the new report',
      );
      return;
    }
    expect(committed).toEqual(fresh);
    expect(readFileSync(join(ASK_CONTENT_DIR, 'eval-v0.report.json'), 'utf8')).toBe(
      serialiseReport(fresh),
    );
  });

  it('records the packs it was made on, by id, revision and hash', () => {
    expect(committed.library.packs.length).toBeGreaterThanOrEqual(2);
    for (const pack of committed.library.packs) {
      expect(pack.packId).toMatch(/^[a-z0-9-]+$/);
      expect(pack.revision).toBeGreaterThanOrEqual(1);
      expect(pack.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
