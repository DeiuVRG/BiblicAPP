#!/usr/bin/env node
// Playwright check that the web export follows its theme (the dark-mode bug of docs/design-spec.md).
//
//   node scripts/check-web-theme.mjs [--dist apps/mobile/dist] [--base-path /BiblicAPP]
//                                    [--port N] [--timeout ms]
//
// Serves the export (like smoke-web.mjs; unknown paths answer with index.html, the way the
// GitHub Pages 404.html fallback does) and opens the library, a work, the reader and Settings in
// headless Chromium, at phone and desktop size, with the colour scheme emulated as light and as
// dark, and once with a theme chosen in Settings that differs from the system scheme. Each screen
// is checked right after a full page load and again after the app navigated to it (a link click,
// the browser's back button). For every state it asserts that
//   1. the header title colour, the screen background (sampled at several points) and the
//      background of <html> and <body> all belong to the palette of the active theme
//      (apps/mobile/src/theme/palettes.ts is the source of truth, read from the file),
//   2. the document's color-scheme and theme-color follow that palette,
//   3. no visible text is rendered with less than 4.5:1 contrast against what is behind it
//      (light grey text on a white page is what the bug looked like),
//   4. the page raised no uncaught error.
// Exits 1 on any failure (a screenshot of the failing state goes to test-results/), 2 on a usage
// or setup error. Build the export first: pnpm --filter mobile export:web

/* global document, getComputedStyle, matchMedia, innerHeight -- evaluated inside the browser page */
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  SCREENS,
  discoverRoutes,
  launchChromium,
  parseArgs,
  root,
  serveExport,
  waitForScreen,
} from './lib/web-export.mjs';

const args = parseArgs(process.argv.slice(2), 'theme');

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const SETTINGS_KEY = 'biblioteca:settings:v1';
const MIN_CONTRAST = 4.5;

// `os` is the emulated system scheme, `stored` a theme chosen in Settings (it wins over the
// system), `expect` the palette every colour on screen must come from.
const SCENARIOS = [
  { name: 'phone, system light', viewport: PHONE, os: 'light', stored: null, expect: 'light' },
  { name: 'phone, system dark', viewport: PHONE, os: 'dark', stored: null, expect: 'dark' },
  { name: 'desktop, system light', viewport: DESKTOP, os: 'light', stored: null, expect: 'light' },
  { name: 'desktop, system dark', viewport: DESKTOP, os: 'dark', stored: null, expect: 'dark' },
  {
    name: 'phone, system dark, sepia chosen',
    viewport: PHONE,
    os: 'dark',
    stored: 'sepia',
    expect: 'sepia',
  },
  {
    name: 'phone, system light, dark chosen',
    viewport: PHONE,
    os: 'light',
    stored: 'dark',
    expect: 'dark',
  },
];

// --- the palettes -------------------------------------------------------------------------------

const toRgb = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

/** The colours of the three palettes, as `rgb(r, g, b)` strings, read from palettes.ts. */
function readPalettes() {
  const source = readFileSync(join(root, 'apps/mobile/src/theme/palettes.ts'), 'utf8');
  const palettes = {};
  for (const name of ['light', 'sepia', 'dark']) {
    const block = new RegExp(`\\b${name}:\\s*\\{([^}]*)\\}`).exec(source);
    if (!block) throw new Error(`palette "${name}" not found in apps/mobile/src/theme/palettes.ts`);
    palettes[name] = {};
    for (const [, token, hex] of block[1].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) {
      palettes[name][token] = toRgb(hex);
    }
    for (const token of ['background', 'text']) {
      if (!palettes[name][token]) throw new Error(`palette "${name}" has no "${token}" colour`);
    }
  }
  return palettes;
}

const palettes = readPalettes();

/** "(sepia.background)" when a colour is a token of some palette, to explain a mismatch. */
function whose(colour) {
  const hits = [];
  for (const [name, palette] of Object.entries(palettes)) {
    for (const [token, value] of Object.entries(palette))
      if (value === colour) hits.push(`${name}.${token}`);
  }
  return hits.length > 0 ? ` (${hits.join(', ')})` : '';
}

// --- what is looked at, evaluated inside the page -----------------------------------------------

