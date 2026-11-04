import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { SettingsProvider, useSettings } from '@/settings/settings-context';
import { SETTINGS_KEY } from '@/settings/settings-store';
import { StorageProvider } from '@/storage/key-value-store';
import type { KeyValueStore } from '@/storage/key-value-store';

type SettingsApi = ReturnType<typeof useSettings>;
const sink: { current?: SettingsApi } = {};
function Probe() {
  const value = useSettings();
  useEffect(() => {
    sink.current = value;
  });
  return <Text>{value.ready ? 'ready' : 'loading'}</Text>;
}

describe('SettingsProvider', () => {
  it('does not overwrite stored fields when update() runs before the stored settings load', async () => {
    const data = new Map([
      [SETTINGS_KEY, JSON.stringify({ fontSize: 22, lineHeight: 1.7, theme: 'dark' })],
    ]);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store: KeyValueStore = {
      getItem: async (key) => {
        await gate;
        return data.get(key) ?? null;
      },
      setItem: async (key, value) => {
        data.set(key, value);
      },
    };

    await render(
      <StorageProvider store={store}>
        <SettingsProvider>
          <Probe />
        </SettingsProvider>
      </StorageProvider>,
    );
    expect(sink.current?.ready).toBe(false);

    // The user changes only the theme while the stored settings are still being read.
    await act(async () => {
      sink.current?.update({ theme: 'sepia' });
    });
    await act(async () => {
      release();
      await gate;
    });

    expect(sink.current?.ready).toBe(true);
    expect(sink.current?.settings).toEqual({ fontSize: 22, lineHeight: 1.7, theme: 'sepia' });
    expect(JSON.parse(data.get(SETTINGS_KEY)!)).toEqual({
      fontSize: 22,
      lineHeight: 1.7,
      theme: 'sepia',
    });
  });
});
