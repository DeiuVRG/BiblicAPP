import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UsageError } from '../lib/usage-error';
import {
  loadCalques,
  loadGlossary,
  parseCalques,
  parseGlossary,
  ruleApplies,
  unicodeWordEscapes,
} from './glossary';

const HEADER = 'term_id,source_pattern,target_pattern,tradition,scope,force,status,note';

describe('parseGlossary', () => {
  it('compiles case-insensitive unicode patterns and keeps the note with its commas', () => {
    const rules = parseGlossary(
      `${HEADER}\nkingdom,\\bkingdom\\b,\\bîmpărăți,all,all,FIX,APROBAT,Rendered "Împărăția", always\n`,
      'glossary',
    );
    expect(rules).toHaveLength(1);
    const rule = rules[0];
    expect(rule).toMatchObject({
      termId: 'kingdom',
      tradition: 'all',
      scope: 'all',
      force: 'FIX',
      status: 'APROBAT',
      note: 'Rendered "Împărăția", always',
    });
    expect(rule?.source?.test('The KINGDOM comes')).toBe(true);
    expect(rule?.target.test('ÎMPĂRĂȚIA')).toBe(true);
    expect(rule?.target.flags).toContain('u');
  });

  it('allows an empty source pattern for FORBID and WARN rows only', () => {
    const forbid = parseGlossary(`${HEADER}\nx,,\\bregat\\b,all,all,FORBID,PROPUS,\n`, 'g');
    expect(forbid[0]?.source).toBeNull();
    expect(() => parseGlossary(`${HEADER}\nx,,\\bregat\\b,all,all,FIX,PROPUS,\n`, 'g')).toThrow(
      /source_pattern is required for FIX/,
    );
  });

  it('rejects a bad regular expression as a usage error naming the row', () => {
    const csv = `${HEADER}\nok,a,b,all,all,WARN,APROBAT,\nbad,a(,b,all,all,WARN,APROBAT,\n`;
    expect(() => parseGlossary(csv, 'glossary x.csv')).toThrow(UsageError);
    expect(() => parseGlossary(csv, 'glossary x.csv')).toThrow(/line 3 \(bad\) source_pattern/);
    const target = `${HEADER}\nbad,a,[,all,all,WARN,APROBAT,\n`;
    expect(() => parseGlossary(target, 'g')).toThrow(/target_pattern: invalid regular expression/);
  });

  it('rejects unknown force, status, tradition and an empty target', () => {
    const row = (force: string, status: string, tradition: string, target = 'b') =>
      `${HEADER}\nx,a,${target},${tradition},all,${force},${status},\n`;
    expect(() => parseGlossary(row('MUST', 'APROBAT', 'all'), 'g')).toThrow(/force must be one of/);
    expect(() => parseGlossary(row('FIX', 'DONE', 'all'), 'g')).toThrow(/status must be one of/);
    expect(() => parseGlossary(row('FIX', 'APROBAT', 'baptist'), 'g')).toThrow(/tradition must be/);
    expect(() => parseGlossary(row('FIX', 'APROBAT', 'all', ''), 'g')).toThrow(
      /target_pattern is empty/,
    );
  });
});

