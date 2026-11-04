import { isSearchable } from '../library/library';
import type { Library, LibraryParagraph } from '../library/library';

/** What a request says about where to look, as it arrives (ids are not checked yet). */
export interface ScopeInput {
  /** Restrict retrieval to these editions. */
  editionIds?: readonly string[] | undefined;
  /** Restrict retrieval to the editions of one work. */
  scope?: { workId: string } | undefined;
  /** The passage the question is about. */
  passage?: { editionId: string; paragraphId: string } | undefined;
}

export type ScopeFailureCode = 'unknown_editions' | 'unknown_passage';

export type ScopeResolution =
  | {
      ok: true;
      /** The editions retrieval is limited to; absent when the whole library may be searched. */
      editionIds?: string[];
      /** The paragraph the question is about, checked against the library. */
      passage?: LibraryParagraph;
    }
  | { ok: false; code: ScopeFailureCode; message: string };

function fail(code: ScopeFailureCode, message: string): ScopeResolution {
  return { ok: false, code, message };
}

/**
 * Turns the scope fields of a request into what retrieval needs, or says what is wrong:
 *
 * - `editionIds`: unknown ids are ignored; if none is known the answer is `unknown_editions`.
 * - `scope.workId`: the editions of that work; a work the library does not have is
 *   `unknown_editions` (the app's "the chosen scope no longer exists" case). Together with
 *   `editionIds` the two narrow each other: only editions of that work in the list remain.
 * - `passage`: the paragraph must exist in the edition named, be text (not a heading), and be
 *   readable in at least one of the editions the other fields leave; otherwise `unknown_passage`.
 */
export function resolveScope(library: Library, input: ScopeInput): ScopeResolution {
  let editions: Set<string> | undefined;
  if (input.editionIds !== undefined) {
    const known = input.editionIds.filter((id) => library.editions.has(id));
    if (known.length === 0) {
      return fail(
        'unknown_editions',
        'None of the editionIds is in the library (see GET /v1/library).',
      );
    }
    editions = new Set(known);
  }
  if (input.scope !== undefined) {
    const work = library.worksById.get(input.scope.workId);
    if (work === undefined) {
      return fail(
        'unknown_editions',
        'scope.workId is not a work of the library (see GET /v1/library).',
      );
    }
    const own = new Set(work.editions.map((edition) => edition.editionId));
    editions = editions === undefined ? own : new Set([...editions].filter((id) => own.has(id)));
    if (editions.size === 0) {
      return fail(
        'unknown_editions',
        'None of the editionIds belongs to the work of scope.workId.',
      );
    }
  }
  const resolved: ScopeResolution = { ok: true };
  if (editions !== undefined) resolved.editionIds = [...editions];
  if (input.passage !== undefined) {
    const paragraph = library.paragraphsById.get(input.passage.paragraphId);
    if (paragraph === undefined || paragraph.editionId !== input.passage.editionId) {
      return fail(
        'unknown_passage',
        'passage: no such paragraph in that edition (ids come from the packs; see GET /v1/library).',
      );
    }
    if (!isSearchable(paragraph)) {
      return fail('unknown_passage', 'passage: the paragraph is a heading, not a passage of text.');
    }
    const readable = (library.groups.get(paragraph.groupKey) ?? [paragraph]).some(
      (member) => editions === undefined || editions.has(member.editionId),
    );
    if (!readable) {
      return fail(
        'unknown_passage',
        'passage: the passage is not in any of the editions the request is limited to.',
      );
    }
    resolved.passage = paragraph;
  }
  return resolved;
}
