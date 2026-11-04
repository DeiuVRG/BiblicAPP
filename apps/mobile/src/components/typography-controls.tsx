import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { SettingRow } from '@/components/setting-row';
import { Stepper } from '@/components/stepper';
import { t } from '@/i18n';
import { clamp, roundLineHeight } from '@/settings/sanitize';
import { useSettings } from '@/settings/settings-context';
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  THEME_PREFERENCES,
} from '@/settings/types';

/** Font size stepper. */
export function FontSizeControl() {
  const { settings, update } = useSettings();
  return (
    <Stepper
      label={t.settings.fontSize}
      valueText={t.settings.fontSizeValue(settings.fontSize)}
      decreaseLabel={t.settings.decreaseFontSize}
      increaseLabel={t.settings.increaseFontSize}
      canDecrease={settings.fontSize > FONT_SIZE_MIN}
      canIncrease={settings.fontSize < FONT_SIZE_MAX}
      onDecrease={() =>
        update({ fontSize: clamp(settings.fontSize - 1, FONT_SIZE_MIN, FONT_SIZE_MAX) })
      }
      onIncrease={() =>
        update({ fontSize: clamp(settings.fontSize + 1, FONT_SIZE_MIN, FONT_SIZE_MAX) })
      }
    />
  );
}

/** Line height stepper. */
export function LineHeightControl() {
  const { settings, update } = useSettings();
  return (
    <Stepper
      label={t.settings.lineHeight}
      valueText={t.settings.lineHeightValue(settings.lineHeight)}
      decreaseLabel={t.settings.decreaseLineHeight}
      increaseLabel={t.settings.increaseLineHeight}
      canDecrease={settings.lineHeight > LINE_HEIGHT_MIN + 1e-9}
      canIncrease={settings.lineHeight < LINE_HEIGHT_MAX - 1e-9}
      onDecrease={() =>
        update({ lineHeight: roundLineHeight(settings.lineHeight - LINE_HEIGHT_STEP) })
      }
      onIncrease={() =>
        update({ lineHeight: roundLineHeight(settings.lineHeight + LINE_HEIGHT_STEP) })
      }
    />
  );
}

/** Automatic / light / sepia / dark. `labelled={false}` when a section heading already says "Tema". */
export function ThemeControl({ labelled = true }: { labelled?: boolean }) {
  const { settings, update } = useSettings();
  const themeOptions = THEME_PREFERENCES.map((value) => ({
    value,
    label: t.settings.themes[value],
  }));
  const control = (
    <SegmentedControl
      label={t.settings.theme}
      options={themeOptions}
      value={settings.theme}
      onChange={(theme) => update({ theme })}
    />
  );
  return labelled ? (
    <SettingRow label={t.settings.theme} fill>
      {control}
    </SettingRow>
  ) : (
    <View style={styles.alone}>{control}</View>
  );
}

/** Font size, line height and theme controls; used in the reader's typography sheet. */
export function TypographyControls() {
  return (
    <View style={styles.group}>
      <FontSizeControl />
      <LineHeightControl />
      <ThemeControl />
    </View>
  );
}

const styles = StyleSheet.create({ group: { gap: 12 }, alone: { maxWidth: 420 } });
