type Restore = (() => void) & {
  /** Changes the answer of a query and tells the listeners of that query, as a browser does. */
  change(query: string, matches: boolean): void;
};

/**
 * Stands in for `window.matchMedia` (there is none under Jest): each query answers with the value
 * in `answers`, and false when it is not listed. Returns the function that puts things back (call
 * it in `finally` or `afterEach`), which also has `change(query, matches)` to flip an answer while
 * the test runs.
 */
export function stubMatchMedia(answers: Record<string, boolean>): Restore {
  const target = window as unknown as { matchMedia?: unknown };
  const previous = target.matchMedia;
  const state = { ...answers };
  const listeners = new Map<string, Set<() => void>>();
  target.matchMedia = (query: string) => ({
    get matches() {
      return state[query] ?? false;
    },
    media: query,
    addEventListener: (type: string, listener: () => void) => {
      if (type !== 'change') return;
      listeners.set(query, (listeners.get(query) ?? new Set()).add(listener));
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'change') listeners.get(query)?.delete(listener);
    },
  });
  const restore = (() => {
    if (previous === undefined) delete target.matchMedia;
    else target.matchMedia = previous;
  }) as Restore;
  restore.change = (query, matches) => {
    state[query] = matches;
    listeners.get(query)?.forEach((listener) => listener());
  };
  return restore;
}
