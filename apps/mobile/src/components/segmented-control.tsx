import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { useHover } from '@/components/hover';
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
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.group, { borderColor: colors.border }]}
    >
      {options.map((option, index) => (
        <Segment
          key={option.value}
          label={option.label}
          selected={option.value === value}
          first={index === 0}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  selected,
  first,
  onPress,
}: {
  label: string;
  selected: boolean;
  first: boolean;
  onPress(): void;
}) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      {...hoverProps}
      style={({ pressed }) => [
        styles.segment,
        {
          backgroundColor: selected ? colors.accent : hovered ? colors.surface : undefined,
          borderLeftColor: colors.border,
          borderLeftWidth: first ? 0 : 1,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <AppText
        variant="ui"
        style={[styles.text, { color: selected ? colors.onAccent : colors.text }]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: MIN_TARGET,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { textAlign: 'center' },
});
