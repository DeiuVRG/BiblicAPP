import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PackSchema } from '@biblioteca/shared';
import type { Pack } from '@biblioteca/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defined } from '../lib/invariant';
import { generateKeyPair, buildPack, toBase64, verifyPackBytes } from '../signing';
import { RO, goodOutput, makeJobs, makeSource, metaFor } from '../translation/test-support';
import type { TranslationJob, TranslationOutput } from '../translation/schemas';
import { runTranslationCheck } from './translation-check';
import { runTranslationJobs } from './translation-jobs';
import { runTranslationMerge } from './translation-merge';

const GLOSSARY_HEADER = 'term_id,source_pattern,target_pattern,tradition,scope,force,status,note';

describe('translation commands end to end', () => {
  let dir: string;
  let previousInitCwd: string | undefined;
  let out: string;
  let err: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-translation-'));
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
    write('work/edition-en.json', `${JSON.stringify(makeSource(), null, 2)}\n`);
    write('work/translation-ro/edition.json', `${JSON.stringify(metaFor(), null, 2)}\n`);
    write('materials/glossary.csv', `${GLOSSARY_HEADER}\n`);
    write('materials/calques.json', '[]\n');
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
  const jobs = (): TranslationJob[] => makeJobs();
  const finalOf = (job: TranslationJob): string => `work/translation-ro/final/${job.jobId}.json`;
  const jobsRun = (...extra: string[]) =>
    runTranslationJobs(['work/edition-en.json', '--lang', 'ro', ...extra]);
  const checkArgs = (job: TranslationJob, ...extra: string[]) => [
    finalOf(job),
    '--job',
    `work/translation-ro/jobs/${job.jobId}.json`,
    '--glossary',
    'materials/glossary.csv',
    '--calques',
    'materials/calques.json',
    ...extra,
  ];
  function writeFinals(edit: (output: TranslationOutput) => void = () => undefined): void {
    for (const job of jobs()) {
      const output = goodOutput(job);
      edit(output);
      writeJson(finalOf(job), output);
    }
  }
  const mergeRun = (...extra: string[]) =>
    runTranslationMerge(['--work', 'work', '--lang', 'ro', ...extra]);

  describe('translation-jobs', () => {
    it('writes the jobs and the index, and is deterministic', async () => {
      expect(await jobsRun()).toBe(0);
      expect(out).toContain('fixture-work-ro-01-00  3  ');
      expect(out).toContain('jobs 2, paragraphs 5, words ');
      expect(out).toContain('unparsed reference-like fragments: 0');
      const names = fs.readdirSync(file('work/translation-ro/jobs')).sort();
      expect(names).toEqual([
        'fixture-work-ro-01-00.json',
        'fixture-work-ro-02-00.json',
        'index.json',
      ]);
      const index = readJson<{ sourceSha256: string; jobs: { jobId: string }[] }>(
        'work/translation-ro/jobs/index.json',
      );
      expect(index.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(index.jobs.map((j) => j.jobId)).toEqual(jobs().map((j) => j.jobId));
      const before = names.map((n) => read(`work/translation-ro/jobs/${n}`));
      expect(await jobsRun()).toBe(0);
      expect(names.map((n) => read(`work/translation-ro/jobs/${n}`))).toEqual(before);
    });

    it('honours --out, --sections and --verbose', async () => {
      expect(await jobsRun('--out', 'elsewhere', '--sections', '2', '--verbose')).toBe(0);
      expect(fs.readdirSync(file('elsewhere/jobs')).sort()).toEqual([
        'fixture-work-ro-02-00.json',
        'index.json',
      ]);
      expect(out).toContain('Reference conversions');
      expect(out).toContain('Mat. 16:18 și 18:17');
      expect(out).toContain('Reference-like fragments that did not parse:\n  none');
      expect(fs.existsSync(file('work/translation-ro'))).toBe(true); // untouched fixture
      expect(fs.existsSync(file('work/translation-ro/jobs'))).toBe(false);
    });

    it('splits by --target-words', async () => {
      expect(
        await jobsRun('--target-words', '20', '--max-words', '100', '--min-last-words', '0'),
      ).toBe(0);
      const index = readJson<{ jobs: unknown[] }>('work/translation-ro/jobs/index.json');
      expect(index.jobs.length).toBeGreaterThan(2);
    });

    it('prints the usage on --help (0) and on missing arguments (2)', async () => {
      expect(await runTranslationJobs(['--help'])).toBe(0);
      expect(out).toContain('Usage: translation-jobs');
      out = '';
      expect(await runTranslationJobs([])).toBe(2);
      expect(err).toContain('missing arguments');
      expect(err).toContain('Usage: translation-jobs');
    });

    it('reports bad input as usage errors with exit code 2', async () => {
      const cases: [string[], RegExp][] = [
        [['work/edition-en.json', '--lang', 'ro', '--frobnicate'], /Unknown option/],
        [['work/edition-en.json', '--lang', 'RO!'], /not a language code/],
        [['work/edition-en.json', '--lang', 'en'], /language of the source edition/],
        [['work/edition-en.json', '--lang', 'ro', '--sections', '9'], /no chapter 9/],
        [['work/edition-en.json', '--lang', 'ro', '--sections', 'x'], /--sections/],
        [['work/edition-en.json', '--lang', 'ro', '--target-words', 'many'], /whole number/],
        [['work/edition-en.json', '--lang', 'ro', '--target-words', '5000'], /must not exceed/],
        [['work/missing.json', '--lang', 'ro'], /file not found/],
        [['work/translation-ro/edition.json', '--lang', 'fr'], /edition\.language|id/],
        [['work/edition-en.json', 'extra.json', '--lang', 'ro'], /unexpected argument/],
      ];
      for (const [args, message] of cases) {
        err = '';
        expect(await runTranslationJobs(args), args.join(' ')).toBe(2);
        expect(err, args.join(' ')).toMatch(message);
      }
      write('work/broken.json', '{');
      err = '';
      expect(await runTranslationJobs(['work/broken.json', '--lang', 'ro'])).toBe(2);
      expect(err).toContain('invalid JSON');
    });

    it('refuses a translation as input', async () => {
      const translation: Pack = {
        ...makeSource(),
        edition: {
          ...makeSource().edition,
          kind: 'translation',
          language: 'de',
          sourceEditionId: 'x',
        },
      };
      writeJson('work/edition-de.json', translation);
      expect(await runTranslationJobs(['work/edition-de.json', '--lang', 'ro'])).toBe(2);
      expect(err).toContain('expected a source edition');
    });
  });

  describe('translation-check', () => {
    beforeEach(async () => {
      expect(await jobsRun()).toBe(0);
      out = '';
    });

    it('passes a clean final output, writes the report next to the jobs and prints a summary', async () => {
      writeFinals();
      const [job] = jobs();
      if (!job) throw new Error('fixture');
      expect(await runTranslationCheck(checkArgs(job))).toBe(0);
      expect(out).toMatch(
        /^ok {2}fixture-work-ro-01-00 {2}final\/fixture-work-ro-01-00\.json {2}CRITIC 0, MAJOR 0, MINOR 0, INFO 0\n/,
      );
      expect(out).toContain('tradition protestant');
      const report = readJson<{
        ok: boolean;
        strictOk: boolean;
        file: string;
        findings: unknown[];
      }>(`work/translation-ro/checks/${job.jobId}.json`);
      expect(report).toMatchObject({
        ok: true,
        strictOk: true,
        file: `final/${job.jobId}.json`,
        findings: [],
      });
    });

    it('exits 1 on a CRITIC finding, still writes the report and prints one line per finding', async () => {
      writeFinals((output) => {
        output.paragraphs = output.paragraphs.filter((p) => p.sourceId !== 'src-a2');
      });
      const [job] = jobs();
      if (!job) throw new Error('fixture');
      expect(await runTranslationCheck(checkArgs(job))).toBe(1);
      expect(out).toContain('FAIL  fixture-work-ro-01-00');
      expect(out).toMatch(/^CRITIC PARITY_MISSING src-a2: no output for source paragraph 2/m);
      const report = readJson<{ ok: boolean }>(`work/translation-ro/checks/${job.jobId}.json`);
      expect(report.ok).toBe(false);
    });

    it('fails on MAJOR findings only with --strict', async () => {
      writeFinals((output) => {
        delete output.headingRo;
      });
      const [job] = jobs();
      if (!job) throw new Error('fixture');
      expect(await runTranslationCheck(checkArgs(job))).toBe(0);
      expect(out).toContain('MAJOR HEADING_MISSING -:');
      expect(await runTranslationCheck(checkArgs(job, '--strict'))).toBe(1);
    });

    it('--fix rewrites the output file and keeps the fixed findings in the report', async () => {
      writeFinals((output) => {
        const p = output.paragraphs.find((x) => x.sourceId === 'src-a3');
        if (p) p.text = `  ${RO['src-a3'] ?? ''}  ${'ş'}i   încă. `;
      });
      const [job] = jobs();
      if (!job) throw new Error('fixture');
      expect(await runTranslationCheck(checkArgs(job, '--fix'))).toBe(0);
      expect(out).toMatch(/MINOR CEDILLA src-a3: .* \[autofixed\]/);
      const fixed = readJson<TranslationOutput>(finalOf(job));
      expect(fixed.paragraphs.find((p) => p.sourceId === 'src-a3')?.text).toBe(
        `${RO['src-a3'] ?? ''} și încă.`,
      );
      expect(read(finalOf(job)).endsWith('}\n')).toBe(true);
      out = '';
      expect(await runTranslationCheck(checkArgs(job, '--fix'))).toBe(0);
      expect(out).not.toContain('CEDILLA');
    });

    it('writes the report to --report', async () => {
      writeFinals();
      const [job] = jobs();
      if (!job) throw new Error('fixture');
      expect(await runTranslationCheck(checkArgs(job, '--report', 'reports/one.json'))).toBe(0);
      expect(fs.existsSync(file('reports/one.json'))).toBe(true);
      expect(fs.existsSync(file(`work/translation-ro/checks/${job.jobId}.json`))).toBe(false);
    });

    it('exits 2 on a schema error that names the path of the value', async () => {
      writeFinals();
      const [job] = jobs();
      if (!job) throw new Error('fixture');
      const output = readJson<TranslationOutput>(finalOf(job));
      const broken = {
        ...output,
        paragraphs: output.paragraphs.map((p, i) => (i === 1 ? { ...p, text: '' } : p)),
      };
      writeJson(finalOf(job), broken);
      expect(await runTranslationCheck(checkArgs(job))).toBe(2);
      expect(err).toContain('paragraphs[1].text');
      expect(fs.existsSync(file(`work/translation-ro/checks/${job.jobId}.json`))).toBe(false);
      writeJson(finalOf(job), { ...output, invented: true });
      err = '';
      expect(await runTranslationCheck(checkArgs(job))).toBe(2);
      expect(err).toContain('Unrecognized key: "invented"');
    });

    it('exits 2 on a missing glossary, a bad pattern and an output for another job', async () => {
      writeFinals();
      const [job, other] = jobs();
      if (!job || !other) throw new Error('fixture');
      const args = checkArgs(job);
      err = '';
      expect(
        await runTranslationCheck([
          ...args.slice(0, 3),
          '--glossary',
          'materials/nope.csv',
          '--calques',
          'materials/calques.json',
        ]),
      ).toBe(2);
      expect(err).toMatch(/glossary not found: .*nope\.csv/);

      write('materials/bad.csv', `${GLOSSARY_HEADER}\nx,a(,b,all,all,WARN,APROBAT,\n`);
      err = '';
      expect(
        await runTranslationCheck([
          ...args.slice(0, 3),
          '--glossary',
          'materials/bad.csv',
          '--calques',
          'materials/calques.json',
        ]),
      ).toBe(2);
      expect(err).toMatch(/invalid regular expression/);

      write(
        'materials/bad.json',
        JSON.stringify([{ id: 'x', pattern: '[', level: 'WARN', preferred: '' }]),
      );
      err = '';
      expect(
        await runTranslationCheck([...args.slice(0, 5), '--calques', 'materials/bad.json']),
      ).toBe(2);
      expect(err).toMatch(/invalid regular expression/);

      err = '';
      expect(await runTranslationCheck([finalOf(other), ...args.slice(1)])).toBe(2);
      expect(err).toContain(`answers job "${other.jobId}", not "${job.jobId}"`);
    });

    it('prints the usage on --help (0) and on missing arguments (2)', async () => {
      expect(await runTranslationCheck(['--help'])).toBe(0);
      expect(out).toContain('Usage: translation-check');
      expect(await runTranslationCheck(['only-output.json'])).toBe(2);
      expect(err).toContain('missing arguments');
    });
  });

  describe('translation-merge', () => {
    beforeEach(async () => {
      expect(await jobsRun()).toBe(0);
      out = '';
    });

    it('merges, stores the edition id once, writes the sheet and is repeatable byte for byte', async () => {
      writeFinals();
      expect(await mergeRun()).toBe(0);
      expect(out).toContain('coverage 5/5 paragraphs, 2/2 sections');
      expect(out).toContain('Stored the edition id of the translation');
      const pack = PackSchema.parse(readJson<unknown>('work/edition-ro.json'));
      expect(pack.edition).toMatchObject({
        kind: 'translation',
        language: 'ro',
        sourceEditionId: 'edition-en',
      });
      const meta = readJson<{ edition: { id?: string } }>('work/translation-ro/edition.json');
      expect(meta.edition.id).toBe(pack.edition.id);
      expect(read('work/edition-ro.json').endsWith('}\n')).toBe(true);
      expect(read('work/translation-ro/review.md')).toContain(
        '| Severitate | Secțiune | Paragraf (sourceId) |',
      );

      const snapshot = [
        read('work/edition-ro.json'),
        read('work/translation-ro/review.md'),
        read('work/translation-ro/edition.json'),
      ];
      out = '';
      expect(await mergeRun()).toBe(0);
      expect(out).not.toContain('Stored the edition id');
      expect([
        read('work/edition-ro.json'),
        read('work/translation-ro/review.md'),
        read('work/translation-ro/edition.json'),
      ]).toEqual(snapshot);
    });

    it('produces an edition that build-pack accepts and verify-pack verifies', async () => {
      writeFinals();
      expect(await mergeRun()).toBe(0);
      const pack = PackSchema.parse(readJson<unknown>('work/edition-ro.json'));
      const pair = generateKeyPair();
      const built = buildPack({
        pack,
        secretKey: pair.secretKey,
        signingKeyId: 'test-1',
        packId: 'fixture-work-ro',
        version: '1.0.0',
        revision: 1,
        createdAt: '2026-11-04T00:00:00.000Z',
        minAppVersion: '0.1.0',
      });
      const verified = verifyPackBytes({
        packBytes: built.packBytes,
        manifest: built.manifest,
        trustedKeys: [{ id: 'test-1', publicKey: toBase64(pair.publicKey) }],
      });
      expect(verified.ok).toBe(true);
    });

    it('refuses when paragraphs are missing, writes nothing and lists them', async () => {
      writeFinals();
      fs.rmSync(file(finalOf(defined(jobs()[1], 'second job'))));
      expect(await mergeRun()).toBe(1);
      expect(err).toContain('refused');
      expect(err).toMatch(/section 2 "II\. The Church": 2 of 2 paragraphs/);
      expect(fs.existsSync(file('work/edition-ro.json'))).toBe(false);
      expect(fs.existsSync(file('work/translation-ro/review.md'))).toBe(false);
      expect(
        readJson<{ edition: { id?: string } }>('work/translation-ro/edition.json').edition.id,
      ).toBeUndefined();
    });

    it('merges what is covered with --partial', async () => {
      writeFinals();
      fs.rmSync(file(finalOf(defined(jobs()[1], 'second job'))));
      expect(await mergeRun('--partial')).toBe(0);
      const pack = PackSchema.parse(readJson<unknown>('work/edition-ro.json'));
      expect(pack.sections).toHaveLength(1);
      expect(pack.edition.provenance.notes).toBe('Draft. Partial translation: 1 of 2 sections.');
      expect(out).toContain('coverage 3/5 paragraphs, 1/2 sections');
    });

    it('prints a warning when headingRo is missing and uses the source heading', async () => {
      writeFinals((output) => {
        delete output.headingRo;
      });
      expect(await mergeRun()).toBe(0);
      expect(out).toMatch(/WARNING: section 1 .* no headingRo/);
      expect(PackSchema.parse(readJson<unknown>('work/edition-ro.json')).sections[0]?.heading).toBe(
        'I. The Kingdom Announced',
      );
    });

    it('refuses a CRITIC flag, still writes the sheet, and merges with --allow-critic', async () => {
      writeFinals((output) => {
        const p = output.paragraphs.find((x) => x.sourceId === 'src-a2');
        if (p) p.flags = [{ code: 'AMBIGUITATE', severity: 'CRITIC', note: 'cannot be rendered' }];
      });
      expect(await mergeRun()).toBe(1);
      expect(err).toMatch(/open CRITIC finding \(revised\) section 1, src-a2/);
      expect(fs.existsSync(file('work/edition-ro.json'))).toBe(false);
      expect(read('work/translation-ro/review.md')).toContain('| CRITIC | 1 | 2 (src-a2) |');
      expect(await mergeRun('--allow-critic')).toBe(0);
      expect(fs.existsSync(file('work/edition-ro.json'))).toBe(true);
    });

    it('exits 2 on usage and input errors', async () => {
      writeFinals();
      const cases: [string[], RegExp][] = [
        [[], /missing arguments/],
        [['--work', 'work'], /missing arguments/],
        [['--work', 'work', '--lang', 'ro', 'x'], /unexpected argument/],
        [['--work', 'work', '--lang', 'fr'], /translation metadata .*file not found/],
        [['--work', 'nowhere', '--lang', 'ro'], /file not found/],
      ];
      for (const [args, message] of cases) {
        err = '';
        expect(await runTranslationMerge(args), args.join(' ')).toBe(2);
        expect(err, args.join(' ')).toMatch(message);
      }

      writeJson('work/translation-ro/edition.json', {
        edition: { ...metaFor().edition, sourceEditionId: 'unknown-edition' },
      });
      err = '';
      expect(await mergeRun()).toBe(2);
      expect(err).toContain('has the id unknown-edition');

      writeJson('work/translation-ro/edition.json', metaFor());
      const first = defined(jobs()[0], 'first job');
      writeJson(finalOf(first), {
        ...goodOutput(first),
        paragraphs: [{ sourceId: 'src-a1', text: '' }],
      });
      err = '';
      expect(await mergeRun()).toBe(2);
      expect(err).toContain('paragraphs[0].text');

      writeJson(finalOf(first), goodOutput(first));
      write('work/translation-ro/final/other-name.json', read(finalOf(first)));
      err = '';
      expect(await mergeRun()).toBe(2);
      expect(err).toContain('does not match the file name');
    });
  });
});
