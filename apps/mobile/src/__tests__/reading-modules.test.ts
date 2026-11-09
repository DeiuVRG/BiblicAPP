import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import { en } from '@/i18n/en';
import { ro } from '@/i18n/ro';
import {
  BOOKMARKS_KEY,
  MAX_BOOKMARKS,
  addBookmark,
  isBookmarked,
  loadBookmarks,
  removeBookmark,
} from '@/reading/bookmarks-store';
import { citationEdition, citationLine, textWithCitation } from '@/reading/citation';
import { copyText } from '@/reading/clipboard';
import { loadPair, pairKey, savePair } from '@/reading/pair-store';
import { getWorkSession, patchWorkSession, resetReaderSessions } from '@/reading/reader-session';
import { SITE_URL_FALLBACK, readUrl, siteUrl } from '@/reading/site-url';
import { createMemoryStore } from '@/test-support/render';
import type { KeyValueStore } from '@/storage/key-value-store';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

const setString = Clipboard.setStringAsync as jest.Mock;

/** A store that cannot be read or written (a full disk, a private window). */
const brokenStore: KeyValueStore = {
  getItem: async () => {
    throw new Error('unavailable');
  },
  setItem: async () => {
    throw new Error('unavailable');
  },
};

describe('the citation of a paragraph (8.9)', () => {
  const parts = {
    author: 'Geerhardus Vos',
    title: 'Învățătura lui Isus',
    section: 'IV. Împărăția',
    url: 'https://example.org/read/w/s?p=p1',
  };

  it('names the author, the work and the section, then the link', () => {
    expect(citationLine(parts, ro)).toBe(
      '— Geerhardus Vos, Învățătura lui Isus, IV. Împărăția. — https://example.org/read/w/s?p=p1',
    );
  });

  it('names the edition inside the citation, before the link, only when it is given', () => {
    expect(citationLine({ ...parts, editionLanguage: 'en' }, ro)).toBe(
      '— Geerhardus Vos, Învățătura lui Isus, IV. Împărăția (ediția engleză). — https://example.org/read/w/s?p=p1',
    );
    expect(citationLine({ ...parts, editionLanguage: 'ro' }, en)).toContain('(Romanian edition)');
    expect(citationEdition('en', ro)).toBe('ediția engleză');
  });

  it('leaves out what a work does not have (an anonymous work has no author)', () => {
    expect(citationLine({ ...parts, author: '  ' }, ro)).toBe(
      '— Învățătura lui Isus, IV. Împărăția. — https://example.org/read/w/s?p=p1',
    );
  });

  it('follows the text after a blank line, and matches the pattern of check R14', () => {
    const text = textWithCitation(
      ' O frază. ',
      citationLine({ ...parts, editionLanguage: 'ro' }, ro),
    );
    expect(text.startsWith('O frază.\n\n— ')).toBe(true);
    expect(text).toMatch(/^[\s\S]+\n\n— .+( \(.+\))?\. — https?:\/\/\S+\/read\/\S+\?p=\S+$/);
  });
});

