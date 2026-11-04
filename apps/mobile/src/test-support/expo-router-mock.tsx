import { cloneElement } from 'react';
import type { ReactElement } from 'react';

/**
 * Minimal stand-in for `expo-router` in component tests:
 *   jest.mock('expo-router', () => require('@/test-support/expo-router-mock'));
 * `Link asChild` makes its child call `router.push(href)`; `Stack.Screen` renders nothing.
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

export const Stack = { Screen: () => null };

export const useRouter = () => router;
export const useLocalSearchParams = () => ({});
