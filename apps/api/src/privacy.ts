import { createHmac, randomBytes } from 'node:crypto';

/**
 * Keyed hashes that stand in for personal data in logs. The key is a per-process random salt
 * unless LOG_HASH_SALT is set, so the same question or address correlates within one run but
 * cannot be looked up in a table of precomputed hashes. Question text is never logged.
 */
export class LogHasher {
  private readonly salt: Buffer;

  constructor(salt?: string) {
    this.salt = salt !== undefined ? Buffer.from(salt, 'utf8') : randomBytes(32);
  }

  /** Short, stable fingerprint of a string. */
  hash(value: string, length = 16): string {
    return createHmac('sha256', this.salt)
      .update(value.normalize('NFC').trim().toLowerCase())
      .digest('hex')
      .slice(0, length);
  }
}
