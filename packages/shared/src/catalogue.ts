import { z } from 'zod';

import { IdSchema } from './schemas';
import { canonicalJsonBytes } from './canonical-json';

// The signed catalogue (docs/ui-spec-v2.md, section 6.8; ADR-018): one file next to the packs that
// is the single source of every count, shelf, century, author line and editorial blurb of the
// library, and the list of the packs that are installed (packId, sha256, size). The app verifies
// its signature once at start and each pack against its entry when the edition is first opened.
// Everything here is new and additive: packs and their manifests are unchanged.

const NonEmpty = z.string().min(1);
const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected kebab-case slug');
const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, 'expected lowercase hex sha256');
const Base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, 'expected base64');
const Semver = z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, 'expected semver');

/** The kinds of work (the "Tratat", "Predici" chip of the work hub). */
export const WORK_KINDS = [
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
] as const;
export const WorkKindSchema = z.enum(WORK_KINDS);
export type WorkKind = z.infer<typeof WorkKindSchema>;

/** Where a text of the catalogue comes from: written by hand by an editor, or generated with AI. */
export const TextKindSchema = z.enum(['editorial', 'ai']);
export type TextKind = z.infer<typeof TextKindSchema>;

/** An editorial grouping of works (a work can sit on several): "Părinții Bisericii". */
export const CatalogueShelfSchema = z.object({
  slug: Slug,
  /** Position among the shelves (ascending). */
  order: z.number().int().min(0),
  labelRo: NonEmpty,
  labelEn: NonEmpty,
  descRo: z.string(),
  descEn: z.string(),
});
export type CatalogueShelf = z.infer<typeof CatalogueShelfSchema>;

/** A tradition of the controlled vocabulary (P2; the array may be empty or absent before). */
export const CatalogueTraditionSchema = z.object({
  slug: Slug,
  parent: Slug.optional(),
  labelRo: NonEmpty,
  labelEn: NonEmpty,
  descRo: z.string(),
  descEn: z.string(),
  /** The year the tradition begins, when it has one. */
  from: z.number().int().optional(),
});
export type CatalogueTradition = z.infer<typeof CatalogueTraditionSchema>;

export const CatalogueAuthorSchema = z.object({
  slug: Slug,
  nameRo: NonEmpty,
  nameEn: NonEmpty,
  /** The name as the author's own language writes it. */
  nameOrig: NonEmpty,
  /**
   * The name the author is sorted and filed under ("Vos, Geerhardus"; "Augustin" for a Father
   * whose name is his only name). The display name when absent. It is the one field this schema
   * adds to the list of 6.8: no rule can tell a surname from a given name in every tradition.
   */
  sortName: NonEmpty.optional(),
  born: z.number().int().nullable(),
  died: z.number().int().nullable(),
  /** A slug of `traditions[]` once that vocabulary exists (P2); a free label before. */
  tradition: z.string(),
  bioRo: z.string(),
  bioEn: z.string(),
  bioKind: TextKindSchema,
});
export type CatalogueAuthor = z.infer<typeof CatalogueAuthorSchema>;

/** The body that issued a work that has no individual author: a council, a church, an academy. */
export const IssuingBodySchema = z.object({
  slug: Slug,
  labelRo: NonEmpty,
  labelEn: NonEmpty,
  year: z.number().int().optional(),
});
export type IssuingBody = z.infer<typeof IssuingBodySchema>;

/** One entry of the "where to start" list of a work (P1b): a paragraph and one sentence of why. */
export const StartEntrySchema = z.object({
  paragraphId: IdSchema,
  whyRo: NonEmpty,
  whyEn: NonEmpty,
});
export type StartEntry = z.infer<typeof StartEntrySchema>;

export const CatalogueWorkSchema = z
  .object({
    workId: IdSchema,
    slug: Slug,
    authorSlug: Slug.optional(),
    issuingBody: IssuingBodySchema.optional(),
    shelves: z.array(Slug),
    kind: WorkKindSchema,
    /** The century when the year of the original does not say it (or says it wrongly). */
    centuryOverride: z.number().int().optional(),
    blurbRo: z.string(),
    blurbEn: z.string(),
    blurbKind: TextKindSchema,
    start: z.array(StartEntrySchema),
  })
  .refine((work) => work.authorSlug !== undefined || work.issuingBody !== undefined, {
    message: 'a work has an author or an issuing body, never neither',
  });
export type CatalogueWork = z.infer<typeof CatalogueWorkSchema>;

/** One installed pack: the app checks the pack against these two numbers when it is first opened. */
export const CataloguePackSchema = z.object({
  packId: IdSchema,
  editionId: IdSchema,
  sha256: Sha256Hex,
  size: z.number().int().min(1),
});
export type CataloguePack = z.infer<typeof CataloguePackSchema>;

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

/**
 * The catalogue itself. The integrity rules make it a coherent object before anything reads it:
 * unique ids and slugs, every reference resolves, one label per issuing body.
 */
