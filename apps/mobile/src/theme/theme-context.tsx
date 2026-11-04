import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '@/settings/settings-context';

import { palettes, resolveTheme } from './palettes';
import type { Palette, ThemeName } from './palettes';

export interface Theme {
  name: ThemeName;
  colors: Palette;
}

const ThemeContext = createContext<Theme>({ name: 'light', colors: palettes.light });

/** Derives the active palette from the persisted preference and the system colour scheme. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const system = useColorScheme();
  const name = resolveTheme(settings.theme, system);
  const value = useMemo<Theme>(() => ({ name, colors: palettes[name] }), [name]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
