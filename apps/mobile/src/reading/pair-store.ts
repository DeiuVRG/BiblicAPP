import { isReaderPair } from '@/settings/sanitize';
import type { KeyValueStore } from '@/storage/key-value-store';

// The pair of editions a work is read in side by side, remembered per work (docs/ui-spec-v2.md, 8.5):
// "ro+en", "ro+orig". The default for works that have none is `settings.readerPair`.

const PREFIX = 'biblioteca:pair:v1:';
export const pairKey = (workId: string) => `${PREFIX}${workId}`;

/** The pair remembered for the work, or null. Never throws. */
export async function loadPair(store: KeyValueStore, workId: string): Promise<string | null> {
  try {
    const raw = await store.getItem(pairKey(workId));
    return isReaderPair(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function savePair(store: KeyValueStore, workId: string, pair: string): Promise<void> {
  if (!isReaderPair(pair)) return;
  try {
    await store.setItem(pairKey(workId), pair);
  } catch {
    // Best effort.
  }
}
