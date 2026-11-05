#!/usr/bin/env node
// Captures the component gallery (apps/mobile/src/dev/component-gallery.tsx) into
// docs/screenshots/v2/components-*.png: the whole kit on one page, light on a desktop, dark on a
// desktop and sepia on a phone, each shot as tall as the page.
//
//   node scripts/screenshots-components.mjs [--out docs/screenshots/v2] [--dist <dir>]
//        [--skip-export] [--port N] [--timeout ms]
//
// The gallery is not part of the app: the script writes a temporary route in front of it, exports
// the site into --dist (default test-results/gallery-dist), removes the route again and serves
// that export (scripts/lib/gallery-export.mjs). `--skip-export` reuses an export that is already
// in --dist. Files are named components-<theme>-<size>.png.

/* global document -- evaluated inside the browser page */
import { mkdirSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { GALLERY_DIST, exportWithGallery } from './lib/gallery-export.mjs';
import { launchChromium, parseArgs, root, serveExport } from './lib/web-export.mjs';

const SETTINGS_KEY = 'biblioteca:settings:v1';
const DESKTOP = { width: 1366, height: 900 };
const PHONE = { width: 390, height: 844 };

// The shots of docs/screenshots/v2: a theme and a size each. Sepia is a stored setting (the system
// scheme stays light), like in the app.
const SHOTS = [
  { theme: 'light', size: 'desktop', viewport: DESKTOP },
  { theme: 'dark', size: 'desktop', viewport: DESKTOP },
  { theme: 'sepia', size: 'phone', viewport: PHONE },
];

// `--skip-export` takes no value, so it is taken out before parseArgs sees the arguments.
const argv = process.argv.slice(2);
const skipExport = argv.includes('--skip-export');
const args = parseArgs(
  argv.filter((arg) => arg !== '--skip-export'),
  'components',
  { '--out': (value, a) => (a.out = resolve(value)) },
);
const dist = argv.includes('--dist') ? args.dist : GALLERY_DIST;

async function main() {
  const out = args.out ?? join(root, 'docs/screenshots/v2');
  mkdirSync(out, { recursive: true });
  if (!skipExport) exportWithGallery(dist);
  let site;
  let browser;
  try {
    site = await serveExport({ dist, basePath: args.basePath, port: args.port });
    browser = await launchChromium('components');
    for (const { theme, size, viewport } of SHOTS) {
      const context = await browser.newContext({
        locale: 'ro-RO',
        colorScheme: theme === 'dark' ? 'dark' : 'light',
        viewport,
        deviceScaleFactor: 1,
      });
      if (theme === 'sepia') {
        await context.addInitScript(
          ([key, value]) => {
            try {
              localStorage.setItem(key, value);
            } catch {
              /* storage unavailable */
            }
          },
          [SETTINGS_KEY, JSON.stringify({ fontSize: 18, lineHeight: 1.6, theme: 'sepia' })],
        );
      }
      const page = await context.newPage();
      page.setDefaultTimeout(args.timeout);
      await page.goto(`${site.base}/gallery`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-testid="gallery"]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      // The page is one long scroller: make the window as tall as the gallery.
      const height = await page.evaluate(
        () => document.querySelector('[data-testid="gallery"]').scrollHeight,
      );
      await page.setViewportSize({ width: viewport.width, height });
      await page.waitForTimeout(800); // the hero sweep (250 ms delay + 550 ms) has finished
      const file = join(out, `components-${theme}-${size}.png`);
      await page.screenshot({ path: file });
      const { size: bytes } = await stat(file);
      console.log(`components: ${relative(root, file)} (${Math.round(bytes / 1024)} KB)`);
      await context.close();
    }
    return 0;
  } catch (error) {
    console.error(`components: FAILED: ${error instanceof Error ? error.message : error}`);
    return 1;
  } finally {
    await browser?.close().catch(() => {});
    await site?.close();
  }
}

process.exit(await main());
