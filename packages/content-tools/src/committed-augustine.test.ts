import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PackSchema, isUlid } from '@biblioteca/shared';
import { describe, expect, it } from 'vitest';

import { DEFAULT_CHUNK, buildJobs } from './translation/jobs';
import { TranslationEditionMetaSchema } from './translation/schemas';

// The Latin source edition of Augustine, De spiritu et littera (P1-C3, ingest part): the text of
// the 1914 Clarendon Press edition without the editor's matter, cleaned by
// content/sources/augustine-de-spiritu-et-littera/clean.py and ingest-text. Like the Vos test, this
// guards the committed file: what must never come back is the apparatus of the 1914 edition and the
// OCR debris that were removed on purpose.

const root = fileURLToPath(new URL('../../../', import.meta.url));
const workDir = path.join(root, 'content/works/augustine-de-spiritu-et-littera');

function readJson(...parts: string[]): unknown {
  return JSON.parse(fs.readFileSync(path.join(workDir, ...parts), 'utf8')) as unknown;
}

function roman(value: number): string {
  let rest = value;
  let out = '';
  for (const [letters, n] of [
    ['L', 50],
    ['XL', 40],
    ['X', 10],
    ['IX', 9],
    ['V', 5],
    ['IV', 4],
    ['I', 1],
  ] as const) {
    while (rest >= n) {
      out += letters;
      rest -= n;
    }
  }
  return out;
}

const edition = PackSchema.parse(readJson('edition-la.json'));
const sections = [...edition.sections].sort((a, b) => a.ordinal - b.ordinal);
const paragraphsOf = (sectionId: string) =>
  edition.paragraphs.filter((p) => p.sectionId === sectionId).sort((a, b) => a.ordinal - b.ordinal);

