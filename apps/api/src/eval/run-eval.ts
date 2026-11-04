import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { buildLibrary } from '../library/library';
import { loadPacks, loadTrustedKeys } from '../library/packs';
import { ASK_CONTENT_DIR, DEFAULT_KEYS_DIR, DEFAULT_PACKS_DIR, REPO_ROOT } from '../paths';
import { parseEvalSet, runEval, serialiseReport } from './eval';
import type { EvalReport, Rate, Summary } from './eval';

// `pnpm --filter @biblioteca/api eval`: runs the questions of content/ask/eval-v0.json through the
// Ask pipeline with the mock provider, prints the structural checks and writes the report to
// content/ask/eval-v0.report.json (no timestamps: the same questions on the same packs give the
// same file, so a change in the report is a change in retrieval or in the content).
//
//   --check        compare with the committed report instead of writing it (exit 1 if it differs)
//   --no-write     print only
//   --set <file>   another evaluation set      --out <file>   another report file
//
// Exit codes: 0 all gates pass; 1 a gate fails or --check finds a difference; 2 cannot run.

const SET_FILE = join(ASK_CONTENT_DIR, 'eval-v0.json');
const REPORT_FILE = join(ASK_CONTENT_DIR, 'eval-v0.report.json');

interface Args {
  check: boolean;
  write: boolean;
  setFile: string;
  outFile: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { check: false, write: true, setFile: SET_FILE, outFile: REPORT_FILE };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--no-write') args.write = false;
    else if (arg === '--set' || arg === '--out') {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} needs a file`);
      if (arg === '--set') args.setFile = value;
      else args.outFile = value;
      i += 1;
    } else throw new Error(`unknown argument ${String(arg)}`);
  }
  return args;
}

const percent = (rate: Rate): string => `${(rate.rate * 100).toFixed(1).padStart(5)}%`;
const fraction = (rate: Rate): string => `${rate.passed}/${rate.total}`;

function table(report: EvalReport): string {
  const rows: Array<[string, (summary: Summary) => string]> = [
    ['questions', (s) => String(s.questions)],
    ['sources present', (s) => `${fraction(s.sourcesPresent)} ${percent(s.sourcesPresent)}`],
    ['with a valid citation', (s) => `${fraction(s.withCitation)} ${percent(s.withCitation)}`],
    ['markers in range', (s) => `${fraction(s.citationsInRange)} ${percent(s.citationsInRange)}`],
    [
      'quotations verified',
      (s) => `${fraction(s.quotationsVerified)} ${percent(s.quotationsVerified)}`,
    ],
    ['expected work hit', (s) => `${fraction(s.expectedWorkHit)} ${percent(s.expectedWorkHit)}`],
    [
      'expected section hit',
      (s) => `${fraction(s.expectedSectionHit)} ${percent(s.expectedSectionHit)}`,
    ],
    [
      'expected section top 3',
      (s) => `${fraction(s.expectedSectionTop3)} ${percent(s.expectedSectionTop3)}`,
    ],
    ['section MRR', (s) => s.sectionMrr.toFixed(3)],
  ];
  const width = Math.max(...rows.map(([label]) => label.length));
  const header = `${''.padEnd(width)}  ${'all'.padEnd(16)}${'ro'.padEnd(16)}en`;
  const lines = rows.map(
    ([label, value]) =>
      `${label.padEnd(width)}  ${value(report.summary.all).padEnd(16)}${value(report.summary.ro).padEnd(16)}${value(report.summary.en)}`,
  );
  return [header, ...lines].join('\n');
}

function print(report: EvalReport): void {
  const { library, languageGap, gates } = report;
  const out = [
    `Evaluation set v0, mock provider: ${report.evalSet.questions} questions on ${library.packs.length} packs (${library.works} works, ${library.paragraphs} paragraphs)`,
    '',
    table(report),
    '',
    `Questions asked in both languages (${languageGap.pairs}): both reach their section ${languageGap.bothHit}, only English ${languageGap.onlyEnglishHit}, only Romanian ${languageGap.onlyRomanianHit}, neither ${languageGap.neitherHit}`,
    '',
    ...gates.map(
      (gate) =>
        `${gate.pass ? 'pass' : 'FAIL'}  ${gate.name}: ${(gate.value * 100).toFixed(1)}% (needs ${(gate.threshold * 100).toFixed(0)}%)  ${gate.meaning}`,
    ),
  ];
  const misses = report.questions.filter((q) => q.expectedSectionHit === false);
  if (misses.length > 0) {
    out.push('', `Questions that reach no expected section (${misses.length}):`);
    for (const miss of misses) {
      out.push(`  ${miss.id}  ${miss.topic}  got sections ${miss.sections.join(', ') || '-'}`);
    }
  }
  process.stdout.write(`${out.join('\n')}\n`);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const keys = loadTrustedKeys(process.env.KEYS_DIR ?? DEFAULT_KEYS_DIR);
  const loaded = loadPacks(process.env.PACKS_DIR ?? DEFAULT_PACKS_DIR, keys.keys);
  const failed = loaded.rejected.filter((entry) => entry.reason !== 'superseded');
  if (failed.length > 0 || loaded.packs.length === 0) {
    process.stderr.write(
      `The packs do not verify, nothing to evaluate: ${JSON.stringify(failed)}\n`,
    );
    return 2;
  }
  const bytes = readFileSync(args.setFile);
  const set = parseEvalSet(JSON.parse(bytes.toString('utf8')) as unknown);
  const report = await runEval(buildLibrary(loaded.packs), set, {
    file: relative(REPO_ROOT, args.setFile).split(sep).join('/'),
    bytes,
    packs: loaded.packs,
  });
  print(report);

  const text = serialiseReport(report);
  if (args.check) {
    const committed = existsSync(args.outFile) ? readFileSync(args.outFile, 'utf8') : '';
    if (committed !== text) {
      process.stderr.write(
        `\n${relative(REPO_ROOT, args.outFile)} is out of date: run pnpm --filter @biblioteca/api eval and commit the result.\n`,
      );
      return 1;
    }
    process.stdout.write(`\n${relative(REPO_ROOT, args.outFile)} is up to date.\n`);
  } else if (args.write) {
    writeFileSync(args.outFile, text);
    process.stdout.write(`\nReport written to ${relative(REPO_ROOT, args.outFile)}.\n`);
  }
  return report.ok ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  },
);
