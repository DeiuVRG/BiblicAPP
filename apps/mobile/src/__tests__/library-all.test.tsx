import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, Platform } from 'react-native';

import { FEATURES, FeaturesProvider } from '@/config/features';
import type { Features } from '@/config/features';
import { LibraryAllScreen } from '@/features/library/library-all-screen';
import { en } from '@/i18n/en';
import { ro as t } from '@/i18n/ro';
import { authorHref, libraryAllWith } from '@/navigation-hrefs';
import { resetMockRouter, router, setMockParams } from '@/test-support/expo-router-mock';
import { syntheticLibrary } from '@/test-support/library-fixtures';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

// F-2 (docs/ui-spec-v2.md 20.1): sixteen works of fifteen authors and one council, on six shelves,
// in twelve centuries. Sixteen groups are more than twelve, so the accordions start closed.

const original = Dimensions.get('window');

beforeEach(() => {
  resetMockRouter();
  // The sheet of a filter appears and goes at once: what is asserted is the state.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(async () => {
  await act(async () => {
    Dimensions.set({ window: original });
  });
  jest.restoreAllMocks();
});

const plain = (text: unknown) => String(text).replace(/ /g, ' ');

async function renderAll(
  features: Partial<Features> = {},
  options: Parameters<typeof renderWithProviders>[1] = {},
) {
  const loaded = options.loaded ?? (await syntheticLibrary().load());
  const view = await renderWithProviders(
    <FeaturesProvider value={{ ...FEATURES, ...features }}>
      <LibraryAllScreen />
    </FeaturesProvider>,
    { ...options, loaded },
  );
  await screen.findByTestId('library-count');
  return view;
}

const countLine = () => plain(screen.getByTestId('library-count').props.children);

/** Chooses an option of a filter in its sheet. */
async function choose(filter: string, option: string) {
  await fireEvent.press(screen.getByTestId(filter));
  await fireEvent.press(await screen.findByTestId(`${filter}-option-${option}`));
}

/** Types in the name search and waits for the list to follow (the field commits after 180 ms). */
async function search(text: string) {
  await fireEvent.changeText(screen.getByTestId('library-search'), text);
}

