import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// The keyboard of the reader on web (docs/ui-spec-v2.md, 8.13): ← and → between chapters, [ and ] for the outline,
// / and Ctrl or Cmd+K and Ctrl or Cmd+Shift+F for the find bar, Ctrl or Cmd+Shift+A for Ask, Escape for
// the topmost layer. The keys that are letters of a field (the arrows and the brackets included) are
// not taken while the focus is in an input.

export type ReaderKeyAction = 'previous' | 'next' | 'outline' | 'find' | 'ask' | 'escape';

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** What a key press does in the reader, or null for a key that is none of its business. */
export function readerKeyAction(event: KeyLike, inField: boolean): ReaderKeyAction | null {
  const command = event.ctrlKey === true || event.metaKey === true;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === 'Escape') return 'escape';
  if (command && !event.altKey) {
    if (key === 'k' && !event.shiftKey) return 'find';
    if (key === 'f' && event.shiftKey) return 'find';
    if (key === 'a' && event.shiftKey) return 'ask';
    return null;
  }
  if (event.altKey || inField) return null;
  switch (event.key) {
    case 'ArrowLeft':
      return 'previous';
    case 'ArrowRight':
      return 'next';
    case '[':
    case ']':
      return 'outline';
    case '/':
      return 'find';
    default:
      return null;
  }
}

/** True when the key press comes from a field (an input, a text area, an editable element). */
export function inEditableField(target: EventTarget | null): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = element?.tagName?.toLowerCase();
  return (
    tag === 'input' || tag === 'textarea' || tag === 'select' || element?.isContentEditable === true
  );
}

export type ReaderKeyHandlers = Partial<Record<ReaderKeyAction, () => void>>;

/**
 * Listens for the keys on web while `active` (a modal layer on top of the reader turns it off). The
 * handlers are the latest ones at each key, so a caller may pass new functions at every render. A key
 * the handlers use is not left to the browser (the slash would otherwise be typed into the find field).
 */
export function useReaderKeys(active: boolean, handlers: ReaderKeyHandlers): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const onKey = (event: KeyboardEvent) => {
      const action = readerKeyAction(event, inEditableField(event.target));
      const handler = action === null ? undefined : latest.current[action];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    // The document is kept: the listener comes off the one it went onto, even if the global is gone by then.
    const page = document;
    page.addEventListener('keydown', onKey);
    return () => page.removeEventListener('keydown', onKey);
  }, [active]);
}
