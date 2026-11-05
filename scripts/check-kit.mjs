#!/usr/bin/env node
// Playwright checks of the component kit, on the component gallery (apps/mobile/src/dev/
// component-gallery.tsx: every part of the kit on one page, built from the real components).
// Jest sees the style props of a component; this script looks at what a browser draws, which is
// where the bugs of the first review of the kit were (a focus ring cut by the container that
// holds it, three nested h1, a hero picture drawn at its own pixel size, a bar that was absent
// for the first frames under reduced motion).
//
//   node scripts/check-kit.mjs [--dist <dir>] [--skip-export] [--only <text>] [--verbose]
//                              [--port N] [--timeout ms]
//
// Without --skip-export the script exports the app with a temporary route in front of the gallery
// into --dist (default test-results/gallery-dist; scripts/lib/gallery-export.mjs), which takes
// about a minute. Checks (ids K1 to K10; the ids G7, G5, G6b, G12 point to docs/ui-spec-v2.md,
// section 20.3):
//   K1  focus (G7): every focus stop of the gallery has a 2 px ring, in accentStrong on the page
//       bands and mastheadInk on dark bands, 3:1 against what is behind it, and the ring is not
//       cut by any container that clips (the rounded corners of a panel included)
//   K2  tabs: arrow keys through every strip, wide and narrow, and back: the focused tab and its
//       ring are inside the strip (the strip scrolls the tab into view itself)
//   K3  layers (G8): Dialog and Sheet open with the focus on the whole ring of the close button,
//       Tab stays inside, Escape closes and gives the focus back, the page behind is inert; the
//       toast is a status that goes away
//   K4  hero: one h1 each and no heading inside it, the picture covers the hero, and over a pure
//       white picture the text reaches 4.5:1 (3:1 for the large highlighted line) against the
//       lightest 5 % of the pixels behind it (G5)
//   K5  pressed look: scale(.96) on web and no change of opacity, on every pressable of the kit
//   K6  reduced motion (G12): the hero bar is full from the first frame and nothing animates;
//       without it the bar sweeps
//   K7  touch targets: the disclosure summary is 36 high for a mouse on a wide screen and 44 for
//       a finger (G6b) and on a phone
//   K8  rows and bands: chips share one centre line, no muted text on a warm band, every text
//       leaf of the warm band is 4.5:1
//   K9  no horizontal page scroll (G1) at 320, 390 and 1366
//   K10 no console error or warning, no uncaught error
// Failures are printed as they are found (--verbose prints the passes too) and the page where one
// happened is saved to test-results/kit-<check>-<theme>-<size>.png. Exits 1 on any failure, 2 on
// an error of the script or the export.

/* global document, getComputedStyle, window, innerWidth, requestAnimationFrame, MutationObserver, Image -- evaluated inside the browser page */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { GALLERY_DIST, exportWithGallery } from './lib/gallery-export.mjs';
import { launchChromium, parseArgs, root, serveExport } from './lib/web-export.mjs';

// `--skip-export` and `--verbose` take no value, so they are taken out before parseArgs.
const argv = process.argv.slice(2);
const skipExport = argv.includes('--skip-export');
const verbose = argv.includes('--verbose');
const args = parseArgs(
  argv.filter((arg) => arg !== '--skip-export' && arg !== '--verbose'),
  'kit',
  { '--only': (value, parsed) => (parsed.only = value) },
);
const dist = argv.includes('--dist') ? args.dist : GALLERY_DIST;

const SETTINGS_KEY = 'biblioteca:settings:v1';
const SIZES = {
  desktop: { width: 1366, height: 900 },
  phone: { width: 390, height: 844 },
  small: { width: 320, height: 568 },
  tablet: { width: 1024, height: 768 },
};
const THEMES = ['light', 'sepia', 'dark'];

// --- the palettes: apps/mobile/src/theme/palettes.ts is the source of truth -----------------------

const toRgb = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

/** The six-digit colours of the three palettes as `rgb(r, g, b)` (eight-digit tokens are skipped). */
function readPalettes() {
  const source = readFileSync(join(root, 'apps/mobile/src/theme/palettes.ts'), 'utf8');
  const palettes = {};
  for (const name of THEMES) {
    const block = new RegExp(`\\b${name}:\\s*\\{([^}]*)\\}`).exec(source);
    if (!block) throw new Error(`palette "${name}" not found in palettes.ts`);
    palettes[name] = {};
    for (const [, token, hex] of block[1].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) {
      palettes[name][token] = toRgb(hex);
    }
  }
  return palettes;
}
const palettes = readPalettes();

