import type { Language } from '../types';
import { baseLanguage, getAnalyzer } from '../text/analyzer';
import { translateQuery } from '../text/glossary';
import {
  chapterKey,
  cutRanges,
  extractReferences,
  parseReferences,
  refKey,
  refMatchWeight,
} from '../text/scripture';
import type { ScriptureRef } from '../text/scripture';
import type { LanguageIndex, Library, LibraryParagraph } from './library';

/** Points added to a paragraph that cites exactly the verse the question names. */
const REFERENCE_BOOST = 6;
/**
 * From this match weight (`refMatchWeight`) a passage is reported as citing a reference of the
 * question: the same verse or an overlapping range (1), or a verse of the chapter when the question
 * names the whole chapter (0.6). A passage that cites another verse of the same chapter (0.2), or
 * only the chapter when a verse was asked (0.35), still ranks higher for it but does not "cite" it.
 */
const CITED_WEIGHT = 0.6;
/** Multiplier for a paragraph in a language other than the one asked in. */
const OTHER_LANGUAGE_FACTOR = 0.85;
/** Passages scoring below this share of the best one are dropped. */
export const RELATIVE_CUTOFF = 0.15;
/** How many BM25 leaders per language get the (more expensive) phrase check. */
const PHRASE_CANDIDATES = 80;
/** Weight of an adjacent pair of query terms found adjacent in the paragraph. */
const PHRASE_WEIGHT = 0.6;
/**
 * Weight of a search term that comes from the glossary as a synonym or an inflected form of the
 * word the person wrote (the word itself counts 1): it finds passages that use the other word, but
 * a passage with three forms of one concept must not outweigh a passage with two different ones.
 */
const ALTERNATIVE_WEIGHT = 0.5;
/** A question with fewer content terms than this borrows the previous question of the dialogue. */
const MIN_TERMS_BEFORE_FOLLOW_UP = 2;
const FOLLOW_UP_CHARS = 300;

export interface RetrieveOptions {
  /** Language of the question and of the answer to come: it breaks ties and picks the version shown. */
  language: Language;
  /** Passages (groups of aligned paragraphs) to return; default 10. */
  limit?: number;
  /** Restrict retrieval, and the aligned versions, to these editions. */
  editionIds?: ReadonlySet<string>;
  /** Restrict retrieval further to the paragraphs this accepts (for example one section). */
  filter?: (paragraph: LibraryParagraph) => boolean;
  /** Earlier questions of the dialogue, oldest first. */
  history?: readonly string[];
}

export interface RetrievedPassage {
  /** Shared by all language versions of the passage. */
  groupKey: string;
  score: number;
  /** The version shown and quoted: the asked language when it exists, else the original. */
  primary: LibraryParagraph;
  /** The same passage in the other installed editions, original first. */
  aligned: LibraryParagraph[];
  /** The scripture references of the question that this passage cites. */
  matchedRefs: string[];
}

export interface RetrievalResult {
  passages: RetrievedPassage[];
  /** The question as it was searched: references cut out, follow-up context added. */
  queryText: string;
  /**
   * What was searched in the index of each base language: `queryText` for the language of the
   * question, its rendering in the other language's vocabulary for the others (see
   * `text/glossary.ts`). Excerpts are centred on the matching words of this text.
   */
  queries: ReadonlyMap<string, string>;
  refs: ScriptureRef[];
  usedHistory: boolean;
}

interface Candidate {
  paragraph: LibraryParagraph;
  score: number;
  matchedRefs: Set<string>;
}

/** Two query terms that follow one another, as vocabulary ids, with what finding them together is worth. */
export interface QueryPair {
  first: number;
  second: number;
  weight: number;
}

/**
 * The adjacent pairs of the query that can occur at all (both terms are in the vocabulary of the
 * language). Worked out once per question and language, not once per candidate.
 */
export function queryPairs(language: LanguageIndex, queryTerms: readonly string[]): QueryPair[] {
  const pairs: QueryPair[] = [];
  for (let i = 0; i + 1 < queryTerms.length; i += 1) {
    const a = queryTerms[i] as string;
    const b = queryTerms[i + 1] as string;
    if (a === b) continue;
    const first = language.vocabulary.get(a);
    const second = language.vocabulary.get(b);
    if (first === undefined || second === undefined) continue;
    const weight = PHRASE_WEIGHT * ((language.index.idf(a) ?? 0) + (language.index.idf(b) ?? 0));
    pairs.push({ first, second, weight });
  }
  return pairs;
}

/** The bonus of a paragraph: every query pair found next to each other in it counts once. */
export function phraseBonus(sequence: Uint32Array, pairs: readonly QueryPair[]): number {
  let bonus = 0;
  for (const pair of pairs) {
    for (let i = 0; i + 1 < sequence.length; i += 1) {
      if (sequence[i] === pair.first && sequence[i + 1] === pair.second) {
        bonus += pair.weight;
        break;
      }
    }
  }
  return bonus;
}

function sameLanguage(paragraph: LibraryParagraph, language: Language): boolean {
  return baseLanguage(paragraph.language) === language;
}

/**
 * One passage as the answer shows it: the version in the asked language when it exists (else the
 * original), with the other versions that `accept` lets through attached, the original first.
 * `entry` is the paragraph that was found (or chosen); it must be one of the group's paragraphs
 * and, when `accept` rejects some, one that `accept` lets through.
 */