describe('the address a copied link points to (8.9)', () => {
  const saved = {
    site: process.env.EXPO_PUBLIC_SITE_URL,
    base: process.env.EXPO_PUBLIC_WEB_BASE_URL,
  };
  afterEach(() => {
    for (const [key, value] of [
      ['EXPO_PUBLIC_SITE_URL', saved.site],
      ['EXPO_PUBLIC_WEB_BASE_URL', saved.base],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete (globalThis as { window?: unknown }).window;
  });

  it('is the configured public site on a phone, without a trailing slash, or the fallback', () => {
    delete process.env.EXPO_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe(SITE_URL_FALLBACK);
    process.env.EXPO_PUBLIC_SITE_URL = ' https://carti.example.org// ';
    expect(siteUrl()).toBe('https://carti.example.org');
  });

  it('is the origin of the page plus the base path of the deployment on web', () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      (globalThis as { window?: unknown }).window = {
        location: { origin: 'https://deiuvrg.github.io' },
      };
      process.env.EXPO_PUBLIC_WEB_BASE_URL = '/BiblicAPP/';
      expect(siteUrl()).toBe('https://deiuvrg.github.io/BiblicAPP');
      process.env.EXPO_PUBLIC_WEB_BASE_URL = 'BiblicAPP';
      expect(siteUrl()).toBe('https://deiuvrg.github.io/BiblicAPP');
      process.env.EXPO_PUBLIC_WEB_BASE_URL = '/';
      expect(siteUrl()).toBe('https://deiuvrg.github.io');
      delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
      expect(siteUrl()).toBe('https://deiuvrg.github.io');
    } finally {
      replaced.restore();
    }
  });

  it('links to a section and to a paragraph, the ids encoded', () => {
    delete process.env.EXPO_PUBLIC_SITE_URL;
    expect(readUrl('vos', 'vos-ch1')).toBe(`${SITE_URL_FALLBACK}/read/vos/vos-ch1`);
    expect(readUrl('vos', 'vos-ch1', 'p-3')).toBe(`${SITE_URL_FALLBACK}/read/vos/vos-ch1?p=p-3`);
    expect(readUrl('a b', 'c/d', 'e&f')).toBe(`${SITE_URL_FALLBACK}/read/a%20b/c%2Fd?p=e%26f`);
    expect(readUrl('vos', 'vos-ch1', null)).toBe(`${SITE_URL_FALLBACK}/read/vos/vos-ch1`);
  });
});

describe('copyText: the clipboard, then the share sheet', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    setString.mockReset();
  });

  it('is done when the clipboard takes the text', async () => {
    setString.mockResolvedValue(true);
    const share = jest.spyOn(Share, 'share');
    expect(await copyText('text')).toBe(true);
    expect(setString).toHaveBeenCalledWith('text');
    expect(share).not.toHaveBeenCalled();
  });

  it('hands the text to the share sheet when the clipboard cannot (refused, or throws)', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction } as Awaited<ReturnType<typeof Share.share>>);
    setString.mockResolvedValue(false);
    expect(await copyText('one')).toBe(true);
    setString.mockRejectedValue(new Error('denied'));
    expect(await copyText('two')).toBe(true);
    expect(share).toHaveBeenNthCalledWith(1, { message: 'one' });
    expect(share).toHaveBeenNthCalledWith(2, { message: 'two' });
  });

  it('says false when the share sheet is dismissed or fails, and never throws', async () => {
    setString.mockResolvedValue(false);
    jest
      .spyOn(Share, 'share')
      .mockResolvedValueOnce({ action: Share.dismissedAction } as Awaited<
        ReturnType<typeof Share.share>
      >)
      .mockRejectedValueOnce(new Error('no share'));
    expect(await copyText('x')).toBe(false);
    expect(await copyText('x')).toBe(false);
  });
});

