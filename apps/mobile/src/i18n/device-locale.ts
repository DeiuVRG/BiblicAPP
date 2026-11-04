import { Platform } from 'react-native';

/**
 * The language tag of the device ("ro-RO", "en-US"), or undefined when it cannot be read.
 * `expo-localization` is not a dependency: web asks the browser, iOS and Android ask `Intl`
 * (Hermes supports `Intl.DateTimeFormat`, and its default locale is the device's).
 */
export function getDeviceLocale(): string | undefined {
  if (Platform.OS === 'web') {
    try {
      const language = typeof navigator === 'undefined' ? undefined : navigator.language;
      if (typeof language === 'string' && language !== '') return language;
    } catch {
      // Fall through to Intl.
    }
  }
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof locale === 'string' && locale !== '') return locale;
  } catch {
    // No Intl on this runtime.
  }
  return undefined;
}
