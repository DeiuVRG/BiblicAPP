import { createHash, timingSafeEqual } from 'node:crypto';

import { DEFAULT_ACCESS_FAILURES } from '../config';
import type { RateLimitConfig } from '../config';
import { TokenBucketLimiter } from './rate-limit';

/** The outcome of checking a presented access code. */
export type AccessVerdict = 'granted' | 'missing' | 'invalid';

export interface AccessGateOptions {
  /** Wrong codes one client may present, and over how long, before it is locked out. */
  failures?: RateLimitConfig;
  /** Injected clock (milliseconds), for tests. */
  now?: () => number;
}

/** What to do with a request, once the lockout of repeated wrong codes is taken into account. */
export type AccessDecision =
  | { granted: true }
  /** No code was presented: what a first visit looks like. Costs the client nothing. */
  | { granted: false; reason: 'missing' }
  /**
   * A code was presented and is wrong. It used up one of the client's attempts; when it was the
   * last one, `lockedOutForSeconds` says how long the client is refused from now on.
   */
  | { granted: false; reason: 'invalid'; lockedOutForSeconds?: number }
  /** The client has presented too many wrong codes: its request was refused without looking at its code. */
  | { granted: false; reason: 'locked'; retryAfterSeconds: number };

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * The tester access codes of the closed beta (`ACCESS_CODE`). The codes are kept only as SHA-256
 * digests and the presented code is compared with every one of them using `timingSafeEqual`, with
 * no early exit, so neither how long a comparison takes nor which code matched tells a caller how
 * close a guess was. With no code configured the beta is open and every request is granted.
 *
 * Guessing is slowed down per client address (`admit`): every wrong code uses one of a small
 * allowance that refills over time, and a client that has run out is refused without its code
 * being looked at, so that a guesser cannot even tell when it hit. The allowance is its own bucket,
 * never a token of the question limiter.
 */
export class AccessGate {
  private readonly digests: readonly Buffer[];
  private readonly failures: TokenBucketLimiter;

  constructor(codes: readonly string[], options: AccessGateOptions = {}) {
    this.digests = codes.map(digest);
    this.failures = new TokenBucketLimiter({
      ...(options.failures ?? DEFAULT_ACCESS_FAILURES),
      ...(options.now !== undefined ? { now: options.now } : {}),
    });
  }

  /** Whether a code is asked for at all. */
  get required(): boolean {
    return this.digests.length > 0;
  }

  /** Whether the code is one of the configured ones. Pure: it keeps no count of failures. */
  check(presented: string | undefined): AccessVerdict {
    if (!this.required) return 'granted';
    if (presented === undefined || presented === '') return 'missing';
    const candidate = digest(presented);
    let matched = false;
    for (const known of this.digests) matched = timingSafeEqual(known, candidate) || matched;
    return matched ? 'granted' : 'invalid';
  }

  /**
   * Decides a request of `client` (the key it is rate limited under) that presents `presented`.
   * Only a code that is present and wrong counts against the client: a missing one costs nothing
   * (the app sends none until the person has typed it) and a right one is never charged, but a
   * right one does not clear earlier failures either, or a tester could use their own code to keep
   * guessing at the others.
   */
  admit(client: string, presented: string | undefined): AccessDecision {
    if (!this.required) return { granted: true };
    const standing = this.failures.peek(client);
    if (!standing.allowed) {
      return { granted: false, reason: 'locked', retryAfterSeconds: standing.retryAfterSeconds };
    }
    const verdict = this.check(presented);
    if (verdict === 'granted') return { granted: true };
    if (verdict === 'missing') return { granted: false, reason: 'missing' };
    this.failures.take(client);
    const after = this.failures.peek(client);
    return after.allowed
      ? { granted: false, reason: 'invalid' }
      : { granted: false, reason: 'invalid', lockedOutForSeconds: after.retryAfterSeconds };
  }
}
