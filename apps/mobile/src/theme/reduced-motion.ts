import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the user asked for reduced motion (`prefers-reduced-motion` on web, the system setting
 * on iOS and Android). The hero sweep, the pulse, the shimmer and the drawer transitions are off
 * when it is true, and state changes are instant (docs/ui-spec-v2.md, section 2.6). Starts as
 * false until the platform has answered.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
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
