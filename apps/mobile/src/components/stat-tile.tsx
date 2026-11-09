import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useFontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

/** The tile of the work hub: 220 x 76 (docs/ui-spec-v2.md, 3). */
export const STAT_TILE_WIDTH = 220;
export const STAT_TILE_HEIGHT = 76;

interface Props {
  /** The figure ("11", "~29.600"), written for the interface language by the caller. */
  value: string;
  /** What it counts, in small caps by style ("Secțiuni"). */
  caption: string;
  testID?: string;
}

/**
 * A figure over its caption in a bordered tile: the figure in the text face at 26 points (the `numeral`
 * token of the landing is too tall for a 76 point tile, and IM Fell sets its 1 like a capital I: 11
 * sections would read "II") and the `label` style for the caption. The figure and the caption are
 * read together as one thing by a screen reader.
 */
export function StatTile({ value, caption, testID }: Props) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${caption}: ${value}`}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <AppText
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.value, { fontFamily: fonts.text, color: colors.text }]}
      >
        {value}
      </AppText>
      <AppText
        variant="label"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {caption}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 0,
    width: '100%',
    maxWidth: STAT_TILE_WIDTH,
    height: STAT_TILE_HEIGHT,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 2,
  },
  value: { fontSize: 26, lineHeight: 30 },
});
