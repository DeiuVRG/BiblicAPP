import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import type { RefObject } from 'react';

import { setSlashTarget } from './slash-target';

/**
 * Makes the shortcut `/` focus this field while the screen it is on is in focus (docs/ui-spec-v2.md,
 * 6.5 and 10): the brand bar asks which field has the key before it opens the search page. Every
 * screen with a search field of its own (the library, Selecție, the authors, Search) calls it.
 */
export function useSlashTarget(field: RefObject<{ focus(): void } | null>): void {
  useFocusEffect(
    useCallback(() => {
      setSlashTarget({ focus: () => field.current?.focus() });
      return () => setSlashTarget(null);
    }, [field]),
  );
}
