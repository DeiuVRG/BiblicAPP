import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { parseCommandArgs, runCommand } from '../lib/command';
import { resolveUserPath } from '../lib/paths';
import { UsageError } from '../lib/usage-error';
import { checkOutput, loadCalques, loadGlossary } from '../translation/checks';
import { readJsonFile, toPosix, writeJsonFile } from '../translation/io';
import { SEVERITIES, TranslationJobSchema, TranslationOutputSchema } from '../translation/schemas';
import type { CheckReport, TranslationJob } from '../translation/schemas';

const USAGE = `Usage: translation-check <output.json> --job <job.json> [options]

Deterministic checks of a translation output (draft or final) against its job: paragraph
parity, empty or untranslated text, Greek, English residue, scripture references, length,
calques and glossary, numbers, quotation marks and typography. Checks find anomalies; they
do not decide exegesis.

Options:
  --job <file>        the job the output answers (required)
  --fix               apply the safe auto-fixes (NFC, cedilla to comma-below, white space)
                      and write the output file back
  --glossary <file>   glossary CSV (default: the one named by the job's materials)
  --calques <file>    calques JSON (default: the one named by the job's materials)
  --report <file>     check report (default: <job dir>/../checks/<jobId>.json); always written
  --strict            MAJOR findings fail as well
  -h, --help          this text

Glossary rows apply when their scope is "all" or the work slug and their tradition is "all",
"undivided" or the tradition of the work (work.author.tradition of <work>/edition-<lang>.json,
found next to translation-<lang>/; when it is not found only "all" and "undivided" rows apply).
Patterns are regular expressions (flags iu) without commas; \b is Unicode-aware.

Prints a summary and one line per finding: SEVERITY CHECK sourceId: message.
Exit codes: 0 no CRITIC finding (with --strict also no MAJOR), 1 otherwise, 2 usage or
schema errors (the message names the path of the offending value).
`;

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const OPTIONS = {
  job: { type: 'string' },
  fix: { type: 'boolean', default: false },
  glossary: { type: 'string' },
  calques: { type: 'string' },
  report: { type: 'string' },
  strict: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

const TraditionOnly = z.object({ work: z.object({ author: z.object({ tradition: z.string() }) }) });

/** The tradition of the work, read from the source edition next to `translation-<lang>/`. */
function readTradition(jobPath: string, job: TranslationJob): string | undefined {
  const edition = path.join(
    path.dirname(jobPath),
    '..',
    '..',
    `edition-${job.sourceLanguage}.json`,
  );
  try {
    const parsed = TraditionOnly.safeParse(JSON.parse(fs.readFileSync(edition, 'utf8')) as unknown);
    return parsed.success ? parsed.data.work.author.tradition : undefined;
  } catch {
    return undefined;
  }
}

/** Path of the checked file relative to the translation directory, with forward slashes. */
function reportedFile(jobPath: string, outputPath: string): string {
  const relative = path.relative(path.resolve(path.dirname(jobPath), '..'), outputPath);
  return relative.startsWith('..') || path.isAbsolute(relative)
    ? path.basename(outputPath)
    : toPosix(relative);
}

function materialPath(option: string | undefined, named: string): string {
  return option ? resolveUserPath(option) : path.join(REPO_ROOT, named);
}

function requireFile(file: string, kind: 'glossary' | 'calques'): string {
  if (!fs.existsSync(file)) {
    throw new UsageError(
      `${kind} not found: ${file} (named by the job; --${kind} <file> overrides it)`,
    );
  }
  return file;
}

export async function runTranslationCheck(args: string[]): Promise<number> {
  return runCommand('translation-check', USAGE, () => translationCheck(args));
}

function translationCheck(args: string[]): number {
  const { values, positionals } = parseCommandArgs(args, OPTIONS);
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const [outputArg, ...extra] = positionals;
  if (!outputArg || !values.job) throw new UsageError('missing arguments', true);
  if (extra.length > 0) throw new UsageError(`unexpected argument "${extra[0]}"`, true);

  const outputPath = resolveUserPath(outputArg);
  const jobPath = resolveUserPath(values.job);
  const job = readJsonFile(jobPath, TranslationJobSchema, 'job');
  const output = readJsonFile(outputPath, TranslationOutputSchema, 'output');
  if (output.jobId !== job.jobId) {
    throw new UsageError(`output ${outputPath} answers job "${output.jobId}", not "${job.jobId}"`);
  }
  const glossary = loadGlossary(
    requireFile(materialPath(values.glossary, job.materials.glossary), 'glossary'),
  );
  const calques = loadCalques(
    requireFile(materialPath(values.calques, job.materials.calques), 'calques'),
  );
  const tradition = readTradition(jobPath, job);

  const result = checkOutput({
    job,
    output,
    file: reportedFile(jobPath, outputPath),
    glossary,
    calques,
    tradition,
    fix: values.fix,
  });
  if (values.fix && result.changed) writeJsonFile(outputPath, result.output);

  const reportPath = values.report
    ? resolveUserPath(values.report)
    : path.resolve(path.dirname(jobPath), '..', 'checks', `${job.jobId}.json`);
  writeJsonFile(reportPath, result.report);

  const passed = values.strict ? result.report.strictOk : result.report.ok;
  printReport(result.report, passed, tradition, reportPath);
  return passed ? 0 : 1;
}

function printReport(
  report: CheckReport,
  passed: boolean,
  tradition: string | undefined,
  reportPath: string,
): void {
  const out = process.stdout;
  const counts = SEVERITIES.map(
    (severity) => `${severity} ${report.findings.filter((f) => f.severity === severity).length}`,
  ).join(', ');
  out.write(`${passed ? 'ok' : 'FAIL'}  ${report.jobId}  ${report.file}  ${counts}\n`);
  const { stats } = report;
  out.write(
    `paragraphs ${stats.paragraphs}, source words ${stats.sourceWords}, target words ` +
      `${stats.targetWords}, length ratio ${stats.lengthRatio}, tradition ${tradition ?? 'unknown'}\n`,
  );
  for (const found of report.findings) {
    const fixed = found.autofixed === true ? ' [autofixed]' : '';
    out.write(
      `${found.severity} ${found.check} ${found.sourceId ?? '-'}: ${found.message}${fixed}\n`,
    );
  }
  out.write(`report ${reportPath}\n`);
}
