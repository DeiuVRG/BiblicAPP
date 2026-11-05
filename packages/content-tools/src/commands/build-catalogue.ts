import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CatalogueManifestSchema, CatalogueSchema, canonicalJsonBytes } from '@biblioteca/shared';
import type { Catalogue } from '@biblioteca/shared';

import {
  buildCatalogueBody,
  mergeSources,
  readInstalledPacks,
  readSourceFiles,
  signCatalogue,
  verifyCatalogueBytes,
} from '../catalogue';
import { derivePair, parseSecretKey, readTrustedKey } from '../keys';
import { parseCommandArgs, runCommand } from '../lib/command';
import { resolveUserPath } from '../lib/paths';
import { UsageError } from '../lib/usage-error';
import { sha256Hex, toBase64 } from '../signing';
import type { TrustedKey } from '../signing';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
// The sources live next to their output until `content/` is open to this work (ADR-018): moving
// them to content/catalogue (the place 6.8 of docs/ui-spec-v2.md names) is a git mv and this line.
const DEFAULT_SRC = path.join(REPO_ROOT, 'apps/mobile/assets/catalogue/source');
const DEFAULT_PACKS = path.join(REPO_ROOT, 'apps/mobile/assets/packs');
const DEFAULT_OUT = path.join(REPO_ROOT, 'apps/mobile/assets/catalogue');
const DEFAULT_KEY = path.join(REPO_ROOT, 'content/keys/dev.key');
const DEFAULT_PUB = path.join(REPO_ROOT, 'content/keys/dev.pub');

const USAGE = `Usage: build-catalogue [options]

Builds the signed catalogue of the library: the editorial records of <src>/*.json (shelves,
authors, works, startHere; one or several files, arrays are concatenated) and the list of the
installed packs of <packs> (packId, editionId, sha256, size), as catalogue.json (canonical JSON) and
manifest.json (sha256 + Ed25519 signature) in <out>. Every pack is verified before it is listed.
Run it again whenever a pack is rebuilt: a pack whose sha256 differs from the catalogue is refused by
the app when its edition is opened.

Options:
  --src <dir>              source files (default: apps/mobile/assets/catalogue/source)
  --packs <dir>            pack directories (default: apps/mobile/assets/packs)
  --out <dir>              output directory (default: apps/mobile/assets/catalogue)
  --key <file>             private key file (default: content/keys/dev.key)
  --key-env <NAME>         read the private key JSON from this environment variable instead
  --pub <file>             trusted public key for the packs and for --check; repeatable
                           (default: content/keys/dev.pub; the public half of the signing key is added)
  --catalogue-version <v>  format version (default: 1.0.0)
  --min-app-version <v>    minimum app version (default: 0.1.0)
  --created-at <iso>       creation time (default: now; kept if the content did not change)
  --check                  writes nothing and needs no private key: exits 1 when the files in <out>
                           are not what the sources and the packs give now, or do not verify
`;

/** Which packs of the catalogue on disk differ from the ones the packs directory has now. */
function packDifferences(disk: Catalogue, fresh: Catalogue): string[] {
  const before = new Map(disk.packs.map((pack) => [pack.packId, pack.sha256]));
  const after = new Map(fresh.packs.map((pack) => [pack.packId, pack.sha256]));
  const lines: string[] = [];
  for (const [packId, sha] of after) {
    if (!before.has(packId)) lines.push(`pack ${packId} is not in the catalogue`);
    else if (before.get(packId) !== sha) lines.push(`pack ${packId} was rebuilt (sha256 changed)`);
  }
  for (const packId of before.keys()) {
    if (!after.has(packId)) lines.push(`pack ${packId} is no longer installed`);
  }
  return lines;
}

