import type { KeyValueStore } from '@/storage/key-value-store';

// The bookmarks of works (docs/ui-spec-v2.md, 8.10): a reader marks a work from the work page or from
// the Tools of the reader, and `/bookmarks` lists them. Local only (synced with the account in P2):
// `{ workId, editionId, addedAt }` in the key-value store, one list under one key, newest first.

export interface WorkBookmark {
  workId: string;
  /** The edition the reader was in when it was marked. */
  editionId: string;
  /** Milliseconds since the epoch. */
  addedAt: number;
}

export const BOOKMARKS_KEY = 'biblioteca:bookmarks:v1';
/** The list is capped: a runaway loop cannot fill the storage. */
export const MAX_BOOKMARKS = 500;

function parseBookmarks(raw: unknown): WorkBookmark[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const list: WorkBookmark[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const value = item as Record<string, unknown>;
    if (typeof value.workId !== 'string' || value.workId === '' || seen.has(value.workId)) continue;
    if (typeof value.editionId !== 'string') continue;
    seen.add(value.workId);
    list.push({
      workId: value.workId,
      editionId: value.editionId,
      addedAt:
        typeof value.addedAt === 'number' && Number.isFinite(value.addedAt) ? value.addedAt : 0,
    });
  }
  return list.sort((a, b) => b.addedAt - a.addedAt).slice(0, MAX_BOOKMARKS);
}

/** The bookmarks, newest first. Never throws: unreadable or corrupt data is an empty list. */
export async function loadBookmarks(store: KeyValueStore): Promise<WorkBookmark[]> {
  try {
    const raw = await store.getItem(BOOKMARKS_KEY);
    return raw ? parseBookmarks(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

async function saveBookmarks(store: KeyValueStore, list: readonly WorkBookmark[]): Promise<void> {
  try {
    await store.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  } catch {
    // Best effort, like every local state.
  }
}

/** Bookmarks the work (or moves its bookmark to this edition and to the top); returns the new list. */
export async function addBookmark(
  store: KeyValueStore,
  workId: string,
  editionId: string,
  now: number = Date.now(),
): Promise<WorkBookmark[]> {
  const rest = (await loadBookmarks(store)).filter((bookmark) => bookmark.workId !== workId);
  const list = [{ workId, editionId, addedAt: now }, ...rest].slice(0, MAX_BOOKMARKS);
  await saveBookmarks(store, list);
  return list;
}

/** Takes the bookmark of the work away (no error if there is none); returns the new list. */
export async function removeBookmark(
  store: KeyValueStore,
  workId: string,
): Promise<WorkBookmark[]> {
  const list = (await loadBookmarks(store)).filter((bookmark) => bookmark.workId !== workId);
  await saveBookmarks(store, list);
  return list;
}

export const isBookmarked = (list: readonly WorkBookmark[], workId: string): boolean =>
  list.some((bookmark) => bookmark.workId === workId);
