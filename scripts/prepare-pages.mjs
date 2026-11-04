#!/usr/bin/env node
// Prepares a web export (`web.output: 'single'`, one index.html) for GitHub Pages.
//
//   node scripts/prepare-pages.mjs [exportDir]        (default: apps/mobile/dist)
//
// * `.nojekyll`: stops Pages from running Jekyll, which would drop the `_expo/` directory
//   (Jekyll ignores paths starting with an underscore).
// * `404.html`: a copy of `index.html`. The app is a single page that routes on the client, but
//   Pages only knows the files that exist, so a deep link such as /BiblicAPP/work/<id> is a 404;
//   Pages then serves 404.html, which boots the app and lets the client router render the
//   requested URL. Nothing is pre-rendered, so there is nothing to hydrate.

import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = resolve(process.argv[2] ?? join(root, 'apps/mobile/dist'));

if (!existsSync(join(dir, 'index.html'))) {
  console.error(`prepare-pages: ${dir}/index.html not found. Run the web export first.`);
  process.exit(2);
}

writeFileSync(join(dir, '.nojekyll'), '');
copyFileSync(join(dir, 'index.html'), join(dir, '404.html'));
console.log(`prepare-pages: wrote .nojekyll and 404.html in ${dir}`);
