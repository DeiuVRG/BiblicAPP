import { primaryLanguage, targetSpec } from './languages';
import {
  ENGLISH,
  ENGLISH_TARGET,
  ROMANIAN,
  VULGATE_MARKER,
  extractRuns,
  findUnparsedReferenceFragments,
  nonRomanianSpans,
  outermost,
  parseRuns,
  renderEnglish,
  renderRomanian,
} from './references';
import type {
  ExtractedReference,
  Grammar,
  ReferenceRun,
  Span,
  UnparsedFragment,
} from './references';
import { LATIN, LATIN_CUT_SHORT, LATIN_LOOSE_PATTERNS } from './references-latin';

/**
 * Scripture references for a pair of languages (docs/traducere-pipeline.md, section 5): the
 * grammar of the source language reads them, the notation of the target language writes them and
 * reads them back in the translation. Everything here is pure.
 *
 * - Source `en` is read by the grammar of English theology (`Matt. iv. 17`), source `la` by the
 *   Latin grammar (`Matth. IV, 17`, `Ioh. 3, 5`, `ibid.`). A source in another language, Greek
 *   included, has no grammar: its paragraphs have no references to carry over.
 * - Target `ro` is written `Mat. 4:17`, target `en` `Matt. 4:17`.
 */

export interface ReferenceLanguages {
  /** Language of the source edition. */
  source: string;
  /** Language of the translation. */
  target: string;
}

function sourceGrammar(source: string): Grammar | null {
  switch (primaryLanguage(source)) {
    case 'en':
      return ENGLISH;
    case 'la':
      return LATIN;
    default:
      return null;
  }
}

/** True when sources in this language have a grammar of scripture references. */
export function hasReferenceGrammar(source: string): boolean {
  return sourceGrammar(source) !== null;
}

const renderers = { ro: renderRomanian, en: renderEnglish } as const;

/** All runs of references in a source paragraph, written in the notation of the target. */
export function parseReferences(text: string, languages: ReferenceLanguages): ReferenceRun[] {
  const render = renderers[targetSpec(languages.target).notation];
  const grammar = sourceGrammar(languages.source);
  return grammar ? parseRuns(text, grammar, render) : [];
}

function targetGrammar(target: string): Grammar {
  return targetSpec(target).notation === 'ro' ? ROMANIAN : ENGLISH_TARGET;
}

/** All runs of references in a translation, mapped to canonical items. */
export function extractReferences(text: string, target: string): ExtractedReference[] {
  return extractRuns(text, targetGrammar(target));
}

/** Reference-like fragments of a source paragraph that its grammar did not turn into a run. */
export function findUnparsedFragments(
  text: string,
  source: string,
  runs?: readonly Span[],
): UnparsedFragment[] {
  switch (primaryLanguage(source)) {
    case 'en':
      return findUnparsedReferenceFragments(text, runs);
    case 'la':
      return findUnparsedReferenceFragments(text, runs ?? parseRuns(text, LATIN, renderEnglish), {
        patterns: LATIN_LOOSE_PATTERNS,
        cutShort: LATIN_CUT_SHORT,
      });
    default:
      return [];
  }
}

/** A canonical item without the marker of Vulgate numbering: what the translation can show. */
export function canonicalKey(item: string): string {
  return item.endsWith(VULGATE_MARKER) ? item.slice(0, -VULGATE_MARKER.length) : item;
}

function notCoveredBy(candidates: readonly Span[], valid: readonly Span[]): Span[] {
  return candidates.filter((c) => !valid.some((v) => v.start <= c.start && c.end <= v.end));
}

/**
 * Fragments of a translation that are scripture references in some other notation than the one of
 * its language (REF_FORMAT): in Romanian, English abbreviations (`Matt.`, `Jno.`), roman numerals,
 * `vs.`, and, when the source is Latin, the Latin notation; in English, roman numerals and Latin
 * abbreviations (`Matth.`, `Marc.`, `Ioh. 3, 5`). Anything that is also valid in the notation of
 * the translation (`Obad. 21`, `Rom. 5:12`) is not foreign.
 */
export function detectForeignNotation(text: string, languages: ReferenceLanguages): string[] {
  const target = targetSpec(languages.target).notation;
  const valid = extractReferences(text, languages.target);
  let spans: Span[];
  if (target === 'ro') {
    spans = nonRomanianSpans(text);
    if (primaryLanguage(languages.source) === 'la') {
      const latin = parseRuns(text, LATIN, renderRomanian);
      spans = outermost([...spans, ...notCoveredBy(latin, valid)]);
    }
  } else {
    const roman = parseRuns(text, ENGLISH, renderEnglish);
    const latin = parseRuns(text, LATIN, renderEnglish);
    spans = outermost(notCoveredBy([...roman, ...latin], valid));
  }
  return spans.map((span) => text.slice(span.start, span.end));
}
