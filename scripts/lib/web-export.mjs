// Helpers shared by the Playwright scripts that look at the static web export
// (check-web-theme.mjs, screenshots-web.mjs): argument parsing, a static server and Chromium.
//
// The export is a single-page app (`web.output: 'single'`): a request for a path that is not a
// file is answered with index.html, so deep links (/work/<id>) can be opened with a full page
// load. With a base path (an export built with EXPO_PUBLIC_WEB_BASE_URL=/BiblicAPP) the site is
// served under that path only, like a GitHub Pages project site.

/* global document -- evaluated inside the browser page */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

export const root = fileURLToPath(new URL('../..', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Parses `--dist <dir>`, `--base-path </x>`, `--port <n>` and `--timeout <ms>`; every other flag
 * goes to `extra`, a map of flag name to `(value, args) => void`, or the script exits with 2.
 */
export function parseArgs(argv, tool, extra = {}) {
  const args = { dist: join(root, 'apps/mobile/dist'), basePath: '', port: 0, timeout: 45_000 };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = () => {
      i += 1;
      if (argv[i] === undefined) {
        console.error(`${tool}: ${flag} needs a value`);
        process.exit(2);
      }
      return argv[i];
    };
    if (flag === '--dist') args.dist = resolve(value());
    else if (flag === '--base-path') args.basePath = value().replace(/\/+$/, '');
    else if (flag === '--port') args.port = Number(value());
    else if (flag === '--timeout') args.timeout = Number(value());
    else if (extra[flag]) extra[flag](value(), args);
    else {
      console.error(`${tool}: unknown argument ${flag}`);
      process.exit(2);
    }
  }
  if (args.basePath && !args.basePath.startsWith('/')) args.basePath = `/${args.basePath}`;
  return args;
}

/** The file that answers `path` (inside `dir`), or null: no directory escapes, index.html for directories. */
function fileFor(dir, path) {
  const candidate = resolve(dir, `.${path}`);
  if (candidate !== dir && !candidate.startsWith(dir + sep)) return null;
  if (!existsSync(candidate)) return null;
  const stats = statSync(candidate);
  if (stats.isDirectory()) {
    const index = join(candidate, 'index.html');
    return existsSync(index) ? index : null;
  }
  return candidate;
}

/**
 * Serves `dist` on 127.0.0.1 under `basePath` and resolves to `{ origin, base, close }`.
 * `base` is the URL of the site root (`http://127.0.0.1:<port><basePath>`, no trailing slash).
 */
export async function serveExport({ dist, basePath = '', port = 0 }) {
  const dir = resolve(dist);
  if (!existsSync(join(dir, 'index.html'))) {
    throw new Error(`${join(dir, 'index.html')} not found. Run: pnpm --filter mobile export:web`);
  }
  const server = http.createServer((request, response) => {
    let path;
    try {
      path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (basePath) {
      if (path === basePath || path.startsWith(`${basePath}/`))
        path = path.slice(basePath.length) || '/';
      else {
        response.writeHead(404).end('Not found (outside the base path)');
        return;
      }
    }
    let file = fileFor(dir, path);
    // Single-page fallback: anything that is not a file and does not look like one is a route.
    if (!file && !extname(path)) file = join(dir, 'index.html');
    if (!file) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(readFileSync(file));
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    base: `${origin}${basePath}`,
    close: () => new Promise((done) => server.close(() => done())),
  };
}

/**
 * Builds the web export of the app into `outDir` with `env` added to the environment: a build
 * profile that differs from the delivered one only in its flags (`EXPO_PUBLIC_FEATURES=beta1`, see
 * apps/mobile/src/config/features.ts), which the smoke test serves next to the export under test.
 */
export function buildExport({ outDir, env = {}, tool = 'export' }) {
  const mobile = join(root, 'apps/mobile');
  const cli = createRequire(import.meta.url).resolve('expo/bin/cli', { paths: [mobile] });
  const result = spawnSync(
    process.execPath,
    [cli, 'export', '--platform', 'web', '--output-dir', outDir],
    {
      cwd: mobile,
      env: { ...process.env, ...env, CI: '1' },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(`${tool}: the export failed:\n${(result.stderr || result.stdout).slice(-2000)}`);
  }
}

/**
 * Launches Chromium. CI installs the browser matching the Playwright version. On a machine whose
 * preinstalled browser is a different revision (sandboxes), fall back to the binary named by
 * SMOKE_CHROMIUM_PATH or to `$PLAYWRIGHT_BROWSERS_PATH/chromium` (or /opt/pw-browsers/chromium).
 */
export async function launchChromium(tool) {
  const explicit = process.env.SMOKE_CHROMIUM_PATH;
  if (explicit) return chromium.launch({ headless: true, executablePath: explicit });
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const bases = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
    const fallback = bases.map((base) => join(base, 'chromium')).find((path) => existsSync(path));
    if (!fallback) throw error;
    console.log(`${tool}: default Chromium missing, falling back to ${fallback}`);
    return chromium.launch({ headless: true, executablePath: fallback });
  }
}

/**
 * The URLs of the screens the design covers, found by clicking through the app the way a reader
 * does: the landing, the curated library, the full library, the authors list, search, the first
 * work (a link on the full library, whose accordion is open for a small library), its first chapter
 * and Settings. The routes of docs/ui-spec-v2.md 4.4: `/` is the landing, the library lives at
 * `/library` (Selecție) and `/library/all`.
 */
export async function discoverRoutes(page, base, timeout) {
  await page.goto(`${base}/library/all`, { waitUntil: 'domcontentloaded' });
  const work = page.locator('a[href*="/work/"]').first();
  await work.waitFor({ state: 'visible', timeout });
  const workPath = new URL(await work.getAttribute('href'), `${base}/`).pathname;
  await page.goto(`${base}${stripBase(workPath, base)}`, { waitUntil: 'domcontentloaded' });
  const chapter = page.locator('a[href*="/read/"]').first();
  await chapter.waitFor({ state: 'visible', timeout });
  const readerPath = new URL(await chapter.getAttribute('href'), `${base}/`).pathname;
  return {
    landing: '/',
    library: '/library',
    'library-all': '/library/all',
    authors: '/authors',
    search: '/search',
    work: stripBase(workPath, base),
    reader: stripBase(readerPath, base),
    settings: '/settings',
  };
}

/** `/BiblicAPP/work/x` to `/work/x` for a base like `http://host:1234/BiblicAPP`. */
function stripBase(path, base) {
  const prefix = new URL(base).pathname.replace(/\/+$/, '');
  return prefix && path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
}

// Evaluated inside the page: the reader is on screen when its own progress bar (the one with a
// value; the loading view has none) is visible and at least two visible leaf text blocks of `min`
// characters (rendered paragraphs) are. Visible matters: a screen the reader was opened from stays
// in the DOM under it (display: none), and its table of contents has text blocks too.
const readerReady = (min) => {
  const visible = (el) => {
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  const progress = [...document.querySelectorAll('[role="progressbar"][aria-valuenow]')].some(
    visible,
  );
  const blocks = [...document.querySelectorAll('div, span, p')].filter(
    (el) => el.children.length === 0 && (el.textContent ?? '').trim().length >= min && visible(el),
  );
  return progress && blocks.length >= 2;
};

/** The screens of the design, in the order of the reading flow (the names of docs/ui-spec-v2.md 20.1). */
export const SCREENS = [
  'landing',
  'library',
  'library-all',
  'authors',
  'search',
  'work',
  'reader',
  'settings',
];

/**
 * What proves that a screen has drawn its content: a test id that only exists once the data is in.
 * The screen a page stays on while its data loads has the shell but not these.
 */
const READY = {
  landing: '[data-testid="doors"]',
  library: '[data-testid="library-hero-search"]',
  'library-all': '[data-testid="library-count"]',
  authors: '[data-testid="authors-count"]',
  search: '[data-testid="search-input"]',
  // The title of Settings (the phone menu has a theme selector of its own, so a radio group is no
  // proof that the page is there).
  settings: '[data-testid="settings-title"]',
};

/** Waits until a screen has drawn its content (fonts loaded, list rows or paragraphs on screen). */
export async function waitForScreen(page, screen, timeout) {
  // A screen that was left stays mounted under the next one (hidden): only a visible match counts.
  if (READY[screen])
    await page.locator(`${READY[screen]}:visible`).first().waitFor({ state: 'visible', timeout });
  else if (screen === 'work') await page.locator('a[href*="/read/"]').first().waitFor({ timeout });
  else if (screen === 'reader') await page.waitForFunction(readerReady, 30, { timeout });
  else await page.locator(`${READY.settings}:visible`).first().waitFor({ timeout });
  // The landing and the library list their content once the packs are read.
  if (screen === 'landing')
    await page.locator('[data-testid^="work-card-"]').first().waitFor({ timeout });
  // The list of works (the author view) or the tiles of the centuries (the other view).
  if (screen === 'library-all')
    await page
      .locator('a[href*="/work/"], [data-testid="century-tiles"]')
      .first()
      .waitFor({ timeout });
  await page.evaluate(() => document.fonts.ready);
}
