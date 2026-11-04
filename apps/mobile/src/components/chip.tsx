import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-context';

/** A small outlined tag (licence status, language): label type, 1 px border, no fill. */
export function Chip({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { borderColor: colors.border }]}>
      <AppText variant="label">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
