#!/usr/bin/env node
// Playwright smoke test for the static web export.
//
//   node scripts/smoke-web.mjs [--dist apps/mobile/dist] [--base-path /BiblicAPP] [--port N]
//        [--beta1-dist DIR | --skip-beta1]
//
// Serves the export with `serve`, opens it in headless Chromium and checks that
//   0. the landing (`/`) draws the shell (brand bar, section bar) and lists the works of the
//      library as cards, and the section bar's "Citește" drawer leads to the full library,
//   1. the full library (`/library/all`) lists at least one work (and shows no "unverified pack"
//      notice),
//   2. opening the work shows its table of contents,
//   2b. the work has two editions (Romanian and English): choosing the other one puts
//      `?edition=` in the address and shows that edition's table of contents,
//   3. opening the first chapter renders several paragraphs of text,
//   4. a deep link to that chapter loads directly, the way GitHub Pages serves it (through
//      404.html: the export's own after prepare-pages.mjs, or a copy of index.html made here),
//   5. the shell, the landing and the library behave as docs/ui-spec-v2.md section 20 says
//      (scripts/lib/smoke-shell.mjs: S1-S6, S8, L2, L5, L6, L8, B2-B4, B9, Q1),
//   6. what the review of the shell phase added (scripts/lib/smoke-review.mjs): the drawer on a stack
//      of screens, the keys of the bar, one h1 per screen, the hero form, the placeholders, the
//      breakpoints, the grids,
//   6b. the work hub, the reader and the transparency panel (scripts/lib/smoke-reader.mjs): the
//      card, the tabs and the contents of the hub (W1, W3-W7), the zones, the toolbar, the type, the
//      chapter card, the outline, find, the keys, Aa, the progress bar and the way back (R1-R5, R10-R12,
//      R15, R18, R19), the language switch and the two lanes (R6, R7), a phone's toolbar, bar and
//      sheets (R13), and the panel (R9, T1, T2, T4, T5),
//   7. the configuration of Beta 1: an export built with EXPO_PUBLIC_FEATURES=beta1 (built here into
//      a temporary folder, or taken from --beta1-dist) has the five items of the bar, the two doors
//      and the transparency band, which S1, S2, L2, L3 and L7 expect and the delivered flags do not
//      show (--skip-beta1 leaves it out).
// Use --base-path with an export built with EXPO_PUBLIC_WEB_BASE_URL=/BiblicAPP.
// Exits non-zero on any failure; a screenshot goes to test-results/ for CI artifacts.

