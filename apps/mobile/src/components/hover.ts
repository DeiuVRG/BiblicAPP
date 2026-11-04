import { useMemo, useState } from 'react';

/**
 * Pointer hover for web. React Native's `Pressable` reports hover through `onHoverIn` and
 * `onHoverOut` (only react-native-web fires them), which keeps this independent of the style
 * callback and therefore usable with `Link asChild` (which needs a plain style object).
 */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  const hoverProps = useMemo(
    () => ({ onHoverIn: () => setHovered(true), onHoverOut: () => setHovered(false) }),
    [],
  );
  return { hovered, hoverProps };
}
