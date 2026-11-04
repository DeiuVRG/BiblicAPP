import path from 'node:path';
import { parseArgs } from 'node:util';

import { resolveUserPath } from '../lib/paths';
import { writeKeyPair } from '../keys';
import { generateKeyPair, toBase64 } from '../signing';

const USAGE = `Usage: keygen [options]

Generates an Ed25519 keypair. The private key goes to <dir>/<name>.key (mode 0600, gitignored),
the public key to <dir>/<name>.pub (committed, pinned in the app).

Options:
  --name <name>   file base name (default: dev)
  --id <keyId>    key id written into both files and into manifests (default: <name>-1)
  --dir <dir>     output directory (default: content/keys)
  --force         overwrite existing files
`;

export async function runKeygen(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      name: { type: 'string', default: 'dev' },
      id: { type: 'string' },
      dir: { type: 'string', default: 'content/keys' },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  const name = values.name as string;
  const id = values.id ?? `${name}-1`;
  const pair = generateKeyPair();
  const { publicPath, secretPath } = writeKeyPair(
    resolveUserPath(values.dir as string),
    name,
    id,
    pair,
    values.force,
  );
  process.stdout.write(`key id:      ${id}\n`);
  process.stdout.write(`public key:  ${toBase64(pair.publicKey)}\n`);
  process.stdout.write(`wrote ${publicPath}\n`);
  process.stdout.write(`wrote ${secretPath} (keep it secret; it is gitignored)\n`);
  process.stdout.write(
    `Pin the public key in apps/mobile/src/content/trusted-keys.ts (dir: ${path.basename(path.dirname(secretPath))}).\n`,
  );
  return 0;
}
