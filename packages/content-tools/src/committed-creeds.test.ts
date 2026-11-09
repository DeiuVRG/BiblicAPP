import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PackSchema, isUlid } from '@biblioteca/shared';
import type { Pack } from '@biblioteca/shared';
import { describe, expect, it } from 'vitest';

import {
  JobIndexSchema,
  TranslationEditionMetaSchema,
  TranslationJobSchema,
} from './translation/schemas';
import { loadWorkMeta } from './work-file';

// The two documents of the creeds shelf that are committed (P1-C4): the Apostles' Creed in Latin
// and the Creed of Constantinople in Greek. Each is a source edition of twelve articles, one section
// and one paragraph per article, made by content/sources/<slug>/build-edition.ts from a verbatim
// excerpt of a public domain book. The test does not pin the text: it checks that the files agree
// with each other (ids, metadata, jobs, the checksums recorded in SOURCE.md) and that the defects
// the build exists to remove have not come back.

const root = fileURLToPath(new URL('../../../', import.meta.url));

const CREEDS = [
  { slug: 'symbolum-apostolorum', file: 'edition-la.json', language: 'la' },
  { slug: 'symbolum-nicaeno-constantinopolitanum', file: 'edition-grc.json', language: 'grc' },
] as const;

const read = (file: string): string => fs.readFileSync(file, 'utf8');
const readJson = (file: string): unknown => JSON.parse(read(file)) as unknown;
const sha256 = (file: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe.each(CREEDS)('committed creed $slug', ({ slug, file, language }) => {
  const worksDir = path.join(root, 'content/works', slug);
  const sourcesDir = path.join(root, 'content/sources', slug);
  const pack: Pack = PackSchema.parse(readJson(path.join(worksDir, file)));
  const text = pack.paragraphs.map((paragraph) => paragraph.text).join(' ');

  it('is a source edition in the public domain, in the language of its file', () => {
    expect(pack.edition.kind).toBe('source');
    expect(pack.edition.language).toBe(language);
    expect(pack.work.languageOrig).toBe(language);
    expect(pack.work.slug).toBe(slug);
    expect(pack.edition.licence.status).toBe('public-domain');
    expect(pack.edition.provenance.kind).toBe('source');
    // A work without an individual author carries its issuing body in the author record for now.
    expect(pack.work.author).toMatchObject({ born: null, died: null, tradition: 'undivided' });
    expect(pack.work.titleEn).toBeTruthy();
    expect(pack.work.titleRo).toBeTruthy();
  });

  it('has twelve sections, numbered 1 to 12, with one paragraph each', () => {
    expect(pack.sections.map((section) => section.heading)).toEqual(
      Array.from({ length: 12 }, (_, index) => String(index + 1)),
    );
    pack.sections.forEach((section, index) => {
      expect(section.ordinal).toBe(index);
      expect(section.kind).toBe('section');
      const own = pack.paragraphs.filter((paragraph) => paragraph.sectionId === section.id);
      expect(own).toHaveLength(1);
      expect(own[0]).toMatchObject({ ordinal: 0, kind: 'p' });
    });
  });

  it('has ULID ids, all different, and the ids of work.json', () => {
    const meta = loadWorkMeta(path.join(worksDir, 'work.json'));
    expect(meta.work.id).toBe(pack.work.id);
    expect(meta.edition.id).toBe(pack.edition.id);
    const ids = [
      pack.work.id,
      pack.edition.id,
      ...pack.sections.map((section) => section.id),
      ...pack.paragraphs.map((paragraph) => paragraph.id),
    ];
    expect(ids.every((id) => isUlid(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is NFC, clean text: no markup, no brackets, no double spaces, no line breaks', () => {
    for (const paragraph of pack.paragraphs) {
      expect(paragraph.text).toBe(paragraph.text.normalize('NFC'));
      expect(paragraph.text).toBe(paragraph.text.trim());
      expect(paragraph.text).not.toMatch(/[<>[\]()\n\r\t]| {2}/);
    }
    expect(read(path.join(worksDir, file))).toBe(read(path.join(worksDir, file)).normalize('NFC'));
  });

  it('has the text of its creed', () => {
    if (language === 'la') {
      expect(text).toMatch(/^Credo in Deum Patrem omnipotentem/);
      expect(text).toMatch(/inde venturus est \p{L}+ vivos et mortuos\./u);
      expect(text).toMatch(/vitam \p{L}+\. Amen\.$/u);
      expect(text).not.toMatch(/\(est\)/);
    } else {
      // The conciliar plural, and no Filioque: the Spirit proceeds from the Father only.
      expect(text).toMatch(/^Πιστεύομεν εἰς ἕνα /);
      expect(text).toMatch(/τὸ ἐκ τοῦ πατρὸς ἐκπορευόμενον, τὸ σὺν πατρὶ/);
      expect(text).not.toMatch(/τοῦ υἱοῦ ἐκπορευ|καὶ υἱοῦ ἐκπορευ|ἐκπορευόμενον,? καὶ τοῦ/);
      expect(text).toMatch(/Ἀμήν\.$/);
      // The small capitals of the print and the misprints of the digital copy are gone.
      expect(text).not.toMatch(/\p{Lu}{2,}/u);
      for (const wrong of ['ἕν ', 'ἀληθενοῦ', 'βάρτισμα', 'ὑιῷ', 'συν προσκυνούμενον', 'δἰ ']) {
        expect(text, wrong).not.toContain(wrong);
      }
      // The apostrophe of the elision is U+2019, as in the fixtures; nothing else is mixed in.
      expect(text).toContain('δι’ οὗ');
      expect(text).not.toMatch(/[᾽ʼ']/);
    }
  });

  describe.each(['en', 'ro'] as const)('translation into %s', (lang) => {
    const translationDir = path.join(worksDir, `translation-${lang}`);

    it('has metadata that names this source edition', () => {
      const meta = TranslationEditionMetaSchema.parse(
        readJson(path.join(translationDir, 'edition.json')),
      );
      expect(meta.edition.language).toBe(lang);
      expect(meta.edition.sourceEditionId).toBe(pack.edition.id);
      expect(meta.edition.provenance.sourceLanguage).toBe(language);
      expect(meta.workTitle).toBeTruthy();
    });

    it('has jobs made from this edition, covering every paragraph unchanged, with the materials', () => {
      const jobsDir = path.join(translationDir, 'jobs');
      const index = JobIndexSchema.parse(readJson(path.join(jobsDir, 'index.json')));
      expect(index.sourceEditionId).toBe(pack.edition.id);
      expect(index.targetLanguage).toBe(lang);
      // Made from this very file: an edition that was rebuilt needs its jobs made again.
      expect(index.sourceSha256).toBe(sha256(path.join(worksDir, file)));
      const covered = new Map<string, string>();
      for (const entry of index.jobs) {
        const job = TranslationJobSchema.parse(readJson(path.join(jobsDir, entry.file)));
        expect(job.sourceEditionId).toBe(pack.edition.id);
        expect(job.sourceLanguage).toBe(language);
        expect(job.materials.glossary).toBe(`content/translation/glossary-${lang}.csv`);
        expect(job.materials.profile).toBe(`content/translation/profiles/${slug}.md`);
        for (const paragraph of job.paragraphs) covered.set(paragraph.id, paragraph.text);
      }
      expect([...covered.keys()].sort()).toEqual(pack.paragraphs.map((p) => p.id).sort());
      for (const paragraph of pack.paragraphs)
        expect(covered.get(paragraph.id)).toBe(paragraph.text);
    });
  });

  it('records the date, the licence and the checksum of every file kept next to it', () => {
    const record = read(path.join(sourcesDir, 'SOURCE.md'));
    expect(record).toContain('2026-11-05');
    expect(record).toMatch(/\| Licence \|/);
    expect(record).toMatch(/public domain/i);
    expect(fs.existsSync(path.join(sourcesDir, 'build-edition.ts'))).toBe(true);
    const kept = fs
      .readdirSync(sourcesDir)
      .filter((name) => /\.(xml|txt|json)$/.test(name))
      .sort();
    expect(kept.length).toBeGreaterThanOrEqual(2);
    for (const name of kept) expect(record, name).toContain(sha256(path.join(sourcesDir, name)));
  });
});
