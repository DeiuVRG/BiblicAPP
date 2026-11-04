#!/usr/bin/env node
// Draws the app icons: an IM Fell Great Primer "B" (the display face of the app, the one of the
// brand wordmark) with a short accent rule under it, in the paper and ink of the palettes
// (apps/mobile/src/theme/palettes.ts is the source of the colours; the font is the one the app
// shows its titles in, from @expo-google-fonts/im-fell-great-primer). Replaces the Expo template
// artwork and can be run again whenever the palettes or the mark change:
//
//   node scripts/generate-icons.mjs [--out apps/mobile/assets/images]
//
// Writes icon.png, favicon.png, splash-icon.png (+ splash-icon-dark.png) and the three Android
// adaptive icon layers. The files are drawn on a canvas in headless Chromium, so no image library
// is needed; they are committed, and the build never runs this script.

/* global document, FontFace -- `draw` is evaluated inside the browser page */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { launchChromium, root } from './lib/web-export.mjs';

const outIndex = process.argv.indexOf('--out');
const out = resolve(
  outIndex > 0 ? (process.argv[outIndex + 1] ?? '') : 'apps/mobile/assets/images',
);

// --- colours from the palettes -------------------------------------------------------------------

const palettesSource = readFileSync(join(root, 'apps/mobile/src/theme/palettes.ts'), 'utf8');

/** `#RRGGBB` of a token of a palette, read from palettes.ts. */
function colour(palette, token) {
  const block = new RegExp(`\\b${palette}:\\s*\\{([^}]*)\\}`).exec(palettesSource);
  const hex = block && new RegExp(`\\b${token}:\\s*'(#[0-9A-Fa-f]{6})'`).exec(block[1]);
  if (!hex) throw new Error(`${palette}.${token} not found in palettes.ts`);
  return hex[1];
}

const paper = colour('light', 'background');
const ink = colour('dark', 'background');
// `accent` is the brand colour for fills and graphics: the rule under the letter.
const terracotta = colour('light', 'accent');
const peach = colour('dark', 'accent');

// --- what is drawn -------------------------------------------------------------------------------

// Sizes are fractions of the canvas. `cap` is the cap height of the "B"; the group (letter, gap,
// rule) is centred as a whole. The Android layers keep the group inside the central 66 % that the
// launcher mask never cuts.
const MARK = { cap: 0.5, gap: 0.062, ruleWidth: 0.2, ruleHeight: 0.026 };
const SAFE_MARK = { cap: 0.3, gap: 0.04, ruleWidth: 0.13, ruleHeight: 0.017 };

const ASSETS = [
  // iOS and the stores: a full-bleed square, the system rounds the corners.
  { file: 'icon.png', size: 1024, background: ink, glyph: paper, rule: peach, ...MARK },
  // Android adaptive icon: ink background layer, the mark on a transparent layer, and the
  // one-colour version the system tints for themed icons.
  { file: 'android-icon-background.png', size: 1024, background: ink },
  { file: 'android-icon-foreground.png', size: 1024, glyph: paper, rule: peach, ...SAFE_MARK },
  {
    file: 'android-icon-monochrome.png',
    size: 1024,
    glyph: '#000000',
    rule: '#000000',
    ...SAFE_MARK,
  },
  // Browser tab: a small rounded tile; no rule (it would be a smudge at 16 px).
  {
    file: 'favicon.png',
    size: 48,
    drawSize: 192,
    background: ink,
    radius: 0.2,
    glyph: paper,
    cap: 0.54,
  },
  // Native splash, on the paper and on the ink background of the app.
  { file: 'splash-icon.png', size: 384, glyph: ink, rule: terracotta, ...MARK },
  { file: 'splash-icon-dark.png', size: 384, glyph: paper, rule: peach, ...MARK },
];

/**
 * Runs in the page (it must be self-contained): draws one asset on a canvas and returns it as a
 * PNG data URL. Takes `[spec, fontBase64]` because the page call passes a single argument.
 */
async function draw([spec, fontBase64]) {
  const face = new FontFace('IMFellGreatPrimer', `url(data:font/ttf;base64,${fontBase64})`, {
    weight: '400',
  });
  await face.load();
  document.fonts.add(face);

  const size = spec.drawSize ?? spec.size;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (spec.background) {
    ctx.fillStyle = spec.background;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, (spec.radius ?? 0) * size);
    ctx.fill();
  }

  if (spec.glyph) {
    // Scale the font so that the cap height is exactly `cap` of the canvas.
    ctx.font = '400 100px IMFellGreatPrimer';
    const unit = ctx.measureText('B').actualBoundingBoxAscent / 100;
    ctx.font = `400 ${(spec.cap * size) / unit}px IMFellGreatPrimer`;
    const box = ctx.measureText('B');
    const glyphHeight = box.actualBoundingBoxAscent + box.actualBoundingBoxDescent;
    const glyphWidth = box.actualBoundingBoxRight - box.actualBoundingBoxLeft;
    const ruleHeight = spec.rule ? spec.ruleHeight * size : 0;
    const gap = spec.rule ? spec.gap * size : 0;
    const top = (size - (glyphHeight + gap + ruleHeight)) / 2;

    ctx.fillStyle = spec.glyph;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('B', (size - glyphWidth) / 2, top + box.actualBoundingBoxAscent);

    if (spec.rule) {
      const width = spec.ruleWidth * size;
      ctx.fillStyle = spec.rule;
      ctx.beginPath();
      ctx.roundRect((size - width) / 2, top + glyphHeight + gap, width, ruleHeight, ruleHeight / 2);
      ctx.fill();
    }
  }

  if (size === spec.size) return canvas.toDataURL('image/png');
  // Drawn larger and scaled down: smoother edges than drawing at the final size.
  const small = document.createElement('canvas');
  small.width = spec.size;
  small.height = spec.size;
  const smallCtx = small.getContext('2d');
  smallCtx.imageSmoothingQuality = 'high';
  smallCtx.drawImage(canvas, 0, 0, spec.size, spec.size);
  return small.toDataURL('image/png');
}

async function main() {
  const fontFile = join(
    root,
    'node_modules/@expo-google-fonts/im-fell-great-primer/400Regular/IMFellGreatPrimer_400Regular.ttf',
  );
  const fontBase64 = readFileSync(fontFile).toString('base64');
  mkdirSync(out, { recursive: true });

  const browser = await launchChromium('icons');
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    for (const spec of ASSETS) {
      const url = await page.evaluate(draw, [spec, fontBase64]);
      const bytes = Buffer.from(url.replace(/^data:image\/png;base64,/, ''), 'base64');
      writeFileSync(join(out, spec.file), bytes);
      console.log(`icons: ${spec.file} ${spec.size}x${spec.size} (${bytes.length} bytes)`);
    }
    return 0;
  } finally {
    await browser.close();
  }
}

process.exit(await main());
