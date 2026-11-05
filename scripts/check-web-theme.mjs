#!/usr/bin/env node
// Playwright check that the web export follows its theme (the dark-mode bug of docs/design-spec.md).
//
//   node scripts/check-web-theme.mjs [--dist apps/mobile/dist] [--base-path /BiblicAPP]
//                                    [--port N] [--timeout ms] [--only "sepia chosen"]
//
// Serves the export (like smoke-web.mjs; unknown paths answer with index.html, the way the
// GitHub Pages 404.html fallback does) and opens the landing, the library (Selecție and Toată
// biblioteca), the authors, search, a work, the reader and Settings in
// headless Chromium, at phone and desktop size, with the colour scheme emulated as light and as
// dark, and once with a theme chosen in Settings that differs from the system scheme. Each screen
// is checked right after a full page load, once it is used (the results of a search, the tiles of
// the centuries, the shelves unfolded, the sheet of a filter, the drawer of the section bar, the
// menu of a phone) and again after the app navigated to it (a link click, the browser's back
// button). For every state it asserts that
//   1. the colour of the page title (the first heading, or the running head of the reader), the
//      background of the bars of the shell, the bands of the screen (sampled at several points)
//      and the background of <html> and <body> all belong to the palette of the active theme
//      (apps/mobile/src/theme/palettes.ts is the source of truth, read from the file),
//   2. the document's color-scheme, scrollbar colours and theme-color follow that palette,
//   3. no visible text is rendered with less than 4.5:1 contrast against what is behind it
//      (light grey text on a white page is what the bug looked like),
//   4. the page does not scroll sideways and the browser tab is named after the screen,
//   5. the page raised no uncaught error.
// Before the app starts (its JavaScript held back) the page must already be painted in the
// colours of the active theme, pixel by pixel, so there is no flash of the wrong one. Last, per
// scenario, the semantics the design relies on are checked in the DOM: the themed focus ring, the
// search field (it keeps its size while typing, the clear button stays inside it), the state of
// the theme radios (their rows on a narrow container, and that the keyboard drives them), the
// typography button and the progress bar, the balanced title of the work page, the not-found
// page, and that nothing overflows on a narrow phone with the search field or the typography
// sheet in use.
// Exits 1 on any failure (a screenshot of the failing state goes to test-results/), 2 on a usage
// or setup error. Build the export first: pnpm --filter mobile export:web

/* global document, getComputedStyle, matchMedia, innerHeight, innerWidth, Image, requestAnimationFrame -- evaluated inside the browser page */
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

// `--only <text>` runs just the scenarios whose name contains the text (while working on one).
const args = parseArgs(process.argv.slice(2), 'theme', {
  '--only': (value, parsed) => (parsed.only = value),
});

