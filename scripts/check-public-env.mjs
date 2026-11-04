#!/usr/bin/env node
// Fails (exit 1) when an EXPO_PUBLIC_* assignment in the repository looks like a secret.
//
// Anything prefixed EXPO_PUBLIC_ is inlined into the client bundle and is readable by every user
// of the web app and APK, so it must only ever hold public values (URLs, publishable keys, public
// signing keys, feature flags). Run:
//   node scripts/check-public-env.mjs [--root <dir>] [--env] [--dist <dir>] [paths...]
//
//   (default)    scans the text of git-tracked and untracked-unignored files for assignments;
//   --env        also classifies the EXPO_PUBLIC_* variables of the running process (CI repo
//                variables and secrets reach the bundle through the environment, not the source);
//   --dist <dir> also scans the built bundle for embedded secret-shaped tokens, which is what
//                is actually shipped to clients.
//
// What counts as a secret here:
//   * a value that starts with a well-known secret prefix (sk_, rk_live_, pk_live_, ghp_, ...);
//   * a Supabase-style JWT whose payload says role "service_role" (the anon JWT is public by design);
//   * a value taken from CI secrets (`${{ secrets.X }}`) or from `process.env` of a secret name;
//   * a variable whose NAME says secret/private/password/token/service role, with a real value;
//   * a long, high-entropy opaque string (random keys), unless the name marks it as a public key
//     (..._PUBLIC_KEY, ..._PUBLISHABLE_KEY, ..._ANON_KEY, ..._PUBKEY) or it is a URL.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SECRET_PREFIXES = [
  /^sk[-_]/i, // Stripe / OpenAI / Anthropic (sk-ant-...)
  /^rk_(live|test)_/i,
  /^pk_live_/i,
  /^whsec_/i,
  /^ghp_/,
  /^gho_/,
  /^ghu_/,
  /^ghs_/,
  /^ghr_/,
  /^github_pat_/,
  /^glpat-/,
  /^xox[abprs]-/,
  /^AKIA[0-9A-Z]{12,}/,
  /^ASIA[0-9A-Z]{12,}/,
  /^AIza[0-9A-Za-z_-]{20,}/,
  /^sb_secret_/,
  /^-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

const SECRET_NAME =
  /(SECRET|PRIVATE|PASSWORD|PASSWD|TOKEN|SERVICE_ROLE|CREDENTIAL|API_KEY|SIGNING_KEY)/;
const PUBLIC_NAME = /(PUBLIC_KEY|PUBLISHABLE_KEY|ANON_KEY|PUBKEY|PUBLIC_SIGNING_KEY)$/;
const PLACEHOLDER =
  /^(|<.*>|\$\{?\w+\}?|changeme|change-me|todo|tbd|xxx+|your[-_ ].*|example.*|placeholder.*|null|undefined|true|false|string|number|boolean|\.\.\.)$/i;

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.expo',
  'coverage',
  'android',
  'ios',
]);
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);
const SELF = ['scripts/check-public-env.mjs', 'scripts/check-public-env.test.mjs'];
const MAX_BYTES = 1_000_000;

