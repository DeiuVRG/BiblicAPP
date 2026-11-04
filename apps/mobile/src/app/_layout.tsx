import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { t } from '@/i18n';
import { AppProviders } from '@/providers';
import { useSettings } from '@/settings/settings-context';
import { useAppFonts, useFontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';

// Keep the native splash until fonts and stored settings are ready (avoids a flash of the wrong
// theme or font). Not needed on web, where the static HTML is already rendered.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ThemedStack({ fontsReady }: { fontsReady: boolean }) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const { ready: settingsReady } = useSettings();
  const ready = fontsReady && settingsReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready && Platform.OS !== 'web') return null;

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.uiSemiBold, color: colors.text },
          headerShadowVisible: false,
          headerBackTitle: t.common.back,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: t.library.title }} />
        <Stack.Screen name="work/[id]" options={{ title: t.work.title }} />
        <Stack.Screen name="read/[id]/[section]" options={{ title: t.reader.title }} />
        <Stack.Screen name="search" options={{ title: t.search.title }} />
        <Stack.Screen name="settings" options={{ title: t.settings.title }} />
      </Stack>
    </>
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
