import { act, fireEvent, screen } from '@testing-library/react-native';
import type { NativeStackHeaderProps } from 'expo-router';
import { Dimensions, Platform } from 'react-native';

import NotFoundRoute from '@/app/+not-found';
import { AppHeader } from '@/components/app-header';
import { formatPageTitle } from '@/components/page-title';
import { loadBundledRepository } from '@/content/repository';
import { LibraryScreen } from '@/features/library/library-screen';
import { ReaderScreen } from '@/features/reader/reader-screen';
import { SearchScreen } from '@/features/search/search-screen';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { WorkScreen } from '@/features/work/work-screen';
import { en } from '@/i18n/en';
import { ro as t } from '@/i18n/ro';
import { FontsProvider, loadedFonts } from '@/theme/fonts';
import { PROSE_MAX_WIDTH } from '@/theme/layout';
import { palettes } from '@/theme/palettes';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';
import { vosEditions } from '@/test-support/vos';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

function headerProps(name: string, title: string, back = true): NativeStackHeaderProps {
  return {
    options: { title },
    route: { key: name, name },
    back: back ? { title: 'Înapoi', href: undefined } : undefined,
    navigation: { goBack: jest.fn() },
  } as unknown as NativeStackHeaderProps;
}

const original = Dimensions.get('window');

afterEach(async () => {
  // Still mounted here (the automatic cleanup runs later): the update has to go through act.
  await act(async () => {
    Dimensions.set({ window: original });
  });
});

describe('AppHeader (web)', () => {
  const longTitle = 'Învățătura lui Isus despre Împărăția lui Dumnezeu și Biserică';

  it('sets a page title as a serif heading, on one line', async () => {
    await renderWithProviders(
      <FontsProvider value={loadedFonts}>
        <AppHeader {...headerProps('settings', 'Setări')} />
      </FontsProvider>,
    );
    const title = screen.getByTestId('header-title');
    expect(title).toHaveStyle({
      fontFamily: 'Literata_600SemiBold',
      fontSize: 20,
      color: palettes.light.text,
    });
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.accessibilityRole).toBe('header');
    expect(title.props['aria-level']).toBe(1);
  });

  it('sets the work title in the reader as a muted italic running head, on two lines on a phone', async () => {
    await renderWithProviders(
      <FontsProvider value={loadedFonts}>
        <AppHeader {...headerProps('read/[id]/[section]', longTitle)} />
      </FontsProvider>,
    );
    const title = screen.getByTestId('header-title');
    expect(title).toHaveStyle({
      fontFamily: 'Literata_400Regular_Italic',
      fontSize: 15,
      color: palettes.light.textMuted,
    });
    // Two lines break between words; one line cut off mid-word was the problem.
    expect(title.props.numberOfLines).toBe(2);
    // It is still the one level-1 heading of the page.
    expect(title.props.accessibilityRole).toBe('header');
    expect(title.props['aria-level']).toBe(1);
    expect(title).toHaveTextContent(longTitle);
  });

  it('keeps the running head on one line where it fits (wide windows)', async () => {
    Dimensions.set({ window: { ...original, width: 1280 } });
    await renderWithProviders(<AppHeader {...headerProps('read/[id]/[section]', longTitle)} />);
    expect(screen.getByTestId('header-title').props.numberOfLines).toBe(1);
  });

  it('keeps the text inside the gutter on the right, like the arrow on the left', async () => {
    await renderWithProviders(<AppHeader {...headerProps('settings', 'Setări')} />);
    expect(screen.getByTestId('header-title')).toHaveStyle({ marginRight: 10 });
  });

  it('lets the header grow with the text instead of clipping it (large system fonts)', async () => {
    await renderWithProviders(<AppHeader {...headerProps('settings', 'Setări')} />);
    const bar = screen.getByTestId('app-header');
    expect(bar).toHaveStyle({ minHeight: 56 });
    expect(bar.props.style).not.toEqual(expect.objectContaining({ height: expect.anything() }));
  });

  it('offers the way back to the library when there is no history, and goes back when there is', async () => {
    const withHistory = headerProps('settings', 'Setări');
    const { unmount } = await renderWithProviders(<AppHeader {...withHistory} />);
    await fireEvent.press(screen.getByLabelText(t.common.back));
    expect(withHistory.navigation.goBack).toHaveBeenCalled();
    unmount();

    await renderWithProviders(<AppHeader {...headerProps('settings', 'Setări', false)} />);
    expect(screen.getByLabelText(t.common.backToLibrary)).toBeTruthy();
  });
});

