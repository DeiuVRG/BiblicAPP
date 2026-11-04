import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';

/** A thin rule in the border colour: separates entries instead of boxes and cards. */
export function Hairline() {
  const { colors } = useTheme();
  return <View style={[styles.line, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({ line: { height: StyleSheet.hairlineWidth } });
