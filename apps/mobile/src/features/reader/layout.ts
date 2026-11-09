import { DESKTOP_MIN, READER_SHELL_MAX } from '@/theme/layout';

// The three forms of the reader by window width (docs/ui-spec-v2.md, 8.1): the desktop with the outline in
// the flow (1100 and up), the tablet with an outline that overlays the text (881 to 1099) and the
// phone shell (880 and below: a toolbar with the title only, a bottom bar, the outline as a drawer).

export type ReaderMode = 'desktop' | 'tablet' | 'phone';

export function readerMode(width: number): ReaderMode {
  if (width <= READER_SHELL_MAX) return 'phone';
  return width >= DESKTOP_MIN ? 'desktop' : 'tablet';
}

/** The outline panel: 300 in the flow, 220 as an overlay. */
export const OUTLINE_WIDTH = 300;
export const OUTLINE_OVERLAY_WIDTH = 220;

/** The toolbar: 67 on a desktop, 65 on a tablet, 53 on a phone, and 75 when its controls are 44 high. */
export function toolbarHeight(mode: ReaderMode, coarse: boolean): number {
  if (mode === 'phone') return 53;
  if (coarse) return 75;
  return mode === 'desktop' ? 67 : 65;
}

/** The height of a toolbar control: 36 with a fine pointer, 44 with a finger. */
export const controlHeight = (coarse: boolean): number => (coarse ? 44 : 36);

/** Two lanes sit side by side only when the text area is this wide; below it they stack. */
export const LANES_MIN_AREA = 900;

/** The find bar: 850 wide over the column on a wide screen. */
export const FIND_BAR_WIDTH = 850;

/** Side padding of the text: 54 on a wide screen, 12 on a phone (top 41.6 and 16; bottom 64 and 85). */
export function textPadding(mode: ReaderMode): { top: number; side: number; bottom: number } {
  return mode === 'phone' ? { top: 16, side: 12, bottom: 85 } : { top: 41.6, side: 54, bottom: 64 };
}
