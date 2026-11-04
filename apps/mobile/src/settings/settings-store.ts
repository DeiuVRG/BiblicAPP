import type { KeyValueStore } from '@/storage/key-value-store';

import { sanitizeSettings } from './sanitize';
import { DEFAULT_SETTINGS } from './types';
import type { ReaderSettings } from './types';

export const SETTINGS_KEY = 'biblioteca:settings:v1';

/** Never throws: storage can be unavailable (private mode) or hold corrupt data. */
export async function loadSettings(store: KeyValueStore): Promise<ReaderSettings> {
  try {
    const raw = await store.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(store: KeyValueStore, settings: ReaderSettings): Promise<void> {
  try {
    await store.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Persistence is best effort; the in-memory value stays in effect.
  }
}
