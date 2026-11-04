import type { DependencyList } from 'react';

import { useContent } from '@/content/content-context';
import type { ContentRepository } from '@/content/repository';

import { useAsync } from './use-async';
import type { AsyncState } from './use-async';

/** Runs `query` against the verified repository once it is loaded. */
export function useRepositoryQuery<T>(
  query: (repository: ContentRepository) => Promise<T>,
  deps: DependencyList,
): AsyncState<T> {
  const content = useContent();
  const repository = content.status === 'ready' ? content.repository : null;
  const state = useAsync<T | undefined>(
    () => (repository ? query(repository) : new Promise<undefined>(() => undefined)),
    [repository, ...deps],
  );
  if (content.status === 'error') return { status: 'error' };
  if (!repository || state.status === 'loading') return { status: 'loading' };
  if (state.status === 'error') return { status: 'error' };
  return { status: 'ready', data: state.data as T };
}
