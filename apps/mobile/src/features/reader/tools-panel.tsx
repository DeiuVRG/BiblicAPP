import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { Hairline } from '@/components/hairline';
import { useHover } from '@/components/hover';
import { SegmentedControl } from '@/components/segmented-control';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/theme-context';

import type { ToolItem } from './reader-toolbar';
import type { LangChoice, PairChoice } from './pair';

/** The Tools of a phone (docs/ui-spec-v2.md, 8.8): a sheet with one full-width row per tool. */
export function ToolsList({ items }: { items: readonly ToolItem[] }) {
  return (
    <View testID="tools-list">
      {items.map((item, index) => (
        <View key={item.key}>
          {index > 0 ? <Hairline /> : null}
          <ToolRow item={item} />
        </View>
      ))}
    </View>
  );
}

function ToolRow({ item }: { item: ToolItem }) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      testID={`tool-${item.key}`}
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityState={item.active === undefined ? undefined : { selected: item.active }}
      aria-pressed={item.active}
      onPress={item.onPress}
      {...hoverProps}
      {...focusProps}
      style={[styles.row, focusStyle]}
    >
      <AppText
        variant="body"
        style={{ color: hovered || item.active ? colors.accentStrong : colors.text }}
      >
        {item.label}
      </AppText>
    </Pressable>
  );
}

/**
 * The language sheet of a phone (docs/ui-spec-v2.md, 8.12): the language of the text, the "Alăturat" switch and,
 * when the work has three editions, the pair that is read side by side.
 */
export function LanguageSheetBody({
  languages,
  language,
  disabled,
  onLanguage,
  lanesAvailable,
  lanesOn,
  onLanes,
  onOneLanguage,
  pairs,
  pair,
  onPair,
}: {
  languages: readonly LangChoice[];
  language: string | null;
  disabled: ReadonlySet<string>;
  onLanguage(token: string): void;
  lanesAvailable: boolean;
  lanesOn: boolean;
  onLanes(): void;
  onOneLanguage(): void;
  pairs: readonly PairChoice[];
  pair: string | null;
  onPair(pair: string): void;
}) {
  const t = useT();
  return (
    <View testID="language-sheet-body" style={styles.sheet}>
      <SegmentedControl
        label={t.reader.languageGroup}
        options={languages.map((choice) => ({
          value: choice.token,
          label: choice.code === 'Original' ? t.reader.langOriginal : choice.code,
        }))}
        value={lanesOn ? '' : (language ?? '')}
        onChange={(token) => {
          if (!disabled.has(token)) onLanguage(token);
        }}
      />
      {lanesAvailable ? (
        <>
          <SegmentedControl
            label={t.reader.lanes}
            options={[
              { value: 'one', label: t.reader.pair.off },
              { value: 'two', label: t.reader.lanes },
            ]}
            value={lanesOn ? 'two' : 'one'}
            onChange={(next) => (next === 'two' ? onLanes() : onOneLanguage())}
          />
          {lanesOn && pairs.length > 1 ? (
            <SegmentedControl
              label={t.reader.pair.menu}
              options={pairs.map((choice) => ({
                value: choice.pair,
                label: t.reader.pair.option(
                  choice.first.code === 'Original' ? t.reader.pair.original : choice.first.code,
                  choice.second.code === 'Original' ? t.reader.pair.original : choice.second.code,
                ),
              }))}
              value={pair ?? ''}
              onChange={onPair}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** The menu of pairs of a wide screen (three editions): one button per pair. */
export function PairMenu({
  pairs,
  pair,
  onPair,
}: {
  pairs: readonly PairChoice[];
  pair: string | null;
  onPair(pair: string): void;
}) {
  const t = useT();
  return (
    <View
      testID="pair-menu"
      accessibilityRole="menu"
      accessibilityLabel={t.reader.pair.menu}
      style={styles.menu}
    >
      {pairs.map((choice) => {
        const first = choice.first.code === 'Original' ? t.reader.pair.original : choice.first.code;
        const second =
          choice.second.code === 'Original' ? t.reader.pair.original : choice.second.code;
        return (
          <Button
            key={choice.pair}
            testID={`pair-${choice.pair}`}
            variant={choice.pair === pair ? 'primary' : 'outline'}
            title={t.reader.pair.option(first, second)}
            onPress={() => onPair(choice.pair)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, justifyContent: 'center', paddingVertical: 12 },
  sheet: { gap: 12 },
  menu: { gap: 8 },
});