const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 640 };
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
  {
    name: 'narrow phone, system light',
    viewport: NARROW,
    os: 'light',
    stored: null,
    expect: 'light',
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

  /** The first element at or under `element` that has text of its own. */
  const textLeaf = (element) =>
    [element, ...element.querySelectorAll('*')].find((node) =>
      [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim() !== ''),
    ) ?? element;

  // The title of the page: the running head of the reader (the page has a toolbar of its own
  // there), otherwise the first level-1 heading. Screens the user came from stay in the DOM,
  // hidden: only a visible one counts.
  const pageTitle =
    [...document.querySelectorAll('[data-testid="reader-running-title"]')].filter(visible).at(-1) ??
    [...document.querySelectorAll('h1, [role="heading"][aria-level="1"]')].filter(visible).at(0);

  // The bars of the shell (docs/ui-spec-v2.md, 4.1 and 4.2) of the screen in front.
  const bar = (id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].filter(visible)[0];
  const brand = bar('brand-bar');
  const section = bar('section-bar');
  const shell = {
    brandBackground: brand ? css(parse(getComputedStyle(brand).backgroundColor)) : null,
    brandHeight: brand ? brand.getBoundingClientRect().height : null,
    sectionBackground: section ? css(parse(getComputedStyle(section).backgroundColor)) : null,
    sectionBorder: section ? getComputedStyle(section).borderBottomColor : null,
    sectionHeight: section ? section.getBoundingClientRect().height : null,
    sectionTop: section ? section.getBoundingClientRect().top : null,
  };

  // Band backgrounds: what is painted at a few points in the margin, away from text and bars. A
  // page is a stack of bands (background, cream, warm, the dark masthead), so any of them will do.
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
    scrollbarColor: getComputedStyle(document.documentElement).scrollbarColor,
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
    declaredSchemes:
      document.querySelector('meta[name="color-scheme"]')?.getAttribute('content') ?? null,
    title: document.title,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    viewportWidth: innerWidth,
    pageTitleRight: pageTitle ? pageTitle.getBoundingClientRect().right : null,
    pageTitle: pageTitle
      ? {
          text: pageTitle.textContent.trim().slice(0, 40),
          // The element that holds the letters (a title of two lines has a box around them).
          colour: css(parse(getComputedStyle(textLeaf(pageTitle)).color)),
        }
      : null,
    shell,
    screenBackgrounds,
    lowContrast: lowContrast.slice(0, 6),
    scanned,
  };
}

// The browser tab: what each screen's title has to look like (the app's name comes last).
const TITLES = {
  landing: /^Biblioteca$/,
  library: /^Selecție · Biblioteca$/,
  'library-all': /^Toată biblioteca · Biblioteca$/,
  authors: /^Autori · Biblioteca$/,
  search: /^Căutare · Biblioteca$/,
  work: /^.+ · Biblioteca$/,
  reader: /^.+ · .+ · Biblioteca$/,
  settings: /^Setări · Biblioteca$/,
};

// The screens whose title sits in a dark hero band (the masthead).
const HERO_SCREENS = new Set(['landing', 'library', 'library-all', 'authors', 'search']);

