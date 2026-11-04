import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { PackManifestSchema, PackSchema } from '@biblioteca/shared';

import { derivePair, parseSecretKey } from '../keys';
import { resolveUserPath } from '../lib/paths';
import { buildPack, sha256Hex, toBase64, verifyPackBytes } from '../signing';

const USAGE = `Usage: build-pack <edition.json> --out <dir> [options]

Builds pack.json (canonical JSON) and manifest.json (sha256 + Ed25519 signature) from the
canonical edition JSON written by ingest-text.

Options:
  --out <dir>              output directory (required), e.g. apps/mobile/assets/packs/<packId>
  --key <file>             private key file (default: content/keys/dev.key)
  --key-env <NAME>         read the private key JSON from this environment variable instead
  --pack-id <id>           pack id (default: <work slug>-<edition language>)
  --pack-version <semver>  pack release version (default: 1.0.0)
  --min-app-version <v>    minimum app version (default: 0.1.0)
  --created-at <iso>       creation time (default: now; kept if the content did not change)
`;

export async function runBuildPack(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      key: { type: 'string', default: 'content/keys/dev.key' },
      'key-env': { type: 'string' },
      'pack-id': { type: 'string' },
      'pack-version': { type: 'string', default: '1.0.0' },
      'min-app-version': { type: 'string', default: '0.1.0' },
      'created-at': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const inputArg = positionals[0];
  if (values.help || !inputArg || !values.out) {
    process.stderr.write(USAGE);
    return values.help ? 0 : 1;
  }

  const pack = PackSchema.parse(
    JSON.parse(fs.readFileSync(resolveUserPath(inputArg), 'utf8')) as unknown,
  );
  const keyText = values['key-env']
    ? process.env[values['key-env']]
    : fs.readFileSync(resolveUserPath(values.key as string), 'utf8');
  if (!keyText) {
    process.stderr.write('build-pack: no private key available (see --key / --key-env)\n');
    return 1;
  }
  const { id: keyId, secretKey } = parseSecretKey(keyText);
  const pair = derivePair(secretKey);

  const outDir = resolveUserPath(values.out);
  const packPath = path.join(outDir, 'pack.json');
  const manifestPath = path.join(outDir, 'manifest.json');
  const packId = values['pack-id'] ?? `${pack.work.slug}-${pack.edition.language}`;

  // Revision bookkeeping: unchanged content keeps revision and createdAt, changed content bumps.
  let revision = 1;
  let createdAt = values['created-at'] ?? new Date().toISOString();
  if (fs.existsSync(manifestPath)) {
    const previous = PackManifestSchema.safeParse(
      JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown,
    );
    if (previous.success) {
      const trial = buildPack({
        pack,
        secretKey,
        signingKeyId: keyId,
        packId,
        version: values['pack-version'] as string,
        revision: previous.data.revision,
        createdAt: previous.data.createdAt,
        minAppVersion: values['min-app-version'] as string,
      });
      if (trial.manifest.sha256 === previous.data.sha256) {
        revision = previous.data.revision;
        createdAt = values['created-at'] ?? previous.data.createdAt;
      } else {
        revision = previous.data.revision + 1;
      }
    }
  }

  const built = buildPack({
    pack,
    secretKey,
    signingKeyId: keyId,
    packId,
    version: values['pack-version'] as string,
    revision,
    createdAt,
    minAppVersion: values['min-app-version'] as string,
  });

  // Self-check with the public half of the signing key before anything is written.
  const check = verifyPackBytes({
    packBytes: built.packBytes,
    manifest: built.manifest,
    trustedKeys: [{ id: keyId, publicKey: toBase64(pair.publicKey) }],
  });
  if (!check.ok) {
    process.stderr.write(`build-pack: self-check failed: ${check.reason} ${check.detail ?? ''}\n`);
    return 1;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(packPath, built.packBytes);
  fs.writeFileSync(manifestPath, JSON.stringify(built.manifest, null, 2) + '\n');
  process.stdout.write(
    `pack.json      ${built.packBytes.length} bytes, sha256 ${sha256Hex(built.packBytes)}\n`,
  );
  process.stdout.write(`manifest.json  packId ${packId}, revision ${revision}, key ${keyId}\n`);
  process.stdout.write(`wrote ${outDir}\n`);
  return 0;
}
