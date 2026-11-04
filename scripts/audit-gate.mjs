#!/usr/bin/env node
// Dependency audit gate for CI.
//
//   node scripts/audit-gate.mjs [--audit-level moderate] [--scope prod|all]
//                               [--allowlist scripts/audit-allowlist.json]
//
// Runs `pnpm audit --json` (production dependencies only with `--scope prod`, the default; all
// dependencies, including the build tooling that runs in CI, with `--scope all`) and fails when
// an advisory at or above the level is not covered by an unexpired, reasoned entry in the
// allowlist, except that
//   * an advisory with NO published fix (patched_versions "<0.0.0") below severity high is only
//     reported as a warning (there is nothing to upgrade to); it is re-evaluated on every run;
//   * an advisory with no fix at severity high or critical still fails unless it is allow-listed.
// If the audit itself cannot run (registry unreachable, unparsable output) the gate fails closed
// with exit code 2.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LEVELS = ['info', 'low', 'moderate', 'high', 'critical'];

function parseArgs(argv) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const args = {
    level: 'moderate',
    scope: 'prod',
    allowlist: `${root}scripts/audit-allowlist.json`,
    input: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--audit-level') args.level = argv[(i += 1)];
    else if (argv[i] === '--scope') args.scope = argv[(i += 1)];
    else if (argv[i] === '--allowlist') args.allowlist = argv[(i += 1)];
    else if (argv[i] === '--input') args.input = argv[(i += 1)]; // saved `pnpm audit --json` output (tests)
  }
  if (!LEVELS.includes(args.level)) {
    console.error(`Unknown --audit-level "${args.level}" (use ${LEVELS.join(', ')})`);
    process.exit(2);
  }
  if (!['prod', 'all'].includes(args.scope)) {
    console.error(`Unknown --scope "${args.scope}" (use prod or all)`);
    process.exit(2);
  }
  return args;
}

export function hasFix(advisory) {
  const patched = String(advisory.patched_versions ?? '').trim();
  return patched !== '' && patched !== '<0.0.0';
}

/** Pure decision function, exported for tests. */
export function evaluate(report, allowlist, level, today = new Date()) {
  const threshold = LEVELS.indexOf(level);
  const entries = new Map();
  for (const entry of allowlist.advisories ?? []) {
    if (!entry.reason || !entry.expires) continue; // incomplete entries never count
    entries.set(String(entry.id), entry);
  }
  const result = { blocking: [], allowed: [], unfixable: [], belowLevel: 0 };
  for (const [id, advisory] of Object.entries(report.advisories ?? {})) {
    if (LEVELS.indexOf(advisory.severity) < threshold) {
      result.belowLevel += 1;
      continue;
    }
    const summary = {
      id,
      severity: advisory.severity,
      module: advisory.module_name,
      title: advisory.title,
      patched: advisory.patched_versions,
      url: advisory.url,
    };
    // Without a published fix, only advisories below high severity are merely warned about.
    if (!hasFix(advisory) && LEVELS.indexOf(advisory.severity) < LEVELS.indexOf('high')) {
      result.unfixable.push(summary);
      continue;
    }
    const entry = entries.get(id) ?? entries.get(String(advisory.github_advisory_id));
    if (entry && new Date(`${entry.expires}T23:59:59Z`) >= today) {
      result.allowed.push({ ...summary, reason: entry.reason, expires: entry.expires });
    } else {
      result.blocking.push({ ...summary, expired: Boolean(entry) });
    }
  }
  return result;
}

function loadReport(args) {
  if (args.input) return JSON.parse(readFileSync(args.input, 'utf8'));
  const run = spawnSync('pnpm', ['audit', ...(args.scope === 'prod' ? ['--prod'] : []), '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  // pnpm exits 1 when vulnerabilities exist; only unparsable output is a real failure.
  try {
    const report = JSON.parse(run.stdout);
    if (report.error) throw new Error(JSON.stringify(report.error));
    return report;
  } catch (error) {
    console.error('audit-gate: could not obtain a usable `pnpm audit` report.');
    console.error(String(error));
    console.error(run.stderr || run.stdout.slice(0, 500));
    process.exit(2);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const allowlist = JSON.parse(readFileSync(args.allowlist, 'utf8'));
  const report = loadReport(args);
  const result = evaluate(report, allowlist, args.level);
  const gh = Boolean(process.env.GITHUB_ACTIONS);
  const line = (a) =>
    `${a.severity} ${a.module}@${a.id}: ${a.title} (fix: ${a.patched || 'none'}) ${a.url ?? ''}`;

  for (const a of result.unfixable) {
    console.warn(`${gh ? '::warning::' : 'WARN '}no fix published, tolerated: ${line(a)}`);
  }
  for (const a of result.allowed) {
    console.warn(
      `${gh ? '::warning::' : 'WARN '}allow-listed until ${a.expires}: ${line(a)}\n    reason: ${a.reason}`,
    );
  }
  for (const a of result.blocking) {
    console.error(
      `${gh ? '::error::' : 'FAIL '}${a.expired ? 'allow-list entry expired: ' : ''}${line(a)}`,
    );
  }
  console.log(
    `audit-gate (level ${args.level}, scope ${args.scope}): ${result.blocking.length} blocking, ${result.allowed.length} allow-listed, ` +
      `${result.unfixable.length} without fix, ${result.belowLevel} below level.`,
  );
  process.exit(result.blocking.length > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
