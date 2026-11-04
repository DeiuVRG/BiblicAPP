import { isPartialEdition, orderEditions, pickPrimaryEdition } from '@/content/editions';
import { originalTitleToShow, workTitle } from '@/content/titles';
import type { EditionSummary } from '@/content/types';

type Fields = Pick<EditionSummary, 'editionId' | 'language' | 'kind'>;
const ro: Fields = { editionId: 'ro', language: 'ro', kind: 'translation' };
const en: Fields = { editionId: 'en', language: 'en', kind: 'source' };
const enTranslation: Fields = { editionId: 'en-t', language: 'en', kind: 'translation' };
const la: Fields = { editionId: 'la', language: 'la', kind: 'source' };
const de: Fields = { editionId: 'de', language: 'de', kind: 'translation' };
const ids = (list: readonly Fields[]) => list.map((edition) => edition.editionId);

describe('orderEditions', () => {
  it('puts translations into Romanian first, then the source, then the others', () => {
    expect(ids(orderEditions([en, ro]))).toEqual(['ro', 'en']);
    expect(ids(orderEditions([de, enTranslation, la, ro]))).toEqual(['ro', 'la', 'de', 'en-t']);
  });

  it('keeps the order of editions of equal rank, whatever the engine does', () => {
    expect(ids(orderEditions([de, enTranslation]))).toEqual(['de', 'en-t']);
    expect(ids(orderEditions([enTranslation, de]))).toEqual(['en-t', 'de']);
    const many = Array.from({ length: 40 }, (_, index) => ({
      editionId: `x${index}`,
      language: 'fr',
      kind: 'translation' as const,
    }));
    expect(ids(orderEditions(many))).toEqual(ids(many));
  });

  it('does not change the list it is given', () => {
    const list = [en, ro];
    orderEditions(list);
    expect(ids(list)).toEqual(['en', 'ro']);
    expect(orderEditions([])).toEqual([]);
  });
});

describe('pickPrimaryEdition', () => {
  it('takes the installed edition in the reading language', () => {
    expect(pickPrimaryEdition([ro, en], 'ro')?.editionId).toBe('ro');
    expect(pickPrimaryEdition([ro, en], 'en')?.editionId).toBe('en');
    expect(pickPrimaryEdition([ro, la, enTranslation], 'en')?.editionId).toBe('en-t');
    expect(pickPrimaryEdition([ro, la, enTranslation], 'ro')?.editionId).toBe('ro');
  });

  it('falls back from the reading language to ro, then en, then the source edition', () => {
    // English reader, no English edition: Romanian comes next.
    expect(pickPrimaryEdition([ro, la], 'en')?.editionId).toBe('ro');
    // Romanian reader, no Romanian edition: English comes next.
    expect(pickPrimaryEdition([en], 'ro')?.editionId).toBe('en');
    expect(pickPrimaryEdition([la, enTranslation], 'ro')?.editionId).toBe('en-t');
    // Neither: the source edition, then whatever is there.
    expect(pickPrimaryEdition([de, la], 'ro')?.editionId).toBe('la');
    expect(pickPrimaryEdition([de, la], 'en')?.editionId).toBe('la');
    expect(pickPrimaryEdition([de], 'ro')?.editionId).toBe('de');
  });

  it('takes the first of two editions in one language, and nothing from nothing', () => {
    expect(pickPrimaryEdition([enTranslation, en], 'en')?.editionId).toBe('en-t');
    expect(pickPrimaryEdition([], 'ro')).toBeUndefined();
  });
});

describe('editions whose language code has a region', () => {
  // BCP 47 codes: "ro-MD" is Romanian and "en-GB" is English, whatever the case or the separator.
  const roMd: Fields = { editionId: 'ro-md', language: 'ro-MD', kind: 'translation' };
  const roUnderscore: Fields = { editionId: 'ro-ro', language: 'RO_ro', kind: 'translation' };
  const enGb: Fields = { editionId: 'en-gb', language: 'en-GB', kind: 'source' };
  const enGbTranslation: Fields = { editionId: 'en-gb-t', language: 'en-gb', kind: 'translation' };

  it('orders a translation into ro-MD like a translation into Romanian', () => {
    expect(ids(orderEditions([enGb, roMd]))).toEqual(['ro-md', 'en-gb']);
    expect(ids(orderEditions([la, roUnderscore]))).toEqual(['ro-ro', 'la']);
    // Only a translation into Romanian goes first: a Romanian source keeps the rank of a source.
    const romanianSource: Fields = { editionId: 'ro-src', language: 'ro-RO', kind: 'source' };
    expect(ids(orderEditions([de, romanianSource, roMd]))).toEqual(['ro-md', 'ro-src', 'de']);
  });

  it('takes the edition in the reading language whatever its region', () => {
    expect(pickPrimaryEdition([roMd, enGb], 'ro')?.editionId).toBe('ro-md');
    expect(pickPrimaryEdition([roMd, enGb], 'en')?.editionId).toBe('en-gb');
    expect(pickPrimaryEdition([la, roMd, enGbTranslation], 'en')?.editionId).toBe('en-gb-t');
  });

  it('falls back from the reading language to ro, then en, by language too', () => {
    // English reader, no English edition: the ro-MD translation comes before the source.
    expect(pickPrimaryEdition([la, roMd], 'en')?.editionId).toBe('ro-md');
    // Romanian reader, no Romanian edition: the en-GB translation comes before the source.
    expect(pickPrimaryEdition([la, enGbTranslation], 'ro')?.editionId).toBe('en-gb-t');
  });
});

