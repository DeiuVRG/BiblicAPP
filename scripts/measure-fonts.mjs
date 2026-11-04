#!/usr/bin/env node
// Measures the fonts that the web export ships (docs/ui-spec-v2.md, section 2.2: "the shipped TTF
// total is measured in CI and printed in the README"):
//
//   node scripts/measure-fonts.mjs [--dist apps/mobile/dist] [--markdown]
//                                  [--max-total-kib N] [--max-first-paint-kib N]
//
// Reads every .ttf file of the export (Expo hashes the file names: Inter_400Regular.<hash>.ttf),
// groups them by family, and prints the total, the first-paint set (the five files the first paint
// waits for) and what loads on demand. `--markdown` prints the table the README carries. Exits 1
// when the first-paint set or the total goes over its budget (the defaults are the ones of the
// spec plus a margin), 2 on a usage or setup error. In GitHub Actions the markdown also goes to the
// job summary. Build the export first: pnpm --filter mobile export:web

import { appendFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The five files the first paint waits for (apps/mobile/src/theme/font-sources.ts). */
export const FIRST_PAINT = [
  'IMFellGreatPrimer_400Regular',
  'IMFellGreatPrimer_400Regular_Italic',
  'SourceSerif4_400Regular',
  'SourceSerif4_400Regular_Italic',
  'SourceSerif4_600SemiBold',
];

/** What each family is for, in the order of the README table (the README is in Romanian). */
const ROLES = {
  IMFellGreatPrimer: 'titluri (prima pictură)',
  SourceSerif4: 'text și interfață (prima pictură, în afară de italicul 600)',
  Literata: 'opțiune de lectură, la cerere',
  Inter: 'opțiunea de lectură „Sans”, la cerere',
  GentiumPlus: 'ediții grecești, la cerere',
};

/** The budgets in KiB: the first-paint set is about 1.3 MB in the spec, the whole about 5.5 MiB. */
const DEFAULT_MAX_FIRST_PAINT_KIB = 1400;
const DEFAULT_MAX_TOTAL_KIB = 6144;

/** Every .ttf under `dir`, as `{ name, bytes }` where the name has no hash and no extension. */
export function ttfFiles(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.ttf')) {
        // Inter_400Regular.51b6ad87261f18b6433ec52871ddfabc.ttf -> Inter_400Regular
        const name = basename(entry.name, '.ttf').replace(/\.[0-9a-f]{16,}$/i, '');
        found.push({ name, bytes: statSync(path).size });
      }
    }
  };
  walk(dir);
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

const kib = (bytes) => Math.round(bytes / 1024);
const mib = (bytes) => (bytes / 1048576).toFixed(2);
/** The same with a decimal comma, for the README. */
const mibRo = (bytes) => mib(bytes).replace('.', ',');
const sum = (files) => files.reduce((total, file) => total + file.bytes, 0);

/** The numbers of a set of files: the total, the first-paint set, the rest, by family. */
export function summarise(files) {
  const firstPaint = files.filter((file) => FIRST_PAINT.includes(file.name));
  const onDemand = files.filter((file) => !FIRST_PAINT.includes(file.name));
  const families = new Map();
  for (const file of files) {
    const family = file.name.split('_')[0];
    const entry = families.get(family) ?? { family, files: [], bytes: 0 };
    entry.files.push(file);
    entry.bytes += file.bytes;
    families.set(family, entry);
  }
  return {
    count: files.length,
    total: sum(files),
    firstPaint: { count: firstPaint.length, bytes: sum(firstPaint) },
    onDemand: { count: onDemand.length, bytes: sum(onDemand) },
    families: [...families.values()],
  };
}