describe('page titles (the browser tab)', () => {
  let fakeDocument: { title: string };
  let replaced: { restore(): void };

  beforeEach(() => {
    fakeDocument = { title: 'Biblioteca' };
    (globalThis as { document?: unknown }).document = fakeDocument;
    replaced = jest.replaceProperty(Platform, 'OS', 'web');
  });

  afterEach(() => {
    replaced.restore();
    delete (globalThis as { document?: unknown }).document;
  });

  it('puts the name of the page first and the name of the app last, once', () => {
    const app = t.appName;
    expect(formatPageTitle(['Setări'], app)).toBe('Setări · Biblioteca');
    expect(formatPageTitle(['I. Introductory', 'Învățătura lui Isus'], app)).toBe(
      'I. Introductory · Învățătura lui Isus · Biblioteca',
    );
    expect(formatPageTitle(['Biblioteca'], app)).toBe('Biblioteca');
    expect(formatPageTitle([], app)).toBe('Biblioteca');
    expect(formatPageTitle(['  ', 'Căutare '], app)).toBe('Căutare · Biblioteca');
  });

  it('names the library, search, settings and not-found tabs', async () => {
    await renderWithProviders(<LibraryScreen />);
    expect(fakeDocument.title).toBe('Biblioteca');

    fakeDocument.title = '';
    await renderWithProviders(<SearchScreen />);
    expect(fakeDocument.title).toBe('Căutare · Biblioteca');

    fakeDocument.title = '';
    await renderWithProviders(<SettingsScreen />);
    expect(fakeDocument.title).toBe('Setări · Biblioteca');

    fakeDocument.title = '';
    await renderWithProviders(<NotFoundRoute />);
    expect(fakeDocument.title).toBe('Pagină negăsită · Biblioteca');
  });

  it('names the work page after the work and the reader after the chapter and the work', async () => {
    const { repository } = await loadBundledRepository();
    const { work, englishSections } = await vosEditions(repository);
    const first = englishSections[0]!;

    await renderWithProviders(<WorkScreen workId={work.workId} />);
    await screen.findByLabelText('Începe lectura');
    expect(fakeDocument.title).toBe(`${work.titleRo} · Biblioteca`);

    fakeDocument.title = '';
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={first.id} />);
    await screen.findByRole('progressbar');
    expect(fakeDocument.title).toBe(`${first.heading} · ${work.titleRo} · Biblioteca`);
  });

  it('names the work in the reading language in the tab', async () => {
    const { repository } = await loadBundledRepository();
    const { work, englishSections } = await vosEditions(repository);
    const store = createSettingsStore({ readingLanguage: 'en' });

    await renderWithProviders(<WorkScreen workId={work.workId} />, { store });
    await screen.findByLabelText('Începe lectura');
    expect(fakeDocument.title).toBe(`${work.titleOrig} · Biblioteca`);

    fakeDocument.title = '';
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[0]!.id} />,
      { store },
    );
    await screen.findByRole('progressbar');
    expect(fakeDocument.title).toBe(
      `${englishSections[0]!.heading} · ${work.titleOrig} · Biblioteca`,
    );
  });

  it('names the tabs in the language of the interface', async () => {
    const store = createSettingsStore({ uiLanguage: 'en' });
    await renderWithProviders(<LibraryScreen />, { store });
    await screen.findByText(en.library.subtitle);
    expect(fakeDocument.title).toBe('Library · Biblioteca');

    await renderWithProviders(<SettingsScreen />, { store });
    await screen.findByText(en.settings.about);
    expect(fakeDocument.title).toBe('Settings · Biblioteca');

    await renderWithProviders(<SearchScreen />, { store });
    expect(fakeDocument.title).toBe('Search · Biblioteca');

    await renderWithProviders(<NotFoundRoute />, { store });
    expect(fakeDocument.title).toBe('Page not found · Biblioteca');
  });

  it('leaves the title alone on iOS and Android, where the native header carries it', async () => {
    replaced.restore();
    await renderWithProviders(<SettingsScreen />);
    expect(fakeDocument.title).toBe('Biblioteca');
    replaced = jest.replaceProperty(Platform, 'OS', 'web');
  });
});

describe('secondary text', () => {
  it('limits the licence note on the work page to a comfortable line length', async () => {
    const { repository } = await loadBundledRepository();
    const { work, english } = await vosEditions(repository);
    const detail = await repository.getEdition(english.editionId);
    await renderWithProviders(<WorkScreen workId={work.workId} editionId={english.editionId} />);
    // The interface is Romanian: the real pack's Romanian note is the one shown.
    expect(detail!.edition.licence.noteRo).toBeTruthy();
    const note = await screen.findByText(detail!.edition.licence.noteRo!);
    expect(note).toHaveStyle({ maxWidth: PROSE_MAX_WIDTH });
  });

  it('limits the licence text in Settings the same way', async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByText(t.settings.licenceNote)).toHaveStyle({
      maxWidth: PROSE_MAX_WIDTH,
    });
  });

  it('writes the pack counts so that no word has to agree with a number', () => {
    expect(t.settings.packs(1, 0)).toBe('Pachete de conținut verificate: 1. Respinse: 0.');
    expect(t.settings.packs(0, 2)).toBe('Pachete de conținut verificate: 0. Respinse: 2.');
    expect(t.settings.packs(21, 1)).not.toMatch(/verificate,/);
  });
});