// --- results -------------------------------------------------------------------------------------

const results = [];
const consoleProblems = [];

/** Records one check: `ok` is a boolean, `detail` says what was measured. */
function record(id, ok, name, detail = '') {
  results.push({ id, ok, name, detail });
  if (!ok || verbose)
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${id} ${name}${detail ? ` - ${detail}` : ''}`);
}

// --- evaluated inside the page -------------------------------------------------------------------

/**
 * The focus ring of the active element against every ancestor that clips. `centre` scrolls the
 * gallery so that the element is in the middle of the window first: where the browser puts an
 * element that it scrolled into view (flush with the edge) is not what is being judged.
 */
function ringOfActive({ centre, ink, strong, background, mark = false }) {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  // Tab goes round: an element that was seen already means that the round is complete.
  const repeat = mark && el.hasAttribute('data-kit-seen');
  if (mark) el.setAttribute('data-kit-seen', '');
  const gallery = document.querySelector('[data-testid="gallery"]');
  if (centre && gallery && gallery.contains(el)) {
    gallery.scrollTop += el.getBoundingClientRect().top - gallery.clientHeight / 2;
  }
  const style = getComputedStyle(el);
  const width = parseFloat(style.outlineWidth) || 0;
  const offset = parseFloat(style.outlineOffset) || 0;
  const grow = width + offset;
  const box = el.getBoundingClientRect();
  const ring = { l: box.left - grow, t: box.top - grow, r: box.right + grow, b: box.bottom + grow };

  const inRounded = (px, py, rect, radii) => {
    const [tl, tr, br, bl] = radii;
    const corners = [
      { x: rect.l + tl, y: rect.t + tl, rad: tl, hit: px < rect.l + tl && py < rect.t + tl },
      { x: rect.r - tr, y: rect.t + tr, rad: tr, hit: px > rect.r - tr && py < rect.t + tr },
      { x: rect.r - br, y: rect.b - br, rad: br, hit: px > rect.r - br && py > rect.b - br },
      { x: rect.l + bl, y: rect.b - bl, rad: bl, hit: px < rect.l + bl && py > rect.b - bl },
    ];
    return corners.every((c) => !c.hit || Math.hypot(px - c.x, py - c.y) <= c.rad);
  };
  const clips = [];
  for (let node = el.parentElement; node; node = node.parentElement) {
    const s = getComputedStyle(node);
    const clipX = s.overflowX !== 'visible';
    const clipY = s.overflowY !== 'visible';
    if (!clipX && !clipY) continue;
    const b = node.getBoundingClientRect();
    const inner = {
      l: b.left + node.clientLeft,
      t: b.top + node.clientTop,
      r: b.left + node.clientLeft + node.clientWidth,
      b: b.top + node.clientTop + node.clientHeight,
    };
    const cut = [];
    if (clipX && ring.l < inner.l - 0.5) cut.push('left');
    if (clipX && ring.r > inner.r + 0.5) cut.push('right');
    if (clipY && ring.t < inner.t - 0.5) cut.push('top');
    if (clipY && ring.b > inner.b + 0.5) cut.push('bottom');
    const radii = [
      s.borderTopLeftRadius,
      s.borderTopRightRadius,
      s.borderBottomRightRadius,
      s.borderBottomLeftRadius,
    ].map((v) => parseFloat(v) || 0);
    if (cut.length === 0 && radii.some((v) => v > 0)) {
      const points = [
        [ring.l, ring.t],
        [ring.r, ring.t],
        [ring.r, ring.b],
        [ring.l, ring.b],
      ];
      if (points.some(([x, y]) => !inRounded(x, y, inner, radii))) cut.push('corner');
    }
    if (cut.length > 0) {
      const name = node.getAttribute('data-testid') || node.tagName.toLowerCase();
      clips.push(`${name} cuts the ring (${cut.join(', ')})`);
    }
  }

  // The colour the ring should have: the ink on a dark band, accentStrong elsewhere.
  const dark = el.closest('[data-band="masthead"]');
  const expected = dark ? ink : strong;

  // The contrast of the ring with what is behind it (over a picture the hero check G5 judges).
  const parse = (value) => {
    const m = /^rgba?\((.+)\)$/.exec(value.trim());
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  let behind = parse(background);
  for (let node = el.parentElement; node; node = node.parentElement) {
    const colour = parse(getComputedStyle(node).backgroundColor);
    if (colour && colour.a === 1) {
      behind = colour;
      break;
    }
  }
  const photo = dark && (parse(getComputedStyle(dark).backgroundColor)?.a ?? 1) === 0;
  const ringColour = parse(style.outlineColor);
  let contrast = null;
  if (ringColour && behind && !photo) {
    const [hi, lo] = [lum(ringColour), lum(behind)].sort((x, y) => y - x);
    contrast = (hi + 0.05) / (lo + 0.05);
  }
  return {
    name:
      el.getAttribute('data-testid') ||
      el.getAttribute('aria-label') ||
      (el.textContent || '').trim().slice(0, 24) ||
      el.tagName.toLowerCase(),
    outline: `${style.outlineWidth} ${style.outlineStyle} offset ${style.outlineOffset}`,
    solid: width === 2 && style.outlineStyle === 'solid' && offset === 2,
    colour: style.outlineColor,
    expected,
    contrast,
    clips,
    repeat,
  };
}

const luminance = ([r, g, b]) => {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};
const rgbOf = (value) =>
  value
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number);

// --- the browser ----------------------------------------------------------------------------------

/** Opens the gallery in a fresh context; `finish` saves the page when a check failed, and closes it. */
async function open(browser, base, theme, size, extra = {}, tag = 'page') {
  const viewport = typeof size === 'string' ? SIZES[size] : size;
  const context = await browser.newContext({
    locale: 'ro-RO',
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    viewport,
    deviceScaleFactor: 1,
    ...extra,
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
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      const text = message.text();
      // Chromium's own advice about canvas readbacks (the picture sampling of K4).
      if (!text.includes('willReadFrequently')) consoleProblems.push(`${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
  await page.goto(`${base}/gallery`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="gallery"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900); // the hero sweep (250 ms delay, 550 ms) has finished
  const failedBefore = results.filter((r) => !r.ok).length;
  return {
    page,
    async finish() {
      if (results.filter((r) => !r.ok).length > failedBefore) {
        mkdirSync(join(root, 'test-results'), { recursive: true });
        const file = join(root, 'test-results', `kit-${tag}-${theme}-${size}.png`);
        await page.screenshot({ path: file }).catch(() => {});
        console.log(`     (page saved: ${file})`);
      }
      await context.close();
    },
  };
}

const colours = (theme) => ({
  ink: palettes[theme].mastheadInk,
  strong: palettes[theme].accentStrong,
  background: palettes[theme].background,
});

async function ring(page, theme, centre = true, mark = false) {
  return page.evaluate(ringOfActive, { centre, mark, ...colours(theme) });
}

function judgeRing(id, label, found, { contrast = true } = {}) {
  if (!found) {
    record(id, false, label, 'nothing has the focus');
    return;
  }
  const problems = [];
  if (!found.solid) problems.push(`ring is ${found.outline}`);
  if (found.colour !== found.expected)
    problems.push(`colour ${found.colour}, want ${found.expected}`);
  if (contrast && found.contrast !== null && found.contrast < 3) {
    problems.push(`contrast ${found.contrast.toFixed(2)}:1`);
  }
  problems.push(...found.clips);
  record(id, problems.length === 0, `${label}: ${found.name}`, problems.join('; '));
}

// --- the checks ------------------------------------------------------------------------------------

/** K1: every focus stop of the gallery, in the order of the Tab key, until it goes round. */
async function checkFocus(browser, base) {
  for (const [theme, size] of [
    ['light', 'desktop'],
    ['sepia', 'desktop'],
    ['dark', 'phone'],
  ]) {
    const { page, finish } = await open(browser, base, theme, size, {}, 'focus');
    await page.evaluate(() => document.activeElement?.blur?.());
    let stops = 0;
    for (let i = 0; i < 120; i += 1) {
      await page.keyboard.press('Tab');
      const found = await ring(page, theme, true, true);
      if (!found || found.repeat) break;
      stops += 1;
      judgeRing('K1', `${theme} ${size} stop ${stops}`, found);
    }
    record(
      'K1',
      stops >= 25,
      `${theme} ${size}: the gallery has its focus stops`,
      `${stops} stops`,
    );
    await finish();
  }
}

/** K2: arrow keys through every tab strip, forward and back, with and without reduced motion. */
async function checkTabs(browser, base) {
  for (const [theme, size, reduced] of [
    ['light', 'desktop', true],
    ['dark', 'phone', true],
    ['light', 'phone', false],
    ['sepia', 'small', true],
  ]) {
    // A smooth scroll takes a few hundred milliseconds; an instant one does not.
    const settle = reduced ? 120 : 800;
    const { page, finish } = await open(
      browser,
      base,
      theme,
      size,
      { reducedMotion: reduced ? 'reduce' : 'no-preference' },
      'tabs',
    );
    for (const id of ['g-tabs-16', 'g-tabs-14', 'g-tabs-narrow']) {
      const tabs = page.locator(`[data-testid="${id}"] [role=tab]`);
      const count = await tabs.count();
      await tabs.first().focus();
      await page.waitForTimeout(settle);
      for (let step = 0; step < count * 2 - 1; step += 1) {
        const found = await ring(page, theme);
        judgeRing(
          'K2',
          `${id} ${theme} ${size}${reduced ? '' : ' (animated)'} step ${step}`,
          found,
        );
        await page.keyboard.press(step < count - 1 ? 'ArrowRight' : 'ArrowLeft');
        await page.waitForTimeout(settle);
      }
    }
    await finish();
  }
}

/** K3: Dialog, Sheet and Toast. */
async function checkLayers(browser, base) {
  for (const [theme, size] of [
    ['light', 'desktop'],
    ['dark', 'phone'],
    ['sepia', 'desktop'],
  ]) {
    const { page, finish } = await open(browser, base, theme, size, {}, 'layers');
    for (const [name, openId, panel] of [
      ['dialog', 'g-open-dialog', 'g-dialog-panel'],
      ['sheet', 'g-open-sheet', 'g-sheet-panel'],
    ]) {
      const opener = page.locator(`[data-testid="${openId}"]`);
      await opener.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      const where = `${name} ${theme} ${size}`;
      judgeRing(
        'K3',
        `${where}: the close button has the focus, ring whole`,
        await ring(page, theme, false),
      );
      // The focus stays inside the layer while Tab goes round.
      let inside = true;
      for (let i = 0; i < 4; i += 1) {
        await page.keyboard.press('Tab');
        inside &&= await page.evaluate(
          (id) => !!document.activeElement?.closest(`[data-testid="${id}"]`),
          panel,
        );
      }
      record('K3', inside, `${where}: Tab stays inside the layer`);
      const inert = await page.evaluate(() =>
        document.getElementById('root')?.hasAttribute('inert'),
      );
      record('K3', inert === true, `${where}: the page behind is inert`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      const closed = (await page.locator(`[data-testid="${panel}"]`).count()) === 0;
      const back = await page.evaluate(
        (id) => document.activeElement?.getAttribute('data-testid') === id,
        openId,
      );
      record(
        'K3',
        closed && back,
        `${where}: Escape closes it and the focus goes back to the opener`,
      );
      // The scrim closes it too.
      await opener.click();
      await page.waitForTimeout(500);
      await page.mouse.click(5, 5);
      await page.waitForTimeout(600);
      record(
        'K3',
        (await page.locator(`[data-testid="${panel}"]`).count()) === 0,
        `${where}: a click on the scrim closes it`,
      );
    }
    // The toast is a status line (an empty live region is always in the page, so that a screen
    // reader sees the text arrive) whose message goes away after about three seconds.
    await page.locator('[data-testid="g-toast"]').click();
    const toast = page.getByRole('status');
    await page.locator('[data-testid="toast-message"]').waitFor({ timeout: 2000 });
    record(
      'K3',
      ((await toast.textContent()) ?? '').includes('Link copiat.'),
      `toast ${theme} ${size}: a status that says "Link copiat."`,
    );
    await page.waitForTimeout(3600);
    record(
      'K3',
      (await page.locator('[data-testid="toast-message"]').count()) === 0 &&
        ((await toast.textContent()) ?? '').trim() === '',
      `toast ${theme} ${size}: the message is gone after 3 s`,
    );
    await finish();
  }
}

/** K4: the heroes of the gallery. */
async function checkHero(browser, base) {
  for (const [theme, size] of [
    ['light', 'desktop'],
    ['dark', 'desktop'],
    ['sepia', 'phone'],
    ['dark', 'phone'],
    ['light', 'small'],
  ]) {
    const { page, finish } = await open(browser, base, theme, size, {}, 'hero');
    const where = `${theme} ${size}`;
    const headings = await page.evaluate(() =>
      ['g-hero-flat', 'g-hero-photo'].map((id) => {
        const hero = document.querySelector(`[data-testid="${id}"]`);
        const h1 = [...hero.querySelectorAll('h1')];
        const nested = h1.reduce(
          (n, h) => n + h.querySelectorAll('h1, h2, h3, [role=heading]').length,
          0,
        );
        return { id, h1: h1.length, nested };
      }),
    );
    for (const { id, h1, nested } of headings) {
      record(
        'K4',
        h1 === 1 && nested === 0,
        `${where}: ${id} has one h1 and no heading inside it`,
        `${h1} h1, ${nested} inside`,
      );
    }

    // What is measured before the text is hidden: the picture layer, and each text box.
    const measured = await page.evaluate(() => {
      const hero = document.querySelector('[data-testid="g-hero-photo"]');
      const layer = hero.querySelector('img')?.parentElement;
      const h = hero.getBoundingClientRect();
      const l = layer?.getBoundingClientRect();
      const boxes = [...hero.querySelectorAll('div, span')]
        .filter((e) => e.children.length === 0 && (e.textContent || '').trim())
        .filter((e) => {
          // A label on a button's own fill is judged by G4, not by the picture behind the hero.
          const button = e.closest('[role=button]');
          return !button || getComputedStyle(button).backgroundColor === 'rgba(0, 0, 0, 0)';
        })
        .map((e) => {
          const r = e.getBoundingClientRect();
          const style = getComputedStyle(e);
          return {
            text: e.textContent.trim().slice(0, 26),
            color: style.color,
            x: r.left,
            y: r.top,
            w: r.width,
            h: r.height,
            large: parseFloat(style.fontSize) >= 24,
          };
        })
        .filter((b) => b.w > 2 && b.h > 2);
      return {
        top: h.top,
        hero: [h.left, h.top, h.width, h.height].map(Math.round),
        layer: l ? [l.left, l.top, l.width, l.height].map(Math.round) : null,
        boxes,
      };
    });
    record(
      'K4',
      !!measured.layer && measured.hero.every((v, i) => Math.abs(v - measured.layer[i]) <= 1),
      `${where}: the picture covers the hero`,
      `hero ${measured.hero.join(' ')}, picture ${measured.layer?.join(' ') ?? 'none'}`,
    );

    // G5: the lightest 5 % of the pixels behind each text box, over a pure white picture.
    await page.addStyleTag({
      content:
        '[data-testid="g-hero-photo"] * { color: transparent !important; text-decoration-color: transparent !important; border-color: transparent !important; } [data-testid="g-hero-photo"] svg { visibility: hidden }',
    });
    await page.evaluate(() =>
      document.querySelector('[data-testid="g-hero-photo"]').scrollIntoView({ block: 'start' }),
    );
    await page.waitForTimeout(200);
    const frame = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="g-hero-photo"]').getBoundingClientRect();
      return { y: r.top, h: r.height };
    });
    const viewport = page.viewportSize();
    const origin = Math.max(0, frame.y);
    const shot = await page.screenshot({
      clip: {
        x: 0,
        y: origin,
        width: viewport.width,
        height: Math.min(frame.h, viewport.height - origin),
      },
    });
    const p95 = await page.evaluate(
      async ({ b64, list, shift, from }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${b64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const g = canvas.getContext('2d', { willReadFrequently: true });
        g.drawImage(image, 0, 0);
        const f = (v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return list.map((b) => {
          const x0 = Math.max(0, Math.floor(b.x));
          const x1 = Math.min(image.width, Math.ceil(b.x + b.w));
          const y0 = Math.max(0, Math.floor(b.y + shift - from));
          const y1 = Math.min(image.height, Math.ceil(b.y + shift - from + b.h));
          if (x1 <= x0 || y1 <= y0) return null;
          const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
          const lights = [];
          for (let i = 0; i < d.length; i += 4) {
            lights.push(0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]));
          }
          lights.sort((a, c) => a - c);
          return lights[Math.min(lights.length - 1, Math.floor(lights.length * 0.95))];
        });
      },
      {
        b64: shot.toString('base64'),
        list: measured.boxes,
        shift: frame.y - measured.top,
        from: origin,
      },
    );
    measured.boxes.forEach((box, i) => {
      if (p95[i] === null) return;
      const value = ratio(luminance(rgbOf(box.color)), p95[i]);
      const need = box.large ? 3 : 4.5;
      record(
        'K4',
        value >= need,
        `${where}: G5 over a white picture, "${box.text}"`,
        `${value.toFixed(2)}:1, needs ${need}`,
      );
    });
    await finish();
  }
}