export const CatalogueSchema = z
  .object({
    shelves: z.array(CatalogueShelfSchema),
    traditions: z.array(CatalogueTraditionSchema).optional(),
    authors: z.array(CatalogueAuthorSchema),
    works: z.array(CatalogueWorkSchema),
    /**
     * The editorial list "Începe aici" of the Selecție page (up to ten work slugs, in order). An
     * addition to the list of 6.8, which names the list in 6.1 without saying where it is kept.
     */
    startHere: z.array(Slug).optional(),
    packs: z.array(CataloguePackSchema),
  })
  .superRefine((catalogue, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const unique = (what: string, values: readonly string[], path: string) => {
      for (const value of duplicates(values)) issue([path], `duplicate ${what} ${value}`);
    };
    unique(
      'shelf slug',
      catalogue.shelves.map((shelf) => shelf.slug),
      'shelves',
    );
    unique(
      'author slug',
      catalogue.authors.map((author) => author.slug),
      'authors',
    );
    unique(
      'work id',
      catalogue.works.map((work) => work.workId),
      'works',
    );
    unique(
      'work slug',
      catalogue.works.map((work) => work.slug),
      'works',
    );
    unique(
      'pack id',
      catalogue.packs.map((pack) => pack.packId),
      'packs',
    );
    unique(
      'edition id',
      catalogue.packs.map((pack) => pack.editionId),
      'packs',
    );
    const traditions = catalogue.traditions ?? [];
    unique(
      'tradition slug',
      traditions.map((tradition) => tradition.slug),
      'traditions',
    );
    const traditionSlugs = new Set(traditions.map((tradition) => tradition.slug));
    traditions.forEach((tradition, index) => {
      if (tradition.parent !== undefined && !traditionSlugs.has(tradition.parent)) {
        issue(['traditions', index, 'parent'], `unknown parent tradition ${tradition.parent}`);
      }
    });

    const shelfSlugs = new Set(catalogue.shelves.map((shelf) => shelf.slug));
    const authorSlugs = new Set(catalogue.authors.map((author) => author.slug));
    const bodies = new Map<string, { labelRo: string; labelEn: string; year?: number }>();
    catalogue.works.forEach((work, index) => {
      for (const shelf of work.shelves) {
        if (!shelfSlugs.has(shelf)) issue(['works', index, 'shelves'], `unknown shelf ${shelf}`);
      }
      if (work.authorSlug !== undefined && !authorSlugs.has(work.authorSlug)) {
        issue(['works', index, 'authorSlug'], `unknown author ${work.authorSlug}`);
      }
      const body = work.issuingBody;
      if (body === undefined) return;
      if (authorSlugs.has(body.slug)) {
        // Authors and issuing bodies share the address space of the A-Z lists and of the URLs.
        issue(['works', index, 'issuingBody', 'slug'], `${body.slug} is also an author slug`);
      }
      const known = bodies.get(body.slug);
      if (
        known !== undefined &&
        (known.labelRo !== body.labelRo || known.labelEn !== body.labelEn || known.year !== body.year)
      ) {
        issue(
          ['works', index, 'issuingBody'],
          `issuing body ${body.slug} is described differently by two works`,
        );
      }
      bodies.set(body.slug, { labelRo: body.labelRo, labelEn: body.labelEn, year: body.year });
    });

    const workSlugs = new Set(catalogue.works.map((work) => work.slug));
    (catalogue.startHere ?? []).forEach((slug, index) => {
      if (!workSlugs.has(slug)) issue(['startHere', index], `unknown work ${slug}`);
    });
  });
export type Catalogue = z.infer<typeof CatalogueSchema>;

/**
 * The signed record that travels next to `catalogue.json`, like a pack manifest: `sha256` and
 * `size` of the exact bytes of catalogue.json (canonical JSON, see `canonicalJson`), a signature
 * (Ed25519, base64) over `catalogueSigningPayload(manifest)`, the key that made it and the oldest
 * app that may read it. Strict on purpose: an unknown field would be neither signed nor validated.
 */
export const CatalogueManifestSchema = z.strictObject({
  kind: z.literal('catalogue'),
  /** Content revision (bumps when the catalogue changes). */
  revision: z.number().int().min(1),
  /** Format version (semver). */
  version: Semver,
  createdAt: z.iso.datetime(),
  sha256: Sha256Hex,
  size: z.number().int().min(1),
  minAppVersion: Semver,
  signingKeyId: NonEmpty,
  signature: Base64,
});
export type CatalogueManifest = z.infer<typeof CatalogueManifestSchema>;

/**
 * The bytes that are signed for a catalogue manifest: the canonical JSON of the manifest without
 * its `signature` field (the same rule as for pack manifests). Both the build tool and the app use
 * this function.
 */
export function catalogueSigningPayload(manifest: CatalogueManifest): Uint8Array {
  const { signature: _signature, ...unsigned } = manifest;
  return canonicalJsonBytes(unsigned);
}
