import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { useStorage } from '@/storage/key-value-store';

import { sanitizeSettings } from './sanitize';
import { loadSettings, saveSettings } from './settings-store';
import { DEFAULT_SETTINGS } from './types';
import type { ReaderSettings } from './types';

interface SettingsContextValue {
  settings: ReaderSettings;
  /** False until the stored settings have been read. */
  ready: boolean;
  update(patch: Partial<ReaderSettings>): void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  ready: false,
  update: () => undefined,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const store = useStorage();
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const touched = useRef(false);
  const latest = useRef(settings);

  useEffect(() => {
    let cancelled = false;
    void loadSettings(store).then((stored) => {
      if (cancelled) return;
      // A change made before the load finished wins over the stored value.
      if (!touched.current) {
        latest.current = stored;
        setSettings(stored);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const update = useCallback(
    (patch: Partial<ReaderSettings>) => {
      touched.current = true;
      const next = sanitizeSettings({ ...latest.current, ...patch });
      latest.current = next;
      setSettings(next);
      void saveSettings(store, next);
    },
    [store],
  );

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
