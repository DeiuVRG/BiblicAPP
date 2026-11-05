import { loadAsync, useFonts } from 'expo-font';
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';

import { fallbackFonts, fontFamiliesFor, hasPolytonicGreek, needsGreekFace } from './font-families';
import type { FontFamilies } from './font-families';
import { FIRST_PAINT_FONTS, FONT_GROUPS } from './font-sources';
import type { FontGroup } from './font-sources';

export {
  READING_FONTS,
  fallbackFonts,
  fontFamiliesFor,
  groupForReadingFont,
  hasPolytonicGreek,
  loadedFonts,
  needsGreekFace,
  readingFaces,
  splitGreekRuns,
} from './font-families';
export type { FontFamilies, FontState, GreekRun, ReadingFaces, ReadingFont } from './font-families';
export type { FontGroup } from './font-sources';

// --- on-demand loading -------------------------------------------------------------------------

// The groups that finished loading, as an immutable snapshot that is replaced when a group arrives
// (`useSyncExternalStore` compares snapshots by reference).
let loadedGroups: ReadonlySet<FontGroup> = new Set();
const pending = new Map<FontGroup, Promise<boolean>>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The signature of `expo-font`'s `loadAsync` for a map of fonts; the tests pass their own. */
export type FontLoader = (fonts: Record<string, unknown>) => Promise<void>;

/**
 * Loads a group of fonts (once: later calls get the same promise). Resolves to true when the
 * group is loaded and to false when loading failed; it never rejects, and a failed group can be
 * asked for again. `loader` is a test seam.
 */
export function loadFontGroup(
  group: FontGroup,
  loader: FontLoader = loadAsync as FontLoader,
): Promise<boolean> {
  if (loadedGroups.has(group)) return Promise.resolve(true);
  const existing = pending.get(group);
  if (existing) return existing;
  const promise = Promise.resolve()
    .then(() => loader(FONT_GROUPS[group]))
    .then(
      () => {
        loadedGroups = new Set([...loadedGroups, group]);
        pending.delete(group);
        listeners.forEach((listener) => listener());
        return true;
      },
      () => {
        pending.delete(group);
        return false;
      },
    );
  pending.set(group, promise);
  return promise;
}

/** Forgets what was loaded (tests only). */
export function resetFontGroups(): void {
  loadedGroups = new Set();
  pending.clear();
  listeners.forEach((listener) => listener());
}

/** The on-demand groups that are loaded now; re-renders when one arrives. */
export function useLoadedFontGroups(): ReadonlySet<FontGroup> {
  return useSyncExternalStore(
    subscribe,
    () => loadedGroups,
    () => loadedGroups,
  );
}

/** Asks for a group when `group` is not null (and every time it changes). */
export function useFontGroup(group: FontGroup | null): void {
  useEffect(() => {
    if (group) void loadFontGroup(group);
  }, [group]);
}

// --- the app ----------------------------------------------------------------------------------

/**
 * Loads the first-paint set. `ready` is true once loading finished (successfully or not): the
 * splash screen (native) and the blank page (web, the HTML template paints the background) are
 * held until then, and nothing else is awaited. `families` follows the on-demand groups too.
 */
export function useAppFonts(): { ready: boolean; families: FontFamilies } {
  const [loaded, error] = useFonts(FIRST_PAINT_FONTS);
  const groups = useLoadedFontGroups();
  return {
    ready: loaded || error != null,
    families: fontFamiliesFor({ firstPaint: loaded, groups }),
  };
}

const FontsContext = createContext<FontFamilies>(fallbackFonts);
export const FontsProvider = FontsContext.Provider;

export function useFontFamilies(): FontFamilies {
  return useContext(FontsContext);
}

/**
 * Loads the font group of the Greek face when a text needs it, and returns the faces: for a lane
 * whose edition language is ancient Greek, or for any text that has Greek Extended letters (which
 * Source Serif 4 lacks) whatever its language. `null` when neither applies. (docs/ui-spec-v2.md,
 * section 2.2.)
 */
export function useGreekFace(
  language: string | undefined,
  text?: string,
): FontFamilies['greek'] | null {
  const needed = needsGreekFace(language) || (text !== undefined && hasPolytonicGreek(text));
  useFontGroup(needed ? 'gentium' : null);
  const fonts = useFontFamilies();
  return needed ? fonts.greek : null;
}

/** A stable callback that loads a group: for event handlers (choosing a font in Settings). */
export function useFontGroupLoader(): (group: FontGroup) => Promise<boolean> {
  return useCallback((group: FontGroup) => loadFontGroup(group), []);
}
