import type { ReactNode } from 'react';

import { ContentProvider } from '@/content/content-context';
import type { LoadedRepository } from '@/content/repository';
import { I18nProvider } from '@/i18n';
import { SettingsProvider } from '@/settings/settings-context';
import { StorageProvider } from '@/storage/key-value-store';
import type { KeyValueStore } from '@/storage/key-value-store';
import { FontsProvider, fallbackFonts } from '@/theme/fonts';
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

/** Everything the screens need from context: fonts, settings, language, theme and verified content. */
export function AppProviders({ children, families = fallbackFonts, store, loader }: Props) {
  const tree = (
    <FontsProvider value={families}>
      <SettingsProvider>
        <I18nProvider>
          <ThemeProvider>
            <ContentProvider loader={loader}>{children}</ContentProvider>
          </ThemeProvider>
        </I18nProvider>
      </SettingsProvider>
    </FontsProvider>
  );
  return store ? <StorageProvider store={store}>{tree}</StorageProvider> : tree;
}
