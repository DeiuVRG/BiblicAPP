import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { readTrustedKey } from '../keys';
import { resolveUserPath } from '../lib/paths';
import { verifyPackBytes } from '../signing';

const USAGE = `Usage: verify-pack <pack dir | pack.json> [options]

Verifies a built pack byte-exactly: manifest schema, size, sha256 of the pack.json bytes,
canonical form, identity, Ed25519 signature (with a pinned public key) and minAppVersion.
Exit code 0 when valid, 1 when invalid, 2 on usage errors.

Options:
  --manifest <file>    manifest.json (default: next to pack.json)
  --pub <file>         trusted public key file; repeatable (default: content/keys/dev.pub)
  --app-version <v>    also enforce manifest.minAppVersion against this app version
`;

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

export async function runVerifyPack(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      manifest: { type: 'string' },
      pub: { type: 'string', multiple: true },
      'app-version': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const target = positionals[0];
  if (values.help || !target) {
    process.stderr.write(USAGE);
    return values.help ? 0 : 2;
  }
  const resolved = resolveUserPath(target);
  const packPath = fs.statSync(resolved).isDirectory()
    ? path.join(resolved, 'pack.json')
    : resolved;
  const manifestPath = values.manifest
    ? resolveUserPath(values.manifest)
    : path.join(path.dirname(packPath), 'manifest.json');
  const pubFiles = values.pub?.length
    ? values.pub.map((p) => resolveUserPath(p))
    : [path.join(REPO_ROOT, 'content/keys/dev.pub')];

  const result = verifyPackBytes({
    packBytes: new Uint8Array(fs.readFileSync(packPath)),
    manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown,
    trustedKeys: pubFiles.map((f) => readTrustedKey(f)),
    appVersion: values['app-version'],
  });
  if (!result.ok) {
    process.stderr.write(
      `INVALID: ${result.reason}${result.detail ? ` (${result.detail})` : ''}\n`,
    );
    return 1;
  }
  const { manifest, pack } = result;
  process.stdout.write(
    `OK: ${manifest.packId} rev ${manifest.revision} v${manifest.version}, key ${manifest.signingKeyId}, ` +
      `${pack.sections.length} sections, ${pack.paragraphs.length} paragraphs, ${manifest.size} bytes\n`,
  );
  return 0;
}
