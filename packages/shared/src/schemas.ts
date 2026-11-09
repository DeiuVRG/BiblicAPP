import { z } from 'zod';

/** Stable identifier: ULID-like, URL-safe. Generated once at ingest (see `stableId`). */
export const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'invalid id');

const NonEmpty = z.string().min(1);
const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, 'expected lowercase hex sha256');
const Base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, 'expected base64');
const Semver = z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, 'expected semver');

/**
 * Signed manifest that travels next to `pack.json`.
 * - `sha256`: lowercase hex SHA-256 of the exact bytes of pack.json. pack.json is stored in
 *   canonical form (see `canonicalJson`), so the hash can be recomputed from the parsed object.
 * - `signature`: Ed25519 (base64) over `manifestSigningPayload(manifest)` (the canonical JSON of
 *   the manifest without the `signature` field).
 * - `revision`: content revision of the edition (bumps when text changes).
 * - `version`: pack format / release version (semver).
 *
 * Strict on purpose: unknown fields are rejected, because they would be neither signed nor
 * validated (zod would silently strip them before the signing payload is computed).
 */
export const PackManifestSchema = z.strictObject({
  packId: IdSchema,
  kind: z.literal('edition'),
  workId: IdSchema,
  editionId: IdSchema,
  revision: z.number().int().min(1),
  version: Semver,
  createdAt: z.iso.datetime(),
  sha256: Sha256Hex,
  size: z.number().int().min(1),
  minAppVersion: Semver,
  signingKeyId: NonEmpty,
  signature: Base64,
});
export type PackManifest = z.infer<typeof PackManifestSchema>;

export const AuthorSchema = z.object({
  name: NonEmpty,
  born: z.number().int().nullable(),
  died: z.number().int().nullable(),
  tradition: z.string(),
});
export type Author = z.infer<typeof AuthorSchema>;

export const WorkSchema = z.object({
  id: IdSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected kebab-case slug'),
  titleRo: NonEmpty,
  titleOrig: NonEmpty,
  /**
   * English title, for works whose original is not English (an English translation needs one).
   * Optional and left out of source packs, so a pack built before the field existed is unchanged;
   * `translation-merge` fills it from the translated edition's metadata. The app shows it to
   * readers whose reading language is English.
   */
  titleEn: NonEmpty.optional(),
  author: AuthorSchema,
  /** BCP 47 style code of the original language, e.g. 'en', 'la', 'grc', 'ang', 'de'. */
  languageOrig: NonEmpty,
  year: z.number().int().nullable(),
});
export type Work = z.infer<typeof WorkSchema>;

export const LicenceSchema = z.object({
  status: z.enum(['public-domain', 'licensed', 'unknown']),
  /** The note in prose, in the language of the edition itself. */
  note: z.string(),
  /**
   * The same note in Romanian and in English, for the language of the interface. Both are
   * optional (absent in packs built before they existed); the app falls back to `note`.
   */
  noteRo: z.string().optional(),
  noteEn: z.string().optional(),
});
export type Licence = z.infer<typeof LicenceSchema>;

/**
 * Where the text of an edition comes from (docs/ui-spec-v2.md, 8.6): `ai` (a machine translation),
 * `human` (a translation made by people), `native` (the work was written in the language of the
 * edition: nothing was translated), `source` (the original text of a work in another language: the
 * Latin of Augustine) and `unknown` (not recorded yet). That a text is also a transcription of a
 * printed edition (OCR) is a flag of its own, `transcription`, because an edition can be both.
 */
export const PROVENANCE_KINDS = ['ai', 'human', 'native', 'source', 'unknown'] as const;
export const ProvenanceKindSchema = z.enum(PROVENANCE_KINDS);
export type ProvenanceKind = z.infer<typeof ProvenanceKindSchema>;

/** A calendar date ("2026-11-04") or a date and time in ISO 8601. */
const IsoDate = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/,
    'expected an ISO date',
  );

/** One automatic check that ran over a translation, and how it came out. */
export const ProvenanceCheckSchema = z.object({
  /** What was checked: `parity` (one target paragraph per source paragraph), `references`, `glossary`, `calques`. */
  code: NonEmpty,
  /** `passed`: nothing left to look at. `flagged`: it raised flags that a reviewer has still to read. */
  status: z.enum(['passed', 'flagged']),
  /** How many flags it raised (the ones still open). */
  flags: z.number().int().min(0).optional(),
});
export type ProvenanceCheck = z.infer<typeof ProvenanceCheckSchema>;

/** Whether a person has read the text against its source. The reviewer's name is never stored here. */
export const ProvenanceReviewSchema = z.object({
  state: z.enum(['needs-review', 'reviewed']),
  /** When it was reviewed (state `reviewed`). */
  at: IsoDate.optional(),
  /** The role of the reviewer ("theologian and philologist"), shown instead of a name. */
  roleNote: z.string().optional(),
});
export type ProvenanceReview = z.infer<typeof ProvenanceReviewSchema>;

