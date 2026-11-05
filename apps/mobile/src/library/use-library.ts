import { useMemo } from 'react';

import type { CatalogueState } from '@/catalogue/verify-catalogue';
import { useContent } from '@/content/content-context';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import type { AsyncState } from '@/hooks/use-async';
import { useSettings } from '@/settings/settings-context';

import { buildLibraryModel } from './model';
import type { LibraryModel } from './model';

export interface LibraryData {
  model: LibraryModel;
  /** Packs that could not be verified, at start or when their edition was first opened. */
  unverified: number;
  /** What came of the catalogue's one verification at start. */
  catalogue: CatalogueState['status'];
}

/**
 * The library as every screen sees it: the installed works joined with the verified catalogue, in
 * the reading language. A catalogue that was not verified is not read at all: the works list under
 * "Altele", without blurbs and without a count that comes from it.
 */
export function useLibrary(): AsyncState<LibraryData> {
  const { settings } = useSettings();
  const content = useContent();
  const language = settings.readingLanguage;
  const works = useRepositoryQuery(
    async (repository) => ({
      works: await repository.listWorks(language),
      refused: repository.refusedPacks().length,
    }),
    [language],
  );
  const catalogueState = content.status === 'ready' ? content.catalogue : null;
  const catalogue = catalogueState?.status === 'verified' ? catalogueState.catalogue : null;
  const data = works.status === 'ready' ? works.data : null;
  const model = useMemo(
    () => (data ? buildLibraryModel(data.works, catalogue, language) : null),
    [data, catalogue, language],
  );
  if (works.status === 'error') return { status: 'error' };
  if (!data || !model) return { status: 'loading' };
  return {
    status: 'ready',
    data: {
      model,
      unverified: (content.status === 'ready' ? content.rejected.length : 0) + data.refused,
      catalogue: catalogueState?.status ?? 'missing',
    },
  };
}
