import { Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';

import { useSettings } from '@/settings/settings-context';
import { useFontFamilies } from '@/theme/fonts';
import { useLayout } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';
import { HEADING_VARIANTS, MUTED_VARIANTS, typeStyle } from '@/theme/typography';
import type { TypeVariant } from '@/theme/typography';

export type TextVariant = TypeVariant;

interface Props extends TextProps {
  variant?: TextVariant;
  /** Forces the muted (true) or the primary (false) text colour; the variant decides by default. */
  muted?: boolean;
  /** Outline level (1 to 6) of a heading on web; defaults by variant, and to 2 for other headings. */
  level?: number;
}

/** Font scaling is respected, but capped so layouts stay usable at the largest system sizes. */
export const UI_MAX_FONT_SCALE = 1.5;

/** Outline level of the heading variants (react-native-web renders every heading as h1 otherwise). */
const HEADING_LEVEL: Partial<Record<TypeVariant, number>> = {
  headerTitle: 1,
  display: 2,
  chapter: 2,
  title: 2,
  heading: 3,
};

/** Font, size, line height and colour of a variant in the active theme, for raw `Text` use. */
export function useTypeStyle(variant: TypeVariant, muted?: boolean): TextStyle {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const { wide } = useLayout();
  const { settings } = useSettings();
  const useMuted = muted ?? MUTED_VARIANTS.has(variant);
  return {
    ...typeStyle(variant, {
      fonts,
      wide,
      readingSize: settings.fontSize,
      readingLineHeight: settings.lineHeight,
    }),
    color: useMuted ? colors.textMuted : colors.text,
    textAlign: 'left',
  };
}

/** Themed text on the type scale (`theme/typography.ts`). */
export function AppText({ variant = 'body', muted, level, style, ...rest }: Props) {
  const base = useTypeStyle(variant, muted);
  const isHeading = HEADING_VARIANTS.has(variant);
  const role = rest.accessibilityRole ?? (isHeading ? 'header' : undefined);
  const headingLevel = level ?? HEADING_LEVEL[variant] ?? 2;
  // The prop is not part of React Native's types; react-native-web turns it into <h2>, <h3>...
  const levelProps = role === 'header' ? ({ 'aria-level': headingLevel } as object) : undefined;
  return (
    <Text
      maxFontSizeMultiplier={UI_MAX_FONT_SCALE}
      {...levelProps}
      {...rest}
      accessibilityRole={role}
      style={[base, style]}
    />
  );
}
