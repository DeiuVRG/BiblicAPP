import { PackSchema } from '@biblioteca/shared';
import type { Pack } from '@biblioteca/shared';
import { describe, expect, it } from 'vitest';

import { defined } from '../lib/invariant';
import { UsageError } from '../lib/usage-error';
import {
  AUGUSTINE,
  CREED,
  augustineSource,
  creedSource,
  finalOutput,
  jobsFor,
  translationMeta,
} from './fixtures';
import { mergeTranslation } from './merge';
import type { MergeInput, MergeResult } from './merge';
import type { LoadedFile } from './review';
import type { CheckReport, TranslationOutput } from './schemas';

/** `translation-merge` for the English and the Romanian target, from Latin and from Greek. */

function merge(
  source: Pack,
  lang: 'en' | 'ro',
  texts: string[],
  headings: (string | undefined)[],
  overrides: Partial<MergeInput> = {},
): MergeResult {
  const jobs = jobsFor(source, lang);
  const finals: LoadedFile<TranslationOutput>[] = jobs.map((job, i) => ({
    file: `final/${job.jobId}.json`,
    data: finalOutput(job, [texts[i] ?? ''], headings[i]),
  }));
  const checks: LoadedFile<CheckReport>[] = jobs.map((job) => ({
    file: `checks/${job.jobId}.json`,
    data: {
      jobId: job.jobId,
      file: `final/${job.jobId}.json`,
      ok: true,
      strictOk: true,
      findings: [],
      stats: { paragraphs: job.paragraphs.length, sourceWords: 0, targetWords: 0, lengthRatio: 1 },
    },
  }));
  return mergeTranslation({
    source,
    meta: translationMeta(source.edition.id, lang),
    previous: undefined,
    finals,
    critics: [],
    checks,
    partial: false,
    allowCritic: false,
    ...overrides,
  });
}

function packOf(result: MergeResult): Pack {
  if (!result.pack) throw new Error(`merge refused: ${result.problems.join('; ')}`);
  return result.pack;
}

describe('the heading of the translated section', () => {
  it('is headingEn in an English translation and headingRo in a Romanian one', () => {
    const en = packOf(merge(augustineSource(), 'en', [AUGUSTINE.en], [AUGUSTINE.heading.en]));
    expect(en.sections.map((s) => s.heading)).toEqual(['Chapter I']);
    const ro = packOf(merge(augustineSource(), 'ro', [AUGUSTINE.ro], [AUGUSTINE.heading.ro]));
    expect(ro.sections.map((s) => s.heading)).toEqual(['Capitolul I']);
  });

  it('uses the source heading, with a warning that names the field, when it is missing', () => {
    const en = merge(augustineSource(), 'en', [AUGUSTINE.en], [undefined]);
    expect(packOf(en).sections[0]?.heading).toBe('Caput I');
    expect(en.warnings).toEqual([
      'section 1 "Caput I": no headingEn in the part-0 output, using the source heading',
    ]);
    const ro = merge(augustineSource(), 'ro', [AUGUSTINE.ro], [undefined]);
    expect(ro.warnings[0]).toContain('no headingRo in the part-0 output');
  });

  it('does not take the heading of the other language', () => {
    const source = augustineSource();
    const [job] = jobsFor(source, 'en');
    const wrong: TranslationOutput = {
      ...finalOutput(defined(job, 'job'), [AUGUSTINE.en], undefined),
      headingRo: 'Capitolul I',
    };
    const result = merge(source, 'en', [AUGUSTINE.en], [undefined], {
      finals: [{ file: `final/${job?.jobId}.json`, data: wrong }],
    });
    expect(packOf(result).sections[0]?.heading).toBe('Caput I');
    expect(result.warnings).toHaveLength(1);
  });
});

