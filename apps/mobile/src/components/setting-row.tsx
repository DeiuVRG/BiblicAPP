import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useLayout } from '@/theme/layout';

/**
 * Below this window width the label sits above its control in every row. Left to wrap on its own,
 * a short label keeps its control beside it while a longer one pushes the control underneath, and
 * a group of rows then looks uneven (on a 360 px phone one stepper is inline and the other not).
 */
export const STACK_BELOW = 380;

interface Props {
  label: string;
  children: ReactNode;
  /**
   * For a control that needs room (a segmented control): it takes the rest of the row, up to a
   * maximum width, wraps under the label when the row is too narrow and, on its own line, shrinks
   * to the width of the row (a 320 px phone is narrower than the 300 px basis plus the gutters).
   */
  fill?: boolean;
}

/** A label with its control on the right (above it on narrow phones). */
export function SettingRow({ label, children, fill = false }: Props) {
  const stacked = useLayout().width < STACK_BELOW;
  return (
    <View style={[styles.row, stacked ? styles.stacked : null]}>
      <AppText variant="meta" style={styles.label}>
        {label}
      </AppText>
      {fill ? <View style={stacked ? styles.fillStacked : styles.fill}>{children}</View> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 16,
    rowGap: 8,
  },
  stacked: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'flex-start' },
  label: { flexShrink: 1 },
  fill: { flexGrow: 1, flexShrink: 1, flexBasis: 300, minWidth: 0, maxWidth: 420 },
  // In a column the basis would be a height: the control just takes the width of the row.
  fillStacked: { alignSelf: 'stretch', maxWidth: 420 },
});
