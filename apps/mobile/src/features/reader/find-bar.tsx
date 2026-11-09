import { useEffect, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputInstance } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useT } from '@/i18n';
import { useFontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';
import { elevationStyle, radii } from '@/theme/tokens';

import { FIND_BAR_WIDTH } from './layout';

/** Find starts by itself at this many characters, after 250 ms; fewer need Enter (docs/ui-spec-v2.md, 8.11). */
export const AUTO_FIND_MIN = 3;
export const FIND_DELAY_MS = 250;

export type FindStatus =
  | { kind: 'prompt' }
  | { kind: 'enter'; query: string }
  | { kind: 'searching' }
  | { kind: 'none' }
  | { kind: 'hits'; index: number; total: number; capped: boolean };

interface Props {
  text: string;
  onText(text: string): void;
  /** Enter with no hit to step to: searches the words (one or two characters included). */
  onSearch(): void;
  status: FindStatus;
  /** Enter and Shift+Enter in the field step through the hits. */
  onNext(): void;
  onPrevious(): void;
  onClose(): void;
  /** A phone: full width under the toolbar, 16 point text. */
  phone: boolean;
}

/** The text of the status line (a live region). */
export function findStatusText(status: FindStatus, t: ReturnType<typeof useT>): string {
  switch (status.kind) {
    case 'prompt':
      return t.reader.find.prompt;
    case 'enter':
      return t.reader.find.pressEnter(status.query);
    case 'searching':
      return t.reader.find.searching;
    case 'none':
      return t.reader.find.none;
    case 'hits':
      return t.reader.find.position(status.index + 1, status.total);
  }
}

/**
 * The find bar (docs/ui-spec-v2.md, 8.11): an input, ↑ ↓ ×, the state of the search and the line "Caută în toată
 * ediția, fără conexiune la internet.". It sits at the top of the text (850 wide over the column, the
 * full width on a phone). Enter steps to the next hit and Shift+Enter to the previous one; Escape closes it.
 */
export function FindBar({
  text,
  onText,
  onSearch,
  status,
  onNext,
  onPrevious,
  onClose,
  phone,
}: Props) {
  const t = useT();
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const input = useRef<TextInputInstance>(null);
  useEffect(() => {
    // Opening the bar puts the cursor in it.
    const timer = setTimeout(() => input.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);
  const hasHits = status.kind === 'hits' && status.total > 0;
  return (
    <View
      testID="find-bar"
      accessibilityRole="search"
      style={[
        styles.bar,
        phone ? styles.phone : styles.wide,
        { backgroundColor: colors.surface, borderColor: colors.border },
        phone ? null : elevationStyle('popover', colors),
      ]}
    >
      <View style={styles.line}>
        <TextInput
          ref={input}
          testID="find-input"
          value={text}
          onChangeText={onText}
          placeholder={t.reader.find.label}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t.reader.find.label}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="search"
          returnKeyType="search"
          onKeyPress={(event) => {
            const native = event.nativeEvent as { key: string; shiftKey?: boolean };
            if (native.key === 'Enter') {
              event.preventDefault?.();
              if (hasHits) (native.shiftKey ? onPrevious : onNext)();
              else onSearch();
            } else if (native.key === 'Escape') {
              onClose();
            }
          }}
          // The phone keyboard's Enter arrives as a submit, not as a key press.
          onSubmitEditing={() => (hasHits ? onNext() : onSearch())}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.background,
              borderColor: colors.borderStrong,
              fontFamily: fonts.text,
              // 16 points on a phone: no zoom on iOS.
              fontSize: 16,
            },
          ]}
        />
        <Button
          testID="find-previous"
          glyph
          variant="outline"
          title="↑"
          label={t.reader.find.previous}
          disabled={!hasHits}
          onPress={onPrevious}
        />
        <Button
          testID="find-next"
          glyph
          variant="outline"
          title="↓"
          label={t.reader.find.next}
          disabled={!hasHits}
          onPress={onNext}
        />
        <Button
          testID="find-close"
          glyph
          variant="text"
          title="×"
          label={t.reader.find.close}
          onPress={onClose}
          textStyle={styles.close}
        />
      </View>
      <AppText
        variant="meta"
        testID="find-status"
        role="status"
        accessibilityLiveRegion="polite"
        accessibilityRole="none"
        style={status.kind === 'none' ? { color: colors.danger } : undefined}
      >
        {findStatusText(status, t)}
        {status.kind === 'hits' && status.capped ? ` · ${t.reader.find.capped(status.total)}` : ''}
      </AppText>
      <AppText variant="caption">{t.reader.find.help}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderWidth: 1, padding: 12, gap: 6, zIndex: 8 },
  wide: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    width: '100%',
    maxWidth: FIND_BAR_WIDTH,
    minHeight: 107,
    borderRadius: radii.md,
  },
  phone: { borderLeftWidth: 0, borderRightWidth: 0, borderTopWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
  },
  close: { fontSize: 24, lineHeight: 28 },
});
