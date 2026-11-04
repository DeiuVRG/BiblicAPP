#!/usr/bin/env node
// Captures the screenshots of the web export used in the README and in design reviews: the
// library, a work, the reader and Settings, in the light and dark schemes, at phone size
// (390x844) and desktop size (1280x800), with a device scale factor of 2.
//
//   node scripts/screenshots-web.mjs [--out docs/screenshots] [--dist apps/mobile/dist]
//        [--base-path /BiblicAPP] [--screens library,work,reader,settings]
//        [--schemes light,dark] [--sizes phone,desktop] [--port N] [--timeout ms]
//
// Files are named <screen>-<scheme>-<size>.png (for example reader-dark-phone.png). Build the
// export first: pnpm --filter mobile export:web. Each shot is a fresh browser context (empty
// storage, so the work page offers "Începe lectura") with the colour scheme emulated.

import { mkdirSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import {
  SCREENS,
  discoverRoutes,
  launchChromium,
  parseArgs,
  root,
  serveExport,
  waitForScreen,
} from './lib/web-export.mjs';

const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const SCHEMES = ['light', 'dark'];

const list = (value, allowed, what) => {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const unknown = items.filter((item) => !allowed.includes(item));
  if (unknown.length > 0 || items.length === 0) {
    console.error(
      `screenshots: unknown ${what} "${unknown.join(',')}" (use ${allowed.join(', ')})`,
    );
    process.exit(2);
  }
  return items;
};

const args = parseArgs(process.argv.slice(2), 'screenshots', {
  '--out': (value, a) => (a.out = resolve(value)),
  '--screens': (value, a) => (a.screens = list(value, SCREENS, 'screen')),
  '--schemes': (value, a) => (a.schemes = list(value, SCHEMES, 'scheme')),
  '--sizes': (value, a) => (a.sizes = list(value, Object.keys(SIZES), 'size')),
});
const out = args.out ?? join(root, 'docs/screenshots');
const screens = args.screens ?? SCREENS;
const schemes = args.schemes ?? SCHEMES;
const sizes = args.sizes ?? Object.keys(SIZES);

async function main() {
  mkdirSync(out, { recursive: true });
  let site;
  let browser;
  try {
    site = await serveExport(args);
    browser = await launchChromium('screenshots');

    const probe = await browser.newContext({ locale: 'ro-RO' });
    const routes = await discoverRoutes(await probe.newPage(), site.base, args.timeout);
    await probe.close();

    for (const scheme of schemes) {
      for (const size of sizes) {
        const context = await browser.newContext({
          locale: 'ro-RO',
          colorScheme: scheme,
          viewport: SIZES[size],
          deviceScaleFactor: 2,
        });
        for (const screen of screens) {
          const page = await context.newPage();
          page.setDefaultTimeout(args.timeout);
          await page.goto(`${site.base}${routes[screen]}`, { waitUntil: 'domcontentloaded' });
          await waitForScreen(page, screen, args.timeout);
          await page.waitForTimeout(500); // let the last layout pass settle
          const file = join(out, `${screen}-${scheme}-${size}.png`);
          await page.screenshot({ path: file });
          const { size: bytes } = await stat(file);
          console.log(`screenshots: ${relative(root, file)} (${Math.round(bytes / 1024)} KB)`);
          await page.close();
        }
        await context.close();
      }
    }
    return 0;
  } catch (error) {
    console.error(`screenshots: FAILED: ${error instanceof Error ? error.message : error}`);
    return 1;
  } finally {
    await browser?.close().catch(() => {});
    await site?.close();
  }
}

process.exit(await main());
