import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This module sits directly in `src/`. After bundling, the code lives in `dist/server.js`, which is
// one level below the package directory as well, so the same arithmetic holds for both.
const here = dirname(fileURLToPath(import.meta.url));

/** `apps/api`: the folder that contains `src/` and `dist/`. */
export const API_DIR = resolve(here, '..');

/** Repository root when running from a checkout (dev, tests, `node dist/server.js`). */
export const REPO_ROOT = resolve(API_DIR, '../..');

/** Where the signed content packs live in a checkout. The Docker image sets PACKS_DIR instead. */
export const DEFAULT_PACKS_DIR = resolve(REPO_ROOT, 'apps/mobile/assets/packs');

/** Pinned public signing keys (`*.pub`). The Docker image sets KEYS_DIR instead. */
export const DEFAULT_KEYS_DIR = resolve(REPO_ROOT, 'content/keys');
