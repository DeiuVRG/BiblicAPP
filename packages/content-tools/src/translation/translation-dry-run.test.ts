import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PackSchema } from '@biblioteca/shared';
import type { Pack } from '@biblioteca/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runTranslationCheck } from '../commands/translation-check';
import { runTranslationJobs } from '../commands/translation-jobs';
import { runTranslationMerge } from '../commands/translation-merge';
import { defined } from '../lib/invariant';
import {
  AUGUSTINE,
  AUGUSTINE_SLUG,
  CREED,
  CREED_SLUG,
  augustineSource,
  creedSource,
  finalOutput,
  translationMeta,
} from './fixtures';
import type { CheckReport, TranslationJob } from './schemas';

/**
 * Dry runs of the generalised pipeline through the commands, on real text and the real materials
 * of the repository: the Latin of chapter I of Augustine, De spiritu et littera (Latin to English
 * and to Romanian) and the Greek of the Creed of Constantinople (Greek to English and to
 * Romanian), and a synthetic Latin paragraph full of citations for the Latin reference grammar.
 */

/** The root of the repository: the materials named by the jobs are relative to it. */
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

interface Case {
  title: string;
  slug: string;
  source: Pack;
  sourceFile: string;
  lang: 'en' | 'ro';
  /** One text and one heading per job, in the order of the jobs. */
  texts: string[][];
  headings: string[];
  workTitle?: string;
}

// Invented Latin, not Augustine: a paragraph whose only purpose is to carry citations.
const SYNTHETIC_LATIN =
  'Hanc sententiam, quae ab ipso initio fide Ecclesiae tenetur, Apostolus confirmat, Rom. v. 12; vi. 3 sqq., ' +
  'et alibi, Ioh. 3, 5; ibid. 8. Item psalmus, ut legitur, dicit, Ps. 118, 2 et 3 Reg. 19, 12, nec non ' +
  '1 Cor. xv, 22, quod Iud. 5 non est.';
const SYNTHETIC = {
  en:
    'The Apostle confirms this opinion, which the faith of the Church has held from the very beginning, ' +
    'Rom. 5:12; 6:3 ff., and elsewhere, John 3:5; v. 8. Likewise the psalm, as we read, says, Ps. 118:2 ' +
    'and 1 Kings 19:12, and also 1 Cor. 15:22, which Jude 5 is not.',
  ro:
    'Apostolul întărește această părere, pe care credința Bisericii o ține chiar de la început, ' +
    'Rom. 5:12; 6:3 ș.urm., și în altă parte, In. 3:5; v. 8. De asemenea psalmul, după cum citim, spune, ' +
    'Ps. 118:2 și 1 Împ. 19:12, precum și 1 Cor. 15:22, ceea ce Iuda 5 nu este.',
};

function syntheticSource(): Pack {
  const base = augustineSource();
  return {
    ...base,
    work: { ...base.work, slug: 'synthetic-latin-citations', titleEn: 'Synthetic citations' },
    paragraphs: [{ id: 'par-1', sectionId: 'sec-1', ordinal: 0, kind: 'p', text: SYNTHETIC_LATIN }],
  };
}

