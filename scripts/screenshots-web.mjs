#!/usr/bin/env node
// Captures the screenshots of the web export used in the README and in design reviews: the
// library, a work, the reader (alone, in two lanes, with its panels open), the transparency page and
// panel and Settings, in the light and dark themes (and sepia on request), at the sizes of
// docs/ui-spec-v2.md 20.1: desktop 1366x900, phone 390x844 and, on request, tablet 768x1024, with a
// device scale factor of 1 (the sizes of the reference captures, so that a side-by-side is possible).
//
//   node scripts/screenshots-web.mjs [--out docs/screenshots/v2] [--dist apps/mobile/dist]
//        [--base-path /BiblicAPP] [--screens library,work,reader,reader-lanes,reader-aa,settings]
//        [--schemes light,dark,sepia] [--sizes phone,desktop,tablet] [--scale 1] [--full-page]
//        [--port N] [--timeout ms]
//
// Files are named <screen>-<theme>-<size>.png (for example reader-dark-phone.png), with -full before
// the extension when --full-page is given (the window as tall as the page). `reader-aa`,
// `reader-tools`, `reader-outline` (phone only) and `transparency` are the reader with that panel
// open; `about-transparency` is the policy page. Build the
// export first: pnpm --filter mobile export:web. Each shot is a fresh browser context (empty
// storage, so the work page offers "Începe lectura") with the colour scheme emulated; sepia is a
// stored setting (the system scheme stays light), like in the app.

/* global document, getComputedStyle -- evaluated inside the browser page */
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

const SIZES = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1366, height: 900 },
  tablet: { width: 768, height: 1024 },
};
const SCHEMES = ['light', 'dark', 'sepia'];
// What a shot shows when no --schemes or --sizes is given (sepia and tablet are asked for).
const DEFAULT_SCHEMES = ['light', 'dark'];
const DEFAULT_SIZES = ['phone', 'desktop'];
const SETTINGS_KEY = 'biblioteca:settings:v1';

/**
 * Shots that are a state of another screen: the screen they open, the sizes they exist for (all when
 * absent) and what to press first. On a phone the controls of the toolbar are the cells of the bottom bar.
 */
const STATES = {
  'reader-aa': {
    screen: 'reader',
    act: (page, size) =>
      pressAndWait(
        page,
        size === 'phone' ? 'thumb-cell-text' : 'aa-button',
        size === 'phone' ? 'aa-sheet-panel' : 'typography-panel',
      ),
  },
  'reader-tools': {
    screen: 'reader',
    act: (page, size) =>
      pressAndWait(
        page,
        size === 'phone' ? 'thumb-cell-tools' : 'tools-button',
        size === 'phone' ? 'tools-sheet-panel' : 'tool-theme',
      ),
  },
  'reader-outline': {
    screen: 'reader',
    sizes: ['phone'],
    act: (page) => pressAndWait(page, 'thumb-cell-contents', 'outline-panel'),
  },
  transparency: {
    screen: 'reader',
    act: async (page, size) => {
      if (size === 'phone') await pressAndWait(page, 'thumb-cell-tools', 'tool-report');
      await pressAndWait(
        page,
        size === 'phone' ? 'tool-report' : 'transparency-button',
        'transparency-panel',
      );
    },
  },
};

/** Presses the control with this test id and waits for the element that it opens. */
async function pressAndWait(page, pressId, opensId) {
  await page.locator(`[data-testid="${pressId}"]:visible`).first().click();
  await page.locator(`[data-testid="${opensId}"]:visible`).first().waitFor({ state: 'visible' });
  await page.mouse.move(1, 1); // no entry is left in its hover state under the pointer
  await page.waitForTimeout(600); // a sheet slides in, a dialog fades in
}

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

/** Evaluated in the page: true when no hero highlight is on screen, or its bar has swept to full width. */
const heroSweepDone = () => {
  // `offsetWidth` ignores the scale of the sweep (a bounding box would be 0 wide at its start).
  const bar = [...document.querySelectorAll('[data-testid="hero-highlight"]')].find(
    (element) => element.offsetWidth > 0,
  );
  if (!bar) return true;
  const transform = getComputedStyle(bar).transform;
  if (transform === 'none') return true;
  const scale = /matrix\(([^,]+),/.exec(transform);
  return !scale || Number(scale[1]) >= 0.999;
};

const argv = process.argv.slice(2);
// `--full-page` is a switch: the window is made as tall as the page (a landing is longer than a window).
const fullPage = argv.includes('--full-page');
const args = parseArgs(
  argv.filter((arg) => arg !== '--full-page'),
  'screenshots',
  {
    '--out': (value, a) => (a.out = resolve(value)),
    '--screens': (value, a) =>
      (a.screens = list(value, [...SCREENS, ...Object.keys(STATES)], 'screen')),
    '--schemes': (value, a) => (a.schemes = list(value, SCHEMES, 'scheme')),
    '--sizes': (value, a) => (a.sizes = list(value, Object.keys(SIZES), 'size')),
    '--scale': (value, a) => (a.scale = Number(value)),
  },
);
const out = args.out ?? join(root, 'docs/screenshots/v2');
const screens = args.screens ?? [...SCREENS, ...Object.keys(STATES)];
const schemes = args.schemes ?? DEFAULT_SCHEMES;
const sizes = args.sizes ?? DEFAULT_SIZES;
const scale = args.scale ?? 1;

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
          // Sepia is a theme chosen in Settings: the system scheme is light then.
          colorScheme: scheme === 'dark' ? 'dark' : 'light',
          viewport: SIZES[size],
          deviceScaleFactor: scale,
        });
        if (scheme === 'sepia') {
          await context.addInitScript(
            ([key, value]) => {
              try {
                localStorage.setItem(key, value);
              } catch {
                /* storage unavailable */
              }
            },
            [SETTINGS_KEY, JSON.stringify({ theme: 'sepia' })],
          );
        }
        for (const screen of screens) {
          const state = STATES[screen];
          // A panel that a phone only has (the outline drawer) has no shot at the other sizes.
          if (state?.sizes && !state.sizes.includes(size)) continue;
          const page = await context.newPage();
          page.setDefaultTimeout(args.timeout);
          await page.goto(`${site.base}${routes[state?.screen ?? screen]}`, {
            waitUntil: 'domcontentloaded',
          });
          await waitForScreen(page, state?.screen ?? screen, args.timeout);
          await page.waitForTimeout(500); // let the last layout pass settle
          if (state) await state.act(page, size);
          // The bar behind the second line of the landing's title sweeps in over 550 ms after a delay of
          // 250 ms: a still taken before it ends shows a bar that stops short of the full stop.
          await page.waitForFunction(heroSweepDone, null, { timeout: args.timeout });
          if (fullPage) {
            // The page scrolls inside the app's own scroll container, so the window is made as tall
            // as the content (up to 8000 px) instead of asking for a full-page capture.
            const content = await page.evaluate(() =>
              Math.max(
                0,
                ...[...document.querySelectorAll('div')]
                  .filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY))
                  .map((el) => el.scrollHeight),
              ),
            );
            await page.setViewportSize({
              width: SIZES[size].width,
              height: Math.min(Math.max(content, SIZES[size].height), 8000),
            });
            await page.waitForTimeout(400);
          }
          const file = join(out, `${screen}-${scheme}-${size}${fullPage ? '-full' : ''}.png`);
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
