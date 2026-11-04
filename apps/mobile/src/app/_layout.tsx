import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { useT, useUiLanguage } from '@/i18n';
import { AppProviders } from '@/providers';
import { useSettings } from '@/settings/settings-context';
import { applyDocumentTheme } from '@/theme/document-theme';
import { useAppFonts, useFontFamilies } from '@/theme/fonts';
import { buildNavigationTheme } from '@/theme/navigation-theme';
import { useTheme } from '@/theme/theme-context';

// Keep the native splash until fonts and stored settings are ready (avoids a flash of the wrong
// theme or font). On web nothing is drawn until then: the HTML template already paints the page
// background, so there is no flash of the wrong theme or of fallback fonts.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ThemedStack({ fontsReady }: { fontsReady: boolean }) {
  const t = useT();
  const language = useUiLanguage();
  const { name, colors } = useTheme();
  const fonts = useFontFamilies();
  const { ready: settingsReady } = useSettings();
  const ready = fontsReady && settingsReady;
  // Headers, back buttons and transitions read this instead of React Navigation's own themes.
  const navigationTheme = useMemo(
    () => buildNavigationTheme(name, colors, DefaultTheme.fonts),
    [name, colors],
  );

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  // Web: the document (body background, scrollbars, browser chrome) follows the active palette.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      applyDocumentTheme(document, name, colors);
    }
  }, [name, colors]);

  // Web: the document language follows the interface language (screen readers, hyphenation).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  if (!ready) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.textSemiBold, fontSize: 20, color: colors.text },
          headerShadowVisible: false,
          headerBackTitle: t.common.back,
          contentStyle: { backgroundColor: colors.background },
          // The web header is drawn by the app (column-aligned, serif title); native keeps its own.
          ...(Platform.OS === 'web' ? { header: (props) => <AppHeader {...props} /> } : {}),
        }}
      >
        <Stack.Screen name="index" options={{ title: t.library.title }} />
        <Stack.Screen name="work/[id]" options={{ title: t.work.title }} />
        <Stack.Screen name="read/[id]/[section]" options={{ title: t.reader.title }} />
        <Stack.Screen name="search" options={{ title: t.search.title }} />
        <Stack.Screen name="settings" options={{ title: t.settings.title }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const { ready, families } = useAppFonts();
  return (
    <AppProviders families={families}>
      <ThemedStack fontsReady={ready} />
    </AppProviders>
  );
}
