import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as ed from '@noble/ed25519';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canonicalJson, manifestSigningPayload } from '@biblioteca/shared';
import { stableId } from '@biblioteca/shared/ids';
import type { Pack } from '@biblioteca/shared';

import { runBuildPack } from './commands/build-pack';
import { runIngestText } from './commands/ingest-text';
import { runKeygen } from './commands/keygen';
import { runVerifyPack } from './commands/verify-pack';
import { readTrustedKey } from './keys';
import {
  buildPack,
  fromBase64,
  generateKeyPair,
  sha256Hex,
  toBase64,
  verifyPackBytes,
} from './signing';

function samplePack(): Pack {
  const sectionId = stableId();
  return {
    work: {
      id: stableId(),
      slug: 'sample',
      titleRo: 'Lucrare de probă',
      titleOrig: 'Sample work',
      author: { name: 'Autor', born: 1862, died: 1949, tradition: 'protestant' },
      languageOrig: 'en',
      year: 1903,
    },
    edition: {
      id: stableId(),
      language: 'en',
      kind: 'source',
      licence: { status: 'public-domain', note: '' },
      provenance: { source: 's', extractedBy: 'e', notes: '' },
    },
    sections: [{ id: sectionId, ordinal: 0, kind: 'chapter', heading: 'I. Intro' }],
    paragraphs: [
      { id: stableId(), sectionId, ordinal: 0, kind: 'p', text: 'Ștefan și țara: „text” — ✓' },
    ],
  };
}

function build(pair = generateKeyPair(), pack = samplePack()) {
  const built = buildPack({
    pack,
    secretKey: pair.secretKey,
    signingKeyId: 'test-1',
    packId: 'sample-en',
    version: '1.0.0',
    revision: 1,
    createdAt: '2026-11-04T00:00:00.000Z',
    minAppVersion: '0.1.0',
  });
  const trusted = [{ id: 'test-1', publicKey: toBase64(pair.publicKey) }];
  return { built, trusted, pair };
}

describe('sign / verify round trip', () => {
  it('produces a pack that verifies', () => {
    const { built, trusted } = build();
    const result = verifyPackBytes({
      packBytes: built.packBytes,
      manifest: built.manifest,
      trustedKeys: trusted,
    });
    expect(result.ok).toBe(true);
    expect(built.manifest.sha256).toBe(sha256Hex(built.packBytes));
    expect(built.manifest.size).toBe(built.packBytes.length);
    expect(fromBase64(built.manifest.signature)).toHaveLength(64);
  });

  it('writes pack.json in canonical form (UTF-8, sorted keys, no spaces)', () => {
    const { built } = build();
    const text = new TextDecoder().decode(built.packBytes);
    expect(text).toBe(canonicalJson(JSON.parse(text)));
    expect(text).toContain('Ștefan și țara');
  });

  it('signature is deterministic for identical input', () => {
    const pair = generateKeyPair();
    const pack = samplePack();
    expect(build(pair, pack).built.manifest.signature).toBe(
      build(pair, pack).built.manifest.signature,
    );
  });

  it('detects a modified pack byte', () => {
    const { built, trusted } = build();
    const tampered = new Uint8Array(built.packBytes);
    const index = tampered.indexOf('I'.charCodeAt(0));
    tampered[index] = 'J'.charCodeAt(0);
    const result = verifyPackBytes({
      packBytes: tampered,
      manifest: built.manifest,
      trustedKeys: trusted,
    });
    expect(result).toMatchObject({ ok: false, reason: 'sha256-mismatch' });
  });

  it('detects a modified manifest field (signature covers the manifest)', () => {
    const { built, trusted } = build();
    const forged = { ...built.manifest, revision: 9 };
    expect(
      verifyPackBytes({ packBytes: built.packBytes, manifest: forged, trustedKeys: trusted }),
    ).toMatchObject({
      ok: false,
      reason: 'bad-signature',
    });
  });

  it('rejects a signature made with another key', () => {
    const { built } = build();
    const other = generateKeyPair();
    const result = verifyPackBytes({
      packBytes: built.packBytes,
      manifest: built.manifest,
      trustedKeys: [{ id: 'test-1', publicKey: toBase64(other.publicKey) }],
    });
    expect(result).toMatchObject({ ok: false, reason: 'bad-signature' });
  });

  it('rejects an unknown key id', () => {
    const { built, pair } = build();
    const result = verifyPackBytes({
      packBytes: built.packBytes,
      manifest: built.manifest,
      trustedKeys: [{ id: 'other', publicKey: toBase64(pair.publicKey) }],
    });
    expect(result).toMatchObject({ ok: false, reason: 'unknown-key' });
  });

  it('rejects a pack that is valid JSON but not in canonical form', () => {
    const { built, trusted, pair } = build();
    const pretty = new TextEncoder().encode(
      JSON.stringify(JSON.parse(new TextDecoder().decode(built.packBytes)), null, 2),
    );
    const manifest = { ...built.manifest, sha256: sha256Hex(pretty), size: pretty.length };
    // re-sign so that only the canonical-form rule can fail
    const resigned = buildPackManifestOnly(manifest, pair.secretKey);
    expect(
      verifyPackBytes({ packBytes: pretty, manifest: resigned, trustedKeys: trusted }),
    ).toMatchObject({
      ok: false,
      reason: 'not-canonical',
    });
  });

  it('enforces minAppVersion', () => {
    const { built, trusted } = build();
    expect(
      verifyPackBytes({
        packBytes: built.packBytes,
        manifest: built.manifest,
        trustedKeys: trusted,
        appVersion: '0.0.9',
      }),
    ).toMatchObject({ ok: false, reason: 'app-too-old' });
    expect(
      verifyPackBytes({
        packBytes: built.packBytes,
        manifest: built.manifest,
        trustedKeys: trusted,
        appVersion: '0.1.0',
      }).ok,
    ).toBe(true);
  });

  it('rejects an invalid manifest', () => {
    const { built, trusted } = build();
    expect(
      verifyPackBytes({ packBytes: built.packBytes, manifest: { nope: 1 }, trustedKeys: trusted }),
    ).toMatchObject({
      ok: false,
      reason: 'manifest-invalid',
    });
  });
});