/** K5: the pressed look of every pressable of the kit. */
async function checkPressed(browser, base) {
  const { page, finish } = await open(browser, base, 'light', 'desktop', {}, 'pressed');
  const targets = {
    'button (primary)': '[data-testid="g-primary"]',
    'button (outline)': '[data-testid="g-outline"]',
    'chip (filter)': '[data-testid="g-chip-filter"]',
    tab: '[data-testid="g-tab-about"]',
    disclosure: '[data-testid="g-disclosure"] [role=button]',
    'icon button': '[data-testid="g-icon-button"]',
    'segmented option': '[role=radio] >> nth=1',
  };
  const pressed = async (locator) => {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(350);
    const style = await locator.evaluate((e) => {
      const s = getComputedStyle(e);
      return { transform: s.transform, opacity: s.opacity };
    });
    await page.mouse.up();
    return style;
  };
  const judge = (name, style) =>
    record(
      'K5',
      style.transform.startsWith('matrix(0.96,') && style.opacity === '1',
      `pressed ${name} is scale(.96) with its opacity kept`,
      `${style.transform}, opacity ${style.opacity}`,
    );
  for (const [name, selector] of Object.entries(targets)) {
    judge(name, await pressed(page.locator(selector).first()));
  }
  await page.locator('[data-testid="g-open-dialog"]').click();
  await page.waitForTimeout(500);
  judge('close button', await pressed(page.locator('[data-testid="g-dialog-close"]')));
  await finish();
}

