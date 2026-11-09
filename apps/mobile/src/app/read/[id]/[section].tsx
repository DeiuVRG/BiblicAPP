import { useLocalSearchParams } from 'expo-router';

import { ReaderScreen } from '@/features/reader/reader-screen';

type Params = { id: string; section: string; p?: string; q?: string; lang?: string; pair?: string };

/** `?pair=ro+en`: a raw plus in an address is read as a space; the two names are joined by a plus. */
export function normalizePair(value: string | undefined): string | undefined {
  return value ? value.trim().replace(/\s+/g, '+') : undefined;
}

export default function ReaderRoute() {
  const { id, section, p, q, lang, pair } = useLocalSearchParams<Params>();
  return (
    <ReaderScreen
      workId={String(id ?? '')}
      sectionId={String(section ?? '')}
      targetParagraphId={p ? String(p) : undefined}
      query={q ? String(q) : undefined}
      lang={lang ? String(lang).toLowerCase() : undefined}
      pair={normalizePair(pair ? String(pair) : undefined)}
    />
  );
}
