import { UsageError } from '../lib/usage-error';

export interface CsvRow {
  /** 1-based line number in the file, for error messages. */
  line: number;
  values: Record<string, string>;
}

/**
 * Reads the comma separated materials (the glossary). The format is deliberately tiny: a header
 * row, one record per line, every line split on its first `columns.length - 1` commas, so that
 * the last column may contain commas and no column needs quoting. Fields are trimmed; blank
 * lines and lines starting with `#` are skipped.
 */
export function parseCsv(text: string, columns: readonly string[], label: string): CsvRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  const rows: CsvRow[] = [];
  let header: string[] | undefined;
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const fields = splitFirst(line, columns.length);
    if (header === undefined) {
      header = fields;
      if (fields.join(',') !== columns.join(',')) {
        throw new UsageError(
          `${label} line ${index + 1}: expected the header "${columns.join(',')}", got "${line}"`,
        );
      }
      return;
    }
    if (fields.length < columns.length) {
      throw new UsageError(
        `${label} line ${index + 1}: expected ${columns.length} fields, found ${fields.length} ` +
          `(patterns must not contain commas; write them as \\x2C)`,
      );
    }
    const values: Record<string, string> = {};
    columns.forEach((name, column) => {
      values[name] = fields[column] ?? '';
    });
    rows.push({ line: index + 1, values });
  });
  if (header === undefined) throw new UsageError(`${label}: the header row is missing`);
  return rows;
}

/** Splits on the first `count - 1` commas; the remainder stays in the last field. */
function splitFirst(line: string, count: number): string[] {
  const fields: string[] = [];
  let rest = line;
  while (fields.length < count - 1) {
    const comma = rest.indexOf(',');
    if (comma < 0) break;
    fields.push(rest.slice(0, comma).trim());
    rest = rest.slice(comma + 1);
  }
  fields.push(rest.trim());
  return fields;
}
