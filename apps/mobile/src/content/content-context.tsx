import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { getRepository } from './repository';
import type { ContentRepository, LoadedRepository, RejectedPack } from './repository';

export type ContentState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; repository: ContentRepository; rejected: readonly RejectedPack[] };

const ContentContext = createContext<ContentState>({ status: 'loading' });

interface ProviderProps {
  /** Injectable for tests; defaults to the verified bundled repository. */
  loader?: () => Promise<LoadedRepository>;
  children: ReactNode;
}

/** Loads the verified content repository once. Unverified packs never reach the UI. */
export function ContentProvider({ loader = getRepository, children }: ProviderProps) {
  const [state, setState] = useState<ContentState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loader().then(
      (loaded) => {
        if (!cancelled) setState({ status: 'ready', repository: loaded.repository, rejected: loaded.rejected });
      },
      () => {
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loader]);

  return <ContentContext.Provider value={state}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentState {
  return useContext(ContentContext);
}
