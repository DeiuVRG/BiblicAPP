import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Pack } from '@biblioteca/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UsageError } from '../lib/usage-error';
import { defined } from '../lib/invariant';
import {
  DEFAULT_CHUNK,
  buildJobs,
  expandSections,
  jobIdFor,
  parseSectionList,
  parseSectionRanges,
  splitIntoParts,
  staleJobFiles,
} from './jobs';
import { JobIndexSchema, TranslationJobSchema } from './schemas';
import { EN, SLUG, makeSource } from './test-support';

const words = (n: number): number => n;
const chunk = { targetWords: 900, maxWords: 1500, minLastWords: 300 };

describe('splitIntoParts', () => {
  it('keeps the paragraphs in order and never splits one', () => {
    const sizes = [400, 300, 250, 500, 100, 700, 650, 20, 900, 40];
    const parts = splitIntoParts(sizes, words, chunk);
    expect(parts.flat()).toEqual(sizes);
    expect(parts.every((p) => p.length > 0)).toBe(true);
  });

  it('closes a part as soon as it reaches the target', () => {
    expect(splitIntoParts([500, 400, 500, 450, 460], words, chunk)).toEqual([
      [500, 400],
      [500, 450],
      [460],
    ]);
  });

  it('starts the next part rather than exceed the maximum', () => {
    expect(splitIntoParts([800, 1000, 700], words, chunk)).toEqual([[800], [1000], [700]]);
    for (const part of splitIntoParts([800, 1000, 700, 600, 900, 300, 899], words, chunk)) {
      expect(part.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(chunk.maxWords);
    }
  });

  it('gives a paragraph longer than the maximum a part of its own', () => {
    expect(splitIntoParts([300, 2000, 300, 800], words, chunk)).toEqual([
      [300],
      [2000],
      [300, 800],
    ]);
  });

  it('merges a short last part into the previous one when the sum fits', () => {
    // 900 | 200 -> 1100 <= 1500 + 300
    expect(splitIntoParts([900, 200], words, chunk)).toEqual([[900, 200]]);
    // exactly min-last-words is not short
    expect(splitIntoParts([900, 300], words, chunk)).toEqual([[900], [300]]);
  });

  it('does not merge a short last part when the sum would be too large', () => {
    // previous part 1500 + 250 = 1750 <= 1800: merged; previous 1500 + 299 = 1799: merged
    expect(splitIntoParts([1500, 299], words, chunk)).toEqual([[1500, 299]]);
    // an oversized single paragraph keeps its short successor apart
    expect(splitIntoParts([2000, 100], words, chunk)).toEqual([[2000], [100]]);
  });

  it('handles an empty section and a single small paragraph', () => {
    expect(splitIntoParts([], words, chunk)).toEqual([]);
    expect(splitIntoParts([10], words, chunk)).toEqual([[10]]);
  });
});

describe('parseSectionList', () => {
  it('reads numbers and ranges', () => {
    expect([...parseSectionList('1,2,5-7', 11)].sort((a, b) => a - b)).toEqual([1, 2, 5, 6, 7]);
    expect([...parseSectionList(' 3 ', 11)]).toEqual([3]);
    expect([...parseSectionList('4-4', 11)]).toEqual([4]);
    expect(parseSectionRanges('1,2,5-7')).toEqual([
      [1, 1],
      [2, 2],
      [5, 7],
    ]);
  });

  it('rejects malformed lists as usage errors', () => {
    for (const bad of ['', '0', 'a', '5-2', '1,,2', '1-', '-3', '1;2']) {
      expect(() => parseSectionList(bad, 11), bad).toThrow(UsageError);
    }
  });

  it('names the chapters beyond the edition without expanding the ranges first', () => {
    expect(() => parseSectionList('12', 11)).toThrow(
      /--sections: no chapter 12 \(the edition has 11\)/,
    );
    expect(() => parseSectionList('9-14', 11)).toThrow(/no chapter 12-14 \(the edition has 11\)/);
    expect(() => parseSectionList('3,12,14-15', 11)).toThrow(/no chapter 12, 14-15 /);
    expect([...parseSectionList('9-11', 11)]).toEqual([9, 10, 11]);
  });

  it('rejects an enormous range at once, as a usage error', () => {
    // expanding 1-300000000 first used to end in "RangeError: Set maximum size exceeded"
    for (const huge of ['1-300000000', '1-5000000', '2,3-99999999999999999999']) {
      expect(() => parseSectionList(huge, 11), huge).toThrow(UsageError);
      expect(() => parseSectionList(huge, 11), huge).toThrow(
        /no chapter .* \(the edition has 11\)/,
      );
    }
    expect(() => expandSections([[1, 4_000_000_000]], 11)).toThrow(UsageError);
  });
});

describe('jobIdFor', () => {
  it('uses section ordinal + 1 and the part index with two digits', () => {
    expect(jobIdFor('vos-1903-kingdom', 'ro', 0, 0)).toBe('vos-1903-kingdom-ro-01-00');
    expect(jobIdFor('vos-1903-kingdom', 'ro', 10, 12)).toBe('vos-1903-kingdom-ro-11-12');
    expect(jobIdFor('w', 'ro', 99, 0)).toBe('w-ro-100-00');
  });
});

describe('staleJobFiles', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-stale-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const touch = (...names: string[]) => {
    for (const name of names) fs.writeFileSync(path.join(dir, name), '{}');
  };

  it('lists job files of the given sections that the run does not produce', () => {
    touch(
      'w-ro-01-00.json',
      'w-ro-01-01.json',
      'w-ro-01-02.json',
      'w-ro-02-00.json',
      'w-ro-02-01.json',
      'w-ro-11-00.json',
      'index.json',
      'notes.json',
      'w-en-01-03.json',
      'other-ro-01-03.json',
      'w-ro-01-03.json.bak',
    );
    const produced = new Set(['w-ro-01-00.json', 'w-ro-02-00.json']);
    // chapters 1 and 2 are part of the run (ordinals 0 and 1); chapter 11 is not
    expect(staleJobFiles(dir, 'w', 'ro', new Set([0, 1]), produced)).toEqual([
      'w-ro-01-01.json',
      'w-ro-01-02.json',
      'w-ro-02-01.json',
    ]);
    expect(staleJobFiles(dir, 'w', 'ro', new Set([1]), produced)).toEqual(['w-ro-02-01.json']);
    expect(staleJobFiles(dir, 'w', 'ro', new Set(), produced)).toEqual([]);
  });

  it('treats the slug literally and an absent directory as empty', () => {
    touch('a.b-ro-01-01.json', 'aXb-ro-01-01.json');
    expect(staleJobFiles(dir, 'a.b', 'ro', new Set([0]), new Set())).toEqual(['a.b-ro-01-01.json']);
    expect(staleJobFiles(path.join(dir, 'nope'), 'w', 'ro', new Set([0]), new Set())).toEqual([]);
  });
});

