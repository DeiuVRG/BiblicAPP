import { describe, expect, it } from 'vitest';

import { UsageError } from '../lib/usage-error';
import { parseCsv } from './csv';

const COLUMNS = ['a', 'b', 'c'] as const;

describe('parseCsv', () => {
  it('reads the header and splits every line on the first commas only', () => {
    const rows = parseCsv('a,b,c\n1,2,three, with, commas\n4,5,6', COLUMNS, 'test');
    expect(rows).toEqual([
      { line: 2, values: { a: '1', b: '2', c: 'three, with, commas' } },
      { line: 3, values: { a: '4', b: '5', c: '6' } },
    ]);
  });

  it('trims fields and skips blank lines, comments and a BOM, with CRLF line ends', () => {
    const text = '﻿# comment\r\n\r\na , b , c\r\n  # another\r\n 1 , 2 , 3 \r\n\r\n';
    expect(parseCsv(text, COLUMNS, 'test')).toEqual([
      { line: 5, values: { a: '1', b: '2', c: '3' } },
    ]);
  });

  it('allows an empty field', () => {
    expect(parseCsv('a,b,c\n1,,3', COLUMNS, 'test')[0]?.values).toEqual({ a: '1', b: '', c: '3' });
  });

  it('rejects a wrong header with the line number', () => {
    expect(() => parseCsv('a,b,x\n1,2,3', COLUMNS, 'glossary')).toThrow(UsageError);
    expect(() => parseCsv('a,b,x\n1,2,3', COLUMNS, 'glossary')).toThrow(/glossary line 1.*header/);
  });

  it('rejects a missing header and a short line', () => {
    expect(() => parseCsv('# only comments\n', COLUMNS, 'g')).toThrow(/header row is missing/);
    expect(() => parseCsv('a,b,c\n1,2', COLUMNS, 'g')).toThrow(/g line 2: expected 3 fields, found 2/);
  });
});