describe('the translated edition of a Latin or Greek work', () => {
  it('is aligned 1:1 with the source, names the source edition and keeps the work', () => {
    const source = augustineSource();
    const pack = packOf(merge(source, 'en', [AUGUSTINE.en], [AUGUSTINE.heading.en]));
    expect(PackSchema.safeParse(pack).success).toBe(true);
    expect(pack.edition).toMatchObject({
      language: 'en',
      kind: 'translation',
      sourceEditionId: 'edition-la',
    });
    expect(pack.work).toEqual(source.work);
    expect(pack.sections[0]).toMatchObject({ sourceId: 'sec-1', kind: 'chapter' });
    expect(pack.paragraphs[0]).toMatchObject({ sourceId: 'par-1', text: AUGUSTINE.en });
  });

  it('keeps the three articles of the creed as three sections of three paragraphs', () => {
    const source = creedSource();
    for (const lang of ['en', 'ro'] as const) {
      const pack = packOf(merge(source, lang, [...CREED[lang]], [...CREED.heading[lang]]));
      expect(pack.sections.map((s) => s.heading)).toEqual([...CREED.heading[lang]]);
      expect(pack.sections.map((s) => s.sourceId)).toEqual(['sec-1', 'sec-2', 'sec-3']);
      expect(pack.paragraphs.map((p) => p.text)).toEqual([...CREED[lang]]);
      expect(pack.edition.sourceEditionId).toBe('edition-grc');
    }
  });

  it('can be partial: the sections that are covered are emitted and the note says how many', () => {
    const source = creedSource();
    const jobs = jobsFor(source, 'en');
    const finals = jobs.slice(0, 2).map((job, i) => ({
      file: `final/${job.jobId}.json`,
      data: finalOutput(job, [CREED.en[i] ?? ''], CREED.heading.en[i]),
    }));
    const result = merge(source, 'en', [], [], { finals, partial: true });
    const pack = packOf(result);
    expect(pack.sections).toHaveLength(2);
    expect(result.coverage.sections).toEqual([2, 3]);
    expect(pack.edition.provenance.notes).toContain('Partial translation: 2 of 3 sections.');
  });
});

describe('the title of the work in the language of the translation', () => {
  it('goes to titleEn in an English translation and to titleRo in a Romanian one', () => {
    const source = augustineSource();
    const base = { ...source, work: { ...source.work } };
    delete (base.work as { titleEn?: string }).titleEn;
    const english = merge(base, 'en', [AUGUSTINE.en], ['Chapter I'], {
      meta: translationMeta('edition-la', 'en', 'On the Spirit and the Letter'),
    });
    expect(packOf(english).work.titleEn).toBe('On the Spirit and the Letter');
    expect(packOf(english).work.titleRo).toBe(source.work.titleRo);
    const romanian = merge(base, 'ro', [AUGUSTINE.ro], ['Capitolul I'], {
      meta: translationMeta('edition-la', 'ro', 'Despre duh și literă'),
    });
    expect(packOf(romanian).work.titleRo).toBe('Despre duh și literă');
    expect(packOf(romanian).work.titleEn).toBeUndefined();
  });

  it('leaves the work as it is without a workTitle (the Vos edition keeps its bytes)', () => {
    const source = augustineSource();
    expect(packOf(merge(source, 'en', [AUGUSTINE.en], ['Chapter I'])).work).toEqual(source.work);
  });

  it('is also the title of the review sheet: the sheet and the edition agree', () => {
    // A source pack has no titleEn (the schema leaves it out of source packs): the sheet of the
    // English translation must not fall back to the Latin title when the metadata gives one.
    const source = augustineSource();
    const base = { ...source, work: { ...source.work } };
    delete (base.work as { titleEn?: string }).titleEn;
    const english = merge(base, 'en', [AUGUSTINE.en], ['Chapter I'], {
      meta: translationMeta('edition-la', 'en', 'On the Spirit and the Letter'),
    });
    expect(english.review?.split('\n')[0]).toBe('# Review sheet: On the Spirit and the Letter');
    expect(packOf(english).work.titleEn).toBe('On the Spirit and the Letter');
    // the line "Work:" keeps naming the work as the source does
    expect(english.review).toContain(
      '- Work: De spiritu et littera (augustine-de-spiritu-et-littera)',
    );

    const romanian = merge(base, 'ro', [AUGUSTINE.ro], ['Capitolul I'], {
      meta: translationMeta('edition-la', 'ro', 'Despre duh și literă'),
    });
    expect(romanian.review?.split('\n')[0]).toBe('# Fișă de revizie: Despre duh și literă');
    expect(packOf(romanian).work.titleRo).toBe('Despre duh și literă');
  });

  it('is still the title of the source without a workTitle, in both languages', () => {
    const source = augustineSource();
    const base = { ...source, work: { ...source.work } };
    delete (base.work as { titleEn?: string }).titleEn;
    expect(merge(base, 'en', [AUGUSTINE.en], ['Chapter I']).review?.split('\n')[0]).toBe(
      '# Review sheet: De spiritu et littera',
    );
    expect(merge(source, 'ro', [AUGUSTINE.ro], ['Capitolul I']).review?.split('\n')[0]).toBe(
      '# Fișă de revizie: Despre spirit și literă',
    );
  });
});

