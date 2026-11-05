import { StyleSheet, TextInput, View } from 'react-native';
import type { StyleProp, TextInputInstance, ViewStyle } from 'react-native';
import type { Ref } from 'react';

import { UI_MAX_FONT_SCALE } from '@/components/app-text';
import { Button, MIN_TARGET } from '@/components/button';
import { useFontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

/** Height of the field; 44 is the least a control may be. */
export const SEARCH_FIELD_HEIGHT = 48;
/** Room the clear button takes at the right end of the field, so the text never runs under it. */
const CLEAR_SLOT = MIN_TARGET;

interface Props {
  value: string;
  onChangeText(text: string): void;
  placeholder: string;
  /** The accessible name of the field (the placeholder is not a name). */
  label: string;
  /** The accessible name of the clear button ("Șterge căutarea"). */
  clearLabel: string;
  /** Enter was pressed. */
  onSubmit?(): void;
  autoFocus?: boolean;
  /** The right corners are square: a button joins the field there (the hero form of 6.1). */
  joined?: boolean;
  testID?: string;
  inputRef?: Ref<TextInputInstance>;
  style?: StyleProp<ViewStyle>;
}

/**
 * The search field of the product (docs/ui-spec-v2.md, 3): 48 high, a 1 px `borderStrong` outline,
 * radius 6, 16 point text (no zoom on iOS), a clear button inside it, `type=search` on web. The
 * focus ring replaces the border (the page's `input:focus-visible` rule). Escape clears it.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  label,
  clearLabel,
  onSubmit,
  autoFocus,
  joined = false,
  testID = 'search-field',
  inputRef,
  style,
}: Props) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  return (
    <View style={[styles.field, style]}>
      <TextInput
        ref={inputRef}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        inputMode="search"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        onKeyPress={(event) => {
          if (event.nativeEvent.key === 'Escape' && value !== '') onChangeText('');
        }}
        maxFontSizeMultiplier={UI_MAX_FONT_SCALE}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.borderStrong,
            fontFamily: fonts.text,
          },
          joined ? styles.joined : null,
        ]}
      />
      {value.length > 0 ? (
        // Inside the field, over the room the input leaves free: the field never resizes.
        <Button
          testID={`${testID}-clear`}
          variant="text"
          glyph
          title="×"
          label={clearLabel}
          onPress={() => onChangeText('')}
          textStyle={[styles.clearText, { color: colors.textMuted }]}
          style={styles.clear}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { width: '100%', minWidth: 0 },
  input: {
    width: '100%',
    minWidth: 0,
    height: SEARCH_FIELD_HEIGHT,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingLeft: 14,
    paddingRight: CLEAR_SLOT,
    fontSize: 16,
  },
  joined: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  // 48 px field, 44 px button, 2 px around it.
  clear: { position: 'absolute', top: 2, right: 2, paddingHorizontal: 0 },
  clearText: { fontSize: 24, lineHeight: 28 },
});
