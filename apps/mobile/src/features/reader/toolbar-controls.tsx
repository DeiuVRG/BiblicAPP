import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { AppText } from '@/components/app-text';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useCoarsePointer } from '@/theme/pointer';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

import { controlHeight } from './layout';

// The controls of the reader's toolbar (docs/ui-spec-v2.md, 8.2): bordered boxes on `surface`, 36 high with
// a mouse and 44 with a finger, in the `chrome` text, joined into groups where the reference joins them.

/** What a cell of the toolbar says about its state. */
interface CellState {
  /** A toggle that is on (a pressed look and `aria-pressed`). */
  pressed?: boolean;
  /** A control that opens something that is open now (`aria-expanded`). */
  expanded?: boolean;
  /** A segment that is the chosen one of its group: filled `accentStrong`. */
  chosen?: boolean;
  disabled?: boolean;
}

interface CellProps extends CellState {
  testID?: string;
  /** The accessible name in the interface language. */
  label: string;
  onPress?(): void;
  /** Fixed width in points; the content decides when absent. */
  width?: number;
  /** The text, an icon or both. A string is set in `chrome`. */
  children: ReactNode;
  /** The border and text turn `accentStrong` (the Transparency button while its panel is open). */
  accent?: boolean;
  /** Radio semantics (a language segment) instead of a button. */
  role?: 'button' | 'radio';
  style?: StyleProp<ViewStyle>;
  /** Boxed on its own (a button), or a cell inside a group that draws the box. */
  boxed?: boolean;
  /** The cell is not the first of its group: a rule on its left. */
  divided?: boolean;
}

/** One cell: a button or a segment. Alone it draws its own box; in a `ToolbarGroup` the group does. */
export function ToolbarCell({
  testID,
  label,
  onPress,
  width,
  children,
  accent = false,
  role = 'button',
  pressed,
  expanded,
  chosen,
  disabled,
  style,
  boxed = true,
  divided = false,
}: CellProps) {
  const { colors } = useTheme();
  const coarse = useCoarsePointer();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const height = controlHeight(coarse);
  const ink = chosen
    ? colors.onAccent
    : accent || (hovered && !disabled)
      ? colors.accentStrong
      : colors.text;
  const content =
    typeof children === 'string' ? (
      <AppText variant="chrome" style={{ color: ink }} numberOfLines={1}>
        {children}
      </AppText>
    ) : (
      children
    );
  const radio = role === 'radio';
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{
        disabled: !!disabled,
        ...(expanded === undefined ? null : { expanded }),
        ...(radio
          ? { checked: !!chosen, selected: !!chosen }
          : pressed === undefined
            ? null
            : { selected: pressed }),
      }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-expanded={expanded}
      aria-pressed={radio ? undefined : pressed}
      aria-checked={radio ? !!chosen : undefined}
      disabled={disabled}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      style={({ pressed: down }) => [
        styles.cell,
        {
          minHeight: height,
          height,
          ...(width === undefined ? null : { width }),
          backgroundColor: chosen ? colors.accentStrong : boxed ? colors.surface : undefined,
          opacity: disabled ? 0.6 : 1,
          ...(boxed
            ? {
                borderWidth: 1,
                borderColor: accent ? colors.accentStrong : colors.borderStrong,
                borderRadius: radii.sm,
              }
            : null),
          ...(divided ? { borderLeftWidth: 1, borderLeftColor: colors.borderStrong } : null),
        },
        disabled ? null : pressStyle(down, reduced),
        focusStyle,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

/** Cells joined into one box: one outline, the cells divided by a rule. */
export function ToolbarGroup({
  children,
  testID,
  label,
  role,
}: {
  children: ReactNode;
  testID?: string;
  label?: string;
  role?: 'radiogroup';
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      style={[
        styles.group,
        {
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          borderRadius: radii.sm,
        },
      ]}
    >
      {children}
    </View>
  );
}

/** A cell in a group (no box of its own). */
export const GroupCell = (props: Omit<CellProps, 'boxed'>) => (
  <ToolbarCell {...props} boxed={false} />
);

const styles = StyleSheet.create({
  cell: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  group: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1 },
});
