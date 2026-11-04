import { describe, expect, it } from 'vitest';

import {
  loadRealLibrary,
  syntheticLibrary,
  syntheticTwoWorkLibrary,
  testApp,
} from '../test-support';
import { resolveScope } from './scope';

const library = loadRealLibrary();
const work = library.works[0]!;
const en = work.editions.find((edition) => edition.language === 'en')!;
const ro = work.editions.find((edition) => edition.language === 'ro')!;
const paragraph = en.paragraphs[5]!;

describe('resolveScope', () => {
  it('leaves everything open when the request says nothing', () => {
    expect(resolveScope(library, {})).toEqual({ ok: true });
  });

  it('keeps the editions it knows and refuses a list with none', () => {
    expect(resolveScope(library, { editionIds: ['NOPE', en.editionId] })).toEqual({
      ok: true,
      editionIds: [en.editionId],
    });
    expect(resolveScope(library, { editionIds: ['NOPE'] })).toMatchObject({
      ok: false,
      code: 'unknown_editions',
    });
  });

  it('turns a work into its editions', () => {
    const result = resolveScope(library, { scope: { workId: work.work.id } });
    expect(result).toMatchObject({ ok: true });
    expect(new Set((result as { editionIds: string[] }).editionIds)).toEqual(
      new Set([en.editionId, ro.editionId]),
    );
    expect(resolveScope(library, { scope: { workId: 'NO_SUCH_WORK' } })).toMatchObject({
      ok: false,
      code: 'unknown_editions',
      message: expect.stringContaining('scope.workId'),
    });
  });

  it('narrows the editions of the work by editionIds, and refuses when nothing is left', () => {
    expect(
      resolveScope(library, { scope: { workId: work.work.id }, editionIds: [ro.editionId, 'x'] }),
    ).toEqual({ ok: true, editionIds: [ro.editionId] });
    expect(
      resolveScope(library, { scope: { workId: work.work.id }, editionIds: ['x'] }),
    ).toMatchObject({ ok: false, code: 'unknown_editions' });
  });

  it('finds the passage in the edition that is named', () => {
    const result = resolveScope(library, {
      passage: { editionId: en.editionId, paragraphId: paragraph.id },
    });
    expect(result).toMatchObject({ ok: true });
    expect((result as { passage: unknown }).passage).toBe(paragraph);
    // Alongside the scope of its own work.
    expect(
      resolveScope(library, {
        scope: { workId: work.work.id },
        passage: { editionId: en.editionId, paragraphId: paragraph.id },
      }),
    ).toMatchObject({ ok: true });
  });

  it.each([
    ['an unknown paragraph', { editionId: en.editionId, paragraphId: 'NOPE' }],
    ['a paragraph of another edition', { editionId: ro.editionId, paragraphId: paragraph.id }],
    ['an unknown edition', { editionId: 'NOPE', paragraphId: paragraph.id }],
  ])('refuses %s', (_label, passage) => {
    expect(resolveScope(library, { passage })).toMatchObject({
      ok: false,
      code: 'unknown_passage',
    });
  });

  it('accepts a passage that an allowed edition carries in another version', () => {
    // Chapter I is translated: the English paragraph can be read in the Romanian edition.
    const aligned = en.paragraphs.find((p) => p.sectionOrdinal === 0)!;
    expect(
      resolveScope(library, {
        editionIds: [ro.editionId],
        passage: { editionId: en.editionId, paragraphId: aligned.id },
      }),
    ).toMatchObject({ ok: true, editionIds: [ro.editionId] });
  });
});

describe('resolveScope on a library whose translation is partial by construction', () => {
  const small = syntheticLibrary();

  it('refuses a passage that none of the allowed editions carries, and accepts one that does', () => {
    // EN-P3 is not translated: restricted to the Romanian edition it cannot be shown.
    expect(
      resolveScope(small, {
        editionIds: ['ED-RO'],
        passage: { editionId: 'ED-EN', paragraphId: 'EN-P3' },
      }),
    ).toMatchObject({ ok: false, code: 'unknown_passage' });
    expect(
      resolveScope(small, {
        editionIds: ['ED-RO'],
        passage: { editionId: 'ED-EN', paragraphId: 'EN-P2' },
      }),
    ).toMatchObject({ ok: true, editionIds: ['ED-RO'] });
    expect(
      resolveScope(small, {
        scope: { workId: 'WORK1' },
        passage: { editionId: 'ED-EN', paragraphId: 'EN-P3' },
      }),
    ).toMatchObject({ ok: true });
  });

  it('refuses a heading: it is structure, not a passage of text', () => {
    expect(
      resolveScope(small, { passage: { editionId: 'ED-EN', paragraphId: 'EN-H1' } }),
    ).toMatchObject({
      ok: false,
      code: 'unknown_passage',
      message: expect.stringContaining('heading'),
    });
  });
});

