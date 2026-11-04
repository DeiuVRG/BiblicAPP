import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_KEYS_DIR, DEFAULT_PACKS_DIR } from '../paths';
import { buildLibrary } from './library';
import { loadPacks, loadTrustedKeys } from './packs';

const scratch: string[] = [];
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'api-packs-'));
  scratch.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const keys = loadTrustedKeys(DEFAULT_KEYS_DIR).keys;

/** Copies a real pack into a fresh packs folder and lets the test damage it. */
function copyPack(name: string, into: string, as = name): string {
  const target = join(into, as);
  cpSync(join(DEFAULT_PACKS_DIR, name), target, { recursive: true });
  return target;
}

describe('pinned keys', () => {
  it('reads the same two keys the app pins', () => {
    const loaded = loadTrustedKeys(DEFAULT_KEYS_DIR);
    expect(loaded.problems).toEqual([]);
    expect(loaded.keys.map((key) => key.id).sort()).toEqual(['dev-2026-11', 'next-placeholder-1']);
  });

  it('reports a malformed key file and keeps the good ones', () => {
    const dir = temp();
    cpSync(join(DEFAULT_KEYS_DIR, 'dev.pub'), join(dir, 'dev.pub'));
    writeFileSync(join(dir, 'broken.pub'), '{"id":"x","algorithm":"ed25519","publicKey":"short"}');
    writeFileSync(join(dir, 'garbage.pub'), 'not json');
    const loaded = loadTrustedKeys(dir);
    expect(loaded.keys.map((key) => key.id)).toEqual(['dev-2026-11']);
    expect(loaded.problems).toHaveLength(2);
  });

  it('reports a missing directory', () => {
    expect(loadTrustedKeys(join(temp(), 'nope')).problems[0]).toMatch(/not found/);
  });
});

describe('loadPacks', () => {
  it('loads and verifies the packs that ship with the app', () => {
    const result = loadPacks(DEFAULT_PACKS_DIR, keys);
    expect(result.rejected).toEqual([]);
    expect(result.packs.map((loaded) => loaded.manifest.packId).sort()).toEqual([
      'vos-1903-kingdom-en',
      'vos-1903-kingdom-ro',
    ]);
  });

  it('refuses a pack whose text was changed after signing', () => {
    const root = temp();
    const dir = copyPack('vos-1903-kingdom-ro', root);
    const bytes = readFileSync(join(dir, 'pack.json'), 'utf8');
    // Same length, so only the hash can notice.
    writeFileSync(join(dir, 'pack.json'), bytes.replace('Domnului', 'Domnulai'));
    const result = loadPacks(root, keys);
    expect(result.packs).toEqual([]);
    expect(result.rejected.map((entry) => entry.reason)).toEqual(['sha256-mismatch']);
  });

  it('refuses a pack with a damaged signature', () => {
    const root = temp();
    const dir = copyPack('vos-1903-kingdom-en', root);
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as {
      signature: string;
    };
    manifest.signature = `${manifest.signature[0] === 'A' ? 'B' : 'A'}${manifest.signature.slice(1)}`;
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
    expect(loadPacks(root, keys).rejected.map((entry) => entry.reason)).toEqual(['bad-signature']);
  });

  it('refuses a pack signed by a key that is not pinned', () => {
    const root = temp();
    copyPack('vos-1903-kingdom-en', root);
    const result = loadPacks(root, [keys.find((key) => key.id === 'next-placeholder-1')!]);
    expect(result.packs).toEqual([]);
    expect(result.rejected[0]?.reason).toBe('unknown-key');
    expect(loadPacks(root, []).rejected[0]?.reason).toBe('unknown-key');
  });

  it('refuses folders that are incomplete or unreadable, and says so for a missing directory', () => {
    const root = temp();
    mkdirSync(join(root, 'empty'));
    mkdirSync(join(root, 'bad-json'));
    writeFileSync(join(root, 'bad-json', 'manifest.json'), '{');
    writeFileSync(join(root, 'bad-json', 'pack.json'), '{}');
    writeFileSync(join(root, 'README.txt'), 'not a pack');
    const result = loadPacks(root, keys);
    expect(result.rejected.map((entry) => entry.reason).sort()).toEqual([
      'incomplete',
      'unreadable',
    ]);
    expect(loadPacks(join(root, 'missing'), keys).rejected[0]?.reason).toBe('packs-dir-missing');
  });

  it('keeps one pack per edition', () => {
    const root = temp();
    copyPack('vos-1903-kingdom-en', root, 'a-first');
    copyPack('vos-1903-kingdom-en', root, 'b-copy');
    const result = loadPacks(root, keys);
    expect(result.packs).toHaveLength(1);
    expect(result.rejected.map((entry) => entry.reason)).toEqual(['superseded']);
  });

  it('indexes only what verified', () => {
    const root = temp();
    copyPack('vos-1903-kingdom-en', root);
    const dir = copyPack('vos-1903-kingdom-ro', root);
    writeFileSync(
      join(dir, 'pack.json'),
      readFileSync(join(dir, 'pack.json'), 'utf8').replace('Domnului', 'Domnulai'),
    );
    const library = buildLibrary(loadPacks(root, keys).packs);
    expect(library.packCount).toBe(1);
    expect([...library.indexes.keys()]).toEqual(['en']);
  });
});
