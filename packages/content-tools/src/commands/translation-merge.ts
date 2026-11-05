import fs from 'node:fs';
import path from 'node:path';

import { PackSchema } from '@biblioteca/shared';
import type { Pack } from '@biblioteca/shared';

import { parseCommandArgs, runCommand } from '../lib/command';
import { resolveUserPath } from '../lib/paths';
import { UsageError } from '../lib/usage-error';
import { listJsonFiles, readJsonFile, writeJsonFile, writeTextFile } from '../translation/io';
import { targetSpec } from '../translation/languages';
import { mergeTranslation } from '../translation/merge';
import { REVIEW_SEVERITIES } from '../translation/review';
import type { LoadedFile } from '../translation/review';
import {
  CheckReportSchema,
  CriticReportSchema,
  TranslationEditionMetaSchema,
  TranslationOutputSchema,
} from '../translation/schemas';
import type { TranslationEditionMeta } from '../translation/schemas';
import type { z } from 'zod';

const USAGE = `Usage: translation-merge --work <dir> --lang <lang> [options]

Builds the canonical translated edition from the final outputs, 1:1 with the source edition,
and the reviewer's sheet, for any target language of the pipeline (ro, en): the translated
heading of a section is headingRo in a Romanian translation and headingEn in an English one,
the sheet of an English translation is in English, and the header of the sheet names the pair of
languages (source -> target). A translation-<lang>/edition.json with a "workTitle" gives the
title of the work in that language (work.titleEn or work.titleRo of the translated edition).

Reads <work>/translation-<lang>/edition.json (hand-written metadata; names the source edition),
the source edition <work>/edition-*.json with that id, final/*.json, and critic/*.json and
checks/*.json when present. Writes <work>/edition-<lang>.json and
<work>/translation-<lang>/review.md; the edition id is generated once and stored in
translation-<lang>/edition.json. Ids of sections and paragraphs are reused by sourceId.

Options:
  --work <dir>      work directory, content/works/<slug> (required)
  --lang <lang>     target language (required)
  --partial         emit only the sections whose paragraphs are all covered
  --allow-shrink    with --partial, drop sections that the existing edition-<lang>.json already
                    contains but that are not covered now (their ids are lost; without this
                    option such a merge is refused)
  --allow-critic    merge although a CRITIC flag or a CRITIC check finding is open
  -h, --help        this text

Exit codes: 0 merged, 1 refused (missing paragraphs, repeated or unknown sourceId, a --partial
merge that would drop merged sections, open CRITIC; review.md is still written for the last),
2 usage or schema errors.
`;