describe('committed source edition: Augustine, De spiritu et littera (Latin)', () => {
  it('is the Latin source edition of the work, with ULID ids and the metadata of the work', () => {
    expect(edition.work).toMatchObject({
      slug: 'augustine-de-spiritu-et-littera',
      titleOrig: 'De spiritu et littera',
      titleEn: 'On the Spirit and the Letter',
      languageOrig: 'la',
      year: 412,
      author: { name: 'Augustine of Hippo', born: 354, died: 430, tradition: 'undivided' },
    });
    expect(edition.edition).toMatchObject({
      language: 'la',
      kind: 'source',
      licence: { status: 'public-domain' },
      provenance: { kind: 'source', transcription: true },
    });
    expect(edition.edition.licence.note).toMatch(/Latin/);
    expect(isUlid(edition.work.id) && isUlid(edition.edition.id)).toBe(true);
    expect(sections.every((s) => s.kind === 'chapter' && isUlid(s.id))).toBe(true);
    expect(edition.paragraphs.every((p) => p.kind === 'p' && isUlid(p.id))).toBe(true);
  });

  it('has 36 chapters headed by their numeral and one paragraph per numbered section', () => {
    expect(sections.map((s) => s.heading)).toEqual(
      Array.from({ length: 36 }, (_, i) => roman(i + 1)),
    );
    // 66 numbered sections; chapter XXVIII begins inside section 48, which is therefore two
    // paragraphs (the last of XXVII, which ends with a colon, and the first of XXVIII).
    expect(edition.paragraphs).toHaveLength(67);
    const xxvii = paragraphsOf((sections[26] as (typeof sections)[number]).id);
    const xxviii = paragraphsOf((sections[27] as (typeof sections)[number]).id);
    expect((xxvii[xxvii.length - 1] as (typeof xxvii)[number]).text).toMatch(/mereantur:$/);
    expect((xxviii[0] as (typeof xxviii)[number]).text).toMatch(/^Verumtamen quia non usque adeo/);
    expect(sections.every((s) => paragraphsOf(s.id).length > 0)).toBe(true);
    const words = edition.paragraphs.reduce((sum, p) => sum + p.text.split(/\s+/).length, 0);
    expect(words).toBeGreaterThan(17000);
    expect(words).toBeLessThan(18200);
    expect((edition.paragraphs[0] as (typeof edition.paragraphs)[number]).text).toMatch(
      /^Lectis opusculis, quae ad te nuper elaboravi, fili charissime Marcelline/,
    );
    expect((edition.paragraphs[66] as (typeof edition.paragraphs)[number]).text).toMatch(
      /in saecula saeculorum\. Amen\.$/,
    );
  });

  it('reads as clean Latin prose: no apparatus, running heads or OCR debris', () => {
    for (const paragraph of edition.paragraphs) {
      const text = paragraph.text;
      expect(text, paragraph.id).toBe(text.normalize('NFC'));
      expect(text).not.toMatch(/\d/); // section numbers, page numbers, reference numbers
      expect(text).not.toMatch(/[[\]'"¹²³]/); // brackets, straight quotes, footnote marks
      expect(text).not.toMatch(/\b(?:the|of|and|See|Cp|Cf|insert)\b/); // the editor's English
      expect(text).not.toMatch(/\b(?:Rom|Matt|Cor|Ps|Gal|Eph|Phil|Heb|Acts|Exod|Deut|Isa|Jer)\.\s/);
      expect(text).not.toMatch(/DE SPIRITU ET LITTERA|CHAP\.|CHAPTER/i);
      expect(text).not.toMatch(/\p{Ll}-\s|\p{Ll}-\p{Ll}/u); // unresolved hyphenation
      expect(text).not.toMatch(/ {2}|\s[;:?!,.]/); // spacing
      expect(text).not.toMatch(/\.\s+\p{Ll}/u); // a full stop followed by a lower-case word
      expect(text).not.toMatch(/\sV\.?$/); // a footnote reading of the Vienna CSEL
      expect(text).toMatch(/^[‘\p{Lu}]/u);
      expect(text).toMatch(/[.?!:;’)]$/);
      expect(text.length).toBeGreaterThan(300);
      expect(text.split('(').length, paragraph.id).toBe(text.split(')').length);
      expect(text.split('‘').length, paragraph.id).toBe(text.split('’').length);
    }
  });

  it('keeps the repairs of the OCR and does not bring back the damage', () => {
    const text = edition.paragraphs.map((p) => p.text).join('\n');
    for (const repaired of [
      'justificabitur',
      'per fidem Jesu Christi, hoc est, per fidem qua',
      'sufficientia nostra ex Deo est',
      'praecipitur quemadmodum vivere debeat',
      'computantur a celebratione Paschae',
      'De hac vita dicit ipse Dominus',
      'in quem non crediderunt',
      'quarumdam escarum caerimoniae',
      'θεοσέβειαν',
      'Θεοσέβεια',
    ]) {
      expect(text, repaired).toContain(repaired);
    }
    for (const damage of [
      'justi cabitur',
      'per filem',
      'sufficientiu',
      'computantura',
      'praecipiturquemadmodum',
      'justitius',
      'gehennae filli',
      ' NON ',
      'ė',
      'ß',
    ]) {
      expect(text, damage).not.toContain(damage);
    }
  });

  it('has the translation metadata of both languages, naming this edition as their source', () => {
    for (const [lang, title] of [
      ['en', 'On the Spirit and the Letter'],
      ['ro', 'Despre duh și literă'],
    ] as const) {
      const meta = TranslationEditionMetaSchema.parse(
        readJson(`translation-${lang}`, 'edition.json'),
      );
      expect(meta.edition.sourceEditionId).toBe(edition.edition.id);
      expect(meta.edition.language).toBe(lang);
      expect(meta.workTitle).toBe(title);
      expect(meta.edition.provenance).toMatchObject({ kind: 'ai', sourceLanguage: 'la' });
    }
  });

  it('gives translation jobs for both targets: a job per chapter, no scripture reference left', () => {
    // The marginal references were removed with the apparatus and the text has none of its own, so
    // no reference run exists and no reference-like fragment is left unparsed.
    for (const lang of ['en', 'ro']) {
      const built = buildJobs({
        edition,
        targetLanguage: lang,
        chunk: DEFAULT_CHUNK,
        repoRoot: root,
        sourceSha256: '0'.repeat(64),
      });
      expect(built.jobs).toHaveLength(36);
      expect(built.jobs.reduce((sum, job) => sum + job.paragraphs.length, 0)).toBe(67);
      expect(built.referenceRuns).toBe(0);
      expect(built.unparsed).toEqual([]);
      expect(built.emptySections).toEqual([]);
    }
  });
});
