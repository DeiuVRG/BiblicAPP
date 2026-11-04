import { createInMemoryRepository, loadBundledRepository } from '@/content/repository';
import type { VerifiedPack } from '@/content/repository';
import { bundledPacks } from '@/content/bundled-packs';
import { verifyPack } from '@/content/verify-pack';

describe('bundled placeholder pack', () => {
  it('passes verifyPack (schema, identity, size, sha256)', async () => {
    const [bundled] = bundledPacks;
    const result = await verifyPack({ ...bundled!, trustedKeys: [] });
    expect(result.ok).toBe(true);
  });

  it('is rejected when the content is tampered with', async () => {
    const [bundled] = bundledPacks;
    const pack = JSON.parse(JSON.stringify(bundled!.pack)) as { sections: { heading: string }[] };
    pack.sections[0]!.heading = 'Altered';
    const result = await verifyPack({ manifest: bundled!.manifest, pack, trustedKeys: [] });
    expect(result).toMatchObject({ ok: false });
  });

  it('is served through the repository', async () => {
    const { repository, rejected } = await loadBundledRepository();
    expect(rejected).toEqual([]);
    const works = await repository.listWorks();
    expect(works).toHaveLength(1);
    const sections = await repository.getSections(works[0]!.workId);
    expect(sections.length).toBeGreaterThan(0);
    const paragraphs = await repository.getParagraphs(sections[0]!.id);
    expect(paragraphs.length).toBeGreaterThan(0);
    expect(await repository.search('biblioteca')).toHaveLength(1);
    expect(await repository.search('Căutarea')).toHaveLength(1);
    expect(await repository.search('x')).toEqual([]);
  });

  it('hides packs that fail verification', async () => {
    const { repository, rejected } = await loadBundledRepository({
      verify: async () => ({ ok: false, reason: 'bad-signature' }),
    });
    expect(await repository.listWorks()).toEqual([]);
    expect(rejected).toHaveLength(1);
  });

  it('createInMemoryRepository handles an empty list', async () => {
    const repo = createInMemoryRepository([] as VerifiedPack[]);
    expect(await repo.listWorks()).toEqual([]);
    expect(await repo.getWork('nope')).toBeNull();
  });
});
