import type { Pack } from '@biblioteca/shared';

import type { BundledPack } from '@/content/bundled-packs';
import {
  UnverifiedPackError,
  admitPacks,
  createInMemoryRepository,
  loadBundledRepository,
} from '@/content/repository';
import type { VerifiedPack } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import { verifyPack } from '@/content/verify-pack';
import {
  bundledPack,
  clone,
  createTestSigner,
  signPack,
  translationOf,
} from '@/test-support/packs';
import type { TranslationOptions } from '@/test-support/packs';
import { vosEditions } from '@/test-support/vos';

const bundled = bundledPack('vos-1903-kingdom-en');

describe('bundled sample pack (Vos 1903)', () => {
  it('passes verifyPack: schemas, sha256, Ed25519 signature with the pinned dev key', async () => {
    const result = await verifyPack({ ...bundled, trustedKeys, appVersion: '0.1.0' });
    expect(result).toMatchObject({ ok: true, signatureVerified: true });
  });

  it('is rejected when the text is tampered with', async () => {
    const pack = clone(bundled.pack) as { paragraphs: { text: string }[] };
    pack.paragraphs[0]!.text = pack.paragraphs[0]!.text.replace('kingdom', 'Kingdom');
    const result = await verifyPack({
      manifest: bundled.manifest,
      pack,
      trustedKeys,
      appVersion: '0.1.0',
    });
    expect(result).toMatchObject({ ok: false, reason: 'sha256-mismatch' });
  });

  it('is rejected when the manifest is altered (the signature covers it)', async () => {
    const manifest = { ...(bundled.manifest as object), revision: 99 };
    const result = await verifyPack({
      manifest,
      pack: bundled.pack,
      trustedKeys,
      appVersion: '0.1.0',
    });
    expect(result).toMatchObject({ ok: false, reason: 'bad-signature' });
  });

  it('is rejected without the pinned keys', async () => {
    const result = await verifyPack({ ...bundled, trustedKeys: [], appVersion: '0.1.0' });
    expect(result).toMatchObject({ ok: false, reason: 'unknown-key' });
  });

  it('is served through the repository, next to its Romanian translation', async () => {
    const { repository, rejected } = await loadBundledRepository();
    expect(rejected).toEqual([]);
    const works = await repository.listWorks();
    // Two packs, one work: the library lists the work once.
    expect(works).toHaveLength(1);
    expect(works[0]).toMatchObject({
      slug: 'vos-1903-kingdom',
      authorName: 'Geerhardus Vos',
      languageOrig: 'en',
    });
    const { english, romanian, englishSections } = await vosEditions(repository);
    expect(english).toMatchObject({
      kind: 'source',
      language: 'en',
      licenceStatus: 'public-domain',
      sectionCount: 11,
    });
    // The Romanian pack grows as chapters are translated: only what holds at every stage is checked.
    expect(romanian).toMatchObject({
      kind: 'translation',
      language: 'ro',
      sourceEditionId: english.editionId,
    });
    expect(romanian.sectionCount).toBeGreaterThanOrEqual(1);
    expect(romanian.sectionCount).toBeLessThanOrEqual(english.sectionCount);
    expect(englishSections[0]!.heading).toBe('I. Introductory');
    const paragraphs = await repository.getParagraphs(englishSections[0]!.id);
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
    expect(rejected).toEqual([
      { packId: 'vos-1903-kingdom-en', reason: 'bad-signature' },
      { packId: 'vos-1903-kingdom-ro', reason: 'bad-signature' },
    ]);
  });

  it('hides a pack whose signature was tampered with (end to end)', async () => {
    const manifest = clone(bundled.manifest) as { signature: string };
    manifest.signature = `${manifest.signature[0] === 'A' ? 'B' : 'A'}${manifest.signature.slice(1)}`;
    const { repository, rejected } = await loadBundledRepository({
      packs: [{ manifest, pack: bundled.pack }],
    });
    expect(await repository.listWorks()).toEqual([]);
    expect(rejected[0]).toMatchObject({ reason: 'bad-signature' });
  });

  it('does not accept a verifier that approves without checking the signature', async () => {
    const real = await verifyPack({ ...bundled, trustedKeys, appVersion: '0.1.0' });
    if (!real.ok) throw new Error('fixture must verify');
    const lax = async () =>
      ({ ok: true, manifest: real.manifest, pack: real.pack, signatureVerified: false }) as never;
    const { repository, rejected } = await loadBundledRepository({ verify: lax });
    expect(await repository.listWorks()).toEqual([]);
    expect(rejected[0]).toMatchObject({ reason: 'unverified' });
  });

  it('createInMemoryRepository refuses packs that were not verified', async () => {
    const real = await verifyPack({ ...bundled, trustedKeys, appVersion: '0.1.0' });
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
    expect(await repo.getEdition('nope')).toBeNull();
    expect(await repo.getSections('nope')).toEqual([]);
    expect(await repo.locateSection('nope')).toBeNull();
  });
});

