import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CatalogueSchema, canonicalJson } from '@biblioteca/shared';
import { stableId } from '@biblioteca/shared/ids';
import type { Pack } from '@biblioteca/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyCatalogueBytes } from '../catalogue';
import { readTrustedKey, writeKeyPair } from '../keys';
import { buildPack, fromBase64, generateKeyPair, sha256Hex, toBase64 } from '../signing';
import type { KeyPair } from '../signing';
import { runBuildCatalogue } from './build-catalogue';

const root = fileURLToPath(new URL('../../../../', import.meta.url));

interface Fixture {
  dir: string;
  src: string;
  packs: string;
  out: string;
  pair: KeyPair;
  keyFile: string;
  pubFile: string;
  work: Pack;
  translation: Pack;
  other: Pack;
}

function pack(
  work: Pack['work'],
  kind: 'source' | 'translation',
  language: string,
  paragraphs: number,
  sourceEditionId?: string,
): Pack {
  const sectionId = stableId();
  return {
    work,
    edition: {
      id: stableId(),
      language,
      kind,
      licence: { status: 'public-domain', note: '' },
      provenance: { source: 's', extractedBy: 'e', notes: '' },
      ...(sourceEditionId === undefined ? null : { sourceEditionId }),
    },
    sections: [{ id: sectionId, ordinal: 0, kind: 'chapter', heading: 'I' }],
    paragraphs: Array.from({ length: paragraphs }, (_, ordinal) => ({
      id: stableId(),
      sectionId,
      ordinal,
      kind: 'p' as const,
      text: `Paragraful ${ordinal + 1}: ștefan și țara.`,
    })),
  };
}

function writePack(dir: string, packId: string, value: Pack, pair: KeyPair, revision = 1): void {
  const built = buildPack({
    pack: value,
    secretKey: pair.secretKey,
    signingKeyId: 'test-1',
    packId,
    version: '1.0.0',
    revision,
    createdAt: '2026-11-04T00:00:00.000Z',
    minAppVersion: '0.1.0',
  });
  fs.mkdirSync(path.join(dir, packId), { recursive: true });
  fs.writeFileSync(path.join(dir, packId, 'pack.json'), built.packBytes);
  fs.writeFileSync(path.join(dir, packId, 'manifest.json'), `${JSON.stringify(built.manifest)}\n`);
}

const author = {
  slug: 'autor-de-proba',
  nameRo: 'Autor de probă',
  nameEn: 'Test author',
  nameOrig: 'Test author',
  born: 1800,
  died: 1880,
  tradition: 'reformed',
  bioRo: 'Un autor.',
  bioEn: 'An author.',
  bioKind: 'editorial',
};
const shelf = {
  slug: 'modern',
  order: 1,
  labelRo: 'Teologie modernă',
  labelEn: 'Modern theology',
  descRo: 'Descriere.',
  descEn: 'Description.',
};

function setup(): Fixture {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-catalogue-'));
  const pair = generateKeyPair();
  const { secretPath, publicPath } = writeKeyPair(
    path.join(dir, 'keys'),
    'test',
    'test-1',
    pair,
    false,
  );
  const work: Pack['work'] = {
    id: stableId(),
    slug: 'lucrare-de-proba',
    titleRo: 'Lucrare de probă',
    titleOrig: 'Test work',
    author: { name: 'Autor de probă', born: 1800, died: 1880, tradition: 'reformed' },
    languageOrig: 'en',
    year: 1850,
  };
  const source = pack(work, 'source', 'en', 3);
  const translation = pack(work, 'translation', 'ro', 2, source.edition.id);
  const otherWork: Pack['work'] = { ...work, id: stableId(), slug: 'alta-lucrare' };
  const other = pack(otherWork, 'source', 'en', 2);
  const packs = path.join(dir, 'packs');
  writePack(packs, 'proba-en', source, pair);
  writePack(packs, 'proba-ro', translation, pair);
  const src = path.join(dir, 'src');
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, 'shelves.json'), JSON.stringify({ shelves: [shelf] }));
  fs.writeFileSync(path.join(src, 'authors.json'), JSON.stringify({ authors: [author] }));
  fs.writeFileSync(
    path.join(src, 'works.json'),
    JSON.stringify({
      works: [
        {
          workId: work.id,
          slug: work.slug,
          authorSlug: author.slug,
          shelves: ['modern'],
          kind: 'treatise',
          blurbRo: 'Rezumat.',
          blurbEn: 'Blurb.',
          blurbKind: 'editorial',
          start: [
            {
              paragraphId: source.paragraphs[1]!.id,
              whyRo: 'De aici.',
              whyEn: 'From here.',
            },
          ],
        },
      ],
    }),
  );
  return {
    dir,
    src,
    packs,
    out: path.join(dir, 'out'),
    pair,
    keyFile: secretPath,
    pubFile: publicPath,
    work: source,
    translation,
    other,
  };
}

