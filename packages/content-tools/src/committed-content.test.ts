import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PackSchema, canonicalJson, isUlid } from '@biblioteca/shared';
import { describe, expect, it } from 'vitest';

import { readTrustedKey } from './keys';
import { verifyPackBytes } from './signing';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const editionFile = path.join(root, 'content/works/vos-1903-kingdom/edition-en.json');
const packDir = path.join(root, 'apps/mobile/assets/packs/vos-1903-kingdom-en');

describe('committed sample content (Vos 1903)', () => {
  const edition = PackSchema.parse(JSON.parse(fs.readFileSync(editionFile, 'utf8')) as unknown);

  it('the built pack is the canonical form of the canonical edition file', () => {
    const packText = fs.readFileSync(path.join(packDir, 'pack.json'), 'utf8');
    expect(packText).toBe(canonicalJson(edition));
  });

  it('the built pack verifies against the committed dev public key', () => {
    const result = verifyPackBytes({
      packBytes: new Uint8Array(fs.readFileSync(path.join(packDir, 'pack.json'))),
      manifest: JSON.parse(fs.readFileSync(path.join(packDir, 'manifest.json'), 'utf8')) as unknown,
      trustedKeys: [readTrustedKey(path.join(root, 'content/keys/dev.pub'))],
    });
    expect(result.ok).toBe(true);
  });

  it('has 11 chapters, ULID ids everywhere and the metadata of the source', () => {
    expect(edition.sections).toHaveLength(11);
    expect(edition.sections.every((s) => s.kind === 'chapter' && isUlid(s.id))).toBe(true);
    expect(edition.paragraphs.every((p) => isUlid(p.id))).toBe(true);
    expect(edition.work).toMatchObject({
      slug: 'vos-1903-kingdom',
      languageOrig: 'en',
      year: 1903,
      author: { name: 'Geerhardus Vos', born: 1862, died: 1949, tradition: 'protestant' },
    });
    expect(edition.edition).toMatchObject({
      language: 'en',
      kind: 'source',
      licence: { status: 'public-domain' },
    });
  });

  it('reads as clean prose: no running heads, page numbers or OCR debris in the text', () => {
    const text = edition.paragraphs.map((p) => p.text).join('\n');
    // Running heads (title + page number) in any of their OCR spellings.
    expect(text).not.toMatch(
      /\b(?:The )?(?:Kingdom and (?:the|tlte|tile) Church|Sphere of Saving Power|Teaching of Jesus|(?:Tile|Tlte) Splzere of Saving Power)\s+\d{1,3}\b/i,
    );
    expect(text).not.toMatch(/\b\d{1,3}\s+(?:The|Tile|Tlte)\s+(?:Kingdom|Sphere|Teaching)\b/);
    expect(text).not.toMatch(/[~€<>{}|\\]/); // scan debris
    expect(text).not.toMatch(/\bd\. (Mk|Matt|Lk)\b/); // "cf." read as "d."
    expect(text).not.toMatch(/\p{Ll}-\s/u); // unresolved hyphenation
    expect(text).not.toMatch(/ {2}/);
    for (const paragraph of edition.paragraphs) {
      expect(paragraph.text).toMatch(/^[A-Z“]/);
      expect(paragraph.text.length).toBeGreaterThan(60);
    }
  });

  it('no private key would be committed: only .pub files in content/keys are not ignored', () => {
    let tracked: string[];
    try {
      tracked = execFileSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        {
          cwd: root,
          encoding: 'utf8',
        },
      )
        .split('\0')
        .filter(Boolean);
    } catch {
      return; // not a git checkout (for example an exported tarball): nothing to inspect
    }
    const keyFiles = tracked.filter((f) => f.startsWith('content/keys/'));
    expect(keyFiles.length).toBeGreaterThanOrEqual(2);
    expect(keyFiles.every((f) => f.endsWith('.pub'))).toBe(true);
    expect(tracked.filter((f) => /\.(key|pem|jks|keystore|p12|p8)$/.test(f))).toEqual([]);
  });
});
