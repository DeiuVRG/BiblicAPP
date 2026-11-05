// Exports the web app with a temporary route in front of the component gallery
// (apps/mobile/src/dev/component-gallery.tsx: every part of the kit on one page, built from the
// real components), for the scripts that look at the kit in a browser. The gallery is a
// development tool and no route of the app imports it, so the route is written just for the
// export and deleted again whatever happens to the export; never commit it.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { root } from './web-export.mjs';

/** The temporary route file; the URL of the gallery is `/gallery`. */
export const GALLERY_ROUTE = join(root, 'apps/mobile/src/app/gallery.tsx');

/** Where the export goes by default (`test-results/` is ignored by git). */
export const GALLERY_DIST = join(root, 'test-results/gallery-dist');

const ROUTE_SOURCE = `// Temporary route written by scripts/lib/gallery-export.mjs and deleted when the export is done.
import { Stack } from 'expo-router';

import { ComponentGallery } from '@/dev/component-gallery';

export default function GalleryRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ComponentGallery />
    </>
  );
}
`;

/**
 * Runs `expo export -p web` into `outDir` with the gallery route in place, and removes the route
 * again (also when the export fails or the process is interrupted). Throws when the route file
 * already exists (somebody else's file: it is not overwritten) or when the export fails.
 */
export function exportWithGallery(outDir = GALLERY_DIST) {
  if (existsSync(GALLERY_ROUTE)) {
    throw new Error(`${GALLERY_ROUTE} already exists: delete it (it is a leftover) and retry`);
  }
  mkdirSync(outDir, { recursive: true });
  const removeRoute = () => rmSync(GALLERY_ROUTE, { force: true });
  const onSignal = (signal) => {
    removeRoute();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  writeFileSync(GALLERY_ROUTE, ROUTE_SOURCE);
  try {
    const result = spawnSync(
      'pnpm',
      ['--filter', 'mobile', 'exec', 'expo', 'export', '-p', 'web', '--output-dir', outDir],
      { cwd: root, stdio: 'inherit' },
    );
    if (result.status !== 0) {
      throw new Error(`expo export failed (exit ${result.status ?? result.signal})`);
    }
  } finally {
    removeRoute();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
  return outDir;
}
