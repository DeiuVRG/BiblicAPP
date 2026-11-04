import { StyleSheet, Text } from 'react-native';
import type { TextProps } from 'react-native';

import { useFontFamilies } from '@/theme/fonts';
import type { FontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';

export type TextVariant = 'title' | 'heading' | 'body' | 'label' | 'caption';

interface Props extends TextProps {
  variant?: TextVariant;
  muted?: boolean;
}

/** Font scaling is respected, but capped so layouts stay usable at the largest system sizes. */
export const UI_MAX_FONT_SCALE = 1.5;

function variantStyle(variant: TextVariant, fonts: FontFamilies) {
  switch (variant) {
    case 'title':
      return { fontFamily: fonts.uiSemiBold, fontSize: 24, lineHeight: 32 };
    case 'heading':
      return { fontFamily: fonts.uiSemiBold, fontSize: 18, lineHeight: 26 };
    case 'label':
      return { fontFamily: fonts.uiMedium, fontSize: 15, lineHeight: 22 };
    case 'caption':
      return { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19 };
    default:
      return { fontFamily: fonts.ui, fontSize: 16, lineHeight: 24 };
  }
}

/** Text in the UI font (Inter) with the active theme colours. */
export function AppText({ variant = 'body', muted = false, style, ...rest }: Props) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  return (
    <Text
      maxFontSizeMultiplier={UI_MAX_FONT_SCALE}
      {...rest}
      style={[variantStyle(variant, fonts), { color: muted ? colors.textMuted : colors.text }, styles.left, style]}
      accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : rest.accessibilityRole}
    />
  );
}

const styles = StyleSheet.create({ left: { textAlign: 'left' } });
