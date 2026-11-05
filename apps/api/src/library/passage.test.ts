import { describe, expect, it } from 'vitest';

import { loadRealLibrary, syntheticLibrary } from '../test-support';
import { Library } from './library';
import type { LibraryParagraph } from './library';
import type { LoadedPack } from './packs';
import { SECTION_PASSAGES, neighbours, retrieveWithPassage } from './passage';
import { retrieve } from './retrieve';

const library = loadRealLibrary();
const enEdition = [...library.editions.values()].find((edition) => edition.language === 'en')!;
const roEdition = [...library.editions.values()].find((edition) => edition.language === 'ro')!;

const english = (section: number, ordinal: number): LibraryParagraph =>
  enEdition.paragraphs.find((p) => p.sectionOrdinal === section && p.ordinal === ordinal)!;

/** The section of the source edition a passage belongs to, and its position in that section. */
function place(groupKey: string): string {
  const members = library.groups.get(groupKey)!;
  const source = members.find((m) => library.editions.get(m.editionId)?.kind === 'source')!;
  return `${source.sectionOrdinal}.${source.ordinal}`;
}

describe('the lookups the library keeps for passages', () => {
  it('finds a paragraph and a work by id, and a section by id in reading order', () => {
    const paragraph = english(3, 13);
    expect(library.paragraphsById.get(paragraph.id)).toBe(paragraph);
    expect([...library.worksById.keys()]).toEqual(library.works.map((entry) => entry.work.id));
    const section = library.sections.get(paragraph.sectionId)!;
    expect(section.map((p) => p.ordinal)).toEqual(section.map((_, i) => i));
    expect(section).toHaveLength(20);
  });

  it('gives every language version of a section one key, as it does for a passage', () => {
    const chapterOne = library.groups.get(english(0, 0).groupKey)!;
    expect(chapterOne.map((p) => p.language).sort()).toEqual(['en', 'ro']);
    expect(new Set(chapterOne.map((p) => p.sectionKey)).size).toBe(1);
    expect(english(0, 0).sectionKey).not.toBe(english(1, 0).sectionKey);
    const romanian = roEdition.paragraphs.find((p) => p.sectionOrdinal === 0 && p.ordinal === 3)!;
    expect(romanian.sectionKey).toBe(english(0, 3).sectionKey);
  });
});

describe('neighbours', () => {
  it('returns the paragraph before and the one after, inside the section', () => {
    const middle = neighbours(library, english(3, 13));
    expect(middle.map((p) => p.ordinal)).toEqual([12, 14]);
    expect(middle.every((p) => p.sectionId === english(3, 13).sectionId)).toBe(true);
  });

  it('has only one at the edges of a section, and none for a stranger', () => {
    expect(neighbours(library, english(3, 0)).map((p) => p.ordinal)).toEqual([1]);
    expect(neighbours(library, english(3, 19)).map((p) => p.ordinal)).toEqual([18]);
    const stranger = { ...english(3, 13) };
    expect(neighbours(library, stranger)).toEqual([]);
  });
});

describe('neighbours: headings are not passages', () => {
  const pack = {
    work: { id: 'W1', titleOrig: 'T', titleRo: 'T', author: { name: 'A', tradition: 'other' } },
    edition: { id: 'E1', kind: 'source', language: 'en', licence: { status: 'public-domain' } },
    sections: [{ id: 'S1', ordinal: 0, heading: 'One', kind: 'chapter' }],
    // Listed out of reading order on purpose.
    paragraphs: [
      { id: 'P3', kind: 'p', ordinal: 3, sectionId: 'S1', text: 'Third paragraph of text.' },
      { id: 'P0', kind: 'heading', ordinal: 0, sectionId: 'S1', text: 'A heading' },
      { id: 'P1', kind: 'p', ordinal: 1, sectionId: 'S1', text: 'First paragraph of text.' },
      { id: 'P2', kind: 'heading', ordinal: 2, sectionId: 'S1', text: 'Another heading' },
    ],
  };
  const small = new Library([
    { dir: '/x', manifest: { packId: 'p', revision: 1, version: '1.0.0' }, pack },
  ] as unknown as LoadedPack[]);

  it('keeps reading order whatever the order of the pack, and skips headings', () => {
    expect(small.sections.get('S1')!.map((p) => p.id)).toEqual(['P0', 'P1', 'P2', 'P3']);
    const first = small.paragraphsById.get('P1')!;
    expect(neighbours(small, first).map((p) => p.id)).toEqual(['P3']); // P0 and P2 are headings
    const last = small.paragraphsById.get('P3')!;
    expect(neighbours(small, last).map((p) => p.id)).toEqual(['P1']);
  });
});