function buildPackManifestOnly(
  manifest: ReturnType<typeof build>['built']['manifest'],
  secretKey: Uint8Array,
) {
  // Sign an arbitrary manifest with the test key (helper for negative tests).
  return {
    ...manifest,
    signature: toBase64(signPayload(manifestSigningPayload(manifest), secretKey)),
  };
}

function signPayload(payload: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return ed.sign(payload, secretKey);
}

describe('CLI commands end to end', () => {
  let dir: string;
  let previousInitCwd: string | undefined;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-'));
    previousInitCwd = process.env.INIT_CWD;
    process.env.INIT_CWD = dir;
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (previousInitCwd === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = previousInitCwd;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const read = (file: string): string => fs.readFileSync(path.join(dir, file), 'utf8');

  it('keygen writes a private key with mode 0600 and refuses to overwrite', async () => {
    expect(await runKeygen(['--dir', 'keys', '--id', 'cli-test'])).toBe(0);
    expect(fs.statSync(path.join(dir, 'keys/dev.key')).mode & 0o777).toBe(0o600);
    expect(readTrustedKey(path.join(dir, 'keys/dev.pub')).id).toBe('cli-test');
    await expect(runKeygen(['--dir', 'keys'])).rejects.toThrow(/already exist/);
    expect(await runKeygen(['--dir', 'keys', '--force'])).toBe(0);
  });

  it('ingest-text -> build-pack -> verify-pack with stable ids and revisions', async () => {
    expect(await runKeygen(['--dir', 'keys', '--id', 'cli-test'])).toBe(0);
    fs.writeFileSync(
      path.join(dir, 'work.json'),
      JSON.stringify({
        work: {
          slug: 'cli-work',
          titleRo: 'Probă',
          titleOrig: 'Test',
          author: { name: 'A', born: null, died: null, tradition: 'x' },
          languageOrig: 'en',
          year: 1900,
        },
        edition: {
          language: 'en',
          kind: 'source',
          licence: { status: 'public-domain', note: '' },
          provenance: { source: 's', extractedBy: 'e', notes: '' },
        },
      }),
    );
    fs.writeFileSync(
      path.join(dir, 'ingest.config.json'),
      JSON.stringify({
        chapters: [{ number: 'I', heading: 'One' }],
        paragraphs: { mode: 'layout' },
        endMarker: '^THE END$',
      }),
    );
    fs.writeFileSync(
      path.join(dir, 'raw.txt'),
      [
        'front',
        '     CHAPTER I\n\nOne\n\nThe first paragraph of the chapter.\n   Second paragraph is here.\nTHE END',
      ].join('\f'),
    );

    expect(await runIngestText(['raw.txt', '--work', 'work.json'])).toBe(0);
    const first = read('edition-en.json');
    expect(await runIngestText(['raw.txt', '--work', 'work.json'])).toBe(0);
    expect(read('edition-en.json')).toBe(first); // ids unchanged on re-run
    expect(read('work.json')).toContain('"id"'); // ids were written back once

    const buildArgs = ['edition-en.json', '--out', 'packs/cli', '--key', 'keys/dev.key'];
    expect(await runBuildPack(buildArgs)).toBe(0);
    const m1 = JSON.parse(read('packs/cli/manifest.json')) as {
      revision: number;
      createdAt: string;
    };
    expect(m1.revision).toBe(1);
    expect(await runVerifyPack(['packs/cli', '--pub', 'keys/dev.pub'])).toBe(0);

    // Rebuilding unchanged content keeps revision and createdAt.
    expect(await runBuildPack(buildArgs)).toBe(0);
    const m2 = JSON.parse(read('packs/cli/manifest.json')) as {
      revision: number;
      createdAt: string;
    };
    expect(m2).toMatchObject({ revision: 1, createdAt: m1.createdAt });

    // Changed content bumps the revision.
    const edited = JSON.parse(read('edition-en.json')) as Pack;
    edited.paragraphs[0]!.text += ' Extra.';
    fs.writeFileSync(path.join(dir, 'edition-en.json'), JSON.stringify(edited));
    expect(await runBuildPack(buildArgs)).toBe(0);
    expect((JSON.parse(read('packs/cli/manifest.json')) as { revision: number }).revision).toBe(2);
    expect(await runVerifyPack(['packs/cli', '--pub', 'keys/dev.pub'])).toBe(0);

    // Tampering with the built pack is detected (exit code 1).
    const packPath = path.join(dir, 'packs/cli/pack.json');
    fs.writeFileSync(packPath, read('packs/cli/pack.json').replace('Extra', 'Other'));
    expect(await runVerifyPack(['packs/cli', '--pub', 'keys/dev.pub'])).toBe(1);
  });

  it('build-pack fails without a private key', async () => {
    fs.writeFileSync(path.join(dir, 'edition.json'), '{}');
    await expect(runBuildPack(['edition.json', '--out', 'o'])).rejects.toThrow();
  });
});