/** A source edition with a long section that needs several parts. */
function longSource(): Pack {
  const source = makeSource();
  const sentence = 'word '.repeat(300).trim(); // 300 words
  const extra = Array.from({ length: 12 }, (_, i) => ({
    id: `long-${i}`,
    sectionId: 'sec-c',
    ordinal: i,
    kind: 'p' as const,
    text: i === 3 ? 'See Matt. v. 3; Obad. 21 here.' : sentence,
  }));
  return {
    ...source,
    sections: [
      ...source.sections,
      { id: 'sec-c', ordinal: 2, kind: 'chapter', heading: 'III. Long' },
    ],
    paragraphs: [...source.paragraphs, ...extra],
  };
}

describe('buildJobs', () => {
  let repoRoot: string;
  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-jobs-'));
  });
  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  const build = (source: Pack, extra: Partial<Parameters<typeof buildJobs>[0]> = {}) =>
    buildJobs({
      edition: source,
      targetLanguage: 'ro',
      chunk: DEFAULT_CHUNK,
      repoRoot,
      sourceSha256: 'a'.repeat(64),
      ...extra,
    });

  it('produces one job per part with schema-valid content and sequential ids', () => {
    const { jobs } = build(longSource());
    expect(jobs.map((j) => j.jobId)).toEqual([
      `${SLUG}-ro-01-00`,
      `${SLUG}-ro-02-00`,
      `${SLUG}-ro-03-00`,
      `${SLUG}-ro-03-01`,
      `${SLUG}-ro-03-02`,
      `${SLUG}-ro-03-03`,
    ]);
    for (const job of jobs) expect(TranslationJobSchema.safeParse(job).success).toBe(true);
    const third = jobs.filter((j) => j.section.id === 'sec-c');
    expect(third.map((j) => [j.part, j.parts])).toEqual([
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
    ]);
    // 12 paragraphs of 300 words (the 4th is short): parts close at >= 900 words
    expect(third.map((j) => j.paragraphs.length)).toEqual([3, 4, 3, 2]);
  });

  it('covers every paragraph of the selected sections exactly once, in order', () => {
    const source = longSource();
    const { jobs } = build(source);
    const ids = jobs.flatMap((j) => j.paragraphs.map((p) => p.id));
    expect(ids).toEqual(source.paragraphs.map((p) => p.id));
  });

  it('gives each job the paragraphs next to it in the document as context', () => {
    const { jobs } = build(longSource());
    const [first, second] = jobs.filter((j) => j.section.id === 'sec-c');
    // inside a chapter: the neighbouring parts
    expect(first?.context.nextParagraph).toBe(second?.paragraphs[0]?.text);
    expect(second?.context.previousParagraph).toBe(first?.paragraphs[2]?.text);
    expect(first?.context.previousSectionHeading).toBe('II. The Church');
    const start = jobs[0];
    expect(start?.context.previousParagraph).toBeNull();
    expect(start?.context.previousSectionHeading).toBeNull();
    const last = jobs[jobs.length - 1];
    expect(last?.context.nextParagraph).toBeNull();
  });

  it('lets the context cross the boundary between two chapters', () => {
    const { jobs } = build(longSource());
    const [chapterA, chapterB] = jobs;
    const firstOfC = jobs.find((j) => j.section.id === 'sec-c');
    // the last paragraph of a chapter is the previous paragraph of the next chapter's first job
    expect(chapterA?.context.nextParagraph).toBe(EN['src-b1']);
    expect(chapterB?.context.previousParagraph).toBe(EN['src-a3']);
    expect(chapterB?.context.nextParagraph).toBe(firstOfC?.paragraphs[0]?.text);
    expect(firstOfC?.context.previousParagraph).toBe(EN['src-b2']);
    expect(firstOfC?.context.previousSectionHeading).toBe('II. The Church');
  });

  it('gives a job the same context whichever sections are selected, and skips empty sections', () => {
    const source = longSource();
    const all = build(source).jobs;
    const only = build(source, { sections: new Set([2]) }).jobs;
    expect(only).toEqual(all.filter((j) => j.section.id === 'sec-b'));
    expect(only[0]?.context.previousParagraph).toBe(EN['src-a3']);

    const gap = makeSource();
    gap.sections = [
      { id: 'sec-a', ordinal: 0, kind: 'chapter', heading: 'A' },
      { id: 'sec-gap', ordinal: 1, kind: 'section', heading: 'Part title only' },
      { id: 'sec-b', ordinal: 2, kind: 'chapter', heading: 'B' },
    ];
    const jobsOfGap = build(gap).jobs;
    expect(jobsOfGap.map((j) => j.section.id)).toEqual(['sec-a', 'sec-b']);
    // the empty section yields no job and no neighbour, but it is the "previous section"
    expect(jobsOfGap[1]?.context.previousParagraph).toBe(EN['src-a3']);
    expect(jobsOfGap[1]?.context.previousSectionHeading).toBe('Part title only');
  });

  it('computes the references of every paragraph', () => {
    const { jobs, referenceRuns, unparsed } = build(longSource());
    const withRefs = jobs.flatMap((j) => j.paragraphs).find((p) => p.id === 'long-3');
    expect(withRefs?.references).toEqual([
      {
        source: 'Matt. v. 3; Obad. 21',
        target: 'Mat. 5:3; Obad. 21',
        canonical: ['Matt 5:3', 'Obad 21'],
      },
    ]);
    expect(referenceRuns).toBe(1 + 1 + 1 + 1); // a1, a2 (one run each), b1, long-3
    expect(unparsed).toEqual([]);
    const a1 = jobs[0]?.paragraphs[0];
    expect(a1?.references.map((r) => r.target)).toEqual(['Mat. 4:17; Mc. 1:15']);
  });

  it('reports reference-like fragments that did not parse', () => {
    const source = makeSource();
    source.paragraphs[2] = {
      ...defined(source.paragraphs[2], 'paragraph 2'),
      text: 'As in Matt. xi. 1903 it is clear.',
    };
    const { unparsed } = build(source);
    expect(unparsed.map((u) => [u.sourceId, u.fragments.length])).toEqual([['src-a3', 1]]);
  });

  it('counts words and records the materials, with the profile only when it exists', () => {
    const without = build(makeSource()).jobs[0];
    expect(without?.materials).toEqual({
      rules: 'content/translation/rules-ro.md',
      contract: 'content/translation/output-contract.md',
      glossary: 'content/translation/glossary-ro.csv',
      calques: 'content/translation/calques-ro.json',
      profile: null,
    });
    expect(without?.wordCount).toBe(
      without?.paragraphs.reduce((sum, p) => sum + p.text.split(/\s+/).length, 0),
    );
    fs.mkdirSync(path.join(repoRoot, 'content/translation/profiles'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, `content/translation/profiles/${SLUG}.md`), '# profile\n');
    expect(build(makeSource()).jobs[0]?.materials.profile).toBe(
      `content/translation/profiles/${SLUG}.md`,
    );
  });

  it('respects the section selection (1-based chapter numbers)', () => {
    const { jobs, index } = build(longSource(), { sections: new Set([2, 3]) });
    expect(new Set(jobs.map((j) => j.section.id))).toEqual(new Set(['sec-b', 'sec-c']));
    expect(index.jobs.every((j) => j.sectionOrdinal >= 1)).toBe(true);
  });

  it('writes a deterministic index that matches the jobs', () => {
    const first = build(longSource());
    const second = build(longSource());
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JobIndexSchema.safeParse(first.index).success).toBe(true);
    expect(first.index).toMatchObject({
      workSlug: SLUG,
      sourceEditionId: 'edition-en',
      targetLanguage: 'ro',
      sourceSha256: 'a'.repeat(64),
    });
    expect(first.index.jobs.map((j) => j.file)).toEqual(first.jobs.map((j) => `${j.jobId}.json`));
    expect(first.index.jobs.map((j) => [j.paragraphs, j.words])).toEqual(
      first.jobs.map((j) => [j.paragraphs.length, j.wordCount]),
    );
  });

  it('skips sections without paragraphs and reports them', () => {
    const source = makeSource();
    source.sections.push({ id: 'sec-empty', ordinal: 2, kind: 'section', heading: 'Empty' });
    const { jobs, emptySections } = build(source);
    expect(jobs).toHaveLength(2);
    expect(emptySections.map((s) => s.id)).toEqual(['sec-empty']);
  });
});