describe('scope on a library of two works', () => {
  // The real packs hold one work, so there "limited to one work" and "not limited" look the same.
  // Here WORK1 (English with a partial Romanian translation) and WORK2 (English only) both speak
  // of the kingdom of God, so every question about it finds passages in both until a scope says
  // otherwise.
  const two = syntheticTwoWorkLibrary();
  const editionsOf = (result: ReturnType<typeof resolveScope>) =>
    new Set((result as { editionIds?: string[] }).editionIds);

  it('has two works and three editions', () => {
    expect(two.works.map((entry) => entry.work.id)).toEqual(['WORK1', 'WORK2']);
    expect([...two.editions.keys()].sort()).toEqual(['ED-EN', 'ED-RO', 'ED2-EN']);
  });

  describe('resolveScope', () => {
    it('turns each work into its own editions and none of the other', () => {
      expect(editionsOf(resolveScope(two, { scope: { workId: 'WORK1' } }))).toEqual(
        new Set(['ED-EN', 'ED-RO']),
      );
      expect(editionsOf(resolveScope(two, { scope: { workId: 'WORK2' } }))).toEqual(
        new Set(['ED2-EN']),
      );
      expect(resolveScope(two, {})).toEqual({ ok: true }); // no scope: everything
    });

    it('narrows editionIds by the work, and refuses editions that belong to the other one', () => {
      expect(
        resolveScope(two, { scope: { workId: 'WORK2' }, editionIds: ['ED-EN', 'ED2-EN'] }),
      ).toEqual({ ok: true, editionIds: ['ED2-EN'] });
      expect(
        resolveScope(two, { scope: { workId: 'WORK1' }, editionIds: ['ED2-EN'] }),
      ).toMatchObject({
        ok: false,
        code: 'unknown_editions',
        message: expect.stringContaining('belongs to the work'),
      });
    });

    it('keeps a passage inside the work the request is limited to', () => {
      const ofWork2 = { editionId: 'ED2-EN', paragraphId: 'EN2-P2' };
      expect(resolveScope(two, { scope: { workId: 'WORK1' }, passage: ofWork2 })).toMatchObject({
        ok: false,
        code: 'unknown_passage',
      });
      expect(resolveScope(two, { editionIds: ['ED-EN'], passage: ofWork2 })).toMatchObject({
        ok: false,
        code: 'unknown_passage',
      });
      expect(resolveScope(two, { scope: { workId: 'WORK2' }, passage: ofWork2 })).toMatchObject({
        ok: true,
        editionIds: ['ED2-EN'],
      });
      expect(resolveScope(two, { passage: ofWork2 })).toMatchObject({ ok: true }); // no scope
    });
  });

  describe('POST /v1/ask over the two works', () => {
    const app = testApp(two, { RATE_LIMIT_MAX: '1000' });
    const QUESTION = { question: 'What is the kingdom of God?', language: 'en' };
    interface Answer {
      sources: Array<{ workId: string; editionId: string; paragraphId: string }>;
      stopReason: string;
    }
    const ask = (body: Record<string, unknown>) =>
      app.request('/v1/ask?stream=false', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...QUESTION, ...body }),
      });
    const answered = async (body: Record<string, unknown>): Promise<Answer> => {
      const response = await ask(body);
      expect(response.status).toBe(200);
      return (await response.json()) as Answer;
    };
    const works = (answer: Answer) => new Set(answer.sources.map((source) => source.workId));

    it('searches both works when the request names no scope', async () => {
      const answer = await answered({});
      expect(works(answer)).toEqual(new Set(['WORK1', 'WORK2']));
      expect(answer.sources).toHaveLength(6);
    });

    it('searches only the work named by scope.workId, whichever it is', async () => {
      const first = await answered({ scope: { workId: 'WORK1' } });
      expect(works(first)).toEqual(new Set(['WORK1']));
      expect(first.sources).toHaveLength(3);
      const second = await answered({ scope: { workId: 'WORK2' } });
      expect(works(second)).toEqual(new Set(['WORK2']));
      expect(second.sources.map((source) => source.paragraphId).sort()).toEqual([
        'EN2-P1',
        'EN2-P2',
        'EN2-P3',
      ]);
    });

    it('keeps a Romanian question inside the work too (the other language is no way out)', async () => {
      const answer = await answered({
        question: 'Ce este împărăția lui Dumnezeu?',
        language: 'ro',
        scope: { workId: 'WORK2' },
      });
      expect(works(answer)).toEqual(new Set(['WORK2'])); // found through the glossary, in English
    });

    it('answers unknown_editions for a work the library does not have, with the request id', async () => {
      const response = await ask({ scope: { workId: 'WORK3' } });
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: { code: string; requestId: string } };
      expect(body.error.code).toBe('unknown_editions');
      expect(body.error.requestId).toBe(response.headers.get('x-request-id'));
    });

    it('with a passage and no scope: the passage first, its neighbours next, the rest of the library after', async () => {
      const answer = await answered({
        passage: { editionId: 'ED2-EN', paragraphId: 'EN2-P2' },
      });
      expect(answer.sources.slice(0, 3).map((source) => source.paragraphId)).toEqual([
        'EN2-P2',
        'EN2-P1',
        'EN2-P3',
      ]);
      expect(works(answer)).toEqual(new Set(['WORK1', 'WORK2'])); // the global top-up
      expect(answer.sources).toHaveLength(6);
    });

    it('with a passage and its own work as scope: the top-up stays in the work', async () => {
      const answer = await answered({
        scope: { workId: 'WORK2' },
        passage: { editionId: 'ED2-EN', paragraphId: 'EN2-P2' },
      });
      expect(answer.sources.map((source) => source.paragraphId)).toEqual([
        'EN2-P2',
        'EN2-P1',
        'EN2-P3',
      ]);
    });

    it('refuses a passage of the other work when a scope is named: unknown_passage, not a quiet fallback', async () => {
      const response = await ask({
        scope: { workId: 'WORK1' },
        passage: { editionId: 'ED2-EN', paragraphId: 'EN2-P2' },
      });
      expect(response.status).toBe(400);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
        'unknown_passage',
      );
    });
  });
});