/** Colours and contrast of the screen as drawn. Must be self-contained: it runs in the browser. */
function probe(minContrast) {
  const parse = (value) => {
    const match = /^rgba?\((.+)\)$/.exec(value.trim());
    if (!match) return null;
    const [r, g, b, a = 1] = match[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const css = ({ r, g, b }) => `rgb(${r}, ${g}, ${b})`;
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    const mix = (x, y) => (x * top.a + y * bottom.a * (1 - top.a)) / (a || 1);
    return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
  };
  const luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  /** What is painted behind an element: its own and its ancestors' backgrounds, then the canvas. */
  const backgroundBehind = (element) => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const colour = parse(getComputedStyle(node).backgroundColor);
      if (colour && colour.a > 0) layers.push(colour);
      if (colour && colour.a === 1) break;
    }
    let result = layers.at(-1)?.a === 1 ? layers.pop() : { r: 255, g: 255, b: 255, a: 1 }; // the canvas
    while (layers.length > 0) result = over(layers.pop(), result);
    return result;
  };
  const opacityOf = (element) => {
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  };
  const visible = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
  };

  // Header title: the app marks it; otherwise the first heading in the top strip of the page.
  const headerTitle =
    document.querySelector('[data-testid="header-title"]') ??
    [...document.querySelectorAll('[role="heading"], h1')].find(
      (element) => visible(element) && element.getBoundingClientRect().top < 100,
    );

  // Screen background: what is painted at a few points in the margin, away from text and bars.
  const points = [0.35, 0.7].map((fraction) => [4, Math.round(innerHeight * fraction)]);
  const screenBackgrounds = points.map(([x, y]) => {
    const element = document.elementFromPoint(x, y);
    return element ? css(backgroundBehind(element)) : null;
  });

  // Text that is hard to read where it is drawn (disabled and fading elements are exempt).
  const lowContrast = [];
  const skipped = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE', 'META', 'HEAD']);
  let scanned = 0;
  for (const element of document.body.querySelectorAll('*')) {
    if (skipped.has(element.tagName) || scanned > 600) continue;
    const hasText = [...element.childNodes].some(
      (node) => node.nodeType === 3 && node.textContent.trim() !== '',
    );
    if (!hasText || !visible(element) || opacityOf(element) < 1) continue;
    scanned += 1;
    const foreground = parse(getComputedStyle(element).color);
    if (!foreground) continue;
    const background = backgroundBehind(element);
    const value = ratio(over(foreground, background), background);
    if (value < minContrast) {
      lowContrast.push({
        text: element.textContent.trim().slice(0, 40),
        colour: css(foreground),
        background: css(background),
        ratio: Math.round(value * 100) / 100,
      });
    }
  }

  return {
    systemScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
    declaredSchemes:
      document.querySelector('meta[name="color-scheme"]')?.getAttribute('content') ?? null,
    headerTitle: headerTitle
      ? {
          text: headerTitle.textContent.trim().slice(0, 40),
          colour: css(parse(getComputedStyle(headerTitle).color)),
        }
      : null,
    screenBackgrounds,
    lowContrast: lowContrast.slice(0, 6),
    scanned,
  };
}

/** Everything wrong with one probed state, as readable lines. */
function judge(found, expectName) {
  const palette = palettes[expectName];
  const problems = [];
  const expectColour = (what, actual, wanted) => {
    if (actual !== wanted) {
      problems.push(
        `${what} is ${actual}${whose(actual)}, expected ${wanted} (${expectName} palette)`,
      );
    }
  };
  expectColour('<html> background', found.htmlBackground, palette.background);
  expectColour('<body> background', found.bodyBackground, palette.background);
  found.screenBackgrounds.forEach((colour, index) =>
    expectColour(
      `screen background (sample ${index + 1})`,
      colour ?? 'nothing',
      palette.background,
    ),
  );
  if (found.headerTitle)
    expectColour('header title colour', found.headerTitle.colour, palette.text);
  else problems.push('no header title found');
  const scheme = expectName === 'dark' ? 'dark' : 'light';
  if (found.colorScheme !== scheme)
    problems.push(`document color-scheme is "${found.colorScheme}", expected "${scheme}"`);
  if (found.themeColor !== null) {
    // The meta tag holds the palette's hex colour; compare as rgb.
    const hex = /^#[0-9a-f]{6}$/i.test(found.themeColor)
      ? toRgb(found.themeColor)
      : found.themeColor;
    expectColour('theme-color', hex, palette.background);
  } else problems.push('no <meta name="theme-color"> (the app sets it once it runs)');
  if (!found.declaredSchemes?.includes('dark'))
    problems.push('no <meta name="color-scheme"> declaring light and dark');
  for (const item of found.lowContrast) {
    problems.push(
      `low contrast (${item.ratio}:1) for "${item.text}": ${item.colour} on ${item.background}${whose(item.colour)}`,
    );
  }
  return problems;
}

