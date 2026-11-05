import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { KeyDownEvent } from 'react-native';

import { AppText } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useT, useUiLanguage } from '@/i18n';
import type { UiLanguage } from '@/i18n/language';
import { useSettings } from '@/settings/settings-context';
import { useCoarsePointer } from '@/theme/pointer';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

const LANGUAGES: readonly UiLanguage[] = ['ro', 'en'];
/** Height of the switch for a mouse; a finger gets the 44 point target. */
const HEIGHT = 32;

interface Props {
  testID?: string;
  /** Always the 44 point target (the phone menu). */
  tall?: boolean;
}

/**
 * The language of the interface: `RO` and `EN`, two segments, a radio group (docs/ui-spec-v2.md,
 * 3 and 4.1). Choosing one stores it as the interface language (it replaces "System"), the page
 * changes language at once and `html[lang]` follows. 32 high, 44 with a coarse pointer.
 */
export function LanguageSwitch({ testID = 'language-switch', tall = false }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const language = useUiLanguage();
  const { update } = useSettings();
  const coarse = useCoarsePointer();
  const height = tall || coarse ? MIN_TARGET : HEIGHT;
  const [segments] = useState(() => new Map<UiLanguage, { focus?: () => void }>());

  const choose = (value: UiLanguage) => update({ uiLanguage: value });
  const move = (from: UiLanguage, step: 1 | -1) => {
    const next = LANGUAGES[(LANGUAGES.indexOf(from) + step + LANGUAGES.length) % LANGUAGES.length];
    if (!next) return;
    choose(next);
    segments.get(next)?.focus?.();
  };

  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={t.shell.languageSwitch}
      style={[styles.group, { borderColor: colors.borderStrong, height }]}
    >
      {LANGUAGES.map((value, index) => (
        <Segment
          key={value}
          value={value}
          label={t.readingLanguages[value]}
          selected={value === language}
          first={index === 0}
          last={index === LANGUAGES.length - 1}
          segmentRef={(node) => {
            if (node) segments.set(value, node);
            else segments.delete(value);
          }}
          onPress={() => choose(value)}
          onKey={(key) => {
            if (key === 'ArrowRight' || key === 'ArrowDown') move(value, 1);
            else if (key === 'ArrowLeft' || key === 'ArrowUp') move(value, -1);
            else if (key === ' ' || key === 'Spacebar') choose(value);
            else return false;
            return true;
          }}
        />
      ))}
    </View>
  );
}

function Segment({
  value,
  label,
  selected,
  first,
  last,
  segmentRef,
  onPress,
  onKey,
}: {
  value: UiLanguage;
  label: string;
  selected: boolean;
  first: boolean;
  last: boolean;
  segmentRef(node: { focus?: () => void } | null): void;
  onPress(): void;
  onKey(key: string): boolean;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const inner = radii.sm - 1;
  return (
    <Pressable
      ref={segmentRef}
      testID={`language-${value}`}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-checked={selected}
      // One tab stop for the group (the chosen option), like a native radio group.
      {...(Platform.OS === 'web' ? { tabIndex: selected ? 0 : -1 } : null)}
      onPress={onPress}
      onKeyDown={(event: KeyDownEvent) => {
        if (onKey(event.nativeEvent.key)) event.preventDefault();
      }}
      {...hoverProps}
      {...focusProps}
      style={({ pressed }) => [
        styles.segment,
        {
          backgroundColor: selected ? colors.accentStrong : hovered ? colors.surface : undefined,
          borderLeftColor: colors.borderStrong,
          borderLeftWidth: first ? 0 : 1,
          borderTopLeftRadius: first ? inner : 0,
          borderBottomLeftRadius: first ? inner : 0,
          borderTopRightRadius: last ? inner : 0,
          borderBottomRightRadius: last ? inner : 0,
        },
        pressStyle(pressed, reduced),
        focusStyle,
      ]}
    >
      <AppText
        variant="chip"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ color: selected ? colors.onAccent : colors.text }}
      >
        {value}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderWidth: 1, borderRadius: radii.sm },
  segment: { minWidth: 36, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
});