const CASES: Case[] = [
  {
    title: 'Augustine, De spiritu et littera, chapter I: Latin to English',
    slug: AUGUSTINE_SLUG,
    source: augustineSource(),
    sourceFile: 'edition-la.json',
    lang: 'en',
    texts: [[AUGUSTINE.en]],
    headings: [AUGUSTINE.heading.en],
    workTitle: 'On the Spirit and the Letter',
  },
  {
    title: 'Augustine, De spiritu et littera, chapter I: Latin to Romanian',
    slug: AUGUSTINE_SLUG,
    source: augustineSource(),
    sourceFile: 'edition-la.json',
    lang: 'ro',
    texts: [[AUGUSTINE.ro]],
    headings: [AUGUSTINE.heading.ro],
  },
  {
    title: 'the Creed of Constantinople: Greek to English',
    slug: CREED_SLUG,
    source: creedSource(),
    sourceFile: 'edition-grc.json',
    lang: 'en',
    texts: CREED.en.map((text) => [text]),
    headings: [...CREED.heading.en],
    workTitle: 'The Nicene-Constantinopolitan Creed',
  },
  {
    title: 'the Creed of Constantinople: Greek to Romanian',
    slug: CREED_SLUG,
    source: creedSource(),
    sourceFile: 'edition-grc.json',
    lang: 'ro',
    texts: CREED.ro.map((text) => [text]),
    headings: [...CREED.heading.ro],
  },
  {
    title: 'synthetic Latin citations: Latin to English',
    slug: 'synthetic-latin-citations',
    source: syntheticSource(),
    sourceFile: 'edition-la.json',
    lang: 'en',
    texts: [[SYNTHETIC.en]],
    headings: ['Chapter I'],
  },
  {
    title: 'synthetic Latin citations: Latin to Romanian',
    slug: 'synthetic-latin-citations',
    source: syntheticSource(),
    sourceFile: 'edition-la.json',
    lang: 'ro',
    texts: [[SYNTHETIC.ro]],
    headings: ['Capitolul I'],
  },
];

