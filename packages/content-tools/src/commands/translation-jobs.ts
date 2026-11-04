import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PackSchema } from '@biblioteca/shared';

import { parseCommandArgs, parseIntegerOption, runCommand } from '../lib/command';
import { resolveUserPath } from '../lib/paths';
import { UsageError } from '../lib/usage-error';
import { sha256Hex } from '../signing';
import { parseJsonText, parseWith, readBytesFile, writeJsonFile } from '../translation/io';
import { DEFAULT_CHUNK, buildJobs, parseSectionList } from '../translation/jobs';

const USAGE = `Usage: translation-jobs <edition-source.json> --lang <lang> [options]

Splits a canonical source edition into translation jobs: parts of a section of about
--target-words words, never splitting a paragraph, each paragraph with its scripture
references converted to the target notation and the neighbouring text as context.

Options:
  --lang <lang>           target language, e.g. ro (required)
  --out <dir>             translation directory (default: <work dir>/translation-<lang>);
                          writes <dir>/jobs/index.json and <dir>/jobs/<jobId>.json
  --sections <list>       chapters to include, 1-based: 1,2,5-7 (default: all)
  --target-words <n>      close a part at this many words (default: ${DEFAULT_CHUNK.targetWords})
  --max-words <n>         a part never exceeds this, except a single longer paragraph
                          (default: ${DEFAULT_CHUNK.maxWords})
  --min-last-words <n>    a shorter final part is merged into the previous one when the sum
                          stays within max + min (default: ${DEFAULT_CHUNK.minLastWords})
  --verbose               list every reference conversion and every reference-like fragment
                          that did not parse
  -h, --help              this text

Prints one line per job: jobId, paragraphs, words. Existing job files are overwritten.
Exit codes: 0 done, 2 usage error.
`;

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const OPTIONS = {
  lang: { type: 'string' },
  out: { type: 'string' },
  sections: { type: 'string' },
  'target-words': { type: 'string' },
  'max-words': { type: 'string' },
  'min-last-words': { type: 'string' },
  verbose: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

export async function runTranslationJobs(args: string[]): Promise<number> {
  return runCommand('translation-jobs', USAGE, () => translationJobs(args));
}

function translationJobs(args: string[]): number {
  const { values, positionals } = parseCommandArgs(args, OPTIONS);
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const [editionArg, ...extra] = positionals;
  if (!editionArg || !values.lang) throw new UsageError('missing arguments', true);
  if (extra.length > 0) throw new UsageError(`unexpected argument "${extra[0]}"`, true);

  const lang = values.lang;
  if (!/^[a-z]{2,3}(?:-[a-z0-9]+)*$/.test(lang)) {
    throw new UsageError(`--lang "${lang}" is not a language code (expected e.g. ro)`);
  }
  const chunk = {
    targetWords: parseIntegerOption(
      'target-words',
      values['target-words'],
      DEFAULT_CHUNK.targetWords,
      1,
    ),
    maxWords: parseIntegerOption('max-words', values['max-words'], DEFAULT_CHUNK.maxWords, 1),
    minLastWords: parseIntegerOption(
      'min-last-words',
      values['min-last-words'],
      DEFAULT_CHUNK.minLastWords,
      0,
    ),
  };
  if (chunk.targetWords > chunk.maxWords) {
    throw new UsageError(
      `--target-words (${chunk.targetWords}) must not exceed --max-words (${chunk.maxWords})`,
    );
  }
  const wanted = values.sections === undefined ? undefined : parseSectionList(values.sections);

  const editionPath = resolveUserPath(editionArg);
  const bytes = readBytesFile(editionPath, 'source edition');
  const where = `source edition ${editionPath}`;
  const edition = parseWith(PackSchema, parseJsonText(bytes.toString('utf8'), where), where);
  if (edition.edition.kind !== 'source') {
    throw new UsageError(
      `${editionPath} is a ${edition.edition.kind} edition; expected a source edition`,
    );
  }
  if (edition.edition.language === lang) {
    throw new UsageError(`--lang ${lang} is the language of the source edition`);
  }
  if (wanted) {
    const available = edition.sections.length;
    const beyond = [...wanted].filter((n) => n > available);
    if (beyond.length > 0) {
      throw new UsageError(
        `--sections: no chapter ${beyond.join(', ')} (the edition has ${available})`,
      );
    }
  }

  const outDir = values.out
    ? resolveUserPath(values.out)
    : path.join(path.dirname(editionPath), `translation-${lang}`);
  const jobsDir = path.join(outDir, 'jobs');
  const built = buildJobs({
    edition,
    targetLanguage: lang,
    chunk,
    ...(wanted ? { sections: wanted } : {}),
    repoRoot: REPO_ROOT,
    sourceSha256: sha256Hex(new Uint8Array(bytes)),
  });

  fs.mkdirSync(jobsDir, { recursive: true });
  for (const job of built.jobs) writeJsonFile(path.join(jobsDir, `${job.jobId}.json`), job);
  writeJsonFile(path.join(jobsDir, 'index.json'), built.index);

  const out = process.stdout;
  for (const job of built.jobs) {
    out.write(`${job.jobId}  ${job.paragraphs.length}  ${job.wordCount}\n`);
  }
  const paragraphs = built.jobs.reduce((sum, job) => sum + job.paragraphs.length, 0);
  const words = built.jobs.reduce((sum, job) => sum + job.wordCount, 0);
  const fragments = built.unparsed.reduce((sum, entry) => sum + entry.fragments.length, 0);
  out.write(
    `jobs ${built.jobs.length}, paragraphs ${paragraphs}, words ${words}, ` +
      `reference runs ${built.referenceRuns}\n`,
  );
  out.write(`unparsed reference-like fragments: ${fragments}\n`);
  for (const section of built.emptySections) {
    out.write(
      `WARNING: section ${section.ordinal + 1} "${section.heading}" has no paragraphs and produces no job\n`,
    );
  }
  if (values.verbose) writeVerbose(built);
  out.write(`wrote ${jobsDir}\n`);
  return 0;
}

function writeVerbose(built: ReturnType<typeof buildJobs>): void {
  const out = process.stdout;
  out.write('\nReference conversions (source -> target | canonical):\n');
  for (const job of built.jobs) {
    for (const paragraph of job.paragraphs) {
      for (const reference of paragraph.references) {
        out.write(
          `  ${job.jobId} p${paragraph.ordinal + 1}: ${reference.source} -> ${reference.target} | ` +
            `${reference.canonical.join(' ')}\n`,
        );
      }
    }
  }
  out.write('\nReference-like fragments that did not parse:\n');
  if (built.unparsed.length === 0) out.write('  none\n');
  for (const entry of built.unparsed) {
    for (const fragment of entry.fragments) {
      out.write(`  ${entry.jobId} ${entry.sourceId} @${fragment.index}: ${fragment.text}\n`);
    }
  }
}
