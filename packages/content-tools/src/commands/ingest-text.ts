import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { PackSchema } from '@biblioteca/shared';

import { parseIngestConfig } from '../ingest/config';
import { ingest } from '../ingest/pipeline';
import { resolveUserPath } from '../lib/paths';
import { ensureIds, loadWorkMeta, saveWorkMeta } from '../work-file';

const USAGE = `Usage: ingest-text <raw.txt> --work <work.json> [options]

Cleans raw pdftotext output into the canonical edition JSON of a work.

Options:
  --work <file>         work.json with the metadata of the work and edition (required)
  --config <file>       cleaning config (default: <work dir>/ingest.config.json)
  --out <file>          canonical output (default: <work dir>/edition-<language>.json)
  --keep-front-matter   keep the text before the first chapter as a "Front matter" section
  --report <file>       write the full ingest report (JSON)
  --verbose             print hyphen decisions, removed foot lines and suspect indents
`;

export async function runIngestText(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      work: { type: 'string' },
      config: { type: 'string' },
      out: { type: 'string' },
      'keep-front-matter': { type: 'boolean', default: false },
      report: { type: 'string' },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const rawArg = positionals[0];
  if (values.help || !rawArg || !values.work) {
    process.stderr.write(USAGE);
    return values.help ? 0 : 1;
  }

  const rawPath = resolveUserPath(rawArg);
  const workPath = resolveUserPath(values.work);
  const workDir = path.dirname(workPath);
  const configPath = values.config
    ? resolveUserPath(values.config)
    : path.join(workDir, 'ingest.config.json');

  const metaFile = loadWorkMeta(workPath);
  const { meta, changed } = ensureIds(metaFile);
  if (changed) {
    saveWorkMeta(workPath, meta);
    process.stdout.write(`Generated stable ids and stored them in ${workPath}\n`);
  }
  const config = parseIngestConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')) as unknown);

  const outPath = values.out
    ? resolveUserPath(values.out)
    : path.join(workDir, `edition-${meta.edition.language}.json`);
  let previous;
  if (fs.existsSync(outPath)) {
    previous = PackSchema.parse(JSON.parse(fs.readFileSync(outPath, 'utf8')) as unknown);
  }

  const { pack, report } = ingest({
    raw: fs.readFileSync(rawPath, 'utf8'),
    config,
    meta,
    keepFrontMatter: values['keep-front-matter'],
    previous,
  });

  fs.writeFileSync(outPath, `${JSON.stringify(pack, null, 2)}\n`);
  if (values.report) {
    fs.writeFileSync(resolveUserPath(values.report), `${JSON.stringify(report, null, 2)}\n`);
  }

  const out = process.stdout;
  out.write(`Wrote ${outPath}\n`);
  out.write(
    `pages ${report.pages} (front matter ${report.frontMatterPages}, body ${report.bodyPages}), ` +
      `chapters ${report.chapters.length}, paragraphs ${report.paragraphs}, ` +
      `mode ${report.paragraphMode}\n`,
  );
  out.write(`running heads removed: ${report.removedHeads} (${report.headFamilies.join('; ')})\n`);
  out.write(`ids reused ${report.idsReused}, created ${report.idsCreated}\n`);
  for (const chapter of report.chapters) {
    out.write(`  ${chapter.heading}: ${chapter.paragraphs} paragraphs\n`);
  }
  for (const warning of report.warnings) out.write(`WARNING: ${warning}\n`);
  if (values.verbose) {
    out.write(`\nFoot lines removed (${report.removedFeet.length}):\n`);
    for (const foot of report.removedFeet) out.write(`  ${foot.text}\n`);
    out.write(`\nIndented lines not accepted as paragraph start (${report.suspects.length}):\n`);
    for (const suspect of report.suspects) out.write(`  p${suspect.page}: ${suspect.text}\n`);
    out.write(`\nHyphen decisions (${report.hyphenChoices.length}):\n`);
    for (const c of report.hyphenChoices) {
      out.write(`  ${c.first}-${c.second}: ${c.decision} (${c.reason})\n`);
    }
  }
  return 0;
}
