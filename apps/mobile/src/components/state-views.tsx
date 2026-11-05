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

/**
 * A sentence in the middle of the page. `heading` makes it the level-1 heading of a screen that has
 * nothing else to name it (a reader that did not find its section): one `h1` per screen.
 */
export function MessageView({ message, heading = false }: { message: string; heading?: boolean }) {
  return (
    <View style={styles.center}>
      <AppText
        variant="lead"
        {...(heading ? { heading: true, level: 1 } : null)}
        style={styles.message}
        accessibilityLiveRegion="polite"
      >
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
