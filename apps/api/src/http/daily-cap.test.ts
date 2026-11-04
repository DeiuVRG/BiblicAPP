import { describe, expect, it } from 'vitest';

import { capturingLogger } from '../test-support';
import { DailyQuestionCap, secondsUntilMidnightUtc, utcDay } from './daily-cap';

const at = (iso: string): number => Date.parse(iso);

function setup(limit: number, start = '2026-11-04T10:00:00Z') {
  const clock = { ms: at(start) };
  const { logger, lines } = capturingLogger();
  const cap = new DailyQuestionCap({ limit, logger, now: () => clock.ms });
  return { cap, clock, lines };
}

describe('time helpers', () => {
  it('names the UTC day and counts the seconds to its end', () => {
    expect(utcDay(at('2026-11-04T23:59:59Z'))).toBe('2026-11-04');
    expect(utcDay(at('2026-11-05T00:00:00Z'))).toBe('2026-11-05');
    expect(secondsUntilMidnightUtc(at('2026-11-04T23:59:00Z'))).toBe(60);
    expect(secondsUntilMidnightUtc(at('2026-11-04T00:00:00Z'))).toBe(86_400);
    expect(secondsUntilMidnightUtc(at('2026-11-04T12:00:00.500Z'))).toBe(43_200);
    expect(secondsUntilMidnightUtc(at('2026-12-31T23:59:59.900Z'))).toBe(1); // across a year
    expect(secondsUntilMidnightUtc(at('2026-02-28T12:00:00Z'))).toBe(43_200); // not a leap year
  });
});

describe('DailyQuestionCap', () => {
  it('does nothing when the limit is 0', () => {
    const { cap, lines } = setup(0);
    expect(cap.enabled).toBe(false);
    for (let i = 0; i < 1000; i += 1) expect(cap.tryAcquire().allowed).toBe(true);
    expect(cap.count).toBe(0);
    expect(lines).toEqual([]);
  });

  it('lets in as many questions as the limit and then refuses until midnight UTC', () => {
    const { cap, clock } = setup(3, '2026-11-04T22:30:00Z');
    expect(cap.enabled).toBe(true);
    for (let i = 0; i < 3; i += 1) expect(cap.tryAcquire().allowed, `question ${i + 1}`).toBe(true);
    expect(cap.count).toBe(3);
    const refused = cap.tryAcquire();
    expect(refused).toEqual({ allowed: false, retryAfterSeconds: 90 * 60 });
    expect(cap.count).toBe(3); // a refusal costs nothing
    clock.ms = at('2026-11-04T23:59:59Z');
    expect(cap.tryAcquire()).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('starts again with the next UTC day', () => {
    const { cap, clock, lines } = setup(1, '2026-11-04T23:59:30Z');
    expect(cap.tryAcquire().allowed).toBe(true);
    expect(cap.tryAcquire().allowed).toBe(false);
    clock.ms = at('2026-11-05T00:00:00Z');
    expect(cap.count).toBe(0);
    expect(cap.tryAcquire().allowed).toBe(true);
    expect(cap.tryAcquire().allowed).toBe(false);
    expect(lines.find((line) => line.msg === 'daily_cap.reset')).toMatchObject({
      previousDay: '2026-11-04',
      previousCount: 1,
      day: '2026-11-05',
    });
  });

  it('gives a slot back once, and only on the day it was taken', () => {
    const { cap, clock } = setup(2);
    const first = cap.tryAcquire();
    if (!first.allowed) throw new Error('expected a slot');
    expect(cap.count).toBe(1);
    first.slot.release();
    first.slot.release(); // a second call changes nothing
    expect(cap.count).toBe(0);
    // Taken before midnight, given back after: the new day's count is not touched.
    clock.ms = at('2026-11-04T23:59:59Z');
    const late = cap.tryAcquire();
    if (!late.allowed) throw new Error('expected a slot');
    clock.ms = at('2026-11-05T00:00:01Z');
    const early = cap.tryAcquire();
    expect(early.allowed).toBe(true);
    expect(cap.count).toBe(1);
    late.slot.release();
    expect(cap.count).toBe(1);
  });

  it('counts questions that arrive together: nobody slips under the cap', () => {
    const { cap } = setup(5);
    const decisions = Array.from({ length: 12 }, () => cap.tryAcquire());
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(5);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(7);
  });

  it('logs every change of the count, the moment the cap is reached and every refusal', () => {
    const { cap, lines } = setup(2);
    const first = cap.tryAcquire();
    cap.tryAcquire();
    cap.tryAcquire(); // refused
    if (first.allowed) first.slot.release();
    expect(lines.map((line) => line.msg)).toEqual([
      'daily_cap.count',
      'daily_cap.count',
      'daily_cap.reached',
      'daily_cap.refused',
      'daily_cap.count',
    ]);
    expect(lines[0]).toMatchObject({ day: '2026-11-04', count: 1, cap: 2, change: 1 });
    expect(lines[2]).toMatchObject({ count: 2, cap: 2 });
    expect(lines[3]).toMatchObject({ count: 2, cap: 2 });
    expect(lines[3]!.retryAfterSeconds).toBe(14 * 3600);
    expect(lines[4]).toMatchObject({ count: 1, cap: 2, change: -1 });
  });
});
