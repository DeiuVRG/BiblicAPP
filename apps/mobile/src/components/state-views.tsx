import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-context';

export function LoadingView({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator color={colors.accent} />
      <AppText muted>{message}</AppText>
    </View>
  );
}

export function MessageView({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <AppText muted style={styles.message} accessibilityLiveRegion="polite">
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  message: { textAlign: 'center' },
});
