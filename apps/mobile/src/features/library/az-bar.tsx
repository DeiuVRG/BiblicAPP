import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { AppText } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { EdgeFade } from '@/components/edge-fade';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { useT } from '@/i18n';
import type { LetterCount } from '@/library/model';
import { useFontFamilies } from '@/theme/fonts';
import { useLayout } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';
import { FOCUS_RING_ROOM } from '@/theme/tokens';

interface Props {
  letters: readonly LetterCount[];
  /** The number of authors in all: the entry "TOATE <n>". */
  total: number;
  active: string | null;
  onChoose(letter: string | null): void;
}

/**
 * The A-Z bar (docs/ui-spec-v2.md, 6.2): "TOATE <n authors>", then the letters that have authors
 * with how many each (letters without are left out, "#" for a name that does not start with a
 * letter). The active entry is bold and underlined; every entry is 44 high. Wide screens wrap it into
 * rows; a phone has one strip that scrolls inside itself, with a fade at the edge that has more.
 */
export function AzBar({ letters, total, active, onChoose }: Props) {
  const t = useT();
  const { wide } = useLayout();
  const [box, setBox] = useState({ width: 0, content: 0, offset: 0 });
  const moreAfter = box.content > box.width + 1 && box.offset + box.width < box.content - 1;

  const entries = (
    <>
      <Entry
        testID="az-all"
        label={t.library.allLetters}
        count={total}
        accessibilityLabel={t.library.allLettersLabel(total)}
        active={active === null}
        onPress={() => onChoose(null)}
      />
      {letters.map((entry) => (
        <Entry
          key={entry.letter}
          testID={`az-${entry.letter}`}
          label={entry.letter}
          count={entry.count}
          accessibilityLabel={t.library.letterLabel(entry.letter, entry.count)}
          active={active === entry.letter}
          onPress={() => onChoose(active === entry.letter ? null : entry.letter)}
        />
      ))}
    </>
  );

  if (wide) {
    return (
      <View
        testID="az-bar"
        accessibilityRole="toolbar"
        accessibilityLabel={t.library.lettersLabel}
        style={styles.wrapRow}
      >
        {entries}
      </View>
    );
  }
  return (
    <View testID="az-bar" accessibilityRole="toolbar" accessibilityLabel={t.library.lettersLabel}>
      <View style={styles.strip}>
        <ScrollView
          horizontal
          testID="az-bar-scroll"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onLayout={(event: LayoutChangeEvent) => {
            const width = event.nativeEvent.layout.width;
            setBox((previous) => ({ ...previous, width }));
          }}
          onContentSizeChange={(content) => setBox((previous) => ({ ...previous, content }))}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offset = event.nativeEvent.contentOffset.x;
            setBox((previous) => ({ ...previous, offset }));
          }}
          contentContainerStyle={styles.scrollRow}
        >
          {entries}
        </ScrollView>
        {moreAfter ? <EdgeFade side="right" width={24} testID="az-bar-fade" /> : null}
      </View>
    </View>
  );
}

function Entry({
  testID,
  label,
  count,
  accessibilityLabel,
  active,
  onPress,
}: {
  testID: string;
  label: string;
  count: number;
  accessibilityLabel: string;
  active: boolean;
  onPress(): void;
}) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const color = hovered ? colors.accentStrong : active ? colors.text : colors.textMuted;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-pressed={active}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      style={[styles.entry, focusStyle]}
    >
      <View style={[styles.underline, active ? { borderBottomColor: colors.accent } : null]}>
        <AppText
          variant="label"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ color, fontFamily: active ? fonts.textSemiBold : fonts.text }}
        >
          {label}
          <Text style={[styles.count, { fontFamily: fonts.text }]}>{` ${count}`}</Text>
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The entries have 8 points of padding for their 44 point targets: pulled back so the first one
  // lines up with the text above it.
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 2,
    marginLeft: -8,
  },
  // The strip is a little taller than its entries, so that a focus ring is not cut.
  strip: { position: 'relative', marginVertical: -FOCUS_RING_ROOM },
  scrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 2,
    paddingVertical: FOCUS_RING_ROOM,
    paddingLeft: FOCUS_RING_ROOM,
    paddingRight: 34,
  },
  entry: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  underline: { borderBottomWidth: 2, borderBottomColor: 'transparent', paddingVertical: 2 },
  count: { fontSize: 11, letterSpacing: 0 },
});
