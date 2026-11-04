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
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { duration, elevationStyle, motion, radii } from '@/theme/tokens';

interface ToastApi {
  /** Shows a message for 3 seconds ("Link copiat."); a new message replaces the one on screen. */
  show(message: string): void;
}

const ToastContext = createContext<ToastApi>({ show: () => undefined });

/** Shows messages through `useToast().show`. Mount it once, above the screens. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [shown] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    timer.current = null;
    setMessage(null);
  }, []);

  const show = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      // iOS reads a live region only when the focus is on it: say it out loud instead.
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(next);
      timer.current = setTimeout(hide, motion.toast);
    },
    [hide],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // The message fades in and out; nothing animates until there is one to show.
  const wasShown = useRef(false);
  useEffect(() => {
    const target = message === null ? 0 : 1;
    if (wasShown.current === (target === 1)) return undefined;
    wasShown.current = target === 1;
    if (reduced) {
      shown.setValue(target);
      return undefined;
    }
    const animation = Animated.timing(shown, {
      toValue: target,
      duration: duration.base,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [message, reduced, shown]);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The live region is always in the page, so that a screen reader sees the text arrive. */}
      <View
        pointerEvents="none"
        role="status"
        accessibilityLiveRegion="polite"
        testID="toast"
        style={[styles.region, { bottom: 24 + insets.bottom }]}
      >
        {message !== null ? (
          <Animated.View
            style={[
              styles.toast,
              { backgroundColor: colors.text, opacity: shown },
              elevationStyle('popover', colors),
            ]}
          >
            <AppText variant="meta" style={{ color: colors.background }} testID="toast-message">
              {message}
            </AppText>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

/** `show(message)` puts a one-line message at the bottom of the screen for 3 seconds. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  region: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    maxWidth: 480,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
});
