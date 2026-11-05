import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

import type { Palette } from './palettes';

// Design tokens that are not colours (docs/ui-spec-v2.md, sections 2.4 to 2.6). Colours live in
// palettes.ts; breakpoints and containers in layout.ts; this file holds radii, spacing, borders,
// the focus ring, motion and elevation, so that a component never writes one of these numbers.

/** Corner radii: citation chips, cards and buttons, inputs, sheets, dialogs and composer, pills. */
export const radii = { xs: 2, sm: 3, md: 6, lg: 12, xl: 14, pill: 999 } as const;
export type RadiusName = keyof typeof radii;

/** The spacing scale; gutters stay 24 (below 768) and 40 (768 and up), see layout.ts. */
export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 88] as const;
export type Spacing = (typeof spacing)[number];

/** Width of a control outline and of a hairline control (a hairline on native). */
export const BORDER_WIDTH = 1;

/** The focus ring: 2 px, offset 2 (web outline; native outline on the focused control). */
export const FOCUS_RING = { width: 2, offset: 2 } as const;

/**
 * How far a focus ring reaches outside the control it rings: its width plus its offset (4). A
 * container that clips what overflows it (a scroller, a panel with rounded corners) leaves this
 * much room around the controls inside it, or the ring is cut off (docs/ui-spec-v2.md, check G7).
 */
export const FOCUS_RING_ROOM = FOCUS_RING.width + FOCUS_RING.offset;

/** Bar heights in points: brand bar, section bar, reader toolbar, thumb bar and the progress bar. */
export const BAR_HEIGHT = {
  brand: 64,
  brandPhone: 56,
  section: 48,
  sectionPhone: 44,
  readerToolbar: 67,
  readerToolbarPhone: 53,
  thumb: 61,
  progress: 3,
} as const;

/** Durations in milliseconds (2.6). */
export const duration = {
  /** Press feedback. */
  press: 140,
  base: 200,
  slow: 300,
} as const;

/** `cubic-bezier` control points (2.6): default, drawers and panels, entrances. */
export const easing = {
  default: [0.22, 1, 0.36, 1],
  panel: [0.32, 0.72, 0, 1],
  entrance: [0.23, 1, 0.32, 1],
} as const;
export type EasingName = keyof typeof easing;

/** An easing as the CSS timing function that web styles take. */
export function cssEasing(name: EasingName): string {
  return `cubic-bezier(${easing[name].join(',')})`;
}

/** The named animations of the spec; all of them are off under reduced motion (`useReducedMotion`). */
export const motion = {
  /** Scale of a pressed control on web (opacity 0.7 on native). */
  pressScale: 0.96,
  pressOpacity: 0.7,
  /** The outline button's fill sweeps from left to right on hover. */
  outlineSweep: 280,
  /** Section drawer and Tools drawer. */
  drawer: 300,
  /** The hero highlight bar: a delay, then a sweep, once. */
  heroSweepDelay: 250,
  heroSweep: 550,
  /** Pilcrow of the hero kicker, loading text shimmer: one loop each. */
  kickerPulse: 2400,
  shimmer: 2400,
  /** The paragraph a link jumped to fades in. */
  targetFade: 300,
  /** Ask progress dots. */
  askDots: 1400,
  /** The caret of a disclosure. */
  caret: 200,
  /** A toast stays on screen this long. */
  toast: 3000,
} as const;

/**
 * A CSS transition for web, nothing elsewhere or when motion is reduced. The three properties are
 * web-only: React Native's types do not know them, react-native-web passes them on.
 */
export function transition(
  properties: string,
  milliseconds: number,
  curve: EasingName = 'default',
  reduced = false,
): ViewStyle | undefined {
  if (Platform.OS !== 'web' || reduced) return undefined;
  return {
    transitionProperty: properties,
    transitionDuration: `${milliseconds}ms`,
    transitionTimingFunction: cssEasing(curve),
  } as ViewStyle;
}

/** Elevation kinds: cards only on hover, popovers, dialogs, the phone drawer panel. */
export type Elevation = 'card' | 'popover' | 'dialog' | 'drawer';

/** The `box-shadow` value of an elevation (web); offsets and blurs are numbers, colours are tokens. */
export function shadowFor(kind: Elevation, colors: Palette): string {
  switch (kind) {
    case 'card':
      return `0 1px 2px ${colors.shadowEdge}, 0 6px 20px ${colors.shadowSoft}`;
    case 'popover':
      return `0 10px 28px ${colors.shadowPopover}`;
    case 'dialog':
      return `0 24px 60px ${colors.shadowDialog}`;
    case 'drawer':
      return `0 14px 28px -18px ${colors.shadowDrawer}`;
  }
}

/**
 * Elevation as a style: a box shadow on web; on native a plain border does the work and only
 * popovers get `elevation: 2`.
 */
export function elevationStyle(kind: Elevation, colors: Palette): ViewStyle {
  if (Platform.OS === 'web') return { boxShadow: shadowFor(kind, colors) } as ViewStyle;
  return kind === 'popover' ? { elevation: 2 } : {};
}