describe('the review sheet', () => {
  it('says the pair of languages and is in English for an English translation', () => {
    const result = merge(augustineSource(), 'en', [AUGUSTINE.en], [AUGUSTINE.heading.en]);
    const lines = (result.review ?? '').split('\n');
    expect(lines.slice(0, 7)).toEqual([
      '# Review sheet: On the Spirit and the Letter',
      '',
      '- Work: De spiritu et littera (augustine-de-spiritu-et-littera)',
      '- Languages: la -> en',
      '- Coverage: 1/1 paragraphs, 1/1 sections',
      '- Models: draft: -; critic: -; revised: claude-sonnet-5-5',
      expect.stringMatching(/^- Findings: CRITIC 0, MAJOR 0,/),
    ]);
    expect(lines).toContain(
      '| Severity | Section | Paragraph (sourceId) | Source | Translation | Problem | Proposal | Origin |',
    );
    expect(lines).toContain('No open findings.');
    expect(result.review).not.toMatch(/Severitate|Nu există/);
  });

  it('says la -> ro and stays Romanian for a Romanian translation, grc -> en for the creed', () => {
    const ro = merge(augustineSource(), 'ro', [AUGUSTINE.ro], [AUGUSTINE.heading.ro]);
    expect(ro.review).toContain('# Fișă de revizie: Despre spirit și literă');
    expect(ro.review).toContain('- Languages: la -> ro');
    expect(ro.review).toContain('| Severitate | Secțiune | Paragraf (sourceId) |');
    expect(ro.review).toContain('Nu există constatări deschise.');
    const creed = merge(creedSource(), 'en', [...CREED.en], [...CREED.heading.en]);
    expect(creed.review).toContain('- Languages: grc -> en');
    expect(creed.review).toContain('# Review sheet: The Nicene-Constantinopolitan Creed');
  });

  it('uses the original title when the work has no English title', () => {
    const source = augustineSource();
    const base = { ...source, work: { ...source.work } };
    delete (base.work as { titleEn?: string }).titleEn;
    expect(merge(base, 'en', [AUGUSTINE.en], ['Chapter I']).review).toContain(
      '# Review sheet: De spiritu et littera',
    );
  });
});

describe('a language without materials', () => {
  it('is a usage error', () => {
    const source = augustineSource();
    const bad = {
      ...translationMeta('edition-la', 'en'),
      edition: { ...translationMeta('edition-la', 'en').edition, language: 'fr' },
    };
    expect(() => merge(source, 'en', [AUGUSTINE.en], ['Chapter I'], { meta: bad })).toThrow(
      UsageError,
    );
  });
});
