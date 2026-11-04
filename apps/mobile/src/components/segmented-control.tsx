import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { useTheme } from '@/theme/theme-context';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange(value: T): void;
}

/** Single-choice control exposed to screen readers as a radio group. */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? colors.accent : colors.surface,
                borderColor: selected ? colors.accent : colors.border,
              },
            ]}
          >
            <AppText variant="label" style={{ color: selected ? colors.onAccent : colors.text }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    minHeight: MIN_TARGET,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
