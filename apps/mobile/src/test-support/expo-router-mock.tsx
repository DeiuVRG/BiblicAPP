import { cloneElement, useEffect, useSyncExternalStore } from 'react';
import type { ReactElement } from 'react';

/**
 * Minimal stand-in for `expo-router` in component tests:
 *   jest.mock('expo-router', () => require('@/test-support/expo-router-mock'));
 * `Link asChild` makes its child call `router.push(href)`; `Stack.Screen` renders nothing but
 * records its `options` in `screenOptions`. The route params are state: `setMockParams` sets them
 * and `router.setParams` merges into them, like the real router, and whatever reads them with
 * `useLocalSearchParams()` re-renders.
 */
type Params = Record<string, string | string[] | undefined>;

let params: Params = {};
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
  children: ReactElement<{ onPress?: () => void }>;
}) {
  return cloneElement(children, { onPress: () => router.push(href) });
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
/** Runs the effect once on mount (focus is not modelled). */
export function useFocusEffect(effect: () => void | (() => void)) {
  useEffect(effect, [effect]);
}

export const useLocalSearchParams = () => useSyncExternalStore(subscribe, () => params);
