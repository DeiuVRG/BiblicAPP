import { savePosition } from './position-store';
import type { KeyValueStore } from '@/storage/key-value-store';

const SAVE_DELAY_MS = 500;

/**
 * Debounced persistence of the reading position of one work. `track()` is cheap and may be
 * called on every scroll. Nothing is written before `enable()`, so the position that is being
 * restored is not overwritten by the initial top-of-page position. Methods are arrow
 * properties so they can be passed around as stable callbacks.
 */
export class PositionWriter {
  private enabled = false;
  private pending: string | null | undefined = undefined;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private store: KeyValueStore,
    private workId: string,
    private sectionId: string,
  ) {}

  configure(store: KeyValueStore, workId: string, sectionId: string): void {
    this.store = store;
    this.workId = workId;
    this.sectionId = sectionId;
  }

  track = (paragraphId: string | null): void => {
    this.pending = paragraphId;
    if (!this.enabled) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.flush, SAVE_DELAY_MS);
  };

  enable = (): void => {
    this.enabled = true;
    // Opening a section always records it, even if the user never scrolls.
    if (this.pending === undefined) this.pending = null;
    this.flush();
  };

  flush = (): void => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.enabled || this.pending === undefined) return;
    const paragraphId = this.pending;
    this.pending = undefined;
    void savePosition(this.store, this.workId, { sectionId: this.sectionId, paragraphId });
  };
}
