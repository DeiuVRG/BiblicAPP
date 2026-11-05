import { Text, useWindowDimensions } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';

import { isDarkBand, isPhotoBand, useBandTone } from '@/components/band-context';
import type { BandTone } from '@/components/band-context';
import { useReadingMetrics } from '@/settings/reading-metrics';
import { useSettings } from '@/settings/settings-context';
import { useFontFamilies } from '@/theme/fonts';
import { useLayout } from '@/theme/layout';
import type { Palette } from '@/theme/palettes';
import { useTheme } from '@/theme/theme-context';
import {
  ACCENT_VARIANTS,
  HEADING_LEVELS,
  HEADING_VARIANTS,
  MUTED_VARIANTS,
  READING_MAX_FONT_SCALE,
  READING_VARIANTS,
  UI_MAX_FONT_SCALE,
  typeStyle,
} from '@/theme/typography';
import type { TextTone, TypeVariant } from '@/theme/typography';

export { UI_MAX_FONT_SCALE } from '@/theme/typography';

export type TextVariant = TypeVariant;

interface Props extends TextProps {
  variant?: TextVariant;
  /** Forces the muted (true) or the primary (false) text colour; the variant decides by default. */
  muted?: boolean;
  /** The colour family of the text; wins over `muted`. */
  tone?: TextTone;
  /** Outline level (1 to 6) of a heading on web; defaults by variant, and to 2 for other headings. */
  level?: number;
  /**
   * Whether the text is a heading for assistive technology. The variant decides by default (the
   * `display*`, `title` and `heading` variants are headings); `false` makes a display line plain
   * text, for a line that belongs to a heading that is marked somewhere else (the lines of a hero
   * title: one `h1` per screen, not one per line).
   */
  heading?: boolean;
}

/** The default tone of a variant. */
export function defaultTone(variant: TypeVariant): TextTone {
  if (MUTED_VARIANTS.has(variant)) return 'muted';
  if (ACCENT_VARIANTS.has(variant)) return 'accent';
  return 'text';
}

/**
 * The colour of a tone on a band: the page inks on the light bands, `mastheadInk`,
 * `mastheadInkMuted` and `mastheadAccent` on the dark ones (`accentStrong` is 2.64:1 there). Two
 * exceptions keep text readable: over a photograph the accent is `mastheadInk` (the orange has no
 * contrast to spare there), and on `warm` the muted tone is `text` (`textMuted` is 4.14:1 on it in
 * the light theme, a pair that rule 2 of docs/ui-spec-v2.md, 2.1, forbids).
 */
export function toneColor(colors: Palette, tone: TextTone, band: BandTone = 'background'): string {
  if (isDarkBand(band)) {
    if (tone === 'muted') return colors.mastheadInkMuted;
    if (tone === 'accent' || tone === 'danger') {
      return isPhotoBand(band) ? colors.mastheadInk : colors.mastheadAccent;
    }
    return colors.mastheadInk;
  }
  if (tone === 'muted') return band === 'warm' ? colors.text : colors.textMuted;
  if (tone === 'accent') return colors.accentStrong;
  if (tone === 'danger') return colors.danger;
  return colors.text;
}

/** Font, size, line height and colour of a variant in the active theme, for raw `Text` use. */
export function useTypeStyle(variant: TypeVariant, tone?: TextTone | boolean): TextStyle {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const { wide } = useLayout();
  const { width } = useWindowDimensions();
  const { settings } = useSettings();
  const metrics = useReadingMetrics();
  const band = useBandTone();
  const resolved: TextTone =
    tone === undefined
      ? defaultTone(variant)
      : tone === true
        ? 'muted'
        : tone === false
          ? 'text'
          : tone;
  return {
    ...typeStyle(variant, {
      fonts,
      wide,
      width,
      readingSize: metrics.fontSize,
      readingLineHeight: metrics.lineHeight,
      readingFont: settings.readingFont,
    }),
    color: toneColor(colors, resolved, band),
    textAlign: 'left',
  };
}

/** Themed text on the type scale (`theme/typography.ts`). */
export function AppText({ variant = 'body', muted, tone, level, heading, style, ...rest }: Props) {
  const base = useTypeStyle(variant, tone ?? muted);
  const isHeading = heading ?? HEADING_VARIANTS.has(variant);
  const role = rest.accessibilityRole ?? (isHeading ? 'header' : undefined);
  const headingLevel = level ?? HEADING_LEVELS[variant] ?? 2;
  // The prop is not part of React Native's types; react-native-web turns it into <h2>, <h3>...
  const levelProps = role === 'header' ? ({ 'aria-level': headingLevel } as object) : undefined;
  return (
    <Text
      maxFontSizeMultiplier={
        READING_VARIANTS.has(variant) ? READING_MAX_FONT_SCALE : UI_MAX_FONT_SCALE
      }
      {...levelProps}
      {...rest}
      accessibilityRole={role}
      style={[base, style]}
    />
  );
}
