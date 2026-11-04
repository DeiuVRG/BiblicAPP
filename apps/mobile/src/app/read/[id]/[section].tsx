import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { t } from '@/i18n';

export default function ReaderScreen() {
  const { id, section } = useLocalSearchParams<{ id: string; section: string }>();
  return (
    <PlaceholderScreen title={t.reader.title} description={`${t.work.title}: ${id} / ${section}`} />
  );
}
