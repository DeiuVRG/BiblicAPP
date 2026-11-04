import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import { palettes } from '@/theme/palettes';

const IMAGES = join(__dirname, '../../assets/images');

interface Png {
  width: number;
  height: number;
  rgba: Uint8Array;
}

/** Decodes an 8-bit RGBA, non-interlaced PNG: what `scripts/generate-icons.mjs` writes. */
function readPng(file: string): Png {
  const bytes = readFileSync(join(IMAGES, file));
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  let width = 0;
  let height = 0;
  let format = '';
  const compressed: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('latin1');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      format = `${data[8]}-bit, colour type ${data[9]}, interlace ${data[12]}`;
    }
    if (type === 'IDAT') compressed.push(data);
    offset += 12 + length;
  }
  expect(format).toBe('8-bit, colour type 6, interlace 0'); // RGBA, one pass

  const raw = inflateSync(Buffer.concat(compressed));
  const stride = width * 4;
  const rgba = new Uint8Array(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? rgba[y * stride + x - 4]! : 0;
      const up = y > 0 ? rgba[(y - 1) * stride + x]! : 0;
      const upLeft = y > 0 && x >= 4 ? rgba[(y - 1) * stride + x - 4]! : 0;
      let value = raw[y * (stride + 1) + 1 + x]!;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const [a, b, c] = [left, up, upLeft].map((v) => Math.abs(estimate - v)) as [
          number,
          number,
          number,
        ];
        value += a <= b && a <= c ? left : b <= c ? up : upLeft;
      }
      rgba[y * stride + x] = value & 255;
    }
  }
  return { width, height, rgba };
}

const pixelAt = (png: Png, x: number, y: number) => {
  const i = (y * png.width + x) * 4;
  const [r, g, b, a] = [png.rgba[i]!, png.rgba[i + 1]!, png.rgba[i + 2]!, png.rgba[i + 3]!];
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  return { r, g, b, a, hex };
};

/** Opaque pixels of exactly this colour, as a share of all pixels. */
const share = (png: Png, hex: string) => {
  const [r, g, b] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  let hits = 0;
  for (let i = 0; i < png.rgba.length; i += 4) {
    if (
      png.rgba[i] === r &&
      png.rgba[i + 1] === g &&
      png.rgba[i + 2] === b &&
      png.rgba[i + 3] === 255
    )
      hits += 1;
  }
  return hits / (png.width * png.height);
};

const { light, dark } = palettes;

describe('app icons (scripts/generate-icons.mjs)', () => {
  it.each([
    ['icon.png', 1024],
    ['android-icon-background.png', 1024],
    ['android-icon-foreground.png', 1024],
    ['android-icon-monochrome.png', 1024],
    ['favicon.png', 48],
    ['splash-icon.png', 384],
    ['splash-icon-dark.png', 384],
  ])('%s is a %i px square', (file, size) => {
    const png = readPng(file);
    expect([png.width, png.height]).toEqual([size, size]);
  });

  it('draws the app icon as paper-coloured letter on a full-bleed ink square', () => {
    const icon = readPng('icon.png');
    expect(pixelAt(icon, 3, 3)).toMatchObject({ hex: dark.background.toUpperCase(), a: 255 });
    expect(pixelAt(icon, 1020, 1020)).toMatchObject({ hex: dark.background.toUpperCase(), a: 255 });
    expect(share(icon, light.background)).toBeGreaterThan(0.04); // the letter
    expect(share(icon, dark.accent)).toBeGreaterThan(0.001); // the rule under it
  });

  it('puts the adaptive icon on ink, with the mark on its own transparent layer', () => {
    const background = readPng('android-icon-background.png');
    expect(share(background, dark.background)).toBe(1);
    const foreground = readPng('android-icon-foreground.png');
    expect(pixelAt(foreground, 0, 0).a).toBe(0);
    expect(share(foreground, light.background)).toBeGreaterThan(0.01);
    // Kept inside the part of the layer the launcher mask never cuts (the central 66 %).
    const margin = Math.round(foreground.width * 0.17);
    for (const [x, y] of [
      [margin, margin],
      [foreground.width - margin, margin],
      [margin, foreground.height - margin],
      [foreground.width - margin, foreground.height - margin],
    ] as const) {
      expect(pixelAt(foreground, x, y).a).toBe(0);
    }
  });

  it('draws the themed (monochrome) icon as one opaque colour on transparency', () => {
    const mono = readPng('android-icon-monochrome.png');
    expect(pixelAt(mono, 0, 0).a).toBe(0);
    expect(share(mono, '#000000')).toBeGreaterThan(0.01);
  });

  it('draws the favicon as a small ink tile with rounded corners', () => {
    const favicon = readPng('favicon.png');
    expect(pixelAt(favicon, 0, 0).a).toBe(0); // outside the rounded corner
    expect(pixelAt(favicon, 24, 1)).toMatchObject({ hex: dark.background.toUpperCase(), a: 255 });
    expect(share(favicon, light.background)).toBeGreaterThan(0.02);
  });

  it('has a splash mark for each background of the app', () => {
    const onPaper = readPng('splash-icon.png');
    expect(pixelAt(onPaper, 0, 0).a).toBe(0);
    expect(share(onPaper, dark.background)).toBeGreaterThan(0.02); // ink letter for the paper
    expect(share(onPaper, light.accent)).toBeGreaterThan(0.001);
    const onInk = readPng('splash-icon-dark.png');
    expect(pixelAt(onInk, 0, 0).a).toBe(0);
    expect(share(onInk, light.background)).toBeGreaterThan(0.02); // paper letter for the ink
    expect(share(onInk, dark.accent)).toBeGreaterThan(0.001);
  });

  it.each([
    'icon.png',
    'android-icon-background.png',
    'android-icon-foreground.png',
    'favicon.png',
    'splash-icon.png',
    'splash-icon-dark.png',
  ])('%s has no blue in it (the Expo template artwork was blue)', (file) => {
    const png = readPng(file);
    let bluish = 0;
    for (let i = 0; i < png.rgba.length; i += 4) {
      if (png.rgba[i + 3] !== 0 && png.rgba[i + 2]! - png.rgba[i]! >= 24) bluish += 1;
    }
    expect(bluish).toBe(0);
  });

  it('points the splash screen at the matching marks', () => {
    const config = jest.requireActual('../../app.config').default as { plugins?: unknown[] };
    const splash = config.plugins?.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    ) as [string, { image: string; dark: { image: string } }];
    expect(splash[1].image).toBe('./assets/images/splash-icon.png');
    expect(splash[1].dark.image).toBe('./assets/images/splash-icon-dark.png');
  });
});
