import { z } from 'zod';

/**
 * Data-driven cleaning configuration for one source text. It lives next to the work
 * (`content/works/<slug>/ingest.config.json`) so that heuristics are tuned per source
 * instead of being hard-coded in the tool.
 *
 * All `*Marker`/`pattern` strings are JavaScript regular expression sources (no slashes).
 */
const RegexSource = z.string().min(1);

const PageFixSchema = z.object({
  /** 1-based page number in the raw file (form-feed separated). */
  page: z.number().int().min(1),
  /** Exact text that must occur in the raw page (whitespace included). */
  find: z.string().min(1),
  replace: z.string(),
  note: z.string().optional(),
});

const ReplacementSchema = z.object({
  pattern: RegexSource,
  flags: z
    .string()
    .regex(/^[dgimsuvy]*$/)
    .default('g'),
  replace: z.string(),
  note: z.string().optional(),
});

const ChapterSchema = z.object({
  /** Roman numeral exactly as in the chapter marker, e.g. "IV". */
  number: z.string().min(1),
  /** Clean heading used instead of the (OCR-garbled) heading found in the text. */
  heading: z.string().min(1),
  /**
   * Number of non-empty lines the heading occupies in the text. Needed when the heading is not
   * followed by a blank line (default: up to the first blank line).
   */
  headingLines: z.number().int().min(1).optional(),
});

export const IngestConfigSchema = z.object({
  /** Marker line of the first chapter. Everything before it is front matter. */
  firstChapterMarker: RegexSource.default('^\\s*CHAPTER\\s+I\\s*$'),
  /** Chapter marker line. Capture group 1 is the (roman) chapter number. */
  chapterMarker: RegexSource.default('^\\s*CHAPTER\\s+([IVXLCDM]+)\\.?\\s*$'),
  /** Line that ends the body. It and everything after it (indices, ads) is dropped. */
  endMarker: RegexSource.optional(),
  /** Format of the section heading. `{number}` and `{heading}` are substituted. */
  headingTemplate: z.string().default('{number}. {heading}'),
  /** Detect ALL-CAPS heading lines as sections (for works without CHAPTER markers). */
  allCapsHeadings: z.boolean().default(false),

  headers: z
    .object({
      /** Non-empty lines at the top of a page that may hold a running head. */
      zoneLines: z.number().int().min(1).max(5).default(2),
      /** A head text must repeat on at least this many pages to count as a running head. */
      minRepeats: z.number().int().min(2).default(4),
      /** Similarity (0..1) for the OCR-tolerant comparison of head texts. */
      similarity: z.number().min(0.3).max(1).default(0.65),
      /** Extra regexes: any line in the head zone matching one of them is dropped. */
      extraPatterns: z.array(RegexSource).default([]),
    })
    .prefault({}),

  footers: z
    .object({
      /** Last non-empty lines of a page that may hold page numbers or signature marks. */
      zoneLines: z.number().int().min(0).max(4).default(2),
      /** A foot line is furniture if it is at most this long and has no two lowercase letters. */
      maxChars: z.number().int().min(1).default(6),
    })
    .prefault({}),

  paragraphs: z
    .object({
      /**
       * `layout`: a paragraph starts at an indented line, or after a clearly short line that ends
       *   a sentence (needs `pdftotext -layout` text, where indentation survives).
       * `length`: only the short-line cue, relative to the line length (plain pdftotext text).
       * `auto`: `layout` if the text carries indentation, otherwise `length`.
       */
      mode: z.enum(['auto', 'layout', 'length']).default('auto'),
      /** Indent (relative to the page margin) that marks a paragraph start. */
      indentMin: z.number().int().min(1).default(2),
      indentMax: z.number().int().min(1).default(9),
      /** `layout` mode: columns before the page's right edge at which a line counts as short. */
      shortEndChars: z.number().int().min(1).default(5),
      /** `length` mode: a line shorter than this fraction of the page's line width ends a paragraph. */
      shortLineRatio: z.number().min(0.3).max(1).default(0.8),
      /** A period after one of these (case-insensitive, no dot) does not end a sentence. */
      abbreviations: z
        .array(z.string())
        .default(['vs', 'cf', 'viz', 'ch', 'chap', 'ver', 'vv', 'st', 'no', 'dr', 'mr', 'ibid']),
    })
    .prefault({}),

  hyphenation: z
    .object({
      /** Compounds (lowercase, with hyphen) whose hyphen is kept when split at a line end. */
      keep: z.array(z.string()).default([]),
      /** Words (lowercase, no hyphen) that are joined when split at a line end. */
      join: z.array(z.string()).default([]),
    })
    .prefault({}),

  /** Body lines with 1..N visible characters are scan noise and dropped (blank lines are kept). */
  noiseLineMaxChars: z.number().int().min(0).default(2),
  /**
   * Regexes removed from the end of body lines: scan noise such as a stray mark after a gap
   * ("these.      _"). Applied only if at least 12 characters remain.
   */
  lineNoise: z.array(RegexSource).default(['\\s{3,}\\S{1,3}\\s*$']),

  chapters: z.array(ChapterSchema).default([]),
  pageFixes: z.array(PageFixSchema).default([]),
  /** Regex replacements applied to every finished paragraph, in order. */
  replacements: z.array(ReplacementSchema).default([]),
  /** Exact-token fixes (case-sensitive) applied after the replacements: "supematural" -> "supernatural". */
  wordFixes: z.record(z.string(), z.string()).default({}),
  /** Convert straight quotes to typographic quotes (parity based, per paragraph). */
  typographicQuotes: z.boolean().default(true),
});

export type IngestConfig = z.infer<typeof IngestConfigSchema>;
export type IngestConfigInput = z.input<typeof IngestConfigSchema>;

export function parseIngestConfig(value: unknown): IngestConfig {
  return IngestConfigSchema.parse(value);
}
