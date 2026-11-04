import { useLocalSearchParams } from 'expo-router';

import { ReaderScreen } from '@/features/reader/reader-screen';

type Params = { id: string; section: string; p?: string; q?: string };

export default function ReaderRoute() {
  const { id, section, p, q } = useLocalSearchParams<Params>();
  return (
    <ReaderScreen
      workId={String(id ?? '')}
      sectionId={String(section ?? '')}
      targetParagraphId={p ? String(p) : undefined}
      query={q ? String(q) : undefined}
    />
  );
}
