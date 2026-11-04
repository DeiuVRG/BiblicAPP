import { useLocalSearchParams } from 'expo-router';

import { WorkScreen } from '@/features/work/work-screen';

type Params = { id: string; edition?: string };

export default function WorkRoute() {
  const { id, edition } = useLocalSearchParams<Params>();
  // `?edition=<editionId>` selects an edition; the page falls back to the primary one.
  return <WorkScreen workId={String(id ?? '')} editionId={edition ? String(edition) : undefined} />;
}
