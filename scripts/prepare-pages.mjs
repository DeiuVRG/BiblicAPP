#!/usr/bin/env node
// Prepares a static Expo web export for GitHub Pages.
//
//   node scripts/prepare-pages.mjs [exportDir]        (default: apps/mobile/dist)
//
// * `.nojekyll`: stops Pages from running Jekyll, which would drop the `_expo/` directory
//   (Jekyll ignores paths starting with an underscore).
// * `404.html`: a copy of `index.html`. Expo exports one HTML file per route pattern
//   (`work/[id].html`), so a deep link such as /BiblicAPP/work/<id> is a 404 on Pages; Pages then
//   serves 404.html, which boots the app and lets the client router render the requested URL.
//   The copy has the pre-rendered home screen removed and hydration switched off: hydrating the
//   home markup into a different route would raise React hydration error #418.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = resolve(process.argv[2] ?? join(root, 'apps/mobile/dist'));

if (!existsSync(join(dir, 'index.html'))) {
  console.error(`prepare-pages: ${dir}/index.html not found. Run the web export first.`);
  process.exit(2);
}

/** Empties <div id="root">...</div> by counting nested <div> tags. */
export function emptyRoot(html) {
  const start = html.indexOf('<div id="root">');
  if (start === -1) throw new Error('prepare-pages: <div id="root"> not found in index.html');
  const open = start + '<div id="root">'.length;
  const tag = /<div[\s>]|<\/div>/g;
  tag.lastIndex = open;
  let depth = 1;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(0, open) + html.slice(m.index);
  }
  throw new Error('prepare-pages: unbalanced <div> markup in index.html');
}

const index = readFileSync(join(dir, 'index.html'), 'utf8');
const fallback = emptyRoot(index).replace(
  /<script id="_R_">[^<]*__EXPO_ROUTER_HYDRATE__[^<]*<\/script>/,
  '',
);
if (fallback.includes('__EXPO_ROUTER_HYDRATE__')) {
  throw new Error(
    'prepare-pages: could not switch hydration off in 404.html (export format changed?)',
  );
}

writeFileSync(join(dir, '.nojekyll'), '');
writeFileSync(join(dir, '404.html'), fallback);
console.log(`prepare-pages: wrote .nojekyll and 404.html in ${dir}`);
