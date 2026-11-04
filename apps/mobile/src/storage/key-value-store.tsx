import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/** Minimal async key-value storage used for settings and reading positions. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Default implementation: AsyncStorage (localStorage on web). */
export const asyncStorageStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

const StoreContext = createContext<KeyValueStore>(asyncStorageStore);

/** Lets tests (or a future secure/synced store) replace the persistence layer. */
export function StorageProvider({ store, children }: { store: KeyValueStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStorage(): KeyValueStore {
  return useContext(StoreContext);
}
