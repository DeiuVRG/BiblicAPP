import { readFileSync } from 'node:fs';

/**
 * The code points a TrueType font has glyphs for, read from its `cmap` table (formats 4 and 12,
 * which every font of the app uses). A small reader instead of a font library: the tests only
 * need to know whether `ș` or a polytonic Greek letter is covered, which is what decides whether
 * the system falls back to another font for it.
 */
export function readCoverage(file: string): Set<number> {
  const bytes = readFileSync(file);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = view.getUint16(4);
  let cmap = -1;
  for (let index = 0; index < tables; index += 1) {
    const record = 12 + index * 16;
    const tag = String.fromCharCode(...bytes.subarray(record, record + 4));
    if (tag === 'cmap') cmap = view.getUint32(record + 8);
  }
  if (cmap < 0) throw new Error(`${file} has no cmap table`);

  const covered = new Set<number>();
  const subtables = view.getUint16(cmap + 2);
  for (let index = 0; index < subtables; index += 1) {
    const start = cmap + view.getUint32(cmap + 4 + index * 8 + 4);
    const format = view.getUint16(start);
    if (format === 4) {
      const segments = view.getUint16(start + 6) / 2;
      const ends = start + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const offsets = deltas + segments * 2;
      for (let segment = 0; segment < segments; segment += 1) {
        const first = view.getUint16(starts + segment * 2);
        const last = view.getUint16(ends + segment * 2);
        const delta = view.getUint16(deltas + segment * 2);
        const rangeOffset = view.getUint16(offsets + segment * 2);
        for (let code = first; code <= last && code !== 0xffff; code += 1) {
          let glyph: number;
          if (rangeOffset === 0) glyph = (code + delta) & 0xffff;
          else {
            const address = offsets + segment * 2 + rangeOffset + (code - first) * 2;
            const raw = view.getUint16(address);
            glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
          }
          if (glyph !== 0) covered.add(code);
        }
      }
    } else if (format === 12) {
      const groups = view.getUint32(start + 12);
      for (let group = 0; group < groups; group += 1) {
        const at = start + 16 + group * 12;
        const first = view.getUint32(at);
        const last = view.getUint32(at + 4);
        for (let code = first; code <= last; code += 1) covered.add(code);
      }
    }
  }
  return covered;
}

/** The characters of `text` that the covered set lacks (each once), as a string. */
export function missingFrom(covered: ReadonlySet<number>, text: string): string {
  return [...new Set([...text])].filter((char) => !covered.has(char.codePointAt(0)!)).join('');
}
