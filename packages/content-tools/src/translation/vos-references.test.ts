import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PackSchema } from '@biblioteca/shared';
import { describe, expect, it } from 'vitest';

import { DEFAULT_CHUNK, buildJobs } from './jobs';
import {
  canonicalItems,
  compareReferences,
  extractTargetReferences,
  findUnparsedReferenceFragments,
  parseSourceReferences,
} from './references';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const edition = PackSchema.parse(
  JSON.parse(
    fs.readFileSync(path.join(root, 'content/works/vos-1903-kingdom/edition-en.json'), 'utf8'),
  ) as unknown,
);

describe('references in the committed Vos edition (docs/traducere-pipeline.md, section 8)', () => {
  const runs = edition.paragraphs.map((p) => ({
    text: p.text,
    runs: parseSourceReferences(p.text),
  }));

  it('converts every reference-like fragment: none is left unparsed', () => {
    const unparsed = runs.flatMap(({ text, runs: found }) =>
      findUnparsedReferenceFragments(text, found).map((f) => f.text),
    );
    expect(unparsed).toEqual([]);
  });

  it('finds the 176 "Book chapter. verses" references (and 7 shorter ones)', () => {
    const segments = runs.flatMap(({ runs: found }) => found.flatMap((r) => r.segments));
    const book = segments.filter((s) => s.lead === 'book');
    const full = book.filter((s) => s.verses.length > 0 && s.chapter !== null);
    expect(full).toHaveLength(176);
    expect(book.filter((s) => s.verses.length === 0)).toHaveLength(6); // Matt. xiii, Ex. xv, ...
    expect(book.filter((s) => s.chapter === null)).toHaveLength(1); // Obad. 21
    expect(runs.reduce((sum, r) => sum + r.runs.length, 0)).toBe(153);
  });

  it('renders every paragraph in Romanian and reads the same references back', () => {
    for (const { text, runs: found } of runs) {
      const rendered = [...found]
        .reverse()
        .reduce((t, r) => t.slice(0, r.start) + r.target + t.slice(r.end), text);
      const diff = compareReferences(
        canonicalItems(found),
        canonicalItems(extractTargetReferences(rendered)),
      );
      expect(diff, text.slice(0, 60)).toEqual({ missing: [], extra: [] });
    }
  });

  it('splits into jobs that cover the 131 paragraphs once, with no unparsed fragment', () => {
    const built = buildJobs({
      edition,
      targetLanguage: 'ro',
      chunk: DEFAULT_CHUNK,
      repoRoot: root,
      sourceSha256: '0'.repeat(64),
    });
    expect(built.jobs.flatMap((j) => j.paragraphs)).toHaveLength(131);
    expect(new Set(built.jobs.flatMap((j) => j.paragraphs.map((p) => p.id))).size).toBe(131);
    expect(built.unparsed).toEqual([]);
    expect(
      built.jobs.every((j) => j.wordCount <= DEFAULT_CHUNK.maxWords + DEFAULT_CHUNK.minLastWords),
    ).toBe(true);
    expect(built.jobs.map((j) => j.jobId)[0]).toBe('vos-1903-kingdom-ro-01-00');
  });
});
