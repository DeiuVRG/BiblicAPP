import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { loadBundledRepository } from '@/content/repository';
import type { LoadedRepository, LoadOptions } from '@/content/repository';
import { AppProviders } from '@/providers';
import type { KeyValueStore } from '@/storage/key-value-store';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** In-memory KeyValueStore for tests that should not touch AsyncStorage. */
export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
}

export interface RenderOptions {
  store?: KeyValueStore;
  loaded?: LoadedRepository;
  loadOptions?: LoadOptions;
}

/** Renders `ui` inside the app providers, with the verified bundled content by default. */
export async function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const loaded = options.loaded ?? (await loadBundledRepository(options.loadOptions));
  const loader = () => Promise.resolve(loaded);
  const result = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppProviders store={options.store} loader={loader}>
        {ui}
      </AppProviders>
    </SafeAreaProvider>,
  );
  return { ...result, loaded };
}
