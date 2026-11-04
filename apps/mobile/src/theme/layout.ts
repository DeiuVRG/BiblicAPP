import { useWindowDimensions } from 'react-native';
import type { ViewStyle } from 'react-native';

/** From this window width on, the wide layout applies (web, tablets). */
export const WIDE_BREAKPOINT = 768;

/** Width of the content (gutters excluded) of the two kinds of column. */
export const COLUMN_WIDTH = { list: 880, reading: 680 } as const;
export type ColumnKind = keyof typeof COLUMN_WIDTH;

export const GUTTER_NARROW = 24;
export const GUTTER_WIDE = 40;

/**
 * Longest line of a secondary paragraph (licence notes, captions) on wide screens: about 90
 * characters of the 13 px caption face, the top of a comfortable measure. Wider columns hold lists
 * and metadata, not running text.
 */
export const PROSE_MAX_WIDTH = 600;

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
