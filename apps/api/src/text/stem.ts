// Light suffix-stripping stemmers. They are deliberately conservative: the point is that
// "kingdom"/"kingdoms" and "împărăția"/"împărăției"/"împărăție" meet in the index, not linguistic
// precision. Both expect folded (lower case, no diacritics) input and are applied identically to
// the indexed text and to the query.

const VOWEL = /[aeiouy]/;

function undouble(stem: string): string {
  const last = stem[stem.length - 1];
  if (
    last !== undefined &&
    stem.length > 3 &&
    last === stem[stem.length - 2] &&
    !/[aeiouls]/.test(last)
  ) {
    return stem.slice(0, -1);
  }
  return stem;
}

function stripSuffix(word: string, suffix: string, minStem: number): string | null {
  if (!word.endsWith(suffix)) return null;
  const stem = word.slice(0, -suffix.length);
  return stem.length >= minStem && VOWEL.test(stem) ? stem : null;
}

export function stemEnglish(word: string): string {
  if (word.length <= 3 || !/^[a-z]+$/.test(word)) return word;
  let w = word;
  // Plurals.
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (/(?:ch|sh|x|z)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  // Derivational and verbal endings (one of them).
  const ness = w.length > 6 ? stripSuffix(w, 'ness', 4) : null;
  const ing = stripSuffix(w, 'ing', 3);
  const ed = stripSuffix(w, 'ed', 3);
  const ly = w.length > 5 ? stripSuffix(w, 'ly', 4) : null;
  if (ness !== null) w = ness;
  else if (ing !== null) w = undouble(ing);
  else if (ed !== null && w.length > 4) w = undouble(ed);
  else if (ly !== null) w = ly;
  // A final silent e, so that "grace"/"graces"/"graced" meet.
  if (w.endsWith('e') && w.length > 3) w = w.slice(0, -1);
  return w;
}

// Nouns and adjectives (definite article, plural and genitive/dative endings), longest first.
const ROMANIAN_SUFFIXES: readonly string[] = [
  'urilor',
  'iilor',
  'eilor',
  'iile',
  'ului',
  'ilor',
  'elor',
  'ile',
  'ele',
  'uri',
  'iei',
  'ul',
  'ii',
  'ia',
  'ie',
  'ei',
  'ea',
  'le',
  'a',
  'e',
  'i',
  'u',
].sort((a, b) => b.length - a.length);

export function stemRomanian(word: string): string {
  if (word.length < 5 || !/^[a-z]+$/.test(word)) return word;
  for (const suffix of ROMANIAN_SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}
