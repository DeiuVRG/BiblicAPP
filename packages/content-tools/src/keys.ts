import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { ALGORITHM, fromBase64, publicKeyFromSecret, toBase64 } from './signing';
import type { KeyPair, TrustedKey } from './signing';

const Base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/);

/** `content/keys/<name>.pub`: committed, public. */
export const PublicKeyFileSchema = z.object({
  id: z.string().min(1),
  algorithm: z.literal(ALGORITHM),
  publicKey: Base64,
});

/** `content/keys/<name>.key`: private, never committed (the directory is gitignored). */
export const SecretKeyFileSchema = z.object({
  id: z.string().min(1),
  algorithm: z.literal(ALGORITHM),
  /** Base64 of the 32-byte Ed25519 seed. */
  secretKey: Base64,
});

export type PublicKeyFile = z.infer<typeof PublicKeyFileSchema>;
export type SecretKeyFile = z.infer<typeof SecretKeyFileSchema>;

export function publicKeyFile(id: string, pair: KeyPair): PublicKeyFile {
  return { id, algorithm: ALGORITHM, publicKey: toBase64(pair.publicKey) };
}

export function secretKeyFile(id: string, pair: KeyPair): SecretKeyFile {
  return { id, algorithm: ALGORITHM, secretKey: toBase64(pair.secretKey) };
}

export function parseSecretKey(text: string): { id: string; secretKey: Uint8Array } {
  const parsed = SecretKeyFileSchema.parse(JSON.parse(text) as unknown);
  const secretKey = fromBase64(parsed.secretKey);
  if (secretKey.length !== 32) throw new Error('secret key must be 32 bytes');
  return { id: parsed.id, secretKey };
}

export function readTrustedKey(file: string): TrustedKey {
  const parsed = PublicKeyFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')) as unknown);
  if (fromBase64(parsed.publicKey).length !== 32)
    throw new Error(`${file}: public key must be 32 bytes`);
  return { id: parsed.id, publicKey: parsed.publicKey };
}

export function writeKeyPair(
  dir: string,
  name: string,
  id: string,
  pair: KeyPair,
  force: boolean,
): { publicPath: string; secretPath: string } {
  fs.mkdirSync(dir, { recursive: true });
  const publicPath = path.join(dir, `${name}.pub`);
  const secretPath = path.join(dir, `${name}.key`);
  if (!force && (fs.existsSync(publicPath) || fs.existsSync(secretPath))) {
    throw new Error(`${name}.key / ${name}.pub already exist in ${dir} (use --force to overwrite)`);
  }
  fs.writeFileSync(secretPath, `${JSON.stringify(secretKeyFile(id, pair), null, 2)}\n`, {
    mode: 0o600,
  });
  fs.chmodSync(secretPath, 0o600);
  fs.writeFileSync(publicPath, `${JSON.stringify(publicKeyFile(id, pair), null, 2)}\n`);
  return { publicPath, secretPath };
}

/** Sanity check used by build-pack: the public half derived from the secret key. */
export function derivePair(secretKey: Uint8Array): KeyPair {
  return { secretKey, publicKey: publicKeyFromSecret(secretKey) };
}
