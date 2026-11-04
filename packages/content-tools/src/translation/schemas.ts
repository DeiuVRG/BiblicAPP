import { IdSchema, LicenceSchema, ProvenanceSchema } from '@biblioteca/shared';
import { z } from 'zod';

/**
 * File schemas of the translation pipeline (docs/traducere-pipeline.md, section 2.3). Every
 * object is strict: agents must not invent fields, and an unknown key is an error that names
 * its path.
 */

const NonEmpty = z.string().min(1);
const Count = z.number().int().min(0);

/** `vos-1903-kingdom-ro-01-00`: lower-case letters, digits and hyphens. */
export const JobIdSchema = z.string().regex(/^[a-z0-9-]+$/, 'expected [a-z0-9-]');

export const SEVERITIES = ['CRITIC', 'MAJOR', 'MINOR', 'INFO'] as const;
export const SeveritySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof SeveritySchema>;

export const FLAG_CODES = [
  'DE_VERIFICAT',
  'SURSA_POSIBIL_ERONATA',
  'TERMEN_NOU',
  'CITAT_BIBLIC',
  'AMBIGUITATE',
  'ALTA',
] as const;

export const FlagSchema = z.strictObject({
  code: z.enum(FLAG_CODES),
  severity: SeveritySchema,
  /** Exact quotes, never offsets. */
  quoteSource: z.string().optional(),
  quoteTarget: z.string().optional(),
  note: z.string(),
});
export type Flag = z.infer<typeof FlagSchema>;

const ParagraphKindSchema = z.enum(['p', 'heading', 'quote', 'note']);

export const JobReferenceSchema = z.strictObject({
  /** The run as written in the source, e.g. `Matt. iv. 17; Mk. i. 15`. */
  source: z.string(),
  /** The same run in Romanian notation, e.g. `Mat. 4:17; Mc. 1:15`. */
  target: z.string(),
  /** Canonical items, e.g. `Matt 4:17`. */
  canonical: z.array(z.string()),
});
export type JobReference = z.infer<typeof JobReferenceSchema>;

export const TranslationJobSchema = z.strictObject({
  jobId: JobIdSchema,
  workSlug: NonEmpty,
  sourceEditionId: IdSchema,
  sourceLanguage: NonEmpty,
  targetLanguage: NonEmpty,
  section: z.strictObject({
    id: IdSchema,
    ordinal: Count,
    kind: z.enum(['chapter', 'section']),
    heading: z.string(),
  }),
  /** 0-based index of this part within its section. */
  part: Count,
  /** Number of parts of the section. */
  parts: z.number().int().min(1),
  paragraphs: z.array(
    z.strictObject({
      id: IdSchema,
      ordinal: Count,
      kind: ParagraphKindSchema,
      text: z.string(),
      references: z.array(JobReferenceSchema),
    }),
  ),
  context: z.strictObject({
    previousParagraph: z.string().nullable(),
    nextParagraph: z.string().nullable(),
    previousSectionHeading: z.string().nullable(),
  }),
  wordCount: Count,
  /** Repo-relative paths the agents must read. */
  materials: z.strictObject({
    rules: NonEmpty,
    contract: NonEmpty,
    glossary: NonEmpty,
    calques: NonEmpty,
    profile: NonEmpty.nullable(),
  }),
});
export type TranslationJob = z.infer<typeof TranslationJobSchema>;

export const SCRIPTURE_MODES = ['reference', 'quote-author-rendering', 'allusion'] as const;

export const TranslationOutputSchema = z.strictObject({
  jobId: JobIdSchema,
  pass: z.enum(['draft', 'revised']),
  model: NonEmpty,
  /** Required when the job is part 0 of its section (`translation-check` enforces it). */
  headingRo: z.string().optional(),
  paragraphs: z.array(
    z.strictObject({
      sourceId: IdSchema,
      /** One paragraph, NFC. */
      text: NonEmpty,
      flags: z.array(FlagSchema).default([]),
      scripture: z
        .array(z.strictObject({ ref: NonEmpty, mode: z.enum(SCRIPTURE_MODES) }))
        .optional(),
    }),
  ),
  notes: z.string().optional(),
});
export type TranslationOutput = z.infer<typeof TranslationOutputSchema>;
export type OutputParagraph = TranslationOutput['paragraphs'][number];

export const CRITIC_CATEGORIES = [
  'omisiune',
  'adaos',
  'negatie',
  'modalitate',
  'agentivitate',
  'referinta',
  'termen',
  'calc',
  'gramatica',
  'punctuatie',
  'alta',
] as const;

export const CriticFindingSchema = z.strictObject({
  sourceId: IdSchema,
  severity: z.enum(['CRITIC', 'MAJOR', 'MINOR', 'SURSA_POSIBIL_ERONATA']),
  category: z.enum(CRITIC_CATEGORIES),
  quoteSource: z.string(),
  quoteTarget: z.string(),
  problem: NonEmpty,
  proposal: z.string(),
});
export type CriticFinding = z.infer<typeof CriticFindingSchema>;

export const CriticReportSchema = z.strictObject({
  jobId: JobIdSchema,
  pass: z.literal('critic'),
  model: NonEmpty,
  findings: z.array(CriticFindingSchema),
  verdict: z.enum(['ok', 'revise']),
  summary: z.string().optional(),
});
export type CriticReport = z.infer<typeof CriticReportSchema>;

export const CheckFindingSchema = z.strictObject({
  /** Check code, see section 4 of the specification. */
  check: NonEmpty,
  severity: SeveritySchema,
  sourceId: IdSchema.optional(),
  message: z.string(),
  quoteSource: z.string().optional(),
  quoteTarget: z.string().optional(),
  autofixed: z.boolean().optional(),
});
export type CheckFinding = z.infer<typeof CheckFindingSchema>;

export const CheckReportSchema = z.strictObject({
  jobId: JobIdSchema,
  /** The checked output, relative to the translation directory (`final/<jobId>.json`). */
  file: NonEmpty,
  ok: z.boolean(),
  strictOk: z.boolean(),
  findings: z.array(CheckFindingSchema),
  stats: z.strictObject({
    paragraphs: Count,
    sourceWords: Count,
    targetWords: Count,
    lengthRatio: z.number().min(0),
  }),
});
export type CheckReport = z.infer<typeof CheckReportSchema>;

/** `content/works/<slug>/translation-<lang>/edition.json`: hand-written, the id is added once. */
export const TranslationEditionMetaSchema = z.strictObject({
  edition: z.strictObject({
    id: IdSchema.optional(),
    language: NonEmpty,
    kind: z.literal('translation'),
    licence: LicenceSchema.strict(),
    provenance: ProvenanceSchema.strict(),
    sourceEditionId: IdSchema,
  }),
});
export type TranslationEditionMeta = z.infer<typeof TranslationEditionMetaSchema>;

/** `jobs/index.json`, written by `translation-jobs`. */
export const JobIndexSchema = z.strictObject({
  workSlug: NonEmpty,
  sourceEditionId: IdSchema,
  targetLanguage: NonEmpty,
  sourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
  jobs: z.array(
    z.strictObject({
      jobId: JobIdSchema,
      /** File name inside `jobs/`. */
      file: NonEmpty,
      sectionOrdinal: Count,
      part: Count,
      parts: z.number().int().min(1),
      paragraphs: Count,
      words: Count,
    }),
  ),
});
export type JobIndex = z.infer<typeof JobIndexSchema>;

/** Severity order used by the check output and the review sheet. */
export const SEVERITY_RANK: Record<Severity, number> = { CRITIC: 0, MAJOR: 1, MINOR: 2, INFO: 3 };
