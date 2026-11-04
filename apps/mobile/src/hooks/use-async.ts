import { useEffect, useState } from 'react';
import type { DependencyList } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: T };

/** Runs an async loader whenever `deps` change; ignores results of superseded runs. */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    load().then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data });
      },
      () => {
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
