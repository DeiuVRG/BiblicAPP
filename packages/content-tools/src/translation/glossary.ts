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
  /** The patterns as written in the file, for messages. */
  sourcePattern: string;
  targetPattern: string;
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

const WORD_CHARS = String.raw`\p{L}\p{N}_`;
const WORD = `[${WORD_CHARS}]`;
const NON_WORD = `[^${WORD_CHARS}]`;
const WORD_BOUNDARY = `(?:(?<=${WORD})(?!${WORD})|(?<!${WORD})(?=${WORD}))`;
const NOT_WORD_BOUNDARY = `(?:(?<=${WORD})(?=${WORD})|(?<!${WORD})(?!${WORD}))`;

/** Index of the `]` that closes the class opened at `open`; -1 when the class is not closed. */
function classEnd(source: string, open: number): number {
  for (let i = open + 1; i < source.length; i += 1) {
    const char = source.charAt(i);
    if (char === '\\') i += 1;
    else if (char === ']') return i;
  }
  return -1;
}

/**
 * A character class with `\w` and `\W` made Unicode-aware. `\w` becomes the letters, digits and
 * underscore; `\W` cannot be a member of a class without the `v` flag, so it turns the class into
 * an alternation (`[a\W]` is `(?:[a]|[^...])`, `[^a\W]` is `(?![a])[...]`).
 */
function rewriteClass(body: string): string {
  const negated = body.startsWith('^');
  const items = negated ? body.slice(1) : body;
  let kept = '';
  let nonWord = false;
  for (let i = 0; i < items.length; i += 1) {
    const char = items.charAt(i);
    if (char !== '\\') {
      kept += char;
      continue;
    }
    const next = items.charAt(i + 1);
    if (next === 'w') kept += WORD_CHARS;
    else if (next === 'W') nonWord = true;
    else kept += char + next;
    i += 1;
  }
  if (!nonWord) return `[${negated ? '^' : ''}${kept}]`;
  // What is left of `[\W^]` must not start with a bare `^`, which would negate the class.
  const members = kept.startsWith('^') ? `\\${kept}` : kept;
  if (negated) return members === '' ? WORD : `(?:(?![${members}])${WORD})`;
  return members === '' ? NON_WORD : `(?:[${members}]|${NON_WORD})`;
}

/**
 * `\b`, `\B`, `\w` and `\W` of JavaScript only know ASCII word characters, so `\bîmpărăț`,
 * `biserică\b` or `poart\w* sensul` would never match around or across a Romanian diacritic
 * (`poartă sensul`). Patterns of the materials get Unicode-aware versions instead: a word
 * character is a letter, a digit or `_`. Escaped backslashes and `[\b]` (backspace in a class) are
 * left alone; `\d` and `\s` already do what the materials need.
 */
export function unicodeWordEscapes(source: string): string {
  let out = '';
  for (let i = 0; i < source.length; i += 1) {
    const char = source.charAt(i);
    if (char === '\\') {
      const next = source.charAt(i + 1);
      if (next === 'b') out += WORD_BOUNDARY;
      else if (next === 'B') out += NOT_WORD_BOUNDARY;
      else if (next === 'w') out += WORD;
      else if (next === 'W') out += NON_WORD;
      else out += char + next;
      i += 1;
    } else if (char === '[') {
      const end = classEnd(source, i);
      if (end < 0) {
        // Not closed: leave the rest alone so that the RegExp constructor reports the error.
        out += source.slice(i);
        break;
      }
      out += rewriteClass(source.slice(i + 1, end));
      i = end;
    } else {
      out += char;
    }
  }
  return out;
}

/**
 * Patterns are JavaScript regular expressions, case-insensitive with the `u` flag, with
 * Unicode-aware `\b`, `\B`, `\w` and `\W`.
 */
function compilePattern(source: string, where: string): RegExp {
  try {
    return new RegExp(unicodeWordEscapes(source), 'iu');
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
        sourcePattern === ''
          ? null
          : compilePattern(sourcePattern, `${where} (${termId}) source_pattern`),
      target: compilePattern(field('target_pattern'), `${where} (${termId}) target_pattern`),
      sourcePattern,
      targetPattern: field('target_pattern'),
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
