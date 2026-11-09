import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { useFocusRing } from '@/components/focus-ring';
import { Icon } from '@/components/icon';
import { pressStyle } from '@/components/press';
import { useT } from '@/i18n';
import { useFontFamilies } from '@/theme/fonts';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { BAR_HEIGHT, radii } from '@/theme/tokens';

export type BarKey = 'contents' | 'find' | 'language' | 'text' | 'tools';

interface Props {
  /** The cell of the panel that is open (`text` on `cream`), or null. */
  active: BarKey | null;
  /** The language cell exists for a work with two or more editions (five cells; four otherwise). */
  bilingual: boolean;
  onPress(key: BarKey): void;
}

/**
 * The bottom bar of a phone (docs/ui-spec-v2.md, 8.12): 61 high plus the safe area, Contents, Search, Language,
 * Text and Tools, each an icon over a 12 point label. (The reference's Tools strip and the bar that
 * leaves on scroll are P1b; here Tools open as a sheet.)
 */
export function BottomBar({ active, bilingual, onPress }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cells: {
    key: BarKey;
    label: string;
    glyph: 'menu' | 'search' | 'lanes' | 'Aa' | 'more';
  }[] = [
    { key: 'contents', label: t.reader.bar.contents, glyph: 'menu' },
    { key: 'find', label: t.reader.bar.find, glyph: 'search' },
    ...(bilingual
      ? [{ key: 'language' as const, label: t.reader.bar.language, glyph: 'lanes' as const }]
      : []),
    { key: 'text', label: t.reader.bar.text, glyph: 'Aa' },
    { key: 'tools', label: t.reader.bar.tools, glyph: 'more' },
  ];
  return (
    <View
      testID="thumb-bar"
      accessibilityRole="toolbar"
      accessibilityLabel={t.reader.bar.label}
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: BAR_HEIGHT.thumb + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {cells.map((cell) => (
        <Cell
          key={cell.key}
          id={cell.key}
          label={cell.label}
          glyph={cell.glyph}
          active={active === cell.key}
          onPress={() => onPress(cell.key)}
        />
      ))}
    </View>
  );
}

function Cell({
  id,
  label,
  glyph,
  active,
  onPress,
}: {
  id: BarKey;
  label: string;
  glyph: 'menu' | 'search' | 'lanes' | 'Aa' | 'more';
  active: boolean;
  onPress(): void;
}) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const reduced = useReducedMotion();
  const { focusProps, focusStyle } = useFocusRing();
  const ink = active ? colors.text : colors.textMuted;
  return (
    <Pressable
      testID={`thumb-cell-${id}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-pressed={active}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor: active ? colors.cream : undefined },
        pressStyle(pressed, reduced),
        focusStyle,
      ]}
    >
      {glyph === 'Aa' || glyph === 'more' ? (
        <AppText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            fontFamily: fonts.text,
            fontSize: glyph === 'Aa' ? 18 : 22,
            lineHeight: 20,
            color: ink,
          }}
        >
          {glyph === 'Aa' ? 'Aa' : '…'}
        </AppText>
      ) : (
        <Icon name={glyph} size={20} color={ink} />
      )}
      <AppText
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ fontFamily: fonts.textSemiBold, fontSize: 12, lineHeight: 16, color: ink }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, zIndex: 20 },
  cell: {
    flex: 1,
    minHeight: 44,
    marginVertical: 4,
    marginHorizontal: 2,
    borderRadius: radii.sm + 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
