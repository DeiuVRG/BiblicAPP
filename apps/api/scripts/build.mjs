// Bundles the server into one file, `dist/server.js`.
//
// Why a bundler and not plain `tsc`: the workspace packages this service shares code with
// (`@biblioteca/shared`, `@biblioteca/content-tools`) are TypeScript sources that Node cannot load
// as they are (extensionless relative imports). Bundling inlines them, and the SDK and Hono, so
// that the Docker image needs no node_modules. Type checking stays with `tsc --noEmit`.

import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(resolve(root, 'dist'), { recursive: true, force: true });

const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: 'linked',
  legalComments: 'none',
  logLevel: 'info',
  metafile: true,
  // CommonJS packages inside the bundle may call require(); give them one.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});

const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
console.log(`built dist/server.js (${Math.round(bytes / 1024)} KiB with source map)`);