let stdout = '';
let stderr = '';

beforeEach(() => {
  stdout = '';
  stderr = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const build = (f: Fixture, ...extra: string[]) =>
  runBuildCatalogue([
    '--src',
    f.src,
    '--packs',
    f.packs,
    '--out',
    f.out,
    '--key',
    f.keyFile,
    '--pub',
    f.pubFile,
    ...extra,
  ]);

const check = (f: Fixture, ...extra: string[]) =>
  runBuildCatalogue([
    '--check',
    '--src',
    f.src,
    '--packs',
    f.packs,
    '--out',
    f.out,
    '--pub',
    f.pubFile,
    ...extra,
  ]);

const readOut = (f: Fixture) => ({
  bytes: new Uint8Array(fs.readFileSync(path.join(f.out, 'catalogue.json'))),
  manifest: JSON.parse(fs.readFileSync(path.join(f.out, 'manifest.json'), 'utf8')) as {
    revision: number;
    createdAt: string;
    sha256: string;
    signature: string;
  },
});

describe('build-catalogue', () => {
  let f: Fixture;
  beforeEach(() => {
    f = setup();
  });
  afterEach(() => {
    fs.rmSync(f.dir, { recursive: true, force: true });
  });

  it('writes a catalogue that verifies against the public key, in canonical form', async () => {
    expect(await build(f)).toBe(0);
    const { bytes, manifest } = readOut(f);
    const result = verifyCatalogueBytes({
      catalogueBytes: bytes,
      manifest,
      trustedKeys: [readTrustedKey(f.pubFile)],
      appVersion: '0.1.0',
    });
    expect(result.ok).toBe(true);
    expect(manifest.sha256).toBe(sha256Hex(bytes));
    expect(fromBase64(manifest.signature)).toHaveLength(64);
    const text = new TextDecoder().decode(bytes);
    expect(canonicalJson(JSON.parse(text))).toBe(text);
    expect(stdout).toContain('shelves 1, authors 1, works 1, packs 2');
  });

  it('lists every installed pack with its sha256 and size, sorted by pack id', async () => {
    await build(f);
    const catalogue = CatalogueSchema.parse(
      JSON.parse(fs.readFileSync(path.join(f.out, 'catalogue.json'), 'utf8')),
    );
    const manifests = ['proba-en', 'proba-ro'].map(
      (id) =>
        JSON.parse(fs.readFileSync(path.join(f.packs, id, 'manifest.json'), 'utf8')) as {
          packId: string;
          editionId: string;
          sha256: string;
          size: number;
        },
    );
    expect(catalogue.packs).toEqual(
      manifests.map(({ packId, editionId, sha256, size }) => ({ packId, editionId, sha256, size })),
    );
    expect(catalogue.packs.map((entry) => entry.packId)).toEqual(['proba-en', 'proba-ro']);
  });

  it('produces the same bytes again, and keeps the revision and creation time, when nothing changed', async () => {
    await build(f, '--created-at', '2026-11-05T10:00:00.000Z');
    const first = readOut(f);
    expect(await build(f)).toBe(0);
    const second = readOut(f);
    expect(second.manifest).toEqual(first.manifest);
    expect(second.bytes).toEqual(first.bytes);
    expect(stdout).toContain('(content unchanged)');
  });

  it('bumps the revision when a source or a pack changes', async () => {
    await build(f);
    const first = readOut(f);
    fs.writeFileSync(
      path.join(f.src, 'authors.json'),
      JSON.stringify({ authors: [{ ...author, bioRo: 'Alt text.' }] }),
    );
    await build(f);
    expect(readOut(f).manifest.revision).toBe(first.manifest.revision + 1);
    writePack(
      f.packs,
      'proba-ro',
      { ...f.translation, paragraphs: f.translation.paragraphs.slice(0, 1) },
      f.pair,
      2,
    );
    await build(f);
    expect(readOut(f).manifest.revision).toBe(first.manifest.revision + 2);
  });

  it('warns about an installed work that has no editorial entry, and still builds', async () => {
    writePack(f.packs, 'alta-en', f.other, f.pair);
    expect(await build(f)).toBe(0);
    expect(stderr).toContain('warning: work alta-lucrare');
    expect(stderr).toContain('"Altele"');
    const catalogue = CatalogueSchema.parse(
      JSON.parse(fs.readFileSync(path.join(f.out, 'catalogue.json'), 'utf8')),
    );
    expect(catalogue.works).toHaveLength(1);
    expect(catalogue.packs.map((entry) => entry.packId)).toEqual([
      'alta-en',
      'proba-en',
      'proba-ro',
    ]);
  });

  it('merges several source files and refuses a key it does not know', async () => {
    fs.writeFileSync(
      path.join(f.src, 'more-shelves.json'),
      JSON.stringify({ shelves: [{ ...shelf, slug: 'creeds', order: 2 }] }),
    );
    expect(await build(f)).toBe(0);
    expect(stdout).toContain('shelves 2');

    fs.writeFileSync(path.join(f.src, 'typo.json'), JSON.stringify({ shelfs: [] }));
    expect(await build(f)).toBe(2);
    expect(stderr).toContain('unknown key "shelfs"');
  });

  it('refuses startHere in two files', async () => {
    fs.writeFileSync(
      path.join(f.src, 'a.json'),
      JSON.stringify({ startHere: ['lucrare-de-proba'] }),
    );
    fs.writeFileSync(
      path.join(f.src, 'b.json'),
      JSON.stringify({ startHere: ['lucrare-de-proba'] }),
    );
    expect(await build(f)).toBe(2);
    expect(stderr).toContain('startHere is in two files');
  });

  it('refuses what does not hold together: a missing pack, another slug, a paragraph that is not there', async () => {
    const worksFile = path.join(f.src, 'works.json');
    const original = JSON.parse(fs.readFileSync(worksFile, 'utf8')) as {
      works: Record<string, unknown>[];
    };
    const write = (change: Record<string, unknown>) =>
      fs.writeFileSync(worksFile, JSON.stringify({ works: [{ ...original.works[0], ...change }] }));

    write({ workId: stableId(), slug: 'fara-pachet' });
    expect(await build(f)).toBe(2);
    expect(stderr).toContain('has no installed pack');

    write({ slug: 'alt-slug' });
    expect(await build(f)).toBe(2);
    expect(stderr).toContain('"alt-slug" in the catalogue and "lucrare-de-proba" in its pack');

    write({ start: [{ paragraphId: stableId(), whyRo: 'x', whyEn: 'x' }] });
    expect(await build(f)).toBe(2);
    expect(stderr).toContain('is not in its source edition');

    write({ shelves: ['nowhere'] });
    expect(await build(f)).toBe(2);
    expect(stderr).toContain('the catalogue is invalid');
    expect(stderr).toContain('unknown shelf nowhere');
  });

  it('never lists a pack that does not verify', async () => {
    const file = path.join(f.packs, 'proba-ro', 'pack.json');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Paragraful 1', 'Paragraful 9'));
    expect(await build(f)).toBe(2);
    expect(stderr).toContain('pack proba-ro does not verify');
    expect(fs.existsSync(path.join(f.out, 'catalogue.json'))).toBe(false);
  });

  it('prints its usage with --help', async () => {
    expect(await runBuildCatalogue(['--help'])).toBe(0);
    expect(stdout).toContain('Usage: build-catalogue');
    expect(await runBuildCatalogue(['--nonsense'])).toBe(2);
  });
});

describe('build-catalogue --check', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = setup();
    await build(f);
    stdout = '';
    stderr = '';
  });
  afterEach(() => {
    fs.rmSync(f.dir, { recursive: true, force: true });
  });

  it('passes on a fresh catalogue and needs no private key', async () => {
    fs.rmSync(f.keyFile);
    expect(await check(f)).toBe(0);
    expect(stdout).toContain('OK: catalogue rev 1, 1 work(s), 2 pack(s)');
  });

  it('fails when a source changed', async () => {
    fs.writeFileSync(
      path.join(f.src, 'authors.json'),
      JSON.stringify({ authors: [{ ...author, bioEn: 'Changed.' }] }),
    );
    expect(await check(f)).toBe(1);
    expect(stderr).toContain('STALE');
    expect(stderr).toContain('build-catalogue');
  });

  it('fails when a pack was rebuilt, and names it', async () => {
    writePack(
      f.packs,
      'proba-ro',
      { ...f.translation, paragraphs: f.translation.paragraphs.slice(0, 1) },
      f.pair,
      2,
    );
    expect(await check(f)).toBe(1);
    expect(stderr).toContain('pack proba-ro was rebuilt (sha256 changed)');
  });

  it('fails when a pack was added or removed', async () => {
    writePack(f.packs, 'alta-en', f.other, f.pair);
    expect(await check(f)).toBe(1);
    expect(stderr).toContain('pack alta-en is not in the catalogue');
    fs.rmSync(path.join(f.packs, 'alta-en'), { recursive: true });
    fs.rmSync(path.join(f.packs, 'proba-ro'), { recursive: true });
    expect(await check(f)).toBe(1);
    expect(stderr).toContain('pack proba-ro is no longer installed');
  });

  it('fails when the catalogue file or its signature was tampered with', async () => {
    const cataloguePath = path.join(f.out, 'catalogue.json');
    const original = fs.readFileSync(cataloguePath, 'utf8');
    // Same length, so it is the hash that gives it away, not the size.
    fs.writeFileSync(cataloguePath, original.replace('Rezumat.', 'Rezumaz.'));
    expect(await check(f)).toBe(1);
    expect(stderr).toContain('INVALID');
    expect(stderr).toContain('sha256-mismatch');

    fs.writeFileSync(cataloguePath, original);
    const manifestPath = path.join(f.out, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { signature: string };
    const flipped = `${manifest.signature[0] === 'A' ? 'B' : 'A'}${manifest.signature.slice(1)}`;
    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, signature: flipped }));
    expect(await check(f)).toBe(1);
    expect(stderr).toContain('bad-signature');
  });

  it('fails when there is no catalogue yet', async () => {
    fs.rmSync(f.out, { recursive: true });
    expect(await check(f)).toBe(1);
    expect(stderr).toContain('has no catalogue');
  });
});

