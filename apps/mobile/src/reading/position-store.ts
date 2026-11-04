import type { KeyValueStore } from '@/storage/key-value-store';

export interface ReadingPosition {
  sectionId: string;
  /** First paragraph visible when the position was saved; null at the top of a section. */
  paragraphId: string | null;
  updatedAt: number;
}

/**
 * Positions are kept per edition: a place in the Romanian text means nothing in the English one.
 * (Before editions existed they were kept per work, under `LEGACY_PREFIX`.)
 */
const PREFIX = 'biblioteca:position:v2:';
const LEGACY_PREFIX = 'biblioteca:position:v1:';

export const positionKey = (editionId: string) => `${PREFIX}${editionId}`;
export const legacyPositionKey = (workId: string) => `${LEGACY_PREFIX}${workId}`;

function parsePosition(raw: unknown): ReadingPosition | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.sectionId !== 'string' || value.sectionId.length === 0) return null;
  const paragraphId = typeof value.paragraphId === 'string' ? value.paragraphId : null;
  const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : 0;
  return { sectionId: value.sectionId, paragraphId, updatedAt };
}

async function readPosition(store: KeyValueStore, key: string): Promise<ReadingPosition | null> {
  try {
    const raw = await store.getItem(key);
    return raw ? parsePosition(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * The saved position in an edition. Never throws; returns null when nothing valid is stored.
 *
 * Migration without data loss: pass `legacyWorkId` for the source edition of a work, and when the
 * edition has no position of its own yet, the position saved under the work id by an older version
 * (the only edition there was, the source) is used. It is a fallback for as long as the edition has
 * no entry: the first position saved for the edition (opening a section saves one) replaces it,
 * and a translation never falls back to it, because that place is in another text.
 */
export async function loadPosition(
  store: KeyValueStore,
  editionId: string,
  legacyWorkId?: string,
): Promise<ReadingPosition | null> {
  const own = await readPosition(store, positionKey(editionId));
  if (own || legacyWorkId === undefined) return own;
  return readPosition(store, legacyPositionKey(legacyWorkId));
}

export async function savePosition(
  store: KeyValueStore,
  editionId: string,
  position: Omit<ReadingPosition, 'updatedAt'>,
): Promise<void> {
  try {
    await store.setItem(
      positionKey(editionId),
      JSON.stringify({ ...position, updatedAt: Date.now() }),
    );
  } catch {
    // Best effort.
  }
}
