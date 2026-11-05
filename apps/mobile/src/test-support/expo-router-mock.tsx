import { cloneElement, createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Minimal stand-in for `expo-router` in component tests:
 *   jest.mock('expo-router', () => require('@/test-support/expo-router-mock'));
 * `Link asChild` makes its child call `router.push(href)`; `Stack.Screen` renders nothing but
 * records its `options` in `screenOptions`. The route params are state: `setMockParams` sets them
 * and `router.setParams` merges into them, like the real router, and whatever reads them with
 * `useLocalSearchParams()` re-renders.
 *
 * Like the real one, `Link asChild` also hands its child a `ref` prop (`null` when the child has
 * none): the child is a function component, and in React 19 a ref is an ordinary prop, so a child
 * that spreads its props over a pressable can overwrite its own ref with it. `MockScreen` stands
 * for a screen of the stack: the screens that were left stay mounted and are not in focus.
 */
type Params = Record<string, string | string[] | undefined>;

let params: Params = {};
let pathname = '/';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replaces the params `useLocalSearchParams()` returns (tests start from `{}`). */
export function setMockParams(next: Params): void {
  params = next;
  listeners.forEach((listener) => listener());
}

/** Replaces the path `usePathname()` returns ("/library/all"); tests start from "/". */
export function setMockPathname(next: string): void {
  pathname = next;
  listeners.forEach((listener) => listener());
}

/** Puts the mock router back as a test found it: no params, the landing as the path. */
export function resetMockRouter(): void {
  params = {};
  pathname = '/';
  router.push.mockClear();
  router.replace.mockClear();
  router.back.mockClear();
  router.setParams.mockClear();
  listeners.forEach((listener) => listener());
}

export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn((patch: Params) => setMockParams({ ...params, ...patch })),
};

export function Link({
  href,
  children,
}: {
  href: unknown;
  children: ReactElement<{ onPress?: () => void; ref?: unknown }>;
}) {
  // What the slot of the real `Link` does: the child's own ref, or `null` when it has none.
  return cloneElement(children, {
    onPress: () => router.push(href),
    ref: children.props.ref ?? null,
  });
}

const FocusContext = createContext(true);

/**
 * A screen of the stack: what is inside it is in focus or not (`useIsFocused`, `useFocusEffect`).
 * A screen the reader came from stays mounted under the one on top and is not in focus.
 */
export function MockScreen({ focused, children }: { focused: boolean; children: ReactNode }) {
  return <FocusContext.Provider value={focused}>{children}</FocusContext.Provider>;
}

/** The `options` of every `Stack.Screen` rendered so far (newest last); tests can assert on them. */
export const screenOptions: Record<string, unknown>[] = [];

export const Stack = {
  Screen: ({ options }: { options?: Record<string, unknown> }) => {
    if (options) screenOptions.push(options);
    return null;
  },
};

export const useRouter = () => router;
/** Runs the effect while the screen it is in is in focus (`MockScreen`; a plain tree is in focus). */
export function useFocusEffect(effect: () => void | (() => void)) {
  const focused = useContext(FocusContext);
  useEffect(() => (focused ? effect() : undefined), [effect, focused]);
}

/** Whether the screen this is in is in focus (`MockScreen`; a plain tree is in focus). */
export const useIsFocused = () => useContext(FocusContext);

export const useLocalSearchParams = () => useSyncExternalStore(subscribe, () => params);
export const usePathname = () => useSyncExternalStore(subscribe, () => pathname);
