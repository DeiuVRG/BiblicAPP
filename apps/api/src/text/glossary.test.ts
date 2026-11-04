import { describe, expect, it } from 'vitest';

import { getAnalyzer } from './analyzer';
import { GLOSSARY_CONCEPTS, translateQuery, warmGlossary } from './glossary';

describe('the glossary table', () => {
  it('is a real table: concepts with words on both sides', () => {
    expect(GLOSSARY_CONCEPTS.length).toBeGreaterThanOrEqual(150);
    for (const concept of GLOSSARY_CONCEPTS) {
      expect(concept.ro.length, JSON.stringify(concept)).toBeGreaterThan(0);
      expect(concept.en.length, JSON.stringify(concept)).toBeGreaterThan(0);
    }
  });

  it('holds only single words that survive the analysis of their language', () => {
    // A word that is a stop word (or one letter) can never be looked up, and a space would make
    // two words of one.
    for (const concept of GLOSSARY_CONCEPTS) {
      for (const language of ['ro', 'en'] as const) {
        for (const word of concept[language]) {
          expect(word, `${language}: ${word}`).not.toMatch(/\s/);
          expect(getAnalyzer(language).analyze(word), `${language}: ${word}`).toHaveLength(1);
        }
      }
    }
  });

  it('is lower case, and the first word of each side is the main one', () => {
    for (const concept of GLOSSARY_CONCEPTS) {
      for (const word of [...concept.ro, ...concept.en]) expect(word).toBe(word.toLowerCase());
    }
  });
});

describe('translateQuery: Romanian to English', () => {
  it('replaces the words it knows, in order, and drops the filler of the question', () => {
    expect(translateQuery('Cum se leagă Împărăția de Biserică?', 'ro', 'en')).toEqual({
      text: 'leaga kingdom church',
      extras: 'king ecclesiastical',
    });
    const repentance = translateQuery('De ce sunt necesare pocăința și credința?', 'ro', 'en')!;
    expect(repentance.text).toBe('necessary repentance faith');
    expect(repentance.extras).toContain('repent');
    expect(repentance.extras).toContain('believe');
  });

  it('meets every inflected form, with or without diacritics', () => {
    for (const form of ['Împărăția', 'împărăției', 'împărății', 'imparatiei', 'IMPĂRĂȚIA']) {
      expect(translateQuery(form, 'ro', 'en')!.text, form).toBe('kingdom');
    }
    for (const form of ['pocăința', 'pocăinței', 'pocainta', 'pocăință']) {
      expect(translateQuery(form, 'ro', 'en')!.text, form).toBe('repentance');
    }
    for (const form of ['viitoare', 'viitor', 'viitorul']) {
      expect(translateQuery(form, 'ro', 'en')!.text, form).toBe('future');
    }
  });

  it('gives the main equivalent in place and the others as extras', () => {
    expect(translateQuery('cerurilor', 'ro', 'en')).toEqual({ text: 'heaven', extras: '' });
    // "împărat" and "împărăție" share a stem: the king is an alternative of the kingdom.
    expect(translateQuery('împăratul', 'ro', 'en')).toEqual({ text: 'kingdom', extras: 'king' });
  });

  it('keeps names and words it does not know', () => {
    const result = translateQuery('Ce spune Vos despre Ierusalim și xyzzy?', 'ro', 'en')!;
    expect(result.text).toBe('vos jerusalem xyzzy');
  });

  it('translates people whose names are spelled differently', () => {
    expect(translateQuery('Augustin și Toma d’Aquino despre har', 'ro', 'en')!.text).toBe(
      'augustine thomas aquinas grace',
    );
  });

  it('returns nothing to search for when the question is only filler', () => {
    expect(translateQuery('Ce este asta și de ce?', 'ro', 'en')).toEqual({ text: '', extras: '' });
  });
});

describe('translateQuery: English to Romanian', () => {
  it('carries the question over and keeps one word per Romanian stem', () => {
    const result = translateQuery('What is the kingdom of heaven?', 'en', 'ro')!;
    expect(result.text).toBe('împărăție cer');
    expect(result.extras).toBe('ceresc cerească cerești'); // "heavenly", in the forms the stemmer keeps apart
    // The extras hold no two inflections of one stem: they add nothing for the stemmer.
    const stems = result.extras
      .split(' ')
      .filter(Boolean)
      .map((word) => getAnalyzer('ro').analyze(word)[0]);
    expect(new Set(stems).size).toBe(stems.length);
  });

  it('is the same table read the other way', () => {
    for (const [english, romanian] of [
      ['repentance', 'pocăință'],
      ['church', 'biserică'],
      ['faith', 'credință'],
      ['resurrection', 'înviere'],
      ['grace', 'har'],
    ] as const) {
      expect(translateQuery(english, 'en', 'ro')!.text, english).toBe(romanian);
      expect(translateQuery(romanian, 'ro', 'en')!.text, romanian).toBe(english);
    }
  });
});

describe('warmGlossary', () => {
  it('can be called any number of times and changes no answer', () => {
    const before = translateQuery('Împărăția cerurilor', 'ro', 'en');
    warmGlossary();
    warmGlossary();
    expect(translateQuery('Împărăția cerurilor', 'ro', 'en')).toEqual(before);
    expect(before).toEqual({ text: 'kingdom heaven', extras: 'king' });
  });
});

describe('translateQuery: other pairs', () => {
  it('knows nothing about a language that is not in the table, or about the same language twice', () => {
    expect(translateQuery('kingdom', 'en', 'en')).toBeNull();
    expect(translateQuery('kingdom', 'en', 'la')).toBeNull();
    expect(translateQuery('regnum', 'la', 'en')).toBeNull();
    expect(translateQuery('kingdom', 'en', 'ro-MD')).toBeNull(); // callers pass the base language
  });
});
