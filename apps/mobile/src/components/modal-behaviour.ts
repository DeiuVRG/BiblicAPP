import { useEffect, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';

// The parts of a modal layer (Dialog, Sheet) that react-native-web's `Modal` does not do by itself:
// the page behind it is inert (no focus, no pointer, hidden from assistive technology), and focus
// goes back to the control that opened it. `Modal` already traps the focus, closes on Escape
// (`onRequestClose`) and marks the layer `aria-modal`.

/** How many layers hold the page inert at the moment. */
let layers = 0;

const isWeb = () => Platform.OS === 'web' && typeof document !== 'undefined';

export function useWebModalBehaviour(active: boolean): void {
  // A layout effect runs before the `Modal` moves focus into itself: this is the opener.
  useLayoutEffect(() => {
    if (!active || !isWeb()) return undefined;
    const focused = document.activeElement as HTMLElement | null;
    const opener = focused && typeof focused.focus === 'function' ? focused : null;
    const root = document.getElementById('root');
    layers += 1;
    root?.setAttribute('inert', '');
    return () => {
      layers -= 1;
      if (layers <= 0) {
        layers = 0;
        root?.removeAttribute('inert');
      }
      // After the layer is gone, the opener gets the focus back (if it still exists).
      if (opener && opener !== document.body) {
        setTimeout(() => {
          if (document.contains(opener) && layers === 0) opener.focus();
        }, 0);
      }
    };
  }, [active]);
}

/**
 * Calls `onEscape` for the Escape key on web while `active` (a layer that is not a `Modal`, such
 * as a drawer or the reader's typography panel). The listener exists only while it is active, and
 * it always calls the latest `onEscape`, so a caller may pass an inline function.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  const latest = useRef(onEscape);
  useEffect(() => {
    latest.current = onEscape;
  });
  useEffect(() => {
    if (!active || !isWeb()) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current();
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [active]);
}
