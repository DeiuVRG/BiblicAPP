import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

/** The hash of the address ("#contents" gives "contents"), or an empty string; web only. */
function readHash(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  try {
    return window.location.hash.replace(/^#/, '');
  } catch {
    return '';
  }
}

/** Writes the hash of the address without making a history entry (a tab is not a place to come back to). */
function writeHash(hash: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${search}#${hash}`);
  } catch {
    // A sandboxed frame may refuse; the tab in the screen is still right.
  }
}

/**
 * The tab a page shows, kept in the hash of its address (`#overview`, `#contents`: docs/ui-spec-v2.md, 7)
 * on web, so that a link can name a tab. The hash wins when it names one of `keys`; otherwise it is
 * `fallback`. A tab that is not there (a work without a blurb has no overview) falls back too.
 */
export function useHashTab<T extends string>(
  keys: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const [chosen, setChosen] = useState<string>(() => readHash());
  const tab = (keys as readonly string[]).includes(chosen) ? (chosen as T) : fallback;
  const choose = useCallback((next: T) => {
    setChosen(next);
    writeHash(next);
  }, []);
  return [tab, choose];
}
