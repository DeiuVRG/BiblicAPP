import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { SegmentedControl } from '@/components/segmented-control';
import { SettingRow } from '@/components/setting-row';
import { useT } from '@/i18n';
import { READING_LANGUAGES, UI_LANGUAGE_PREFERENCES } from '@/i18n/language';
import { useSettings } from '@/settings/settings-context';
import { PROSE_MAX_WIDTH } from '@/theme/layout';

/** Romanian / English: the language of the edition that opens first. */
export function ReadingLanguageControl() {
  const t = useT();
  const { settings, update } = useSettings();
  // Each language is written in its own language, in every interface language.
  const options = READING_LANGUAGES.map((value) => ({ value, label: t.readingLanguages[value] }));
  return (
    <View style={styles.block}>
      <SettingRow label={t.settings.readingLanguage} fill>
        <SegmentedControl
          label={t.settings.readingLanguage}
          options={options}
          value={settings.readingLanguage}
          onChange={(readingLanguage) => update({ readingLanguage })}
        />
      </SettingRow>
      <AppText variant="caption" style={styles.hint}>
        {t.settings.readingLanguageHint}
      </AppText>
    </View>
  );
}

/** System (the device language) / Romanian / English: the language of the interface. */
export function UiLanguageControl() {
  const t = useT();
  const { settings, update } = useSettings();
  const options = UI_LANGUAGE_PREFERENCES.map((value) => ({
    value,
    label: t.settings.uiLanguages[value],
  }));
  return (
    <View style={styles.block}>
      <SettingRow label={t.settings.uiLanguage} fill>
        <SegmentedControl
          label={t.settings.uiLanguage}
          options={options}
          value={settings.uiLanguage}
          onChange={(uiLanguage) => update({ uiLanguage })}
        />
      </SettingRow>
      <AppText variant="caption" style={styles.hint}>
        {t.settings.uiLanguageHint}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  hint: { maxWidth: PROSE_MAX_WIDTH },
});