export async function runBuildCatalogue(args: string[]): Promise<number> {
  return runCommand('build-catalogue', USAGE, async () => {
    const { values } = parseCommandArgs(args, {
      src: { type: 'string' },
      packs: { type: 'string' },
      out: { type: 'string' },
      key: { type: 'string' },
      'key-env': { type: 'string' },
      pub: { type: 'string', multiple: true },
      'catalogue-version': { type: 'string', default: '1.0.0' },
      'min-app-version': { type: 'string', default: '0.1.0' },
      'created-at': { type: 'string' },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    });
    if (values.help) {
      process.stdout.write(USAGE);
      return 0;
    }
    const srcDir = values.src ? resolveUserPath(values.src) : DEFAULT_SRC;
    const packsDir = values.packs ? resolveUserPath(values.packs) : DEFAULT_PACKS;
    const outDir = values.out ? resolveUserPath(values.out) : DEFAULT_OUT;
    const cataloguePath = path.join(outDir, 'catalogue.json');
    const manifestPath = path.join(outDir, 'manifest.json');

    const trusted: TrustedKey[] = (
      values.pub?.length ? values.pub.map((file) => resolveUserPath(file)) : [DEFAULT_PUB]
    ).map((file) => readTrustedKey(file));

    // Signing needs the private key; checking does not (CI has none).
    let signer: { id: string; secretKey: Uint8Array } | undefined;
    if (!values.check) {
      const keyText = values['key-env']
        ? process.env[values['key-env']]
        : fs.readFileSync(values.key ? resolveUserPath(values.key) : DEFAULT_KEY, 'utf8');
      if (!keyText) {
        process.stderr.write('build-catalogue: no private key available (see --key / --key-env)\n');
        return 1;
      }
      signer = parseSecretKey(keyText);
      const publicKey = toBase64(derivePair(signer.secretKey).publicKey);
      if (!trusted.some((key) => key.id === signer?.id)) trusted.push({ id: signer.id, publicKey });
    }

    const installed = readInstalledPacks(packsDir, trusted);
    const { catalogue, unlisted } = buildCatalogueBody(
      mergeSources(readSourceFiles(srcDir)),
      installed,
    );
    for (const work of unlisted) {
      process.stderr.write(
        `build-catalogue: warning: work ${work.slug} (${work.workId}) has no editorial entry; it lists under "Altele"\n`,
      );
    }
    const bytes = canonicalJsonBytes(catalogue);

    const previousFile = fs.existsSync(manifestPath)
      ? CatalogueManifestSchema.safeParse(
          JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown,
        )
      : undefined;
    const previous = previousFile?.success ? previousFile.data : undefined;

    if (values.check) {
      if (!previous || !fs.existsSync(cataloguePath)) {
        process.stderr.write(`STALE: ${outDir} has no catalogue (run build-catalogue)\n`);
        return 1;
      }
      const onDisk = new Uint8Array(fs.readFileSync(cataloguePath));
      const verdict = verifyCatalogueBytes({
        catalogueBytes: onDisk,
        manifest: previous,
        trustedKeys: trusted,
      });
      if (!verdict.ok) {
        process.stderr.write(
          `INVALID: the catalogue does not verify: ${verdict.reason}${verdict.detail ? ` (${verdict.detail})` : ''}\n`,
        );
        return 1;
      }
      if (sha256Hex(onDisk) !== sha256Hex(bytes)) {
        const lines = packDifferences(verdict.catalogue, catalogue);
        process.stderr.write(
          `STALE: ${path.relative(REPO_ROOT, cataloguePath)} is not what the sources and the packs give now` +
            `${lines.length > 0 ? `:\n  ${lines.join('\n  ')}` : ''}\n` +
            'Run: pnpm --filter @biblioteca/content-tools cli build-catalogue\n',
        );
        return 1;
      }
      process.stdout.write(
        `OK: catalogue rev ${previous.revision}, ${catalogue.works.length} work(s), ${catalogue.packs.length} pack(s), key ${previous.signingKeyId}\n`,
      );
      return 0;
    }

    if (!signer) throw new UsageError('no signing key');
    // Unchanged content keeps its revision and creation time; changed content bumps the revision.
    const unchanged = previous !== undefined && previous.sha256 === sha256Hex(bytes);
    const revision =
      previous === undefined ? 1 : unchanged ? previous.revision : previous.revision + 1;
    const createdAt =
      values['created-at'] ??
      (previous !== undefined && unchanged ? previous.createdAt : new Date().toISOString());
    const signed = signCatalogue({
      catalogue: CatalogueSchema.parse(catalogue),
      secretKey: signer.secretKey,
      signingKeyId: signer.id,
      version: values['catalogue-version'] as string,
      revision,
      createdAt,
      minAppVersion: values['min-app-version'] as string,
    });

    // Self-check with the trusted keys before anything is written.
    const verdict = verifyCatalogueBytes({
      catalogueBytes: signed.catalogueBytes,
      manifest: signed.manifest,
      trustedKeys: trusted,
    });
    if (!verdict.ok) {
      process.stderr.write(
        `build-catalogue: self-check failed: ${verdict.reason} ${verdict.detail ?? ''}\n`,
      );
      return 1;
    }

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(cataloguePath, signed.catalogueBytes);
    fs.writeFileSync(manifestPath, `${JSON.stringify(signed.manifest, null, 2)}\n`);
    process.stdout.write(
      `catalogue.json  ${signed.catalogueBytes.length} bytes, sha256 ${signed.manifest.sha256}\n`,
    );
    process.stdout.write(
      `manifest.json   revision ${revision}, key ${signer.id}${unchanged ? ' (content unchanged)' : ''}\n`,
    );
    process.stdout.write(
      `shelves ${catalogue.shelves.length}, authors ${catalogue.authors.length}, works ${catalogue.works.length}, packs ${catalogue.packs.length}\n`,
    );
    process.stdout.write(`wrote ${outDir}\n`);
    return 0;
  });
}
