import type { Section } from '@biblioteca/shared';

import {
  branchIds,
  buildOutline,
  isHierarchical,
  matchesHeading,
  outlineIndent,
  revealing,
  visibleOutline,
} from '@/features/reader/outline-model';

const section = (id: string, heading: string, parentId?: string): Section => ({
  id,
  ordinal: 0,
  kind: 'section',
  heading,
  ...(parentId === undefined ? null : { parentId }),
});

const flat = [
  section('a', 'I. Introducere'),
  section('b', 'II. Împărăția'),
  section('c', 'III. Biserica'),
];
const tree = [
  section('p', 'Prolog'),
  section('c1', 'Capitolul 1'),
  section('c1a', 'Articolul 1', 'c1'),
  section('c1b', 'Articolul 2', 'c1'),
  section('c1b1', 'Alineatul 1', 'c1b'),
  section('c2', 'Capitolul 2'),
];

describe('buildOutline', () => {
  it('keeps the order and gives a flat outline depth 0 and no branches', () => {
    const entries = buildOutline(flat);
    expect(entries.map((entry) => [entry.section.id, entry.depth, entry.hasChildren])).toEqual([
      ['a', 0, false],
      ['b', 0, false],
      ['c', 0, false],
    ]);
    expect(isHierarchical(entries)).toBe(false);
  });

  it('works out the depth, the ancestors and the branches of a tree', () => {
    const entries = buildOutline(tree);
    expect(entries.map((entry) => [entry.section.id, entry.depth])).toEqual([
      ['p', 0],
      ['c1', 0],
      ['c1a', 1],
      ['c1b', 1],
      ['c1b1', 2],
      ['c2', 0],
    ]);
    expect(entries[4]!.ancestors).toEqual(['c1', 'c1b']);
    expect(branchIds(entries)).toEqual(['c1', 'c1b']);
    expect(isHierarchical(entries)).toBe(true);
  });

  it('survives a parent that does not exist and a cycle', () => {
    const odd = [section('x', 'X', 'nowhere'), section('y', 'Y', 'z'), section('z', 'Z', 'y')];
    const entries = buildOutline(odd);
    expect(entries[0]).toMatchObject({ depth: 0, ancestors: [] });
    expect(entries.every((entry) => entry.depth <= 6)).toBe(true);
  });
});

describe('visibleOutline', () => {
  const entries = buildOutline(tree);

  it('lists the top level when every branch is shut, and what an open branch holds', () => {
    expect(visibleOutline(entries, new Set(), '').map((e) => e.section.id)).toEqual([
      'p',
      'c1',
      'c2',
    ]);
    expect(visibleOutline(entries, new Set(['c1']), '').map((e) => e.section.id)).toEqual([
      'p',
      'c1',
      'c1a',
      'c1b',
      'c2',
    ]);
    // A branch inside a shut one stays hidden.
    expect(visibleOutline(entries, new Set(['c1b']), '').map((e) => e.section.id)).toEqual([
      'p',
      'c1',
      'c2',
    ]);
  });

  it('filters by the words of a search, flat, wherever they are, ignoring accents and case', () => {
    const found = visibleOutline(entries, new Set(), 'ARTICOLUL');
    expect(found.map((e) => e.section.id)).toEqual(['c1a', 'c1b']);
    expect(matchesHeading('Împărăția lui Dumnezeu', 'imparatia')).toBe(true);
    expect(matchesHeading('Împărăția lui Dumnezeu', 'biserica')).toBe(false);
    expect(visibleOutline(entries, new Set(), '  ').length).toBe(3);
    expect(visibleOutline(entries, new Set(), 'nimic')).toEqual([]);
  });
});

describe('revealing', () => {
  it('opens the branches above a section', () => {
    const entries = buildOutline(tree);
    expect([...revealing(entries, new Set(), 'c1b1')].sort()).toEqual(['c1', 'c1b']);
    expect([...revealing(entries, new Set(['c2']), 'p')]).toEqual(['c2']);
    expect([...revealing(entries, new Set(), 'unknown')]).toEqual([]);
  });
});

describe('outlineIndent', () => {
  it('is 8, 21.6, 35.2 and 0.85 rem further for each level after that', () => {
    expect([0, 1, 2].map(outlineIndent)).toEqual([8, 21.6, 35.2]);
    expect(outlineIndent(3)).toBe(48.8);
    expect(outlineIndent(4)).toBe(62.4);
  });
});
