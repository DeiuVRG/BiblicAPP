import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useTheme } from '@/theme/theme-context';

export function LoadingView({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator color={colors.textMuted} />
      <AppText variant="caption">{message}</AppText>
    </View>
  );
}

export function MessageView({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <AppText variant="lead" style={styles.message} accessibilityLiveRegion="polite">
        {message}
      </AppText>
    </View>
  );
}

/**
 * What a list says when it has nothing to show (docs/ui-spec-v2.md, 3): a centred serif sentence and,
 * when the list is empty because of its filters, one action that undoes them.
 */
export function EmptyState({
  message,
  actionLabel,
  onAction,
  testID = 'empty-state',
}: {
  message: string;
  actionLabel?: string;
  onAction?(): void;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.empty}>
      <AppText variant="heading" level={2} style={styles.message} accessibilityLiveRegion="polite">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button variant="text" title={actionLabel} onPress={onAction} testID={`${testID}-action`} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  message: { textAlign: 'center' },
});
