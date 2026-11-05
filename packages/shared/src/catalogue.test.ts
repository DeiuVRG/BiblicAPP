import { describe, expect, it } from 'vitest';

import {
  CatalogueManifestSchema,
  CatalogueSchema,
  WORK_KINDS,
  canonicalJson,
  catalogueSigningPayload,
} from './index';
import type { Catalogue } from './index';

const shelf = (slug: string, order: number) => ({
  slug,
  order,
  labelRo: `Raft ${slug}`,
  labelEn: `Shelf ${slug}`,
  descRo: 'Descriere.',
  descEn: 'Description.',
});

const author = (slug: string) => ({
  slug,
  nameRo: 'Geerhardus Vos',
  nameEn: 'Geerhardus Vos',
  nameOrig: 'Geerhardus Vos',
  sortName: 'Vos, Geerhardus',
  born: 1862,
  died: 1949,
  tradition: 'reformed',
  bioRo: 'Teolog.',
  bioEn: 'Theologian.',
  bioKind: 'editorial' as const,
});

const work = (workId: string, slug: string, extra: Record<string, unknown> = {}) => ({
  workId,
  slug,
  authorSlug: 'geerhardus-vos',
  shelves: ['modern'],
  kind: 'treatise' as const,
  blurbRo: 'Rezumat.',
  blurbEn: 'Blurb.',
  blurbKind: 'editorial' as const,
  start: [],
  ...extra,
});

const pack = (packId: string, editionId: string) => ({
  packId,
  editionId,
  sha256: 'a'.repeat(64),
  size: 1234,
});

const body = {
  slug: 'council-of-nicaea-i',
  labelRo: 'Conciliul din Niceea I',
  labelEn: 'Council of Nicaea I',
  year: 325,
};

function valid(): Catalogue {
  return {
    shelves: [shelf('modern', 1), shelf('creeds', 2)],
    authors: [author('geerhardus-vos')],
    works: [
      work('w1', 'vos-kingdom'),
      work('w2', 'nicene-creed', {
        authorSlug: undefined,
        issuingBody: body,
        shelves: ['creeds'],
        kind: 'creed',
      }),
    ],
    startHere: ['vos-kingdom'],
    packs: [pack('vos-en', 'e1'), pack('vos-ro', 'e2')],
  };
}

const problems = (value: unknown): string => {
  const result = CatalogueSchema.safeParse(value);
  return result.success ? '' : JSON.stringify(result.error.issues.map((issue) => issue.message));
};

