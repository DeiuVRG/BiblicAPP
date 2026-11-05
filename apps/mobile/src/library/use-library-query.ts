import { useCallback } from 'react';

import { useUrlState } from '@/hooks/use-url-state';

import { libraryParams, parseLibraryQuery, updateQuery } from './model';
import type { LibraryQuery } from './model';

/**
 * The filters of "Toată biblioteca" (docs/ui-spec-v2.md, 4.4 and 6.2): read from the URL, changed
 * through `update` (any filter resets the letter and the page) and written back with
 * `replaceState`, defaults left out.
 */
export function useLibraryQuery(): [
  LibraryQuery,
  (patch: Partial<LibraryQuery>) => void,
  () => void,
] {
  const [query, setQuery] = useUrlState(parseLibraryQuery, libraryParams);
  const update = useCallback(
    (patch: Partial<LibraryQuery>) => setQuery((previous) => updateQuery(previous, patch)),
    [setQuery],
  );
  const clear = useCallback(
    () => setQuery((previous) => ({ ...parseLibraryQuery({}), view: previous.view })),
    [setQuery],
  );
  return [query, update, clear];
}