describe('Toată biblioteca: the page', () => {
  it('names the page and says what the list is: sixteen works, in the whole library', async () => {
    await renderAll();
    const hero = within(screen.getByTestId('library-hero'));
    expect(hero.getByText(t.library.allTitle)).toBeTruthy();
    expect(hero.getByText(t.library.allSub)).toBeTruthy();
    expect(countLine()).toBe('16 lucrări în toată biblioteca');
    expect(screen.getByTestId('library-count').props.accessibilityLiveRegion).toBe('polite');
  });

  it('offers the list of authors from the hero while that screen is live', async () => {
    const first = await renderAll();
    await fireEvent.press(screen.getByTestId('hero-authors'));
    expect(router.push).toHaveBeenCalledWith('/authors');
    await first.unmount();
    await renderAll({ authors: false });
    expect(screen.queryByTestId('hero-authors')).toBeNull();
  });

  it('has the search, the filters of the library and the two views', async () => {
    await renderAll();
    const panel = within(screen.getByTestId('filter-panel'));
    expect(panel.getByLabelText(t.library.searchLabel)).toBeTruthy();
    for (const filter of ['shelf', 'century', 'lang', 'availability']) {
      expect(panel.getByTestId(`filter-${filter}`)).toBeTruthy();
    }
    // No traditions in the catalogue yet (P2): no filter for them.
    expect(panel.queryByTestId('filter-tradition')).toBeNull();
    expect(screen.getByTestId('view-tab-author')).toBeTruthy();
    expect(screen.getByTestId('view-tab-century')).toBeTruthy();
    expect(screen.getByLabelText(t.library.viewTabs)).toBeTruthy();
  });

  it('shares the filters in even rows: two and two at 768, four across on a desktop, one each on a phone', async () => {
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 1024 } });
    });
    await renderAll();
    const widths = () =>
      (screen.getByTestId('filter-grid').children as unknown as { props: { style: object } }[]).map(
        (cell) => (cell.props.style as { width?: number }).width,
      );
    const lay = async (width: number) =>
      fireEvent(screen.getByTestId('filter-grid'), 'layout', {
        nativeEvent: { layout: { width, height: 200 } },
      });
    // The 646 points of a 768 point window: three 180 point cells would fit, and the fourth would
    // stand alone on a row of its own at twice the width.
    await lay(646);
    expect(widths()).toEqual([315, 315, 315, 315]);
    await lay(1082);
    expect(widths()).toEqual([258, 258, 258, 258]);

    await act(async () => {
      Dimensions.set({ window: { ...original, width: 390 } });
    });
    await lay(300);
    expect(widths()).toEqual([300, 300, 300, 300]);
  });

  it('says the filters by their name and their choice, in one label', async () => {
    await renderAll();
    expect(screen.getByTestId('filter-shelf').props.accessibilityLabel).toBe('Raft: Toate');
    expect(screen.getByTestId('filter-century').props.accessibilityLabel).toBe('Secol: Toate');
    expect(screen.getByTestId('filter-lang').props.accessibilityLabel).toBe(
      'Limba originalului: Toate',
    );
    expect(screen.getByTestId('filter-availability').props.accessibilityLabel).toBe(
      'Disponibilitate: Toate',
    );
  });

  it('lists the authors alphabetically by the name they are filed under, closed at first', async () => {
    await renderAll();
    const accordions = within(screen.getByTestId('author-list'))
      .getAllByTestId(/^(author-accordion|issuing-body)-/)
      .filter((node) => !String(node.props.testID).endsWith('-toggle'));
    expect(accordions).toHaveLength(16);
    expect(accordions.slice(0, 3).map((node) => node.props.testID)).toEqual([
      'author-accordion-anselm',
      'author-accordion-augustin',
      'author-accordion-richard-baxter',
    ]);
    // Sixteen are more than twelve: the reader opens the ones they want.
    expect(screen.queryAllByTestId(/^library-row-/)).toHaveLength(0);
    expect(
      screen.getByTestId('author-accordion-augustin-toggle').props.accessibilityState,
    ).toMatchObject({ expanded: false });
  });

  it('opens an author to the works, each a link to the work', async () => {
    await renderAll();
    await fireEvent.press(screen.getByTestId('author-accordion-ioan-calvin-toggle'));
    expect(
      screen.getByTestId('author-accordion-ioan-calvin-toggle').props.accessibilityState,
    ).toMatchObject({ expanded: true });
    const row = await screen.findByTestId('library-row-institutio');
    expect(row.props.accessibilityRole).toBe('link');
    // The shelf of the work at the right of the row, on a wide screen.
    await fireEvent.press(screen.getByTestId('author-accordion-ioan-calvin-toggle'));
    expect(screen.queryByTestId('library-row-institutio')).toBeNull();
  });

  it('files the work of a council under the council, not under an author', async () => {
    await renderAll();
    const body = screen.getByTestId('issuing-body-conciliul-din-calcedon');
    // The body is told by its name and the year it issued its documents (6.3).
    expect(within(body).getByText('Conciliul din Calcedon · 451')).toBeTruthy();
    expect(
      plain(
        screen.getByTestId('issuing-body-conciliul-din-calcedon-toggle').props.accessibilityLabel,
      ),
    ).toBe('Conciliul din Calcedon · 451, 1 lucrare');
    // A person has no year after the name.
    expect(
      within(screen.getByTestId('author-accordion-augustin')).getByText('Augustin'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('issuing-body-conciliul-din-calcedon-toggle'));
    expect(screen.getByTestId('library-row-definitia-de-la-calcedon')).toBeTruthy();
  });

  it('leads to the author page from an open author only once that page is live', async () => {
    const first = await renderAll();
    await fireEvent.press(screen.getByTestId('author-accordion-augustin-toggle'));
    expect(screen.queryByLabelText('Despre Augustin')).toBeNull();
    await first.unmount();

    await renderAll({ authorPages: true });
    await fireEvent.press(screen.getByTestId('author-accordion-augustin-toggle'));
    await fireEvent.press(screen.getByLabelText('Despre Augustin'));
    expect(router.push).toHaveBeenCalledWith(authorHref('augustin'));
  });
});

