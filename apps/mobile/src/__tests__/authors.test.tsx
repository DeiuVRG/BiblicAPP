import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { FEATURES, FeaturesProvider } from '@/config/features';
import type { Features } from '@/config/features';
import { AuthorsScreen, authorsOf, filterAuthors } from '@/features/library/authors-screen';
import { en } from '@/i18n/en';
import { ro as t } from '@/i18n/ro';
import { buildLibraryModel } from '@/library/model';
import { authorHref, libraryAllWith } from '@/navigation-hrefs';
import { resetMockRouter, router, setMockParams } from '@/test-support/expo-router-mock';
import { syntheticLibrary } from '@/test-support/library-fixtures';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

beforeEach(() => {
  resetMockRouter();
});

const plain = (text: unknown) => String(text).replace(/ /g, ' ');

async function renderAuthors(
  features: Partial<Features> = {},
  options: Parameters<typeof renderWithProviders>[1] = {},
) {
  const loaded = options.loaded ?? (await syntheticLibrary().load());
  const view = await renderWithProviders(
    <FeaturesProvider value={{ ...FEATURES, ...features }}>
      <AuthorsScreen />
    </FeaturesProvider>,
    { ...options, loaded },
  );
  await screen.findByTestId('authors-count');
  return view;
}

describe('AuthorsScreen', () => {
  it('lists the people of the library alphabetically, with a count, and not the councils', async () => {
    await renderAuthors();
    expect(within(screen.getByTestId('authors-hero')).getByText(t.authorsPage.title)).toBeTruthy();
    expect(plain(screen.getByTestId('authors-count').props.children)).toBe('15 autori');
    const rows = screen.getAllByTestId(/^author-row-/);
    expect(rows).toHaveLength(15);
    expect(rows[0]!.props.testID).toBe('author-row-anselm');
    expect(screen.queryByTestId('author-row-conciliul-din-calcedon')).toBeNull();
  });

  it('describes an author by the years of the life, the shelf and the language of the work', async () => {
    await renderAuthors();
    const row = screen.getByTestId('author-row-augustin');
    expect(plain(row.props.accessibilityLabel)).toBe(
      'Lucrările lui Augustin. 354–430 · Părinții Bisericii · Latină. 1 lucrare',
    );
    expect(within(row).getByText('Augustin')).toBeTruthy();
  });

  it('leads a name to the library filtered by it, until the author page exists', async () => {
    await renderAuthors();
    await fireEvent.press(screen.getByTestId('author-row-ioan-calvin'));
    expect(router.push).toHaveBeenCalledWith(libraryAllWith({ q: 'Ioan Calvin' }));
  });

  it('leads a name to the author page once that page is live', async () => {
    await renderAuthors({ authorPages: true });
    await fireEvent.press(screen.getByTestId('author-row-ioan-calvin'));
    expect(router.push).toHaveBeenCalledWith(authorHref('ioan-calvin'));
  });

  it('searches the names with the case and the diacritics folded, in any of their forms', async () => {
    await renderAuthors();
    await fireEvent.changeText(screen.getByTestId('authors-search'), 'THOMAS');
    // "Thomas Aquinas" and "Thomas à Kempis" are the English names of two Romanian ones.
    await waitFor(() =>
      expect(plain(screen.getByTestId('authors-count').props.children)).toBe('2 autori'),
    );
    expect(screen.getAllByTestId(/^author-row-/)).toHaveLength(2);
    await fireEvent.changeText(screen.getByTestId('authors-search'), 'gura de aur');
    await waitFor(() =>
      expect(plain(screen.getByTestId('authors-count').props.children)).toBe('1 autor'),
    );
  });

  it('says so when no name matches', async () => {
    await renderAuthors();
    await fireEvent.changeText(screen.getByTestId('authors-search'), 'zzzzqq');
    expect(await screen.findByText(t.authorsPage.empty)).toBeTruthy();
    expect(screen.queryAllByTestId(/^author-row-/)).toHaveLength(0);
  });

  it('opens with the search of the address', async () => {
    setMockParams({ q: 'baxter' });
    await renderAuthors();
    expect(screen.getByTestId('authors-search').props.value).toBe('baxter');
    expect(plain(screen.getByTestId('authors-count').props.children)).toBe('1 autor');
  });

  it('is written in English, with the names in the reading language', async () => {
    await renderAuthors(
      {},
      { store: createSettingsStore({ uiLanguage: 'en', readingLanguage: 'en' }) },
    );
    await waitFor(() => expect(screen.getByText(en.authorsPage.title)).toBeTruthy());
    expect(screen.getByTestId('author-row-ioan-gura-de-aur')).toBeTruthy();
    expect(
      within(screen.getByTestId('author-row-ioan-gura-de-aur')).getByText('John Chrysostom'),
    ).toBeTruthy();
  });
});

describe('the list of authors', () => {
  it('leaves out the issuing bodies and the names that have no work', async () => {
    const library = syntheticLibrary();
    const loaded = await library.load();
    const works = await loaded.repository.listWorks('ro');
    const catalogue = loaded.catalogue.status === 'verified' ? loaded.catalogue.catalogue : null;
    const model = buildLibraryModel(works, catalogue, 'ro');
    expect(authorsOf(model)).toHaveLength(15);
    expect(authorsOf(model).every((group) => group.kind !== 'body')).toBe(true);
  });

  it('filters by any form of the name and keeps the order', async () => {
    const library = syntheticLibrary();
    const loaded = await library.load();
    const works = await loaded.repository.listWorks('ro');
    const catalogue = loaded.catalogue.status === 'verified' ? loaded.catalogue.catalogue : null;
    const authors = authorsOf(buildLibraryModel(works, catalogue, 'ro'));
    expect(filterAuthors(authors, '')).toHaveLength(15);
    expect(filterAuthors(authors, '   ')).toHaveLength(15);
    expect(filterAuthors(authors, 'ioan').map((group) => group.slug)).toEqual([
      'ioan-calvin',
      'ioan-damaschin',
      'ioan-gura-de-aur',
    ]);
    // The original form of a name is searched, too.
    expect(filterAuthors(authors, 'aurelius').map((group) => group.slug)).toEqual(['augustin']);
    // So is the English form.
    expect(filterAuthors(authors, 'chrysostom').map((group) => group.slug)).toEqual([
      'ioan-gura-de-aur',
    ]);
  });
});
