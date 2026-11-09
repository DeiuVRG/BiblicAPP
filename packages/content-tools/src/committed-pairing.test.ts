import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PackSchema } from '@biblioteca/shared';
import type { Pack } from '@biblioteca/shared';
import { describe, expect, it } from 'vitest';

// Check R20 of docs/ui-spec-v2.md (20.4): the installed works pair by `sourceId`. Every work is read
// in Romanian and in English (CLAUDE.md, rule of the product), so each one has an edition in each
// language (the source itself, or a translation aligned to it) or is named below as partial, and
// every translation is aligned 1:1 to its source: a source paragraph is rendered at most once, a
// translated section holds all the paragraphs of the section it renders, and nothing points
// outside the source edition. The reader and the repository (`getAlignedParagraphs`) rely on it.

const root = fileURLToPath(new URL('../../../', import.meta.url));
const packsDir = path.join(root, 'apps/mobile/assets/packs');

/**
 * Works installed with one of the two reading languages still missing, by work slug, with the
 * reason: the only way a work may be without one of the two editions. Empty: every installed work
 * has both.
 */
const PARTIAL_WORKS: Readonly<Record<string, string>> = {};

const baseLanguage = (code: string) => (code.split(/[-_]/)[0] ?? '').toLowerCase();

function installedPacks(): Pack[] {
  return fs
    .readdirSync(packsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      PackSchema.parse(
        JSON.parse(
          fs.readFileSync(path.join(packsDir, entry.name, 'pack.json'), 'utf8'),
        ) as unknown,
      ),
    );
}

const byWork = new Map<string, Pack[]>();
for (const pack of installedPacks()) {
  byWork.set(pack.work.id, [...(byWork.get(pack.work.id) ?? []), pack]);
}

describe('committed packs: every work pairs by sourceId (R20)', () => {
  it('installs at least one work', () => {
    expect(byWork.size).toBeGreaterThan(0);
  });

  for (const [workId, packs] of byWork) {
    const slug = packs[0]!.work.slug;

    describe(slug, () => {
      it('has an edition in Romanian and one in English, or is named as partial', () => {
        const languages = new Set(packs.map((pack) => baseLanguage(pack.edition.language)));
        const missing = ['ro', 'en'].filter((language) => !languages.has(language));
        if (missing.length === 0) return;
        expect(
          PARTIAL_WORKS[slug],
          `${slug} (${workId}) has no edition in ${missing.join(', ')}: add the translation or list the work in PARTIAL_WORKS with a reason`,
        ).toBeTruthy();
      });

      it('has one source edition at most, and every translation names it', () => {
        const sources = packs.filter((pack) => pack.edition.kind === 'source');
        expect(sources.length).toBeLessThanOrEqual(1);
        const source = sources[0];
        for (const pack of packs.filter((candidate) => candidate.edition.kind === 'translation')) {
          // A work with no source installed has nothing to align to; the check is about the others.
          if (source) expect(pack.edition.sourceEditionId).toBe(source.edition.id);
        }
      });

      for (const pack of packs.filter((candidate) => candidate.edition.kind === 'translation')) {
        const source = packs.find(
          (candidate) => candidate.edition.id === pack.edition.sourceEditionId,
        );
        if (!source) continue;

        it(`aligns ${pack.edition.language} 1:1 to the source: no source unit rendered twice, none outside it`, () => {
          const sourceSections = new Map(source.sections.map((section) => [section.id, section]));
          const sourceParagraphs = new Map(source.paragraphs.map((p) => [p.id, p]));

          const sectionKeys = pack.sections.map((section) => section.sourceId);
          expect(sectionKeys.every((key) => key !== undefined && sourceSections.has(key))).toBe(
            true,
          );
          expect(new Set(sectionKeys).size).toBe(sectionKeys.length);

          const paragraphKeys = pack.paragraphs.map((paragraph) => paragraph.sourceId);
          expect(paragraphKeys.every((key) => key !== undefined && sourceParagraphs.has(key))).toBe(
            true,
          );
          expect(new Set(paragraphKeys).size).toBe(paragraphKeys.length);
        });

        it(`translates every paragraph of each ${pack.edition.language} section it has, in its own section`, () => {
          const sectionOf = new Map(pack.sections.map((section) => [section.id, section]));
          const translatedByKey = new Map(
            pack.paragraphs.map((paragraph) => [paragraph.sourceId, paragraph]),
          );
          for (const section of pack.sections) {
            const rendered = source.paragraphs.filter((p) => p.sectionId === section.sourceId);
            // Nothing is missing inside a section that is translated at all (a gap is a section).
            expect(
              rendered.filter((p) => !translatedByKey.has(p.id)).map((p) => p.id),
              `section ${section.id} of ${pack.edition.language} misses paragraphs`,
            ).toEqual([]);
          }
          for (const paragraph of pack.paragraphs) {
            const home = sectionOf.get(paragraph.sectionId);
            const sourceParagraph = source.paragraphs.find((p) => p.id === paragraph.sourceId);
            // A translated paragraph sits in the section that renders its source paragraph's section.
            expect(home?.sourceId).toBe(sourceParagraph?.sectionId);
          }
        });

        it(`is partial exactly when it has fewer sections than the source (${pack.edition.language})`, () => {
          // The state the library flags ("Traducere parțială"); it is derived, never stored.
          const partial = pack.sections.length < source.sections.length;
          expect(pack.sections.length <= source.sections.length).toBe(true);
          if (!partial) expect(pack.sections).toHaveLength(source.sections.length);
        });
      }
    });
  }
});
