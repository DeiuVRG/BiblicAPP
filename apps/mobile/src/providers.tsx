import type { ReactNode } from 'react';

import { ToastProvider } from '@/components/toast';
import { ContentProvider } from '@/content/content-context';
import type { LoadedRepository } from '@/content/repository';
import { I18nProvider } from '@/i18n';
import { SettingsProvider, useSettings } from '@/settings/settings-context';
import { StorageProvider } from '@/storage/key-value-store';
import type { KeyValueStore } from '@/storage/key-value-store';
import { FontsProvider, fallbackFonts, groupForReadingFont, useFontGroup } from '@/theme/fonts';
import type { FontFamilies } from '@/theme/fonts';
import { ThemeProvider } from '@/theme/theme-context';

interface Props {
  children: ReactNode;
  families?: FontFamilies;
  /** Test seam: replaces AsyncStorage. */
  store?: KeyValueStore;
  /** Test seam: replaces the verified bundled repository loader. */
  loader?: () => Promise<LoadedRepository>;
}

/** Loads the files of the reading font the reader chose (Source Serif 4 is already in the first paint). */
function ReadingFontLoader() {
  const { settings } = useSettings();
  useFontGroup(groupForReadingFont(settings.readingFont));
  return null;
}

/** Everything the screens need from context: fonts, settings, language, theme and verified content. */
export function AppProviders({ children, families = fallbackFonts, store, loader }: Props) {
  const tree = (
    <FontsProvider value={families}>
      <SettingsProvider>
        <ReadingFontLoader />
        <I18nProvider>
          <ThemeProvider>
            <ToastProvider>
              <ContentProvider loader={loader}>{children}</ContentProvider>
            </ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </SettingsProvider>
    </FontsProvider>
  );
  return store ? <StorageProvider store={store}>{tree}</StorageProvider> : tree;
}
