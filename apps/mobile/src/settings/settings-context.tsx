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
  const loaded = useRef(false);
  // Changes made before the stored settings were read; merged on top of them after the load so
  // that fields the user did not touch are not overwritten with defaults.
  const pending = useRef<Partial<ReaderSettings>>({});
  const latest = useRef(settings);

  useEffect(() => {
    let cancelled = false;
    void loadSettings(store).then((stored) => {
      if (cancelled) return;
      loaded.current = true;
      const hasPending = Object.keys(pending.current).length > 0;
      const merged = hasPending ? sanitizeSettings({ ...stored, ...pending.current }) : stored;
      pending.current = {};
      latest.current = merged;
      setSettings(merged);
      if (hasPending) void saveSettings(store, merged);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const update = useCallback(
    (patch: Partial<ReaderSettings>) => {
      const next = sanitizeSettings({ ...latest.current, ...patch });
      latest.current = next;
      setSettings(next);
      if (loaded.current) void saveSettings(store, next);
      else pending.current = { ...pending.current, ...patch };
    },
    [store],
  );

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
