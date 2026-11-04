import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';

interface Props {
  label: string;
  valueText: string;
  decreaseLabel: string;
  increaseLabel: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease(): void;
  onIncrease(): void;
}

/** "− value +" control for numeric settings. */
export function Stepper({
  label,
  valueText,
  decreaseLabel,
  increaseLabel,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: Props) {
  return (
    <View style={styles.row}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.controls}>
        <Button title="−" label={decreaseLabel} onPress={onDecrease} disabled={!canDecrease} />
        <AppText variant="label" style={styles.value} accessibilityLiveRegion="polite">
          {valueText}
        </AppText>
        <Button title="+" label={increaseLabel} onPress={onIncrease} disabled={!canIncrease} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  label: { flexShrink: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { minWidth: 56, textAlign: 'center' },
});