/** The README table: one row per family, then the totals. */
export function markdown(summary) {
  const order = Object.keys(ROLES);
  const position = (family) => (order.includes(family) ? order.indexOf(family) : order.length);
  const rows = [...summary.families]
    .sort((a, b) => position(a.family) - position(b.family) || a.family.localeCompare(b.family))
    .map(
      (entry) =>
        `| ${entry.family} | ${entry.files.length} | ${kib(entry.bytes)} | ${ROLES[entry.family] ?? ''} |`,
    );
  return [
    '| Familie | Fișiere | KiB | Rol |',
    '| --- | ---: | ---: | --- |',
    ...rows,
    `| **Total livrat** | **${summary.count}** | **${kib(summary.total)}** | ${mibRo(summary.total)} MiB în exportul web |`,
    `| din care prima pictură (se așteaptă) | ${summary.firstPaint.count} | ${kib(summary.firstPaint.bytes)} | ${mibRo(summary.firstPaint.bytes)} MiB |`,
    `| din care la cerere (\`Font.loadAsync\`) | ${summary.onDemand.count} | ${kib(summary.onDemand.bytes)} | ${mibRo(summary.onDemand.bytes)} MiB |`,
  ].join('\n');
}

function main() {
  const args = {
    dist: join(root, 'apps/mobile/dist'),
    markdown: false,
    maxTotal: DEFAULT_MAX_TOTAL_KIB,
    maxFirstPaint: DEFAULT_MAX_FIRST_PAINT_KIB,
  };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = () => {
      i += 1;
      if (argv[i] === undefined) {
        console.error(`fonts: ${flag} needs a value`);
        process.exit(2);
      }
      return argv[i];
    };
    if (flag === '--dist') args.dist = resolve(value());
    else if (flag === '--markdown') args.markdown = true;
    else if (flag === '--max-total-kib') args.maxTotal = Number(value());
    else if (flag === '--max-first-paint-kib') args.maxFirstPaint = Number(value());
    else {
      console.error(`fonts: unknown argument ${flag}`);
      process.exit(2);
    }
  }
  if (!existsSync(args.dist)) {
    console.error(`fonts: ${args.dist} not found. Run: pnpm --filter mobile export:web`);
    return 2;
  }

  const files = ttfFiles(args.dist);
  if (files.length === 0) {
    console.error(`fonts: no .ttf file under ${relative(root, args.dist)}`);
    return 2;
  }
  const summary = summarise(files);
  const missing = FIRST_PAINT.filter((name) => !files.some((file) => file.name === name));
  const table = markdown(summary);

  if (args.markdown) console.log(table);
  else {
    for (const file of files) {
      const mark = FIRST_PAINT.includes(file.name) ? '*' : ' ';
      console.log(
        `fonts: ${mark} ${file.name.padEnd(40)} ${String(kib(file.bytes)).padStart(6)} KiB`,
      );
    }
    console.log(
      `fonts: ${summary.count} files, ${kib(summary.total)} KiB (${mib(summary.total)} MiB) in ${relative(root, args.dist)}`,
    );
    console.log(
      `fonts: first paint (*) ${summary.firstPaint.count} files, ${kib(summary.firstPaint.bytes)} KiB (${mib(summary.firstPaint.bytes)} MiB); on demand ${summary.onDemand.count} files, ${kib(summary.onDemand.bytes)} KiB (${mib(summary.onDemand.bytes)} MiB)`,
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Shipped TTF files\n\n${table}\n`);
  }

  const problems = [];
  if (missing.length > 0)
    problems.push(`first-paint fonts missing from the export: ${missing.join(', ')}`);
  if (kib(summary.firstPaint.bytes) > args.maxFirstPaint)
    problems.push(
      `the first-paint set is ${kib(summary.firstPaint.bytes)} KiB, over the budget of ${args.maxFirstPaint} KiB`,
    );
  if (kib(summary.total) > args.maxTotal)
    problems.push(
      `the shipped fonts are ${kib(summary.total)} KiB, over the budget of ${args.maxTotal} KiB`,
    );
  if (problems.length > 0) {
    console.error(`fonts: FAILED:\n  ${problems.join('\n  ')}`);
    return 1;
  }
  if (!args.markdown) console.log('fonts: OK');
  return 0;
}

// Run as a script, not when a test imports the helpers.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