describe('Toată biblioteca: the filters', () => {
  it('narrows to a shelf: the hero takes its name and the count says so', async () => {
    await renderAll();
    await choose('filter-shelf', 'fathers');
    expect(countLine()).toBe('4 lucrări în raftul Părinții Bisericii');
    const hero = within(screen.getByTestId('library-hero'));
    expect(hero.getByText('Părinții Bisericii')).toBeTruthy();
    expect(hero.getByText('Descrierea raftului Părinții Bisericii.')).toBeTruthy();
    expect(screen.getByTestId('filter-shelf').props.accessibilityLabel).toBe(
      'Raft: Părinții Bisericii',
    );
    // Four authors are twelve or fewer: they open by themselves.
    expect(await screen.findAllByTestId(/^library-row-/)).toHaveLength(4);
  });

  it('returns to every shelf from the shelf page', async () => {
    setMockParams({ shelf: 'fathers' });
    await renderAll();
    expect(countLine()).toBe('4 lucrări în raftul Părinții Bisericii');
    expect(screen.queryByTestId('shelves-fold')).toBeNull();
    await fireEvent.press(screen.getByTestId('all-shelves'));
    expect(countLine()).toBe('16 lucrări în toată biblioteca');
    expect(screen.getByTestId('shelves-fold')).toBeTruthy();
  });

  it('narrows to a century, written as Romanian writes it', async () => {
    await renderAll();
    await choose('filter-century', '5');
    expect(countLine()).toBe('3 lucrări din secolul al V-lea în toată biblioteca');
    expect(screen.getByTestId('filter-century').props.accessibilityLabel).toMatch(/^Secol: /);
  });

  it('narrows to the original language and to the availability, and says both', async () => {
    await renderAll();
    await choose('filter-lang', 'la');
    expect(countLine()).toBe('7 lucrări în toată biblioteca · limba originalului: Latină');
    await choose('filter-availability', 'en');
    expect(countLine()).toMatch(
      /^\d+ lucrări? în toată biblioteca · limba originalului: Latină · English$/,
    );
  });

  it('shows the chosen option with a check and "Toate" first in the sheet', async () => {
    await renderAll();
    await fireEvent.press(screen.getByTestId('filter-shelf'));
    const sheet = within(await screen.findByTestId('filter-shelf-sheet'));
    const options = sheet.getAllByRole('radio');
    expect(options[0]!.props.accessibilityLabel).toBe('Toate');
    expect(options[0]!.props.accessibilityState).toMatchObject({ checked: true });
    expect(options.map((option) => option.props.accessibilityLabel).slice(1, 3)).toEqual([
      'Crezuri, mărturisiri și catehisme',
      'Părinții Bisericii',
    ]);
    expect(sheet.getByTestId('filter-shelf-option-fathers').props.accessibilityState).toMatchObject(
      {
        checked: false,
      },
    );
  });

  it('goes back to "Toate" from the sheet of a filter', async () => {
    await renderAll();
    await choose('filter-shelf', 'fathers');
    await choose('filter-shelf', 'all');
    expect(countLine()).toBe('16 lucrări în toată biblioteca');
  });

  it('filters by the name typed, ranking and marking what matches, and says how many', async () => {
    await renderAll();
    await search('calvin');
    await waitFor(() => expect(countLine()).toBe('1 lucrare cu „calvin” în toată biblioteca'));
    expect(screen.getAllByTestId(/^(author-accordion|issuing-body)-/).length).toBeGreaterThan(0);
    // One author, so the accordion is open and the work is there.
    expect(await screen.findByTestId('library-row-institutio')).toBeTruthy();
  });

  it('finds the author whatever the case or the diacritics of what was typed', async () => {
    await renderAll();
    await search('GURA DE AUR');
    await waitFor(() => expect(countLine()).toMatch(/^1 lucrare cu „GURA DE AUR”/));
    expect(await screen.findByTestId('library-row-omilii-la-matei')).toBeTruthy();
  });

  it('clears the name from the field with its × button', async () => {
    await renderAll();
    await search('calvin');
    await waitFor(() => expect(countLine()).toMatch(/calvin/));
    await fireEvent.press(screen.getByTestId('library-search-clear'));
    await waitFor(() => expect(countLine()).toBe('16 lucrări în toată biblioteca'));
    expect(screen.getByTestId('library-search').props.value).toBe('');
  });

  it('says when nothing matches and offers to clear the filters', async () => {
    await renderAll();
    await choose('filter-shelf', 'fathers');
    await search('zzzzqq');
    expect(await screen.findByText(t.library.emptyFilters)).toBeTruthy();
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    await fireEvent.press(screen.getByText(t.library.clearFilters));
    await waitFor(() => expect(countLine()).toBe('16 lucrări în toată biblioteca'));
    expect(screen.queryByTestId('empty-state')).toBeNull();
    // The field follows: the name is gone from it, too.
    expect(screen.getByTestId('library-search').props.value).toBe('');
  });
});

