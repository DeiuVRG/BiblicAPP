import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { Icon } from '@/components/icon';
import { pressStyle } from '@/components/press';
import { Sheet } from '@/components/sheet';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  /** The caption above the control, in `label` style: "RAFT", "SECOL". */
  label: string;
  /** The chosen value, or null for "all". */
  value: string | null;
  options: readonly SelectOption[];
  /** What the control says while nothing is chosen ("Toate"). */
  allLabel: string;
  onChange(value: string | null): void;
  /** The name of the sheet and of the control: "Alege: Raft". */
  chooseLabel: string;
  testID: string;
}

/**
 * A choice among a few options, in the form of the reference's selects: a caption, then a bordered
 * control that shows the choice. Choosing opens a sheet (the app's own layer: Escape and the close
 * button return to the control, nothing else closes) with one row per option and "Toate" first.
 */
export function Select({ label, value, options, allLabel, onChange, chooseLabel, testID }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value);
  const shown = chosen?.label ?? allLabel;
  const pick = (next: string | null) => {
    setOpen(false);
    onChange(next);
  };
  return (
    <View style={styles.wrap}>
      <AppText
        variant="label"
        tone="accent"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        {label}
      </AppText>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        accessibilityState={{ expanded: open }}
        // react-native-web reads the `aria-*` props only; React Native reads both forms.
        aria-expanded={open}
        aria-haspopup="listbox"
        onPress={() => setOpen(true)}
        {...hoverProps}
        {...focusProps}
        style={({ pressed }) => [
          styles.control,
          {
            borderColor: hovered ? colors.text : colors.borderStrong,
            backgroundColor: colors.surface,
          },
          pressStyle(pressed, reduced),
          focusStyle,
        ]}
      >
        <AppText variant="meta" numberOfLines={1} style={styles.shown}>
          {shown}
        </AppText>
        <Icon name="chevronDown" size={16} color={colors.textMuted} />
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={chooseLabel}
        testID={`${testID}-sheet`}
      >
        <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.options}>
          {[{ value: '', label: allLabel }, ...options].map((option) => {
            const selected = option.value === '' ? value === null : option.value === value;
            return (
              <Option
                key={option.value}
                testID={`${testID}-option-${option.value || 'all'}`}
                label={option.label}
                selected={selected}
                onPress={() => pick(option.value === '' ? null : option.value)}
              />
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  testID: string;
}) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-checked={selected}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      style={[
        styles.option,
        { borderTopColor: colors.border, backgroundColor: hovered ? colors.surface : undefined },
        focusStyle,
      ]}
    >
      <AppText
        variant="meta"
        style={[styles.optionText, selected ? { color: colors.accentStrong } : null]}
      >
        {label}
      </AppText>
      {selected ? <Icon name="check" size={18} color={colors.accentStrong} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, minWidth: 0 },
  control: {
    minHeight: MIN_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  shown: { flexShrink: 1 },
  options: { marginHorizontal: -20 },
  option: {
    minHeight: MIN_TARGET + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionText: { flexShrink: 1 },
});
