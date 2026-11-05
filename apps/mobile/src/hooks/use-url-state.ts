import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/** The query string of some parameters, values percent-encoded (a space is %20, never "+"). */
export function queryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/**
 * Web only: writes the query string of the current page without making a history entry (the state
 * of a filter panel is not a place to come back to with the Back button: docs/ui-spec-v2.md, 4.4,
 * "written with `replaceState`"). Path and hash stay as they are, so a deployment under a base path
 * keeps working. Nothing happens on iOS and Android, where the state lives in the screen.
 */
export function replaceUrlParams(params: Record<string, string>): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const search = queryString(params);
    const { pathname, hash } = window.location;
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${search ? `?${search}` : ''}${hash}`,
    );
  } catch {
    // A sandboxed frame may refuse (and a test renderer has no location); the state in the screen
    // is still right.
  }
}

type Params = Record<string, string | string[] | undefined>;

/**
 * State of a screen that lives in its URL: read from the route's params when the screen opens (a
 * link, a reload, the Back button), kept in the screen while the reader changes it, and mirrored
 * into the address with `replaceState`, defaults left out. A change of the route's own params (a link
 * to the same page with other values) replaces the state.
 */
export function useUrlState<T>(
  parse: (params: Params) => T,
  serialize: (value: T) => Record<string, string>,
): [T, (next: T | ((previous: T) => T)) => void] {
  const params = useLocalSearchParams() as Params;
  const [state, setState] = useState<T>(() => parse(params));
  const fromRoute = JSON.stringify(serialize(parse(params)));
  const written = useRef(fromRoute);

  // The route's params changed from outside: they win over what the screen holds.
  useEffect(() => {
    if (fromRoute === written.current) return;
    written.current = fromRoute;
    setState(parse(params));
    // `parse` and `params` are what `fromRoute` was made of.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromRoute]);

  // What the screen holds goes into the address.
  const key = JSON.stringify(serialize(state));
  useEffect(() => {
    written.current = key;
    replaceUrlParams(serialize(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback((next: T | ((previous: T) => T)) => setState(next), []);
  return [state, set];
}