describe('Toată biblioteca: the A-Z bar, the shelves and the century view', () => {
  it('counts authors per letter, and a letter narrows the list to its authors', async () => {
    await renderAll();
    const bar = within(screen.getByTestId('az-bar'));
    expect(plain(bar.getByTestId('az-all').props.accessibilityLabel)).toBe('Toate: 16 autori');
    // Letters without an author are left out: there is no "D", no "F".
    expect(bar.queryByTestId('az-D')).toBeNull();
    const c = bar.getByTestId('az-C');
    expect(plain(c.props.accessibilityLabel)).toBe('C: 2 autori');
    await fireEvent.press(c);
    expect(countLine()).toBe('2 lucrări în toată biblioteca · litera C');
    expect(screen.getByTestId('az-C').props.accessibilityState).toMatchObject({ selected: true });
    // Pressing the active letter again returns to every letter.
    await fireEvent.press(screen.getByTestId('az-C'));
    expect(countLine()).toBe('16 lucrări în toată biblioteca');
    await fireEvent.press(screen.getByTestId('az-V'));
    expect(countLine()).toBe('1 lucrare în toată biblioteca · litera V');
    await fireEvent.press(screen.getByTestId('az-all'));
    expect(countLine()).toBe('16 lucrări în toată biblioteca');
  });

  it('unfolds the shelves from the fold above the list, one card for each', async () => {
    await renderAll();
    expect(screen.queryByTestId('shelves-fold-grid')).toBeNull();
    const toggle = screen.getByTestId('shelves-fold-toggle');
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
    expect(plain(toggle.props.accessibilityLabel)).toBe('Răsfoiește rafturile. 6 rafturi');
    await fireEvent.press(toggle);
    const grid = within(screen.getByTestId('shelves-fold-grid'));
    expect(grid.getAllByTestId(/^shelf-card-/)).toHaveLength(6);
    await fireEvent.press(grid.getByTestId('shelf-card-puritans'));
    expect(router.push).toHaveBeenCalledWith(libraryAllWith({ shelf: 'puritans' }));
  });

  it('shows the centuries as tiles in the second view, with the numeral and the count', async () => {
    await renderAll();
    await fireEvent.press(screen.getByTestId('view-tab-century'));
    const tiles = within(screen.getByTestId('century-tiles'));
    expect(tiles.getAllByTestId(/^century-tile-/)).toHaveLength(12);
    const five = tiles.getByTestId('century-tile-5');
    expect(plain(five.props.accessibilityLabel)).toBe('secolul al V-lea: 3 lucrări');
    expect(within(five).getByText('V', { includeHiddenElements: true })).toBeTruthy();
    expect(countLine()).toBe('12 secole · 16 lucrări în toată biblioteca');
    expect(screen.queryByTestId('az-bar')).toBeNull();
    expect(screen.queryByTestId('century-undated')).toBeNull();
  });

  it('returns to the authors, narrowed to the century, when a tile is chosen', async () => {
    await renderAll();
    await fireEvent.press(screen.getByTestId('view-tab-century'));
    await fireEvent.press(screen.getByTestId('century-tile-16'));
    expect(countLine()).toBe('2 lucrări din secolul al XVI-lea în toată biblioteca');
    expect(screen.getByTestId('view-tab-author').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('filter-century').props.accessibilityLabel).toMatch(/^Secol: .*XVI/);
  });
});

