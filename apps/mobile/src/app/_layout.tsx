import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { t } from '@/i18n';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: t.library.title }} />
        <Stack.Screen name="work/[id]" options={{ title: t.work.title }} />
        <Stack.Screen name="read/[id]/[section]" options={{ title: t.reader.title }} />
        <Stack.Screen name="search" options={{ title: t.search.title }} />
        <Stack.Screen name="settings" options={{ title: t.settings.title }} />
      </Stack>
    </>
  );
}
