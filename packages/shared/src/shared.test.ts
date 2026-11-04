import { describe, expect, it } from 'vitest';

import {
  PackManifestSchema,
  PackSchema,
  canonicalJson,
  isUlid,
  manifestSigningPayload,
  stableId,
} from './index';

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
