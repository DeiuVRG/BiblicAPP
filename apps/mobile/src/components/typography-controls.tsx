import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { SettingRow } from '@/components/setting-row';
import { Stepper } from '@/components/stepper';
import { useT } from '@/i18n';
import { READING_FONTS } from '@/theme/font-families';
import { clamp, roundLineHeight } from '@/settings/sanitize';
import { useReadingMetrics } from '@/settings/reading-metrics';
import { useSettings } from '@/settings/settings-context';
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  THEME_PREFERENCES,
} from '@/settings/types';

/** Font size stepper: the size in use (the default of the window until the reader chooses one). */
export function FontSizeControl() {
  const t = useT();
  const { update } = useSettings();
  const { fontSize } = useReadingMetrics();
  return (
    <Stepper
      label={t.settings.fontSize}
      valueText={t.settings.fontSizeValue(fontSize)}
      decreaseLabel={t.settings.decreaseFontSize}
      increaseLabel={t.settings.increaseFontSize}
      canDecrease={fontSize > FONT_SIZE_MIN}
      canIncrease={fontSize < FONT_SIZE_MAX}
      onDecrease={() => update({ fontSize: clamp(fontSize - 1, FONT_SIZE_MIN, FONT_SIZE_MAX) })}
      onIncrease={() => update({ fontSize: clamp(fontSize + 1, FONT_SIZE_MIN, FONT_SIZE_MAX) })}
    />
  );
}

/**
 * Line height stepper (1.3 to 2.0 in steps of 0.1). It starts from the multiple in use: a preset of
 * the `Aa` sheet counts as the number it stands for, shown to one decimal place.
 */
export function LineHeightControl() {
  const t = useT();
  const { update } = useSettings();
  const { lineHeight } = useReadingMetrics();
  return (
    <Stepper
      label={t.settings.lineHeight}
      valueText={t.settings.lineHeightValue(lineHeight)}
      decreaseLabel={t.settings.decreaseLineHeight}
      increaseLabel={t.settings.increaseLineHeight}
      canDecrease={roundLineHeight(lineHeight) > LINE_HEIGHT_MIN + 1e-9}
      canIncrease={roundLineHeight(lineHeight) < LINE_HEIGHT_MAX - 1e-9}
      onDecrease={() => update({ lineSpacing: roundLineHeight(lineHeight - LINE_HEIGHT_STEP) })}
      onIncrease={() => update({ lineSpacing: roundLineHeight(lineHeight + LINE_HEIGHT_STEP) })}
    />
  );
}

/** Serif / Literata / Sans: the face of the reading text (Source Serif 4, Literata, Inter). */
export function ReadingFontControl() {
  const t = useT();
  const { settings, update } = useSettings();
  const options = READING_FONTS.map((value) => ({ value, label: t.settings.readingFonts[value] }));
  return (
    <SettingRow label={t.settings.readingFont} fill>
      <SegmentedControl
        label={t.settings.readingFont}
        options={options}
        value={settings.readingFont}
        onChange={(readingFont) => update({ readingFont })}
      />
    </SettingRow>
  );
}

/** Automatic / light / sepia / dark. `labelled={false}` when a section heading already says "Tema". */
export function ThemeControl({ labelled = true }: { labelled?: boolean }) {
  const t = useT();
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

/** Font, font size, line height and theme controls; used in the reader's typography sheet. */
export function TypographyControls() {
  return (
    <View style={styles.group}>
      <ReadingFontControl />
      <FontSizeControl />
      <LineHeightControl />
      <ThemeControl />
    </View>
  );
}

const styles = StyleSheet.create({ group: { gap: 12 }, alone: { maxWidth: 420 } });
