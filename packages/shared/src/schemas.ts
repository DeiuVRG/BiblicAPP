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
  author: AuthorSchema,
  /** BCP 47 style code of the original language, e.g. 'en', 'la', 'grc', 'ang', 'de'. */
  languageOrig: NonEmpty,
  year: z.number().int().nullable(),
});
export type Work = z.infer<typeof WorkSchema>;

export const LicenceSchema = z.object({
  status: z.enum(['public-domain', 'licensed', 'unknown']),
  note: z.string(),
});
export type Licence = z.infer<typeof LicenceSchema>;

export const ProvenanceSchema = z.object({
  source: z.string(),
  extractedBy: z.string(),
  notes: z.string(),
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