describe('dry runs of the commands', () => {
  let dir: string;
  let previousInitCwd: string | undefined;
  let out: string;
  let err: string;
  /** What translation-jobs printed in the last pipeline. */
  let jobsOut = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-dry-run-'));
    previousInitCwd = process.env.INIT_CWD;
    process.env.INIT_CWD = dir;
    out = '';
    err = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      out += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      err += String(chunk);
      return true;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (previousInitCwd === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = previousInitCwd;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const file = (name: string): string => path.join(dir, name);
  const read = (name: string): string => fs.readFileSync(file(name), 'utf8');
  const readJson = <T>(name: string): T => JSON.parse(read(name)) as T;
  function write(name: string, content: string): void {
    fs.mkdirSync(path.dirname(file(name)), { recursive: true });
    fs.writeFileSync(file(name), content);
  }
  const writeJson = (name: string, value: unknown): void =>
    write(name, `${JSON.stringify(value, null, 2)}\n`);

  /** Runs the three commands for a case, as the orchestrator does; returns the jobs. */
  async function pipeline(c: Case): Promise<TranslationJob[]> {
    const translation = `work/translation-${c.lang}`;
    writeJson(`work/${c.sourceFile}`, c.source);
    writeJson(
      `${translation}/edition.json`,
      translationMeta(c.source.edition.id, c.lang, c.workTitle),
    );

    expect(await runTranslationJobs([`work/${c.sourceFile}`, '--lang', c.lang])).toBe(0);
    jobsOut = out;
    const index = readJson<{ jobs: { jobId: string; file: string }[] }>(
      `${translation}/jobs/index.json`,
    );
    const jobs = index.jobs.map((j) => readJson<TranslationJob>(`${translation}/jobs/${j.file}`));
    expect(jobs.length).toBe(c.texts.length);

    jobs.forEach((job, i) => {
      writeJson(
        `${translation}/final/${job.jobId}.json`,
        finalOutput(job, defined(c.texts[i], 'texts'), c.headings[i]),
      );
    });
    for (const job of jobs) {
      out = '';
      const code = await runTranslationCheck([
        `${translation}/final/${job.jobId}.json`,
        '--job',
        `${translation}/jobs/${job.jobId}.json`,
        '--strict',
      ]);
      expect(code, `${job.jobId}\n${out}`).toBe(0);
    }
    return jobs;
  }

  describe.each(CASES)('$title', (c) => {
    it('makes jobs with the languages and materials of the pair', async () => {
      const jobs = await pipeline(c);
      for (const job of jobs) {
        expect(job.sourceLanguage).toBe(c.source.edition.language);
        expect(job.targetLanguage).toBe(c.lang);
        expect(job.jobId).toMatch(new RegExp(`^${c.source.work.slug}-${c.lang}-\\d{2}-00$`));
        for (const material of Object.values(job.materials)) {
          if (material === null) continue;
          expect(fs.existsSync(path.join(ROOT, material)), material).toBe(true);
        }
        expect(job.materials.rules).toBe(`content/translation/rules-${c.lang}.md`);
        expect(job.materials.glossary).toBe(`content/translation/glossary-${c.lang}.csv`);
        expect(job.materials.calques).toBe(`content/translation/calques-${c.lang}.json`);
      }
    });

    it('checks clean against the materials of the repository, writes the reports', async () => {
      const jobs = await pipeline(c);
      for (const job of jobs) {
        const report = readJson<CheckReport>(`work/translation-${c.lang}/checks/${job.jobId}.json`);
        expect(report).toMatchObject({ ok: true, strictOk: true, file: `final/${job.jobId}.json` });
        // A paragraph full of citations is as long as its translation (the citations are the same
        // in both): the length ratio of the synthetic paragraph is a MINOR finding, nothing else is.
        const open = report.findings.filter((f) => f.severity !== 'INFO');
        expect(open.map((f) => f.check)).toEqual(
          c.slug === 'synthetic-latin-citations' ? ['LENGTH_RATIO'] : [],
        );
      }
    });

    it('merges, names the pair of languages in the sheet and gives a valid translated edition', async () => {
      await pipeline(c);
      out = '';
      expect(await runTranslationMerge(['--work', 'work', '--lang', c.lang])).toBe(0);
      const pack = PackSchema.parse(readJson<unknown>(`work/edition-${c.lang}.json`));
      expect(pack.edition).toMatchObject({
        kind: 'translation',
        language: c.lang,
        sourceEditionId: c.source.edition.id,
      });
      expect(pack.sections.map((s) => s.heading)).toEqual(c.headings);
      expect(pack.paragraphs.map((p) => p.text)).toEqual(c.texts.flat());
      expect(pack.paragraphs.map((p) => p.sourceId)).toEqual(c.source.paragraphs.map((p) => p.id));
      expect(out).toContain(`coverage ${c.texts.length}/${c.texts.length} paragraphs`);
      expect(out).not.toContain('WARNING');

      const review = read(`work/translation-${c.lang}/review.md`);
      expect(review).toContain(`- Languages: ${c.source.edition.language} -> ${c.lang}`);
      if (c.lang === 'en') {
        expect(review).toContain(`# Review sheet: ${c.workTitle ?? 'Synthetic citations'}`);
        expect(review).toContain('| Severity | Section | Paragraph (sourceId) |');
        expect(review).not.toContain('Severitate');
      } else {
        expect(review).toContain(`# Fișă de revizie: ${c.source.work.titleRo}`);
        expect(review).toContain('| Severitate | Secțiune | Paragraf (sourceId) |');
      }
      // repeatable byte for byte
      const snapshot = [read(`work/edition-${c.lang}.json`), review];
      expect(await runTranslationMerge(['--work', 'work', '--lang', c.lang])).toBe(0);
      expect([
        read(`work/edition-${c.lang}.json`),
        read(`work/translation-${c.lang}/review.md`),
      ]).toEqual(snapshot);
    });
  });

  it('writes the title of the work in the language of the translation (workTitle)', async () => {
    const english = defined(CASES[0], 'case');
    await pipeline(english);
    expect(await runTranslationMerge(['--work', 'work', '--lang', 'en'])).toBe(0);
    const pack = PackSchema.parse(readJson<unknown>('work/edition-en.json'));
    expect(pack.work.titleEn).toBe('On the Spirit and the Letter');
    expect(pack.work.titleRo).toBe(english.source.work.titleRo);
    // the id of the edition is stored once and the title survives the write-back
    const meta = readJson<{ workTitle?: string; edition: { id?: string } }>(
      'work/translation-en/edition.json',
    );
    expect(meta.edition.id).toBe(pack.edition.id);
    expect(meta.workTitle).toBe('On the Spirit and the Letter');
  });

  describe('the Latin reference grammar through the commands', () => {
    const synthetic = (lang: 'en' | 'ro') => defined(CASES[lang === 'en' ? 4 : 5], 'case');

    it('puts the converted references and the notes for the translator in the job', async () => {
      const [job] = await pipeline(synthetic('en'));
      const references = defined(job, 'job').paragraphs[0]?.references ?? [];
      expect(references.map((r) => [r.source, r.target])).toEqual([
        ['Rom. v. 12; vi. 3 sqq.', 'Rom. 5:12; 6:3 ff.'],
        ['Ioh. 3, 5; ibid. 8', 'John 3:5; v. 8'],
        ['Ps. 118, 2', 'Ps. 118:2'],
        ['3 Reg. 19, 12', '1 Kings 19:12'],
        ['1 Cor. xv, 22', '1 Cor. 15:22'],
        ['Iud. 5', 'Jude 5'],
      ]);
      expect(references.map((r) => r.canonical)).toEqual([
        ['Rom 5:12', 'Rom 6:3ff'],
        ['John 3:5', 'John 3:8'],
        ['Ps 118:2 vulgate'],
        ['1Kgs 19:12 vulgate'],
        ['1Cor 15:22'],
        ['Jude 5'],
      ]);
      expect(references.map((r) => r.note !== undefined)).toEqual([
        false,
        false,
        true,
        true,
        false,
        true,
      ]);
      expect(references[2]?.note).toMatch(/Vulgate psalm numbering.*do not renumber/);
      expect(references[3]?.note).toMatch(/3 and 4 Reg\. are 1 and 2 Kings/);
      expect(references[5]?.note).toMatch(/Judges is Iudic/);
      expect(jobsOut).toContain('reference runs 6');
      expect(jobsOut).toContain('unparsed reference-like fragments: 0');
    });

    it('writes the same references in Romanian notation for a Romanian translation', async () => {
      const [job] = await pipeline(synthetic('ro'));
      expect(defined(job, 'job').paragraphs[0]?.references.map((r) => r.target)).toEqual([
        'Rom. 5:12; 6:3 ș.urm.',
        'In. 3:5; v. 8',
        'Ps. 118:2',
        '1 Împ. 19:12',
        '1 Cor. 15:22',
        'Iuda 5',
      ]);
    });

    it('fails the check on a renumbered psalm and on roman numerals in the English', async () => {
      const [job] = await pipeline(synthetic('en'));
      const jobFile = `work/translation-en/jobs/${defined(job, 'job').jobId}.json`;
      const finalFile = `work/translation-en/final/${job?.jobId}.json`;
      const broken = finalOutput(
        defined(job, 'job'),
        [SYNTHETIC.en.replace('Ps. 118:2', 'Ps. 119:2').replace('Rom. 5:12', 'Rom. v. 12')],
        'Chapter I',
      );
      writeJson(finalFile, broken);
      out = '';
      expect(await runTranslationCheck([finalFile, '--job', jobFile, '--strict'])).toBe(1);
      expect(out).toMatch(/MAJOR REF_MISSING par-1: .*Ps 118:2/);
      expect(out).toMatch(/MAJOR REF_EXTRA par-1: .*Ps 119:2/);
      expect(out).toMatch(
        /MINOR REF_FORMAT par-1: reference not in English notation: Rom\. v\. 12/,
      );
      expect(await runTranslationCheck([finalFile, '--job', jobFile])).toBe(0); // MAJOR fails only with --strict
    });
  });

  describe('translation-jobs for the pairs', () => {
    it('--lang en works for a Latin and a Greek source, and says when a source has no grammar', async () => {
      writeJson('work/edition-grc.json', creedSource());
      expect(await runTranslationJobs(['work/edition-grc.json', '--lang', 'en'])).toBe(0);
      expect(out).toContain(`${CREED_SLUG}-en-01-00  1  `);
      expect(out).toContain('NOTE: no grammar of scripture references for source language grc');
      out = '';
      writeJson('work/edition-la.json', augustineSource());
      expect(await runTranslationJobs(['work/edition-la.json', '--lang', 'en'])).toBe(0);
      expect(out).not.toContain('NOTE:');
      expect(out).toContain(`${AUGUSTINE_SLUG}-en-01-00  1  210`);
    });

    it('refuses a target language that has no materials, after the edition has been read', async () => {
      writeJson('work/edition-la.json', augustineSource());
      expect(await runTranslationJobs(['work/edition-la.json', '--lang', 'fr'])).toBe(2);
      expect(err).toContain('--lang fr is not a supported target language (supported: ro, en)');
      expect(fs.existsSync(file('work/translation-fr'))).toBe(false);
    });

    it('does not translate a Latin edition into Latin', async () => {
      writeJson('work/edition-la.json', augustineSource());
      expect(await runTranslationJobs(['work/edition-la.json', '--lang', 'la'])).toBe(2);
      expect(err).toContain('language of the source edition');
    });
  });

  describe('translation-check for the pairs', () => {
    it('refuses a job whose target language it has no checks for, as a usage error', async () => {
      const [job] = await pipeline(defined(CASES[0], 'case'));
      const jobFile = `work/translation-en/jobs/${defined(job, 'job').jobId}.json`;
      writeJson(jobFile, { ...job, targetLanguage: 'fr' });
      err = '';
      expect(
        await runTranslationCheck([
          `work/translation-en/final/${job?.jobId}.json`,
          '--job',
          jobFile,
        ]),
      ).toBe(2);
      expect(err).toContain('"fr" is not a supported target language');
    });

    it('reads the tradition of a Latin work from edition-la.json', async () => {
      const [job] = await pipeline(defined(CASES[0], 'case'));
      out = '';
      expect(
        await runTranslationCheck([
          `work/translation-en/final/${defined(job, 'job').jobId}.json`,
          '--job',
          `work/translation-en/jobs/${job?.jobId}.json`,
        ]),
      ).toBe(0);
      expect(out).toContain('tradition undivided');
    });
  });

  describe('translation-merge for the pairs', () => {
    it('refuses a language without materials once the metadata is read', async () => {
      write(
        'work/translation-fr/edition.json',
        JSON.stringify(translationMeta('edition-la', 'en')),
      );
      writeJson('work/translation-fr/edition.json', {
        edition: { ...translationMeta('edition-la', 'en').edition, language: 'fr' },
      });
      writeJson('work/edition-la.json', augustineSource());
      expect(await runTranslationMerge(['--work', 'work', '--lang', 'fr'])).toBe(2);
      expect(err).toContain('"fr" is not a supported target language');
    });

    it('keeps headingRo and headingEn apart: an English merge warns when only headingRo is given', async () => {
      const c = defined(CASES[0], 'case');
      const jobs = await pipeline(c);
      const job = defined(jobs[0], 'job');
      const wrong = { ...finalOutput(job, [AUGUSTINE.en], undefined), headingRo: 'Capitolul I' };
      writeJson(`work/translation-en/final/${job.jobId}.json`, wrong);
      out = '';
      expect(await runTranslationMerge(['--work', 'work', '--lang', 'en', '--allow-critic'])).toBe(
        0,
      );
      expect(out).toMatch(/WARNING: section 1 "Caput I": no headingEn in the part-0 output/);
      expect(PackSchema.parse(readJson<unknown>('work/edition-en.json')).sections[0]?.heading).toBe(
        'Caput I',
      );
    });
  });
});