/* global document -- the two helpers below are evaluated inside the browser page */
import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { readerChecks } from './lib/smoke-reader.mjs';
import { beta1Checks, reviewChecks } from './lib/smoke-review.mjs';
import { shellChecks } from './lib/smoke-shell.mjs';
import { buildExport, serveExport } from './lib/web-export.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = {
    dist: join(root, 'apps/mobile/dist'),
    basePath: '',
    port: 0,
    timeout: 45_000,
    beta1Dist: null,
    skipBeta1: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dist') args.dist = resolve(argv[(i += 1)]);
    else if (a === '--base-path') args.basePath = argv[(i += 1)].replace(/\/+$/, '');
    else if (a === '--port') args.port = Number(argv[(i += 1)]);
    else if (a === '--timeout') args.timeout = Number(argv[(i += 1)]);
    else if (a === '--beta1-dist') args.beta1Dist = resolve(argv[(i += 1)]);
    else if (a === '--skip-beta1') args.skipBeta1 = true;
    else {
      console.error(`smoke: unknown argument ${a}`);
      process.exit(2);
    }
  }
  if (args.basePath && !args.basePath.startsWith('/')) args.basePath = `/${args.basePath}`;
  return args;
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForServer(url, child, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`serve exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`static server did not start at ${url}`);
}

// Evaluated inside the page (must be self-contained): leaf text elements with at least `min`
// characters, i.e. rendered paragraphs. The reader draws them as plain Text.
const countParagraphs = (min) =>
  [...document.querySelectorAll('div, span, p')].filter(
    (el) => el.children.length === 0 && (el.textContent ?? '').trim().length >= min,
  ).length;
const hasParagraphs = (min) =>
  [...document.querySelectorAll('div, span, p')].filter(
    (el) => el.children.length === 0 && (el.textContent ?? '').trim().length >= min,
  ).length >= 2;

/**
 * Launches Chromium. CI installs the browser matching the Playwright version. On a machine whose
 * preinstalled browser is a different revision (sandboxes), fall back to the binary named by
 * SMOKE_CHROMIUM_PATH or to `$PLAYWRIGHT_BROWSERS_PATH/chromium`.
 */
async function launchChromium() {
  const explicit = process.env.SMOKE_CHROMIUM_PATH;
  if (explicit) return chromium.launch({ headless: true, executablePath: explicit });
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
    const fallback = base ? join(base, 'chromium') : null;
    if (!fallback || !existsSync(fallback)) throw error;
    console.log(`smoke: default Chromium missing, falling back to ${fallback}`);
    return chromium.launch({ headless: true, executablePath: fallback });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(join(args.dist, 'index.html'))) {
    console.error(`smoke: ${args.dist}/index.html not found. Run: pnpm --filter mobile export:web`);
    return 2;
  }

  // Serve the export at <origin><basePath>/ by linking it into a temp dir. Like GitHub Pages after
  // prepare-pages.mjs, unknown paths are answered by `404.html` (a copy of index.html: the router
  // takes the address from the browser), so a deep link and a reload work on every page; an export
  // that has no 404.html yet gets that copy here.
  let serveRoot = args.dist;
  let tempRoot = null;
  const fallback = existsSync(join(args.dist, '404.html'))
    ? join(args.dist, '404.html')
    : join(args.dist, 'index.html');
  if (args.basePath) {
    tempRoot = mkdtempSync(join(tmpdir(), 'biblicapp-smoke-'));
    const link = join(tempRoot, ...args.basePath.split('/').filter(Boolean));
    mkdirSync(join(link, '..'), { recursive: true });
    symlinkSync(args.dist, link, 'dir');
    // Like GitHub Pages: the site-level 404.html answers unknown paths under the base path.
    copyFileSync(fallback, join(tempRoot, '404.html')); // a copy: serve sizes symlinks wrongly
    serveRoot = tempRoot;
  } else if (!existsSync(join(args.dist, '404.html'))) {
    tempRoot = mkdtempSync(join(tmpdir(), 'biblicapp-smoke-'));
    for (const name of readdirSync(args.dist)) {
      symlinkSync(join(args.dist, name), join(tempRoot, name));
    }
    copyFileSync(fallback, join(tempRoot, '404.html'));
    serveRoot = tempRoot;
  }

  const port = args.port || (await freePort());
  const origin = `http://127.0.0.1:${port}`;
  const serveBin = require.resolve('serve/build/main.js');
  const server = spawn(
    process.execPath,
    [
      serveBin,
      '--listen',
      `tcp://127.0.0.1:${port}`,
      '--no-clipboard',
      '--no-port-switching',
      '--symlinks',
      serveRoot,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));

  let browser;
  let page;
  let beta1Site = null;
  const tempDirs = [];
  const problems = [];
  const step = (message) => console.log(`smoke: ${message}`);

  try {
    await waitForServer(`${origin}${args.basePath}/`, server);
    step(`serving ${args.dist} at ${origin}${args.basePath}/`);

    browser = await launchChromium();
    const context = await browser.newContext({
      locale: 'ro-RO',
      viewport: { width: 420, height: 900 },
    });
    page = await context.newPage();
    page.setDefaultTimeout(args.timeout);
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('response', (res) => {
      if (
        res.status() >= 400 &&
        res.url().startsWith(origin) &&
        !res.url().endsWith('/favicon.ico')
      ) {
        // The 404.html fallback legitimately answers deep links with 404; only flag assets.
        if (/\.(js|css|ttf|woff2?|png|jpg|svg|json)(\?|$)/.test(res.url())) {
          problems.push(`HTTP ${res.status()} for ${res.url()}`);
        }
      }
    });

    // 0. Landing and the shell: both bars, the collection as cards, the drawer to the full library
    await page.goto(`${origin}${args.basePath}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="section-bar"]').waitFor({ state: 'visible' });
    for (const id of ['brand-bar', 'hero', 'doors']) {
      if ((await page.locator(`[data-testid="${id}"]`).count()) < 1) {
        throw new Error(`the landing has no "${id}"`);
      }
    }
    const cards = page.locator('[data-testid^="work-card-"]');
    await cards.first().waitFor({ state: 'visible' });
    step(`landing draws the shell and ${await cards.count()} work card(s)`);
    // A screen under another one stays mounted and hidden: only what is visible counts.
    const visibleId = (id) => page.locator(`[data-testid="${id}"]:visible`);
    await visibleId('section-item-read').click();
    if ((await visibleId('section-item-read').getAttribute('aria-expanded')) !== 'true') {
      throw new Error('the "Citește" drawer did not open (aria-expanded is not true)');
    }
    await visibleId('drawer-entry-read-library-all').click();
    await page.waitForURL(/\/library\/all/);

    // 1. Full library (the landing stays mounted under it, hidden: only visible links count)
    const workLinks = page.locator('a[href*="/work/"]:visible');
    await workLinks.first().waitFor({ state: 'visible' });
    const works = await workLinks.count();
    if (works < 1) throw new Error('the library lists no works');
    const firstWorkText = (await workLinks.first().innerText()).replace(/\s+/g, ' ').trim();
    step(`library lists ${works} work(s); first: "${firstWorkText.slice(0, 80)}"`);
    const unverified = await page.locator('[role="alert"]').allInnerTexts();
    if (unverified.some((text) => /verific/i.test(text))) {
      throw new Error(`the app rejected a bundled pack: ${unverified.join(' | ')}`);
    }
    // The section bar knows where we are: the drawer entry of this page is the current one.
    await visibleId('section-item-read').click();
    const current = await visibleId('drawer-entry-read-library-all').getAttribute('aria-current');
    if (current !== 'page')
      throw new Error(`the drawer entry of the full library is aria-current="${current}"`);
    await page.keyboard.press('Escape');

    // 2. Work page with table of contents
    await workLinks.first().click();
    await page.waitForURL(/\/work\//);
    const chapterLinks = page.locator('a[href*="/read/"]');
    await chapterLinks.first().waitFor({ state: 'visible' });
    step(`work page shows ${await chapterLinks.count()} link(s) into the reader`);

    // 2b. The edition switch (one work, two editions): a radio group on the work page. Choosing
    // the edition that is not chosen changes the address and the chapters (their first link, the
    // start button, goes to a section of the other edition).
    const editionSwitch = page.locator('[role="radiogroup"]:visible');
    await editionSwitch.first().waitFor({ state: 'visible' });
    const editions = await editionSwitch.first().locator('[role="radio"]').count();
    if (editions < 2) throw new Error(`the edition switch offers ${editions} edition(s), not 2`);
    const startBefore = await chapterLinks.first().getAttribute('href');
    await editionSwitch.first().locator('[role="radio"][aria-checked="false"]').first().click();
    await page.waitForURL(/[?&]edition=/);
    await page.waitForFunction(
      (before) => document.querySelector('a[href*="/read/"]')?.getAttribute('href') !== before,
      startBefore,
    );
    const chosen = await editionSwitch
      .first()
      .locator('[role="radio"][aria-checked="true"]')
      .count();
    if (chosen !== 1) throw new Error(`${chosen} editions are chosen after the switch, not 1`);
    step(`edition switch: ${editions} editions, now ${new URL(page.url()).search}`);

    // 3. Reader
    await chapterLinks.first().click();
    await page.waitForURL(/\/read\//);
    await page.waitForFunction(hasParagraphs, 30);
    const paragraphs = await page.evaluate(countParagraphs, 30);
    step(`reader shows ${paragraphs} text blocks of 30+ characters`);
    if (paragraphs < 2) throw new Error('the reader shows fewer than 2 paragraphs');
    const readerUrl = page.url();

    // 4. Deep link, the way GitHub Pages serves it (404.html answers any path that is not a file)
    const fresh = await context.newPage();
    fresh.setDefaultTimeout(args.timeout);
    fresh.on('pageerror', (error) => problems.push(`page error (deep link): ${error.message}`));
    await fresh.goto(readerUrl, { waitUntil: 'domcontentloaded' });
    await fresh.waitForFunction(hasParagraphs, 30);
    step(
      `deep link ${new URL(readerUrl).pathname} renders the reader through the 404.html fallback`,
    );
    await fresh.close();

    // 5. The shell, the landing and the library: geometry, the drawer and its keys, the language, the
    // sticky bar, the filters in the address, the shortcut, the app offline (docs/ui-spec-v2.md, 20).
    const checkContext = {
      browser,
      origin,
      basePath: args.basePath,
      timeout: args.timeout,
      step,
      problems,
    };
    await shellChecks(checkContext);
    await reviewChecks(checkContext);
    // 6b. The work hub, the reader and the transparency panel (scripts/lib/smoke-reader.mjs).
    await readerChecks(checkContext);

    // 7. The flags of Beta 1: the same app built with EXPO_PUBLIC_FEATURES=beta1, served like the
    // export under test (the base path included).
    if (!args.skipBeta1) {
      let beta1Root = args.beta1Dist;
      if (!beta1Root) {
        beta1Root = mkdtempSync(join(tmpdir(), 'biblicapp-beta1-'));
        tempDirs.push(beta1Root);
        step('building the export with the flags of Beta 1 (EXPO_PUBLIC_FEATURES=beta1)');
        buildExport({
          outDir: beta1Root,
          env: {
            EXPO_PUBLIC_FEATURES: 'beta1',
            ...(args.basePath ? { EXPO_PUBLIC_WEB_BASE_URL: args.basePath } : null),
          },
          tool: 'smoke',
        });
      }
      beta1Site = await serveExport({ dist: beta1Root, basePath: args.basePath });
      await beta1Checks({ ...checkContext, origin: beta1Site.origin });
    }

    if (problems.length > 0) throw new Error(problems.join('\n'));
    step('OK');
    return 0;
  } catch (error) {
    console.error(`smoke: FAILED: ${error instanceof Error ? error.message : error}`);
    if (page) {
      try {
        mkdirSync(join(root, 'test-results'), { recursive: true });
        const shot = join(root, 'test-results', 'smoke-failure.png');
        await page.screenshot({ path: shot, fullPage: true });
        console.error(`smoke: screenshot written to ${shot} (url: ${page.url()})`);
      } catch {
        /* best effort */
      }
    }
    if (problems.length > 0)
      console.error(`smoke: collected problems:\n  ${problems.join('\n  ')}`);
    if (serverLog.trim())
      console.error(`smoke: static server log:\n${serverLog.trim().slice(-1500)}`);
    return 1;
  } finally {
    await browser?.close().catch(() => {});
    await beta1Site?.close().catch(() => {});
    server.kill('SIGTERM');
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  }
}

process.exit(await main());
