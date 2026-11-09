import { cleanup, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import NotFoundRoute from '@/app/+not-found';
import { formatPageTitle } from '@/components/page-title';
import { loadBundledRepository } from '@/content/repository';
import { LandingScreen } from '@/features/landing/landing-screen';
import { LibraryAllScreen } from '@/features/library/library-all-screen';
import { ReaderScreen } from '@/features/reader/reader-screen';
import { SearchScreen } from '@/features/search/search-screen';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { WorkScreen } from '@/features/work/work-screen';
import { en } from '@/i18n/en';
import { ro as t } from '@/i18n/ro';
import { PROSE_MAX_WIDTH } from '@/theme/layout';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';
import { vosEditions } from '@/test-support/vos';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

describe('page titles (the browser tab)', () => {
  // The shell listens for keys on the document (`/`, Esc), so the stand-in has the listener methods.
  let fakeDocument: {
    title: string;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
  };
  let replaced: { restore(): void };

  beforeEach(() => {
    fakeDocument = {
      title: 'Biblioteca',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    (globalThis as { document?: unknown }).document = fakeDocument;
    replaced = jest.replaceProperty(Platform, 'OS', 'web');
  });

  afterEach(async () => {
    // Unmount first: the shell removes its key listeners from the document when it goes.
    await cleanup();
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

  it('names the landing, library, search, settings and not-found tabs', async () => {
    await renderWithProviders(<LandingScreen />);
    expect(fakeDocument.title).toBe('Biblioteca');

    fakeDocument.title = '';
    await renderWithProviders(<LibraryAllScreen />);
    expect(fakeDocument.title).toBe('Toată biblioteca · Biblioteca');

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
    await renderWithProviders(<LibraryAllScreen />, { store });
    await screen.findByText(en.library.allTitle);
    expect(fakeDocument.title).toBe('Full library · Biblioteca');

    await renderWithProviders(<SettingsScreen />, { store });
    // ("About" is also an item of the section bar once the policy pages are delivered.)
    await screen.findByLabelText('Interface language');
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
