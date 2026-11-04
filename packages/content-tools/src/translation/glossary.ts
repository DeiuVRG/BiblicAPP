import { z } from 'zod';

import { UsageError } from '../lib/usage-error';
import { parseCsv } from './csv';
import { parseJsonText, parseWith, readTextFile } from './io';

/** Glossary and calque materials (docs/traducere-pipeline.md, section 2.4). */

export const GLOSSARY_COLUMNS = [
  'term_id',
  'source_pattern',
  'target_pattern',
  'tradition',
  'scope',
  'force',
  'status',
  'note',
] as const;

const FORCES = ['FIX', 'PREFER', 'WARN', 'FORBID'] as const;
const STATUSES = ['APROBAT', 'PROPUS'] as const;
const TRADITIONS = ['all', 'protestant', 'orthodox', 'catholic', 'undivided'] as const;

export type GlossaryForce = (typeof FORCES)[number];
export type GlossaryStatus = (typeof STATUSES)[number];

export interface GlossaryRule {
  termId: string;
  /** Matched against the source paragraph; null for a `FORBID`/`WARN` row that always applies. */
  source: RegExp | null;
  /** Matched against the translation. */
  target: RegExp;
  tradition: string;
  scope: string;
  force: GlossaryForce;
  status: GlossaryStatus;
  note: string;
}

export interface CalqueRule {
  id: string;
  pattern: RegExp;
  level: 'FORBID' | 'WARN';
  preferred: string;
  note: string;
}

const WORD = String.raw`[\p{L}\p{N}_]`;
const WORD_BOUNDARY = `(?:(?<=${WORD})(?!${WORD})|(?<!${WORD})(?=${WORD}))`;
const NOT_WORD_BOUNDARY = `(?:(?<=${WORD})(?=${WORD})|(?<!${WORD})(?!${WORD}))`;

/**
 * `\b` and `\B` of JavaScript only know ASCII word characters, so `\bîmpărăț` or `biserică\b` would
 * never match around a Romanian diacritic. Patterns of the materials get Unicode-aware word
 * boundaries instead; escaped backslashes and `[\b]` (backspace in a class) are left alone.
 */
export function unicodeWordBoundaries(source: string): string {
  let out = '';
  let inClass = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source.charAt(i);
    if (char === '\\') {
      const next = source.charAt(i + 1);
      if (!inClass && next === 'b') out += WORD_BOUNDARY;
      else if (!inClass && next === 'B') out += NOT_WORD_BOUNDARY;
      else out += char + next;
      i += 1;
      continue;
    }
    if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    out += char;
  }
  return out;
}

/**
 * Patterns are JavaScript regular expressions, case-insensitive with the `u` flag, with
 * Unicode-aware `\b`.
 */
function compilePattern(source: string, where: string): RegExp {
  try {
    return new RegExp(unicodeWordBoundaries(source), 'iu');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new UsageError(`${where}: invalid regular expression /${source}/: ${reason}`);
  }
}

function oneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  field: string,
  where: string,
): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new UsageError(`${where}: ${field} must be one of ${allowed.join(', ')}, got "${value}"`);
  }
  return match;
}

export function parseGlossary(text: string, label: string): GlossaryRule[] {
  return parseCsv(text, GLOSSARY_COLUMNS, label).map(({ line, values }) => {
    const where = `${label} line ${line}`;
    const field = (name: (typeof GLOSSARY_COLUMNS)[number]): string => values[name] ?? '';
    const termId = field('term_id');
    if (termId === '') throw new UsageError(`${where}: term_id is empty`);
    const force = oneOf(field('force'), FORCES, 'force', where);
    const sourcePattern = field('source_pattern');
    if (sourcePattern === '' && force !== 'FORBID' && force !== 'WARN') {
      throw new UsageError(`${where} (${termId}): source_pattern is required for ${force} rows`);
    }
    if (field('target_pattern') === '') {
      throw new UsageError(`${where} (${termId}): target_pattern is empty`);
    }
    return {
      termId,
      source:
        sourcePattern === '' ? null : compilePattern(sourcePattern, `${where} (${termId}) source_pattern`),
      target: compilePattern(field('target_pattern'), `${where} (${termId}) target_pattern`),
      tradition: oneOf(field('tradition'), TRADITIONS, 'tradition', where),
      scope: field('scope') === '' ? 'all' : field('scope'),
      force,
      status: oneOf(field('status'), STATUSES, 'status', where),
      note: field('note'),
    };
  });
}

export function loadGlossary(file: string): GlossaryRule[] {
  return parseGlossary(readTextFile(file, 'glossary'), `glossary ${file}`);
}

const CalqueFileSchema = z.array(
  z.strictObject({
    id: z.string().min(1),
    pattern: z.string().min(1),
    level: z.enum(['FORBID', 'WARN']),
    preferred: z.string(),
    note: z.string().optional(),
  }),
);

export function parseCalques(text: string, label: string): CalqueRule[] {
  return parseWith(CalqueFileSchema, parseJsonText(text, label), label).map((entry) => ({
    id: entry.id,
    pattern: compilePattern(entry.pattern, `${label} (${entry.id}) pattern`),
    level: entry.level,
    preferred: entry.preferred,
    note: entry.note ?? '',
  }));
}

export function loadCalques(file: string): CalqueRule[] {
  return parseCalques(readTextFile(file, 'calques'), `calques ${file}`);
}

/**
 * A row applies to a work when its scope is `all` or the work slug and its tradition is `all`,
 * `undivided` or the tradition of the work (unknown when the source edition is not at hand).
 */
export function ruleApplies(
  rule: GlossaryRule,
  workSlug: string,
  tradition: string | undefined,
): boolean {
  if (rule.scope !== 'all' && rule.scope !== workSlug) return false;
  return rule.tradition === 'all' || rule.tradition === 'undivided' || rule.tradition === tradition;
}
