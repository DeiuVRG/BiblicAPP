import type { Pack } from '@biblioteca/shared';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { loadBundledRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import { SearchScreen, takeInTurn } from '@/features/search/search-screen';
import { libraryAllWith, readHref, workHref } from '@/navigation-hrefs';
import { resetMockRouter, router, setMockParams } from '@/test-support/expo-router-mock';
import { syntheticLibrary } from '@/test-support/library-fixtures';
import { bundledPack, createTestSigner, signPack, translationOf } from '@/test-support/packs';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';
import { vosEditions } from '@/test-support/vos';
import { palettes } from '@/theme/palettes';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

const signer = createTestSigner();
const englishPack = bundledPack('vos-1903-kingdom-en');
const english = englishPack.pack as Pack;

async function twoEditions() {
  const romanian = translationOf(english, { sections: 3 });
  const loaded = await loadBundledRepository({
    packs: [englishPack, signPack(romanian, signer, { packId: 'vos-synthetic-ro' })],
    trustedKeys: [...trustedKeys, signer.key],
  });
  return { loaded, romanian };
}

/** A count line with its no-break spaces as plain ones. */
const plain = (text: unknown) => String(text).replace(/\u00a0/g, ' ');

/** The results block of the page (the shell around it has links of its own). */
const results = async () => within(await screen.findByTestId('search-results'));

beforeEach(() => {
  resetMockRouter();
});

describe('SearchScreen: passages', () => {
  beforeEach(() => setMockParams({ mode: 'passages' }));

  it('finds text ignoring case and diacritics and opens the paragraph', async () => {
    const { loaded } = await renderWithProviders(<SearchScreen />);
    const { repository } = loaded;
    const { englishSections } = await vosEditions(repository);
    const [paragraph] = await repository.getParagraphs(englishSections[0]!.id);
    // First word of 5+ letters in the first paragraph, upper-cased and stripped of diacritics.
    const word = paragraph!.text.match(/\p{L}{5,}/u)![0];
    const typed = word
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase();

    await fireEvent.changeText(screen.getByLabelText('Caută în text'), typed);
    const rows = (await results()).getAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);

    const hits = await repository.search(typed);
    await fireEvent.press(rows[0]!);
    expect(router.push).toHaveBeenCalledWith(
      readHref(hits[0]!.workId, hits[0]!.sectionId, { p: hits[0]!.paragraphId, q: typed }),
    );
  });

  it('asks for at least two characters', async () => {
    await renderWithProviders(<SearchScreen />);
    expect(screen.getByText(/cel puțin 2 caractere/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'a');
    // One character is still not a search: the hint stays and nothing is listed.
    expect(await screen.findByText(/cel puțin 2 caractere/)).toBeTruthy();
    expect(screen.queryByTestId('search-results')).toBeNull();
  });

  it('counts the hits and the works they are in, and says when there is nothing', async () => {
    await renderWithProviders(<SearchScreen />);
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'kingdom');
    const count = await screen.findByTestId('search-count');
    // The hits of both editions, in the one work: cut at the cap, it says both.
    expect(plain(count.props.children)).toMatch(
      /^\d+ rezultate? în 1 lucrare$|^Primele 50 de rezultate, în 1 lucrare$/,
    );

    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'zzzzqq');
    expect(await screen.findByText('Niciun rezultat.')).toBeTruthy();
    expect(screen.queryByTestId('search-results')).toBeNull();
  });

  it('opens with the query and the mode of the address', async () => {
    setMockParams({ q: 'kingdom', mode: 'passages' });
    await renderWithProviders(<SearchScreen />);
    expect(screen.getByLabelText('Caută în text').props.value).toBe('kingdom');
    expect((await results()).getAllByRole('link').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Pasaje').props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('groups the hits under the title of their work', async () => {
    setMockParams({ q: 'kingdom', mode: 'passages' });
    const { loaded } = await renderWithProviders(<SearchScreen />);
    const { work } = await vosEditions(loaded.repository);
    const block = await results();
    expect(await block.findByText(work.titleRo)).toBeTruthy();
    // The same work is the heading once, however many hits it has.
    expect(block.getAllByText(work.titleRo)).toHaveLength(1);
  });

  it('puts the chapter first in each result, so a long line cuts off the work title', async () => {
    setMockParams({ q: 'kingdom', mode: 'passages' });
    const { loaded } = await renderWithProviders(<SearchScreen />);
    const { work, englishSections, romanianSections } = await vosEditions(loaded.repository);
    const headings = [...englishSections, ...romanianSections].map((section) => section.heading);
    const rows = (await results()).getAllByRole('link');
    for (const row of rows.slice(0, 5)) {
      const label = row.props.accessibilityLabel as string;
      const place = label.slice('Deschide rezultatul din '.length, label.indexOf(': '));
      expect(headings.some((heading) => place.startsWith(heading))).toBe(true);
      expect(place.endsWith(work.titleRo)).toBe(true);
    }
  });
});

