import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { UsageError } from '../lib/usage-error';
import {
  SOURCE_LANGUAGES,
  TARGET_LANGUAGES,
  foldGreek,
  headingFieldFor,
  isSourceLanguage,
  isTargetLanguage,
  lengthBands,
  primaryLanguage,
  residueSpec,
  targetSpec,
} from './languages';

describe('languages', () => {
  it('knows the two target and the three source languages', () => {
    expect(TARGET_LANGUAGES).toEqual(['ro', 'en']);
    expect(SOURCE_LANGUAGES).toEqual(['en', 'la', 'grc']);
    expect(isTargetLanguage('ro')).toBe(true);
    expect(isTargetLanguage('en')).toBe(true);
    expect(isTargetLanguage('la')).toBe(false);
    expect(isTargetLanguage('RO')).toBe(false);
    expect(isSourceLanguage('grc')).toBe(true);
    expect(isSourceLanguage('en-GB')).toBe(true);
    expect(isSourceLanguage('de')).toBe(false);
    expect(primaryLanguage('en-GB')).toBe('en');
    expect(primaryLanguage('GRC')).toBe('grc');
  });

  it('gives each target its heading field, typography and notation', () => {
    expect(targetSpec('ro')).toEqual({
      code: 'ro',
      headingField: 'headingRo',
      cedilla: true,
      quotes: 'ro',
      notation: 'ro',
    });
    expect(targetSpec('en')).toEqual({
      code: 'en',
      headingField: 'headingEn',
      cedilla: false,
      quotes: 'en',
      notation: 'en',
    });
    expect(headingFieldFor('en')).toBe('headingEn');
    expect(headingFieldFor('ro')).toBe('headingRo');
  });

  it('reports an unsupported target language as a usage error', () => {
    expect(() => targetSpec('fr')).toThrow(UsageError);
    expect(() => targetSpec('fr')).toThrow(
      /"fr" is not a supported target language \(supported: ro, en\)/,
    );
    expect(() => headingFieldFor('la')).toThrow(UsageError);
  });
});

describe('foldGreek', () => {
  it('drops accents, breathings, the iota subscript and the final sigma, and nothing else', () => {
    expect(foldGreek('Καὶ')).toBe('και');
    expect(foldGreek('τοῦ')).toBe('του');
    expect(foldGreek('ἐκκλησίας')).toBe('εκκλησιασ');
    expect(foldGreek('τῇ')).toBe('τη');
    expect(foldGreek('ὁμοούσιον')).toBe('ομοουσιον');
    // already folded text, Latin letters and the empty string are left alone
    expect(foldGreek('και')).toBe('και');
    expect(foldGreek('Kai')).toBe('kai');
    expect(foldGreek('')).toBe('');
  });

  it('gives the same result for the composed and the decomposed spelling', () => {
    const word = 'διὰ';
    expect(foldGreek(word.normalize('NFD'))).toBe(foldGreek(word.normalize('NFC')));
    // U+1F71 (alpha with oxia) is a singleton: NFC turns it into U+03AC, both fold to alpha
    const oxia = String.fromCodePoint(0x1f71);
    const tonos = String.fromCodePoint(0x03ac);
    expect(oxia.normalize('NFC')).toBe(tonos);
    expect(foldGreek(oxia)).toBe(String.fromCodePoint(0x03b1));
    expect(foldGreek(tonos)).toBe(String.fromCodePoint(0x03b1));
  });
});