describe('the bookmarks of works (8.10)', () => {
  it('keeps the newest first, one per work, the edition of the last time', async () => {
    const store = createMemoryStore();
    expect(await loadBookmarks(store)).toEqual([]);
    await addBookmark(store, 'w1', 'e1', 100);
    await addBookmark(store, 'w2', 'e2', 200);
    expect((await loadBookmarks(store)).map((bookmark) => bookmark.workId)).toEqual(['w2', 'w1']);
    // Marking a work again moves it to the top, with the edition it was marked in this time.
    const list = await addBookmark(store, 'w1', 'e1-ro', 300);
    expect(list).toEqual([
      { workId: 'w1', editionId: 'e1-ro', addedAt: 300 },
      { workId: 'w2', editionId: 'e2', addedAt: 200 },
    ]);
    expect(isBookmarked(list, 'w1')).toBe(true);
    expect(isBookmarked(list, 'w3')).toBe(false);
  });

  it('takes a bookmark away, and says nothing when there is none', async () => {
    const store = createMemoryStore();
    await addBookmark(store, 'w1', 'e1', 1);
    expect(await removeBookmark(store, 'w2')).toHaveLength(1);
    expect(await removeBookmark(store, 'w1')).toEqual([]);
    expect(await loadBookmarks(store)).toEqual([]);
  });

  it('reads a damaged record as far as it can, and never throws', async () => {
    const mixed = createMemoryStore({
      [BOOKMARKS_KEY]: JSON.stringify([
        { workId: 'a', editionId: 'e', addedAt: 5 },
        { workId: 'a', editionId: 'e', addedAt: 9 },
        { workId: '', editionId: 'e', addedAt: 1 },
        { workId: 'b' },
        { workId: 'c', editionId: 'e', addedAt: 'x' },
        null,
        'text',
      ]),
    });
    expect(await loadBookmarks(mixed)).toEqual([
      { workId: 'a', editionId: 'e', addedAt: 5 },
      { workId: 'c', editionId: 'e', addedAt: 0 },
    ]);
    expect(await loadBookmarks(createMemoryStore({ [BOOKMARKS_KEY]: '{not json' }))).toEqual([]);
    expect(await loadBookmarks(createMemoryStore({ [BOOKMARKS_KEY]: '{"a":1}' }))).toEqual([]);
    expect(await loadBookmarks(brokenStore)).toEqual([]);
    await expect(addBookmark(brokenStore, 'w', 'e')).resolves.toHaveLength(1);
  });

  it('is capped, so a runaway loop cannot fill the storage', async () => {
    const many = Array.from({ length: MAX_BOOKMARKS + 20 }, (_, index) => ({
      workId: `w${index}`,
      editionId: 'e',
      addedAt: index,
    }));
    const store = createMemoryStore({ [BOOKMARKS_KEY]: JSON.stringify(many) });
    const list = await loadBookmarks(store);
    expect(list).toHaveLength(MAX_BOOKMARKS);
    // The newest stay.
    expect(list[0]!.workId).toBe(`w${MAX_BOOKMARKS + 19}`);
  });
});

describe('the pair of editions read side by side, remembered per work (8.5)', () => {
  it('remembers a well-formed pair under the work', async () => {
    const store = createMemoryStore();
    expect(await loadPair(store, 'w')).toBeNull();
    await savePair(store, 'w', 'ro+en');
    expect(await loadPair(store, 'w')).toBe('ro+en');
    expect(await loadPair(store, 'other')).toBeNull();
    expect(store.data.get(pairKey('w'))).toBe('ro+en');
  });

  it('refuses a pair that is not one, and a stored value that is not one', async () => {
    const store = createMemoryStore({ [pairKey('bad')]: 'ro+ro' });
    await savePair(store, 'w', 'ro');
    await savePair(store, 'w', 'ro+ro');
    await savePair(store, 'w', '');
    expect(store.data.has(pairKey('w'))).toBe(false);
    expect(await loadPair(store, 'bad')).toBeNull();
    expect(await loadPair(brokenStore, 'w')).toBeNull();
    await expect(savePair(brokenStore, 'w', 'ro+en')).resolves.toBeUndefined();
  });
});

describe('what the reader remembers between the sections of a work (8.3, 8.11)', () => {
  beforeEach(resetReaderSessions);
  afterAll(resetReaderSessions);

  it('starts empty, and a patch changes only what it names', () => {
    expect(getWorkSession('w')).toMatchObject({
      outlineQuery: '',
      openBranches: null,
      outlineOpen: null,
      findQuery: null,
      findOrigin: null,
    });
    patchWorkSession('w', { outlineQuery: 'cap', outlineOpen: false });
    patchWorkSession('w', { findQuery: 'împărăția' });
    expect(getWorkSession('w')).toMatchObject({
      outlineQuery: 'cap',
      outlineOpen: false,
      findQuery: 'împărăția',
    });
  });

  it('keeps each work apart, and forgets everything on reset', () => {
    patchWorkSession('a', { outlineQuery: 'a' });
    patchWorkSession('b', { outlineQuery: 'b' });
    expect(getWorkSession('a').outlineQuery).toBe('a');
    expect(getWorkSession('b').outlineQuery).toBe('b');
    resetReaderSessions();
    expect(getWorkSession('a').outlineQuery).toBe('');
  });
});
