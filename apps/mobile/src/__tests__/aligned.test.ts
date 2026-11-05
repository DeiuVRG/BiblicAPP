import type { Pack, Paragraph, Section } from '@biblioteca/shared';

import type { BundledPack } from '@/content/bundled-packs';
import { loadBundledRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import {
  bundledPack,
  clone,
  createTestSigner,
  signPack,
  translationOf,
} from '@/test-support/packs';
import type { TranslationOptions } from '@/test-support/packs';

// The alignment of two editions of one work (docs/ui-spec-v2.md, 8.5): `getAlignedSection` and
// `getAlignedParagraphs`, which pair by `sourceId` and never drop a row for a gap (check R8).

const signer = createTestSigner();
const trusted = [...trustedKeys, signer.key];
const bundled = bundledPack('vos-1903-kingdom-en');
const english = bundled.pack as Pack;
const englishSections = [...english.sections].sort((a, b) => a.ordinal - b.ordinal);
const paragraphsOf = (pack: Pack, section: Section): Paragraph[] =>
  pack.paragraphs.filter((p) => p.sectionId === section.id).sort((a, b) => a.ordinal - b.ordinal);

const load = (packs: BundledPack[]) => loadBundledRepository({ packs, trustedKeys: trusted });
const translation = (options: TranslationOptions, packId: string) => {
  const pack = translationOf(english, options);
  return { pack, signed: signPack(pack, signer, { packId }) };
};

describe('getAlignedSection', () => {
  it('finds the section of the other edition that renders the same source section, in both directions', async () => {
    const ro = translation({ sections: 3 }, 'vos-ro-3');
    const { repository } = await load([bundled, ro.signed]);
    const roSections = [...ro.pack.sections].sort((a, b) => a.ordinal - b.ordinal);

    for (const [index, roSection] of roSections.entries()) {
      const enSection = englishSections[index]!;
      expect((await repository.getAlignedSection(enSection.id, ro.pack.edition.id))?.id).toBe(
        roSection.id,
      );
      expect((await repository.getAlignedSection(roSection.id, english.edition.id))?.id).toBe(
        enSection.id,
      );
    }
  });

  it('is the section itself for its own edition, and null where the other edition has not translated it', async () => {
    const ro = translation({ sections: 3 }, 'vos-ro-3');
    const { repository } = await load([bundled, ro.signed]);
    const fourth = englishSections[3]!;
    expect((await repository.getAlignedSection(fourth.id, english.edition.id))?.id).toBe(fourth.id);
    expect(await repository.getAlignedSection(fourth.id, ro.pack.edition.id)).toBeNull();
  });

  it('is null for an unknown section, an unknown edition and an edition of another work', async () => {
    const ro = translation({ sections: 3 }, 'vos-ro-3');
    const other = clone(ro.pack);
    other.work = { ...other.work, id: 'another-work-id', slug: 'another-work' };
    other.edition = { ...other.edition, id: 'another-edition-id' };
    const idOf = new Map(other.sections.map((section) => [section.id, `${section.id}-b`]));
    other.sections = other.sections.map((section) => ({ ...section, id: idOf.get(section.id)! }));
    other.paragraphs = other.paragraphs.map((paragraph) => ({
      ...paragraph,
      id: `${paragraph.id}-b`,
      sectionId: idOf.get(paragraph.sectionId)!,
    }));
    const { repository, rejected } = await load([
      bundled,
      ro.signed,
      signPack(other, signer, { packId: 'another-work-ro' }),
    ]);
    expect(rejected).toEqual([]);
    const first = englishSections[0]!;
    expect(await repository.getAlignedSection('no-such-section', ro.pack.edition.id)).toBeNull();
    expect(await repository.getAlignedSection(first.id, 'no-such-edition')).toBeNull();
    expect(await repository.getAlignedSection(first.id, 'another-edition-id')).toBeNull();
  });
});

describe('getAlignedParagraphs', () => {
  it('has a row for every source paragraph, the source on one side and the translation on the other', async () => {
    const ro = translation({ sections: 3, paragraphsPerSection: 2 }, 'vos-ro-3');
    const { repository } = await load([bundled, ro.signed]);
    const first = englishSections[0]!;
    const source = paragraphsOf(english, first);
    expect(source.length).toBeGreaterThan(2);

    const rows = await repository.getAlignedParagraphs(first.id, ro.pack.edition.id);
    // One row per paragraph of the source section, in its order, keyed by the source paragraph.
    expect(rows.map((row) => row.sourceId)).toEqual(source.map((p) => p.id));
    expect(rows.every((row) => row.paragraph?.sectionId === first.id)).toBe(true);
    // The translation has the first two; the rest is a gap, not a dropped row.
    expect(rows.slice(0, 2).map((row) => row.other?.sourceId)).toEqual([source[0]!.id, source[1]!.id]);
    expect(rows.slice(2).every((row) => row.other === null)).toBe(true);
  });

  it('read from the translation, still has every source row and no paragraph on the side that is missing', async () => {
    const ro = translation({ sections: 3, paragraphsPerSection: 2 }, 'vos-ro-3');
    const { repository } = await load([bundled, ro.signed]);
    const roFirst = [...ro.pack.sections].sort((a, b) => a.ordinal - b.ordinal)[0]!;
    const source = paragraphsOf(english, englishSections[0]!);

    const rows = await repository.getAlignedParagraphs(roFirst.id, english.edition.id);
    expect(rows).toHaveLength(source.length);
    expect(rows.map((row) => row.sourceId)).toEqual(source.map((p) => p.id));
    // The other side (English) has them all; this side (Romanian) has the two it translated.
    expect(rows.every((row) => row.other?.id === row.sourceId)).toBe(true);
    expect(rows.filter((row) => row.paragraph !== null)).toHaveLength(2);
    expect(rows[0]!.paragraph?.sourceId).toBe(source[0]!.id);
  });

  it('keeps the placeholder rows of a section that is not translated at all: as many as the source has paragraphs (R8)', async () => {
    const ro = translation({ sections: 3 }, 'vos-ro-3');
    const { repository } = await load([bundled, ro.signed]);
    const sixth = englishSections[5]!;
    const rows = await repository.getAlignedParagraphs(sixth.id, ro.pack.edition.id);
    expect(rows).toHaveLength(paragraphsOf(english, sixth).length);
    expect(rows.every((row) => row.paragraph !== null && row.other === null)).toBe(true);
  });

  it('pairs a section with itself: both sides are its paragraphs', async () => {
    const { repository } = await load([bundled]);
    const first = englishSections[0]!;
    const rows = await repository.getAlignedParagraphs(first.id, english.edition.id);
    expect(rows).toHaveLength(paragraphsOf(english, first).length);
    expect(rows.every((row) => row.paragraph?.id === row.other?.id)).toBe(true);
  });

  it('pairs two translations of one source, both pointing at the source paragraph (the Latin work of two translations)', async () => {
    const ro = translation({ sections: 4, paragraphsPerSection: 3, language: 'ro' }, 'vos-ro-4');
    const fr = translation({ sections: 2, paragraphsPerSection: 5, language: 'fr' }, 'vos-fr-2');
    const { repository, rejected } = await load([bundled, ro.signed, fr.signed]);
    expect(rejected).toEqual([]);
    const roFirst = [...ro.pack.sections].sort((a, b) => a.ordinal - b.ordinal)[0]!;
    const source = paragraphsOf(english, englishSections[0]!);

    const rows = await repository.getAlignedParagraphs(roFirst.id, fr.pack.edition.id);
    expect(rows.map((row) => row.sourceId)).toEqual(source.map((p) => p.id));
    // The row of the third source paragraph: Romanian has it (3 per section), French has it (5).
    expect(rows[2]).toMatchObject({
      paragraph: { sourceId: source[2]!.id },
      other: { sourceId: source[2]!.id },
    });
    // The fourth: Romanian stopped at three, French did not.
    expect(rows[3]!.paragraph).toBeNull();
    expect(rows[3]!.other?.sourceId).toBe(source[3]!.id);
    // The section too: a Romanian section aligns with the French one through the source section.
    const frSection = await repository.getAlignedSection(roFirst.id, fr.pack.edition.id);
    expect(frSection?.sourceId).toBe(englishSections[0]!.id);
    // French stopped at two sections: the third has no French section.
    const roThird = [...ro.pack.sections].sort((a, b) => a.ordinal - b.ordinal)[2]!;
    expect(await repository.getAlignedSection(roThird.id, fr.pack.edition.id)).toBeNull();
  });

  it('keeps every paragraph that exists even when the source edition is not installed', async () => {
    const ro = translation({ sections: 2, paragraphsPerSection: 3, language: 'ro' }, 'vos-ro-2');
    const fr = translation({ sections: 2, paragraphsPerSection: 2, language: 'fr' }, 'vos-fr-2b');
    // Two translations of a source that is not here: the pairs are still listed (mine first).
    const { repository } = await load([ro.signed, fr.signed]);
    const roFirst = [...ro.pack.sections].sort((a, b) => a.ordinal - b.ordinal)[0]!;
    const rows = await repository.getAlignedParagraphs(roFirst.id, fr.pack.edition.id);
    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.paragraph !== null)).toHaveLength(3);
    expect(rows.filter((row) => row.other !== null)).toHaveLength(2);
  });

  it('is empty for an unknown section or edition', async () => {
    const ro = translation({ sections: 3 }, 'vos-ro-3');
    const { repository } = await load([bundled, ro.signed]);
    expect(await repository.getAlignedParagraphs('no-such-section', ro.pack.edition.id)).toEqual([]);
    expect(await repository.getAlignedParagraphs(englishSections[0]!.id, 'no-such-edition')).toEqual(
      [],
    );
  });
});

describe('the bundled editions of Vos: R20, every work with two editions pairs by sourceId', () => {
  it('has the same section and paragraph count in both editions, 1:1, with no gap', async () => {
    const { repository } = await loadBundledRepository();
    const [work] = await repository.listWorks();
    const ro = work!.editions.find((edition) => edition.language === 'ro')!;
    const en = work!.editions.find((edition) => edition.language === 'en')!;
    const roSections = await repository.getSections(ro.editionId);
    expect(roSections).toHaveLength(ro.sectionCount);
    for (const section of roSections) {
      const aligned = await repository.getAlignedSection(section.id, en.editionId);
      expect(aligned).not.toBeNull();
      const rows = await repository.getAlignedParagraphs(section.id, en.editionId);
      // Complete: every row has both sides (the translation is 1:1 with the source).
      expect(rows.every((row) => row.paragraph !== null && row.other !== null)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((row) => row.sourceId)).size).toBe(rows.length);
    }
  });
});
