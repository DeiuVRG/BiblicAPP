import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const COARSE = '(pointer: coarse)';

function mediaQuery(): MediaQueryList | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return typeof window.matchMedia === 'function' ? window.matchMedia(COARSE) : null;
}

/**
 * Whether the main pointer is a finger. On web that is the `(pointer: coarse)` media feature (a
 * tablet or a phone, also a wide one); on iOS and Android it is always true. A control that is
 * smaller than 44 points for a mouse on a wide screen (the `Disclosure` summary, 36) is 44 high
 * for a finger, whatever the width of the window (docs/ui-spec-v2.md, 18 and check G6b).
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() =>
    Platform.OS === 'web' ? (mediaQuery()?.matches ?? false) : true,
  );
  useEffect(() => {
    const query = mediaQuery();
    if (!query) return undefined;
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return coarse;
}
