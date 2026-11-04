import { describe, expect, it } from 'vitest';

import { rateLimitKey } from './client-ip';
import { TokenBucketLimiter } from './rate-limit';

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('TokenBucketLimiter', () => {
  it('allows a burst of the capacity, then refuses', () => {
    const time = clock();
    const limiter = new TokenBucketLimiter({ capacity: 3, windowMs: 60_000, now: time.now });
    expect([1, 2, 3].map(() => limiter.take('a').allowed)).toEqual([true, true, true]);
    const denied = limiter.take('a');
    expect(denied).toMatchObject({ allowed: false, remaining: 0, limit: 3 });
    expect(denied.retryAfterSeconds).toBe(20); // 3 per 60 s: one token every 20 s
  });

  it('counts remaining requests', () => {
    const limiter = new TokenBucketLimiter({ capacity: 20, windowMs: 600_000, now: clock().now });
    expect(limiter.take('a').remaining).toBe(19);
    expect(limiter.take('a').remaining).toBe(18);
  });

  it('refills continuously: 20 per 10 minutes is one more every 30 seconds', () => {
    const time = clock();
    const limiter = new TokenBucketLimiter({ capacity: 20, windowMs: 600_000, now: time.now });
    for (let i = 0; i < 20; i += 1) expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
    time.advance(29_000);
    expect(limiter.take('a').allowed).toBe(false);
    time.advance(1_000);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
    time.advance(600_000);
    expect(limiter.take('a').remaining).toBe(19); // never beyond the capacity
  });

  it('keeps clients apart and does not charge a refused request', () => {
    const time = clock();
    const limiter = new TokenBucketLimiter({ capacity: 1, windowMs: 10_000, now: time.now });
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('b').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
    time.advance(5_000);
    expect(limiter.take('a').allowed).toBe(false); // half a token, and the refusals cost nothing
    time.advance(5_000);
    expect(limiter.take('a').allowed).toBe(true);
  });

  it('forgets idle clients when it has too many', () => {
    const time = clock();
    const limiter = new TokenBucketLimiter({
      capacity: 2,
      windowMs: 1_000,
      now: time.now,
      maxKeys: 3,
    });
    for (const key of ['a', 'b', 'c']) limiter.take(key);
    time.advance(10_000); // all refilled
    limiter.take('d');
    expect(limiter.size).toBeLessThanOrEqual(3);
    limiter.take('e');
    limiter.take('f');
    expect(limiter.size).toBeLessThanOrEqual(3);
  });
});

describe('TokenBucketLimiter.peek', () => {
  it('says what take would answer without using a token', () => {
    const time = clock();
    const limiter = new TokenBucketLimiter({ capacity: 2, windowMs: 60_000, now: time.now });
    for (let i = 0; i < 5; i += 1) expect(limiter.peek('a')).toMatchObject({ allowed: true });
    // Looking never used a token: both are still there.
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.peek('a')).toMatchObject({ allowed: false, remaining: 0, limit: 2 });
    expect(limiter.take('a').allowed).toBe(false);
  });

  it('reports the wait, and follows the refill', () => {
    const time = clock();
    const limiter = new TokenBucketLimiter({ capacity: 2, windowMs: 60_000, now: time.now });
    limiter.take('a');
    limiter.take('a');
    expect(limiter.peek('a').retryAfterSeconds).toBe(30); // 2 per 60 s: one token every 30 s
    time.advance(10_000);
    expect(limiter.peek('a').retryAfterSeconds).toBe(20);
    time.advance(20_000);
    expect(limiter.peek('a')).toMatchObject({ allowed: true, retryAfterSeconds: 0, remaining: 0 });
  });

  it('counts the remaining requests like take does', () => {
    const limiter = new TokenBucketLimiter({ capacity: 20, windowMs: 600_000, now: clock().now });
    expect(limiter.peek('a').remaining).toBe(19); // a full bucket, minus the request being asked about
    limiter.take('a');
    expect(limiter.peek('a').remaining).toBe(18);
  });

  it('does not start tracking a client, so that looking cannot grow the table', () => {
    const limiter = new TokenBucketLimiter({ capacity: 2, windowMs: 1_000, now: clock().now });
    for (let i = 0; i < 100; i += 1) limiter.peek(`client-${i}`);
    expect(limiter.size).toBe(0);
  });

  it('prices a request of any cost', () => {
    const limiter = new TokenBucketLimiter({ capacity: 5, windowMs: 50_000, now: clock().now });
    expect(limiter.peek('a', 5).allowed).toBe(true);
    expect(limiter.peek('a', 6)).toMatchObject({ allowed: false, retryAfterSeconds: 10 });
  });
});

describe('rateLimitKey', () => {
  it('keeps IPv4 addresses as they are and groups IPv6 by /64', () => {
    expect(rateLimitKey('203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:0db8:0001:0002::/64');
    expect(rateLimitKey('2001:db8:1:2::1')).toBe('2001:0db8:0001:0002::/64');
    expect(rateLimitKey('2001:db8:1:2:ffff::')).toBe('2001:0db8:0001:0002::/64');
    expect(rateLimitKey('2001:db8:1:3::1')).not.toBe(rateLimitKey('2001:db8:1:2::1'));
  });

  it('sees through IPv4-mapped IPv6 and copes with odd input', () => {
    expect(rateLimitKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitKey('::ffff:cb00:7107')).toBe('203.0.113.7');
    expect(rateLimitKey('')).toBe('unknown');
    expect(rateLimitKey('Not-An-IP')).toBe('not-an-ip');
    expect(rateLimitKey('fe80::1%eth0')).toBe('fe80:0000:0000:0000::/64');
  });
});