/** Everything wrong with one probed state of `screen`, as readable lines. */
function judge(found, expectName, screen, { overlay = false } = {}) {
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
  // The bands of a page: any of the four backgrounds of the palette, nothing else (a white band
  // in the dark theme is the bug this script exists for).
  const bands = [palette.background, palette.cream, palette.warm, palette.masthead];
  // (Not under a scrim: the sheet of a filter and the menu dim the page behind them.)
  found.screenBackgrounds.forEach((colour, index) => {
    if (!overlay && !bands.includes(colour ?? ''))
      problems.push(
        `band background (sample ${index + 1}) is ${colour ?? 'nothing'}${whose(colour ?? '')}, expected one of the ${expectName} bands`,
      );
  });
  // The shell: the brand bar is cream, the section bar the page background with a hairline under it,
  // 64 and 48 points high (56 and 44 on a phone) plus the hairline, and the section bar sits at the top
  // of the window (it is the sticky header). The reader has no brand bar of its own.
  const { shell } = found;
  const phone = found.viewportWidth <= 640;
  if (screen !== 'reader') {
    if (shell.brandBackground === null) problems.push('no brand bar');
    else {
      expectColour('brand bar background', shell.brandBackground, palette.cream);
      const wanted = phone ? 56 : 64;
      if (Math.abs(shell.brandHeight - wanted) > 2)
        problems.push(
          `the brand bar is ${shell.brandHeight} px high, expected ${wanted} (+ border)`,
        );
    }
  }
  if (shell.sectionBackground === null) problems.push('no section bar');
  else {
    expectColour('section bar background', shell.sectionBackground, palette.background);
    expectColour('section bar border', shell.sectionBorder, palette.border);
    const wanted = phone ? 44 : 48;
    if (Math.abs(shell.sectionHeight - wanted) > 2)
      problems.push(
        `the section bar is ${shell.sectionHeight} px high, expected ${wanted} (+ border)`,
      );
  }
  // The title of the page: light on the dark hero of the library pages, the text colour elsewhere,
  // the quiet running head in the reader.
  const titleToken =
    screen === 'reader' ? 'textMuted' : HERO_SCREENS.has(screen) ? 'mastheadInk' : 'text';
  if (found.pageTitle)
    expectColour('page title colour', found.pageTitle.colour, palette[titleToken]);
  else problems.push('no page title found');
  if (TITLES[screen] && !TITLES[screen].test(found.title))
    problems.push(`browser tab title is "${found.title}", expected ${TITLES[screen]}`);
  if (found.overflowX > 0) problems.push(`the page scrolls sideways by ${found.overflowX} px`);
  // On a phone the title stops at the gutter, like the text around it.
  const gutter = 24;
  if (
    found.viewportWidth < 768 &&
    found.pageTitleRight !== null &&
    found.pageTitleRight > found.viewportWidth - gutter + 0.5
  )
    problems.push(
      `the page title ends at ${Math.round(found.pageTitleRight)} px, inside the ${gutter} px gutter of a ${found.viewportWidth} px window`,
    );
  const scheme = expectName === 'dark' ? 'dark' : 'light';
  if (found.colorScheme !== scheme)
    problems.push(`document color-scheme is "${found.colorScheme}", expected "${scheme}"`);
  // Scrollbars: the thumb is the control outline colour, the track is the page.
  expectColour(
    'scrollbar-color',
    found.scrollbarColor,
    `${palette.borderStrong} ${palette.background}`,
  );
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

// --- before the app starts ------------------------------------------------------------------------

/** The colour of one pixel of a PNG screenshot, read back through a canvas of a second page. */
function pixelOf(reader, png, x, y) {
  return reader.evaluate(
    async ([data, px, py]) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const [r, g, b] = context.getImageData(px, py, 1, 1).data;
      return `rgb(${r}, ${g}, ${b})`;
    },
    [png.toString('base64'), x, y],
  );
}

/**
 * Opens the library with the app's JavaScript held back and looks at what is painted: <html>,
 * <body> and real pixels must already have the colours of the active theme (a theme chosen in
 * Settings or the system scheme), or the page flashes the wrong one until the app starts.
 */