const ASSIGNMENT =
  /\b(EXPO_PUBLIC_[A-Z0-9_]+)["']?\s*[:=]\s*(?:"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`|(\$\{\{[^}\n]*\}\})|([^\s#,;}]+))/g;

export function shannonEntropy(text) {
  const counts = new Map();
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / text.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function jwtRole(value) {
  const parts = value.split('.');
  if (parts.length !== 3 || !value.startsWith('eyJ')) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : 'unknown';
  } catch {
    return 'unparseable';
  }
}

/** Returns a human-readable reason when (name, value) looks like a secret, otherwise null. */
export function classify(name, rawValue) {
  const value = rawValue.trim();
  if (PLACEHOLDER.test(value)) return null;
  if (/\$\{\{\s*secrets\./i.test(value)) return 'takes its value from CI secrets';
  if (/process\.env\.[A-Z0-9_]*(SECRET|PRIVATE|PASSWORD|TOKEN|SERVICE_ROLE)/.test(value)) {
    return 'copies a secret environment variable';
  }
  for (const prefix of SECRET_PREFIXES) {
    if (prefix.test(value)) return `value starts with a known secret prefix (${prefix.source})`;
  }
  const role = jwtRole(value);
  if (role === 'service_role') return 'JWT with role service_role';
  if (role !== null) {
    // The anon / authenticated JWT is public by design. Anything else must be reviewed.
    return role === 'anon' ? null : `JWT with unexpected role "${role}"`;
  }
  if (/^https?:\/\//i.test(value) || /^\/[\w./-]*$/.test(value)) return null;
  if (SECRET_NAME.test(name) && !PUBLIC_NAME.test(name)) {
    return 'the variable name says it is a secret, but it would be shipped to every client';
  }
  if (
    !PUBLIC_NAME.test(name) &&
    value.length >= 24 &&
    /^[A-Za-z0-9+/=_-]+$/.test(value) &&
    shannonEntropy(value) >= 3.5
  ) {
    return 'long high-entropy string (looks like a random key)';
  }
  return null;
}

/** Scans one file's text. Returns [{file, line, name, reason}]. */
export function scanText(file, text) {
  const findings = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (!line.includes('EXPO_PUBLIC_')) return;
    for (const match of line.matchAll(ASSIGNMENT)) {
      const value = match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? '';
      const reason = classify(match[1], value);
      if (reason) findings.push({ file, line: index + 1, name: match[1], reason });
    }
  });
  return findings;
}

/** Classifies every EXPO_PUBLIC_* variable of an environment (values are never printed). */
export function scanEnvironment(env) {
  const findings = [];
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('EXPO_PUBLIC_') || value === undefined) continue;
    const reason = classify(name, value);
    if (reason) findings.push({ file: '(environment)', line: 0, name, reason });
  }
  return findings;
}

// Secret-shaped tokens that must never appear in a shipped bundle.
const BUNDLE_TOKENS = [
  [/\bghp_[A-Za-z0-9]{30,}/, 'GitHub personal access token'],
  [/\bgithub_pat_[A-Za-z0-9_]{40,}/, 'GitHub fine-grained token'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic API key'],
  [/\bsk_live_[A-Za-z0-9]{16,}/, 'Stripe secret key'],
  [/\bsb_secret_[A-Za-z0-9_-]{16,}/, 'Supabase secret key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'PEM private key'],
];
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{5,}/g;
const BUNDLE_EXTENSIONS = /\.(js|mjs|cjs|html|json|css|map|txt|bundle)$/i;

/** Scans a built bundle directory for secret-shaped tokens. Returns [{file, line, name, reason}]. */
export function scanDist(dir) {
  const findings = [];
  let scanned = 0;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && BUNDLE_EXTENSIONS.test(entry.name)) {
        scanned += 1;
        const text = readFileSync(full, 'utf8');
        const file = relative(dir, full).split(sep).join('/');
        for (const [pattern, label] of BUNDLE_TOKENS) {
          if (pattern.test(text))
            findings.push({ file, line: 0, name: label, reason: 'embedded in the bundle' });
        }
        for (const match of text.matchAll(JWT)) {
          try {
            const payload = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
            if (payload.role === 'service_role') {
              findings.push({
                file,
                line: 0,
                name: 'JWT',
                reason: 'service_role JWT embedded in the bundle',
              });
            }
          } catch {
            // not a JWT payload
          }
        }
      }
    }
  };
  walk(dir);
  return { findings, scanned };
}

function listFiles(root) {
  try {
    const out = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    return out.split('\0').filter(Boolean);
  } catch {
    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
        } else if (entry.isFile()) {
          files.push(relative(root, join(dir, entry.name)));
        }
      }
    };
    walk(root);
    return files;
  }
}

export function scanRepository(root, explicitPaths = []) {
  const candidates = explicitPaths.length > 0 ? explicitPaths : listFiles(root);
  const findings = [];
  let scanned = 0;
  for (const rel of candidates) {
    const normalized = rel.split(sep).join('/');
    if (SELF.includes(normalized)) continue;
    if (normalized.split('/').some((part) => SKIP_DIRS.has(part))) continue;
    if (SKIP_FILES.has(normalized.split('/').pop())) continue;
    const full = resolve(root, rel);
    if (!existsSync(full)) continue;
    const stat = statSync(full);
    if (!stat.isFile() || stat.size > MAX_BYTES) continue;
    const buffer = readFileSync(full);
    if (buffer.includes(0)) continue; // binary
    scanned += 1;
    findings.push(...scanText(normalized, buffer.toString('utf8')));
  }
  return { findings, scanned };
}

function main(argv) {
  let root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const paths = [];
  let checkEnv = false;
  let dist = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') root = resolve(argv[(i += 1)]);
    else if (argv[i] === '--env') checkEnv = true;
    else if (argv[i] === '--dist') dist = resolve(argv[(i += 1)]);
    else paths.push(argv[i]);
  }
  const { findings, scanned } = scanRepository(root, paths);
  let extra = '';
  if (checkEnv) {
    findings.push(...scanEnvironment(process.env));
    extra += ', environment checked';
  }
  if (dist) {
    if (!existsSync(dist)) {
      console.error(`check-public-env: --dist ${dist} does not exist (run the export first).`);
      return 1;
    }
    const result = scanDist(dist);
    findings.push(...result.findings);
    extra += `, ${result.scanned} bundle files scanned`;
  }
  if (findings.length === 0) {
    console.log(
      `check-public-env: ${scanned} files scanned${extra}, no secret-looking EXPO_PUBLIC_* values.`,
    );
    return 0;
  }
  for (const f of findings) {
    // Never print the value itself.
    console.error(`${f.file}:${f.line || 0}: ${f.name}: ${f.reason}`);
    if (process.env.GITHUB_ACTIONS) {
      console.error(`::error file=${f.file},line=${f.line}::${f.name}: ${f.reason}`);
    }
  }
  console.error(
    `check-public-env: ${findings.length} problem(s). EXPO_PUBLIC_* values are embedded in the client bundle; ` +
      'move secrets to server-side services.',
  );
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