describe('unicodeWordEscapes', () => {
  const compile = (source: string) => new RegExp(unicodeWordEscapes(source), 'iu');

  it('makes \\b work around Romanian diacritics', () => {
    expect(compile('\\bbiserică\\b').test('o Biserică nouă')).toBe(true);
    expect(compile('\\bbiserică\\b').test('Biserică.')).toBe(true);
    expect(compile('\\bbiserică\\b').test('Bisericăx')).toBe(false);
    expect(compile('\\bîmpărăți').test('Împărăția')).toBe(true);
    expect(compile('\\bîmpărăți').test('anîmpărăția')).toBe(false);
    expect(compile('\\bregat\\b').test('Regatul')).toBe(false);
    expect(compile('\\bregat\\b').test('al regat-ului')).toBe(true);
  });

  it('translates \\B and leaves classes and escaped backslashes alone', () => {
    expect(compile('a\\Bb').test('ab')).toBe(true);
    expect(compile('a\\Bb').test('a b')).toBe(false);
    expect(compile('[\\b]x').test('\bx')).toBe(true);
    expect(compile('\\\\b').test('\\b')).toBe(true);
  });

  it('makes \\w consume Romanian diacritics, and still stops at spaces and punctuation', () => {
    // the shipped calques are written like this: the verb form ends in a diacritic
    const carries = compile('\\bpoart\\w* (?:sensul|ideea|înțelesul)\\b');
    expect(carries.test('Această frază poartă sensul')).toBe(true);
    expect(carries.test('Fraza poarta sensul')).toBe(true);
    expect(carries.test('Ei poartă ideea acestui text')).toBe(true);
    expect(carries.test('poartă, sensul')).toBe(false);
    expect(compile('\\bsensibil\\w* la\\b').test('Ea este sensibilă la durere')).toBe(true);
    expect(compile('\\brealiz\\w* că\\b').test('Ei realizează că este așa')).toBe(true);
    expect(compile('\\bexperiment\\w* harul\\b').test('El experimentează harul')).toBe(true);
    expect(compile('a\\wb').test('aăb')).toBe(true);
    expect(compile('a\\wb').test('a1b')).toBe(true);
    expect(compile('a\\wb').test('a_b')).toBe(true);
    expect(compile('a\\wb').test('a b')).toBe(false);
    expect(compile('a\\wb').test('a-b')).toBe(false);
  });

  it('makes \\W the exact complement of \\w', () => {
    expect(compile('a\\Wb').test('a-b')).toBe(true);
    expect(compile('a\\Wb').test('a b')).toBe(true);
    expect(compile('a\\Wb').test('aăb')).toBe(false);
    expect(compile('a\\Wb').test('a1b')).toBe(false);
    expect(compile('\\W+$').exec('cuvânt, ')?.[0]).toBe(', ');
  });

  it('rewrites \\w and \\W inside character classes', () => {
    expect(compile('^[\\w-]+$').test('într-o')).toBe(true);
    expect(compile('^[\\w-]+$').test('într o')).toBe(false);
    expect(compile('^[\\wăâ]+$').test('ȘțîÎ')).toBe(true);
    expect(compile('[^\\w]').test('ă')).toBe(false);
    expect(compile('[^\\w]').test(' ')).toBe(true);
    expect(compile('[\\W]').test('ă')).toBe(false);
    expect(compile('[\\W]').test('.')).toBe(true);
    // a class that holds \W next to other members becomes an alternation
    const nonWordOrA = compile('^[a\\W]$');
    expect([...'a .'].map((c) => nonWordOrA.test(c))).toEqual([true, true, true]);
    expect(['b', 'ă', '1'].map((c) => nonWordOrA.test(c))).toEqual([false, false, false]);
    const wordButA = compile('^[^a\\W]$');
    expect(['b', 'ă', '1'].map((c) => wordButA.test(c))).toEqual([true, true, true]);
    expect(['a', ' ', '.'].map((c) => wordButA.test(c))).toEqual([false, false, false]);
    // a caret left at the front of the class is a caret, not a negation
    const caretOrNonWord = compile('^[\\W^]$');
    expect(['^', ' ', '.'].map((c) => caretOrNonWord.test(c))).toEqual([true, true, true]);
    expect(['a', 'ă', '1'].map((c) => caretOrNonWord.test(c))).toEqual([false, false, false]);
    // the alternation is one atom, so quantifiers and anchors still apply to it
    expect(compile('^[a\\W]{3}$').test('a, ')).toBe(true);
    expect(compile('^[a\\W]{3}$').test('aăa')).toBe(false);
  });

  it('leaves escaped backslashes, \\d, \\s, \\p{...} and escaped brackets alone', () => {
    expect(compile('\\\\w').test('\\w')).toBe(true);
    expect(compile('\\\\w').test('ă')).toBe(false);
    expect(compile('\\\\\\w').test('\\ă')).toBe(true);
    expect(compile('\\d\\s\\p{Lu}').test('1 Ș')).toBe(true);
    expect(compile('\\[\\w+\\]').test('[ăb]')).toBe(true);
    expect(compile('[\\]\\w]+').exec('x]ăy')?.[0]).toBe('x]ăy');
  });

  it('does not repair a class that is never closed', () => {
    expect(() => compile('a[bc')).toThrow(SyntaxError);
    expect(() => compile('[')).toThrow(SyntaxError);
  });
});

