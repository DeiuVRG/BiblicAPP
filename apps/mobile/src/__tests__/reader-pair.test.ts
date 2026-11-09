import type { EditionSummary } from '@/content/types';
import {
  editionToken,
  initialPair,
  languageChoices,
  pairChoices,
  resolvePair,
} from '@/features/reader/pair';

const edition = (
  editionId: string,
  language: string,
  kind: EditionSummary['kind'],
): EditionSummary => ({
  editionId,
  packId: `p-${editionId}`,
  language,
  kind,
  licenceStatus: 'public-domain',
  licenceNote: '',
  sectionCount: 3,
});

const vos = [edition('ro', 'ro', 'translation'), edition('en', 'en', 'source')];
const latin = [
  edition('la', 'la', 'source'),
  edition('en', 'en', 'translation'),
  edition('ro', 'ro', 'translation'),
];

describe('editionToken', () => {
  it('is the language of an edition in one of the two reading languages, "orig" for any other source', () => {
    expect(editionToken({ language: 'ro', kind: 'translation' })).toBe('ro');
    expect(editionToken({ language: 'en-GB', kind: 'source' })).toBe('en');
    expect(editionToken({ language: 'la', kind: 'source' })).toBe('orig');
    expect(editionToken({ language: 'grc', kind: 'source' })).toBe('orig');
  });
});

describe('languageChoices: the language control', () => {
  it('offers RO and EN for Vos, whose English is the original', () => {
    expect(languageChoices(vos).map((choice) => [choice.token, choice.code])).toEqual([
      ['ro', 'RO'],
      ['en', 'EN'],
    ]);
  });

  it('offers RO, EN and Original for a Latin work, in that order whatever the order of the editions', () => {
    expect(languageChoices(latin).map((choice) => [choice.token, choice.code])).toEqual([
      ['ro', 'RO'],
      ['en', 'EN'],
      ['orig', 'Original'],
    ]);
  });

  it('has one choice for a work with one edition', () => {
    expect(languageChoices([vos[1]!])).toHaveLength(1);
  });
});

describe('pairChoices: the menu of the two lanes', () => {
  it('has one pair for two editions, the reading language first', () => {
    expect(pairChoices(vos, 'ro').map((choice) => choice.pair)).toEqual(['ro+en']);
    expect(pairChoices(vos, 'en').map((choice) => choice.pair)).toEqual(['en+ro']);
  });

  it('has Română + English, Română + Original and English + Original for three editions', () => {
    expect(pairChoices(latin, 'ro').map((choice) => choice.pair)).toEqual([
      'ro+en',
      'ro+orig',
      'en+orig',
    ]);
    expect(pairChoices(latin, 'en').map((choice) => choice.pair)).toEqual([
      'en+ro',
      'en+orig',
      'ro+orig',
    ]);
  });

  it('has none for a work with one edition', () => {
    expect(pairChoices([vos[0]!], 'ro')).toEqual([]);
  });
});

describe('resolvePair', () => {
  it('finds the two editions a pair names', () => {
    const resolved = resolvePair('ro+en', vos)!;
    expect(resolved.first.editionId).toBe('ro');
    expect(resolved.second.editionId).toBe('en');
    expect(resolvePair('en+ro', vos)?.first.editionId).toBe('en');
    expect(resolvePair('ro+orig', latin)?.second.editionId).toBe('la');
  });

  it('is null for a malformed pair, a pair of one edition and an edition that is not installed', () => {
    expect(resolvePair(null, vos)).toBeNull();
    expect(resolvePair('ro', vos)).toBeNull();
    expect(resolvePair('ro+ro', vos)).toBeNull();
    expect(resolvePair('ro+la', vos)).toBeNull();
    expect(resolvePair('ro+orig', vos)).toBeNull(); // Vos has no original in a third language
  });
});

describe('initialPair', () => {
  it('prefers the pair remembered for the work, then the default of the settings, then the first on offer', () => {
    expect(initialPair(latin, 'ro', 'en+orig', 'ro+orig')).toBe('en+orig');
    expect(initialPair(latin, 'ro', null, 'ro+orig')).toBe('ro+orig');
    expect(initialPair(latin, 'ro', null, null)).toBe('ro+en');
    expect(initialPair(latin, 'en', null, null)).toBe('en+ro');
  });

  it('skips a pair the work cannot show', () => {
    expect(initialPair(vos, 'ro', 'ro+orig', 'en+orig')).toBe('ro+en');
  });

  it('is null for a work with one edition', () => {
    expect(initialPair([vos[0]!], 'ro', 'ro+en', null)).toBeNull();
  });
});
