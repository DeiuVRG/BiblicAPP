import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { classify, scanDist, scanEnvironment, scanText } from './check-public-env.mjs';

// Fixtures are assembled at runtime so this file itself never contains secret-looking literals.
const fake = (prefix, body) => prefix + body;
const randomish = 'aB3dE9fG2hJ7kL5mN8pQ4rS6tU1vW0xY';

test('flags known secret prefixes', () => {
  assert.ok(classify('EXPO_PUBLIC_STRIPE', fake('sk_live_', randomish)));
  assert.ok(classify('EXPO_PUBLIC_STRIPE', fake('pk_live_', randomish)));
  assert.ok(classify('EXPO_PUBLIC_GH', fake('ghp_', randomish)));
  assert.ok(classify('EXPO_PUBLIC_ANTHROPIC', fake('sk-ant-', randomish)));
  assert.ok(classify('EXPO_PUBLIC_SB', fake('sb_secret_', randomish)));
});

test('flags service_role JWTs but allows the anon JWT', () => {
  const jwt = (role) =>
    [
      'eyJhbGciOiJIUzI1NiJ9',
      Buffer.from(JSON.stringify({ role })).toString('base64url'),
      'sig',
    ].join('.');
  assert.ok(classify('EXPO_PUBLIC_SUPABASE_ANON_KEY', jwt('service_role')));
  assert.equal(classify('EXPO_PUBLIC_SUPABASE_ANON_KEY', jwt('anon')), null);
});

test('flags secret-looking names and long random strings', () => {
  assert.ok(classify('EXPO_PUBLIC_API_SECRET', 'hunter2hunter2'));
  assert.ok(classify('EXPO_PUBLIC_BUILD_ID', randomish));
  assert.equal(classify('EXPO_PUBLIC_PUBLISHABLE_KEY', randomish), null);
});

test('allows URLs, paths, flags and placeholders', () => {
  assert.equal(classify('EXPO_PUBLIC_WEB_BASE_URL', '/BiblicAPP'), null);
  assert.equal(classify('EXPO_PUBLIC_API_URL', 'https://example.test/v1'), null);
  assert.equal(classify('EXPO_PUBLIC_FLAG', 'true'), null);
  assert.equal(classify('EXPO_PUBLIC_API_TOKEN', ''), null);
  assert.equal(classify('EXPO_PUBLIC_API_TOKEN', '<your-token>'), null);
});

test('scanText finds assignments in env files, YAML and TS and ignores plain reads', () => {
  const text = [
    `EXPO_PUBLIC_A=${fake('ghp_', randomish)}`,
    `  EXPO_PUBLIC_B: \${{ secrets.WHATEVER }}`,
    `const x = process.env.EXPO_PUBLIC_C;`,
    `EXPO_PUBLIC_WEB_BASE_URL=/BiblicAPP`,
  ].join('\n');
  const found = scanText('x.env', text);
  assert.deepEqual(
    found.map((f) => [f.name, f.line]),
    [
      ['EXPO_PUBLIC_A', 1],
      ['EXPO_PUBLIC_B', 2],
    ],
  );
});

test('scanEnvironment classifies the EXPO_PUBLIC_* variables of the process environment', () => {
  const found = scanEnvironment({
    EXPO_PUBLIC_WEB_BASE_URL: '/BiblicAPP',
    EXPO_PUBLIC_LEAK: fake('ghp_', randomish),
    NOT_PUBLIC_TOKEN: fake('ghp_', randomish),
  });
  assert.deepEqual(
    found.map((f) => f.name),
    ['EXPO_PUBLIC_LEAK'],
  );
});

test('scanDist finds secret-shaped tokens in a built bundle and passes a clean one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dist-'));
  try {
    mkdirSync(join(dir, '_expo'));
    writeFileSync(join(dir, '_expo', 'clean.js'), 'var a="hello";');
    assert.equal(scanDist(dir).findings.length, 0);
    const jwt = [
      'eyJhbGciOiJIUzI1NiJ9',
      Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'),
      'signature',
    ].join('.');
    writeFileSync(join(dir, '_expo', 'bad.js'), `var k="${fake('ghp_', randomish)}",j="${jwt}";`);
    assert.equal(scanDist(dir).findings.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