async function firstPaintProblems(context, reader, scenario, url) {
  const palette = palettes[scenario.expect];
  const problems = [];
  const page = await context.newPage();
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/_expo/static/js/**', async (route) => {
    await held;
    await route.continue().catch(() => {});
  });
  try {
    await page.goto(url, { waitUntil: 'commit' });
    // The document is parsed (the held-back script is deferred, so this does not wait for it).
    await page.waitForFunction(() => document.body && document.querySelector('#root'));
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    const found = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      rendered: document.querySelector('#root')?.childElementCount ?? 0,
    }));
    if (found.rendered > 0)
      problems.push('the app had already started: its script was not held back');
    for (const [what, colour] of [
      ['<html>', found.html],
      ['<body>', found.body],
    ]) {
      if (colour !== palette.background)
        problems.push(
          `before the app starts, ${what} is ${colour}${whose(colour)}, expected ${palette.background} (${scenario.expect} palette)`,
        );
    }
    const png = await page.screenshot();
    const { width, height } = scenario.viewport;
    for (const [x, y] of [
      [4, 4],
      [Math.floor(width / 2), Math.floor(height / 2)],
      [width - 4, height - 4],
    ]) {
      const colour = await pixelOf(reader, png, x, y);
      if (colour !== palette.background)
        problems.push(
          `before the app starts, the pixel at (${x}, ${y}) is ${colour}${whose(colour)}, expected ${palette.background} (${scenario.expect} palette)`,
        );
    }
  } finally {
    release();
    await page.close().catch(() => {});
  }
  return problems;
}

// --- semantics of the design ----------------------------------------------------------------------

/** The outline of whatever has focus, as the browser computes it. Evaluated inside the page. */
const focusRing = () => {
  const element = document.activeElement;
  const css = getComputedStyle(element);
  return {
    tag: element.tagName,
    style: css.outlineStyle,
    width: css.outlineWidth,
    offset: css.outlineOffset,
    colour: css.outlineColor,
  };
};

// Settings has several radio groups (reading font, theme, reading language, interface language):
// the theme one is found by its name, "Tema".
const THEME_RADIOS = '[role="radiogroup"][aria-label="Tema"] [role="radio"]';

/** The theme radios as the DOM exposes them. Evaluated inside the page. */
const radiosOf = () =>
  [...document.querySelectorAll('[role="radiogroup"][aria-label="Tema"] [role="radio"]')].map(
    (element) => ({
      label: element.getAttribute('aria-label'),
      checked: element.getAttribute('aria-checked'),
      selected: element.getAttribute('aria-selected'),
      tabindex: element.getAttribute('tabindex'),
      focused: element === document.activeElement,
    }),
  );

/** Every radio group of the page with its radios and their state. Evaluated inside the page. */
const radioGroupsOf = () =>
  [...document.querySelectorAll('[role="radiogroup"]')].map((group) => ({
    name: group.getAttribute('aria-label'),
    radios: [...group.querySelectorAll('[role="radio"]')].map((radio) => ({
      label: radio.getAttribute('aria-label'),
      checked: radio.getAttribute('aria-checked'),
      tabindex: radio.getAttribute('tabindex'),
    })),
  }));

const overflowOf = () => document.documentElement.scrollWidth - innerWidth;

/**
 * Follows the link to Settings the way a reader finds it: in the brand bar on a wide screen, in the
 * menu (the button at the right of the brand bar) on a phone.
 */
async function openSettings(page) {
  const menu = page.locator('[data-testid="menu-button"]:visible');
  if (await menu.count()) {
    await menu.first().click();
    await page.locator('[data-testid="menu-link-settings"]').first().click();
  } else {
    await page.locator('[data-testid="settings-link"]:visible').first().click();
  }
}

/** The labels of radios whose text is wider than the segment it sits in ("Autom…"). Run in the page. */
const cutOffRadios = () =>
  [...document.querySelectorAll('[role="radio"]')]
    .filter((radio) => {
      const text = radio.firstElementChild;
      return text !== null && text.scrollWidth > text.clientWidth + 1;
    })
    .map((radio) => radio.getAttribute('aria-label'));

/**
 * What a screen reader and the keyboard get from the design: a themed focus ring, the state of
 * the controls in the DOM (react-native-web only maps the `aria-*` props, not the `accessibility*`
 * ones), and nothing wider than the window. Returns the problems as readable lines. Ends by
 * changing the theme with the keyboard, so it must be the last thing a page does.
 */
async function semanticsProblems(page, scenario, site, routes) {
  const palette = palettes[scenario.expect];
  const problems = [];
  const expectEqual = (what, actual, wanted) => {
    if (actual !== wanted)
      problems.push(`${what} is ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
  };
  const open = async (screen, route) => {
    await page.goto(`${site.base}${route}`, { waitUntil: 'domcontentloaded' });
    await waitForScreen(page, screen, args.timeout);
    await page.waitForTimeout(250);
  };

  // The focus ring: keyboard focus only, 2 px, in the `accentStrong` of the theme (the brand
  // colour `accent` is for fills and graphics; text and rings need 4.5:1 and 3:1).
  await open('library', routes.library);
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(focusRing);
  expectEqual('focus ring style after Tab', ring.style, 'solid');
  expectEqual('focus ring width after Tab', ring.width, '2px');
  expectEqual('focus ring colour after Tab', ring.colour, palette.accentStrong);

  // Search: the field has focus on arrival; its ring replaces its border; typing does not resize
  // it, and the clear button stays inside it.
  await page.goto(`${site.base}/search`, { waitUntil: 'domcontentloaded' });
  const field = page.locator('input').first();
  await field.waitFor({ timeout: args.timeout });
  await page.waitForTimeout(250);
  const fieldRing = await page.evaluate(focusRing);
  expectEqual('search field focus ring colour', fieldRing.colour, palette.accentStrong);
  expectEqual('search field focus ring width', fieldRing.width, '2px');
  expectEqual('search field focus ring offset', fieldRing.offset, '-1px');
  const before = await field.boundingBox();
  await field.fill('kingdom');
  await page.waitForTimeout(400);
  const after = await field.boundingBox();
  const clear = await page.getByRole('button', { name: 'Șterge căutarea' }).boundingBox();
  if (Math.abs(before.width - after.width) > 0.5)
    problems.push(`typing resized the search field from ${before.width} to ${after.width} px`);
  if (!clear || clear.x < after.x || clear.x + clear.width > after.x + after.width + 0.5)
    problems.push(`the clear button (${JSON.stringify(clear)}) is not inside the field`);
  expectEqual('sideways overflow with the search field in use', await page.evaluate(overflowOf), 0);

  // The reader: the progress bar and the typography button carry their state in the DOM, the
  // sheet closes with Escape and fits a narrow phone.
  await open('reader', routes.reader);
  const progress = await page.evaluate(() => {
    const bar = document.querySelector('[role="progressbar"]');
    return (
      bar && {
        now: bar.getAttribute('aria-valuenow'),
        min: bar.getAttribute('aria-valuemin'),
        max: bar.getAttribute('aria-valuemax'),
      }
    );
  });
  if (!progress || !/^\d+$/.test(progress.now ?? ''))
    problems.push('the progress bar has no aria-valuenow');
  else {
    expectEqual('progress aria-valuemin', progress.min, '0');
    expectEqual('progress aria-valuemax', progress.max, '100');
  }
  const toggle = page.getByRole('button', { name: /Aspectul textului/ });
  expectEqual(
    'typography button aria-expanded',
    await toggle.getAttribute('aria-expanded'),
    'false',
  );
  await toggle.click();
  expectEqual(
    'typography button aria-expanded (open)',
    await toggle.getAttribute('aria-expanded'),
    'true',
  );
  await page.getByText('Mărimea textului').first().waitFor({ timeout: args.timeout });
  expectEqual(
    'sideways overflow with the typography sheet open',
    await page.evaluate(overflowOf),
    0,
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expectEqual(
    'typography button aria-expanded (Escape)',
    await toggle.getAttribute('aria-expanded'),
    'false',
  );
  if (await page.getByText('Mărimea textului').count())
    problems.push('Escape did not close the typography sheet');

  // The work page: its display title breaks into balanced lines (no one-word last line).
  await open('work', routes.work);
  const wrap = await page.evaluate(() => {
    const name = document.title.split(' · ')[0];
    const title = [...document.querySelectorAll('[role="heading"]')].find(
      (element) => element.textContent.trim() === name,
    );
    return title ? getComputedStyle(title).textWrapStyle : null;
  });
  expectEqual('text-wrap of the work title', wrap, 'balance');

  // A page that does not exist: the title is on the page once (the header says "Biblioteca").
  await page.goto(`${site.base}/no-such-page`, { waitUntil: 'domcontentloaded' });
  const notFound = page.getByText('Pagină negăsită', { exact: true });
  await notFound.first().waitFor({ timeout: args.timeout });
  await page.waitForTimeout(250);
  expectEqual('number of "Pagină negăsită" on the not-found page', await notFound.count(), 1);
  expectEqual('not-found tab title', await page.title(), 'Pagină negăsită · Biblioteca');

  // Settings: the theme radios expose their state, form one tab stop and answer the keyboard.
  await open('settings', routes.settings);
  expectEqual('sideways overflow on Settings', await page.evaluate(overflowOf), 0);
  expectEqual(
    'radio labels cut off on Settings',
    JSON.stringify(await page.evaluate(cutOffRadios)),
    '[]',
  );
  // The theme options share one row while each gets 84 px, and wrap into two rows below that.
  const grid = await page.evaluate(() => {
    const group = document.querySelector('[role="radiogroup"][aria-label="Tema"]');
    const radios = [...group.querySelectorAll('[role="radio"]')];
    return {
      width: group.getBoundingClientRect().width,
      count: radios.length,
      rows: new Set(radios.map((radio) => Math.round(radio.getBoundingClientRect().top))).size,
    };
  });
  expectEqual('rows of theme options', grid.rows, grid.width >= grid.count * 84 ? 1 : 2);

  // The language controls are radio groups of the same kind: named, two or three options, one
  // chosen and one tab stop each. The brand bar has the interface language switch too ("Limba"),
  // from 641 points up; on a phone it is in the menu.
  const groups = await page.evaluate(radioGroupsOf);
  const sizes = Object.fromEntries(groups.map((group) => [group.name, group.radios.length]));
  const wide = scenario.viewport.width > 640;
  // Compared as JSON: two objects are never equal by reference.
  expectEqual(
    'radio groups of Settings',
    JSON.stringify(sizes, Object.keys(sizes).sort()),
    JSON.stringify(
      {
        ...(wide ? { Limba: 2 } : null),
        'Fontul lecturii': 3,
        Tema: 4,
        'Limba lecturii': 2,
        'Limba interfeței': 3,
      },
      ['Fontul lecturii', 'Limba', 'Limba interfeței', 'Limba lecturii', 'Tema'],
    ),
  );
  for (const group of groups) {
    expectEqual(
      `chosen options of "${group.name}"`,
      group.radios.filter((radio) => radio.checked === 'true').length,
      1,
    );
    for (const radio of group.radios) {
      expectEqual(
        `tabindex of "${radio.label}" in "${group.name}"`,
        radio.tabindex,
        radio.checked === 'true' ? '0' : '-1',
      );
    }
  }
  const radios = await page.evaluate(radiosOf);
  if (radios.length < 4) problems.push(`found ${radios.length} theme radios, expected 4`);
  for (const radio of radios) {
    if (radio.checked !== 'true' && radio.checked !== 'false')
      problems.push(`radio "${radio.label}" has no aria-checked`);
    // A radio is checked, not selected: aria-selected is not allowed on that role.
    expectEqual(`radio "${radio.label}" aria-selected`, radio.selected, null);
    expectEqual(
      `radio "${radio.label}" tabindex`,
      radio.tabindex,
      radio.checked === 'true' ? '0' : '-1',
    );
  }
  expectEqual(
    'number of checked theme radios',
    radios.filter((r) => r.checked === 'true').length,
    1,
  );
  const chosen = radios.findIndex((radio) => radio.checked === 'true');
  if (chosen >= 0) {
    // ArrowRight moves to the next option and wraps from the last to the first.
    const next = (chosen + 1) % radios.length;
    await page.locator(THEME_RADIOS).nth(chosen).focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const moved = await page.evaluate(radiosOf);
    expectEqual(
      'radio chosen with ArrowRight',
      moved.findIndex((r) => r.checked === 'true'),
      next,
    );
    expectEqual(
      'radio focused after ArrowRight',
      moved.findIndex((r) => r.focused),
      next,
    );
    await page.keyboard.press(' ');
    expectEqual(
      'radio chosen after Space on the focused one',
      (await page.evaluate(radiosOf)).findIndex((r) => r.checked === 'true'),
      next,
    );
  } else problems.push('no theme radio is checked');

  // The same page in English, chosen the way a reader chooses it (the labels there are not
  // shorter than the Romanian ones). The page changes language at once, without a reload, so this
  // has to come last: the theme radios are found by their Romanian name above.
  await page
    .locator(
      '[role="radiogroup"][aria-label="Limba interfeței"] [role="radio"][aria-label="English"]',
    )
    .click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.waitForTimeout(250);
  expectEqual(
    'radio groups of Settings in English',
    JSON.stringify((await page.evaluate(radioGroupsOf)).map((group) => group.name).sort()),
    JSON.stringify(
      [
        ...(wide ? ['Language'] : []),
        'Reading font',
        'Theme',
        'Reading language',
        'Interface language',
      ].sort(),
    ),
  );
  expectEqual(
    'radio labels cut off on Settings in English',
    JSON.stringify(await page.evaluate(cutOffRadios)),
    '[]',
  );
  expectEqual('sideways overflow on Settings in English', await page.evaluate(overflowOf), 0);
  expectEqual('browser tab in English', await page.title(), 'Settings · Biblioteca');
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

    // A blank page that decodes screenshots (the pixel colours of the first-paint check).
    const reader = await browser.newPage();
    await reader.setContent('<!doctype html><meta charset="utf-8">');

    for (const scenario of SCENARIOS.filter(
      (item) => !args.only || item.name.includes(args.only),
    )) {
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

      // Before the app starts, the page already wears the colours of the active theme.
      for (const problem of await firstPaintProblems(
        context,
        reader,
        scenario,
        `${site.base}${routes.library}`,
      )) {
        failures.push(`${scenario.name}: first paint\n    ${problem}`);
      }

      let checked = 0;
      /** Waits for the screen, probes it and records what is wrong. */
      const check = async (screen, how, options) => {
        await waitForScreen(page, screen, args.timeout);
        // Park the pointer in the corner: a control that ends up under it (the link that was
        // pressed to get here was somewhere else on the page) would be caught half-way through
        // its hover animation, and the contrast of a label that is changing colour means nothing.
        await page.mouse.move(1, 1);
        await page.waitForTimeout(450);
        const problems = judge(
          await page.evaluate(probe, MIN_CONTRAST),
          scenario.expect,
          screen,
          options,
        );
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

      // What a screen draws once it is used: the results of a search, the tiles of the centuries, the
      // shelves unfolded, the sheet of a filter, the drawer of the section bar and, on a phone, the
      // menu. A colour that is only wrong here (a bare Text is black on the dark theme) is the bug
      // this script exists for, and the first look of a screen does not show it.
      const narrow = scenario.viewport.width <= 640;
      const states = [
        ['search', 'results of a search by name', '/search?q=vos', []],
        ['search', 'passages found', '/search?q=kingdom&mode=passages', []],
        ['library-all', 'century tiles', '/library/all?view=century', []],
        [
          'library-all',
          'shelves unfolded',
          '/library/all',
          ['[data-testid="shelves-fold-toggle"]'],
        ],
        ['library-all', 'sheet of a filter', '/library/all', ['[data-testid="filter-century"]']],
        [
          'landing',
          'drawer of the section bar',
          '/',
          ['[data-testid="section-item-read"]:visible'],
        ],
        ...(narrow ? [['landing', 'menu', '/', ['[data-testid="menu-button"]:visible']]] : []),
      ];
      for (const [screen, how, path, clicks] of states) {
        await page.goto(`${site.base}${path}`, { waitUntil: 'domcontentloaded' });
        await waitForScreen(page, screen, args.timeout);
        for (const selector of clicks) await page.locator(selector).first().click();
        await check(screen, how, { overlay: /sheet|menu/.test(how) });
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
      await openSettings(page);
      await check('settings', 'navigation');

      // Last, because it changes the theme with the keyboard.
      for (const problem of await semanticsProblems(page, scenario, site, routes)) {
        failures.push(`${scenario.name}: semantics\n    ${problem}`);
      }

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
