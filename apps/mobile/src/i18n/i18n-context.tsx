import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useSettings } from '@/settings/settings-context';

import { getDeviceLocale } from './device-locale';
import { resolveUiLanguage } from './language';
import type { UiLanguage } from './language';
import { ro } from './ro';
import type { Strings } from './strings';
import { stringsFor } from './tables';

interface I18nValue {
  language: UiLanguage;
  t: Strings;
}

const I18nContext = createContext<I18nValue>({ language: 'ro', t: ro });

interface ProviderProps {
  children: ReactNode;
  /** Test seam: the device locale ("en-GB"); defaults to the real one. */
  deviceLocale?: string;
}

/**
 * The string table of the interface language the user chose in Settings ("system" follows the
 * device locale). Components that read it re-render when the choice changes.
 */
export function I18nProvider({ children, deviceLocale }: ProviderProps) {
  const { settings } = useSettings();
  // Read once: a device does not change its language while the app is running.
  const [device] = useState(() => deviceLocale ?? getDeviceLocale());
  const language = resolveUiLanguage(settings.uiLanguage, device);
  const value = useMemo<I18nValue>(() => ({ language, t: stringsFor(language) }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The strings of the current interface language. */
export function useT(): Strings {
  return useContext(I18nContext).t;
}

/** The resolved interface language ("ro" or "en"). */
export function useUiLanguage(): UiLanguage {
  return useContext(I18nContext).language;
}
