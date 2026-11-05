import { describe, expect, it } from 'vitest';

import {
  PackManifestSchema,
  PackSchema,
  canonicalJson,
  isUlid,
  manifestSigningPayload,
} from './index';
import { stableId } from './ids';

const validPack = {
  work: {
    id: stableId(),
    slug: 'proba',
    titleRo: 'Lucrare de probă',
    titleOrig: 'Test work',
    author: { name: 'Autor', born: null, died: 1900, tradition: 'reformed' },
    languageOrig: 'en',
    year: 1900,
  },
  edition: {
    id: stableId(),
    language: 'en',
    kind: 'source' as const,
    licence: { status: 'public-domain' as const, note: '' },
    provenance: { source: 'test', extractedBy: 'test', notes: '' },
  },
  sections: [{ id: 'sec1', ordinal: 0, kind: 'chapter' as const, heading: 'I' }],
  paragraphs: [{ id: 'par1', sectionId: 'sec1', ordinal: 0, kind: 'p' as const, text: 'Text' }],
};

describe('canonicalJson', () => {
  it('sorts keys recursively and strips whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { y: 1, x: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"x":2,"y":1}]},"b":1}',
    );
  });

  it('is independent of key insertion order', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it('omits undefined properties and rejects non-finite numbers', () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(TypeError);
  });

  it('keeps non-ASCII characters unescaped', () => {
    expect(canonicalJson({ t: 'șțăâî' })).toBe('{"t":"șțăâî"}');
  });
});