const OPTIONS = {
  work: { type: 'string' },
  lang: { type: 'string' },
  partial: { type: 'boolean', default: false },
  'allow-shrink': { type: 'boolean', default: false },
  'allow-critic': { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

export async function runTranslationMerge(args: string[]): Promise<number> {
  return runCommand('translation-merge', USAGE, () => translationMerge(args));
}

/** Every `*.json` of `<translationDir>/<folder>`, validated; the file name must be the job id. */
function loadFolder<T extends { jobId: string }>(
  translationDir: string,
  folder: string,
  schema: z.ZodType<T>,
  label: string,
): LoadedFile<T>[] {
  const dir = path.join(translationDir, folder);
  return listJsonFiles(dir).map((name) => {
    const data = readJsonFile(path.join(dir, name), schema, label);
    if (name !== `${data.jobId}.json`) {
      throw new UsageError(
        `${label} ${path.join(dir, name)}: jobId "${data.jobId}" does not match the file name`,
      );
    }
    return { file: `${folder}/${name}`, data };
  });
}

/** The edition file of `workDir` whose id is `editionId` (`edition-<lang>.json`, any language). */
function findSourceEdition(workDir: string, editionId: string, targetLang: string): Pack {
  const candidates = fs
    .readdirSync(workDir)
    .filter((name) => /^edition-.+\.json$/.test(name) && name !== `edition-${targetLang}.json`)
    .sort();
  for (const name of candidates) {
    try {
      const parsed = PackSchema.safeParse(
        JSON.parse(fs.readFileSync(path.join(workDir, name), 'utf8')) as unknown,
      );
      if (parsed.success && parsed.data.edition.id === editionId) return parsed.data;
    } catch {
      // Not a readable edition: it cannot be the one we look for.
    }
  }
  throw new UsageError(
    `no edition-*.json in ${workDir} has the id ${editionId} (the sourceEditionId of the translation metadata)`,
  );
}

function storeEditionId(metaPath: string, meta: TranslationEditionMeta, editionId: string): void {
  const { edition } = meta;
  const stored = TranslationEditionMetaSchema.parse({
    ...(meta.workTitle === undefined ? {} : { workTitle: meta.workTitle }),
    edition: {
      id: editionId,
      language: edition.language,
      kind: edition.kind,
      licence: edition.licence,
      provenance: edition.provenance,
      sourceEditionId: edition.sourceEditionId,
    },
  });
  writeJsonFile(metaPath, stored);
}

function translationMerge(args: string[]): number {
  const { values, positionals } = parseCommandArgs(args, OPTIONS);
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (!values.work || !values.lang) throw new UsageError('missing arguments', true);
  if (positionals.length > 0) throw new UsageError(`unexpected argument "${positionals[0]}"`, true);
  const lang = values.lang;
  if (!/^[a-z]{2,3}(?:-[a-z0-9]+)*$/.test(lang)) {
    throw new UsageError(`--lang "${lang}" is not a language code (expected e.g. ro)`);
  }

  const workDir = resolveUserPath(values.work);
  const translationDir = path.join(workDir, `translation-${lang}`);
  const metaPath = path.join(translationDir, 'edition.json');
  const meta = readJsonFile(metaPath, TranslationEditionMetaSchema, 'translation metadata');
  if (meta.edition.language !== lang) {
    throw new UsageError(
      `${metaPath}: edition.language is "${meta.edition.language}", expected "${lang}"`,
    );
  }
  targetSpec(lang); // a language the pipeline has no materials for is a usage error
  const source = findSourceEdition(workDir, meta.edition.sourceEditionId, lang);
  const editionPath = path.join(workDir, `edition-${lang}.json`);
  const previous = fs.existsSync(editionPath)
    ? readJsonFile(editionPath, PackSchema, 'existing translated edition')
    : undefined;

  const result = mergeTranslation({
    source,
    meta,
    previous,
    finals: loadFolder(translationDir, 'final', TranslationOutputSchema, 'final output'),
    critics: loadFolder(translationDir, 'critic', CriticReportSchema, 'critic report'),
    checks: loadFolder(translationDir, 'checks', CheckReportSchema, 'check report'),
    partial: values.partial,
    allowShrink: values['allow-shrink'],
    allowCritic: values['allow-critic'],
  });

  const out = process.stdout;
  for (const warning of result.warnings) out.write(`WARNING: ${warning}\n`);
  const { paragraphs, sections } = result.coverage;
  const reviewPath = path.join(translationDir, 'review.md');

  if (!result.pack) {
    process.stderr.write(`translation-merge: refused, nothing written to ${editionPath}\n`);
    for (const problem of result.problems) process.stderr.write(`  ${problem}\n`);
    if (result.review !== undefined) {
      writeTextFile(reviewPath, result.review);
      process.stderr.write(
        `  the review sheet lists them: ${reviewPath} (--allow-critic merges anyway)\n`,
      );
    }
    return 1;
  }

  if (result.editionIdSource !== 'meta') {
    storeEditionId(metaPath, meta, result.editionId);
    out.write(
      `Stored the edition id of the translation in ${metaPath} (${result.editionIdSource})\n`,
    );
  }
  writeJsonFile(editionPath, result.pack);
  writeTextFile(reviewPath, result.review ?? '');
  out.write(
    `coverage ${paragraphs[0]}/${paragraphs[1]} paragraphs, ${sections[0]}/${sections[1]} sections\n`,
  );
  out.write(`findings ${REVIEW_SEVERITIES.map((s) => `${s} ${result.counts[s]}`).join(', ')}\n`);
  out.write(`wrote ${editionPath}\n`);
  out.write(`wrote ${reviewPath}\n`);
  return 0;
}