describe('Toată biblioteca: the address', () => {
  it('opens as the address says: shelf, century, name, letter and view', async () => {
    setMockParams({ shelf: 'fathers', century: '5', q: 'a', letter: 'A' });
    await renderAll();
    expect(countLine()).toBe(
      '1 lucrare cu „a” în raftul Părinții Bisericii și secolul al V-lea · litera A',
    );
    expect(screen.getByTestId('library-search').props.value).toBe('a');
    await act(async () => setMockParams({ view: 'century' }));
    expect(screen.getByTestId('century-tiles')).toBeTruthy();
  });

  it('ignores a value that is not valid, as if it were not there', async () => {
    setMockParams({ shelf: 'nope', century: 'x', view: 'sideways', page: '-3', lang: '' });
    await renderAll();
    // An unknown shelf is not a filter either: nothing is shown under it, and the page says so.
    expect(screen.getByTestId('library-count')).toBeTruthy();
    expect(screen.getByTestId('view-tab-author').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  describe('on web', () => {
    let replaceState: jest.Mock;
    let replaced: { restore(): void };

    beforeEach(() => {
      replaceState = jest.fn();
      replaced = jest.replaceProperty(Platform, 'OS', 'web');
      const target = globalThis as unknown as Record<string, unknown>;
      target.location = { pathname: '/library/all', hash: '' };
      target.history = { state: null, replaceState };
    });

    afterEach(() => {
      replaced.restore();
      const target = globalThis as unknown as Record<string, unknown>;
      delete target.location;
      delete target.history;
    });

    it('writes only what differs from the defaults, without a history entry', async () => {
      await renderAll();
      const last = () => replaceState.mock.calls.at(-1)?.[2];
      expect(last()).toBe('/library/all');
      await choose('filter-shelf', 'fathers');
      expect(last()).toBe('/library/all?shelf=fathers');
      await choose('filter-century', '5');
      expect(last()).toBe('/library/all?shelf=fathers&century=5');
      await fireEvent.press(screen.getByTestId('view-tab-century'));
      expect(last()).toBe('/library/all?shelf=fathers&century=5&view=century');
      await fireEvent.press(screen.getByTestId('view-tab-author'));
      await choose('filter-shelf', 'all');
      await choose('filter-century', 'all');
      expect(last()).toBe('/library/all');
    });

    it('writes the name once it is committed, percent-encoded', async () => {
      await renderAll();
      await search('toma d’aquino');
      await waitFor(() =>
        expect(replaceState.mock.calls.at(-1)?.[2]).toBe(
          `/library/all?q=${encodeURIComponent('toma d’aquino')}`,
        ),
      );
    });

    it('lets a change of a filter forget the letter and the page', async () => {
      await renderAll();
      await fireEvent.press(screen.getByTestId('az-C'));
      expect(replaceState.mock.calls.at(-1)?.[2]).toBe('/library/all?letter=C');
      await choose('filter-shelf', 'fathers');
      expect(replaceState.mock.calls.at(-1)?.[2]).toBe('/library/all?shelf=fathers');
    });
  });
});

describe('Toată biblioteca: the same page in English and on a phone', () => {
  it('is written in English with an English interface', async () => {
    await renderAll(
      {},
      { store: createSettingsStore({ uiLanguage: 'en', readingLanguage: 'en' }) },
    );
    await waitFor(() => expect(countLine()).toBe('16 works in the whole library'));
    expect(screen.getByText(en.library.allTitle)).toBeTruthy();
    expect(screen.getByTestId('filter-shelf').props.accessibilityLabel).toBe('Shelf: All');
    await choose('filter-shelf', 'fathers');
    expect(countLine()).toBe('4 works in the Church Fathers shelf');
  });

  it('stacks the filters in a column on a phone', async () => {
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 390 } });
    });
    await renderAll();
    expect(screen.getByTestId('az-bar')).toBeTruthy();
    expect(screen.getByTestId('filter-shelf')).toBeTruthy();
    await choose('filter-shelf', 'creeds');
    expect(countLine()).toBe('1 lucrare în raftul Crezuri, mărturisiri și catehisme');
  });
});