describe('two editions of one work', () => {
  const signer = createTestSigner();
  const trusted = [...trustedKeys, signer.key];
  const english = bundled.pack as Pack;

  const load = (packs: BundledPack[]) => loadBundledRepository({ packs, trustedKeys: trusted });
  const translation = (options?: TranslationOptions, packId = 'vos-synthetic-ro') => {
    const pack = translationOf(english, options);
    return { pack, signed: signPack(pack, signer, { packId }) };
  };

  it('lists one work with both editions, the Romanian translation first and primary', async () => {
    const ro = translation();
    const { repository, rejected } = await load([bundled, ro.signed]);
    expect(rejected).toEqual([]);

    const works = await repository.listWorks();
    expect(works).toHaveLength(1);
    const [work] = works;
    expect(work).toMatchObject({
      workId: english.work.id,
      slug: 'vos-1903-kingdom',
      titleRo: english.work.titleRo,
      titleOrig: english.work.titleOrig,
      authorName: 'Geerhardus Vos',
      year: 1903,
      languageOrig: 'en',
    });
    // Translations into Romanian first, then the source.
    expect(work!.editions.map((edition) => [edition.language, edition.kind])).toEqual([
      ['ro', 'translation'],
      ['en', 'source'],
    ]);
    expect(work!.primaryEditionId).toBe(ro.pack.edition.id);
    expect(work!.editions[0]).toEqual({
      editionId: ro.pack.edition.id,
      packId: 'vos-synthetic-ro',
      language: 'ro',
      kind: 'translation',
      licenceStatus: 'licensed',
      licenceNote: 'Synthetic translation made for tests.',
      sourceEditionId: english.edition.id,
      sectionCount: 3,
    });
    // A source edition has no sourceEditionId at all (not an undefined one).
    expect(work!.editions[1]).toEqual({
      editionId: english.edition.id,
      packId: 'vos-1903-kingdom-en',
      language: 'en',
      kind: 'source',
      licenceStatus: 'public-domain',
      licenceNote: english.edition.licence.note,
      sectionCount: 11,
    });
    expect('sourceEditionId' in work!.editions[1]!).toBe(false);
  });

  it('does not depend on the order the packs are installed in', async () => {
    const ro = translation();
    const { repository } = await load([ro.signed, bundled]);
    const [work] = await repository.listWorks();
    expect(work!.editions.map((edition) => edition.language)).toEqual(['ro', 'en']);
    expect(await repository.listWorks()).toHaveLength(1);
  });

  it('makes the edition in the reading language primary, with a fallback ro, en, source', async () => {
    const ro = translation();
    const { repository } = await load([bundled, ro.signed]);
    expect((await repository.listWorks())[0]!.primaryEditionId).toBe(ro.pack.edition.id); // default
    expect((await repository.listWorks('ro'))[0]!.primaryEditionId).toBe(ro.pack.edition.id);
    expect((await repository.listWorks('en'))[0]!.primaryEditionId).toBe(english.edition.id);
    expect((await repository.getWork(english.work.id, 'en'))?.primaryEditionId).toBe(
      english.edition.id,
    );
    expect((await repository.getWork(english.work.id))?.primaryEditionId).toBe(ro.pack.edition.id);

    // Only the English pack: a Romanian reader gets the English edition.
    const alone = await load([bundled]);
    expect((await alone.repository.listWorks('ro'))[0]!.primaryEditionId).toBe(english.edition.id);
  });

  it('gives the sections of each edition separately, in order', async () => {
    const ro = translation({ sections: 4 });
    const { repository } = await load([bundled, ro.signed]);

    const romanian = await repository.getSections(ro.pack.edition.id);
    expect(romanian.map((section) => section.id)).toEqual(
      ro.pack.sections.map((section) => section.id),
    );
    expect(romanian.map((section) => section.ordinal)).toEqual([0, 1, 2, 3]);

    const source = await repository.getSections(english.edition.id);
    expect(source).toHaveLength(11);
    expect(source.map((section) => section.id)).toEqual(
      [...english.sections].sort((a, b) => a.ordinal - b.ordinal).map((section) => section.id),
    );
    expect(await repository.getSections('no-such-edition')).toEqual([]);
    // The work id is not an edition id any more.
    expect(await repository.getSections(english.work.id)).toEqual([]);
  });

  it('gives the paragraphs of a section of either edition', async () => {
    const ro = translation();
    const { repository } = await load([bundled, ro.signed]);
    const romanian = await repository.getParagraphs(ro.pack.sections[0]!.id);
    expect(romanian).toHaveLength(2);
    expect(romanian[0]!.text).toMatch(/^Text sintetic 1\.1/);
    const source = await repository.getParagraphs(english.sections[0]!.id);
    expect(source[0]!.text.startsWith('In the body of our Lord')).toBe(true);
  });

  it('says which work and edition a section belongs to', async () => {
    const ro = translation();
    const { repository } = await load([bundled, ro.signed]);
    expect(await repository.locateSection(ro.pack.sections[1]!.id)).toEqual({
      workId: english.work.id,
      editionId: ro.pack.edition.id,
      language: 'ro',
    });
    expect(await repository.locateSection(english.sections[3]!.id)).toEqual({
      workId: english.work.id,
      editionId: english.edition.id,
      language: 'en',
    });
    expect(await repository.locateSection('missing')).toBeNull();
    // A paragraph id is not a section id.
    expect(await repository.locateSection(english.paragraphs[0]!.id)).toBeNull();
  });

  it('gives the work and the edition record of an edition', async () => {
    const ro = translation();
    const { repository } = await load([bundled, ro.signed]);
    const detail = await repository.getEdition(ro.pack.edition.id);
    expect(detail).toMatchObject({
      editionId: ro.pack.edition.id,
      packId: 'vos-synthetic-ro',
      language: 'ro',
      sectionCount: 3,
      work: { id: english.work.id, slug: 'vos-1903-kingdom' },
      edition: {
        id: ro.pack.edition.id,
        kind: 'translation',
        licence: {
          status: 'licensed',
          noteRo: 'Traducere sintetică făcută pentru teste.',
          noteEn: 'Synthetic translation made for tests (English note).',
        },
      },
    });
    expect(await repository.getEdition('missing')).toBeNull();
    const work = await repository.getWork(english.work.id);
    expect(work?.editions.map((edition) => edition.editionId)).toEqual([
      ro.pack.edition.id,
      english.edition.id,
    ]);
    expect(work?.work.id).toBe(english.work.id);
    expect(await repository.getWork('missing')).toBeNull();
  });

  it('puts the English title of the work together from whichever pack has it', async () => {
    const en = translation({ language: 'en', titleEn: 'The Kingdom of God, in English' });
    const { repository } = await load([bundled, en.signed]);
    const [work] = await repository.listWorks();
    expect(work!.titleEn).toBe('The Kingdom of God, in English');
    expect((await repository.getWork(english.work.id))?.work.titleEn).toBe(
      'The Kingdom of God, in English',
    );
    // Without such a pack the field is simply not there.
    const alone = await load([bundled]);
    expect('titleEn' in (await alone.repository.listWorks())[0]!).toBe(false);
  });

  it('keeps the metadata of the source edition when the translation carries other metadata', async () => {
    const ro = translation();
    const changed = clone(ro.pack);
    changed.work.titleRo = 'Un alt titlu';
    const { repository } = await load([
      signPack(changed, signer, { packId: 'vos-changed' }),
      bundled,
    ]);
    expect((await repository.listWorks())[0]!.titleRo).toBe(english.work.titleRo);
  });

  it('lists the editions of three languages: ro, then the source, then the rest', async () => {
    const ro = translation({ language: 'ro' });
    const de = translation({ language: 'de' }, 'vos-synthetic-de');
    const { repository, rejected } = await load([de.signed, bundled, ro.signed]);
    expect(rejected).toEqual([]);
    const [work] = await repository.listWorks('en');
    expect(work!.editions.map((edition) => edition.language)).toEqual(['ro', 'en', 'de']);
    expect(work!.primaryEditionId).toBe(english.edition.id);
  });

  it('matches editions on the language subtag: ro-MD is Romanian, en-GB is English', async () => {
    // A source in British English and a translation into Moldovan Romanian (BCP 47 codes).
    const british = clone(english);
    british.edition.language = 'en-GB';
    const moldovan = translationOf(british, { language: 'ro-MD' });
    const { repository, rejected } = await load([
      signPack(british, signer, { packId: 'vos-synthetic-en-gb' }),
      signPack(moldovan, signer, { packId: 'vos-synthetic-ro-md' }),
    ]);
    expect(rejected).toEqual([]);

    // The translation into Romanian goes first and opens first for a Romanian reader...
    const [forRomanian] = await repository.listWorks('ro');
    expect(forRomanian!.editions.map((edition) => edition.language)).toEqual(['ro-MD', 'en-GB']);
    expect(forRomanian!.primaryEditionId).toBe(moldovan.edition.id);
    // ...and the English edition opens first for an English one.
    expect((await repository.listWorks('en'))[0]!.primaryEditionId).toBe(british.edition.id);
    expect((await repository.getWork(british.work.id, 'ro'))?.primaryEditionId).toBe(
      moldovan.edition.id,
    );
    expect((await repository.getWork(british.work.id, 'en'))?.primaryEditionId).toBe(
      british.edition.id,
    );
  });

  it('rejects the second pack with the same edition id, like a bad signature, with its packId', async () => {
    const first = translation();
    // Another pack (own section and paragraph ids) that claims the same edition.
    const second = translation({ editionId: first.pack.edition.id }, 'vos-synthetic-ro-again');
    const { repository, rejected } = await load([bundled, first.signed, second.signed]);
    expect(rejected).toEqual([{ packId: 'vos-synthetic-ro-again', reason: 'duplicate-edition' }]);

    const [work] = await repository.listWorks();
    expect(work!.editions).toHaveLength(2);
    // The first one is the one that is served; nothing of the second one is.
    expect(await repository.getSections(first.pack.edition.id)).toHaveLength(3);
    expect(await repository.locateSection(second.pack.sections[0]!.id)).toBeNull();
    expect(await repository.getParagraphs(second.pack.sections[0]!.id)).toEqual([]);
  });

  it('rejects the same pack installed twice', async () => {
    const { rejected } = await load([bundled, bundled]);
    expect(rejected).toEqual([{ packId: 'vos-1903-kingdom-en', reason: 'duplicate-edition' }]);
  });

  it('rejects a pack whose section id is already taken by another pack', async () => {
    const first = translation();
    const second = translation(undefined, 'vos-synthetic-clash');
    // A different edition, but one of its sections reuses the id of a section of the first.
    const clash = clone(second.pack);
    clash.sections[0]!.id = first.pack.sections[0]!.id;
    clash.paragraphs.forEach((paragraph) => {
      if (paragraph.sectionId === second.pack.sections[0]!.id)
        paragraph.sectionId = first.pack.sections[0]!.id;
    });
    const { repository, rejected } = await load([
      bundled,
      first.signed,
      signPack(clash, signer, { packId: 'vos-synthetic-clash' }),
    ]);
    expect(rejected).toEqual([{ packId: 'vos-synthetic-clash', reason: 'duplicate-id' }]);
    expect((await repository.listWorks())[0]!.editions).toHaveLength(2);
    // The section still belongs to the first pack.
    expect((await repository.locateSection(first.pack.sections[0]!.id))?.editionId).toBe(
      first.pack.edition.id,
    );
  });

  it('rejects a pack whose section id is taken by the bundled English pack', async () => {
    const ro = translation();
    const clash = clone(ro.pack);
    const taken = english.sections[2]!.id;
    clash.paragraphs.forEach((paragraph) => {
      if (paragraph.sectionId === clash.sections[0]!.id) paragraph.sectionId = taken;
    });
    clash.sections[0]!.id = taken;
    const { rejected } = await load([bundled, signPack(clash, signer, { packId: 'vos-clash' })]);
    expect(rejected).toEqual([{ packId: 'vos-clash', reason: 'duplicate-id' }]);
  });

  it('rejects a pack whose paragraph id is already taken by another pack', async () => {
    const first = translation();
    const second = translation(undefined, 'vos-synthetic-paragraph-clash');
    const clash = clone(second.pack);
    clash.paragraphs[0]!.id = first.pack.paragraphs[0]!.id;
    const { repository, rejected } = await load([
      bundled,
      first.signed,
      signPack(clash, signer, { packId: 'vos-synthetic-paragraph-clash' }),
    ]);
    expect(rejected).toEqual([{ packId: 'vos-synthetic-paragraph-clash', reason: 'duplicate-id' }]);
    expect((await repository.listWorks())[0]!.editions).toHaveLength(2);
  });

  it('finds the clashes among already verified packs (admitPacks), and the repository skips them', async () => {
    const first = translation();
    const second = translation({ editionId: first.pack.edition.id }, 'vos-synthetic-ro-again');
    const verified = await Promise.all(
      [bundled, first.signed, second.signed].map(async (candidate) => {
        const result = await verifyPack({
          ...candidate,
          trustedKeys: trusted,
          appVersion: '0.1.0',
        });
        if (!result.ok) throw new Error('fixture must verify');
        return { manifest: result.manifest, pack: result.pack, signatureVerified: true } as const;
      }),
    );
    const { accepted, rejected } = admitPacks(verified);
    expect(accepted.map((entry) => entry.manifest.packId)).toEqual([
      'vos-1903-kingdom-en',
      'vos-synthetic-ro',
    ]);
    expect(rejected).toEqual([{ packId: 'vos-synthetic-ro-again', reason: 'duplicate-edition' }]);

    // Called directly with the clash, the repository serves the first pack of each id only.
    const repository = createInMemoryRepository(verified);
    expect((await repository.listWorks())[0]!.editions).toHaveLength(2);
  });

  it('keeps rejecting for the right reason when verification failures come first', async () => {
    const first = translation();
    const unsigned = clone(first.signed);
    (unsigned.manifest as { signature: string }).signature = 'AAAA';
    const dup = translation({ editionId: first.pack.edition.id }, 'vos-dup');
    const { rejected } = await load([bundled, first.signed, unsigned, dup.signed]);
    expect(rejected.map((entry) => [entry.packId, entry.reason])).toEqual([
      ['vos-synthetic-ro', 'bad-signature'],
      ['vos-dup', 'duplicate-edition'],
    ]);
  });

  it('finds hits in both editions, each carrying its edition and language', async () => {
    const ro = translation();
    const { repository } = await load([bundled, ro.signed]);

    const romanian = await repository.search('Împărăția lui Dumnezeu este aproape');
    expect(romanian.length).toBe(ro.pack.paragraphs.length);
    expect(romanian.every((hit) => hit.editionId === ro.pack.edition.id)).toBe(true);
    expect(romanian.every((hit) => hit.language === 'ro')).toBe(true);
    expect(romanian.every((hit) => hit.workId === english.work.id)).toBe(true);
    const sectionIds = new Set(ro.pack.sections.map((section) => section.id));
    expect(romanian.every((hit) => sectionIds.has(hit.sectionId))).toBe(true);
    expect(romanian[0]!.sectionHeading).toBe(ro.pack.sections[0]!.heading);

    const source = await repository.search('kingdom of heaven');
    expect(source.length).toBeGreaterThan(0);
    expect(source.every((hit) => hit.editionId === english.edition.id)).toBe(true);
    expect(source.every((hit) => hit.language === 'en')).toBe(true);

    // The text is searched without caring for case and diacritics, in either edition.
    const folded = await repository.search('IMPARATIA LUI DUMNEZEU');
    expect(folded.some((hit) => hit.editionId === ro.pack.edition.id)).toBe(true);
  });

  it('caps the hits at 50 across both editions', async () => {
    const ro = translation({ sections: 3, paragraphsPerSection: 40 });
    const { repository } = await load([bundled, ro.signed]);
    // "de" is in nearly every paragraph of either edition.
    expect(await repository.search('de')).toHaveLength(50);
  });
});
