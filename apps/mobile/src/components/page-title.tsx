import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { useT } from '@/i18n';

/** "Setări · Biblioteca": the name of the page first, the name of the app last (once). */
export function formatPageTitle(parts: readonly string[], appName: string): string {
  return [...parts, appName]
    .map((part) => part.trim())
    .filter((part, index, all) => part !== '' && all.indexOf(part) === index)
    .join(' · ');
}

/**
 * Web only: names the browser tab after the screen in focus, so that history, bookmarks and a row
 * of open tabs do not read as one long list of the same word. Renders nothing; on iOS and Android
 * the native header already carries the screen's title.
 */
export function PageTitle({ parts }: { parts: readonly string[] }) {
  const { appName } = useT();
  const title = formatPageTitle(parts, appName);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = title;
      return undefined;
    }, [title]),
  );
  return null;
}
