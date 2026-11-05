import { IconButton } from '@/components/icon-button';
import type { IconName } from '@/components/icon';
import { useT } from '@/i18n';
import { useSettings } from '@/settings/settings-context';
import type { ThemePreference } from '@/theme/palettes';

/** The order the button cycles through: light, sepia, dark, then the device's own (auto). */
export const THEME_CYCLE: readonly ThemePreference[] = ['light', 'sepia', 'dark', 'system'];

const ICONS: Record<ThemePreference, IconName> = {
  light: 'themeLight',
  sepia: 'themeSepia',
  dark: 'themeDark',
  system: 'themeAuto',
};

/** The theme that a press chooses after `current`. */
export function nextTheme(current: ThemePreference): ThemePreference {
  const index = THEME_CYCLE.indexOf(current);
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length] ?? 'light';
}

/**
 * Cycles the theme of every screen: light, sepia, dark, then auto. The icon shows the current
 * choice and the accessible name says it and what the next press gives (docs/ui-spec-v2.md, 3);
 * Settings has the full selector.
 */
export function ThemeButton() {
  const t = useT();
  const { settings, update } = useSettings();
  const current = settings.theme;
  const next = nextTheme(current);
  return (
    <IconButton
      testID="theme-button"
      name={ICONS[current]}
      label={t.shell.themeButton(t.settings.themes[current], t.settings.themes[next])}
      onPress={() => update({ theme: next })}
    />
  );
}
