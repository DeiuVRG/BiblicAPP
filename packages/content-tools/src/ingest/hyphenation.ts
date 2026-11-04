/**
 * Dehyphenation of words split at the end of a line.
 *
 * A trailing hyphen is either a soft hyphen ("king-" + "dom" -> "kingdom") or part of a real
 * compound ("God-" + "centered" -> "God-centered"). The decision uses evidence from the text
 * itself: how often the hyphenated compound occurs inside a line versus the joined word.
 * Without any evidence the hyphen is treated as soft (joined); real compounds that occur only
 * at a line end are listed in the work's config (`hyphenation.keep`).
 */

export interface Vocabulary {
  /** Lower-case alphabetic words occurring inside lines (line-end fragments excluded). */
  words: Map<string, number>;
  /** Lower-case `a-b` pairs occurring inside lines. */
  hyphenated: Map<string, number>;
}

export interface HyphenOptions {
  /** Lower-case compounds with hyphen that must keep it, e.g. "god-centered". */
  keep: ReadonlySet<string>;
  /** Lower-case joined words that must be joined, e.g. "kingdom". */
  join: ReadonlySet<string>;
}

export type HyphenDecision = 'join' | 'keep';

export interface HyphenChoice {
  first: string;
  second: string;
  decision: HyphenDecision;
  reason: string;
}

const WORD = /\p{L}+/gu;
const COMPOUND = /\p{L}+(?:-\p{L}+)+/gu;

/** Builds the vocabulary from consecutive text lines. */
export function buildVocabulary(lines: readonly string[]): Vocabulary {
  const words = new Map<string, number>();
  const hyphenated = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string): void => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };
  let previousEndsWithHyphen = false;
  for (const raw of lines) {
    let line = raw;
    // Drop the fragment that is continued on the next line and the one continued from before.
    const endsWithHyphen = /\p{L}-\s*$/u.test(line);
    if (endsWithHyphen) line = line.replace(/\p{L}+-\s*$/u, ' ');
    if (previousEndsWithHyphen) line = line.replace(/^\s*\p{L}+/u, ' ');
    previousEndsWithHyphen = endsWithHyphen;
    for (const compound of line.match(COMPOUND) ?? []) {
      const parts = compound.toLowerCase().split('-');
      for (let i = 0; i < parts.length - 1; i += 1) bump(hyphenated, `${parts[i]}-${parts[i + 1]}`);
    }
    for (const word of line.match(WORD) ?? []) bump(words, word.toLowerCase());
  }
  return { words, hyphenated };
}

/** Decides whether `first` + `-` + `second` (split at a line end) is joined or keeps its hyphen. */
export function decideHyphen(
  first: string,
  second: string,
  vocabulary: Vocabulary,
  options: HyphenOptions,
): HyphenChoice {
  const a = first.toLowerCase();
  const b = second.toLowerCase();
  const compound = `${a}-${b}`;
  const joined = `${a}${b}`;
  const choose = (decision: HyphenDecision, reason: string): HyphenChoice => ({
    first,
    second,
    decision,
    reason,
  });

  if (options.keep.has(compound)) return choose('keep', 'config keep');
  if (options.join.has(joined)) return choose('join', 'config join');

  const hyphenCount = vocabulary.hyphenated.get(compound) ?? 0;
  const joinedCount = vocabulary.words.get(joined) ?? 0;
  if (hyphenCount > joinedCount) return choose('keep', `compound seen ${hyphenCount}x`);
  if (joinedCount > 0) return choose('join', `joined word seen ${joinedCount}x`);

  return choose('join', 'soft hyphen');
}

/**
 * Joins consecutive lines of one paragraph into a single string, resolving line-end hyphens.
 * Returns the text and the hyphen decisions that were taken (for review).
 */
export function joinLines(
  lines: readonly string[],
  vocabulary: Vocabulary,
  options: HyphenOptions,
): { text: string; choices: HyphenChoice[] } {
  const choices: HyphenChoice[] = [];
  let text = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
    if (text === '') {
      text = line;
      continue;
    }
    if (/-$/.test(text)) {
      const left = /(\p{L}+)-$/u.exec(text);
      const right = /^(\p{L}+)/u.exec(line);
      if (left && right && /^\p{Ll}/u.test(line)) {
        const choice = decideHyphen(left[1] as string, right[1] as string, vocabulary, options);
        choices.push(choice);
        text = choice.decision === 'join' ? text.slice(0, -1) + line : text + line;
        continue;
      }
      if (/[\p{L}\p{N}]-$/u.test(text) && /^[\p{L}\p{N}]/u.test(line)) {
        // Capitalised or numeric continuation: a real compound or a range, keep the hyphen.
        text += line;
        continue;
      }
    }
    text += ` ${line}`;
  }
  return { text, choices };
}
