import { describe, expect, it } from 'vitest';

import { createLogger } from './logger';
import { LogHasher } from './privacy';

function capture(level: 'debug' | 'info' | 'warn' | 'error' | 'silent') {
  const lines: Array<Record<string, unknown>> = [];
  const logger = createLogger({
    level,
    now: () => new Date('2026-11-04T12:00:00.000Z'),
    write: (line) => lines.push(JSON.parse(line) as Record<string, unknown>),
  });
  return { logger, lines };
}

describe('logger', () => {
  it('writes one JSON object per call with level, time and message', () => {
    const { logger, lines } = capture('info');
    logger.info('hello', { a: 1 });
    expect(lines).toEqual([
      { level: 'info', time: '2026-11-04T12:00:00.000Z', msg: 'hello', a: 1 },
    ]);
  });

  it('drops what is below the level', () => {
    const { logger, lines } = capture('warn');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(lines.map((line) => line.level)).toEqual(['warn', 'error']);
    const silent = capture('silent');
    silent.logger.error('nothing');
    expect(silent.lines).toEqual([]);
  });

  it('adds child fields and serialises errors', () => {
    const { logger, lines } = capture('info');
    logger.child({ requestId: 'r1' }).error('failed', { err: new RangeError('bad') });
    expect(lines[0]).toMatchObject({
      requestId: 'r1',
      msg: 'failed',
      err: { name: 'RangeError', message: 'bad' },
    });
  });
});

describe('LogHasher', () => {
  it('is stable for one salt, ignores case and spacing, and differs between salts', () => {
    const a = new LogHasher('first-salt-value');
    const b = new LogHasher('second-salt-value');
    expect(a.hash('What is grace?')).toBe(a.hash('  what is GRACE?  '));
    expect(a.hash('What is grace?')).not.toBe(a.hash('What is faith?'));
    expect(a.hash('What is grace?')).not.toBe(b.hash('What is grace?'));
    expect(a.hash('x')).toMatch(/^[0-9a-f]{16}$/);
    expect(a.hash('x', 8)).toHaveLength(8);
    expect(new LogHasher().hash('x')).toMatch(/^[0-9a-f]{16}$/);
  });
});