export function assemblePassage(
  library: Library,
  entry: LibraryParagraph,
  language: Language,
  accept: (paragraph: LibraryParagraph) => boolean,
  score: number,
  matchedRefs: readonly string[],
): RetrievedPassage {
  const members = (library.groups.get(entry.groupKey) ?? [entry]).filter(accept);
  const inAskedLanguage = members.filter((member) => sameLanguage(member, language));
  const original = members.find(
    (member) => library.editions.get(member.editionId)?.kind === 'source',
  );
  const primary =
    (sameLanguage(entry, language) ? entry : undefined) ?? inAskedLanguage[0] ?? original ?? entry;
  const rank = (member: LibraryParagraph): number =>
    library.editions.get(member.editionId)?.kind === 'source'
      ? 0
      : sameLanguage(member, language)
        ? 1
        : 2;
  const aligned = members
    .filter((member) => member.docId !== primary.docId)
    .sort((a, b) => rank(a) - rank(b) || a.docId - b.docId);
  return { groupKey: entry.groupKey, score, primary, aligned, matchedRefs: [...matchedRefs] };
}

/**
 * Finds the passages that answer a question: BM25 over the paragraphs of every installed
 * language, a bonus for adjacent query terms, and a boost for paragraphs that cite the scripture
 * references named in the question. The question is searched as it is in the index of its own
 * language, and rendered in the vocabulary of each other language (the glossary of
 * `text/glossary.ts`; names and words it does not know are kept) for the other indexes, so a
 * Romanian question reaches a passage that exists only in English and the other way round.
 * Aligned versions of the same passage count once.
 */
export function retrieve(
  library: Library,
  question: string,
  options: RetrieveOptions,
): RetrievalResult {
  const limit = options.limit ?? 10;
  const accept = (paragraph: LibraryParagraph): boolean =>
    (options.editionIds === undefined || options.editionIds.has(paragraph.editionId)) &&
    (options.filter === undefined || options.filter(paragraph));

  const parsed = parseReferences(question);
  const wanted: ScriptureRef[] = extractReferences(question);
  let queryText = cutRanges(parsed.text, parsed.refs).replace(/\s+/g, ' ').trim();

  // "And what about the fall?" has nothing to search for on its own: borrow the previous question.
  let usedHistory = false;
  const lastQuestion = options.history?.[options.history.length - 1];
  if (
    lastQuestion !== undefined &&
    wanted.length === 0 &&
    getAnalyzer(options.language).analyze(queryText).length < MIN_TERMS_BEFORE_FOLLOW_UP
  ) {
    const earlier = lastQuestion.slice(0, FOLLOW_UP_CHARS);
    const earlierParsed = parseReferences(earlier);
    queryText = `${queryText} ${cutRanges(earlierParsed.text, earlierParsed.refs)}`
      .replace(/\s+/g, ' ')
      .trim();
    wanted.push(...extractReferences(earlier));
    usedHistory = true;
  }

  const candidates = new Map<number, Candidate>();
  const candidate = (paragraph: LibraryParagraph): Candidate => {
    let entry = candidates.get(paragraph.docId);
    if (entry === undefined) {
      entry = { paragraph, score: 0, matchedRefs: new Set() };
      candidates.set(paragraph.docId, entry);
    }
    return entry;
  };

  const queries = new Map<string, string>();
  for (const language of library.indexes.values()) {
    const translated =
      language.language === options.language
        ? null
        : translateQuery(queryText, options.language, language.language);
    const searched = translated?.text ?? queryText;
    const extras = translated?.extras ?? '';
    queries.set(language.language, `${searched} ${extras}`.trim());
    const ordered = language.analyzer.analyze(searched);
    const weights = new Map<string, number>();
    for (const term of ordered) weights.set(term, 1);
    for (const term of language.analyzer.analyze(extras)) {
      if (!weights.has(term)) weights.set(term, ALTERNATIVE_WEIGHT);
    }
    if (weights.size === 0) continue;
    const hits = language.index.search(weights, (i) =>
      accept(language.paragraphs[i] as LibraryParagraph),
    );
    const leaders = [...hits.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, PHRASE_CANDIDATES);
    const pairs = queryPairs(language, ordered);
    for (const [docIndex, hit] of leaders) {
      const paragraph = language.paragraphs[docIndex] as LibraryParagraph;
      const sequence = language.sequences[docIndex] as Uint32Array;
      candidate(paragraph).score += hit.score + phraseBonus(sequence, pairs);
    }
    // Hits beyond the phrase window keep their plain BM25 score.
    for (const [docIndex, hit] of hits) {
      const paragraph = language.paragraphs[docIndex] as LibraryParagraph;
      if (!candidates.has(paragraph.docId)) candidate(paragraph).score += hit.score;
    }
  }

  for (const reference of wanted) {
    for (const paragraph of library.references.get(chapterKey(reference)) ?? []) {
      if (!accept(paragraph)) continue;
      let best = 0;
      for (const found of paragraph.refs) best = Math.max(best, refMatchWeight(reference, found));
      if (best === 0) continue;
      const entry = candidate(paragraph);
      entry.score += REFERENCE_BOOST * best;
      if (best >= CITED_WEIGHT) entry.matchedRefs.add(refKey(reference));
    }
  }

  const ranked = [...candidates.values()]
    .map((entry) => ({
      ...entry,
      score: sameLanguage(entry.paragraph, options.language)
        ? entry.score
        : entry.score * OTHER_LANGUAGE_FACTOR,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.paragraph.docId - b.paragraph.docId);
  const top = ranked[0]?.score ?? 0;

  const passages: RetrievedPassage[] = [];
  const seen = new Set<string>();
  for (const entry of ranked) {
    if (passages.length >= limit) break;
    if (entry.score < top * RELATIVE_CUTOFF) break;
    const groupKey = entry.paragraph.groupKey;
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);
    passages.push(
      assemblePassage(
        library,
        entry.paragraph,
        options.language,
        accept,
        entry.score,
        [...entry.matchedRefs].sort(),
      ),
    );
  }
  return { passages, queryText, queries, refs: wanted, usedHistory };
}
