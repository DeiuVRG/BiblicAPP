import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { t } from '@/i18n';

export default function WorkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title={t.work.contents} description={`${t.work.title}: ${id}`} />;
}
