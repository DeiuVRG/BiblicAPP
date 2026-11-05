import { Circle, Path, Rect, Svg } from 'react-native-svg';
import type { ReactNode } from 'react';

import { toneColor } from '@/components/app-text';
import { useBandTone } from '@/components/band-context';
import { useTheme } from '@/theme/theme-context';

// The icons of the app (docs/ui-spec-v2.md, section 2.7): 1.5 px strokes on a 20 px grid, round
// caps and joins, drawn with react-native-svg. Typographic glyphs are used wherever the bundled
// fonts have them (‹ › × ← → ↑ ↓ § ¶, "Aa"); the glyphs ☰ ⌕ ⇄ ⚑ are in no bundled font, so they are
// icons here. No decorative illustration anywhere.

/** The grid the paths are drawn on. */
export const ICON_GRID = 20;
/** The stroke width on that grid. */
export const ICON_STROKE = 1.5;

export const ICON_NAMES = [
  'menu',
  'close',
  'chevronUp',
  'chevronDown',
  'chevronLeft',
  'chevronRight',
  'search',
  'link',
  'copy',
  'bookmark',
  'bookmarkFilled',
  'flag',
  'lanes',
  'themeAuto',
  'themeLight',
  'themeSepia',
  'themeDark',
  'send',
  'stop',
  'external',
  'check',
  'info',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/** The shapes of an icon; `filled` shapes take the colour as fill as well as stroke. */
function shapes(name: IconName, color: string): ReactNode {
  switch (name) {
    case 'menu':
      return <Path d="M3 5.5h14M3 10h14M3 14.5h14" />;
    case 'close':
      return <Path d="M5 5l10 10M15 5L5 15" />;
    case 'chevronUp':
      return <Path d="M4.5 12.5L10 7l5.5 5.5" />;
    case 'chevronDown':
      return <Path d="M4.5 7.5L10 13l5.5-5.5" />;
    case 'chevronLeft':
      return <Path d="M12.5 4.5L7 10l5.5 5.5" />;
    case 'chevronRight':
      return <Path d="M7.5 4.5L13 10l-5.5 5.5" />;
    case 'search':
      return (
        <>
          <Circle cx={8.5} cy={8.5} r={5.5} />
          <Path d="M12.6 12.6L17 17" />
        </>
      );
    case 'link':
      return (
        <>
          <Path d="M8.6 11.4a3.2 3.2 0 0 0 4.5 0l2.6-2.6a3.2 3.2 0 0 0-4.5-4.5l-.9.9" />
          <Path d="M11.4 8.6a3.2 3.2 0 0 0-4.5 0l-2.6 2.6a3.2 3.2 0 0 0 4.5 4.5l.9-.9" />
        </>
      );
    case 'copy':
      return (
        <>
          <Rect x={7} y={7} width={9} height={9} rx={1.5} />
          <Path d="M4 13V5.5A1.5 1.5 0 0 1 5.5 4H13" />
        </>
      );
    case 'bookmark':
      return <Path d="M5.5 3.5h9a1 1 0 0 1 1 1V17L10 13.2 4.5 17V4.5a1 1 0 0 1 1-1z" />;
    case 'bookmarkFilled':
      return (
        <Path d="M5.5 3.5h9a1 1 0 0 1 1 1V17L10 13.2 4.5 17V4.5a1 1 0 0 1 1-1z" fill={color} />
      );
    case 'flag':
      return <Path d="M5 17V3.5M5 4.2h9.5l-2 3.4 2 3.4H5" />;
    case 'lanes':
      return (
        <>
          <Rect x={3} y={4} width={6} height={12} rx={1} />
          <Rect x={11} y={4} width={6} height={12} rx={1} />
        </>
      );
    case 'themeAuto':
      return (
        <>
          <Circle cx={10} cy={10} r={6.5} />
          <Path d="M10 3.5a6.5 6.5 0 0 0 0 13z" fill={color} />
        </>
      );
    case 'themeLight':
      return (
        <>
          <Circle cx={10} cy={10} r={3} />
          <Path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" />
        </>
      );
    case 'themeSepia':
      // The sun of the light theme, with a filled disc: the warm page.
      return (
        <>
          <Circle cx={10} cy={10} r={3} fill={color} />
          <Path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" />
        </>
      );
    case 'themeDark':
      return <Path d="M16 11.6A6.5 6.5 0 1 1 8.4 4a5.2 5.2 0 0 0 7.6 7.6z" />;
    case 'send':
      return <Path d="M10 16V4M5 9l5-5 5 5" />;
    case 'stop':
      return <Rect x={5} y={5} width={10} height={10} rx={1.5} fill={color} />;
    case 'external':
      return (
        <Path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16h9a1.5 1.5 0 0 0 1.5-1.5V12M11.5 4H16v4.5M16 4l-7 7" />
      );
    case 'check':
      return <Path d="M4.5 10.5l3.5 3.5 7.5-8" />;
    case 'info':
      return (
        <>
          <Circle cx={10} cy={10} r={7} />
          <Path d="M10 9.2v4.6M10 6.4v.1" />
        </>
      );
  }
}

interface Props {
  name: IconName;
  /** Size in points (the 20 point grid is scaled to it); 20 by default. */
  size?: number;
  /** Defaults to the text colour of the band the icon sits in. */
  color?: string;
  /**
   * The accessible name. An icon is decoration (hidden from assistive technology) unless it has
   * one; an icon-only control names itself (`IconButton` requires it).
   */
  label?: string;
  testID?: string;
}

/** An icon of the set above. */
export function Icon({ name, size = ICON_GRID, color, label, testID }: Props) {
  const { colors } = useTheme();
  const band = useBandTone();
  const ink = color ?? toneColor(colors, 'text', band);
  const hidden = label === undefined;
  return (
    <Svg
      testID={testID ?? `icon-${name}`}
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_GRID} ${ICON_GRID}`}
      fill="none"
      stroke={ink}
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityRole={hidden ? undefined : 'image'}
      accessibilityLabel={label}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'yes'}
      aria-hidden={hidden || undefined}
    >
      {shapes(name, ink)}
    </Svg>
  );
}
