import { useEffect, useMemo, useRef } from 'react';

import { savePosition } from '@/reading/position-store';
import { useStorage } from '@/storage/key-value-store';

const SAVE_DELAY_MS = 500;

/**
 * Debounced persistence of the reading position of one work. `track(paragraphId)` is cheap and
 * may be called on every scroll; nothing is written before `enable()` (so the position that is
 * being restored is not overwritten by the initial top-of-page position). Pending writes are
 * flushed on unmount.
 */
export function useReadingPositionWriter(workId: string, sectionId: string) {
  const store = useStorage();
  const enabled = useRef(false);
  const pending = useRef<string | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ store, workId, sectionId });
  latest.current = { store, workId, sectionId };

  const flush = useRef(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!enabled.current || pending.current === undefined) return;
    const { store: s, workId: w, sectionId: sec } = latest.current;
    const paragraphId = pending.current;
    pending.current = undefined;
    void savePosition(s, w, { sectionId: sec, paragraphId });
  });

  const track = useRef((paragraphId: string | null) => {
    pending.current = paragraphId;
    if (!enabled.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush.current, SAVE_DELAY_MS);
  });

  const enable = useRef(() => {
    enabled.current = true;
    // Opening a section always records it, even if the user never scrolls.
    if (pending.current === undefined) pending.current = null;
    flush.current();
  });

  useEffect(() => {
    const doFlush = flush.current;
    return () => doFlush();
  }, []);

  // Stable identity so effects and FlatList callbacks that use it do not re-run on every render.
  return useMemo(() => ({ track: track.current, enable: enable.current }), []);
}