describe('takeInTurn', () => {
  it('takes one from each list, then one more from each, until the cap', () => {
    expect(takeInTurn([[1, 2, 3], [4], [5, 6]], 4)).toEqual([[1, 2], [4], [5]]);
    expect(takeInTurn([[1, 2, 3], [4], [5, 6]], 10)).toEqual([[1, 2, 3], [4], [5, 6]]);
    expect(takeInTurn([[1, 2, 3], [4], [5, 6]], 0)).toEqual([[], [], []]);
    // An edition without hits takes nothing and does not hold the others back.
    expect(takeInTurn([[], [1, 2, 3]], 2)).toEqual([[], [1, 2]]);
    expect(takeInTurn([], 5)).toEqual([]);
  });
});

describe('SearchScreen: passages with several editions', () => {
  beforeEach(() => setMockParams({ mode: 'passages' }));

  it('states who wrote the work and its editions under the title of a group', async () => {
    setMockParams({ q: 'kingdom', mode: 'passages' });
    const { loaded } = await twoEditions();
    await renderWithProviders(<SearchScreen />, { loaded });
    const block = await results();
    const group = block.getByTestId(/^search-group-/);
    expect(within(group).getByText(/Geerhardus Vos/i)).toBeTruthy();
    // One chip per edition, named for a screen reader as the edition is.
    expect(within(group).getByText('RO')).toBeTruthy();
    expect(within(group).getByText('EN')).toBeTruthy();
    expect(within(group).getByLabelText('English · original')).toBeTruthy();
    expect(within(group).getByLabelText('Română · traducere')).toBeTruthy();
  });

  it('does not let the first edition fill the cap: both editions are searched on their own, and the count says both the cap and the works', async () => {
    // "ar" is in the English text and in "Împărăția" of every synthetic Romanian paragraph.
    setMockParams({ q: 'ar', mode: 'passages' });
    const big = translationOf(english, { sections: 11, paragraphsPerSection: 40 });
    const loaded = await loadBundledRepository({
      packs: [englishPack, signPack(big, signer, { packId: 'vos-synthetic-ro-big' })],
      trustedKeys: [...trustedKeys, signer.key],
    });
    const { repository } = loaded;
    // The global search takes its 50 from the English edition alone ...
    const global = await repository.search('ar');
    expect(new Set(global.map((hit) => hit.language))).toEqual(new Set(['en']));
    // ... the page lists the editions in turn.
    await renderWithProviders(<SearchScreen />, { loaded });
    const block = await results();
    const rows = block.getAllByRole('link');
    expect(rows).toHaveLength(50);
    expect(block.getAllByLabelText('Română').length).toBeGreaterThan(0);
    expect(block.getAllByLabelText('English').length).toBeGreaterThan(0);
    expect(plain(screen.getByTestId('search-count').props.children)).toBe(
      'Primele 50 de rezultate, în 1 lucrare',
    );
  });

  it('names the language of the edition next to the heading of the section', async () => {
    setMockParams({ q: 'kingdom', mode: 'passages' });
    const { loaded, romanian } = await twoEditions();
    await renderWithProviders(<SearchScreen />, { loaded });
    const block = await results();
    const rows = block.getAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);
    // English text, so the English edition: the badge sits beside the chapter, not inside it.
    expect(block.getAllByLabelText('English')).toHaveLength(rows.length);
    expect(block.queryByLabelText('Română')).toBeNull();
    expect((await block.findAllByText(/^I\. Introductory/)).length).toBeGreaterThan(0);

    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'Dumnezeu este aproape');
    // The block of the English hits is replaced by the block of the Romanian ones: look again.
    const synthetic = await screen.findAllByText(romanian.sections[0]!.heading);
    expect(synthetic.length).toBeGreaterThan(0);
    expect((await results()).getAllByLabelText('Română')).toHaveLength(romanian.paragraphs.length);
  });

  it('opens the edition the hit is in: the section identifies it', async () => {
    setMockParams({ q: 'Dumnezeu este aproape', mode: 'passages' });
    const { loaded, romanian } = await twoEditions();
    const { repository } = loaded;
    await renderWithProviders(<SearchScreen />, { loaded });
    const rows = (await results()).getAllByRole('link');
    expect(rows).toHaveLength(romanian.paragraphs.length);
    await fireEvent.press(rows[0]!);

    const hits = await repository.search('Dumnezeu este aproape');
    expect(hits[0]).toMatchObject({ editionId: romanian.edition.id, language: 'ro' });
    expect(router.push).toHaveBeenCalledWith(
      readHref(english.work.id, hits[0]!.sectionId, {
        p: hits[0]!.paragraphId,
        q: 'Dumnezeu este aproape',
      }),
    );
    expect(romanian.sections.map((section) => section.id)).toContain(hits[0]!.sectionId);
    expect((await repository.locateSection(hits[0]!.sectionId))?.editionId).toBe(
      romanian.edition.id,
    );
  });

  it('opens a hit in the English edition on its section, too', async () => {
    setMockParams({ q: 'kingdom', mode: 'passages' });
    const { loaded } = await twoEditions();
    const { repository } = loaded;
    await renderWithProviders(<SearchScreen />, { loaded });
    const rows = (await results()).getAllByRole('link');
    await fireEvent.press(rows[0]!);
    const hits = await repository.search('kingdom');
    const pressed = router.push.mock.calls[0]![0] as { params: { section: string } };
    expect(pressed.params.section).toBe(hits[0]!.sectionId);
    expect((await repository.locateSection(pressed.params.section))?.editionId).toBe(
      english.edition.id,
    );
  });

  it('gives screen readers the chapter, the language and the work, then the passage', async () => {
    setMockParams({ q: 'kingdom', mode: 'passages' });
    const { loaded } = await twoEditions();
    await renderWithProviders(<SearchScreen />, { loaded });
    const [row] = (await results()).getAllByRole('link');
    const label = row!.props.accessibilityLabel as string;
    expect(label).toMatch(
      new RegExp(
        `^Deschide rezultatul din I\\. Introductory · English · ${english.work.titleRo}: `,
      ),
    );
  });

  it('names the work in the reading language in the label of a hit', async () => {
    setMockParams({ q: 'kingdom', mode: 'passages' });
    const { loaded } = await twoEditions();
    await renderWithProviders(<SearchScreen />, {
      loaded,
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    const [row] = (await results()).getAllByRole('link');
    expect(row!.props.accessibilityLabel).toContain(`English · ${english.work.titleOrig}: `);
  });

  it('is written in English with an English interface', async () => {
    const { loaded } = await twoEditions();
    await renderWithProviders(<SearchScreen />, {
      loaded,
      store: createSettingsStore({ uiLanguage: 'en' }),
    });
    expect(await screen.findByLabelText('Search the text')).toBeTruthy();
    expect(screen.getByText(/at least 2 characters/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search the text'), 'kingdom of heaven');
    const rows = (await results()).getAllByRole('link');
    expect(rows[0]!.props.accessibilityLabel).toMatch(/^Open the result in /);
    expect(
      screen.getByText(/^\d+ results? in 1 work$|^First 50 results, in 1 work$/),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search the text'), 'zzzzqq');
    expect(await screen.findByText('No results.')).toBeTruthy();
  });

  it('marks the language of a snippet on web', async () => {
    const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      setMockParams({ q: 'Dumnezeu este aproape', mode: 'passages' });
      const { loaded } = await twoEditions();
      await renderWithProviders(<SearchScreen />, { loaded });
      const rows = (await results()).getAllByRole('link');
      const snippet = rows[0]!.props.accessibilityLabel as string;
      expect(snippet).toContain('Română');
      const text = screen.getAllByText(/Text sintetic/)[0]!;
      expect(text.props.lang).toBe('ro');
    } finally {
      replaced.restore();
    }
  });
});

describe('SearchScreen: the arrow Down in the field (docs/ui-spec-v2.md, 10)', () => {
  /** Under Jest every element answers `focus` with this one shared mock: it counts the moves. */
  const focusMock = () =>
    jest.requireActual<{ default: { focus: jest.Mock } }>(
      '@react-native/jest-preset/jest/MockNativeMethods',
    ).default.focus;
  const down = () =>
    fireEvent(screen.getByLabelText('Caută în text'), 'keyPress', {
      nativeEvent: { key: 'ArrowDown' },
      preventDefault: jest.fn(),
    });
  beforeEach(() => focusMock().mockClear());

  it('does nothing while there are no results', async () => {
    await renderWithProviders(<SearchScreen />);
    await down();
    expect(focusMock()).not.toHaveBeenCalled();
  });

  it('moves the focus to the first author, then to the first work, in "Lucrări"', async () => {
    const library = syntheticLibrary();
    await renderWithProviders(<SearchScreen />, { loaded: await library.load() });
    // An author matches: the first result is the author.
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'toma');
    await screen.findByTestId('search-author-toma-d-aquino');
    await down();
    expect(focusMock()).toHaveBeenCalledTimes(1);
    // Only a work matches (a title, no name): the first result is the work row.
    focusMock().mockClear();
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'spirit');
    await screen.findByTestId('library-row-despre-spirit-si-litera');
    expect(screen.queryByTestId(/^search-author-/)).toBeNull();
    await down();
    expect(focusMock()).toHaveBeenCalledTimes(1);
  });

  it('moves the focus to the first passage in "Pasaje"', async () => {
    setMockParams({ q: 'kingdom', mode: 'passages' });
    await renderWithProviders(<SearchScreen />);
    await results();
    await down();
    expect(focusMock()).toHaveBeenCalledTimes(1);
  });
});