describe('CatalogueSchema', () => {
  it('accepts a coherent catalogue: shelves, an author, a work with an author, one with an issuing body, packs', () => {
    expect(CatalogueSchema.safeParse(valid()).success).toBe(true);
  });

  it('accepts the work kinds of the spec (6.8) and no others', () => {
    expect([...WORK_KINDS]).toEqual([
      'treatise',
      'sermons',
      'commentary',
      'letters',
      'catechism',
      'creed',
      'confession',
      'council',
      'church-order',
      'devotional',
      'history',
      'polemic',
      'dialogue',
      'liturgy',
    ]);
    const catalogue = valid();
    catalogue.works[0] = work('w1', 'vos-kingdom', { kind: 'poem' }) as never;
    expect(CatalogueSchema.safeParse(catalogue).success).toBe(false);
  });

  it('parses to the same canonical JSON, so what is signed is what is read', () => {
    const catalogue = valid();
    expect(canonicalJson(CatalogueSchema.parse(catalogue))).toBe(canonicalJson(catalogue));
  });

  it('refuses a work that has neither an author nor an issuing body', () => {
    const catalogue = valid();
    catalogue.works[1] = work('w2', 'nicene-creed', { authorSlug: undefined }) as never;
    expect(problems(catalogue)).toContain('never neither');
  });

  it('refuses duplicate slugs and ids', () => {
    const duplicateShelf = valid();
    duplicateShelf.shelves.push(shelf('modern', 3));
    expect(problems(duplicateShelf)).toContain('duplicate shelf slug modern');

    const duplicateWork = valid();
    duplicateWork.works.push(work('w1', 'another-slug'));
    expect(problems(duplicateWork)).toContain('duplicate work id w1');

    const duplicateSlug = valid();
    duplicateSlug.works.push(work('w3', 'vos-kingdom'));
    expect(problems(duplicateSlug)).toContain('duplicate work slug vos-kingdom');

    const duplicatePack = valid();
    duplicatePack.packs.push(pack('vos-en', 'e3'));
    expect(problems(duplicatePack)).toContain('duplicate pack id vos-en');

    const duplicateEdition = valid();
    duplicateEdition.packs.push(pack('vos-fr', 'e1'));
    expect(problems(duplicateEdition)).toContain('duplicate edition id e1');
  });

  it('refuses references that do not resolve', () => {
    const shelfless = valid();
    shelfless.works[0] = work('w1', 'vos-kingdom', { shelves: ['nowhere'] }) as never;
    expect(problems(shelfless)).toContain('unknown shelf nowhere');

    const authorless = valid();
    authorless.works[0] = work('w1', 'vos-kingdom', { authorSlug: 'nobody' }) as never;
    expect(problems(authorless)).toContain('unknown author nobody');

    const startless = valid();
    startless.startHere = ['missing-work'];
    expect(problems(startless)).toContain('unknown work missing-work');

    const parentless = valid();
    parentless.traditions = [
      {
        slug: 'reformed',
        parent: 'protestant',
        labelRo: 'R',
        labelEn: 'R',
        descRo: '',
        descEn: '',
      },
    ];
    expect(problems(parentless)).toContain('unknown parent tradition protestant');
  });

  it('keeps authors and issuing bodies in one address space, and one description per body', () => {
    const clash = valid();
    clash.works[1] = work('w2', 'nicene-creed', {
      authorSlug: undefined,
      issuingBody: { ...body, slug: 'geerhardus-vos' },
      kind: 'creed',
    }) as never;
    expect(problems(clash)).toContain('geerhardus-vos is also an author slug');

    const twoLabels = valid();
    twoLabels.works.push(
      work('w3', 'apostles-creed', {
        authorSlug: undefined,
        issuingBody: { ...body, labelEn: 'Council of Nicaea' },
        kind: 'creed',
      }) as never,
    );
    expect(problems(twoLabels)).toContain('described differently');

    const sameBody = valid();
    sameBody.works.push(
      work('w3', 'canons-of-nicaea', {
        authorSlug: undefined,
        issuingBody: body,
        kind: 'council',
      }) as never,
    );
    expect(CatalogueSchema.safeParse(sameBody).success).toBe(true);
  });

  it('checks the pack records: lowercase hex sha256 and a positive size', () => {
    const badHash = valid();
    badHash.packs[0] = { ...pack('vos-en', 'e1'), sha256: 'XYZ' };
    expect(CatalogueSchema.safeParse(badHash).success).toBe(false);
    const empty = valid();
    empty.packs[0] = { ...pack('vos-en', 'e1'), size: 0 };
    expect(CatalogueSchema.safeParse(empty).success).toBe(false);
  });

  it('keeps the optional traditions and the editorial list out of the way when they are absent', () => {
    const { startHere: _startHere, ...bare } = valid();
    const parsed = CatalogueSchema.parse(bare);
    expect('traditions' in parsed).toBe(false);
    expect('startHere' in parsed).toBe(false);
  });
});

describe('CatalogueManifestSchema', () => {
  const manifest = {
    kind: 'catalogue' as const,
    revision: 1,
    version: '1.0.0',
    createdAt: '2026-11-05T00:00:00.000Z',
    sha256: 'b'.repeat(64),
    size: 321,
    minAppVersion: '0.1.0',
    signingKeyId: 'dev-2026-11',
    signature: 'AAAA',
  };

  it('accepts a signed record and rejects a bad hash or another kind', () => {
    expect(CatalogueManifestSchema.safeParse(manifest).success).toBe(true);
    expect(CatalogueManifestSchema.safeParse({ ...manifest, sha256: 'xyz' }).success).toBe(false);
    expect(CatalogueManifestSchema.safeParse({ ...manifest, kind: 'edition' }).success).toBe(false);
  });

  it('rejects unknown fields: they would be neither signed nor validated', () => {
    expect(CatalogueManifestSchema.safeParse({ ...manifest, extra: 1 }).success).toBe(false);
  });

  it('signs the canonical JSON of the manifest without its signature', () => {
    const payload = new TextDecoder().decode(catalogueSigningPayload(manifest));
    expect(payload).not.toContain('signature');
    expect(payload.startsWith('{"createdAt":')).toBe(true);
    expect(payload).toContain('"kind":"catalogue"');
  });
});
