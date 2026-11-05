import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { useT } from '@/i18n';
import { toRoman } from '@/i18n/centuries';
import { formatCenturyLabel } from '@/i18n/labels';
import type { CenturyCount } from '@/library/model';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

interface Props {
  centuries: readonly CenturyCount[];
  /** Works that have no date: a note says so ("N lucrări nu au dată"), no tile is drawn for them. */
  undated: number;
  onChoose(century: number): void;
}

/**
 * The tiles of the century view (docs/ui-spec-v2.md, 6.2): one per century that has works, with the
 * Roman numeral, as Romanian writes centuries, in `numeral` and "N lucrări" under it. Choosing one
 * sets the century and returns to the author view. A century without works is not drawn.
 */
export function CenturyTiles({ centuries, undated, onChoose }: Props) {
  const t = useT();
  return (
    <View style={styles.wrap}>
      <AppText variant="meta">{t.library.centuryHint}</AppText>
      <View testID="century-tiles" style={styles.tiles}>
        {centuries.map(({ century, count }) => (
          <Tile
            key={century}
            testID={`century-tile-${century}`}
            numeral={century < 0 ? `${toRoman(-century)}` : toRoman(century)}
            caption={t.counts.works(count)}
            accessibilityLabel={t.library.centuryTile(
              formatCenturyLabel(century, t, 'long'),
              count,
            )}
            onPress={() => onChoose(century)}
          />
        ))}
      </View>
      {undated > 0 ? (
        <AppText variant="caption" testID="century-undated">
          {t.library.undated(undated)}
        </AppText>
      ) : null}
    </View>
  );
}

function Tile({
  testID,
  numeral,
  caption,
  accessibilityLabel,
  onPress,
}: {
  testID: string;
  numeral: string;
  caption: string;
  accessibilityLabel: string;
  onPress(): void;
}) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      style={[
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: hovered ? colors.accent : colors.border,
        },
        focusStyle,
      ]}
    >
      <AppText
        variant="numeral"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {numeral}
      </AppText>
      <AppText
        variant="caption"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {caption}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    minWidth: 73,
    minHeight: 55,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
