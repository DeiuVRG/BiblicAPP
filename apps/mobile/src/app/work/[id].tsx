import { useLocalSearchParams } from 'expo-router';

import { WorkScreen } from '@/features/work/work-screen';

export default function WorkRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkScreen workId={String(id ?? '')} />;
}