describe('retrieveWithPassage', () => {
  it('puts the passage first and its neighbours next, also for a question with nothing to search', () => {
    const anchor = english(3, 13);
    const result = retrieveWithPassage(library, 'What does this mean?', anchor, { language: 'en' });
    expect(result.attached).toBe(true);
    expect(result.passages.map((p) => place(p.groupKey))).toEqual(['3.13', '3.12', '3.14']);
    // Nothing matched, so nothing scores: they are there for context.
    expect(result.passages.map((p) => p.score)).toEqual([0, 0, 0]);
    expect(result.passages[0]!.primary.id).toBe(anchor.id);
    // Without the passage the same question finds nothing at all.
    expect(retrieve(library, 'What does this mean?', { language: 'en' }).passages).toEqual([]);
  });

  it('puts the best matches of the section after the neighbours, then tops up from the whole library', () => {
    const anchor = english(3, 13);
    const result = retrieveWithPassage(
      library,
      'What does it mean to seek first his kingdom?',
      anchor,
      {
        language: 'en',
      },
    );
    const places = result.passages.map((p) => place(p.groupKey));
    expect(places.slice(0, 3)).toEqual(['3.13', '3.12', '3.14']);
    expect(result.passages[0]!.score).toBeGreaterThan(0); // it matches, so it scores
    const section = places.map((where) => Number(where.split('.')[0]));
    // Up to SECTION_PASSAGES come from the section of the passage...
    expect(section.slice(0, SECTION_PASSAGES).every((s) => s === 3)).toBe(true);
    expect(section.slice(0, SECTION_PASSAGES)).toHaveLength(SECTION_PASSAGES);
    // ...and the rest is the global top-up: the other chapters are still there.
    expect(section.slice(SECTION_PASSAGES).some((s) => s !== 3)).toBe(true);
    expect(result.passages).toHaveLength(10);
    expect(new Set(result.passages.map((p) => p.groupKey)).size).toBe(10);
    // Every passage of the global result that is not there already could still make the cut.
    const global = retrieve(library, 'What does it mean to seek first his kingdom?', {
      language: 'en',
    });
    const kept = new Set(result.passages.map((p) => p.groupKey));
    expect(global.passages.slice(0, 5).every((p) => kept.has(p.groupKey))).toBe(true);
  });

  it('does not fill the answer with a section that has nothing to say about the question', () => {
    const anchor = english(3, 13);
    const result = retrieveWithPassage(library, 'Why is repentance needed?', anchor, {
      language: 'en',
    });
    const places = result.passages.map((p) => place(p.groupKey));
    expect(places.slice(0, 3)).toEqual(['3.13', '3.12', '3.14']);
    // Whatever the section adds beyond the passage and its neighbours must score at least 15 % of
    // the best passage of the library; the rest of the answer is the chapter on repentance. The
    // premise does not depend on how much of the section the Romanian edition has aligned.
    const best = Math.max(...result.passages.map((p) => p.score));
    const rest = result.passages.slice(3);
    for (const passage of rest.filter((p) => place(p.groupKey).startsWith('3.'))) {
      expect(passage.score).toBeGreaterThanOrEqual(best * 0.15);
    }
    expect(rest.filter((p) => place(p.groupKey).startsWith('9.')).length).toBeGreaterThanOrEqual(3);
    expect(result.passages).toHaveLength(10);
  });

  it('respects the limit and the number of passages allowed from the section', () => {
    const anchor = english(3, 13);
    const question = 'What does it mean to seek first his kingdom?';
    expect(
      retrieveWithPassage(library, question, anchor, { language: 'en', limit: 4 }).passages,
    ).toHaveLength(4);
    const narrow = retrieveWithPassage(library, question, anchor, {
      language: 'en',
      sectionPassages: 1,
    });
    // Only the passage itself is reserved: its neighbours, which match nothing, are not there.
    const places = narrow.passages.map((p) => place(p.groupKey));
    expect(places[0]).toBe('3.13');
    expect(places).not.toContain('3.12');
    expect(places).not.toContain('3.14');
    expect(places).toHaveLength(10);
    expect(
      retrieveWithPassage(library, question, anchor, { language: 'en', limit: 1 }).passages,
    ).toHaveLength(1);
  });

  it('shows the passage in the asked language, with the other version attached', () => {
    const anchor = english(0, 2);
    const inRomanian = retrieveWithPassage(library, 'Ce înseamnă acest pasaj?', anchor, {
      language: 'ro',
    });
    const first = inRomanian.passages[0]!;
    expect(place(first.groupKey)).toBe('0.2');
    expect(first.primary.language).toBe('ro');
    expect(first.aligned.map((p) => p.language)).toEqual(['en']);
    expect(first.aligned[0]!.id).toBe(anchor.id);
    // The same passage asked about in English, naming the Romanian paragraph: the English one is shown.
    const romanian = roEdition.paragraphs.find((p) => p.passageId === anchor.id)!;
    const inEnglish = retrieveWithPassage(library, 'What does this mean?', romanian, {
      language: 'en',
    });
    expect(inEnglish.passages[0]!.primary.id).toBe(anchor.id);
    expect(inEnglish.passages[0]!.aligned.map((p) => p.id)).toEqual([romanian.id]);
  });

  it('keeps to the editions the request allows, also when the passage was named in another one', () => {
    const anchor = english(0, 2);
    const onlyRomanian = retrieveWithPassage(library, 'Ce înseamnă acest pasaj?', anchor, {
      language: 'ro',
      editionIds: new Set([roEdition.editionId]),
    });
    expect(onlyRomanian.attached).toBe(true);
    expect(onlyRomanian.passages.length).toBeGreaterThan(0);
    for (const found of onlyRomanian.passages) {
      expect(found.primary.editionId).toBe(roEdition.editionId);
      expect(found.aligned).toEqual([]);
    }
    expect(onlyRomanian.passages[0]!.primary.passageId).toBe(anchor.id);
  });

  it('attaches nothing when no version of the passage is allowed, and falls back to plain retrieval', () => {
    // EN-P3 of the small library is not translated, so the Romanian edition cannot show it.
    const small = syntheticLibrary();
    const question = 'the supremacy of God in saving power';
    const result = retrieveWithPassage(small, question, small.paragraphsById.get('EN-P3')!, {
      language: 'en',
      editionIds: new Set(['ED-RO']),
    });
    expect(result.attached).toBe(false);
    const plain = retrieve(small, question, { language: 'en', editionIds: new Set(['ED-RO']) });
    expect(result.passages.map((p) => p.groupKey)).toEqual(plain.passages.map((p) => p.groupKey));
    for (const found of result.passages) expect(found.primary.editionId).toBe('ED-RO');
    // With the English edition allowed the same passage is attached, first.
    const allowed = retrieveWithPassage(small, question, small.paragraphsById.get('EN-P3')!, {
      language: 'en',
    });
    expect(allowed.attached).toBe(true);
    expect(allowed.passages[0]!.primary.id).toBe('EN-P3');
  });

  it('borrows the earlier question for a follow-up, like plain retrieval', () => {
    const anchor = english(8, 5);
    const result = retrieveWithPassage(library, 'And what else?', anchor, {
      language: 'en',
      history: ['What is the church?'],
    });
    expect(result.usedHistory).toBe(true);
    expect(result.passages.length).toBeGreaterThan(3);
  });

  it('is a plain retrieval for the rest: same query text, same references, same languages', () => {
    const question = 'How does Matthew 16:18 speak of the church?';
    const plain = retrieve(library, question, { language: 'en' });
    const attached = retrieveWithPassage(library, question, english(8, 0), { language: 'en' });
    expect(attached.queryText).toBe(plain.queryText);
    expect(attached.refs).toEqual(plain.refs);
    expect([...attached.queries.entries()]).toEqual([...plain.queries.entries()]);
  });
});