describe('stableId', () => {
  it('returns unique, valid, sortable ULIDs', () => {
    const ids = Array.from({ length: 50 }, () => stableId());
    expect(new Set(ids).size).toBe(50);
    expect(ids.every(isUlid)).toBe(true);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe('PackSchema', () => {
  it('accepts a valid pack', () => {
    expect(PackSchema.safeParse(validPack).success).toBe(true);
  });

  it('rejects a paragraph that points to a missing section', () => {
    const bad = {
      ...validPack,
      paragraphs: [{ ...validPack.paragraphs[0], sectionId: 'missing' }],
    };
    expect(PackSchema.safeParse(bad).success).toBe(false);
  });
});

describe('PackSchema translations', () => {
  const sourceParagraphId = stableId();
  const sourceSectionId = stableId();
  const translation = {
    ...validPack,
    edition: {
      ...validPack.edition,
      id: stableId(),
      language: 'ro',
      kind: 'translation' as const,
      sourceEditionId: validPack.edition.id,
    },
    sections: [
      {
        id: 'sec1',
        ordinal: 0,
        kind: 'chapter' as const,
        heading: 'I',
        sourceId: sourceSectionId,
      },
    ],
    paragraphs: [
      {
        id: 'par1',
        sectionId: 'sec1',
        ordinal: 0,
        kind: 'p' as const,
        text: 'Text',
        sourceId: sourceParagraphId,
      },
      {
        id: 'par2',
        sectionId: 'sec1',
        ordinal: 1,
        kind: 'p' as const,
        text: 'Alt text',
        sourceId: stableId(),
      },
    ],
  };

  it('accepts an aligned translation that names its source edition', () => {
    expect(PackSchema.safeParse(translation).success).toBe(true);
  });

  it('rejects a translation without sourceEditionId', () => {
    const { sourceEditionId: _omitted, ...edition } = translation.edition;
    const result = PackSchema.safeParse({ ...translation, edition });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('sourceEditionId');
  });

  it('rejects two paragraphs that render the same source paragraph', () => {
    const duplicate = {
      ...translation,
      paragraphs: [
        translation.paragraphs[0],
        { ...translation.paragraphs[1], sourceId: sourceParagraphId },
      ],
    };
    const result = PackSchema.safeParse(duplicate);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('rendered twice');
  });

  it('parses a source pack without the new fields to identical canonical JSON', () => {
    const parsed = PackSchema.parse(validPack);
    expect(canonicalJson(parsed)).toBe(canonicalJson(validPack));
    expect(parsed.edition.sourceEditionId).toBeUndefined();
    expect(parsed.sections[0]?.sourceId).toBeUndefined();
    expect(parsed.paragraphs[0]?.sourceId).toBeUndefined();
  });
});

describe('WorkSchema titleEn', () => {
  it('is optional: a work without it parses to the same canonical JSON (packs stay unchanged)', () => {
    const parsed = PackSchema.parse(validPack);
    expect(parsed.work.titleEn).toBeUndefined();
    expect('titleEn' in parsed.work).toBe(false);
    expect(canonicalJson(parsed.work)).toBe(canonicalJson(validPack.work));
  });

  it('keeps an English title when the work has one', () => {
    const withTitle = {
      ...validPack,
      work: { ...validPack.work, languageOrig: 'la', titleEn: 'On the Spirit and the Letter' },
    };
    const parsed = PackSchema.parse(withTitle);
    expect(parsed.work.titleEn).toBe('On the Spirit and the Letter');
    expect(canonicalJson(parsed.work)).toContain('"titleEn":"On the Spirit and the Letter"');
  });

  it('rejects an empty English title', () => {
    const bad = { ...validPack, work: { ...validPack.work, titleEn: '' } };
    const result = PackSchema.safeParse(bad);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('titleEn');
  });
});

describe('LicenceSchema notes by interface language', () => {
  it('leaves noteRo and noteEn out when a licence does not have them', () => {
    const parsed = PackSchema.parse(validPack);
    expect('noteRo' in parsed.edition.licence).toBe(false);
    expect('noteEn' in parsed.edition.licence).toBe(false);
    expect(canonicalJson(parsed.edition.licence)).toBe(canonicalJson(validPack.edition.licence));
  });

  it('keeps both translations of the note next to the note itself', () => {
    const licence = {
      status: 'public-domain' as const,
      note: 'Original text first published in 1903.',
      noteRo: 'Textul original a apărut în 1903.',
      noteEn: 'Original text first published in 1903.',
    };
    const parsed = PackSchema.parse({ ...validPack, edition: { ...validPack.edition, licence } });
    expect(parsed.edition.licence).toEqual(licence);
  });
});

describe('PackManifestSchema', () => {
  const manifest = {
    packId: 'pack1',
    kind: 'edition' as const,
    workId: 'w1',
    editionId: 'e1',
    revision: 1,
    version: '1.0.0',
    createdAt: '2026-11-04T00:00:00.000Z',
    sha256: 'a'.repeat(64),
    size: 123,
    minAppVersion: '0.1.0',
    signingKeyId: 'dev-1',
    signature: 'AAAA',
  };

  it('accepts a valid manifest and rejects a bad hash', () => {
    expect(PackManifestSchema.safeParse(manifest).success).toBe(true);
    expect(PackManifestSchema.safeParse({ ...manifest, sha256: 'xyz' }).success).toBe(false);
  });

  it('rejects unknown fields (they would be neither signed nor validated)', () => {
    expect(PackManifestSchema.safeParse({ ...manifest, extra: 'x' }).success).toBe(false);
  });

  it('builds the signing payload without the signature field', () => {
    const payload = new TextDecoder().decode(manifestSigningPayload(manifest));
    expect(payload).not.toContain('signature');
    expect(payload.startsWith('{"createdAt":')).toBe(true);
  });
});

describe('compareSemver', () => {
  it('orders by major, minor and patch', async () => {
    const { compareSemver } = await import('./index');
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareSemver('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareSemver('0.1.0-beta.1', '0.1.0')).toBe(0);
  });

  it('rejects malformed versions', async () => {
    const { compareSemver, parseSemver } = await import('./index');
    expect(parseSemver('1.2')).toBeNull();
    expect(() => compareSemver('x', '1.0.0')).toThrow(TypeError);
  });
});

describe('startup safety', () => {
  it('loads the package index without crypto.getRandomValues and does not export stableId', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      const { vi } = await import('vitest');
      vi.resetModules();
      const shared = await import('./index');
      expect('stableId' in shared).toBe(false);
      expect(shared.isUlid('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe(true);
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
    }
  });
});

describe('ProvenanceSchema (additive fields)', () => {
  const withProvenance = (provenance: unknown) => ({
    ...validPack,
    edition: { ...validPack.edition, provenance },
  });
  const base = { source: 'test', extractedBy: 'test', notes: '' };

  it('still accepts the original three-field record: a pack built before the new fields is valid', () => {
    expect(PackSchema.safeParse(withProvenance(base)).success).toBe(true);
    // ... and parsing it adds nothing, so its canonical form is unchanged.
    const parsed = PackSchema.parse(withProvenance(base));
    expect(parsed.edition.provenance).toEqual(base);
  });

  it('accepts and keeps the new fields', () => {
    const full = {
      ...base,
      kind: 'ai',
      transcription: false,
      sourceLanguage: 'en',
      model: 'claude-sonnet-5-5',
      generatedAt: '2026-11-04',
      passes: ['draft', 'critic', 'revision'],
      checks: [
        { code: 'parity', status: 'passed' },
        { code: 'glossary', status: 'flagged', flags: 4 },
      ],
      sourceDescription: 'A scan, transcribed and cleaned.',
      review: { state: 'reviewed', at: '2026-12-01T10:00:00Z', roleNote: 'theologian' },
      corrections: [{ at: '2026-12-02', summary: 'A term was changed.' }],
    };
    const parsed = PackSchema.parse(withProvenance(full));
    expect(parsed.edition.provenance).toEqual(full);
  });

  it.each([
    ['an unknown kind', { ...base, kind: 'divine' }],
    ['a review state that does not exist', { ...base, review: { state: 'approved' } }],
    ['a check that is neither passed nor flagged', { ...base, checks: [{ code: 'x', status: 'ok' }] }],
    ['a negative flag count', { ...base, checks: [{ code: 'x', status: 'flagged', flags: -1 }] }],
    ['a date that is not ISO', { ...base, generatedAt: '4 November 2026' }],
    ['a correction without a summary', { ...base, corrections: [{ at: '2026-12-02', summary: '' }] }],
  ])('rejects %s', (_name, provenance) => {
    expect(PackSchema.safeParse(withProvenance(provenance)).success).toBe(false);
  });
});