describe('SearchScreen: works and authors (the default mode)', () => {
  it('opens on "Lucrări" with a hint and no results', async () => {
    await renderWithProviders(<SearchScreen />);
    expect(screen.getByLabelText('Lucrări').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByText(/cel puțin 2 caractere/)).toBeTruthy();
    expect(screen.queryByTestId('search-results')).toBeNull();
    expect(screen.getByPlaceholderText('Caută lucrări, autori sau pasaje')).toBeTruthy();
  });

  it('finds the authors whose name matches, then the works, and counts both', async () => {
    const library = syntheticLibrary();
    await renderWithProviders(<SearchScreen />, { loaded: await library.load() });
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'toma');
    const block = await results();
    // Toma d'Aquino and Toma Kempis, each with one work; the works whose title or name has "toma".
    expect(await block.findByTestId('search-author-toma-d-aquino')).toBeTruthy();
    expect(block.getByTestId('search-author-toma-kempis')).toBeTruthy();
    expect(plain(screen.getByTestId('search-count').props.children)).toMatch(
      /^2 autori · \d+ lucrări$/,
    );
    expect(block.getByText('Autori')).toBeTruthy();
    expect(block.getByText('Lucrări')).toBeTruthy();
  });

  it('sets the name of an author in the colour and the face of a title, in every theme', async () => {
    const library = syntheticLibrary();
    for (const theme of ['light', 'dark'] as const) {
      const view = await renderWithProviders(<SearchScreen />, {
        loaded: await library.load(),
        store: createSettingsStore({ theme }),
      });
      await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'gust');
      const name = await within(await screen.findByTestId('search-author-augustin')).findByText(
        'Augustin',
      );
      // A bare Text is black: on the dark theme the name would not be seen.
      expect(StyleSheet.flatten(name.props.style)).toMatchObject({
        color: palettes[theme].text,
        fontSize: expect.any(Number),
      });
      await view.unmount();
    }
  });

  it('ignores case and diacritics when it matches a name', async () => {
    const library = syntheticLibrary();
    await renderWithProviders(<SearchScreen />, { loaded: await library.load() });
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'GURA DE AUR');
    expect(await screen.findByTestId('search-author-ioan-gura-de-aur')).toBeTruthy();
  });

  it('opens the library filtered by the name when an author is chosen', async () => {
    const library = syntheticLibrary();
    await renderWithProviders(<SearchScreen />, { loaded: await library.load() });
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'augustin');
    await fireEvent.press(await screen.findByTestId('search-author-augustin'));
    expect(router.push).toHaveBeenCalledWith(libraryAllWith({ q: 'Augustin' }));
  });

  it('opens the work page from a work row', async () => {
    const library = syntheticLibrary();
    await renderWithProviders(<SearchScreen />, { loaded: await library.load() });
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'calcedon');
    await fireEvent.press(await screen.findByTestId('library-row-definitia-de-la-calcedon'));
    expect(router.push).toHaveBeenCalledWith(
      workHref(library.workIds['definitia-de-la-calcedon']!),
    );
  });

  it('says when no author or work has the name', async () => {
    await renderWithProviders(<SearchScreen />);
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'zzzzqq');
    expect(await screen.findByText('Niciun rezultat.')).toBeTruthy();
  });

  it('switches to the passages and back with the segmented control', async () => {
    await renderWithProviders(<SearchScreen />);
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'kingdom');
    await fireEvent.press(screen.getByLabelText('Pasaje'));
    expect(screen.getByLabelText('Pasaje').props.accessibilityState).toMatchObject({
      checked: true,
    });
    const rows = (await results()).getAllByRole('link');
    expect(rows[0]!.props.accessibilityLabel).toMatch(/^Deschide rezultatul din /);
    await fireEvent.press(screen.getByLabelText('Lucrări'));
    // "kingdom" is in the title of the Vos work: the same words, now found as a work.
    expect(await screen.findByTestId('library-row-vos-1903-kingdom')).toBeTruthy();
  });

  it('registers its field as the target of the "/" shortcut while it is in focus', async () => {
    const { getSlashTarget } =
      jest.requireActual<typeof import('@/shell/slash-target')>('@/shell/slash-target');
    await renderWithProviders(<SearchScreen />);
    expect(getSlashTarget()).not.toBeNull();
  });
});
