import { cloneElement, useEffect } from 'react';
import type { ReactElement } from 'react';

/**
 * Minimal stand-in for `expo-router` in component tests:
 *   jest.mock('expo-router', () => require('@/test-support/expo-router-mock'));
 * `Link asChild` makes its child call `router.push(href)`; `Stack.Screen` renders nothing but
 * records its `options` in `screenOptions`.
 */
export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
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

export const useLocalSearchParams = () => ({});
