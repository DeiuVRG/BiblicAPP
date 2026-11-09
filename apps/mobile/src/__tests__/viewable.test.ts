import { paragraphInView } from '@/features/reader/viewable';

const paragraph = (id: string) => ({ kind: 'paragraph', paragraph: { id } });
const row = (first: string | null, second: string | null) => ({
  kind: 'row',
  row: { first: first ? { id: first } : null, second: second ? { id: second } : null },
});

describe('paragraphInView', () => {
  it('is the paragraph highest in view, whatever order the list reports its tokens in', () => {
    expect(
      paragraphInView(
        [
          { item: paragraph('p3'), index: 4 },
          { item: paragraph('p1'), index: 2 },
          { item: paragraph('p2'), index: 3 },
        ],
        true,
      ),
    ).toBe('p1');
  });

  it('skips what is not text: the lane labels and the heading cards', () => {
    expect(
      paragraphInView(
        [
          { item: { kind: 'labels' }, index: 0 },
          { item: { kind: 'cards' }, index: 1 },
          { item: row('a1', 'b1'), index: 2 },
        ],
        true,
      ),
    ).toBe('a1');
  });

  it('takes the side of the edition that drives the route in a lane row', () => {
    const tokens = [{ item: row('ro-1', 'en-1'), index: 2 }];
    expect(paragraphInView(tokens, true)).toBe('ro-1');
    expect(paragraphInView(tokens, false)).toBe('en-1');
  });

  it('moves on to the next row when the driving side of a row is a gap', () => {
    expect(
      paragraphInView(
        [
          { item: row(null, 'en-1'), index: 2 },
          { item: row('ro-2', 'en-2'), index: 3 },
        ],
        true,
      ),
    ).toBe('ro-2');
  });

  it('is null when nothing readable is in view, and ignores tokens without an index', () => {
    expect(paragraphInView([], true)).toBeNull();
    expect(paragraphInView([{ item: paragraph('p1'), index: null }], true)).toBeNull();
    expect(paragraphInView([{ item: undefined, index: 0 }], true)).toBeNull();
  });
});
