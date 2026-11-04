import { foldText } from '@/search/fold';
import { splitByMatches } from '@/search/highlight';
import { scrollFraction, sectionDepths, sectionNeighbours, toPercent } from '@/reading/navigation';
import { PositionWriter } from '@/reading/position-writer';
import { loadPosition } from '@/reading/position-store';
import { sanitizeSettings } from '@/settings/sanitize';
import { DEFAULT_SETTINGS } from '@/settings/types';
import { formatLifespan, formatYear, languageName } from '@/i18n/labels';
import { createMemoryStore } from '@/test-support/render';

describe('search folding', () => {
  it('ignores case and Romanian diacritics, both comma-below and cedilla forms', () => {
    expect(foldText('ȘȚĂÂÎ șțăâî ŞŢ')).toBe('staai staai st');
    expect(foldText('Împărăția')).toBe('imparatia');
  });

  it('keeps the length so indexes map back onto the original text', () => {
    const text = 'Împărăția lui Dumnezeu – “Théologie”';
    expect(foldText(text)).toHaveLength(text.length);
  });

  it('splits text into highlighted parts', () => {
    expect(splitByMatches('Împărăția lui Dumnezeu', 'IMPARATIA')).toEqual([
      { text: 'Împărăția', match: true },
      { text: ' lui Dumnezeu', match: false },
    ]);
    expect(splitByMatches('abc', '')).toEqual([{ text: 'abc', match: false }]);
    expect(splitByMatches('aXbxc', 'x').filter((part) => part.match)).toHaveLength(2);
  });
});

describe('reading navigation', () => {
  const sections = [
    { id: 'a', ordinal: 0, kind: 'chapter' as const, heading: 'A' },
    { id: 'b', ordinal: 1, kind: 'section' as const, heading: 'B', parentId: 'a' },
    { id: 'c', ordinal: 2, kind: 'chapter' as const, heading: 'C' },
  ];

  it('finds neighbours and nesting', () => {
    expect(sectionNeighbours(sections, 'b')).toMatchObject({ index: 1, total: 3 });
    expect(sectionNeighbours(sections, 'b')?.previous?.id).toBe('a');
    expect(sectionNeighbours(sections, 'a')?.previous).toBeNull();
    expect(sectionNeighbours(sections, 'c')?.next).toBeNull();
    expect(sectionNeighbours(sections, 'x')).toBeNull();
    expect(sectionDepths(sections).get('b')).toBe(1);
  });

  it('computes progress', () => {
    expect(toPercent(0.456)).toBe(46);
    expect(toPercent(Number.NaN)).toBe(0);
    expect(scrollFraction(500, 1500, 500)).toBe(0.5);
    expect(scrollFraction(0, 300, 500)).toBe(1);
  });
});

describe('settings sanitising', () => {
  it('clamps and falls back to defaults', () => {
    expect(sanitizeSettings({ fontSize: 5, lineHeight: 9, theme: 'dark' })).toEqual({
      fontSize: 14,
      lineHeight: 2,
      theme: 'dark',
    });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ fontSize: '20', theme: 'x' })).toEqual(DEFAULT_SETTINGS);
  });
});

describe('PositionWriter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('writes nothing before enable, then debounces', async () => {
    const store = createMemoryStore();
    const writer = new PositionWriter(store, 'w', 's1');
    writer.track('p3');
    jest.advanceTimersByTime(2000);
    expect(store.data.size).toBe(0);

    writer.enable();
    expect(await loadPosition(store, 'w')).toMatchObject({ sectionId: 's1', paragraphId: 'p3' });

    writer.track('p4');
    writer.track('p5');
    expect(await loadPosition(store, 'w')).toMatchObject({ paragraphId: 'p3' });
    jest.advanceTimersByTime(600);
    expect(await loadPosition(store, 'w')).toMatchObject({ paragraphId: 'p5' });
  });

  it('flushes pending writes', async () => {
    const store = createMemoryStore();
    const writer = new PositionWriter(store, 'w', 's1');
    writer.enable();
    writer.track('p9');
    writer.flush();
    expect(await loadPosition(store, 'w')).toMatchObject({ paragraphId: 'p9' });
  });
});

describe('labels', () => {
  it('formats languages, years and lifespans in Romanian', () => {
    expect(languageName('grc')).toBe('Greaca veche');
    expect(languageName('xx-YY')).toBe('XX-YY');
    expect(formatYear(-5)).toBe('5 î.Hr.');
    expect(formatLifespan(1862, 1949)).toBe('1862–1949');
    expect(formatLifespan(null, null)).toBe('');
  });
});