describe('parseCalques', () => {
  it('compiles the patterns with the i and u flags', () => {
    const rules = parseCalques(
      JSON.stringify([
        { id: 'a', pattern: 'în ordine să', level: 'FORBID', preferred: 'pentru a' },
        { id: 'b', pattern: 'realizează', level: 'WARN', preferred: '', note: 'prefer a verb' },
      ]),
      'calques',
    );
    expect(rules.map((r) => [r.id, r.level, r.note])).toEqual([
      ['a', 'FORBID', ''],
      ['b', 'WARN', 'prefer a verb'],
    ]);
    expect(rules[0]?.pattern.test('ÎN ORDINE SĂ')).toBe(true);
  });

  it('turns a bad regex, bad JSON and unknown fields into usage errors', () => {
    const entry = { id: 'a', pattern: '(', level: 'WARN', preferred: '' };
    expect(() => parseCalques(JSON.stringify([entry]), 'calques')).toThrow(
      /\(a\) pattern: invalid regular expression/,
    );
    expect(() => parseCalques('[', 'calques')).toThrow(/invalid JSON/);
    expect(() =>
      parseCalques(JSON.stringify([{ ...entry, pattern: 'x', extra: 1 }]), 'calques'),
    ).toThrow(/\[0\]/);
    expect(() =>
      parseCalques(JSON.stringify([{ ...entry, pattern: 'x', level: 'MUST' }]), 'calques'),
    ).toThrow(/\[0\]\.level/);
  });
});

describe('loadGlossary / loadCalques', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-glossary-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads the files and reports a missing file as a usage error', () => {
    const glossary = path.join(dir, 'glossary.csv');
    fs.writeFileSync(glossary, `${HEADER}\nx,a,b,all,all,WARN,APROBAT,\n`);
    expect(loadGlossary(glossary)).toHaveLength(1);
    const calques = path.join(dir, 'calques.json');
    fs.writeFileSync(calques, '[]');
    expect(loadCalques(calques)).toEqual([]);
    expect(() => loadGlossary(path.join(dir, 'missing.csv'))).toThrow(/file not found/);
    expect(() => loadCalques(path.join(dir, 'missing.json'))).toThrow(UsageError);
  });
});

describe('ruleApplies', () => {
  const [rule] = parseGlossary(`${HEADER}\nx,a,b,orthodox,some-work,FIX,APROBAT,\n`, 'g');
  const [open] = parseGlossary(`${HEADER}\nx,a,b,all,all,FIX,APROBAT,\n`, 'g');
  const [undivided] = parseGlossary(`${HEADER}\nx,a,b,undivided,all,FIX,APROBAT,\n`, 'g');

  it('needs the scope to be all or the work and the tradition to fit', () => {
    if (!rule || !open || !undivided) throw new Error('fixture');
    expect(ruleApplies(rule, 'some-work', 'orthodox')).toBe(true);
    expect(ruleApplies(rule, 'other-work', 'orthodox')).toBe(false);
    expect(ruleApplies(rule, 'some-work', 'protestant')).toBe(false);
    expect(ruleApplies(rule, 'some-work', undefined)).toBe(false);
    expect(ruleApplies(open, 'any', undefined)).toBe(true);
    expect(ruleApplies(undivided, 'any', 'catholic')).toBe(true);
  });
});
