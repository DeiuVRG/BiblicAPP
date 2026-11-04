#!/usr/bin/env node
// Playwright smoke test for the static web export.
//
//   node scripts/smoke-web.mjs [--dist apps/mobile/dist] [--base-path /BiblicAPP] [--port N]
//
// Serves the export with `serve`, opens it in headless Chromium and checks that
//   1. the library lists at least one work (and shows no "unverified pack" notice),
//   2. opening the work shows its table of contents,
//   2b. the work has two editions (Romanian and English): choosing the other one puts
//      `?edition=` in the address and shows that edition's table of contents,
//   3. opening the first chapter renders several paragraphs of text,
//   4. (only when the export contains 404.html, i.e. after prepare-pages.mjs) a deep link to
//      that chapter loads directly, the way GitHub Pages serves it.
// Use --base-path with an export built with EXPO_PUBLIC_WEB_BASE_URL=/BiblicAPP.
// Exits non-zero on any failure; a screenshot goes to test-results/ for CI artifacts.

/* global document -- the two helpers below are evaluated inside the browser page */
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = { dist: join(root, 'apps/mobile/dist'), basePath: '', port: 0, timeout: 45_000 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dist') args.dist = resolve(argv[(i += 1)]);
    else if (a === '--base-path') args.basePath = argv[(i += 1)].replace(/\/+$/, '');
    else if (a === '--port') args.port = Number(argv[(i += 1)]);
    else if (a === '--timeout') args.timeout = Number(argv[(i += 1)]);
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

  // Serve the export at <origin><basePath>/ by linking it into a temp dir when a base path is used.
  let serveRoot = args.dist;
  let tempRoot = null;
  if (args.basePath) {
    tempRoot = mkdtempSync(join(tmpdir(), 'biblicapp-smoke-'));
    const link = join(tempRoot, ...args.basePath.split('/').filter(Boolean));
    mkdirSync(join(link, '..'), { recursive: true });
    symlinkSync(args.dist, link, 'dir');
    // Like GitHub Pages: the site-level 404.html answers unknown paths under the base path.
    if (existsSync(join(args.dist, '404.html')))
      copyFileSync(join(args.dist, '404.html'), join(tempRoot, '404.html')); // a copy: serve sizes symlinks wrongly
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

    // 1. Library
    await page.goto(`${origin}${args.basePath}/`, { waitUntil: 'domcontentloaded' });
    const workLinks = page.locator('a[href*="/work/"]');
    await workLinks.first().waitFor({ state: 'visible' });
    const works = await workLinks.count();
    if (works < 1) throw new Error('the library lists no works');
    const firstWorkText = (await workLinks.first().innerText()).replace(/\s+/g, ' ').trim();
    step(`library lists ${works} work(s); first: "${firstWorkText.slice(0, 80)}"`);
    const unverified = await page.locator('[role="alert"]').allInnerTexts();
    if (unverified.some((text) => /verific/i.test(text))) {
      throw new Error(`the app rejected a bundled pack: ${unverified.join(' | ')}`);
    }

    // 2. Work page with table of contents
    await workLinks.first().click();
    await page.waitForURL(/\/work\//);
    const chapterLinks = page.locator('a[href*="/read/"]');
    await chapterLinks.first().waitFor({ state: 'visible' });
    step(`work page shows ${await chapterLinks.count()} link(s) into the reader`);

    // 2b. The edition switch (one work, two editions): a radio group on the work page. Choosing
    // the edition that is not chosen changes the address and the chapters (their first link, the
    // start button, goes to a section of the other edition).
    const editionSwitch = page.locator('[role="radiogroup"]');
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

    // 4. Deep link, the way GitHub Pages serves it (needs 404.html)
    if (existsSync(join(args.dist, '404.html'))) {
      const fresh = await context.newPage();
      fresh.setDefaultTimeout(args.timeout);
      fresh.on('pageerror', (error) => problems.push(`page error (deep link): ${error.message}`));
      await fresh.goto(readerUrl, { waitUntil: 'domcontentloaded' });
      await fresh.waitForFunction(hasParagraphs, 30);
      step(
        `deep link ${new URL(readerUrl).pathname} renders the reader through the 404.html fallback`,
      );
      await fresh.close();
    } else {
      step('no 404.html in the export: deep-link check skipped');
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
    server.kill('SIGTERM');
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  }
}

process.exit(await main());
