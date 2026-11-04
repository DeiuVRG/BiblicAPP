import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { TrustProxy } from '../config';
import { clientAddress, rateLimitKey } from './client-ip';

/** What `clientAddress` returns for a request with these headers (no socket: `app.request`). */
async function addressOf(trust: TrustProxy, headers: Record<string, string>): Promise<string> {
  const app = new Hono();
  app.get('/', (c) => c.text(clientAddress(c, trust)));
  return (await app.request('/', { headers })).text();
}

describe('clientAddress', () => {
  it('ignores forwarding headers unless told to trust them', async () => {
    const headers = { 'fly-client-ip': '198.51.100.1', 'x-forwarded-for': '198.51.100.2' };
    expect(await addressOf('none', headers)).toBe('unknown'); // no socket in this harness
  });

  it('takes a valid address from Fly-Client-IP behind Fly', async () => {
    expect(await addressOf('fly', { 'fly-client-ip': '198.51.100.1' })).toBe('198.51.100.1');
    expect(await addressOf('fly', { 'fly-client-ip': ' 2001:db8::7 ' })).toBe('2001:db8::7');
  });

  it('takes the last valid X-Forwarded-For entry in xff mode', async () => {
    expect(await addressOf('xff', { 'x-forwarded-for': '10.9.9.9, 198.51.100.3' })).toBe(
      '198.51.100.3',
    );
  });

  it.each([
    'not-an-ip',
    '1.2.3',
    '999.1.1.1',
    '<script>alert(1)</script>',
    '198.51.100.1:443',
    'x'.repeat(5000),
  ])('does not take %j for an address, whoever sent it', async (value) => {
    // The socket address is used instead (here: none, because the harness has no socket).
    expect(await addressOf('fly', { 'fly-client-ip': value })).toBe('unknown');
    expect(await addressOf('xff', { 'x-forwarded-for': `198.51.100.9, ${value}` })).toBe('unknown');
  });
});

describe('clientAddress: a list in Fly-Client-IP', () => {
  it('is not an address (the Fly proxy sets exactly one)', async () => {
    expect(await addressOf('fly', { 'fly-client-ip': '198.51.100.1, 198.51.100.2' })).toBe(
      'unknown',
    );
  });
});

describe('rateLimitKey', () => {
  it('counts IPv4 addresses one by one, IPv6 by /64 and IPv4-mapped IPv6 as IPv4', () => {
    expect(rateLimitKey('198.51.100.1')).toBe('198.51.100.1');
    expect(rateLimitKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:0db8:0001:0002::/64');
    expect(rateLimitKey('2001:db8:1:2::1')).toBe(rateLimitKey('2001:db8:1:2:ffff::2'));
    expect(rateLimitKey('::ffff:198.51.100.1')).toBe('198.51.100.1');
  });

  it('keeps whatever is not an address short', () => {
    expect(rateLimitKey('')).toBe('unknown');
    expect(rateLimitKey('X'.repeat(500))).toHaveLength(64);
  });
});
