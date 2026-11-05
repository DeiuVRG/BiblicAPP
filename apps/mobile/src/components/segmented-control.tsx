import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { KeyDownEvent } from 'react-native';

import { AppText } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

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

const GROUP_RADIUS = radii.sm;
const GROUP_BORDER = 1;
/** Corner radius of the segments that sit in a corner of the group (inside its border). */
const SEGMENT_RADIUS = GROUP_RADIUS - GROUP_BORDER;

/** Which corners of the group a segment is in: only those get a rounded corner. */
export interface Corners {
  topLeft: boolean;
  topRight: boolean;
  bottomLeft: boolean;
  bottomRight: boolean;
}

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
  // The mounted segments by value, so that an arrow key can move the focus along with the choice.
  const [segments] = useState(() => new Map<T, { focus?: () => void }>());
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
    segments.get(option.value)?.focus?.();
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
              corners={{
                topLeft: rowIndex === 0 && index === 0,
                topRight: rowIndex === 0 && index === row.length - 1,
                bottomLeft: rowIndex === rows.length - 1 && index === 0,
                bottomRight: rowIndex === rows.length - 1 && index === row.length - 1,
              }}
              segmentRef={(node) => {
                if (node) segments.set(option.value, node);
                else segments.delete(option.value);
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
  corners,
  segmentRef,
  onPress,
  onKey,
}: {
  label: string;
  selected: boolean;
  first: boolean;
  corners: Corners;
  segmentRef(node: { focus?: () => void } | null): void;
  onPress(): void;
  /** Handles a key press; returns true when the key was used (the page must not scroll). */
  onKey(key: string): boolean;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      ref={segmentRef}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms. (A radio
      // is checked, not selected: `aria-selected` is not allowed on that role.)
      aria-checked={selected}
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
          backgroundColor: selected ? colors.accentStrong : hovered ? colors.surface : undefined,
          borderLeftColor: colors.borderStrong,
          borderLeftWidth: first ? 0 : 1,
          borderTopLeftRadius: corners.topLeft ? SEGMENT_RADIUS : 0,
          borderTopRightRadius: corners.topRight ? SEGMENT_RADIUS : 0,
          borderBottomLeftRadius: corners.bottomLeft ? SEGMENT_RADIUS : 0,
          borderBottomRightRadius: corners.bottomRight ? SEGMENT_RADIUS : 0,
        },
        pressStyle(pressed, reduced),
      ]}
    >
      <AppText
        variant="meta"
        numberOfLines={1}
        style={[styles.text, { color: selected ? colors.onAccent : colors.text }]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

// No `overflow: hidden` on the group: it would clip the focus ring of the segments. The segments
// in the corners round their own corners instead.
const styles = StyleSheet.create({
  group: {
    borderWidth: GROUP_BORDER,
    borderRadius: GROUP_RADIUS,
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
