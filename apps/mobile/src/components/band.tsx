import { StyleSheet, View } from 'react-native';
import type { ViewProps, ViewStyle } from 'react-native';

import { BandProvider, isDarkBand } from '@/components/band-context';
import type { BandTone } from '@/components/band-context';
import { bandPadding, columnStyle, useLayout } from '@/theme/layout';
import type { ColumnKind } from '@/theme/layout';
import type { Palette } from '@/theme/palettes';
import { useTheme } from '@/theme/theme-context';

export type { BandTone } from '@/components/band-context';

interface Props extends ViewProps {
  /**
   * The background: the page, `cream`, `warm` or the dark `masthead`; `photo` is a `masthead`
   * band with a picture behind it (the caller draws the picture and the scrim), whose text uses
   * the ink instead of the orange accent.
   */
  tone?: BandTone;
  /** The centred container the content sits in; `false` for a band whose content is full width. */
  container?: ColumnKind | false;
  /** A hairline above the band (a band that follows another one with the same background). */
  topRule?: boolean;
  /** Vertical padding: the band padding (88 wide, 56 on a phone) by default, or exact values. */
  padding?: 'band' | 'none' | { top: number; bottom: number };
}

/** The background colour of a tone. */
export function bandBackground(colors: Palette, tone: BandTone): string {
  if (tone === 'masthead' || tone === 'photo') return colors.masthead;
  return colors[tone];
}

/**
 * A full-width section with a background and a centred container (docs/ui-spec-v2.md, sections
 * 2.4 and 3). Backgrounds alternate down a page to mark its rhythm. Everything inside reads the
 * tone: text, links, buttons, icons and the focus ring use the dark-band inks on `masthead`
 * (on web the band marks itself with `data-band` so that the page's focus ring changes colour).
 */
export function Band({
  tone = 'background',
  container = 'wide',
  topRule = false,
  padding = 'band',
  testID = 'band',
  style,
  children,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const layout = useLayout();
  const vertical =
    padding === 'none'
      ? { top: 0, bottom: 0 }
      : padding === 'band'
        ? { top: bandPadding(layout.wide), bottom: bandPadding(layout.wide) }
        : padding;
  const surface: ViewStyle = {
    backgroundColor: bandBackground(colors, tone),
    paddingTop: vertical.top,
    paddingBottom: vertical.bottom,
    ...(topRule
      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }
      : null),
  };
  // `dataSet` becomes `data-band` on web and is ignored elsewhere.
  const marker = isDarkBand(tone) ? ({ dataSet: { band: 'masthead' } } as object) : null;
  return (
    <BandProvider value={tone}>
      <View testID={testID} {...marker} {...rest} style={[styles.band, surface, style]}>
        {container === false ? (
          children
        ) : (
          <View style={columnStyle(container, layout)}>{children}</View>
        )}
      </View>
    </BandProvider>
  );
}

const styles = StyleSheet.create({ band: { width: '100%' } });
