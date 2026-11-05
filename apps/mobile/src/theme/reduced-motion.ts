import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * What the platform says without being asked asynchronously. On web `prefers-reduced-motion` can
 * be read at once, so the very first frame already knows (a hero bar must be there from the first
 * frame, not appear after the answer arrives). iOS and Android only answer through a promise: they
 * start as false until it resolves.
 */
function initialReducedMotion(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Whether the user asked for reduced motion (`prefers-reduced-motion` on web, the system setting
 * on iOS and Android). The hero sweep, the pulse, the shimmer and the drawer transitions are off
 * when it is true, and state changes are instant (docs/ui-spec-v2.md, section 2.6). On web the
 * first render already has the answer; on native it starts as false until the platform has
 * answered.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(initialReducedMotion);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (!cancelled) setReduced(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduced);
    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);
  return reduced;
}
