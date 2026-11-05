type Listener = (event: Record<string, unknown>) => void;

/**
 * A stand-in for `document` under Jest, which has none: the page title, the key listeners that the
 * shell and the dialogs add (`keydown`, `pointerdown`) and what the web modal behaviour reads.
 */
export interface FakeDocument {
  title: string;
  activeElement: null;
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  getElementById(id: string): null;
  /** How many listeners of this type are registered now. */
  listening(type: string): number;
  /** Calls the listeners of a type, as the browser would for an event. */
  dispatch(type: string, event?: Record<string, unknown>): void;
}

/** Puts a fake `document` on the global object; call the returned function to take it away. */
export function installFakeDocument(): { document: FakeDocument; uninstall(): void } {
  const listeners = new Map<string, Set<Listener>>();
  const document: FakeDocument = {
    title: '',
    activeElement: null,
    addEventListener: (type, listener) => {
      const set = listeners.get(type) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    getElementById: () => null,
    listening: (type) => listeners.get(type)?.size ?? 0,
    dispatch: (type, event = {}) => {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    },
  };
  (globalThis as { document?: unknown }).document = document;
  return {
    document,
    uninstall: () => {
      delete (globalThis as { document?: unknown }).document;
    },
  };
}