describe('isPartialEdition', () => {
  const source = { editionId: 'en', sectionCount: 11 };
  // `null` is a translation that names no source edition.
  const translation = (sectionCount: number, sourceEditionId: string | null = 'en') => ({
    kind: 'translation' as const,
    sourceEditionId: sourceEditionId ?? undefined,
    sectionCount,
  });

  it('is true for a translation with fewer sections than its source edition', () => {
    expect(isPartialEdition(translation(1), [source])).toBe(true);
    expect(isPartialEdition(translation(10), [source])).toBe(true);
  });

  it('is false for a translation with as many sections', () => {
    expect(isPartialEdition(translation(11), [source])).toBe(false);
    expect(isPartialEdition(translation(12), [source])).toBe(false);
  });

  it('is false without the source edition to compare with', () => {
    expect(isPartialEdition(translation(1), [])).toBe(false);
    expect(isPartialEdition(translation(1, 'another'), [source])).toBe(false);
    expect(isPartialEdition(translation(1, null), [source])).toBe(false);
  });

  it('is false for a source edition', () => {
    expect(
      isPartialEdition({ kind: 'source', sourceEditionId: undefined, sectionCount: 1 }, [source]),
    ).toBe(false);
  });
});

describe('workTitle', () => {
  const vos = {
    titleRo: 'Învățătura lui Isus',
    titleOrig: 'The Teaching of Jesus',
    languageOrig: 'en',
  };
  const augustine = {
    titleRo: 'Despre spirit și literă',
    titleEn: 'On the Spirit and the Letter',
    titleOrig: 'De spiritu et littera',
    languageOrig: 'la',
  };

  it('is titleRo for a Romanian reader', () => {
    expect(workTitle(vos, 'ro')).toBe('Învățătura lui Isus');
    expect(workTitle(augustine, 'ro')).toBe('Despre spirit și literă');
  });

  it('is the original title for an English reader when the original is English', () => {
    expect(workTitle(vos, 'en')).toBe('The Teaching of Jesus');
    expect(workTitle({ ...vos, languageOrig: 'en-GB' }, 'en')).toBe('The Teaching of Jesus');
  });

  it('is titleEn for an English reader when the work has one', () => {
    expect(workTitle(augustine, 'en')).toBe('On the Spirit and the Letter');
    // titleEn wins over an English original title.
    expect(workTitle({ ...vos, titleEn: 'Another English title' }, 'en')).toBe(
      'Another English title',
    );
  });

  it('falls back to titleRo when there is no English title and the original is not English', () => {
    expect(workTitle({ ...augustine, titleEn: undefined }, 'en')).toBe('Despre spirit și literă');
    expect(workTitle({ ...augustine, titleEn: '  ' }, 'en')).toBe('Despre spirit și literă');
    // Old and Middle English are not English: their titles are not for a modern reader.
    expect(workTitle({ ...vos, languageOrig: 'ang' }, 'en')).toBe('Învățătura lui Isus');
    expect(workTitle({ ...vos, languageOrig: 'enm' }, 'en')).toBe('Învățătura lui Isus');
  });
});

describe('originalTitleToShow', () => {
  const work = { titleRo: 'Titlu', titleOrig: 'Title', languageOrig: 'en' };

  it('is the original title when it differs from the title shown', () => {
    expect(originalTitleToShow(work, 'Titlu')).toBe('Title');
  });

  it('is nothing when the title shown is the original, or there is no original title', () => {
    expect(originalTitleToShow(work, 'Title')).toBeNull();
    expect(originalTitleToShow({ ...work, titleOrig: '  ' }, 'Titlu')).toBeNull();
  });
});
