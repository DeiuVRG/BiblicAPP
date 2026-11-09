import { useCallback, useEffect, useState } from 'react';

import { useStorage } from '@/storage/key-value-store';

import { addBookmark, isBookmarked, loadBookmarks, removeBookmark } from './bookmarks-store';
import type { WorkBookmark } from './bookmarks-store';

/**
 * The bookmark of one work, read from the local store and toggled (docs/ui-spec-v2.md, 8.10): the work
 * page and the Tools of the reader share it. `bookmarked` is false until the store has answered.
 */
export function useWorkBookmark(workId: string): {
  bookmarked: boolean;
  toggle(editionId: string): void;
} {
  const store = useStorage();
  const [list, setList] = useState<readonly WorkBookmark[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadBookmarks(store).then((loaded) => {
      if (!cancelled) setList(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const bookmarked = isBookmarked(list, workId);
  const toggle = useCallback(
    (editionId: string) => {
      // Optimistic: the mark changes at once and the store catches up.
      const next = bookmarked
        ? list.filter((bookmark) => bookmark.workId !== workId)
        : [{ workId, editionId, addedAt: Date.now() }, ...list];
      setList(next);
      void (bookmarked ? removeBookmark(store, workId) : addBookmark(store, workId, editionId));
    },
    [bookmarked, list, store, workId],
  );
  return { bookmarked, toggle };
}
