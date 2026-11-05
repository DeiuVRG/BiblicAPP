import { CatalogueSchema } from '@biblioteca/shared';
import type { Catalogue } from '@biblioteca/shared';

import { bundledCatalogue } from '@/catalogue/bundled-catalogue';
import { loadBundledCatalogue, verifyCatalogue } from '@/catalogue/verify-catalogue';
import type { VerifyCatalogueResult } from '@/catalogue/verify-catalogue';
import { loadBundledRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import type { VerifyPackResult } from '@/content/verify-pack';
import { verifyPack } from '@/content/verify-pack';
import { copyOfBundledCatalogue, signCatalogue } from '@/test-support/catalogue';
import { syntheticLibrary } from '@/test-support/library-fixtures';
import { bundledPack, clone, createTestSigner } from '@/test-support/packs';
import { vosEditions } from '@/test-support/vos';

const input = (overrides: Partial<Parameters<typeof verifyCatalogue>[0]> = {}) => ({
  manifest: bundledCatalogue.manifest,
  catalogue: bundledCatalogue.catalogue,
  trustedKeys,
  appVersion: '0.1.0',
  ...overrides,
});

describe('the bundled catalogue (Vos 1903)', () => {
  it('passes verifyCatalogue: schemas, sha256 and the Ed25519 signature with the pinned dev key', async () => {
    const result = await verifyCatalogue(input());
    expect(result).toMatchObject({ ok: true, signatureVerified: true });
  });

  it('lists exactly the packs that are bundled, with the sha256 and size of their manifests', async () => {
    const result = (await verifyCatalogue(input())) as Extract<VerifyCatalogueResult, { ok: true }>;
    for (const entry of result.catalogue.packs) {
      const manifest = bundledPack(entry.packId).manifest as {
        sha256: string;
        size: number;
        editionId: string;
      };
      expect(entry).toMatchObject({
        editionId: manifest.editionId,
        sha256: manifest.sha256,
        size: manifest.size,
      });
    }
    expect(result.catalogue.packs.map((entry) => entry.packId).sort()).toEqual([
      'vos-1903-kingdom-en',
      'vos-1903-kingdom-ro',
    ]);
  });

  it('holds the editorial record of the one installed work, in both languages and without a licence field', async () => {
    const result = (await verifyCatalogue(input())) as Extract<VerifyCatalogueResult, { ok: true }>;
    const [work] = result.catalogue.works;
    expect(work).toMatchObject({
      slug: 'vos-1903-kingdom',
      authorSlug: 'geerhardus-vos',
      kind: 'treatise',
    });
    expect(work!.blurbRo).toMatch(/Împărăția/);
    expect(work!.blurbEn).toMatch(/kingdom/);
    expect(JSON.stringify(result.catalogue)).not.toMatch(/licen/i);
    expect(JSON.stringify(result.catalogue)).not.toMatch(/[ŞşŢţ]/);
  });
});

describe('verifyCatalogue refuses what it cannot trust', () => {
  const tampered = () => copyOfBundledCatalogue();

  it('a changed text of the same length: the sha256 gives it away', async () => {
    const copy = tampered();
    const catalogue = copy.catalogue as Catalogue;
    catalogue.works[0]!.blurbEn = catalogue.works[0]!.blurbEn.replace('Vos asks', 'Vos asxs');
    expect(await verifyCatalogue(input({ catalogue }))).toMatchObject({
      ok: false,
      reason: 'sha256-mismatch',
    });
  });

  it('a longer or shorter text: the size gives it away', async () => {
    const copy = tampered();
    const catalogue = copy.catalogue as Catalogue;
    catalogue.works[0]!.blurbEn += ' (edited)';
    expect(await verifyCatalogue(input({ catalogue }))).toMatchObject({
      ok: false,
      reason: 'size-mismatch',
    });
  });

  it('a changed manifest (the signature covers it)', async () => {
    const manifest = { ...(bundledCatalogue.manifest as object), revision: 99 };
    expect(await verifyCatalogue(input({ manifest }))).toMatchObject({
      ok: false,
      reason: 'bad-signature',
    });
  });

  it('a signature flipped in one character, an unknown key and another key', async () => {
    const manifest = clone(bundledCatalogue.manifest) as { signature: string };
    manifest.signature = `${manifest.signature[0] === 'A' ? 'B' : 'A'}${manifest.signature.slice(1)}`;
    expect(await verifyCatalogue(input({ manifest }))).toMatchObject({
      ok: false,
      reason: 'bad-signature',
    });
    expect(await verifyCatalogue(input({ trustedKeys: [] }))).toMatchObject({
      ok: false,
      reason: 'unknown-key',
    });
    const other = createTestSigner('dev-2026-11');
    expect(await verifyCatalogue(input({ trustedKeys: [other.key] }))).toMatchObject({
      ok: false,
      reason: 'bad-signature',
    });
  });

  it('a catalogue that is not coherent, and a manifest with a field it should not have', async () => {
    const copy = tampered();
    const catalogue = copy.catalogue as Catalogue;
    catalogue.works[0]!.shelves = ['nowhere'];
    expect(await verifyCatalogue(input({ catalogue }))).toMatchObject({
      ok: false,
      reason: 'catalogue-invalid',
    });
    const manifest = { ...(bundledCatalogue.manifest as object), extra: 1 };
    expect(await verifyCatalogue(input({ manifest }))).toMatchObject({
      ok: false,
      reason: 'manifest-invalid',
    });
  });

  it('an app that is too old, or whose version is unknown (fail closed)', async () => {
    const signer = createTestSigner();
    const demanding = signCatalogue(CatalogueSchema.parse(bundledCatalogue.catalogue), signer, {
      minAppVersion: '9.0.0',
    });
    const keys = [...trustedKeys, signer.key];
    expect(
      await verifyCatalogue({ ...demanding, trustedKeys: keys, appVersion: '0.1.0' }),
    ).toMatchObject({
      ok: false,
      reason: 'app-too-old',
    });
    // An unreadable version counts as 0.0.0: even the bundled catalogue (it needs 0.1.0) is refused.
    expect(await verifyCatalogue(input({ appVersion: undefined }))).toMatchObject({
      ok: false,
      reason: 'app-too-old',
    });
  });
});

describe('loadBundledCatalogue', () => {
  it('verifies the bundled catalogue once and hands over its content', async () => {
    const state = await loadBundledCatalogue();
    expect(state.status).toBe('verified');
    if (state.status !== 'verified') return;
    expect(state.catalogue.shelves).toHaveLength(8);
    expect(state.manifest.signingKeyId).toBe('dev-2026-11');
  });

  it('says "rejected" for a tampered catalogue and hands over nothing from it', async () => {
    const copy = copyOfBundledCatalogue();
    (copy.catalogue as Catalogue).shelves[0]!.labelEn = 'Creeds, confessions and catechismz';
    const state = await loadBundledCatalogue({ bundled: copy });
    expect(state).toMatchObject({ status: 'rejected', reason: 'sha256-mismatch' });
    expect('catalogue' in state).toBe(false);
  });

  it('says "missing" when no catalogue is bundled', async () => {
    expect(await loadBundledCatalogue({ bundled: null })).toEqual({ status: 'missing' });
  });

  it('does not accept a verifier that approves without having checked the signature', async () => {
    const real = (await verifyCatalogue(input())) as Extract<VerifyCatalogueResult, { ok: true }>;
    const lax = async () => ({ ...real, signatureVerified: false }) as never;
    expect(await loadBundledCatalogue({ verify: lax })).toMatchObject({ status: 'rejected' });
  });
});

describe('packs and the signed catalogue (check C1)', () => {
  const failIfCalled = async (): Promise<VerifyPackResult> => {
    throw new Error('a pack that the catalogue lists must not be verified in full at start');
  };

  it('admits the packs the verified catalogue lists without verifying them in full at start', async () => {
    const catalogue = await loadBundledCatalogue();
    const verify = jest.fn(failIfCalled);
    const loaded = await loadBundledRepository({ catalogue, verify });
    expect(verify).not.toHaveBeenCalled();
    expect(loaded.rejected).toEqual([]);
    expect(loaded.catalogue.status).toBe('verified');
    const { repository } = loaded;
    // Listing reads metadata only; opening an edition checks its bytes (once) and serves it.
    const { english, romanian, englishSections } = await vosEditions(repository);
    expect(english.sectionCount).toBe(11);
    expect(romanian.sectionCount).toBeGreaterThanOrEqual(1);
    expect(englishSections).toHaveLength(11);
    const paragraphs = await repository.getParagraphs(englishSections[0]!.id);
    expect(paragraphs.length).toBeGreaterThan(5);
    expect(await repository.getEdition(english.editionId)).not.toBeNull();
    expect(repository.refusedPacks()).toEqual([]);
  });

  it('serves the same content as the full verification does (the lazy check changes when, not what)', async () => {
    const catalogue = await loadBundledCatalogue();
    const lazy = await loadBundledRepository({ catalogue });
    const eager = await loadBundledRepository();
    const [left] = await lazy.repository.listWorks();
    const [right] = await eager.repository.listWorks();
    expect(left).toEqual(right);
    const sections = await lazy.repository.getSections(left!.editions[0]!.editionId);
    expect(sections).toEqual(await eager.repository.getSections(left!.editions[0]!.editionId));
    expect(await lazy.repository.search('kingdom of heaven')).toEqual(
      await eager.repository.search('kingdom of heaven'),
    );
  });

  it('verifies a pack that the catalogue does not list in full, as before', async () => {
    const catalogue = await loadBundledCatalogue();
    const verify = jest.fn(verifyPack);
    const english = bundledPack('vos-1903-kingdom-en');
    const unlisted = signCatalogue(
      { ...(catalogue as { catalogue: Catalogue }).catalogue, packs: [] },
      createTestSigner(),
    );
    const signer = createTestSigner('other');
    const state = await loadBundledCatalogue({
      bundled: signCatalogue(
        { ...(catalogue as { catalogue: Catalogue }).catalogue, packs: [] },
        signer,
      ),
      trustedKeys: [...trustedKeys, signer.key],
    });
    expect(unlisted.catalogue).toBeTruthy();
    const loaded = await loadBundledRepository({ packs: [english], catalogue: state, verify });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(loaded.rejected).toEqual([]);
    expect(await loaded.repository.listWorks()).toHaveLength(1);
  });

  it('does not trust a tampered catalogue: every pack is verified in full and the catalogue is "rejected"', async () => {
    const copy = copyOfBundledCatalogue();
    (copy.catalogue as Catalogue).shelves[0]!.descEn += '!';
    const catalogue = await loadBundledCatalogue({ bundled: copy });
    const verify = jest.fn(verifyPack);
    const loaded = await loadBundledRepository({ catalogue, verify });
    expect(loaded.catalogue.status).toBe('rejected');
    expect(verify).toHaveBeenCalledTimes(2);
    // The packs are genuine, so the library still lists them.
    expect(loaded.rejected).toEqual([]);
    expect(await loaded.repository.listWorks()).toHaveLength(1);
  });

  it('refuses at start a pack whose manifest is not the one the catalogue lists (a pack rebuilt without the catalogue)', async () => {
    const signer = createTestSigner();
    const base = CatalogueSchema.parse(bundledCatalogue.catalogue);
    const stale: Catalogue = {
      ...base,
      packs: base.packs.map((entry) =>
        entry.packId === 'vos-1903-kingdom-ro' ? { ...entry, sha256: '0'.repeat(64) } : entry,
      ),
    };
    const keys = [...trustedKeys, signer.key];
    const catalogue = await loadBundledCatalogue({
      bundled: signCatalogue(stale, signer),
      trustedKeys: keys,
    });
    expect(catalogue.status).toBe('verified');
    const { repository, rejected } = await loadBundledRepository({ catalogue });
    expect(rejected).toEqual([
      expect.objectContaining({ packId: 'vos-1903-kingdom-ro', reason: 'catalogue-mismatch' }),
    ]);
    const [work] = await repository.listWorks();
    expect(work!.editions.map((edition) => edition.language)).toEqual(['en']);
  });

  describe('a pack whose bytes are not the ones the catalogue lists', () => {
    // The manifest and the catalogue agree, the pack object was changed afterwards: this is found
    // when the edition is opened, not before.
    const setup = async () => {
      const library = syntheticLibrary();
      const target = library.packs.find(
        (pack) => (pack.manifest as { packId: string }).packId === 'omorarea-pacatului-en',
      )!;
      const changed = clone(target);
      (changed.pack as { paragraphs: { text: string }[] }).paragraphs[0]!.text += ' (edited)';
      const packs = library.packs.map((pack) => (pack === target ? changed : pack));
      const catalogue = await loadBundledCatalogue({
        bundled: library.bundledCatalogue,
        trustedKeys: library.trustedKeys,
      });
      const verify = jest.fn(failIfCalled);
      const loaded = await loadBundledRepository({
        packs,
        trustedKeys: library.trustedKeys,
        catalogue,
        verify,
      });
      const editionId = (changed.manifest as { editionId: string }).editionId;
      const workId = library.workIds['omorarea-pacatului']!;
      return { library, loaded, editionId, workId, changed, verify };
    };

    it('is listed until its edition is opened, and refused then (a longer text is found by its size)', async () => {
      const { loaded, editionId, workId, verify } = await setup();
      const { repository } = loaded;
      expect(verify).not.toHaveBeenCalled();
      expect(loaded.rejected).toEqual([]);
      expect(await repository.getWork(workId)).not.toBeNull();

      const sections = await repository.getSections(editionId);
      expect(sections).toEqual([]);
      expect(await repository.getEdition(editionId)).toBeNull();
      expect(repository.refusedPacks()).toEqual([
        expect.objectContaining({ packId: 'omorarea-pacatului-en', reason: 'size-mismatch' }),
      ]);
      // From then on it is gone from the lists, and the other works are not touched.
      expect(await repository.getWork(workId)).toBeNull();
      const slugs = (await repository.listWorks()).map((work) => work.slug);
      expect(slugs).not.toContain('omorarea-pacatului');
      expect(slugs).toHaveLength(15);
    });

    it('answers every way of opening it with nothing', async () => {
      const { loaded, editionId, changed } = await setup();
      const { repository } = loaded;
      const pack = changed.pack as { sections: { id: string }[]; paragraphs: { id: string }[] };
      expect(await repository.getParagraphs(pack.sections[0]!.id)).toEqual([]);
      expect(await repository.locateSection(pack.sections[0]!.id)).toBeNull();
      expect(await repository.getEdition(editionId)).toBeNull();
    });

    it('is checked once, however many callers wait for it, and a search skips it', async () => {
      const { loaded, editionId } = await setup();
      const { repository } = loaded;
      await Promise.all([
        repository.getEdition(editionId),
        repository.getSections(editionId),
        repository.getEdition(editionId),
      ]);
      expect(repository.refusedPacks()).toHaveLength(1);
      // Only the refused pack has this word: a search finds nothing (and does not serve its text).
      expect(await repository.search('Mortification')).toEqual([]);
      expect((await repository.search('Pastoral Rule')).length).toBeGreaterThan(0);
      expect(repository.refusedPacks()).toHaveLength(1);
    });

    it('is refused by a search too, when nothing opened it before', async () => {
      const { loaded, editionId } = await setup();
      expect(await loaded.repository.search('Mortification')).toEqual([]);
      expect(loaded.repository.refusedPacks()).toEqual([
        expect.objectContaining({ packId: 'omorarea-pacatului-en' }),
      ]);
      expect(await loaded.repository.getEdition(editionId)).toBeNull();
    });

    it('finds a text changed to the same length by its sha256', async () => {
      const library = syntheticLibrary();
      const target = library.packs.find(
        (pack) => (pack.manifest as { packId: string }).packId === 'afectiunile-religioase-en',
      )!;
      const changed = clone(target);
      const paragraph = (changed.pack as { paragraphs: { text: string }[] }).paragraphs[0]!;
      paragraph.text = paragraph.text.replace('Fragment', 'Fragmant');
      const catalogue = await loadBundledCatalogue({
        bundled: library.bundledCatalogue,
        trustedKeys: library.trustedKeys,
      });
      const { repository } = await loadBundledRepository({
        packs: library.packs.map((pack) => (pack === target ? changed : pack)),
        trustedKeys: library.trustedKeys,
        catalogue,
      });
      const editionId = (changed.manifest as { editionId: string }).editionId;
      expect(await repository.getSections(editionId)).toEqual([]);
      expect(repository.refusedPacks()).toEqual([
        expect.objectContaining({ packId: 'afectiunile-religioase-en', reason: 'sha256-mismatch' }),
      ]);
    });

    it('does not open the editions a search never reaches (it stops at its cap)', async () => {
      const { loaded } = await setup();
      // "harul" is in every edition: the search fills its 50 hits before it gets to this pack.
      expect((await loaded.repository.search('harul')).length).toBe(50);
      expect(loaded.repository.refusedPacks()).toEqual([]);
    });
  });

  it('keeps counts and lists in step: the synthetic library loads with no pack rejected or refused', async () => {
    const library = syntheticLibrary();
    const loaded = await library.load();
    expect(loaded.rejected).toEqual([]);
    expect(loaded.catalogue.status).toBe('verified');
    expect(await loaded.repository.listWorks()).toHaveLength(16);
    expect((await loaded.repository.search('harul')).length).toBeGreaterThan(0);
    expect(loaded.repository.refusedPacks()).toEqual([]);
  });
});
