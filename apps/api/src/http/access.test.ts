import { describe, expect, it } from 'vitest';

import { DEFAULT_ACCESS_FAILURES } from '../config';
import { AccessGate } from './access';

describe('AccessGate', () => {
  it('lets everything through when no code is configured (open beta)', () => {
    const gate = new AccessGate([]);
    expect(gate.required).toBe(false);
    expect(gate.check(undefined)).toBe('granted');
    expect(gate.check('anything')).toBe('granted');
  });

  it('knows a missing code from a wrong one', () => {
    const gate = new AccessGate(['tester-2026']);
    expect(gate.required).toBe(true);
    expect(gate.check(undefined)).toBe('missing');
    expect(gate.check('')).toBe('missing');
    expect(gate.check('tester-2025')).toBe('invalid');
    expect(gate.check('tester-2026 ')).toBe('invalid'); // no trimming, no prefix or suffix matching
    expect(gate.check('TESTER-2026')).toBe('invalid');
    expect(gate.check('tester-20266')).toBe('invalid');
    expect(gate.check('tester')).toBe('invalid');
    expect(gate.check('tester-2026')).toBe('granted');
  });

  it('accepts any of several codes, and nothing that merely contains one', () => {
    const gate = new AccessGate(['alpha-one', 'beta-two', 'gamma-three']);
    for (const code of ['alpha-one', 'beta-two', 'gamma-three']) {
      expect(gate.check(code), code).toBe('granted');
    }
    expect(gate.check('alpha-one,beta-two')).toBe('invalid');
    expect(gate.check('alpha-one, beta-two')).toBe('invalid');
    expect(gate.check('delta-four')).toBe('invalid');
  });

  it('compares codes of any length (digests, not the codes, are compared)', () => {
    const gate = new AccessGate(['x'.repeat(128)]);
    expect(gate.check('x'.repeat(128))).toBe('granted');
    expect(gate.check('x'.repeat(127))).toBe('invalid');
    expect(gate.check('x'.repeat(5000))).toBe('invalid');
  });

  it('does not keep the codes themselves', () => {
    const gate = new AccessGate(['tester-2026']);
    expect(JSON.stringify(gate)).not.toContain('tester-2026');
    expect(Object.values(gate).flat().join()).not.toContain('tester-2026');
  });
});

