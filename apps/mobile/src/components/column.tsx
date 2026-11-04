import { View } from 'react-native';
import type { ViewProps, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { columnStyle, useLayout } from '@/theme/layout';
import type { ColumnKind } from '@/theme/layout';

/** Centred column: full width with gutters on phones, 880 px (lists) or 680 px (reading) on web. */
export function Column({ kind = 'list', style, ...rest }: ViewProps & { kind?: ColumnKind }) {
  const layout = useLayout();
  return <View {...rest} style={[columnStyle(kind, layout), style]} />;
}

/**
 * `contentContainerStyle` of a list or scroll view: the column, plus room under the last entry
 * (the bottom safe-area inset on phones with a gesture bar).
 */
export function useListContentStyle(kind: ColumnKind = 'list'): ViewStyle {
  const layout = useLayout();
  const insets = useSafeAreaInsets();
  return {
    ...columnStyle(kind, layout),
    flexGrow: 1,
    paddingBottom: insets.bottom + (layout.wide ? 64 : 40),
  };
}
