import { StyleSheet, View } from 'react-native';
import type { ViewProps } from 'react-native';

import { useTheme } from '@/theme/theme-context';

/** Screen background in the active theme. */
export function Screen({ style, testID = 'screen', ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      {...rest}
      style={[styles.fill, { backgroundColor: colors.background }, style]}
    />
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
