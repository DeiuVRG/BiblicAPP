import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { FIRST_PAINT, markdown, summarise, ttfFiles } from './measure-fonts.mjs';

/** A fake export: Expo puts the fonts under assets/__node_modules/... with a hash in the name. */
function fakeExport(sizes) {
  const dir = mkdtempSync(join(tmpdir(), 'biblicapp-fonts-'));
  const nested = join(dir, 'assets', '__node_modules', '@expo-google-fonts', 'x');
  mkdirSync(nested, { recursive: true });
  for (const [name, bytes] of Object.entries(sizes)) {
    writeFileSync(
      join(nested, `${name}.51b6ad87261f18b6433ec52871ddfabc.ttf`),
      Buffer.alloc(bytes),
    );
  }
  writeFileSync(join(nested, 'notes.txt'), 'not a font');
  return dir;
}

test('reads the fonts of an export, without the hash in the name and without other files', () => {
  const dir = fakeExport({ Inter_400Regular: 2048, SourceSerif4_400Regular: 1024 });
  try {
    assert.deepEqual(ttfFiles(dir), [
      { name: 'Inter_400Regular', bytes: 2048 },
      { name: 'SourceSerif4_400Regular', bytes: 1024 },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('splits the total into the first-paint set (five named files) and the rest, by family', () => {
  const files = [
    ...FIRST_PAINT.map((name) => ({ name, bytes: 1024 })),
    { name: 'Literata_400Regular', bytes: 2048 },
    { name: 'Literata_700Bold', bytes: 2048 },
    { name: 'SourceSerif4_600SemiBold_Italic', bytes: 512 },
  ];
  const summary = summarise(files);
  assert.equal(summary.count, 8);
  assert.equal(summary.firstPaint.count, 5);
  assert.equal(summary.firstPaint.bytes, 5 * 1024);
  assert.equal(summary.onDemand.count, 3);
  assert.equal(summary.onDemand.bytes, 2048 + 2048 + 512);
  assert.equal(summary.total, 5 * 1024 + 4608);
  const literata = summary.families.find((entry) => entry.family === 'Literata');
  assert.equal(literata.files.length, 2);
  assert.equal(literata.bytes, 4096);
  // The 600 italic is a Source Serif 4 file that is not in the first paint.
  const serif = summary.families.find((entry) => entry.family === 'SourceSerif4');
  assert.equal(serif.files.length, 4);
});

test('names the five first-paint files like src/theme/font-sources.ts does', () => {
  assert.deepEqual(FIRST_PAINT, [
    'IMFellGreatPrimer_400Regular',
    'IMFellGreatPrimer_400Regular_Italic',
    'SourceSerif4_400Regular',
    'SourceSerif4_400Regular_Italic',
    'SourceSerif4_600SemiBold',
  ]);
});

test('writes the README table in Romanian with a decimal comma', () => {
  const files = [
    { name: 'IMFellGreatPrimer_400Regular', bytes: 1048576 },
    { name: 'Inter_400Regular', bytes: 524288 },
  ];
  const table = markdown(summarise(files));
  const lines = table.split('\n');
  assert.equal(lines[0], '| Familie | Fișiere | KiB | Rol |');
  assert.ok(lines.some((line) => line.startsWith('| IMFellGreatPrimer | 1 | 1024 |')));
  assert.ok(lines.some((line) => line.includes('1,50 MiB în exportul web')));
  assert.ok(lines.some((line) => line.startsWith('| din care prima pictură')));
});
