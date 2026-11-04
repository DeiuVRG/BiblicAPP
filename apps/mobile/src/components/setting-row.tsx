import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';

interface Props {
  label: string;
  children: ReactNode;
  /**
   * For a control that needs room (a segmented control): it takes the rest of the row, up to a
   * maximum width, and wraps under the label when the row is too narrow.
   */
  fill?: boolean;
}

/** A label with its control on the right. */
export function SettingRow({ label, children, fill = false }: Props) {
  return (
    <View style={styles.row}>
      <AppText variant="ui" style={styles.label}>
        {label}
      </AppText>
      {fill ? <View style={styles.fill}>{children}</View> : children}
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
  label: { flexShrink: 1 },
  fill: { flexGrow: 1, flexBasis: 300, maxWidth: 420 },
});
