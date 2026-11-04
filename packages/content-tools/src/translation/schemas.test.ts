import { describe, expect, it } from 'vitest';

import { formatIssuePath, formatZodError } from './io';
import {
  CheckReportSchema,
  CriticReportSchema,
  JobIndexSchema,
  TranslationEditionMetaSchema,
  TranslationJobSchema,
  TranslationOutputSchema,
} from './schemas';
import { checkReport, criticReport, goodOutput, jobOf, metaFor } from './test-support';

function messageOf(result: { success: boolean; error?: { issues: unknown[] } }): string {
  if (result.success || !result.error) return '';
  return formatZodError(result.error as Parameters<typeof formatZodError>[0]);
}

describe('TranslationOutputSchema', () => {
  const valid = {
    jobId: 'w-ro-01-00',
    pass: 'draft',
    model: 'claude-sonnet-5-5',
    paragraphs: [{ sourceId: 'p1', text: 'Text' }],
  };

  it('defaults flags to an empty list and leaves optional fields optional', () => {
    const parsed = TranslationOutputSchema.parse(valid);
    expect(parsed.paragraphs[0]?.flags).toEqual([]);
    expect(parsed.headingRo).toBeUndefined();
    expect(parsed.paragraphs[0]?.scripture).toBeUndefined();
  });

  it('accepts flags, scripture and notes', () => {
    const parsed = TranslationOutputSchema.parse({
      ...valid,
      headingRo: 'Titlu',
      notes: 'n',
      paragraphs: [
        {
          sourceId: 'p1',
          text: 'Text',
          flags: [{ code: 'CITAT_BIBLIC', severity: 'INFO', quoteSource: 'a', quoteTarget: 'b', note: 'n' }],
          scripture: [{ ref: 'Mat. 4:17', mode: 'quote-author-rendering' }],
        },
      ],
    });
    expect(parsed.paragraphs[0]?.scripture).toEqual([{ ref: 'Mat. 4:17', mode: 'quote-author-rendering' }]);
  });

  it('rejects unknown keys, naming their path', () => {
    const top = TranslationOutputSchema.safeParse({ ...valid, invented: 1 });
    expect(messageOf(top)).toContain('(root): Unrecognized key: "invented"');
    const nested = TranslationOutputSchema.safeParse({
      ...valid,
      paragraphs: [{ sourceId: 'p1', text: 'Text', extra: true }],
    });
    expect(messageOf(nested)).toContain('paragraphs[0]: Unrecognized key: "extra"');
  });

  it('rejects an empty text and a bad flag, naming the path', () => {
    const empty = TranslationOutputSchema.safeParse({
      ...valid,
      paragraphs: [{ sourceId: 'p1', text: 'ok' }, { sourceId: 'p2', text: '' }],
    });
    expect(messageOf(empty)).toMatch(/^paragraphs\[1\]\.text: /);
    const flag = TranslationOutputSchema.safeParse({
      ...valid,
      paragraphs: [{ sourceId: 'p1', text: 'x', flags: [{ code: 'NOPE', severity: 'CRITIC', note: '' }] }],
    });
    expect(messageOf(flag)).toMatch(/paragraphs\[0\]\.flags\[0\]\.code/);
    expect(TranslationOutputSchema.safeParse({ ...valid, pass: 'critic' }).success).toBe(false);
  });
});

describe('the other schemas', () => {
  it('TranslationJobSchema accepts a job produced by buildJobs and rejects a bad id', () => {
    const job = jobOf(0);
    expect(TranslationJobSchema.safeParse(job).success).toBe(true);
    expect(messageOf(TranslationJobSchema.safeParse({ ...job, jobId: 'Bad Id' }))).toMatch(/^jobId: /);
    expect(messageOf(TranslationJobSchema.safeParse({ ...job, extra: 1 }))).toContain('extra');
    const noProfile = { ...job, materials: { ...job.materials, profile: 'content/translation/profiles/x.md' } };
    expect(TranslationJobSchema.safeParse(noProfile).success).toBe(true);
  });

  it('CriticReportSchema requires the quotes, a verdict and a closed list of categories', () => {
    const job = jobOf(0);
    const report = criticReport(job, [
      {
        sourceId: 'src-a1',
        severity: 'MAJOR',
        category: 'omisiune',
        quoteSource: 'a',
        quoteTarget: '',
        problem: 'p',
        proposal: 'q',
      },
    ]);
    expect(CriticReportSchema.safeParse(report).success).toBe(true);
    expect(CriticReportSchema.safeParse({ ...report, verdict: 'maybe' }).success).toBe(false);
    const badCategory = { ...report, findings: [{ ...report.findings[0], category: 'style' }] };
    expect(messageOf(CriticReportSchema.safeParse(badCategory))).toMatch(/findings\[0\]\.category/);
  });

  it('CheckReportSchema and JobIndexSchema are strict', () => {
    const report = checkReport(jobOf(0), []);
    expect(CheckReportSchema.safeParse(report).success).toBe(true);
    expect(CheckReportSchema.safeParse({ ...report, stats: { ...report.stats, extra: 1 } }).success).toBe(false);
    expect(JobIndexSchema.safeParse({ workSlug: 'w', sourceEditionId: 'e', targetLanguage: 'ro', sourceSha256: 'x', jobs: [] }).success).toBe(false);
  });

  it('TranslationEditionMetaSchema: id optional, kind translation, strict nested objects', () => {
    expect(TranslationEditionMetaSchema.safeParse(metaFor()).success).toBe(true);
    expect(TranslationEditionMetaSchema.safeParse(metaFor({ id: 'ed-1' })).success).toBe(true);
    const meta = metaFor();
    expect(TranslationEditionMetaSchema.safeParse({ edition: { ...meta.edition, kind: 'source' } }).success).toBe(false);
    expect(TranslationEditionMetaSchema.safeParse({ edition: { ...meta.edition, sourceEditionId: undefined } }).success).toBe(false);
    const typo = { edition: { ...meta.edition, licence: { ...meta.edition.licence, notes: 'x' } } };
    expect(messageOf(TranslationEditionMetaSchema.safeParse(typo))).toContain('edition.licence');
    expect(TranslationEditionMetaSchema.safeParse({ ...meta, work: {} }).success).toBe(false);
  });
});

describe('formatIssuePath', () => {
  it('writes array indexes in brackets and keys with dots', () => {
    expect(formatIssuePath(['paragraphs', 3, 'text'])).toBe('paragraphs[3].text');
    expect(formatIssuePath([0, 'a'])).toBe('[0].a');
    expect(formatIssuePath([])).toBe('(root)');
  });

  it('is what a goodOutput passes through unchanged', () => {
    expect(TranslationOutputSchema.parse(goodOutput(jobOf(0)))).toEqual(goodOutput(jobOf(0)));
  });
});
