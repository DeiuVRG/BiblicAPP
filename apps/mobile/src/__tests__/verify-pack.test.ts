import fs from 'node:fs';
import path from 'node:path';

import { canonicalJsonBytes, manifestSigningPayload } from '@biblioteca/shared';
import { stableId } from '@biblioteca/shared/ids';
import type { Pack, PackManifest } from '@biblioteca/shared';
import * as ed from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import { currentKey, nextKey, trustedKeys } from '@/content/trusted-keys';
import { base64ToBytes, verifyPack } from '@/content/verify-pack';
import type { TrustedKey } from '@/content/verify-pack';

ed.hashes.sha512 = sha512;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function samplePack(): Pack {
  const sectionId = stableId();
  return {
    work: {
      id: stableId(),
      slug: 'sample',
      titleRo: 'Probă',
      titleOrig: 'Sample',
      author: { name: 'Autor', born: null, died: null, tradition: 'x' },
      languageOrig: 'en',
      year: 1900,
    },
    edition: {
      id: stableId(),
      language: 'en',
      kind: 'source',
      licence: { status: 'public-domain', note: '' },
      provenance: { source: 's', extractedBy: 'e', notes: '' },
    },
    sections: [{ id: sectionId, ordinal: 0, kind: 'chapter', heading: 'I. Intro' }],
    paragraphs: [{ id: stableId(), sectionId, ordinal: 0, kind: 'p', text: 'Ștefan și țara.' }],
  };
}

function signedFixture(minAppVersion = '0.1.0') {
  const secretKey = ed.utils.randomSecretKey();
  const key: TrustedKey = { id: 'test-1', publicKey: toBase64(ed.getPublicKey(secretKey)) };
  const pack = samplePack();
  const bytes = canonicalJsonBytes(pack);
  const unsigned = {
    packId: 'sample-en',
    kind: 'edition' as const,
    workId: pack.work.id,
    editionId: pack.edition.id,
    revision: 1,
    version: '1.0.0',
    createdAt: '2026-11-04T00:00:00.000Z',
    sha256: bytesToHex(sha256(bytes)),
    size: bytes.length,
    minAppVersion,
    signingKeyId: key.id,
  };
  const manifest: PackManifest = { ...unsigned, signature: 'AA==' };
  manifest.signature = toBase64(ed.sign(manifestSigningPayload(manifest), secretKey));
  return { pack, manifest, key, secretKey };
}

describe('verifyPack', () => {
  it('accepts a correctly signed pack', async () => {
    const { pack, manifest, key } = signedFixture();
    const result = await verifyPack({ pack, manifest, trustedKeys: [key], appVersion: '0.1.0' });
    expect(result).toMatchObject({ ok: true, signatureVerified: true });
  });

  it('rejects a signature from a key that is not pinned', async () => {
    const { pack, manifest } = signedFixture();
    const other = ed.getPublicKey(ed.utils.randomSecretKey());
    const result = await verifyPack({
      pack,
      manifest,
      trustedKeys: [{ id: 'test-1', publicKey: toBase64(other) }],
      appVersion: '0.1.0',
    });
    expect(result).toMatchObject({ ok: false, reason: 'bad-signature' });
  });

  it('rejects an unknown signingKeyId', async () => {
    const { pack, manifest, key } = signedFixture();
    const result = await verifyPack({
      pack,
      manifest,
      trustedKeys: [{ ...key, id: 'else' }],
      appVersion: '0.1.0',
    });
    expect(result).toMatchObject({ ok: false, reason: 'unknown-key' });
  });

  it('rejects changed pack content, size and identity mismatches', async () => {
    const { pack, manifest, key } = signedFixture();
    const changed = { ...pack, paragraphs: [{ ...pack.paragraphs[0]!, text: 'Altceva.' }] };
    expect(
      await verifyPack({ pack: changed, manifest, trustedKeys: [key], appVersion: '0.1.0' }),
    ).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/size-mismatch|sha256-mismatch/),
    });
    const other = samplePack();
    expect(
      await verifyPack({ pack: other, manifest, trustedKeys: [key], appVersion: '0.1.0' }),
    ).toMatchObject({
      ok: false,
      reason: 'identity-mismatch',
    });
  });

  it('rejects malformed input', async () => {
    const { pack, manifest, key } = signedFixture();
    expect(
      await verifyPack({ pack, manifest: {}, trustedKeys: [key], appVersion: '0.1.0' }),
    ).toMatchObject({
      reason: 'manifest-invalid',
    });
    expect(
      await verifyPack({ pack: { work: 1 }, manifest, trustedKeys: [key], appVersion: '0.1.0' }),
    ).toMatchObject({
      reason: 'pack-invalid',
    });
    const garbage = { ...manifest, signature: '!!!' };
    expect(
      await verifyPack({ pack, manifest: garbage, trustedKeys: [key], appVersion: '0.1.0' }),
    ).toMatchObject({
      ok: false,
    });
  });

  it('enforces minAppVersion and fails closed when the app version is unknown', async () => {
    const { pack, manifest, key } = signedFixture('2.0.0');
    expect(
      await verifyPack({ pack, manifest, trustedKeys: [key], appVersion: undefined }),
    ).toMatchObject({ ok: false, reason: 'app-too-old' });
    const zero = signedFixture('0.0.0');
    expect(
      (
        await verifyPack({
          pack: zero.pack,
          manifest: zero.manifest,
          trustedKeys: [zero.key],
          appVersion: undefined,
        })
      ).ok,
    ).toBe(true);
    expect(
      await verifyPack({ pack, manifest, trustedKeys: [key], appVersion: '1.9.9' }),
    ).toMatchObject({
      ok: false,
      reason: 'app-too-old',
    });
    expect((await verifyPack({ pack, manifest, trustedKeys: [key], appVersion: '2.0.0' })).ok).toBe(
      true,
    );
    expect(
      await verifyPack({ pack, manifest, trustedKeys: [key], appVersion: 'oops' }),
    ).toMatchObject({
      reason: 'app-too-old',
    });
  });
});

describe('base64ToBytes', () => {
  it('matches Buffer for assorted lengths', () => {
    for (const length of [0, 1, 2, 3, 4, 31, 32, 63, 64, 65]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + 11) & 0xff);
      expect(Array.from(base64ToBytes(Buffer.from(bytes).toString('base64')))).toEqual(
        Array.from(bytes),
      );
    }
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => base64ToBytes('ab$d')).toThrow();
  });
});

describe('pinned keys', () => {
  const keysDir = path.resolve(__dirname, '../../../../content/keys');
  const read = (name: string) =>
    JSON.parse(fs.readFileSync(path.join(keysDir, name), 'utf8')) as {
      id: string;
      publicKey: string;
    };

  it('pins two keys: the development key as current and a placeholder next key', () => {
    expect(trustedKeys).toEqual([currentKey, nextKey]);
    expect(currentKey.id).not.toBe(nextKey.id);
    expect(base64ToBytes(currentKey.publicKey)).toHaveLength(32);
    expect(base64ToBytes(nextKey.publicKey)).toHaveLength(32);
  });

  it('matches the committed public key files in content/keys', () => {
    expect(read('dev.pub')).toMatchObject(currentKey);
    expect(read('next-placeholder.pub')).toMatchObject(nextKey);
  });

  it('embeds exactly the two public keys and no other key material', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../content/trusted-keys.ts'), 'utf8');
    expect(source.match(/'[A-Za-z0-9+/]{43}='/g)).toHaveLength(2);
  });
});
