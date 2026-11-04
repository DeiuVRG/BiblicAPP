export interface BucketDecision {
  allowed: boolean;
  limit: number;
  /** Whole requests left after this one. */
  remaining: number;
  /** When denied: seconds until a request would be allowed. */
  retryAfterSeconds: number;
}

export interface TokenBucketOptions {
  /** Burst size, and the number of requests allowed per window. */
  capacity: number;
  windowMs: number;
  /** Injected clock (milliseconds), for tests. */
  now?: () => number;
  /** Upper bound on tracked clients; the idlest are dropped beyond it. */
  maxKeys?: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * A token bucket per key: it holds up to `capacity` requests and refills continuously at
 * `capacity` per `windowMs`. 20 per 10 minutes therefore allows a burst of 20, then one more every
 * 30 seconds. A denied request does not use up a token.
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly now: () => number;
  private readonly maxKeys: number;

  constructor(options: TokenBucketOptions) {
    this.capacity = options.capacity;
    this.refillPerMs = options.capacity / options.windowMs;
    this.now = options.now ?? Date.now;
    this.maxKeys = options.maxKeys ?? 100_000;
  }

  take(key: string, cost = 1): BucketDecision {
    const now = this.now();
    const existing = this.buckets.get(key);
    let tokens = this.capacity;
    if (existing !== undefined) {
      tokens = Math.min(
        this.capacity,
        existing.tokens + (now - existing.updatedAt) * this.refillPerMs,
      );
      this.buckets.delete(key); // re-inserted below: Map order doubles as least-recently-used order
    }
    if (tokens >= cost) {
      tokens -= cost;
      this.buckets.set(key, { tokens, updatedAt: now });
      this.evict();
      return {
        allowed: true,
        limit: this.capacity,
        remaining: Math.floor(tokens),
        retryAfterSeconds: 0,
      };
    }
    this.buckets.set(key, { tokens, updatedAt: now });
    this.evict();
    return {
      allowed: false,
      limit: this.capacity,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((cost - tokens) / this.refillPerMs / 1000)),
    };
  }

  get size(): number {
    return this.buckets.size;
  }

  private evict(): void {
    if (this.buckets.size <= this.maxKeys) return;
    const now = this.now();
    // First drop clients whose bucket has refilled completely (they are indistinguishable from new)…
    for (const [key, bucket] of this.buckets) {
      if (this.buckets.size <= this.maxKeys) return;
      if (bucket.tokens + (now - bucket.updatedAt) * this.refillPerMs >= this.capacity)
        this.buckets.delete(key);
    }
    // …then the least recently used.
    for (const key of this.buckets.keys()) {
      if (this.buckets.size <= this.maxKeys) return;
      this.buckets.delete(key);
    }
  }
}
