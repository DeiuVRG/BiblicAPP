import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { WorkSummary } from '@/content/types';
import { LibraryAllScreen } from '@/features/library/library-all-screen';
import { PAGE_SIZE, buildLibraryModel } from '@/library/model';
import { resetMockRouter } from '@/test-support/expo-router-mock';
import { renderWithProviders } from '@/test-support/render';

// More than one hundred authors are paged (docs/ui-spec-v2.md, 6.2): the model is made up here, a
// hundred and five people with one work each, and the screen reads it through `useLibrary`.

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

const AUTHORS = 105;

function summary(index: number): WorkSummary {
  return {
    workId: `w${index}`,
    slug: `lucrare-${index}`,
    titleRo: `Lucrarea ${index}`,
    titleOrig: `Work ${index}`,
    authorName: `Autor ${String(index).padStart(3, '0')}`,
    authorBorn: null,
    authorDied: null,
    year: 1500,
    languageOrig: 'en',
    editions: [],
    primaryEditionId: `e${index}`,
  };
}

jest.mock('@/library/use-library', () => ({
  useLibrary: () => ({
    status: 'ready',
    data: {
      model: jest
        .requireActual<typeof import('@/library/model')>('@/library/model')
        .buildLibraryModel(
          Array.from({ length: 105 }, (_, index) => ({
            workId: `w${index + 1}`,
            slug: `lucrare-${index + 1}`,
            titleRo: `Lucrarea ${index + 1}`,
            titleOrig: `Work ${index + 1}`,
            authorName: `Autor ${String(index + 1).padStart(3, '0')}`,
            authorBorn: null,
            authorDied: null,
            year: 1500,
            languageOrig: 'en',
            editions: [],
            primaryEditionId: `e${index + 1}`,
          })),
          null,
          'ro',
        ),
      unverified: 0,
      catalogue: 'missing',
    },
  }),
}));

beforeEach(() => {
  resetMockRouter();
});

const authorsShown = () =>
  within(screen.getByTestId('author-list'))
    .getAllByTestId(/^author-accordion-/)
    .filter((node) => !String(node.props.testID).endsWith('-toggle'));

describe('the pager of Toată biblioteca', () => {
  it('has the data it needs: more authors than a page', () => {
    const model = buildLibraryModel([summary(1)], null, 'ro');
    expect(model.groups).toHaveLength(1);
    expect(AUTHORS).toBeGreaterThan(PAGE_SIZE);
  });

  it('shows a hundred authors on the first page and the pager under them', async () => {
    await renderWithProviders(<LibraryAllScreen />);
    expect(authorsShown()).toHaveLength(PAGE_SIZE);
    const pager = within(screen.getByTestId('pager'));
    expect(screen.getByTestId('pager').props.accessibilityLabel).toBe('Pagini');
    expect(pager.getByTestId('pager-1')).toBeTruthy();
    expect(pager.getByTestId('pager-2')).toBeTruthy();
    expect(pager.queryByTestId('pager-3')).toBeNull();
    expect(pager.getByTestId('pager-previous').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(pager.getByTestId('pager-next').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('goes to the second page with the five that are left, and back', async () => {
    await renderWithProviders(<LibraryAllScreen />);
    await fireEvent.press(screen.getByTestId('pager-next'));
    expect(authorsShown()).toHaveLength(AUTHORS - PAGE_SIZE);
    expect(screen.getByTestId('pager-next').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.press(screen.getByTestId('pager-previous'));
    expect(authorsShown()).toHaveLength(PAGE_SIZE);
    await fireEvent.press(screen.getByTestId('pager-2'));
    expect(authorsShown()).toHaveLength(AUTHORS - PAGE_SIZE);
  });

  it('names a page for a screen reader', async () => {
    await renderWithProviders(<LibraryAllScreen />);
    expect(screen.getByTestId('pager-2').props.accessibilityLabel).toBe('Pagina 2');
  });

  it('opens every accordion only up to twelve authors, so none of these is open', async () => {
    await renderWithProviders(<LibraryAllScreen />);
    expect(screen.queryAllByTestId(/^library-row-/)).toHaveLength(0);
  });

  it('forgets the page when a filter changes', async () => {
    await renderWithProviders(<LibraryAllScreen />);
    await fireEvent.press(screen.getByTestId('pager-2'));
    expect(authorsShown()).toHaveLength(AUTHORS - PAGE_SIZE);
    await fireEvent.changeText(screen.getByTestId('library-search'), 'Autor 104');
    // One author is left: no pager. Clearing the name brings back the first page, not the second.
    await waitFor(() => expect(screen.queryByTestId('pager')).toBeNull());
    expect(authorsShown()).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('library-search-clear'));
    await waitFor(() => expect(screen.getByTestId('pager')).toBeTruthy());
    expect(authorsShown()).toHaveLength(PAGE_SIZE);
  });
});
