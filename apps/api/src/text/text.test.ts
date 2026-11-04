import { describe, expect, it } from 'vitest';

import { baseLanguage, getAnalyzer } from './analyzer';
import { foldText } from './fold';
import { stemEnglish, stemRomanian } from './stem';
import { ENGLISH_STOPWORDS, ROMANIAN_STOPWORDS } from './stopwords';

describe('foldText (same fold as the app search)', () => {
  it('lower-cases and removes diacritics, keeping the length', () => {
    const text = 'Împărăția Cerurilor ȘȚ șț ţş ă â';
    const folded = foldText(text);
    expect(folded).toBe('imparatia cerurilor st st ts a a');
    expect(folded.length).toBe(text.length);
  });

  it('gives exactly what the full Unicode fold gives, ASCII fast path included', () => {
    // The reference is the fold without the fast path: NFD, drop combining marks, lower-case.
    const reference = (char: string): string => {
      if (char === '‘' || char === '’' || char === 'ʼ') return "'";
      if (char === '“' || char === '”') return '"';
      if (char === 'ς') return 'σ';
      const folded = char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      return folded.length === 1 ? folded : char.toLowerCase().slice(0, 1) || char;
    };
    for (let code = 0; code < 0x250; code += 1) {
      const char = String.fromCharCode(code);
      expect(foldText(char), `U+${code.toString(16)}`).toBe(reference(char));
    }
    const sample =
      "Împărăția Cerurilor, said St. Paul: «Ἐν ἀρχῇ ἦν ὁ λόγος» — it's 17:4 & 'ok' ȘȚ ñ ü";
    expect(foldText(sample)).toBe(Array.from(sample, (char) => reference(char)).join(''));
  });

  it('straightens typographic quotes and folds the Greek final sigma', () => {
    expect(foldText('“God’s”')).toBe('"god\'s"');
    expect(foldText('λόγος')).toBe('λογοσ');
  });
});

describe('stemmers', () => {
  it('meets English plurals and endings', () => {
    const same = (...words: string[]) => expect(new Set(words.map(stemEnglish)).size).toBe(1);
    same('kingdom', 'kingdoms');
    same('teach', 'teaching', 'teachings', 'teaches');
    same('preach', 'preached', 'preaching', 'preaches');
    same('sacrifice', 'sacrifices', 'sacrificed');
    same('heaven', 'heavens', 'heavenly');
    same('righteous', 'righteousness');
    same('make', 'making');
  });

  it('leaves short words, numbers and Latin-ending words alone', () => {
    expect(stemEnglish('king')).toBe('king');
    expect(stemEnglish('jesus')).toBe('jesus');
    expect(stemEnglish('17')).toBe('17');
    expect(stemEnglish('spring')).toBe('spring');
  });

  it('meets Romanian definite articles, plurals and genitives', () => {
    const same = (...words: string[]) => expect(new Set(words.map(stemRomanian)).size).toBe(1);
    same('imparatia', 'imparatiei', 'imparatie', 'imparatii', 'imparatiile', 'imparatiilor');
    same('cer', 'cerul', 'cerului', 'ceruri', 'cerurilor');
    same('biserica', 'biserici', 'bisericii', 'bisericile', 'bisericilor');
    same('pacat', 'pacatul', 'pacatului', 'pacate', 'pacatele', 'pacatelor');
  });
});

describe('analyzer', () => {
  it('drops stop words and stems, per language', () => {
    expect(
      getAnalyzer('en').analyze('What does the Kingdom of Heaven mean for the teachings?'),
    ).toEqual(['kingdom', 'heaven', 'teach']);
    expect(getAnalyzer('ro').analyze('Ce spune despre Împărăția cerurilor și credința?')).toEqual([
      'imparat',
      'cer',
      'credint',
    ]);
  });

  it('removes the English possessive', () => {
    expect(getAnalyzer('en').analyze("God's grace")).toEqual(['god', 'grac']);
  });

  it('treats regional codes as their base language and unknown languages plainly', () => {
    expect(baseLanguage('ro-MD')).toBe('ro');
    expect(getAnalyzer('ro-MD').language).toBe('ro');
    expect(getAnalyzer('la').language).toBe('other');
    expect(getAnalyzer('la').analyze('Gratia Dei')).toEqual(['gratia', 'dei']);
  });

  it('keeps numbers and drops single letters', () => {
    expect(getAnalyzer('en').analyze('1903 x y z')).toEqual(['1903']);
  });

  it('keeps the stop word lists folded', () => {
    for (const word of [...ROMANIAN_STOPWORDS, ...ENGLISH_STOPWORDS]) {
      expect(foldText(word)).toBe(word);
    }
  });
});
