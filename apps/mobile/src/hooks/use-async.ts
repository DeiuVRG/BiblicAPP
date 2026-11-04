import { useEffect, useState } from 'react';
import type { DependencyList } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

interface Entry<T> {
  deps: DependencyList;
  state: AsyncState<T>;
}

function sameDeps(a: DependencyList, b: DependencyList): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/**
 * Runs an async loader whenever `deps` change. Results of superseded runs are ignored, and a
 * result computed for older deps is never reported as current (it reads as 'loading').
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [entry, setEntry] = useState<Entry<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setEntry({ deps, state: { status: 'ready', data } });
      },
      () => {
        if (!cancelled) setEntry({ deps, state: { status: 'error' } });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return entry && sameDeps(entry.deps, deps) ? entry.state : { status: 'loading' };
}
