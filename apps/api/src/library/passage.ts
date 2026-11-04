import type { Language } from '../types';
import { isSearchable } from './library';
import type { Library, LibraryParagraph } from './library';
import { RELATIVE_CUTOFF, assemblePassage, retrieve } from './retrieve';
import type { RetrievalResult, RetrievedPassage } from './retrieve';

/** How many passages of an answer may come from the section of the attached passage (it included). */
export const SECTION_PASSAGES = 5;

export interface PassageRetrieveOptions {
  language: Language;
  /** Passages in all, the attached one included; default 10. */
  limit?: number;
  /** Of those, the most that may come from the section of the attached passage; default 5. */
  sectionPassages?: number;
  /** Restrict retrieval, and the aligned versions, to these editions. */
  editionIds?: ReadonlySet<string>;
  /** Earlier questions of the dialogue, oldest first. */
  history?: readonly string[];
}

/** The searchable paragraphs just before and just after `paragraph` in its section (those that exist). */
export function neighbours(library: Library, paragraph: LibraryParagraph): LibraryParagraph[] {
  const siblings = library.sections.get(paragraph.sectionId) ?? [];
  const at = siblings.indexOf(paragraph);
  if (at === -1) return [];
  const found: LibraryParagraph[] = [];
  for (let i = at - 1; i >= 0; i -= 1) {
    const sibling = siblings[i] as LibraryParagraph;
    if (isSearchable(sibling)) {
      found.push(sibling);
      break;
    }
  }
  for (let i = at + 1; i < siblings.length; i += 1) {
    const sibling = siblings[i] as LibraryParagraph;
    if (isSearchable(sibling)) {
      found.push(sibling);
      break;
    }
  }
  return found;
}

/**
 * Retrieval for a question about a passage the person selected in the reader. The section of that
 * passage comes first, then the whole library tops the answer up:
 *
 * 1. the attached passage itself, whether or not it shares a word with the question ("what does
 *    this mean?" has nothing to search for, but is a good question about a passage);
 * 2. the paragraph just before it and the one just after it (its neighbours);
 * 3. the best matches for the question inside the same section, up to `sectionPassages` passages
 *    in all for steps 1 to 3, and only those that score at least `RELATIVE_CUTOFF` of the best
 *    passage of the whole library (a section that has nothing to say about the question does not
 *    fill the answer);
 * 4. the usual retrieval over everything the request allows (`editionIds`), for the rest of
 *    `limit`: the global top-up, so that the answer can still use the rest of the library.
 *
 * "The same section" means the section of the passage in every installed edition (a translation's
 * section shares the key of the section it renders), and a passage counts once however many
 * editions carry it. The attached passage is shown in the asked language when that edition exists.
 * Passages that are only there for context score 0 unless they also matched.
 */
export function retrieveWithPassage(
  library: Library,
  question: string,
  passage: LibraryParagraph,
  options: PassageRetrieveOptions,
): RetrievalResult & { attached: boolean } {
  const { language } = options;
  const limit = options.limit ?? 10;
  const sectionLimit = Math.min(limit, options.sectionPassages ?? SECTION_PASSAGES);
  const accept = (paragraph: LibraryParagraph): boolean =>
    options.editionIds === undefined || options.editionIds.has(paragraph.editionId);
  const shared = {
    language,
    ...(options.editionIds !== undefined ? { editionIds: options.editionIds } : {}),
    ...(options.history !== undefined ? { history: options.history } : {}),
  };

  const everywhere = retrieve(library, question, { ...shared, limit });
  const inSection = retrieve(library, question, {
    ...shared,
    limit: sectionLimit,
    filter: (paragraph) => paragraph.sectionKey === passage.sectionKey,
  });
  const floor = (everywhere.passages[0]?.score ?? 0) * RELATIVE_CUTOFF;

  const found = new Map<string, RetrievedPassage>();
  for (const candidate of [...inSection.passages, ...everywhere.passages]) {
    if (!found.has(candidate.groupKey)) found.set(candidate.groupKey, candidate);
  }

  const passages: RetrievedPassage[] = [];
  const included = new Set<string>();
  const add = (candidate: RetrievedPassage | undefined, upTo: number): void => {
    if (candidate === undefined || included.has(candidate.groupKey) || passages.length >= upTo) {
      return;
    }
    included.add(candidate.groupKey);
    passages.push(candidate);
  };
  const forParagraph = (paragraph: LibraryParagraph): RetrievedPassage =>
    found.get(paragraph.groupKey) ?? assemblePassage(library, paragraph, language, accept, 0, []);

  // The paragraph asked about, read in an edition the request allows.
  const entry = accept(passage)
    ? passage
    : (library.groups.get(passage.groupKey) ?? []).find((member) => accept(member));
  if (entry !== undefined) {
    add(forParagraph(entry), limit);
    for (const next of neighbours(library, entry)) add(forParagraph(next), sectionLimit);
  }
  for (const candidate of inSection.passages) {
    if (candidate.score >= floor) add(candidate, sectionLimit);
  }
  for (const candidate of everywhere.passages) add(candidate, limit);

  return {
    passages,
    queryText: everywhere.queryText,
    queries: everywhere.queries,
    refs: everywhere.refs,
    usedHistory: everywhere.usedHistory,
    attached: entry !== undefined,
  };
}
