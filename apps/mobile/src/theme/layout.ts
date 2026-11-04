import { useWindowDimensions } from 'react-native';
import type { ViewStyle } from 'react-native';

// Breakpoints in window widths (docs/ui-spec-v2.md, section 2.4). Phone and "wide" are the two type
// scales; the others switch a component from one form to another.

/** Up to this width the phone rules apply: section drawers drop as panels, grids are one column. */
export const PHONE_MAX = 640;
/** Up to this width previews become bottom sheets (and popovers are never used). */
export const SHEET_MAX = 700;
/** From this window width on, the wide layout applies (web, tablets). */
export const WIDE_BREAKPOINT = 768;
/** Up to this width the reader uses its phone shell (thumb bar, contents full width). */
export const READER_SHELL_MAX = 880;
/** From this width the outline is in flow and Ask can be docked. */
export const DESKTOP_MIN = 1100;
/** From this width the reading cap grows. */
export const XL_MIN = 1200;

/**
 * Width of the content (gutters excluded) of each kind of column: `wide` for the landing, the
 * library and the work hub, `tool` for filter panels, `list` for lists, `narrow` for About and
 * Transparency, `reading` for the single-lane reader (the legacy reader still uses this fixed
 * width; `readingMeasure` is the 37 em rule), `twoLane` for two aligned lanes and `ask` for the
 * chat measure.
 */
export const COLUMN_WIDTH = {
  wide: 1124,
  tool: 1180,
  list: 880,
  narrow: 664,
  reading: 680,
  twoLane: 1440,
  ask: 760,
} as const;
export type ColumnKind = keyof typeof COLUMN_WIDTH;

export const GUTTER_NARROW = 24;
export const GUTTER_WIDE = 40;

/**
 * Longest line of a secondary paragraph (licence notes, captions) on wide screens: about 90
 * characters of the 13 px caption face, the top of a comfortable measure. Wider columns hold lists
 * and metadata, not running text.
 */
export const PROSE_MAX_WIDTH = 600;

/** The reading measure is 37 em of the reader's font size, never wider than this. */
export const READING_MEASURE_EM = 37;
export const READING_MEASURE_CAP = 960;

/** Width in points of a reading line for a font size: it widens with the text, up to the cap. */
export function readingMeasure(fontSize: number): number {
  return Math.min(READING_MEASURE_CAP, Math.round(READING_MEASURE_EM * fontSize));
}

export interface LayoutMetrics {
  width: number;
  wide: boolean;
  /** Horizontal space between the window edge (or the column edge) and the content. */
  gutter: number;
}

export function layoutFor(width: number): LayoutMetrics {
  const wide = width >= WIDE_BREAKPOINT;
  return { width, wide, gutter: wide ? GUTTER_WIDE : GUTTER_NARROW };
}

/** Re-renders when the window is resized (web) or rotated. */
export function useLayout(): LayoutMetrics {
  return layoutFor(useWindowDimensions().width);
}

/** Vertical padding of a band: 88 on wide screens, 56 on a phone. */
export function bandPadding(wide: boolean): number {
  return wide ? 88 : 56;
}

export type HeroKind = 'landing' | 'page' | 'library';

/**
 * Top and bottom padding of a hero: 128/120 on the landing, 92/84 on inner pages, 56/40 on the
 * library hero; a phone has 68/60 on the landing and 56/52 on inner pages.
 */
export function heroPadding(kind: HeroKind, wide: boolean): { top: number; bottom: number } {
  switch (kind) {
    case 'landing':
      return wide ? { top: 128, bottom: 120 } : { top: 68, bottom: 60 };
    case 'page':
      return wide ? { top: 92, bottom: 84 } : { top: 56, bottom: 52 };
    case 'library':
      return { top: 56, bottom: 40 };
  }
}

/**
 * Style of a centred column: full width on phones, at most the column width (plus the gutters)
 * on wide screens. Used as a View style or as a list's `contentContainerStyle`, so that the
 * scrollbar stays at the window edge.
 */
export function columnStyle(kind: ColumnKind, layout: LayoutMetrics): ViewStyle {
  return {
    width: '100%',
    maxWidth: COLUMN_WIDTH[kind] + layout.gutter * 2,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
  };
}

/**
 * Horizontal padding that lines the content of a full-width bar (navigation header, bottom bar)
 * up with the edges of the column below it.
 */
export function barInset(kind: ColumnKind, layout: LayoutMetrics): number {
  return Math.max(layout.gutter, Math.round((layout.width - COLUMN_WIDTH[kind]) / 2));
}

export function useColumnStyle(kind: ColumnKind): ViewStyle {
  return columnStyle(kind, useLayout());
}
