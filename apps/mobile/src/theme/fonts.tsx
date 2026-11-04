import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_400Regular_Italic } from '@expo-google-fonts/literata/400Regular_Italic';
import { Literata_700Bold } from '@expo-google-fonts/literata/700Bold';
import { useFonts } from 'expo-font';
import { createContext, useContext } from 'react';
import { Platform } from 'react-native';

export interface FontFamilies {
  /** Reading serif (Literata covers U+0218 to U+021B, the comma-below s/t). */
  reading: string | undefined;
  readingItalic: string | undefined;
  readingBold: string | undefined;
  /** UI sans (Inter). */
  ui: string | undefined;
  uiMedium: string | undefined;
  uiSemiBold: string | undefined;
}

const webSerif = 'Georgia, "Times New Roman", serif';
const webSans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Used until the custom fonts are loaded, and when loading fails. */
export const fallbackFonts: FontFamilies = Platform.select<FontFamilies>({
  web: {
    reading: webSerif,
    readingItalic: webSerif,
    readingBold: webSerif,
    ui: webSans,
    uiMedium: webSans,
    uiSemiBold: webSans,
  },
  default: {
    reading: undefined,
    readingItalic: undefined,
    readingBold: undefined,
    ui: undefined,
    uiMedium: undefined,
    uiSemiBold: undefined,
  },
})!;

export const loadedFonts: FontFamilies = {
  reading: 'Literata_400Regular',
  readingItalic: 'Literata_400Regular_Italic',
  readingBold: 'Literata_700Bold',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemiBold: 'Inter_600SemiBold',
};

const fontSources = {
  Literata_400Regular,
  Literata_400Regular_Italic,
  Literata_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
};

/** Loads the bundled fonts. `ready` is true once loading finished (successfully or not). */
export function useAppFonts(): { ready: boolean; families: FontFamilies } {
  const [loaded, error] = useFonts(fontSources);
  return {
    ready: loaded || error != null,
    families: loaded ? loadedFonts : fallbackFonts,
  };
}

const FontsContext = createContext<FontFamilies>(fallbackFonts);
export const FontsProvider = FontsContext.Provider;

export function useFontFamilies(): FontFamilies {
  return useContext(FontsContext);
}
