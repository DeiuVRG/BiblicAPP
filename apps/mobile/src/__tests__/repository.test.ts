import { bundledPacks } from '@/content/bundled-packs';
import {
  UnverifiedPackError,
  createInMemoryRepository,
  loadBundledRepository,
} from '@/content/repository';
import type { VerifiedPack } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import { verifyPack } from '@/content/verify-pack';

const [bundled] = bundledPacks;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('bundled sample pack (Vos 1903)', () => {
  it('passes verifyPack: schemas, sha256, Ed25519 signature with the pinned dev key', async () => {
    const result = await verifyPack({ ...bundled!, trustedKeys, appVersion: '0.1.0' });
    expect(result).toMatchObject({ ok: true, signatureVerified: true });
  });

  it('is rejected when the text is tampered with', async () => {
    const pack = clone(bundled!.pack) as { paragraphs: { text: string }[] };
    pack.paragraphs[0]!.text = pack.paragraphs[0]!.text.replace('kingdom', 'Kingdom');
    const result = await verifyPack({
      manifest: bundled!.manifest,
      pack,
      trustedKeys,
      appVersion: '0.1.0',
    });
    expect(result).toMatchObject({ ok: false, reason: 'sha256-mismatch' });
  });

  it('is rejected when the manifest is altered (the signature covers it)', async () => {
    const manifest = { ...(bundled!.manifest as object), revision: 99 };
    const result = await verifyPack({
      manifest,
      pack: bundled!.pack,
      trustedKeys,
      appVersion: '0.1.0',
    });
    expect(result).toMatchObject({ ok: false, reason: 'bad-signature' });
  });

  it('is rejected without the pinned keys', async () => {
    const result = await verifyPack({ ...bundled!, trustedKeys: [], appVersion: '0.1.0' });
    expect(result).toMatchObject({ ok: false, reason: 'unknown-key' });
  });

  it('is served through the repository', async () => {
    const { repository, rejected } = await loadBundledRepository();
    expect(rejected).toEqual([]);
    const works = await repository.listWorks();
    expect(works).toHaveLength(1);
    expect(works[0]).toMatchObject({
      slug: 'vos-1903-kingdom',
      authorName: 'Geerhardus Vos',
      editionLanguage: 'en',
      licenceStatus: 'public-domain',
    });
    const sections = await repository.getSections(works[0]!.workId);
    expect(sections).toHaveLength(11);
    expect(sections[0]!.heading).toBe('I. Introductory');
    const paragraphs = await repository.getParagraphs(sections[0]!.id);
    expect(paragraphs.length).toBeGreaterThan(5);
    expect(paragraphs[0]!.text.startsWith('In the body of our Lord')).toBe(true);
    expect((await repository.search('kingdom of heaven')).length).toBeGreaterThan(0);
    expect(await repository.search('x')).toEqual([]);
  });
});

describe('verification gate', () => {
  it('hides packs that fail verification', async () => {
    const { repository, rejected } = await loadBundledRepository({
      verify: async () => ({ ok: false, reason: 'bad-signature' }),
    });
    expect(await repository.listWorks()).toEqual([]);
    expect(rejected).toEqual([{ packId: 'vos-1903-kingdom-en', reason: 'bad-signature' }]);
  });

  it('hides a pack whose signature was tampered with (end to end)', async () => {
    const manifest = clone(bundled!.manifest) as { signature: string };
    manifest.signature = `${manifest.signature[0] === 'A' ? 'B' : 'A'}${manifest.signature.slice(1)}`;
    const { repository, rejected } = await loadBundledRepository({
      packs: [{ manifest, pack: bundled!.pack }],
    });
    expect(await repository.listWorks()).toEqual([]);
    expect(rejected[0]).toMatchObject({ reason: 'bad-signature' });
  });

  it('does not accept a verifier that approves without checking the signature', async () => {
    const real = await verifyPack({ ...bundled!, trustedKeys, appVersion: '0.1.0' });
    if (!real.ok) throw new Error('fixture must verify');
    const lax = async () =>
      ({ ok: true, manifest: real.manifest, pack: real.pack, signatureVerified: false }) as never;
    const { repository, rejected } = await loadBundledRepository({ verify: lax });
    expect(await repository.listWorks()).toEqual([]);
    expect(rejected[0]).toMatchObject({ reason: 'unverified' });
  });

  it('createInMemoryRepository refuses packs that were not verified', async () => {
    const real = await verifyPack({ ...bundled!, trustedKeys, appVersion: '0.1.0' });
    if (!real.ok) throw new Error('fixture must verify');
    const forged = [{ manifest: real.manifest, pack: real.pack }] as unknown as VerifiedPack[];
    expect(() => createInMemoryRepository(forged)).toThrow(UnverifiedPackError);
    const flagged = [
      { manifest: real.manifest, pack: real.pack, signatureVerified: false },
    ] as unknown as VerifiedPack[];
    expect(() => createInMemoryRepository(flagged)).toThrow(UnverifiedPackError);
  });

  it('createInMemoryRepository handles an empty list', async () => {
    const repo = createInMemoryRepository([]);
    expect(await repo.listWorks()).toEqual([]);
    expect(await repo.getWork('nope')).toBeNull();
  });
});
