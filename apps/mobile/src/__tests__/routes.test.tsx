import { readdirSync } from 'fs';
import { join } from 'path';
import { fireEvent, screen, within } from '@testing-library/react-native';

import AboutRoute from '@/app/about/index';
import TransparencyRoute from '@/app/about/transparency';
import AskRoute from '@/app/ask';
import AuthorRoute from '@/app/authors/[slug]';
import AuthorsRoute from '@/app/authors/index';
import BookmarksRoute from '@/app/bookmarks';
import LandingRoute from '@/app/index';
import LibraryAllRoute from '@/app/library/all';
import CuratedRoute from '@/app/library/index';
import SearchRoute from '@/app/search';
import SettingsRoute from '@/app/settings';
import { ComingScreen } from '@/components/coming-screen';
import { FEATURES } from '@/config/features';
import { ro as t } from '@/i18n/ro';
import { liveSections } from '@/shell/sections';
import { resetMockRouter, router } from '@/test-support/expo-router-mock';
import { renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

beforeEach(() => {
  resetMockRouter();
});

/** The files under `src/app`, as the router sees them (docs/ui-spec-v2.md, 4.4). */
function routeFiles(directory = join(__dirname, '..', 'app'), prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? routeFiles(join(directory, entry.name), `${prefix}${entry.name}/`)
      : [`${prefix}${entry.name}`],
  );
}

describe('the route tree (docs/ui-spec-v2.md, 4.4)', () => {
  it('has a route for every page of the table, and the landing is "/"', () => {
    expect(routeFiles().sort()).toEqual(
      [
        '+not-found.tsx',
        '_layout.tsx',
        'about/index.tsx',
        'about/transparency.tsx',
        'ask.tsx',
        'authors/[slug].tsx',
        'authors/index.tsx',
        'bookmarks.tsx',
        'index.tsx',
        'library/all.tsx',
        'library/index.tsx',
        'read/[id]/[section].tsx',
        'search.tsx',
        'settings.tsx',
        'work/[id].tsx',
      ].sort(),
    );
  });

  it('draws the landing at "/", the curated library at /library and the whole one at /library/all', async () => {
    await renderWithProviders(<LandingRoute />);
    expect(screen.getByTestId('hero-cta-primary')).toBeTruthy();
    await screen.unmount();

    await renderWithProviders(<CuratedRoute />);
    expect(within(screen.getByTestId('library-hero')).getByText(t.library.heroTitle)).toBeTruthy();
    await screen.unmount();

    await renderWithProviders(<LibraryAllRoute />);
    expect(await screen.findByTestId('library-count')).toBeTruthy();
  });

  it('draws the authors, search and settings routes', async () => {
    await renderWithProviders(<AuthorsRoute />);
    expect(await screen.findByTestId('authors-count')).toBeTruthy();
    await screen.unmount();

    await renderWithProviders(<SearchRoute />);
    expect(screen.getByTestId('search-hero')).toBeTruthy();
    await screen.unmount();

    await renderWithProviders(<SettingsRoute />);
    expect((await screen.findAllByText(t.settings.title)).length).toBeGreaterThan(0);
  });
});

describe('the policy page (check Q3)', () => {
  it('draws the eight commitments, the Ask block and the report button at /about/transparency', async () => {
    await renderWithProviders(<TransparencyRoute />);
    expect(screen.getByRole('header', { name: t.transparency.pageTitle })).toBeTruthy();
    for (let n = 1; n <= 8; n += 1) expect(screen.getByTestId(`commitment-${n}`)).toBeTruthy();
    expect(screen.getByTestId('commitment-ask')).toBeTruthy();
    expect(screen.getByTestId('transparency-page-report')).toBeTruthy();
  });
});

describe('the sections that are not built yet', () => {
  const coming: [string, () => React.JSX.Element, string][] = [
    ['/ask', AskRoute, t.nav.ask],
    ['/bookmarks', BookmarksRoute, t.nav.bookmarks],
    ['/about', AboutRoute, t.nav.aboutLibrary],
    ['/authors/[slug]', AuthorRoute, t.nav.authors],
  ];

  it.each(coming)(
    '%s says it is coming instead of being "not found"',
    async (_path, Route, title) => {
      await renderWithProviders(<Route />);
      expect(screen.getByRole('header', { name: title })).toBeTruthy();
      expect(screen.getByText(t.coming.text)).toBeTruthy();
    },
  );

  it('has a way back to the library on the page', async () => {
    await renderWithProviders(<ComingScreen label="ask" />);
    await fireEvent.press(screen.getByLabelText(t.common.backToLibrary));
    expect(router.push).toHaveBeenCalledWith('/library');
  });

  it('is not led to by anything in the interface while the flags are off (nothing dead)', () => {
    const live = liveSections(FEATURES);
    const paths = live.flatMap((section) =>
      section.entries ? section.entries.map((entry) => entry.path) : [section.path],
    );
    for (const [path] of coming) {
      if (path.includes('[')) continue;
      expect(paths).not.toContain(path);
    }
  });
});
