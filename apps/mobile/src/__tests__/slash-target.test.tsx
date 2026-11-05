import { cleanup, screen } from '@testing-library/react-native';

import { AuthorsScreen } from '@/features/library/authors-screen';
import { CuratedScreen } from '@/features/library/curated-screen';
import { LibraryAllScreen } from '@/features/library/library-all-screen';
import { SearchScreen } from '@/features/search/search-screen';
import { getSlashTarget, setSlashTarget } from '@/shell/slash-target';
import { MockScreen, resetMockRouter } from '@/test-support/expo-router-mock';
import { syntheticLibrary } from '@/test-support/library-fixtures';
import { renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

// The shortcut `/` (docs/ui-spec-v2.md, 6.5 and 10): "focuses the field from anywhere on web". The
// brand bar opens the search page unless the screen in focus has registered a field of its own,
// and every screen that has one must: Selecție and the authors page did not.

/** Under Jest every element answers `focus` with this one shared mock: it counts the moves. */
const focusMock = () =>
  jest.requireActual<{ default: { focus: jest.Mock } }>(
    '@react-native/jest-preset/jest/MockNativeMethods',
  ).default.focus;

beforeEach(() => {
  resetMockRouter();
  setSlashTarget(null);
  focusMock().mockClear();
});

const SCREENS: [string, () => React.JSX.Element, string][] = [
  ['Selecție (the hero form)', CuratedScreen, 'library-hero-search'],
  ['Toată biblioteca', LibraryAllScreen, 'library-search'],
  ['Autori', AuthorsScreen, 'authors-search'],
  ['Căutare', SearchScreen, 'search-input'],
];

describe('the slash shortcut', () => {
  it.each(SCREENS)('%s takes "/" for its field while it is in focus', async (_name, Screen, id) => {
    const loaded = await syntheticLibrary().load();
    await renderWithProviders(<Screen />, { loaded });
    await screen.findByTestId(id);
    const target = getSlashTarget();
    expect(target).not.toBeNull();
    target!.focus();
    expect(focusMock()).toHaveBeenCalledTimes(1);
    // Leaving the screen gives the key back to the search page.
    await cleanup();
    expect(getSlashTarget()).toBeNull();
  });

  it.each(SCREENS)(
    '%s does not take "/" while another screen is on top of it',
    async (_name, Screen, id) => {
      const loaded = await syntheticLibrary().load();
      await renderWithProviders(
        <MockScreen focused={false}>
          <Screen />
        </MockScreen>,
        { loaded },
      );
      await screen.findByTestId(id);
      expect(getSlashTarget()).toBeNull();
    },
  );
});