/** K6: reduced motion and the sweep. */
async function checkMotion(browser, base) {
  const reduced = await open(
    browser,
    base,
    'light',
    'desktop',
    { reducedMotion: 'reduce' },
    'motion',
  );
  // The bar must be full from the very first frame, so this one is watched from the document's start.
  const watched = await browser.newContext({
    locale: 'ro-RO',
    viewport: SIZES.desktop,
    reducedMotion: 'reduce',
  });
  await watched.addInitScript(() => {
    window.__bar = [];
    const t0 = performance.now();
    const read = () => {
      for (const el of document.querySelectorAll('[data-testid="hero-highlight"]')) {
        window.__bar.push(getComputedStyle(el).transform);
      }
    };
    new MutationObserver(read).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    const loop = () => {
      read();
      if (performance.now() - t0 < 2000) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const page = await watched.newPage();
  page.setDefaultTimeout(args.timeout);
  await page.goto(`${base}/gallery`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="gallery"]').waitFor();
  await page.waitForTimeout(2200);
  const samples = await page.evaluate(() => window.__bar);
  const notFull = samples.filter((t) => t !== 'none' && !t.startsWith('matrix(1,'));
  record(
    'K6',
    samples.length > 0 && notFull.length === 0,
    'reduced motion: the bar is full from its first frame',
    `${samples.length} samples, ${notFull.length} not full`,
  );
  await watched.close();
  const running = await reduced.page.evaluate(() => document.getAnimations().length);
  record('K6', running === 0, 'reduced motion: nothing animates', `${running} running animations`);
  await reduced.finish();

  const fresh = await browser.newContext({ locale: 'ro-RO', viewport: SIZES.desktop });
  const moving = await fresh.newPage();
  moving.setDefaultTimeout(args.timeout);
  await moving.goto(`${base}/gallery`, { waitUntil: 'domcontentloaded' });
  await moving.locator('[data-testid="gallery"]').waitFor();
  const seen = [];
  for (let i = 0; i < 8; i += 1) {
    seen.push(
      await moving.evaluate(
        () => getComputedStyle(document.querySelector('[data-testid="hero-highlight"]')).transform,
      ),
    );
    await moving.waitForTimeout(150);
  }
  record(
    'K6',
    seen.some((t) => /^matrix\(0[,.]/.test(t)) && seen.at(-1).startsWith('matrix(1,'),
    'without reduced motion the bar sweeps in from nothing and ends full',
    seen.map((t) => t.slice(7, 12)).join(' '),
  );
  await fresh.close();
}

/** K7: the height of the disclosure summary follows the pointer. */
async function checkTargets(browser, base) {
  for (const [label, size, extra, want] of [
    ['a mouse on a wide screen', 'tablet', {}, 36],
    ['a finger on a wide screen', 'tablet', { hasTouch: true }, 44],
    ['a mouse on a phone', 'phone', {}, 44],
  ]) {
    const { page, finish } = await open(browser, base, 'light', size, extra, 'targets');
    const height = await page.evaluate(() =>
      Math.round(
        document.querySelector('[data-testid="g-disclosure"] [role=button]').getBoundingClientRect()
          .height,
      ),
    );
    record('K7', height === want, `disclosure summary for ${label} is ${want} high`, `${height}`);
    await finish();
  }
}

/** K8: rows and bands. */
async function checkRows(browser, base) {
  for (const theme of THEMES) {
    const { page, finish } = await open(browser, base, theme, 'desktop', {}, 'rows');
    const centres = await page.evaluate(() =>
      [...document.querySelector('[data-testid="g-chips"]').children].map((c) => {
        const r = c.getBoundingClientRect();
        return +(r.top + r.height / 2).toFixed(1);
      }),
    );
    record(
      'K8',
      Math.max(...centres) - Math.min(...centres) <= 1.5,
      `${theme}: the chips and the button of a row share one centre line`,
      centres.join(' '),
    );
    const leaves = await page.evaluate(() => {
      const band = document.querySelector('[data-testid="g-band-warm"]');
      const background = getComputedStyle(band).backgroundColor;
      return [...band.querySelectorAll('div')]
        .filter((e) => e.children.length === 0 && e.textContent.trim())
        .map((e) => ({
          text: e.textContent.trim().slice(0, 22),
          color: getComputedStyle(e).color,
          background,
        }));
    });
    for (const leaf of leaves) {
      const value = ratio(luminance(rgbOf(leaf.color)), luminance(rgbOf(leaf.background)));
      record(
        'K8',
        value >= 4.5,
        `${theme}: "${leaf.text}" on the warm band`,
        `${value.toFixed(2)}:1`,
      );
    }
    const muted = leaves.filter((l) => l.color === palettes[theme].textMuted);
    record('K8', muted.length === 0, `${theme}: no textMuted on the warm band (rule 2 of 2.1)`);
    await finish();
  }
}

/** K9: no horizontal page scroll. */
async function checkOverflow(browser, base) {
  for (const size of ['small', 'phone', 'desktop']) {
    const { page, finish } = await open(browser, base, 'light', size, {}, 'overflow');
    const over = await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    );
    const inner = await page.evaluate(() => {
      const g = document.querySelector('[data-testid="gallery"]');
      return g.scrollWidth - g.clientWidth;
    });
    record(
      'K9',
      over <= 0 && inner <= 0,
      `${size}: the page does not scroll sideways`,
      `page ${over}, gallery ${inner}`,
    );
    await finish();
  }
}

// --- main -----------------------------------------------------------------------------------------

const CHECKS = [
  ['focus', checkFocus],
  ['tabs', checkTabs],
  ['layers', checkLayers],
  ['hero', checkHero],
  ['pressed', checkPressed],
  ['motion', checkMotion],
  ['targets', checkTargets],
  ['rows', checkRows],
  ['overflow', checkOverflow],
];

async function main() {
  let site;
  let browser;
  try {
    if (!skipExport) exportWithGallery(dist);
    site = await serveExport({ dist, basePath: args.basePath, port: args.port });
    browser = await launchChromium('kit');
    for (const [name, run] of CHECKS) {
      if (args.only && !name.includes(args.only)) continue;
      const before = results.length;
      const failedBefore = results.filter((r) => !r.ok).length;
      await run(browser, site.base);
      const failed = results.filter((r) => !r.ok).length - failedBefore;
      console.log(`# ${name}: ${results.length - before} checks, ${failed} failed`);
    }
    record(
      'K10',
      consoleProblems.length === 0,
      'no console error or warning, no uncaught error',
      consoleProblems.slice(0, 3).join(' | '),
    );
    const failed = results.filter((r) => !r.ok);
    console.log(`\nkit: ${results.length - failed.length} of ${results.length} checks passed`);
    return failed.length === 0 ? 0 : 1;
  } catch (error) {
    console.error(
      `kit: FAILED: ${error instanceof Error ? (error.stack ?? error.message) : error}`,
    );
    return 2;
  } finally {
    await browser?.close().catch(() => {});
    await site?.close();
  }
}

process.exit(await main());
