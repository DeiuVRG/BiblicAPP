import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { sourceSectionOrdinal } from './library/library';
import type { RunningServer } from './main';
import { ASK_CONTENT_DIR } from './paths';
import { loadRealLibrary, postAsk, startTestServer } from './test-support';

// The suggestions of the Ask welcome screen (content/ask/suggestions.<lang>.json, bundled by the
// app). A suggestion the library cannot answer is a broken promise, so every one goes through the
// gateway with the mock provider and must come back with passages of the work it is about.

const SuggestionSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** The three groups of the welcome screen (docs/ui-spec-v2.md 9.3). */
  group: z.enum(['doctrine', 'idea', 'passage']),
  text: z.string().trim().min(10).max(200),
  scope: z.union([
    z.literal('library'),
    z.strictObject({ workId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }),
  ]),
});
type Suggestion = z.infer<typeof SuggestionSchema>;

const LANGUAGES = ['ro', 'en'] as const;

function load(language: (typeof LANGUAGES)[number]): Suggestion[] {
  const file = join(ASK_CONTENT_DIR, `suggestions.${language}.json`);
  return z.array(SuggestionSchema).parse(JSON.parse(readFileSync(file, 'utf8')) as unknown);
}

/** What each suggestion is about: the work it should reach and the chapters that answer it (0-based). */
const EXPECTED: Record<string, { work: string; sections: number[] }> = {
  'kingdom-church': { work: 'vos-1903-kingdom', sections: [8] },
  'present-future': { work: 'vos-1903-kingdom', sections: [3, 4] },
  righteousness: { work: 'vos-1903-kingdom', sections: [6] },
  'repentance-faith': { work: 'vos-1903-kingdom', sections: [9] },
  'old-testament': { work: 'vos-1903-kingdom', sections: [1] },
  'john-synoptics': { work: 'vos-1903-kingdom', sections: [0, 4, 8] },
  'sermon-on-the-mount': { work: 'vos-1903-kingdom', sections: [0, 3, 6] },
  parables: { work: 'vos-1903-kingdom', sections: [3, 4, 8] },
};

const library = loadRealLibrary();
const workIdOf = (slug: string): string =>
  library.works.find((entry) => entry.work.slug === slug)!.work.id;

describe('the suggestion files', () => {
  const byLanguage = Object.fromEntries(LANGUAGES.map((language) => [language, load(language)]));

  it.each(LANGUAGES)('%s: has 8 suggestions with the expected subjects', (language) => {
    const suggestions = byLanguage[language]!;
    expect(suggestions).toHaveLength(8);
    expect(suggestions.map((s) => s.id).sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(new Set(suggestions.map((s) => s.text)).size).toBe(8);
  });

  it.each(LANGUAGES)(
    '%s: covers the three groups of the welcome screen, two prompts at least',
    (language) => {
      const counts = new Map<string, number>();
      for (const s of byLanguage[language]!) counts.set(s.group, (counts.get(s.group) ?? 0) + 1);
      expect([...counts.keys()].sort()).toEqual(['doctrine', 'idea', 'passage']);
      for (const [group, count] of counts) expect(count, group).toBeGreaterThanOrEqual(2);
    },
  );

  it('keeps the two languages in step: same ids, groups, scopes and order', () => {
    const strip = (list: Suggestion[]) =>
      list.map(({ id, group, scope }) => ({ id, group, scope }));
    expect(strip(byLanguage.ro!)).toEqual(strip(byLanguage.en!));
  });

  it.each(LANGUAGES)('%s: names only works the library has', (language) => {
    for (const s of byLanguage[language]!) {
      if (s.scope !== 'library') expect(library.worksById.has(s.scope.workId), s.id).toBe(true);
    }
  });

  it('is written in the right language, with the comma-below letters of Romanian', () => {
    const roText = byLanguage.ro!.map((s) => s.text).join(' ');
    expect(roText).toMatch(/[ăâîșț]/);
    expect(roText).not.toMatch(/[şţ]/); // cedilla forms are not Romanian
    for (const s of byLanguage.ro!) expect(s.text, s.id).toMatch(/\?$/);
    for (const s of byLanguage.en!) {
      expect(s.text, s.id).toMatch(/\?$/);
      expect(s.text, s.id).not.toMatch(/[ăâîșț]/);
    }
  });
});

describe('every suggestion is answered from the library (mock provider)', () => {
  let server: RunningServer;
  beforeAll(async () => {
    server = await startTestServer({ RATE_LIMIT_MAX: '1000' });
  });
  afterAll(async () => {
    await server.shutdown('test', 500);
  });

  for (const language of LANGUAGES) {
    for (const suggestion of load(language)) {
      it(`${language} / ${suggestion.id}: retrieves passages of the expected work and cites them`, async () => {
        const expected = EXPECTED[suggestion.id]!;
        const expectedWork = workIdOf(expected.work);
        const response = await postAsk(
          server,
          {
            question: suggestion.text,
            language,
            ...(suggestion.scope === 'library' ? {} : { scope: suggestion.scope }),
          },
          { query: '?stream=false' },
        );
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
          sources: Array<{ workId: string; paragraphId: string }>;
          citations: unknown[];
          stopReason: string;
          model: string;
          quotations: { checked: number; unverified: number };
        };
        expect(body.model).toBe('mock');
        expect(body.stopReason).toBe('end_turn'); // not "not_covered"
        expect(body.sources.length).toBeGreaterThanOrEqual(1);
        expect(body.sources.some((source) => source.workId === expectedWork)).toBe(true);
        if (suggestion.scope !== 'library') {
          for (const source of body.sources) expect(source.workId).toBe(suggestion.scope.workId);
        }
        // The chapters that answer it are among the sources.
        const sections = body.sources.map((source) =>
          sourceSectionOrdinal(library, library.paragraphsById.get(source.paragraphId)!),
        );
        expect(
          sections.some((section) => expected.sections.includes(section)),
          `sections ${sections.join(',')} for ${suggestion.id}`,
        ).toBe(true);
        // And the mock answer cites and quotes them without inventing anything.
        expect(body.citations.length).toBeGreaterThanOrEqual(1);
        expect(body.quotations.unverified).toBe(0);
      });
    }
  }
});
