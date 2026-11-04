import type { KeyValueStore } from '@/storage/key-value-store';

export interface ReadingPosition {
  sectionId: string;
  /** First paragraph visible when the position was saved; null at the top of a section. */
  paragraphId: string | null;
  updatedAt: number;
}

const keyFor = (workId: string) => `biblioteca:position:v1:${workId}`;

function parsePosition(raw: unknown): ReadingPosition | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.sectionId !== 'string' || value.sectionId.length === 0) return null;
  const paragraphId = typeof value.paragraphId === 'string' ? value.paragraphId : null;
  const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : 0;
  return { sectionId: value.sectionId, paragraphId, updatedAt };
}

/** Never throws; returns null when nothing valid is stored. */
export async function loadPosition(
  store: KeyValueStore,
  workId: string,
): Promise<ReadingPosition | null> {
  try {
    const raw = await store.getItem(keyFor(workId));
    return raw ? parsePosition(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function savePosition(
  store: KeyValueStore,
  workId: string,
  position: Omit<ReadingPosition, 'updatedAt'>,
): Promise<void> {
  try {
    await store.setItem(keyFor(workId), JSON.stringify({ ...position, updatedAt: Date.now() }));
  } catch {
    // Best effort.
  }
}