describe('verifyCatalogueBytes', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = setup();
    await build(f);
  });
  afterEach(() => {
    fs.rmSync(f.dir, { recursive: true, force: true });
  });

  const trusted = (pair: KeyPair, id = 'test-1') => [{ id, publicKey: toBase64(pair.publicKey) }];

  it('names the reason a catalogue is refused', () => {
    const { bytes, manifest } = readOut(f);
    const base = { catalogueBytes: bytes, manifest, trustedKeys: trusted(f.pair) };
    expect(verifyCatalogueBytes(base).ok).toBe(true);
    expect(verifyCatalogueBytes({ ...base, manifest: { ...manifest, extra: 1 } })).toMatchObject({
      reason: 'manifest-invalid',
    });
    expect(verifyCatalogueBytes({ ...base, catalogueBytes: bytes.slice(1) })).toMatchObject({
      reason: 'size-mismatch',
    });
    const changed = new Uint8Array(bytes);
    changed[changed.length - 3] = changed[changed.length - 3] === 0x41 ? 0x42 : 0x41;
    expect(verifyCatalogueBytes({ ...base, catalogueBytes: changed })).toMatchObject({
      reason: 'sha256-mismatch',
    });
    expect(verifyCatalogueBytes({ ...base, trustedKeys: [] })).toMatchObject({
      reason: 'unknown-key',
    });
    expect(
      verifyCatalogueBytes({ ...base, trustedKeys: trusted(generateKeyPair()) }),
    ).toMatchObject({
      reason: 'bad-signature',
    });
    expect(verifyCatalogueBytes({ ...base, appVersion: '0.0.9' })).toMatchObject({
      reason: 'app-too-old',
    });
  });

  it('refuses a catalogue that is valid JSON but not in canonical form', () => {
    const { bytes, manifest } = readOut(f);
    const pretty = new TextEncoder().encode(
      JSON.stringify(JSON.parse(new TextDecoder().decode(bytes)), null, 2),
    );
    const forged = { ...manifest, sha256: sha256Hex(pretty), size: pretty.length };
    // The signature no longer matches either, but the canonical-form rule is checked first.
    expect(
      verifyCatalogueBytes({
        catalogueBytes: pretty,
        manifest: forged,
        trustedKeys: trusted(f.pair),
      }),
    ).toMatchObject({ ok: false, reason: 'not-canonical' });
  });

  it('refuses bytes that are not a catalogue at all', () => {
    const { manifest } = readOut(f);
    const junk = new TextEncoder().encode('{"shelves":[]}');
    expect(
      verifyCatalogueBytes({
        catalogueBytes: junk,
        manifest: { ...manifest, sha256: sha256Hex(junk), size: junk.length },
        trustedKeys: trusted(f.pair),
      }),
    ).toMatchObject({ ok: false, reason: 'catalogue-invalid' });
  });
});