/** A dated change made to the text after it was published. */
export const ProvenanceCorrectionSchema = z.object({
  at: IsoDate,
  summary: NonEmpty,
});
export type ProvenanceCorrection = z.infer<typeof ProvenanceCorrectionSchema>;

/**
 * How an edition was made. `source`, `extractedBy` and `notes` are the original free-text record;
 * every other field is new and optional (a pack built before them is unchanged and still valid):
 * when they are absent the app derives what it can from the kind of the edition and the free
 * text (`provenance.ts` in the app).
 */
export const ProvenanceSchema = z.object({
  source: z.string(),
  extractedBy: z.string(),
  notes: z.string(),
  kind: ProvenanceKindSchema.optional(),
  /** The text was recognised from a scan of a printed edition and cleaned, not collated with it. */
  transcription: z.boolean().optional(),
  /** Translations: the language of the text that was translated ("en", "la"). */
  sourceLanguage: NonEmpty.optional(),
  /** Machine translations: the model that wrote it ("claude-sonnet-5-5"). */
  model: NonEmpty.optional(),
  /** Machine translations: when it was generated. */
  generatedAt: IsoDate.optional(),
  /** The passes it went through, in order ("draft", "critic", "revision"). */
  passes: z.array(NonEmpty).optional(),
  /** The automatic checks that ran over it. */
  checks: z.array(ProvenanceCheckSchema).optional(),
  /** Source editions: what the edition is (the scan, the transcription, the cleaning). */
  sourceDescription: NonEmpty.optional(),
  review: ProvenanceReviewSchema.optional(),
  /** Dated changes since publication, in any order (the app lists the newest first). */
  corrections: z.array(ProvenanceCorrectionSchema).optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const EditionSchema = z.object({
  id: IdSchema,
  /** Language of this edition's text (BCP 47 style), e.g. 'en' or 'ro'. */
  language: NonEmpty,
  kind: z.enum(['source', 'translation']),
  licence: LicenceSchema,
  provenance: ProvenanceSchema,
  /** Translations only: the edition whose paragraphs this edition is aligned to (1:1). */
  sourceEditionId: IdSchema.optional(),
});
export type Edition = z.infer<typeof EditionSchema>;

export const SectionSchema = z.object({
  id: IdSchema,
  ordinal: z.number().int().min(0),
  kind: z.enum(['chapter', 'section']),
  heading: z.string(),
  parentId: IdSchema.optional(),
  /** Translations only: the section of the source edition this section renders. */
  sourceId: IdSchema.optional(),
});
export type Section = z.infer<typeof SectionSchema>;

export const ParagraphSchema = z.object({
  id: IdSchema,
  sectionId: IdSchema,
  ordinal: z.number().int().min(0),
  kind: z.enum(['p', 'heading', 'quote', 'note']),
  text: z.string(),
  /**
   * Translations only: the paragraph of the source edition this paragraph renders. Translations
   * are aligned one paragraph to one paragraph; ids are never shared between editions.
   */
  sourceId: IdSchema.optional(),
});
export type Paragraph = z.infer<typeof ParagraphSchema>;

/** The content of one edition: work metadata, edition metadata, sections and paragraphs. */
export const PackSchema = z
  .object({
    work: WorkSchema,
    edition: EditionSchema,
    sections: z.array(SectionSchema),
    paragraphs: z.array(ParagraphSchema),
  })
  .superRefine((pack, ctx) => {
    const sectionIds = new Set<string>();
    pack.sections.forEach((section, index) => {
      if (sectionIds.has(section.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections', index, 'id'],
          message: `duplicate section id ${section.id}`,
        });
      }
      sectionIds.add(section.id);
    });
    pack.sections.forEach((section, index) => {
      if (section.parentId !== undefined && !sectionIds.has(section.parentId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sections', index, 'parentId'],
          message: `unknown parent section ${section.parentId}`,
        });
      }
    });
    if (pack.edition.kind === 'translation' && pack.edition.sourceEditionId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['edition', 'sourceEditionId'],
        message: 'a translation must name its source edition',
      });
    }
    const paragraphIds = new Set<string>();
    const sourceIds = new Set<string>();
    pack.paragraphs.forEach((paragraph, index) => {
      if (paragraph.sourceId !== undefined) {
        if (sourceIds.has(paragraph.sourceId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['paragraphs', index, 'sourceId'],
            message: `source paragraph ${paragraph.sourceId} is rendered twice`,
          });
        }
        sourceIds.add(paragraph.sourceId);
      }
      if (paragraphIds.has(paragraph.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['paragraphs', index, 'id'],
          message: `duplicate paragraph id ${paragraph.id}`,
        });
      }
      paragraphIds.add(paragraph.id);
      if (!sectionIds.has(paragraph.sectionId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['paragraphs', index, 'sectionId'],
          message: `unknown section ${paragraph.sectionId}`,
        });
      }
    });
  });
export type Pack = z.infer<typeof PackSchema>;
