import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';
import { isIP, isIPv4, isIPv6 } from 'node:net';

import type { TrustProxy } from '../config';

/** Expands an IPv6 address to eight 16-bit groups, or `null` when it is not valid. */
function expandIPv6(address: string): string[] | null {
  const bare = address.split('%')[0] ?? address;
  if (!isIPv6(bare)) return null;
  let text = bare;
  const embedded = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (embedded !== null) {
    const dotted = embedded[1] as string;
    const octets = dotted.split('.').map(Number);
    const high = (((octets[0] as number) << 8) | (octets[1] as number)).toString(16);
    const low = (((octets[2] as number) << 8) | (octets[3] as number)).toString(16);
    text = `${text.slice(0, -dotted.length)}${high}:${low}`;
  }
  const [head = '', tail] = text.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const fill = text.includes('::') ? 8 - left.length - right.length : 0;
  if (fill < 0) return null;
  const groups = [...left, ...Array<string>(fill).fill('0'), ...right];
  return groups.length === 8 ? groups.map((group) => group.padStart(4, '0')) : null;
}

/**
 * The key a client is rate limited under. IPv4 addresses count individually; IPv6 addresses by
 * their /64 prefix (one customer holds a whole /64, so per-address limits would be free to
 * dodge); IPv4-mapped IPv6 addresses count as the IPv4 address.
 */
export function rateLimitKey(address: string): string {
  const trimmed = address.trim();
  if (isIPv4(trimmed)) return trimmed;
  const groups = expandIPv6(trimmed);
  // Not an address at all (only the socket can produce that, e.g. "unknown"): keep the key short.
  if (groups === null) return trimmed === '' ? 'unknown' : trimmed.toLowerCase().slice(0, 64);
  if (groups.slice(0, 5).every((group) => group === '0000') && groups[5] === 'ffff') {
    const high = parseInt(groups[6] as string, 16);
    const low = parseInt(groups[7] as string, 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return `${groups.slice(0, 4).join(':')}::/64`;
}

/**
 * The address of the client. `fly`: the `Fly-Client-IP` header the Fly.io proxy sets (the app is
 * reachable only through it). `xff`: the last `X-Forwarded-For` entry, which the proxy in front
 * of us appended. `none`: the socket address (headers are client-controlled, so they are ignored).
 * A forwarded value that is not an IP address is ignored too and the socket address is used, so a
 * garbage header can neither mint rate-limit keys nor grow the limiter's table.
 */
export function clientAddress(c: Context, trust: TrustProxy): string {
  if (trust === 'fly') {
    const header = c.req.header('fly-client-ip')?.trim();
    if (header !== undefined && isIP(header) !== 0) return header;
  } else if (trust === 'xff') {
    const parts = (c.req.header('x-forwarded-for') ?? '').split(',');
    const last = parts[parts.length - 1]?.trim();
    if (last !== undefined && isIP(last) !== 0) return last;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
