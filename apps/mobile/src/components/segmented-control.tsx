import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { KeyDownEvent } from 'react-native';

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

/** Narrowest a segment may get (a label such as "Întunecat" plus padding) before the options wrap. */
export const MIN_SEGMENT_WIDTH = 84;

/** The system font scale is honoured up to the same cap as the text itself (`UI_MAX_FONT_SCALE`). */
const MAX_SCALE = 1.5;

/**
 * Number of segments per row: all of them in one row while each gets at least `MIN_SEGMENT_WIDTH`
 * (scaled with the system font size), otherwise two rows. `width` is unknown (null) until the
 * control has been laid out; it starts as a single row.
 */
export function segmentColumns(count: number, width: number | null, fontScale = 1): number {
  if (width === null || width <= 0 || count <= 2) return count;
  const needed = count * MIN_SEGMENT_WIDTH * Math.min(Math.max(fontScale, 1), MAX_SCALE);
  return width >= needed ? count : Math.ceil(count / 2);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += size)
    rows.push(items.slice(start, start + size));
  return rows;
}

/** What a key does in a radio group: select the focused option or move to a neighbour. */
export function radioKeyAction(
  key: string,
): 'select' | 'next' | 'previous' | 'first' | 'last' | null {
  switch (key) {
    case ' ':
    case 'Spacebar':
      return 'select';
    case 'ArrowRight':
    case 'ArrowDown':
      return 'next';
    case 'ArrowLeft':
    case 'ArrowUp':
      return 'previous';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return null;
  }
}

/**
 * Single-choice control exposed to screen readers as a radio group. On a narrow container (or with
 * a large system font) the options wrap into two rows instead of being squeezed. On web it behaves
 * like a native radio group: one tab stop, arrow keys move the choice, Space chooses.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState<number | null>(null);
  const segments = useRef(new Map<T, { focus?: () => void } | null>());
  const rows = chunk(options, segmentColumns(options.length, width, fontScale));

  const move = (from: number, action: 'next' | 'previous' | 'first' | 'last') => {
    const last = options.length - 1;
    const target =
      action === 'first'
        ? 0
        : action === 'last'
          ? last
          : action === 'next'
            ? (from + 1) % options.length
            : (from - 1 + options.length) % options.length;
    const option = options[target];
    if (!option) return;
    onChange(option.value);
    segments.current.get(option.value)?.focus?.();
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.group, { borderColor: colors.borderStrong }]}
    >
      {rows.map((row, rowIndex) => (
        <View
          key={row[0]?.value ?? rowIndex}
          style={[
            styles.row,
            rowIndex > 0 ? { borderTopWidth: 1, borderTopColor: colors.borderStrong } : null,
          ]}
        >
          {row.map((option, index) => (
            <Segment
              key={option.value}
              label={option.label}
              selected={option.value === value}
              first={index === 0}
              segmentRef={(node) => {
                if (node) segments.current.set(option.value, node);
                else segments.current.delete(option.value);
              }}
              onPress={() => onChange(option.value)}
              onKey={(key) => {
                const action = radioKeyAction(key);
                if (action === null) return false;
                if (action === 'select') onChange(option.value);
                else
                  move(
                    options.findIndex((candidate) => candidate.value === option.value),
                    action,
                  );
                return true;
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Segment({
  label,
  selected,
  first,
  segmentRef,
  onPress,
  onKey,
}: {
  label: string;
  selected: boolean;
  first: boolean;
  segmentRef(node: { focus?: () => void } | null): void;
  onPress(): void;
  /** Handles a key press; returns true when the key was used (the page must not scroll). */
  onKey(key: string): boolean;
}) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      ref={segmentRef}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-checked={selected}
      aria-selected={selected}
      // One tab stop for the group (the chosen option), as with native radio buttons.
      {...(Platform.OS === 'web' ? { tabIndex: selected ? 0 : -1 } : null)}
      onPress={onPress}
      onKeyDown={(event: KeyDownEvent) => {
        if (onKey(event.nativeEvent.key)) event.preventDefault();
      }}
      {...hoverProps}
      style={({ pressed }) => [
        styles.segment,
        {
          backgroundColor: selected ? colors.accent : hovered ? colors.surface : undefined,
          borderLeftColor: colors.borderStrong,
          borderLeftWidth: first ? 0 : 1,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <AppText
        variant="ui"
        numberOfLines={1}
        style={[styles.text, { color: selected ? colors.onAccent : colors.text }]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
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
