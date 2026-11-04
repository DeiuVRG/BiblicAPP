import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Pack, PackManifest } from '@biblioteca/shared';
import { verifyPackBytes } from '@biblioteca/content-tools/src/signing';
import type { TrustedKey } from '@biblioteca/content-tools/src/signing';
import { z } from 'zod';

const KeyFileSchema = z.object({
  id: z.string().min(1),
  algorithm: z.literal('ed25519'),
  publicKey: z
    .string()
    .regex(/^[A-Za-z0-9+/]{43}=$/, 'expected the base64 of a 32-byte Ed25519 key'),
});

export interface KeyLoadResult {
  keys: TrustedKey[];
  problems: string[];
}

/**
 * Reads the pinned public keys (`content/keys/*.pub`, the files the app's `trusted-keys.ts`
 * mirrors). A file that cannot be read or does not look like a key is reported and skipped: a
 * missing key only ever reduces what is trusted.
 */
export function loadTrustedKeys(keysDir: string): KeyLoadResult {
  const keys: TrustedKey[] = [];
  const problems: string[] = [];
  if (!existsSync(keysDir)) {
    return { keys, problems: [`keys directory not found: ${keysDir}`] };
  }
  for (const name of readdirSync(keysDir)
    .filter((file) => file.endsWith('.pub'))
    .sort()) {
    try {
      const parsed = KeyFileSchema.safeParse(JSON.parse(readFileSync(join(keysDir, name), 'utf8')));
      if (!parsed.success) {
        problems.push(`${name}: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
        continue;
      }
      if (keys.some((key) => key.id === parsed.data.id)) {
        problems.push(`${name}: duplicate key id ${parsed.data.id}`);
        continue;
      }
      keys.push({ id: parsed.data.id, publicKey: parsed.data.publicKey });
    } catch (error) {
      problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { keys, problems };
}

export interface LoadedPack {
  /** Folder the pack was read from. */
  dir: string;
  manifest: PackManifest;
  pack: Pack;
}

export interface RejectedPack {
  dir: string;
  reason: string;
  detail?: string;
}

export interface PackLoadResult {
  packs: LoadedPack[];
  rejected: RejectedPack[];
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Loads every pack directory (`manifest.json` + `pack.json`) under `packsDir` and verifies each
 * one byte for byte: schema, size, sha256, canonical form and the Ed25519 signature against the
 * pinned keys. A pack that fails any step is rejected and never indexed. Two packs for the same
 * edition: the higher revision wins.
 */
export function loadPacks(packsDir: string, trustedKeys: readonly TrustedKey[]): PackLoadResult {
  const rejected: RejectedPack[] = [];
  const verified: LoadedPack[] = [];
  if (!isDirectory(packsDir)) {
    return { packs: [], rejected: [{ dir: packsDir, reason: 'packs-dir-missing' }] };
  }
  const names = readdirSync(packsDir)
    .filter((name) => !name.startsWith('.'))
    .sort();
  for (const name of names) {
    const dir = join(packsDir, name);
    if (!isDirectory(dir)) continue;
    const manifestPath = join(dir, 'manifest.json');
    const packPath = join(dir, 'pack.json');
    if (!existsSync(manifestPath) || !existsSync(packPath)) {
      rejected.push({
        dir,
        reason: 'incomplete',
        detail: 'manifest.json and pack.json are both required',
      });
      continue;
    }
    let manifest: unknown;
    let packBytes: Uint8Array;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
      packBytes = new Uint8Array(readFileSync(packPath));
    } catch (error) {
      rejected.push({
        dir,
        reason: 'unreadable',
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    const result = verifyPackBytes({ packBytes, manifest, trustedKeys });
    if (!result.ok) {
      const entry: RejectedPack = { dir, reason: result.reason };
      if (result.detail !== undefined) entry.detail = result.detail.slice(0, 300);
      rejected.push(entry);
      continue;
    }
    verified.push({ dir, manifest: result.manifest, pack: result.pack });
  }

  // One pack per edition: the latest revision wins.
  const byEdition = new Map<string, LoadedPack>();
  for (const loaded of verified) {
    const id = loaded.pack.edition.id;
    const existing = byEdition.get(id);
    if (existing === undefined) {
      byEdition.set(id, loaded);
    } else if (loaded.manifest.revision > existing.manifest.revision) {
      rejected.push({ dir: existing.dir, reason: 'superseded', detail: `edition ${id}` });
      byEdition.set(id, loaded);
    } else {
      rejected.push({ dir: loaded.dir, reason: 'superseded', detail: `edition ${id}` });
    }
  }
  return { packs: [...byEdition.values()], rejected };
}