describe('AccessGate.admit: wrong codes are throttled per client', () => {
  const CODE = 'tester-2026';
  /** Three wrong codes per minute: a burst of 3, then one more attempt every 20 seconds. */
  const failures = { capacity: 3, windowMs: 60_000 };

  function gateWithClock(codes: readonly string[] = [CODE]) {
    let now = 1_000_000;
    const gate = new AccessGate(codes, { failures, now: () => now });
    return { gate, advance: (ms: number) => (now += ms) };
  }

  it('asks nothing of anyone while no code is configured', () => {
    const gate = new AccessGate([]);
    expect(gate.admit('a', undefined)).toEqual({ granted: true });
    expect(gate.admit('a', 'whatever')).toEqual({ granted: true });
  });

  it('grants the right code and refuses a missing or wrong one, saying which', () => {
    const { gate } = gateWithClock();
    expect(gate.admit('a', CODE)).toEqual({ granted: true });
    expect(gate.admit('a', undefined)).toEqual({ granted: false, reason: 'missing' });
    expect(gate.admit('a', '')).toEqual({ granted: false, reason: 'missing' });
    expect(gate.admit('a', 'tester-2025')).toEqual({ granted: false, reason: 'invalid' });
  });

  it('has defaults for the allowance: 20 wrong codes per 10 minutes', () => {
    expect(DEFAULT_ACCESS_FAILURES).toEqual({ capacity: 20, windowMs: 600_000 });
    const gate = new AccessGate([CODE]);
    for (let i = 0; i < 19; i += 1) {
      expect(gate.admit('a', `wrong-${i}`)).toEqual({ granted: false, reason: 'invalid' });
    }
    expect(gate.admit('a', 'wrong-19')).toMatchObject({
      reason: 'invalid',
      lockedOutForSeconds: 30,
    });
    expect(gate.admit('a', 'wrong-20')).toMatchObject({ reason: 'locked', retryAfterSeconds: 30 });
  });

  it('locks a client out once its allowance of wrong codes is spent, and says for how long', () => {
    const { gate } = gateWithClock();
    expect(gate.admit('a', 'wrong-1')).toEqual({ granted: false, reason: 'invalid' });
    expect(gate.admit('a', 'wrong-2')).toEqual({ granted: false, reason: 'invalid' });
    // The third one is still looked at and is wrong, but it is the last: the failure says so.
    expect(gate.admit('a', 'wrong-3')).toEqual({
      granted: false,
      reason: 'invalid',
      lockedOutForSeconds: 20,
    });
    expect(gate.admit('a', 'wrong-4')).toEqual({
      granted: false,
      reason: 'locked',
      retryAfterSeconds: 20,
    });
  });

  it('refuses a locked-out client without looking at its code: even the right one', () => {
    const { gate, advance } = gateWithClock();
    for (let i = 0; i < 3; i += 1) gate.admit('a', `wrong-${i}`);
    // A guesser that hits the code meanwhile learns nothing: the answer is the same for all.
    expect(gate.admit('a', CODE)).toMatchObject({ granted: false, reason: 'locked' });
    expect(gate.admit('a', 'wrong')).toMatchObject({ granted: false, reason: 'locked' });
    expect(gate.admit('a', undefined)).toMatchObject({ granted: false, reason: 'locked' });
    advance(19_000);
    expect(gate.admit('a', CODE)).toEqual({
      granted: false,
      reason: 'locked',
      retryAfterSeconds: 1,
    });
    advance(1_500); // the allowance has refilled by one attempt
    expect(gate.admit('a', CODE)).toEqual({ granted: true });
  });

  it('gives back one attempt per refill, not the whole allowance', () => {
    const { gate, advance } = gateWithClock();
    for (let i = 0; i < 3; i += 1) gate.admit('a', `wrong-${i}`);
    advance(20_500);
    // One attempt is back; a wrong code spends it and locks the client out again.
    expect(gate.admit('a', 'wrong-again')).toMatchObject({
      reason: 'invalid',
      lockedOutForSeconds: expect.any(Number),
    });
    expect(gate.admit('a', CODE)).toMatchObject({ granted: false, reason: 'locked' });
    advance(60_000 * 10); // long idle: back to a full allowance, never beyond it
    for (let i = 0; i < 2; i += 1) {
      expect(gate.admit('a', `wrong-${i}`)).toEqual({ granted: false, reason: 'invalid' });
    }
    expect(gate.admit('a', 'wrong-last')).toMatchObject({ lockedOutForSeconds: 20 });
  });

  it('charges only a wrong code: a missing one costs nothing, a right one nothing either', () => {
    const { gate } = gateWithClock();
    for (let i = 0; i < 100; i += 1) {
      expect(gate.admit('a', undefined)).toEqual({ granted: false, reason: 'missing' });
      expect(gate.admit('a', CODE)).toEqual({ granted: true });
    }
    // The allowance is intact: three wrong codes are looked at before the lockout.
    expect(gate.admit('a', 'wrong-1')).toEqual({ granted: false, reason: 'invalid' });
    expect(gate.admit('a', 'wrong-2')).toEqual({ granted: false, reason: 'invalid' });
    expect(gate.admit('a', 'wrong-3')).toMatchObject({ reason: 'invalid' });
  });

  it('does not let a right code clear earlier failures (no guessing at other codes with your own)', () => {
    const { gate } = gateWithClock(['first-code-0001', 'second-code-0002']);
    gate.admit('a', 'wrong-1');
    gate.admit('a', 'wrong-2');
    expect(gate.admit('a', 'first-code-0001')).toEqual({ granted: true });
    // Had the right code reset the count, this would still be a plain failure.
    expect(gate.admit('a', 'wrong-3')).toMatchObject({
      reason: 'invalid',
      lockedOutForSeconds: 20,
    });
    expect(gate.admit('a', 'second-code-0002')).toMatchObject({ reason: 'locked' });
  });

  it('keeps clients apart: one guesser does not lock the others out', () => {
    const { gate } = gateWithClock();
    for (let i = 0; i < 50; i += 1) gate.admit('guesser', `wrong-${i}`);
    expect(gate.admit('guesser', CODE)).toMatchObject({ reason: 'locked' });
    expect(gate.admit('tester', CODE)).toEqual({ granted: true });
    expect(gate.admit('tester', 'typo')).toEqual({ granted: false, reason: 'invalid' });
  });

  it('does not track clients that never presented a wrong code', () => {
    // Memory: the table grows with guessers only, not with every address that ever asked.
    const { gate } = gateWithClock();
    for (let i = 0; i < 200; i += 1) {
      gate.admit(`10.0.0.${i}`, CODE);
      gate.admit(`10.1.0.${i}`, undefined);
    }
    expect((gate as unknown as { failures: { size: number } }).failures.size).toBe(0);
  });

  it('does not keep the wrong codes it was shown, nor the right ones', () => {
    const { gate } = gateWithClock();
    gate.admit('a', 'a-guess-that-must-not-linger');
    gate.admit('a', CODE);
    const dump = JSON.stringify(gate) + Object.values(gate).flat().join();
    expect(dump).not.toContain('a-guess-that-must-not-linger');
    expect(dump).not.toContain(CODE);
  });
});