describe('committed catalogue (Vos 1903)', () => {
  const out = path.join(root, 'apps/mobile/assets/catalogue');
  const pub = path.join(root, 'content/keys/dev.pub');

  it('verifies against the committed dev public key', () => {
    const result = verifyCatalogueBytes({
      catalogueBytes: new Uint8Array(fs.readFileSync(path.join(out, 'catalogue.json'))),
      manifest: JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')) as unknown,
      trustedKeys: [readTrustedKey(pub)],
      appVersion: '0.1.0',
    });
    expect(result.ok).toBe(true);
  });

  it('is current: it is what the sources and the installed packs give now (rebuild it after a pack changes)', async () => {
    const code = await runBuildCatalogue(['--check']);
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  });

  it('lists every committed pack and gives every installed work an editorial entry', () => {
    const catalogue = CatalogueSchema.parse(
      JSON.parse(fs.readFileSync(path.join(out, 'catalogue.json'), 'utf8')),
    );
    const packsDir = path.join(root, 'apps/mobile/assets/packs');
    const ids = fs
      .readdirSync(packsDir)
      .filter((name) => fs.existsSync(path.join(packsDir, name, 'manifest.json')))
      .sort();
    expect(catalogue.packs.map((pack) => pack.packId)).toEqual(ids);
    const workIds = new Set(
      ids.map(
        (id) =>
          (
            JSON.parse(fs.readFileSync(path.join(packsDir, id, 'manifest.json'), 'utf8')) as {
              workId: string;
            }
          ).workId,
      ),
    );
    expect(new Set(catalogue.works.map((work) => work.workId))).toEqual(workIds);
  });
});
