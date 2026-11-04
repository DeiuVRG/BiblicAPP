import type { Logger } from '../logger';

export interface DailyCapOptions {
  /** Questions per UTC day, all clients together; 0 turns the cap off. */
  limit: number;
  logger: Logger;
  /** Injected clock (milliseconds since the epoch), for tests. */
  now?: () => number;
}

/** One question counted against the cap. */
export interface CapSlot {
  /** Gives the question back (it never reached a model). Only the first call counts. */
  release(): void;
}

export type CapDecision =
  { allowed: true; slot: CapSlot } | { allowed: false; retryAfterSeconds: number };

const NO_SLOT: CapSlot = { release: () => undefined };

/** "2026-11-04": the UTC day a moment belongs to. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Seconds from `ms` to the next midnight UTC (at least 1). */
export function secondsUntilMidnightUtc(ms: number): number {
  const date = new Date(ms);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return Math.max(1, Math.ceil((midnight - ms) / 1000));
}

/**
 * A global brake on the cost of the beta: at most `limit` questions are answered per UTC day, all
 * clients together, so that the spend limit of the model account is not the only protection. A
 * question takes a slot before it is answered (so questions that arrive together cannot all slip
 * under the cap) and gives it back when it ended without a model call. The mock provider counts
 * too. The count is in memory, like the rate limiter's: it belongs to one machine and starts again
 * from zero when the process restarts. Every change of the count is logged.
 */
export class DailyQuestionCap {
  private readonly limit: number;
  private readonly logger: Logger;
  private readonly now: () => number;
  private day: string;
  private used = 0;

  constructor(options: DailyCapOptions) {
    this.limit = options.limit;
    this.logger = options.logger;
    this.now = options.now ?? Date.now;
    this.day = utcDay(this.now());
  }

  get enabled(): boolean {
    return this.limit > 0;
  }

  /** Questions counted so far on the current UTC day. */
  get count(): number {
    this.rollOver();
    return this.used;
  }

  /** Takes a slot for one question, or says how long until the cap starts over. */
  tryAcquire(): CapDecision {
    if (!this.enabled) return { allowed: true, slot: NO_SLOT };
    this.rollOver();
    if (this.used >= this.limit) {
      const retryAfterSeconds = secondsUntilMidnightUtc(this.now());
      this.logger.warn('daily_cap.refused', {
        day: this.day,
        count: this.used,
        cap: this.limit,
        retryAfterSeconds,
      });
      return { allowed: false, retryAfterSeconds };
    }
    this.used += 1;
    this.changed(1);
    if (this.used === this.limit) {
      this.logger.warn('daily_cap.reached', { day: this.day, count: this.used, cap: this.limit });
    }
    const day = this.day;
    let released = false;
    return {
      allowed: true,
      slot: {
        release: () => {
          if (released) return;
          released = true;
          // A question that began before midnight and ends after it belongs to the day that ended.
          if (day !== this.day || this.used === 0) return;
          this.used -= 1;
          this.changed(-1);
        },
      },
    };
  }

  private rollOver(): void {
    const today = utcDay(this.now());
    if (today === this.day) return;
    this.logger.info('daily_cap.reset', {
      previousDay: this.day,
      previousCount: this.used,
      day: today,
      cap: this.limit,
    });
    this.day = today;
    this.used = 0;
  }

  private changed(change: 1 | -1): void {
    this.logger.info('daily_cap.count', {
      day: this.day,
      count: this.used,
      cap: this.limit,
      change,
    });
  }
}