describe('residueSpec', () => {
  it('uses the English list for English sources, in a Romanian text as it always did', () => {
    const spec = residueSpec('en', 'ro');
    expect(spec).toMatchObject({ code: 'RESIDUE_EN', name: 'English', script: 'latin' });
    expect(spec?.words.size).toBe(32);
    for (const word of ['the', 'and', 'of', 'which', 'however', 'is']) {
      expect(spec?.words.has(word), word).toBe(true);
    }
  });

  it('uses the Latin list of the specification for Latin sources', () => {
    const spec = residueSpec('la', 'ro');
    expect(spec).toMatchObject({ code: 'RESIDUE_LA', name: 'Latin', script: 'latin' });
    const listed = 'et in ad non quod est sed enim autem cum ut qui quae ac atque nec neque'.split(
      ' ',
    );
    expect([...(residueSpec('la', 'ro')?.words ?? [])].length).toBeLessThan(listed.length);
    const all = new Set([
      ...(residueSpec('la', 'en')?.words ?? []),
      ...(residueSpec('la', 'ro')?.words ?? []),
    ]);
    // every word of the list is counted in at least one target language
    for (const word of listed)
      expect(
        all.has(word) || ['in', 'ad', 'et', 'non', 'cum', 'est', 'ac'].includes(word),
        word,
      ).toBe(true);
  });

  it('leaves out of the Latin list the words that are words of the target language', () => {
    const english = residueSpec('la', 'en')?.words ?? new Set<string>();
    for (const word of ['in', 'ad', 'et', 'non']) expect(english.has(word), word).toBe(false);
    for (const word of [
      'est',
      'sed',
      'enim',
      'autem',
      'cum',
      'ut',
      'qui',
      'quae',
      'ac',
      'atque',
      'nec',
      'neque',
      'quod',
    ]) {
      expect(english.has(word), word).toBe(true);
    }
    const romanian = residueSpec('la', 'ro')?.words ?? new Set<string>();
    for (const word of ['cum', 'est', 'ac', 'in', 'non'])
      expect(romanian.has(word), word).toBe(false);
    for (const word of [
      'et',
      'ad',
      'sed',
      'enim',
      'autem',
      'ut',
      'qui',
      'quae',
      'atque',
      'nec',
      'neque',
      'quod',
    ]) {
      expect(romanian.has(word), word).toBe(true);
    }
  });

  it('uses the folded Greek list for Greek sources', () => {
    const spec = residueSpec('grc', 'en');
    expect(spec).toMatchObject({ code: 'RESIDUE_GRC', name: 'Greek', script: 'greek' });
    expect([...(spec?.words ?? [])].sort()).toEqual(
      ['δια', 'εισ', 'εν', 'και', 'του', 'τησ', 'τον', 'την'].sort(),
    );
    expect(residueSpec('grc', 'ro')?.words).toEqual(spec?.words);
  });

  it('has no list for other source languages, or when source and target are the same', () => {
    expect(residueSpec('de', 'ro')).toBeNull();
    expect(residueSpec('en', 'en')).toBeNull();
    expect(residueSpec('en-GB', 'ro')?.code).toBe('RESIDUE_EN');
  });

  it('is built once per pair of languages and has the Greek list in NFC in the source file', () => {
    expect(residueSpec('la', 'en')).toBe(residueSpec('la', 'en'));
    expect(residueSpec('la', 'en')).not.toBe(residueSpec('la', 'ro'));
    // the Greek words are written with precomposed polytonic letters, as the texts are
    const source = fs.readFileSync(new URL('./languages.ts', import.meta.url), 'utf8');
    expect(source).toBe(source.normalize('NFC'));
    for (const word of ['καὶ', 'τοῦ', 'τῆς', 'τὸν', 'τὴν', 'ἐν', 'εἰς', 'διὰ']) {
      expect(source).toContain(`'${word}'`);
      expect(word).toBe(word.normalize('NFC'));
    }
  });

  it('keeps every word of every list in NFC, lower case, without spaces', () => {
    for (const source of ['en', 'la', 'grc']) {
      for (const target of ['ro', 'en']) {
        for (const word of residueSpec(source, target)?.words ?? []) {
          expect(word).toBe(word.normalize('NFC'));
          expect(word).toBe(word.toLowerCase());
          expect(word).toMatch(/^\p{L}+$/u);
        }
      }
    }
  });
});

describe('lengthBands', () => {
  it('keeps the bands of the specification for English to Romanian', () => {
    expect(lengthBands('en', 'ro')).toEqual({
      majorLow: 0.75,
      majorHigh: 1.6,
      minorLow: 0.85,
      minorHigh: 1.45,
    });
    expect(lengthBands('en-US', 'ro')).toEqual(lengthBands('en', 'ro'));
  });

  it('has wider bands for Latin, which is compact: 1.3 to 1.6 is normal, 1.25 is what was measured', () => {
    for (const target of ['en', 'ro']) {
      const bands = lengthBands('la', target);
      // the measured ratios (1.25 to 1.28) and the expected range (1.3 to 1.6) are fine
      for (const ratio of [1.25, 1.278, 1.3, 1.45, 1.6]) {
        expect(ratio, `${target} ${ratio}`).toBeGreaterThanOrEqual(bands.minorLow);
        expect(ratio, `${target} ${ratio}`).toBeLessThanOrEqual(bands.minorHigh);
      }
      // a Latin paragraph rendered in fewer characters than it has is truncated
      expect(bands.majorLow).toBeGreaterThanOrEqual(1.0);
      expect(bands.majorLow).toBeLessThan(bands.minorLow);
      expect(bands.majorHigh).toBeGreaterThan(bands.minorHigh);
      expect(bands.minorHigh).toBeGreaterThan(lengthBands('en', 'ro').minorHigh);
    }
  });

  it('keeps the bands of the pipeline for Greek (as long as English), and for other pairs', () => {
    for (const target of ['en', 'ro']) {
      expect(lengthBands('grc', target)).toEqual(lengthBands('en', 'ro'));
      // the Creed of Constantinople, article by article: Greek to English 1.03 to 1.12, to Romanian 0.99 to 1.27
      for (const ratio of [0.99, 1.03, 1.12, 1.27]) {
        expect(ratio).toBeGreaterThanOrEqual(lengthBands('grc', target).minorLow);
        expect(ratio).toBeLessThanOrEqual(lengthBands('grc', target).minorHigh);
      }
    }
    expect(lengthBands('de', 'ro')).toEqual(lengthBands('en', 'ro'));
    expect(lengthBands('en', 'en')).toEqual(lengthBands('en', 'ro'));
  });
});