// --- running ------------------------------------------------------------------------------------

async function main() {
  let site;
  let browser;
  const failures = [];
  const log = (message) => console.log(`theme: ${message}`);

  try {
    site = await serveExport(args);
    browser = await launchChromium('theme');
    log(`serving ${args.dist} at ${site.base}/`);

    const finder = await browser.newContext({ locale: 'ro-RO', viewport: PHONE });
    const routes = await discoverRoutes(await finder.newPage(), site.base, args.timeout);
    await finder.close();
    log(`routes: ${SCREENS.map((screen) => `${screen}=${routes[screen]}`).join(' ')}`);

    for (const scenario of SCENARIOS) {
      const context = await browser.newContext({
        locale: 'ro-RO',
        colorScheme: scenario.os,
        viewport: scenario.viewport,
      });
      if (scenario.stored) {
        const value = JSON.stringify({ fontSize: 18, lineHeight: 1.6, theme: scenario.stored });
        await context.addInitScript(
          ([key, stored]) => {
            try {
              localStorage.setItem(key, stored);
            } catch {
              /* storage unavailable */
            }
          },
          [SETTINGS_KEY, value],
        );
      }
      const page = await context.newPage();
      page.setDefaultTimeout(args.timeout);
      const errors = [];
      page.on('pageerror', (error) => errors.push(`uncaught error: ${error.message}`));

      let checked = 0;
      /** Waits for the screen, probes it and records what is wrong. */
      const check = async (screen, how) => {
        await waitForScreen(page, screen, args.timeout);
        await page.waitForTimeout(250);
        const problems = judge(await page.evaluate(probe, MIN_CONTRAST), scenario.expect);
        checked += 1;
        if (problems.length === 0) return;
        const label = `${scenario.name}: ${screen} (${how})`;
        failures.push(`${label}\n    ${problems.join('\n    ')}`);
        try {
          mkdirSync(join(root, 'test-results'), { recursive: true });
          const slug = `${scenario.name}-${screen}-${how}`
            .replace(/[^a-z0-9]+/gi, '-')
            .toLowerCase();
          await page.screenshot({ path: join(root, 'test-results', `theme-failure-${slug}.png`) });
        } catch {
          /* best effort */
        }
      };

      // Every screen after a full page load.
      for (const screen of SCREENS) {
        await page.goto(`${site.base}${routes[screen]}`, { waitUntil: 'domcontentloaded' });
        await check(screen, 'full load');
      }

      // Every screen after the app navigated to it: links forward, the back button, a header link.
      await page.goto(`${site.base}${routes.library}`, { waitUntil: 'domcontentloaded' });
      await waitForScreen(page, 'library', args.timeout);
      await page.locator('a[href*="/work/"]').first().click();
      await check('work', 'navigation');
      await page.locator('a[href*="/read/"]').first().click();
      await check('reader', 'navigation');
      await page.goBack();
      await page.goBack();
      await check('library', 'back navigation');
      await page.locator('a[href$="/settings"]').first().click();
      await check('settings', 'navigation');

      for (const error of errors) failures.push(`${scenario.name}: ${error}`);
      log(`${scenario.name}: ${checked} states checked`);
      await context.close();
    }

    if (failures.length > 0) {
      console.error(`theme: FAILED (${failures.length} problem(s)):\n  ${failures.join('\n  ')}`);
      return 1;
    }
    log('OK');
    return 0;
  } catch (error) {
    console.error(`theme: FAILED: ${error instanceof Error ? error.message : error}`);
    return failures.length > 0 ? 1 : 2;
  } finally {
    await browser?.close().catch(() => {});
    await site?.close();
  }
}

process.exit(await main());
