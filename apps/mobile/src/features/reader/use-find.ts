import { useCallback, useEffect, useRef, useState } from 'react';

import { useContent } from '@/content/content-context';
import type { SearchHit } from '@/content/types';

import { AUTO_FIND_MIN, FIND_DELAY_MS } from './find-bar';
import type { FindStatus } from './find-bar';

/** The most hits kept: a common word of a long work has thousands, and nobody steps through them all. */
export const MAX_FIND_HITS = 1000;

const NO_HITS: readonly SearchHit[] = [];

/** The hits of one search and the one that is current; `key` says which search they answer. */
interface Found {
  key: string;
  hits: readonly SearchHit[];
  index: number;
}

interface Args {
  editionId: string;
  /** The words the bar opens with (`?q=` and the session), or null for a closed bar. */
  initialQuery: string | null;
  /** The paragraph of a deep link: the hit that is current when the words are found. */
  targetParagraphId?: string;
  /** The section on screen: a hit in it is scrolled to, one in another section is a navigation. */
  sectionId: string;
  /** Called for the hit that becomes current because of the reader (typing, Enter, the arrows). */
  onOpenHit(hit: SearchHit, query: string): void;
  /** Called when the words change, so that the session can keep them across sections. */
  onQuery(query: string | null): void;
}

export interface FindApi {
  open: boolean;
  text: string;
  setText(text: string): void;
  /** The words that were searched (what is marked in the text); empty before the first search. */
  query: string;
  status: FindStatus;
  /** The paragraph of the current hit, or null. */
  hitParagraphId: string | null;
  openBar(): void;
  closeBar(): void;
  next(): void;
  previous(): void;
  /** Enter with no hit to step to: search what is typed now (one or two characters too). */
  searchNow(): void;
}

/**
 * The state of the find bar (docs/ui-spec-v2.md, 8.11): the words, the search over the whole edition (local,
 * `searchEdition`), the hits and the one that is current. A search starts by itself at three characters
 * 250 ms after the last key; fewer wait for Enter. A new search makes its first hit current; the
 * arrows and Enter step round the hits.
 */
export function useFind({
  editionId,
  initialQuery,
  targetParagraphId,
  sectionId,
  onOpenHit,
  onQuery,
}: Args): FindApi {
  const content = useContent();
  const repository = content.status === 'ready' ? content.repository : null;
  const [open, setOpen] = useState(initialQuery !== null);
  const [text, setTextState] = useState(initialQuery ?? '');
  const [query, setQuery] = useState(
    initialQuery && initialQuery.trim().length >= 2 ? initialQuery.trim() : '',
  );
  // The answer of the search of (edition, words); it is the answer only while those are still what was asked.
  const [found, setFound] = useState<Found | null>(null);
  const searchKey = repository && query !== '' ? `${editionId}\u0000${query}` : null;
  const answer = searchKey !== null && found?.key === searchKey ? found : null;
  const hits = answer?.hits ?? NO_HITS;
  const index = answer ? answer.index : -1;
  const searching = searchKey !== null && answer === null;
  // A search the reader asked for opens its first hit; the one that comes with a link (`?q=`) does not
  // move the page, the link already did.
  const fromReader = useRef(false);
  const latest = useRef({ onOpenHit, onQuery, sectionId, targetParagraphId });
  useEffect(() => {
    latest.current = { onOpenHit, onQuery, sectionId, targetParagraphId };
  });

  // The words are searched, the hits listed, the first one made current.
  useEffect(() => {
    if (!repository || searchKey === null) return undefined;
    let cancelled = false;
    void repository.searchEdition(editionId, query, { limit: MAX_FIND_HITS }).then((results) => {
      if (cancelled) return;
      const { targetParagraphId: target, sectionId: here } = latest.current;
      // The hit of the link, else the first one of the section on screen, else the first.
      const inLink = results.findIndex((hit) => hit.paragraphId === target);
      const start = Math.max(
        0,
        inLink >= 0 ? inLink : results.findIndex((hit) => hit.sectionId === here),
      );
      setFound({ key: searchKey, hits: results, index: results.length === 0 ? -1 : start });
      const first = results[start];
      if (first && fromReader.current) latest.current.onOpenHit(first, query);
      fromReader.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [repository, editionId, query, searchKey]);

  // A search starts by itself at three characters, 250 ms after the last key.
  useEffect(() => {
    const words = text.trim();
    if (!open || words.length < AUTO_FIND_MIN || words === query) return undefined;
    const timer = setTimeout(() => {
      fromReader.current = true;
      setQuery(words);
    }, FIND_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, open, query]);

  const setText = useCallback((value: string) => {
    setTextState(value);
    latest.current.onQuery(value);
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (hits.length === 0) return;
      const next = (index + delta + hits.length) % hits.length;
      setFound((previous) =>
        previous && previous.key === searchKey ? { ...previous, index: next } : previous,
      );
      const hit = hits[next];
      if (hit) latest.current.onOpenHit(hit, query);
    },
    [hits, index, query, searchKey],
  );

  const status: FindStatus = (() => {
    const words = text.trim();
    if (words === '') return { kind: 'prompt' };
    if (searching) return { kind: 'searching' };
    if (words !== query) {
      return words.length < AUTO_FIND_MIN ? { kind: 'enter', query: words } : { kind: 'searching' };
    }
    if (hits.length === 0) return { kind: 'none' };
    return {
      kind: 'hits',
      index: Math.max(0, index),
      total: hits.length,
      capped: hits.length >= MAX_FIND_HITS,
    };
  })();

  return {
    open,
    text,
    setText,
    query: open ? query : '',
    status,
    hitParagraphId: open && index >= 0 ? (hits[index]?.paragraphId ?? null) : null,
    openBar: () => {
      setOpen(true);
      latest.current.onQuery(text);
    },
    closeBar: () => {
      setOpen(false);
      latest.current.onQuery(null);
    },
    next: () => step(1),
    previous: () => step(-1),
    searchNow: () => {
      const words = text.trim();
      if (words.length < 2) return;
      fromReader.current = true;
      if (words === query) {
        // The same words again: step on instead.
        fromReader.current = false;
        step(1);
        return;
      }
      setQuery(words);
    },
  };
}
