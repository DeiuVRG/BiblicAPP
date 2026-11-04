import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { SettingRow } from '@/components/setting-row';

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
    <SettingRow label={label}>
      <View style={styles.controls}>
        <Button title="−" label={decreaseLabel} onPress={onDecrease} disabled={!canDecrease} />
        <AppText variant="ui" style={styles.value} accessibilityLiveRegion="polite">
          {valueText}
        </AppText>
        <Button title="+" label={increaseLabel} onPress={onIncrease} disabled={!canIncrease} />
      </View>
    </SettingRow>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { minWidth: 56, textAlign: 'center' },
});
