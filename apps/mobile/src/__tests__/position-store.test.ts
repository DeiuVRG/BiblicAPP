import {
  legacyPositionKey,
  loadPosition,
  positionKey,
  savePosition,
} from '@/reading/position-store';
import { PositionWriter } from '@/reading/position-writer';
import type { KeyValueStore } from '@/storage/key-value-store';
import { createMemoryStore } from '@/test-support/render';

const legacy = (sectionId: string, paragraphId: string | null = null) =>
  JSON.stringify({ sectionId, paragraphId, updatedAt: 1 });

describe('reading position per edition', () => {
  it('is saved under the id of the edition', async () => {
    const store = createMemoryStore();
    await savePosition(store, 'edition-ro', { sectionId: 'sec-1', paragraphId: 'par-4' });
    expect(positionKey('edition-ro')).toBe('biblioteca:position:v2:edition-ro');
    expect(JSON.parse(store.data.get(positionKey('edition-ro'))!)).toMatchObject({
      sectionId: 'sec-1',
      paragraphId: 'par-4',
    });
    expect(await loadPosition(store, 'edition-ro')).toMatchObject({
      sectionId: 'sec-1',
      paragraphId: 'par-4',
    });
  });

  it('is not shared between the editions of a work: a place in one text is nothing in another', async () => {
    const store = createMemoryStore();
    await savePosition(store, 'edition-ro', { sectionId: 'ro-3', paragraphId: null });
    expect(await loadPosition(store, 'edition-en')).toBeNull();
    await savePosition(store, 'edition-en', { sectionId: 'en-7', paragraphId: 'p9' });
    expect(await loadPosition(store, 'edition-ro')).toMatchObject({ sectionId: 'ro-3' });
    expect(await loadPosition(store, 'edition-en')).toMatchObject({ sectionId: 'en-7' });
  });

  it('is written by the position writer under the edition, not the work', async () => {
    const store = createMemoryStore();
    const writer = new PositionWriter(store, 'edition-en', 'en-2');
    writer.enable();
    await Promise.resolve();
    expect([...store.data.keys()]).toEqual([positionKey('edition-en')]);
  });

  it('never throws: unreadable, corrupt or wrongly shaped entries are no position', async () => {
    const broken: KeyValueStore = {
      getItem: async () => {
        throw new Error('storage unavailable');
      },
      setItem: async () => {
        throw new Error('storage unavailable');
      },
    };
    expect(await loadPosition(broken, 'e', 'w')).toBeNull();
    await expect(savePosition(broken, 'e', { sectionId: 's', paragraphId: null })).resolves.toBe(
      undefined,
    );

    const store = createMemoryStore({
      [positionKey('bad-json')]: '{not json',
      [positionKey('no-section')]: JSON.stringify({ paragraphId: 'p' }),
      [positionKey('empty-section')]: JSON.stringify({ sectionId: '' }),
      [positionKey('not-an-object')]: '"text"',
    });
    for (const id of ['bad-json', 'no-section', 'empty-section', 'not-an-object', 'absent']) {
      expect(await loadPosition(store, id)).toBeNull();
    }
    // A position without a paragraph or a time is still a position.
    store.data.set(positionKey('minimal'), JSON.stringify({ sectionId: 's1' }));
    expect(await loadPosition(store, 'minimal')).toEqual({
      sectionId: 's1',
      paragraphId: null,
      updatedAt: 0,
    });
  });
});

describe('migration of the position kept per work', () => {
  it('uses the old work-keyed entry as the position of the source edition, once', async () => {
    const store = createMemoryStore({ [legacyPositionKey('work-1')]: legacy('en-4', 'p12') });
    expect(legacyPositionKey('work-1')).toBe('biblioteca:position:v1:work-1');

    // The edition has no entry of its own yet: the old one is the fallback (source edition only).
    expect(await loadPosition(store, 'edition-en', 'work-1')).toEqual({
      sectionId: 'en-4',
      paragraphId: 'p12',
      updatedAt: 1,
    });
  });

  it('is not used for a translation: the old position was in the source text', async () => {
    const store = createMemoryStore({ [legacyPositionKey('work-1')]: legacy('en-4') });
    // The caller passes the work id for a source edition only.
    expect(await loadPosition(store, 'edition-ro')).toBeNull();
    expect(await loadPosition(store, 'edition-en')).toBeNull();
  });

  it('is used only for the work it was saved for', async () => {
    const store = createMemoryStore({ [legacyPositionKey('work-1')]: legacy('en-4') });
    expect(await loadPosition(store, 'edition-en', 'work-2')).toBeNull();
  });

  it('gives way to the position of the edition as soon as there is one', async () => {
    const store = createMemoryStore({ [legacyPositionKey('work-1')]: legacy('en-4') });
    // Opening a section of the source edition records it under the edition...
    const writer = new PositionWriter(store, 'edition-en', 'en-5');
    writer.enable();
    await Promise.resolve();
    // ...and from then on that is the position, whatever the old entry says.
    expect(await loadPosition(store, 'edition-en', 'work-1')).toMatchObject({ sectionId: 'en-5' });
    // The old entry is left alone (no data is lost; nothing reads it any more).
    expect(store.data.get(legacyPositionKey('work-1'))).toBe(legacy('en-4'));
  });

  it('prefers the entry of the edition even when the old one is newer', async () => {
    const store = createMemoryStore({
      [legacyPositionKey('work-1')]: JSON.stringify({ sectionId: 'en-9', updatedAt: 999 }),
      [positionKey('edition-en')]: JSON.stringify({ sectionId: 'en-2', updatedAt: 5 }),
    });
    expect(await loadPosition(store, 'edition-en', 'work-1')).toMatchObject({ sectionId: 'en-2' });
  });

  it('falls back to the old entry when the new one is corrupt, and to nothing when both are', async () => {
    const store = createMemoryStore({
      [legacyPositionKey('work-1')]: legacy('en-4'),
      [positionKey('edition-en')]: '{oops',
    });
    expect(await loadPosition(store, 'edition-en', 'work-1')).toMatchObject({ sectionId: 'en-4' });
    store.data.set(legacyPositionKey('work-1'), '{oops');
    expect(await loadPosition(store, 'edition-en', 'work-1')).toBeNull();
  });

  it('does not write anything while it reads', async () => {
    const store = createMemoryStore({ [legacyPositionKey('work-1')]: legacy('en-4') });
    await loadPosition(store, 'edition-en', 'work-1');
    expect([...store.data.keys()]).toEqual([legacyPositionKey('work-1')]);
  });
});
