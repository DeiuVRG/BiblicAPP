import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pack, Paragraph, Section } from '@biblioteca/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Dimensions, FlatList, Platform, Share } from 'react-native';

import { loadBundledCatalogue } from '@/catalogue/verify-catalogue';
import { loadBundledRepository } from '@/content/repository';
import type { LoadedRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import { ReaderScreen } from '@/features/reader/reader-screen';
import { splitChapterHeading } from '@/reading/heading';
import { FontsProvider, loadedFonts } from '@/theme/fonts';
import { readHref, workHref } from '@/navigation-hrefs';
import { BOOKMARKS_KEY } from '@/reading/bookmarks-store';
import { legacyPositionKey, positionKey, savePosition } from '@/reading/position-store';
import { readUrl } from '@/reading/site-url';
import { resetReaderSessions } from '@/reading/reader-session';
import { SETTINGS_KEY } from '@/settings/settings-store';
import { installFakeDocument } from '@/test-support/fake-document';
import type { FakeDocument } from '@/test-support/fake-document';
import { router, screenOptions } from '@/test-support/expo-router-mock';
import { ro } from '@/i18n/ro';
import {
  bundledPack,
  clone,
  createTestSigner,
  signPack,
  translationOf,
} from '@/test-support/packs';
import { createMemoryStore, createSettingsStore, renderWithProviders } from '@/test-support/render';
import { vosEditions } from '@/test-support/vos';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const signer = createTestSigner();
const englishPack = bundledPack('vos-1903-kingdom-en');
const english = englishPack.pack as Pack;
const sorted = <T extends { ordinal: number }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.ordinal - b.ordinal);

/** The English source (11 sections) and a synthetic Romanian translation of its first three. */
async function twoEditions(sections = 3): Promise<{
  loaded: LoadedRepository;
  workId: string;
  romanian: Pack;
  romanianSections: Section[];
  romanianParagraphs: (sectionId: string) => Paragraph[];
  englishSections: Section[];
  englishParagraphs: (sectionId: string) => Paragraph[];
}> {
  const romanian = translationOf(english, { sections, paragraphsPerSection: 2 });
  const loaded = await loadBundledRepository({
    packs: [englishPack, signPack(romanian, signer, { packId: 'vos-synthetic-ro' })],
    trustedKeys: [...trustedKeys, signer.key],
  });
  return {
    loaded,
    workId: english.work.id,
    romanian,
    romanianSections: sorted(romanian.sections),
    romanianParagraphs: (id) => sorted(romanian.paragraphs.filter((p) => p.sectionId === id)),
    englishSections: sorted(english.sections),
    englishParagraphs: (id) => sorted(english.paragraphs.filter((p) => p.sectionId === id)),
  };
}

/** The real library: Vos in English and Romanian, the bundled catalogue (author, kind). */
const realLibrary = async () => loadBundledRepository({ catalogue: await loadBundledCatalogue() });

const original = Dimensions.get('window');
/** A window of this size (the reader is the desktop layout from 1100, the phone shell up to 880). */
async function setWindow(width: number, height = 900) {
  await act(async () => {
    Dimensions.set({ window: { ...original, width, height } });
  });
}
const WIDE = 1366;
/** The faces of the app are loaded: a style names its font family (without it every family is undefined). */
const withFonts = (ui: React.ReactElement) => (
  <FontsProvider value={loadedFonts}>{ui}</FontsProvider>
);

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  screenOptions.length = 0;
  resetReaderSessions();
});
afterEach(async () => {
  await act(async () => {
    Dimensions.set({ window: original });
  });
  jest.restoreAllMocks();
});
afterAll(async () => {
  await AsyncStorage.clear();
});

describe('ReaderScreen (a wide window)', () => {
  beforeEach(() => setWindow(WIDE));

  it('renders the heading and the paragraphs of the bundled pack, and records the position under the edition', async () => {
    const { repository } = await loadBundledRepository();
    const { work, english: edition, englishSections } = await vosEditions(repository);
    const paragraphs = await repository.getParagraphs(englishSections[0]!.id);
    const store = createMemoryStore();
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[0]!.id} />,
      { store },
    );

    expect(await screen.findByText(paragraphs[0]!.text)).toBeTruthy();
    expect(screen.getAllByRole('header').length).toBeGreaterThan(0);
    expect(screen.getByTestId('progress-bar')).toBeTruthy();
    await waitFor(() => {
      const saved = store.data.get(positionKey(edition.editionId));
      expect(saved).toBeDefined();
      expect(JSON.parse(saved!)).toMatchObject({ sectionId: englishSections[0]!.id });
    });
    // Nothing is written under the work any more.
    expect(store.data.has(legacyPositionKey(work.workId))).toBe(false);
  });

  it('has one level-1 heading, the name of the work, and the title of the chapter is a level 2 (docs/ui-spec-v2.md, 18)', async () => {
    const { repository } = await loadBundledRepository();
    const { work, englishSections } = await vosEditions(repository);
    const paragraphs = await repository.getParagraphs(englishSections[0]!.id);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[0]!.id} />,
    );
    await screen.findByText(paragraphs[0]!.text);
    const levels = screen
      .getAllByRole('header')
      .map((heading) => heading.props['aria-level'] as number | undefined);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    const title = screen.getByTestId('reader-title');
    expect(title.props.accessibilityRole).toBe('header');
    expect(title.props['aria-level']).toBe(1);
    expect(title).toHaveTextContent(work.titleRo);
    // The title of the chapter in its card: "I. Introductory" is "Introductory" under "CHAPTER I" (English text).
    const heading = within(screen.getByTestId('chapter-card')).getByText('Introductory');
    expect(heading.props['aria-level']).toBe(2);
  });

  it('shows the section bar and the toolbar, and no brand bar (the reader has its own toolbar)', async () => {
    const { repository } = await loadBundledRepository();
    const { work, englishSections } = await vosEditions(repository);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[0]!.id} />,
    );
    await screen.findByTestId('reader-toolbar');
    expect(screen.getByTestId('section-bar')).toBeTruthy();
    expect(screen.queryByTestId('brand-bar')).toBeNull();
    // The navigator has no header of its own.
    expect(screenOptions).toEqual([]);
  });

  it('shows a Romanian message for an unknown section and for a work that does not exist', async () => {
    const { repository } = await loadBundledRepository();
    const { work, englishSections } = await vosEditions(repository);
    const first = await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId="missing" />,
    );
    expect(await screen.findByText('Secțiunea nu a fost găsită.')).toBeTruthy();
    await first.unmount();
    await renderWithProviders(
      <ReaderScreen workId="no-such-work" sectionId={englishSections[0]!.id} />,
    );
    const message = await screen.findByText('Secțiunea nu a fost găsită.');
    // The screen has nothing else to name it: the message is its one level-1 heading.
    expect(message.props.accessibilityRole).toBe('header');
    expect(message.props['aria-level']).toBe(1);
  });

  it('has the controls of the toolbar in the order of docs/ui-spec-v2.md 8.2 (check R2), each named', async () => {
    const loaded = await realLibrary();
    const { work, romanianSections } = await vosEditions(loaded.repository);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[0]!.id} />,
      { loaded },
    );
    const toolbar = within(await screen.findByTestId('reader-toolbar'));
    const order = [
      'outline-toggle',
      'reader-title',
      'reader-previous',
      'reader-next',
      'reader-counter',
      'transparency-button',
      'lang-ro',
      'lang-en',
      'lang-pair-toggle',
      'find-button',
      'aa-button',
      'tools-button',
    ];
    const found = toolbar
      .getAllByTestId(new RegExp(`^(${order.join('|')})$`))
      .map((node) => node.props.testID as string);
    expect(found).toEqual(order);
    expect(toolbar.getByLabelText('Arată sau ascunde cuprinsul')).toBeTruthy();
    expect(toolbar.getByLabelText('Capitolul anterior')).toBeTruthy();
    expect(toolbar.getByLabelText('Capitolul următor')).toBeTruthy();
    expect(toolbar.getByLabelText('Număr secțiune')).toBeTruthy();
    expect(toolbar.getByLabelText('Caută în text (/)')).toBeTruthy();
    expect(toolbar.getByLabelText('Aspectul textului: mărime, spațiere, temă')).toBeTruthy();
    expect(toolbar.getByLabelText('Unelte')).toBeTruthy();
    // The author, the years and the edition under the title.
    expect(toolbar.getByText('Geerhardus Vos')).toBeTruthy();
    expect(toolbar.getByText('1862–1949')).toBeTruthy();
    expect(toolbar.getByText('Română · traducere')).toBeTruthy();
  });

  it('has no language control for a work with one edition, and no edition label under the title', async () => {
    const one = await loadBundledRepository({ packs: [englishPack] });
    await renderWithProviders(
      <ReaderScreen workId={english.work.id} sectionId={sorted(english.sections)[0]!.id} />,
      { loaded: one },
    );
    await screen.findByTestId('reader-toolbar');
    expect(screen.queryByTestId('reader-language')).toBeNull();
    expect(screen.queryByTestId('lang-pair-toggle')).toBeNull();
    expect(screen.queryByText('English · original')).toBeNull();
  });

  it('names the work in the reading language', async () => {
    const { loaded, workId, englishSections } = await twoEditions();
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={englishSections[0]!.id} />, {
      loaded,
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    expect(await screen.findByTestId('reader-title')).toHaveTextContent(english.work.titleOrig);
  });

  it('says the transparency button "Transparență AI" for the Romanian Vos edition, and "Transparență" for the English one (R9)', async () => {
    const loaded = await realLibrary();
    const { work, romanianSections, englishSections } = await vosEditions(loaded.repository);
    const first = await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[0]!.id} />,
      { loaded },
    );
    expect(await screen.findByLabelText('Transparență AI')).toBeTruthy();
    await first.unmount();
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[0]!.id} />,
      { loaded },
    );
    expect(await screen.findByLabelText('Transparență')).toBeTruthy();
    expect(screen.queryByLabelText('Transparență AI')).toBeNull();
  });

  it('opens the transparency panel from the toolbar, with the lead note of the kind and the rows (R9)', async () => {
    const loaded = await realLibrary();
    const { work, romanianSections } = await vosEditions(loaded.repository);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[0]!.id} />,
      { loaded },
    );
    await fireEvent.press(await screen.findByTestId('transparency-button'));
    const panel = await screen.findByTestId('transparency-content');
    expect(within(panel).getByTestId('transparency-lead')).toHaveTextContent(
      /^Această traducere a fost făcută de o mașină\./,
    );
    for (const row of [
      'transparency-source',
      'transparency-translation',
      'transparency-review',
      'transparency-corrections',
    ]) {
      expect(within(panel).getByTestId(row)).toBeTruthy();
    }
    expect(within(panel).getByTestId('transparency-review-chip')).toBeTruthy();
  });
});

describe('ReaderScreen: moving through the edition (a wide window)', () => {
  beforeEach(() => setWindow(WIDE));

  it('goes to the next chapter with the next button and disables previous on the first one', async () => {
    const { repository } = await loadBundledRepository();
    const { work, englishSections } = await vosEditions(repository);
    const paragraphs = await repository.getParagraphs(englishSections[0]!.id);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[0]!.id} />,
    );
    await screen.findByText(paragraphs[0]!.text);

    expect(screen.getByLabelText('Capitolul anterior')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Capitolul următor'));
    expect(router.replace).toHaveBeenCalledWith(readHref(work.workId, englishSections[1]!.id));
  });

  it('moves previous and next inside the edition: the last Romanian chapter is the last one', async () => {
    const { loaded, workId, romanianSections, romanianParagraphs } = await twoEditions();
    const last = romanianSections[2]!;
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={last.id} />, { loaded });
    await screen.findByText(romanianParagraphs(last.id)[0]!.text);

    // The work has eleven English chapters, but this edition ends here.
    expect(screen.getByLabelText('Capitolul următor')).toBeDisabled();
    expect(screen.queryByTestId('next-chapter-card')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Capitolul anterior'));
    expect(router.replace).toHaveBeenLastCalledWith(readHref(workId, romanianSections[1]!.id));
    // The counter counts the sections of the edition: "3 / 3".
    expect(screen.getByTestId('reader-counter').props.value).toBe('3');
    expect(within(screen.getByTestId('reader-counter-box')).getByText('/ 3')).toBeTruthy();
  });

  it('does not leave the Romanian edition for the English one when going forward', async () => {
    const { loaded, workId, romanianSections, romanianParagraphs } = await twoEditions();
    const first = romanianSections[0]!;
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={first.id} />, { loaded });
    await screen.findByText(romanianParagraphs(first.id)[0]!.text);
    expect(screen.getByLabelText('Capitolul anterior')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Capitolul următor'));
    expect(router.replace).toHaveBeenLastCalledWith(readHref(workId, romanianSections[1]!.id));
  });

  it('moves inside the English edition as before: eleven chapters', async () => {
    const { loaded, workId, englishSections, englishParagraphs } = await twoEditions();
    const last = englishSections[10]!;
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={last.id} />, { loaded });
    await screen.findByText(englishParagraphs(last.id)[0]!.text);
    expect(screen.getByLabelText('Capitolul următor')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Capitolul anterior'));
    expect(router.replace).toHaveBeenLastCalledWith(readHref(workId, englishSections[9]!.id));
    expect(within(screen.getByTestId('reader-counter-box')).getByText('/ 11')).toBeTruthy();
  });

  it('jumps to a section by its number: Enter goes, letters and numbers out of range do nothing (R4 of 8.2)', async () => {
    const { loaded, workId, englishSections } = await twoEditions();
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={englishSections[0]!.id} />, {
      loaded,
    });
    const input = await screen.findByTestId('reader-counter');
    expect(input.props.value).toBe('1');

    // Letters are not typed.
    await fireEvent.changeText(input, 'ab');
    expect(screen.getByTestId('reader-counter').props.value).toBe('');
    // A number out of range is ignored: the field goes back to the number of the section.
    await fireEvent.changeText(screen.getByTestId('reader-counter'), '99');
    await fireEvent(screen.getByTestId('reader-counter'), 'submitEditing');
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('reader-counter').props.value).toBe('1');
    // A number in range jumps.
    await fireEvent.changeText(screen.getByTestId('reader-counter'), '4');
    await fireEvent(screen.getByTestId('reader-counter'), 'submitEditing');
    expect(router.replace).toHaveBeenLastCalledWith(readHref(workId, englishSections[3]!.id));
  });

  it('ends a chapter with the card "Capitolul următor" and the last one with the end of the work (R17)', async () => {
    const { loaded, workId, englishSections, englishParagraphs } = await twoEditions();
    const first = await renderWithProviders(
      <ReaderScreen workId={workId} sectionId={englishSections[0]!.id} />,
      { loaded },
    );
    await screen.findByText(englishParagraphs(englishSections[0]!.id)[0]!.text);
    // The list draws its footer once it has reached the end: scroll to it.
    const card = await screen
      .findByTestId('next-chapter-card', {}, { timeout: 4000 })
      .catch(() => null);
    if (card) {
      await fireEvent.press(card);
      expect(router.replace).toHaveBeenLastCalledWith(readHref(workId, englishSections[1]!.id));
    }
    await first.unmount();

    const last = englishSections[10]!;
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={last.id} />, { loaded });
    await screen.findByText(englishParagraphs(last.id)[0]!.text);
    // "Ai ajuns la sfârșitul lucrării." with the way back to the contents.
    const end = await screen.findByTestId('end-of-work', {}, { timeout: 4000 });
    expect(within(end).getByText('Ai ajuns la sfârșitul lucrării.')).toBeTruthy();
    await fireEvent.press(within(end).getByText('La cuprins'));
    expect(router.replace).toHaveBeenLastCalledWith(workHref(workId, english.edition.id));
  });

  it('opens a deep link to a section of the other edition, whatever the reading language is', async () => {
    const { loaded, workId, englishSections, englishParagraphs, romanianSections } =
      await twoEditions();
    // The reading language is Romanian (the device of the tests), the link points into English.
    const target = englishSections[4]!;
    const first = await renderWithProviders(
      <ReaderScreen workId={workId} sectionId={target.id} />,
      { loaded },
    );
    expect(await screen.findByText(englishParagraphs(target.id)[0]!.text)).toBeTruthy();
    expect(screen.getByTestId('reader-counter').props.value).toBe('5');
    await first.unmount();

    // And the other way round: English is the reading language, the link points into Romanian.
    const store = createSettingsStore({ readingLanguage: 'en' });
    const romanian = romanianSections[1]!;
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={romanian.id} />, {
      loaded,
      store,
    });
    expect(await screen.findByTestId('chapter-card')).toHaveTextContent(romanian.heading);
    expect(screen.getByTestId('reader-counter').props.value).toBe('2');
  });

  it('shows the not-found state for a section that is not in this work', async () => {
    const { loaded, workId, romanian } = await twoEditions();
    // Another work, with a section of its own.
    const other = clone(romanian);
    other.work = { ...other.work, id: 'another-work-id', slug: 'another-work' };
    other.edition = { ...other.edition, id: 'another-edition-id' };
    const idOf = new Map(other.sections.map((section) => [section.id, `${section.id}-x`]));
    other.sections = other.sections.map((section) => ({ ...section, id: idOf.get(section.id)! }));
    other.paragraphs = other.paragraphs.map((paragraph) => ({
      ...paragraph,
      id: `${paragraph.id}-x`,
      sectionId: idOf.get(paragraph.sectionId)!,
    }));
    const both = await loadBundledRepository({
      packs: [
        englishPack,
        signPack(romanian, signer, { packId: 'vos-synthetic-ro' }),
        signPack(other, signer, { packId: 'another-work-ro' }),
      ],
      trustedKeys: [...trustedKeys, signer.key],
    });
    expect(both.rejected).toEqual([]);
    expect(loaded.rejected).toEqual([]);

    const foreign = other.sections[0]!;
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={foreign.id} />, {
      loaded: both,
    });
    expect(await screen.findByText('Secțiunea nu a fost găsită.')).toBeTruthy();
  });

  it('is written in English with an English interface', async () => {
    const { loaded, workId, romanianSections, romanianParagraphs } = await twoEditions();
    const first = romanianSections[0]!;
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={first.id} />, {
      loaded,
      store: createSettingsStore({ uiLanguage: 'en' }),
    });
    await screen.findByText(romanianParagraphs(first.id)[0]!.text);
    expect(screen.getByLabelText('Previous chapter')).toBeDisabled();
    expect(screen.getByLabelText('Next chapter')).toBeTruthy();
    expect(screen.getByLabelText('Section number')).toBeTruthy();
    expect(screen.getByLabelText('Text appearance: size, spacing, theme')).toBeTruthy();
    expect(screen.getByLabelText('Find in text (/)')).toBeTruthy();
    expect(screen.getByLabelText('Tools')).toBeTruthy();
    // The edition label in its own language, the role in the interface language.
    expect(
      within(screen.getByTestId('reader-toolbar')).getByText('Română · translation'),
    ).toBeTruthy();
  });

  it('marks the language of the text on web, so a screen reader voices it in that language', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const { loaded, workId, englishSections, englishParagraphs } = await twoEditions();
      const first = englishSections[0]!;
      await renderWithProviders(<ReaderScreen workId={workId} sectionId={first.id} />, { loaded });
      const paragraph = await screen.findByText(englishParagraphs(first.id)[0]!.text);
      // A Romanian interface around an English text.
      expect(paragraph.props.lang).toBe('en');
      expect(within(screen.getByTestId('chapter-card')).getByText('Introductory').props.lang).toBe(
        'en',
      );
    } finally {
      replaced.restore();
    }
  });
});

describe('ReaderScreen: the type (R3, R4, R10)', () => {
  /** The paragraph that is the first of the first Vos chapter, as drawn. */
  const firstText = async () => {
    const { repository } = await loadBundledRepository();
    const { work, englishSections } = await vosEditions(repository);
    const paragraphs = await repository.getParagraphs(englishSections[0]!.id);
    return { work, section: englishSections[0]!, paragraph: paragraphs[0]! };
  };

  it('sets a fresh profile in 20 at 1366 and in 17 on a phone, at a line height of 1.55 (R3)', async () => {
    const { work, section, paragraph } = await firstText();
    await setWindow(1366);
    const wide = await renderWithProviders(
      withFonts(<ReaderScreen workId={work.workId} sectionId={section.id} />),
    );
    expect(await screen.findByText(paragraph.text)).toHaveStyle({
      fontSize: 20,
      lineHeight: 31,
      fontFamily: 'SourceSerif4_400Regular',
    });
    await wide.unmount();

    await setWindow(390, 844);
    await renderWithProviders(
      withFonts(<ReaderScreen workId={work.workId} sectionId={section.id} />),
    );
    expect(await screen.findByText(paragraph.text)).toHaveStyle({ fontSize: 17, lineHeight: 26 });
  });

  it('keeps a size the reader chose, whatever the window, and a looser line height in the dark theme', async () => {
    const { work, section, paragraph } = await firstText();
    await setWindow(1366);
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={section.id} />, {
      store: createSettingsStore({ fontSize: 24, theme: 'dark' }),
    });
    // 24 px, and 1.68 in dark: 40 points.
    expect(await screen.findByText(paragraph.text)).toHaveStyle({ fontSize: 24, lineHeight: 40 });
  });

  it('sets the chapter in a card: the eyebrow over the title at 1.42 em in 600 (R4)', async () => {
    const { repository } = await loadBundledRepository();
    const { work, romanianSections } = await vosEditions(repository);
    await setWindow(1366);
    await renderWithProviders(
      withFonts(<ReaderScreen workId={work.workId} sectionId={romanianSections[0]!.id} />),
    );
    const card = within(await screen.findByTestId('chapter-card'));
    const eyebrow = card.getByText('Capitolul I');
    expect(eyebrow).toHaveStyle({ textTransform: 'uppercase' });
    expect(card.getByText('Introducere')).toHaveStyle({
      // 1.42 em of 20.
      fontSize: 28.4,
      fontFamily: 'SourceSerif4_600SemiBold',
    });
    expect(screen.getByTestId('chapter-card')).toHaveStyle({ borderWidth: 1 });
  });

  it('draws a chapter title of a long heading smaller (1.1 em)', async () => {
    const { repository } = await loadBundledRepository();
    const { work, romanianSections } = await vosEditions(repository);
    const long = romanianSections.find(
      (section) => splitChapterHeading(section.heading).title.length > 80,
    )!;
    expect(long).toBeTruthy();
    await setWindow(1366);
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={long.id} />);
    const card = within(await screen.findByTestId('chapter-card'));
    const title = card.getByText(splitChapterHeading(long.heading).title);
    // 1.1 em of 20.
    expect(title).toHaveStyle({ fontSize: 22 });
  });

  it('changes the size, the spacing, the face and the theme from the Aa popover, at once and for good (R10)', async () => {
    const { work, section, paragraph } = await firstText();
    await setWindow(1366);
    const store = createMemoryStore();
    await renderWithProviders(
      withFonts(<ReaderScreen workId={work.workId} sectionId={section.id} />),
      {
        store,
      },
    );
    const toggle = await screen.findByTestId('aa-button');
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(toggle);
    expect(screen.getByTestId('aa-button').props.accessibilityState).toMatchObject({
      expanded: true,
    });
    const panel = within(screen.getByTestId('typography-panel'));

    // The size: A+ four times, 20 to 24.
    for (let i = 0; i < 4; i += 1) await fireEvent.press(panel.getByTestId('aa-larger'));
    expect(screen.getByText(paragraph.text)).toHaveStyle({ fontSize: 24 });
    expect(panel.getByTestId('aa-size')).toHaveTextContent('24 pt');
    // The spacing: "Aerisit" is 1.85 (44 points at 24).
    await fireEvent.press(panel.getByLabelText('Aerisit'));
    expect(screen.getByText(paragraph.text)).toHaveStyle({ lineHeight: 44 });
    // The face and the theme.
    await fireEvent.press(panel.getByLabelText('Literata'));
    expect(screen.getByText(paragraph.text)).toHaveStyle({ fontFamily: 'Literata_400Regular' });
    await fireEvent.press(panel.getByLabelText('Sepia'));

    await waitFor(() => {
      const saved = JSON.parse(store.data.get(SETTINGS_KEY)!);
      expect(saved).toMatchObject({
        fontSize: 24,
        lineSpacing: 'relaxed',
        readingFont: 'literata',
        theme: 'sepia',
      });
    });
    // The popover offers no stepper beyond 14 and 34.
    for (let i = 0; i < 12; i += 1) await fireEvent.press(panel.getByTestId('aa-larger'));
    expect(panel.getByTestId('aa-size')).toHaveTextContent('34 pt');
    expect(panel.getByTestId('aa-larger')).toBeDisabled();
  });
});

describe('ReaderScreen: the outline panel (R5)', () => {
  beforeEach(() => setWindow(WIDE));

  const open = async () => {
    const loaded = await realLibrary();
    const { work, englishSections } = await vosEditions(loaded.repository);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[2]!.id} />,
      { loaded },
    );
    await screen.findByTestId('outline-panel');
    return { work, englishSections };
  };

  it('is in the flow on a desktop with its tab, its search, its count and its entries', async () => {
    const { englishSections } = await open();
    const panel = within(screen.getByTestId('outline-panel'));
    expect(panel.getByTestId('outline-tab-contents').props.accessibilityState.selected).toBe(true);
    expect(panel.getByTestId('outline-search')).toBeTruthy();
    expect(panel.getByTestId('outline-count')).toHaveTextContent('11 intrări în cuprins');
    expect(panel.getAllByTestId(/^outline-entry-/)).toHaveLength(englishSections.length);
    expect(panel.getByLabelText('Arată curentul')).toBeTruthy();
    // An outline without branches has no "Desfășoară tot".
    expect(panel.queryByTestId('outline-expand-all')).toBeNull();
  });

  it('marks the current entry: selected, aria-current="location"', async () => {
    const { englishSections } = await open();
    const current = screen.getByTestId(`outline-entry-${englishSections[2]!.id}`);
    expect(current.props.accessibilityState.selected).toBe(true);
    expect(current.props['aria-current']).toBe('location');
    const other = screen.getByTestId(`outline-entry-${englishSections[3]!.id}`);
    expect(other.props.accessibilityState.selected).toBe(false);
    expect(other.props['aria-current']).toBeUndefined();
  });

  it('filters the headings as the reader types, says how many match and what to do when none does', async () => {
    const { englishSections } = await open();
    const field = screen.getByTestId('outline-search');
    await fireEvent.changeText(field, 'kingdom');
    const matching = englishSections.filter((section) => /kingdom/i.test(section.heading));
    expect(
      within(screen.getByTestId('outline-panel')).getAllByTestId(/^outline-entry-/),
    ).toHaveLength(matching.length);
    expect(screen.getByTestId('outline-count')).toHaveTextContent(
      matching.length === 1 ? '1 titlu găsit' : `${matching.length} titluri găsite`,
    );
    await fireEvent.changeText(screen.getByTestId('outline-search'), 'zzzzzz');
    expect(screen.getByTestId('outline-count')).toHaveTextContent('Niciun titlu nu se potrivește.');
    // Clearing brings everything back.
    await fireEvent.changeText(screen.getByTestId('outline-search'), '');
    expect(screen.getByTestId('outline-count')).toHaveTextContent('11 intrări în cuprins');
  });

  it('opens the first match with Enter, and an entry with a press, and stays open on a desktop', async () => {
    const { work, englishSections } = await open();
    await fireEvent.changeText(screen.getByTestId('outline-search'), 'chapter');
    await fireEvent(screen.getByTestId('outline-search'), 'submitEditing');
    // "Chapter" is in none of the English headings here: no match, nothing opens.
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('outline-search'), '');
    await fireEvent.press(screen.getByTestId(`outline-entry-${englishSections[5]!.id}`));
    expect(router.replace).toHaveBeenLastCalledWith(readHref(work.workId, englishSections[5]!.id));
    expect(screen.getByTestId('outline-panel')).toBeTruthy();
  });

  it('is hidden by "Ascunde cuprinsul" and by the outline button, and remembered for the work', async () => {
    await open();
    await fireEvent.press(
      within(screen.getByTestId('outline-panel')).getByLabelText('Ascunde cuprinsul'),
    );
    expect(screen.queryByTestId('outline-panel')).toBeNull();
    expect(screen.getByTestId('outline-toggle').props.accessibilityState).toMatchObject({
      expanded: false,
    });
    await fireEvent.press(screen.getByTestId('outline-toggle'));
    expect(screen.getByTestId('outline-panel')).toBeTruthy();
  });

  it('lists a tree with branches, opens the ones above the current entry, and has "Desfășoară tot" and "Pliază tot"', async () => {
    const tree = clone(english);
    const sections = sorted(tree.sections);
    // The second and third sections become children of the first.
    sections[1]!.parentId = sections[0]!.id;
    sections[2]!.parentId = sections[0]!.id;
    const loaded = await loadBundledRepository({
      packs: [signPack(tree, signer, { packId: 'vos-tree' })],
      trustedKeys: [...trustedKeys, signer.key],
    });
    await renderWithProviders(<ReaderScreen workId={tree.work.id} sectionId={sections[2]!.id} />, {
      loaded,
    });
    const panel = within(await screen.findByTestId('outline-panel'));
    // The current entry is inside the branch: the branch is open.
    expect(panel.getByTestId(`outline-entry-${sections[2]!.id}`)).toBeTruthy();
    expect(panel.getByTestId(`outline-entry-${sections[1]!.id}`)).toBeTruthy();
    await fireEvent.press(panel.getByTestId('outline-collapse-all'));
    expect(panel.queryByTestId(`outline-entry-${sections[1]!.id}`)).toBeNull();
    await fireEvent.press(panel.getByTestId('outline-expand-all'));
    expect(panel.getByTestId(`outline-entry-${sections[1]!.id}`)).toBeTruthy();
    // A branch has a button named after it.
    expect(panel.getByLabelText(`Pliază ${sections[0]!.heading}`)).toBeTruthy();
    await fireEvent.press(panel.getByLabelText(`Pliază ${sections[0]!.heading}`));
    expect(panel.getByLabelText(`Desfășoară ${sections[0]!.heading}`)).toBeTruthy();
  });
});

describe('ReaderScreen: find in text (R11)', () => {
  beforeEach(() => setWindow(WIDE));

  const open = async (sectionIndex = 0) => {
    const loaded = await realLibrary();
    const { work, englishSections } = await vosEditions(loaded.repository);
    const store = createMemoryStore();
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[sectionIndex]!.id} />,
      { loaded, store },
    );
    await screen.findByTestId('reader-toolbar');
    return { work, englishSections, loaded };
  };

  it('opens from the toolbar with its prompt and its help line, and closes with ×', async () => {
    await open();
    expect(screen.queryByTestId('find-bar')).toBeNull();
    await fireEvent.press(screen.getByTestId('find-button'));
    const bar = within(screen.getByTestId('find-bar'));
    expect(bar.getByTestId('find-status')).toHaveTextContent('Caută un cuvânt sau o expresie');
    expect(bar.getByText('Caută în toată ediția, fără conexiune la internet.')).toBeTruthy();
    expect(bar.getByTestId('find-previous')).toBeDisabled();
    expect(bar.getByTestId('find-next')).toBeDisabled();
    await fireEvent.press(bar.getByTestId('find-close'));
    expect(screen.queryByTestId('find-bar')).toBeNull();
  });

  it('says what to do for one or two characters, and searches three by itself, over the whole edition', async () => {
    const { loaded } = await open();
    await fireEvent.press(screen.getByTestId('find-button'));
    await fireEvent.changeText(screen.getByTestId('find-input'), 'ki');
    expect(screen.getByTestId('find-status')).toHaveTextContent('Apasă Enter pentru a căuta „ki”');

    await fireEvent.changeText(screen.getByTestId('find-input'), 'kingdom');
    const { repository } = loaded;
    const { english: edition } = await vosEditions(repository);
    const all = await repository.searchEdition(edition.editionId, 'kingdom', { limit: 1000 });
    await waitFor(() =>
      expect(screen.getByTestId('find-status')).toHaveTextContent(`1 din ${all.length}`),
    );
    expect(all.length).toBeGreaterThan(20);
    expect(screen.getByTestId('find-next')).not.toBeDisabled();
  });

  it('steps through the hits, into the next section when the hit is not in this one', async () => {
    const { work, englishSections } = await open();
    await fireEvent.press(screen.getByTestId('find-button'));
    await fireEvent.changeText(screen.getByTestId('find-input'), 'kingdom');
    await waitFor(() => expect(screen.getByTestId('find-status')).toHaveTextContent(/^1 din \d+$/));
    // The previous hit of the first is the last of the edition: in another section.
    await fireEvent.press(screen.getByTestId('find-previous'));
    expect(router.replace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ id: work.workId, q: 'kingdom' }),
      }),
    );
    const params = (
      router.replace.mock.calls.at(-1)![0] as { params: { section: string; p: string } }
    ).params;
    expect(params.section).not.toBe(englishSections[0]!.id);
    expect(params.p).toBeTruthy();
  });

  it('marks the words everywhere in the section, and the current hit with the target wash and bar', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('find-button'));
    await fireEvent.changeText(screen.getByTestId('find-input'), 'kingdom');
    await waitFor(() => expect(screen.getByTestId('find-status')).toHaveTextContent(/^1 din/));
    expect(screen.getAllByText('kingdom').length).toBeGreaterThan(1);
    expect(screen.getByTestId('target-paragraph')).toBeTruthy();
    expect(screen.getByTestId('target-bar')).toBeTruthy();
  });

  it('says "Niciun rezultat" for words that are nowhere', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('find-button'));
    await fireEvent.changeText(screen.getByTestId('find-input'), 'zzzzzz');
    await waitFor(() =>
      expect(screen.getByTestId('find-status')).toHaveTextContent('Niciun rezultat'),
    );
  });

  it('opens with the words of ?q= and finds them (a hit of the search page)', async () => {
    const loaded = await realLibrary();
    const { work, englishSections } = await vosEditions(loaded.repository);
    const paragraphs = await loaded.repository.getParagraphs(englishSections[0]!.id);
    const target = paragraphs.find((paragraph) => /kingdom/i.test(paragraph.text))!;
    await renderWithProviders(
      <ReaderScreen
        workId={work.workId}
        sectionId={englishSections[0]!.id}
        targetParagraphId={target.id}
        query="kingdom"
      />,
      { loaded },
    );
    expect(await screen.findByTestId('find-bar')).toBeTruthy();
    expect(screen.getByTestId('find-input').props.value).toBe('kingdom');
    await waitFor(() =>
      expect(screen.getByTestId('find-status')).toHaveTextContent(/^\d+ din \d+$/),
    );
    // The paragraph of the link has the target wash and its bar (R15).
    expect(screen.getByTestId('target-paragraph')).toBeTruthy();
    expect(screen.getByTestId('target-bar')).toBeTruthy();
    expect(screen.getAllByText('kingdom').length).toBeGreaterThan(0);
  });

  it('keeps the words when the reader goes to another section, and closes with the position restored', async () => {
    const { work, englishSections } = await open();
    await fireEvent.press(screen.getByTestId('find-button'));
    await fireEvent.changeText(screen.getByTestId('find-input'), 'kingdom');
    await waitFor(() => expect(screen.getByTestId('find-status')).toHaveTextContent(/^1 din/));
    await screen.unmount();

    // The next screen of the reader opens the bar with the same words (the session keeps them).
    const loaded = await realLibrary();
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[1]!.id} />,
      { loaded },
    );
    expect((await screen.findByTestId('find-input')).props.value).toBe('kingdom');
  });
});

describe('ReaderScreen: the keyboard on web (R12)', () => {
  let fake: { document: FakeDocument; uninstall(): void };
  let replaced: { restore(): void };
  beforeEach(async () => {
    await setWindow(WIDE);
    fake = installFakeDocument();
    replaced = jest.replaceProperty(Platform, 'OS', 'web');
  });
  afterEach(() => {
    replaced.restore();
    fake.uninstall();
  });

  const key = (name: string, extra: Record<string, unknown> = {}) =>
    act(async () => {
      fake.document.dispatch('keydown', {
        key: name,
        target: { tagName: 'DIV' },
        preventDefault: () => undefined,
        ...extra,
      });
    });

  it('moves between chapters with the arrows, toggles the outline with [ and ], opens find with /', async () => {
    const { loaded, workId, englishSections } = await twoEditions();
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={englishSections[1]!.id} />, {
      loaded,
    });
    await screen.findByTestId('reader-toolbar');

    await key('ArrowRight');
    expect(router.replace).toHaveBeenLastCalledWith(readHref(workId, englishSections[2]!.id));
    await key('ArrowLeft');
    expect(router.replace).toHaveBeenLastCalledWith(readHref(workId, englishSections[0]!.id));

    expect(screen.getByTestId('outline-panel')).toBeTruthy();
    await key('[');
    expect(screen.queryByTestId('outline-panel')).toBeNull();
    await key(']');
    expect(screen.getByTestId('outline-panel')).toBeTruthy();

    await key('/');
    expect(screen.getByTestId('find-bar')).toBeTruthy();
  });

  it('takes no arrows while the focus is in a field, and Ctrl+K opens find even there', async () => {
    const { loaded, workId, englishSections } = await twoEditions();
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={englishSections[1]!.id} />, {
      loaded,
    });
    await screen.findByTestId('reader-toolbar');
    await key('ArrowRight', { target: { tagName: 'INPUT' } });
    expect(router.replace).not.toHaveBeenCalled();
    await key('k', { ctrlKey: true, target: { tagName: 'INPUT' } });
    expect(screen.getByTestId('find-bar')).toBeTruthy();
  });

  it('closes the topmost layer with Escape: the find bar, then the Aa panel, then (below 1100) the outline', async () => {
    const { loaded, workId, englishSections } = await twoEditions();
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={englishSections[1]!.id} />, {
      loaded,
    });
    await screen.findByTestId('reader-toolbar');
    await fireEvent.press(screen.getByTestId('aa-button'));
    await key('/');
    expect(screen.getByTestId('find-bar')).toBeTruthy();
    // The find bar is above the Aa panel: the bar goes first and the panel is not touched.
    await key('Escape');
    expect(screen.queryByTestId('find-bar')).toBeNull();
    // (Opening find shut the Aa panel: it is the topmost layer.)
    expect(screen.queryByTestId('typography-panel')).toBeNull();

    await fireEvent.press(screen.getByTestId('aa-button'));
    expect(screen.getByTestId('typography-panel')).toBeTruthy();
    await key('Escape');
    expect(screen.queryByTestId('typography-panel')).toBeNull();
    // On a desktop Escape with nothing open leaves the outline alone.
    await key('Escape');
    expect(screen.getByTestId('outline-panel')).toBeTruthy();
  });

  it('listens to the keys only while the screen is in focus and no dialog is open', async () => {
    const loaded = await realLibrary();
    const { work, romanianSections } = await vosEditions(loaded.repository);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[1]!.id} />,
      { loaded },
    );
    await fireEvent.press(await screen.findByTestId('transparency-button'));
    await screen.findByTestId('transparency-content');
    // A dialog is open: the arrows do not turn the page behind it.
    await key('ArrowRight');
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('ReaderScreen: the language of the text (R6)', () => {
  beforeEach(() => setWindow(WIDE));

  it('opens the aligned section of the language that ?lang= names, once, with the language kept', async () => {
    const loaded = await realLibrary();
    const { work, romanianSections, englishSections } = await vosEditions(loaded.repository);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[2]!.id} lang="en" />,
      { loaded },
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        readHref(work.workId, englishSections[2]!.id, { lang: 'en' }),
      ),
    );
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a ?lang= that the section is already in, or that the work does not have', async () => {
    const loaded = await realLibrary();
    const { work, romanianSections } = await vosEditions(loaded.repository);
    const first = await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[2]!.id} lang="ro" />,
      { loaded },
    );
    await screen.findByTestId('reader-toolbar');
    await first.unmount();
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[2]!.id} lang="la" />,
      { loaded },
    );
    await screen.findByTestId('reader-toolbar');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('switches to English from the toolbar and keeps the place: the aligned paragraph is where it opens', async () => {
    const loaded = await realLibrary();
    const {
      work,
      english: edition,
      romanian: romanianEdition,
      romanianSections,
      englishSections,
    } = await vosEditions(loaded.repository);
    // The reader is at the fourth paragraph of the Romanian section; its English twin is the aligned one.
    const romanian = await loaded.repository.getParagraphs(romanianSections[2]!.id);
    const english = await loaded.repository.getParagraphs(englishSections[2]!.id);
    const store = createMemoryStore();
    await savePosition(store, romanianEdition.editionId, {
      sectionId: romanianSections[2]!.id,
      paragraphId: romanian[3]!.id,
    });
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[2]!.id} />,
      { loaded, store },
    );
    await screen.findByTestId('reader-toolbar');

    await fireEvent.press(screen.getByTestId('lang-en'));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        readHref(work.workId, englishSections[2]!.id, { lang: 'en' }),
      ),
    );
    // The position of the English edition is the aligned paragraph, so the section opens there.
    expect(JSON.parse(store.data.get(positionKey(edition.editionId))!)).toMatchObject({
      sectionId: englishSections[2]!.id,
      paragraphId: english[3]!.id,
    });
  });

  it('marks the chosen language, and lets a language that has no aligned section be seen but not chosen', async () => {
    const { loaded, workId, englishSections, englishParagraphs } = await twoEditions(3);
    // English chapter 5: the Romanian edition has three chapters only.
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={englishSections[4]!.id} />, {
      loaded,
    });
    await screen.findByText(englishParagraphs(englishSections[4]!.id)[0]!.text);
    expect(screen.getByTestId('lang-en').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('lang-ro').props.accessibilityState).toMatchObject({
      checked: false,
      disabled: true,
    });
    await fireEvent.press(screen.getByTestId('lang-ro'));
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('ReaderScreen: two lanes (R7, R8)', () => {
  beforeEach(() => setWindow(WIDE));

  it('draws one row per source paragraph, the Romanian lane and the English lane side by side, named by their editions', async () => {
    const loaded = await realLibrary();
    const { work, romanianSections, englishSections } = await vosEditions(loaded.repository);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[0]!.id} pair="ro+en" />,
      { loaded },
    );
    const labels = await screen.findByTestId('lane-labels');
    expect(within(labels).getByTestId('lane-label-ro')).toHaveTextContent('Română · traducere');
    expect(within(labels).getByTestId('lane-label-en')).toHaveTextContent('English · original');

    const source = await loaded.repository.getParagraphs(englishSections[0]!.id);
    // The list draws its first rows up front: the rows it has are in the order of the source.
    const rows = screen.getAllByTestId(/^lane-row-/);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.props.testID).toBe(`lane-row-${source[0]!.id}`);
    expect(screen.getAllByTestId('lane-left').length).toBe(rows.length);
    expect(screen.getAllByTestId('lane-right').length).toBe(rows.length);
    // The heading cards of the two lanes.
    expect(screen.getByTestId('chapter-card-ro')).toHaveTextContent(/Introducere/);
    expect(screen.getByTestId('chapter-card-en')).toHaveTextContent(/Introductory/);
    // Two lanes: no language is chosen, the lanes toggle is on.
    expect(screen.getByTestId('lang-ro').props.accessibilityState.checked).toBe(false);
    expect(screen.getByTestId('lang-pair-toggle').props.accessibilityState.selected).toBe(true);
  });

  it('gives each paragraph of a row the same data-source-id on web (R7)', async () => {
    // (The library is read the way a phone reads it; only the drawing is the web's.)
    const loaded = await realLibrary();
    const { work, romanianSections, englishSections } = await vosEditions(loaded.repository);
    const source = await loaded.repository.getParagraphs(englishSections[0]!.id);
    const romanian = await loaded.repository.getParagraphs(romanianSections[0]!.id);
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(
        <ReaderScreen workId={work.workId} sectionId={romanianSections[0]!.id} pair="ro+en" />,
        { loaded },
      );
      await screen.findByTestId('lane-labels');
      const left = within(screen.getAllByTestId('lane-left')[0]!);
      const right = within(screen.getAllByTestId('lane-right')[0]!);
      const sourceId = (node: ReturnType<typeof left.getByTestId>) =>
        (node.props.dataSet as { sourceId: string }).sourceId;
      expect(sourceId(left.getByTestId(`paragraph-${romanian[0]!.id}`))).toBe(source[0]!.id);
      expect(sourceId(right.getByTestId(`paragraph-${source[0]!.id}`))).toBe(source[0]!.id);
    } finally {
      replaced.restore();
    }
  });

  it('opens the outline of the fuller edition: the English sections, with the Romanian ones in their place', async () => {
    const { loaded, workId, englishSections, romanianSections } = await twoEditions(3);
    await renderWithProviders(
      <ReaderScreen workId={workId} sectionId={englishSections[0]!.id} pair="ro+en" />,
      { loaded },
    );
    await screen.findByTestId('lane-labels');
    expect(
      within(screen.getByTestId('outline-panel')).getAllByTestId(/^outline-entry-/),
    ).toHaveLength(11);
    expect(within(screen.getByTestId('reader-counter-box')).getByText('/ 11')).toBeTruthy();
    // The first chapter has both lanes; the Romanian card is the translated heading.
    expect(screen.getByTestId('chapter-card-ro')).toHaveTextContent(romanianSections[0]!.heading);
  });

  it('shows the placeholder in the lane that is not translated, and keeps one row per source paragraph (R8)', async () => {
    const { loaded, workId, englishSections } = await twoEditions(3);
    const section = englishSections[5]!;
    await renderWithProviders(
      <ReaderScreen workId={workId} sectionId={section.id} pair="ro+en" />,
      { loaded },
    );
    await screen.findByTestId('lane-labels');
    const rows = screen.getAllByTestId(/^lane-row-/);
    const paragraphs = english.paragraphs.filter((paragraph) => paragraph.sectionId === section.id);
    // The list draws a window of rows: every one of them has the placeholder in the Romanian lane.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(paragraphs.length);
    expect(screen.getAllByTestId('lane-gap')).toHaveLength(rows.length + 1); // +1: the card
    expect(screen.getAllByText('Traducerea acestui pasaj nu este încă disponibilă.').length).toBe(
      rows.length + 1,
    );
  });

  it('stacks the lanes inside each row, under muted labels, when the text area is narrower than 900 (R7)', async () => {
    const loaded = await realLibrary();
    const { work, romanianSections } = await vosEditions(loaded.repository);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[0]!.id} pair="ro+en" />,
      { loaded },
    );
    await screen.findByTestId('lane-labels');
    await act(async () => {
      fireEvent(screen.getByTestId('reader-text'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 600, height: 800 } },
      });
    });
    // No sticky header of lane labels; each block has its own label: "Română", "English".
    expect(screen.queryByTestId('lane-labels')).toBeNull();
    expect(screen.getAllByTestId('lane-label-ro').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('lane-label-en').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('lane-label-ro')[0]).toHaveTextContent('Română');
  });

  it('is entered from the toolbar and left again, keeping the section and the language', async () => {
    const loaded = await realLibrary();
    const { work, romanianSections } = await vosEditions(loaded.repository);
    const store = createMemoryStore();
    const first = await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[1]!.id} />,
      { loaded, store },
    );
    await screen.findByTestId('reader-toolbar');
    await fireEvent.press(screen.getByTestId('lang-pair-toggle'));
    await waitFor(() =>
      expect(router.replace).toHaveBeenLastCalledWith(
        readHref(work.workId, romanianSections[1]!.id, { pair: 'ro+en' }),
      ),
    );
    // The pair is remembered for the work and as the default.
    await waitFor(() => expect(JSON.parse(store.data.get(SETTINGS_KEY)!).readerPair).toBe('ro+en'));
    await first.unmount();

    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[1]!.id} pair="ro+en" />,
      { loaded, store },
    );
    await screen.findByTestId('lane-labels');
    router.replace.mockClear();
    await fireEvent.press(screen.getByTestId('lang-pair-toggle'));
    expect(router.replace).toHaveBeenLastCalledWith(
      readHref(work.workId, romanianSections[1]!.id, { lang: 'ro' }),
    );
  });

  it('carries the pair to the next chapter', async () => {
    const loaded = await realLibrary();
    const { work, romanianSections } = await vosEditions(loaded.repository);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={romanianSections[0]!.id} pair="ro+en" />,
      { loaded },
    );
    await screen.findByTestId('lane-labels');
    await fireEvent.press(screen.getByLabelText('Capitolul următor'));
    expect(router.replace).toHaveBeenLastCalledWith(
      readHref(work.workId, romanianSections[1]!.id, { pair: 'ro+en' }),
    );
  });

  it('goes to the aligned section of the fuller edition when the link is into the other', async () => {
    const { loaded, workId, englishSections, romanianSections } = await twoEditions(3);
    // A link into Romanian section 2 with the pair ro+en: the outline is the English one.
    await renderWithProviders(
      <ReaderScreen workId={workId} sectionId={romanianSections[1]!.id} pair="ro+en" />,
      { loaded },
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        readHref(workId, englishSections[1]!.id, { pair: 'ro+en' }),
      ),
    );
  });
});

describe('ReaderScreen: the place, the progress and the way back (R15, R18, R19)', () => {
  beforeEach(() => setWindow(WIDE));

  /** A section of the English Vos text with at least this many paragraphs, and the list's scroll spied on. */
  async function openAt(options: {
    paragraphIndex: number;
    saved?: boolean;
    link?: boolean;
    query?: string;
  }) {
    const loaded = await realLibrary();
    const { work, english: edition, englishSections } = await vosEditions(loaded.repository);
    let section = englishSections[0]!;
    let paragraphs: Paragraph[] = [];
    for (const candidate of englishSections) {
      paragraphs = await loaded.repository.getParagraphs(candidate.id);
      section = candidate;
      if (paragraphs.length > options.paragraphIndex + 1) break;
    }
    const target = paragraphs[options.paragraphIndex]!;
    const store = createMemoryStore();
    if (options.saved) {
      await savePosition(store, edition.editionId, {
        sectionId: section.id,
        paragraphId: target.id,
      });
    }
    const scroll = jest
      .spyOn(FlatList.prototype, 'scrollToIndex')
      .mockImplementation(() => undefined);
    await renderWithProviders(
      <ReaderScreen
        workId={work.workId}
        sectionId={section.id}
        targetParagraphId={options.link ? target.id : undefined}
        query={options.query}
      />,
      { loaded, store },
    );
    await screen.findByTestId('reader-toolbar');
    return { work, edition, section, paragraphs, target, store, scroll, englishSections };
  }

  it('opens the section at the paragraph the reader left at, and draws it up front (R19)', async () => {
    const { target, scroll, paragraphs } = await openAt({ paragraphIndex: 6, saved: true });
    await waitFor(() =>
      expect(scroll).toHaveBeenCalledWith({
        index: paragraphs.indexOf(target),
        animated: false,
        viewPosition: 0,
      }),
    );
    expect(screen.getByTestId(`paragraph-${target.id}`)).toBeTruthy();
    // It is a return, not a link: the paragraph is not marked.
    expect(screen.queryByTestId('target-paragraph')).toBeNull();
  });

  it('stays at the top when the saved place is in another section, or is the start of this one (R19)', async () => {
    const loaded = await realLibrary();
    const { work, english: edition, englishSections } = await vosEditions(loaded.repository);
    const elsewhere = await loaded.repository.getParagraphs(englishSections[3]!.id);
    const store = createMemoryStore();
    await savePosition(store, edition.editionId, {
      sectionId: englishSections[3]!.id,
      paragraphId: elsewhere[2]!.id,
    });
    const scroll = jest
      .spyOn(FlatList.prototype, 'scrollToIndex')
      .mockImplementation(() => undefined);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[0]!.id} />,
      { loaded, store },
    );
    await screen.findByTestId('reader-toolbar');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    // (The outline scrolls its own list to the current entry, at 0.3; the text is not scrolled.)
    expect(scroll.mock.calls.filter(([where]) => where.viewPosition === 0)).toEqual([]);
    // Opening the first section records a place of its own, over the old one.
    await waitFor(() =>
      expect(JSON.parse(store.data.get(positionKey(edition.editionId))!)).toMatchObject({
        sectionId: englishSections[0]!.id,
      }),
    );
  });

  it('takes a link to its paragraph and marks it with the target wash and a bar (R15)', async () => {
    const { target, scroll, paragraphs } = await openAt({ paragraphIndex: 4, link: true });
    await waitFor(() =>
      expect(scroll).toHaveBeenCalledWith({
        index: paragraphs.indexOf(target),
        animated: false,
        viewPosition: 0,
      }),
    );
    const marked = within(screen.getByTestId(`paragraph-${target.id}`));
    expect(marked.getByTestId('target-paragraph')).toBeTruthy();
    expect(marked.getByTestId('target-bar')).toBeTruthy();
    // Only that paragraph is marked, and without words there is no find bar.
    expect(screen.getAllByTestId('target-paragraph')).toHaveLength(1);
    expect(screen.queryByTestId('find-bar')).toBeNull();
  });

  it('draws the bar at the foot of the window as far as the reader has gone through the edition (R18)', async () => {
    const { englishSections } = await openAt({ paragraphIndex: 0 });
    const bar = () => screen.getByTestId('progress-bar');
    expect(bar().props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 0 });
    expect(bar().props.accessibilityLabel).toBeTruthy();
    // Half way down a chapter of eleven: (0 + 0.5) / 11.
    await fireEvent.scroll(screen.getByTestId('reader-list'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 500 },
        contentSize: { width: 600, height: 1500 },
        layoutMeasurement: { width: 600, height: 500 },
      },
    });
    expect(bar().props.accessibilityValue.now).toBe(
      Math.round(((0 + 0.5) / englishSections.length) * 100),
    );
    // The end of the chapter: 1 / 11.
    await fireEvent.scroll(screen.getByTestId('reader-list'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 1000 },
        contentSize: { width: 600, height: 1500 },
        layoutMeasurement: { width: 600, height: 500 },
      },
    });
    expect(bar().props.accessibilityValue.now).toBe(Math.round((1 / englishSections.length) * 100));
    expect(bar().props['aria-valuenow']).toBe(bar().props.accessibilityValue.now);
  });

  it('counts the chapters before this one in the progress: the last chapter ends at 100 (R18)', async () => {
    const loaded = await realLibrary();
    const { work, englishSections } = await vosEditions(loaded.repository);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections.at(-1)!.id} />,
      { loaded },
    );
    await screen.findByTestId('reader-toolbar');
    await fireEvent.scroll(screen.getByTestId('reader-list'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 1000 },
        contentSize: { width: 600, height: 1500 },
        layoutMeasurement: { width: 600, height: 500 },
      },
    });
    expect(screen.getByTestId('progress-bar').props.accessibilityValue.now).toBe(100);
  });
});

describe('ReaderScreen: the tools (theme, link, bookmark, top)', () => {
  beforeEach(() => setWindow(WIDE));

  const openTools = async (
    options: { store?: ReturnType<typeof createMemoryStore>; section?: number } = {},
  ) => {
    const loaded = await realLibrary();
    const { work, english: edition, englishSections } = await vosEditions(loaded.repository);
    const store = options.store ?? createMemoryStore();
    const section = englishSections[options.section ?? 1]!;
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={section.id} />, {
      loaded,
      store,
    });
    await screen.findByTestId('reader-toolbar');
    await fireEvent.press(screen.getByTestId('tools-button'));
    // The drawer opens over about 340 ms: let it finish inside `act`.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 360));
    });
    return {
      work,
      edition,
      section,
      englishSections,
      store,
      drawer: within(screen.getByTestId('tools-drawer')),
    };
  };

  it('opens a drawer of tools that folds the title and the counter away, and closes with the button again', async () => {
    const { drawer } = await openTools();
    for (const key of ['theme', 'copy-link', 'bookmark', 'report', 'top']) {
      expect(drawer.getByTestId(`tool-${key}`)).toBeTruthy();
    }
    // The language is in the toolbar of a wide screen, "Ask" is not delivered yet.
    expect(drawer.queryByTestId('tool-language')).toBeNull();
    expect(drawer.queryByTestId('tool-ask')).toBeNull();
    expect(screen.queryByTestId('reader-title')).toBeNull();
    expect(screen.queryByTestId('reader-counter')).toBeNull();
    expect(screen.getByTestId('tools-button').props.accessibilityState).toMatchObject({
      expanded: true,
    });
    await fireEvent.press(screen.getByTestId('tools-button'));
    expect(screen.getByTestId('tools-button').props.accessibilityState).toMatchObject({
      expanded: false,
    });
    expect(screen.getByTestId('reader-title')).toBeTruthy();
    // A closed drawer has no tools in it to tab to (once it has finished closing).
    await waitFor(() => expect(screen.queryByTestId('tool-theme')).toBeNull());
  });

  it('goes round the themes: light, sepia, dark, automatic, and says which comes next', async () => {
    const store = createSettingsStore({ theme: 'light' });
    const { drawer } = await openTools({ store });
    expect(drawer.getByTestId('tool-theme').props.accessibilityLabel).toBe(
      'Tema: Luminos. Apasă pentru Sepia.',
    );
    await fireEvent.press(drawer.getByTestId('tool-theme'));
    await waitFor(() => expect(JSON.parse(store.data.get(SETTINGS_KEY)!).theme).toBe('sepia'));
    await fireEvent.press(screen.getByTestId('tool-theme'));
    await waitFor(() => expect(JSON.parse(store.data.get(SETTINGS_KEY)!).theme).toBe('dark'));
    await fireEvent.press(screen.getByTestId('tool-theme'));
    await waitFor(() => expect(JSON.parse(store.data.get(SETTINGS_KEY)!).theme).toBe('system'));
    await fireEvent.press(screen.getByTestId('tool-theme'));
    await waitFor(() => expect(JSON.parse(store.data.get(SETTINGS_KEY)!).theme).toBe('light'));
  });

  it('copies the link to the chapter, and says so', async () => {
    const { work, section, drawer } = await openTools();
    await fireEvent.press(drawer.getByTestId('tool-copy-link'));
    await waitFor(() =>
      expect(Clipboard.setStringAsync as jest.Mock).toHaveBeenCalledWith(
        readUrl(work.workId, section.id, null),
      ),
    );
    expect(await screen.findByText(ro.reader.linkCopied)).toBeTruthy();
  });

  it('copies the link to the paragraph the reader is at', async () => {
    const loaded = await realLibrary();
    const { work, english: edition, englishSections } = await vosEditions(loaded.repository);
    const paragraphs = await loaded.repository.getParagraphs(englishSections[1]!.id);
    const store = createMemoryStore();
    await savePosition(store, edition.editionId, {
      sectionId: englishSections[1]!.id,
      paragraphId: paragraphs[2]!.id,
    });
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[1]!.id} />,
      { loaded, store },
    );
    await screen.findByTestId('reader-toolbar');
    await fireEvent.press(screen.getByTestId('tools-button'));
    await fireEvent.press(screen.getByTestId('tool-copy-link'));
    await waitFor(() =>
      expect(Clipboard.setStringAsync as jest.Mock).toHaveBeenLastCalledWith(
        readUrl(work.workId, englishSections[1]!.id, paragraphs[2]!.id),
      ),
    );
  });

  it('says so when neither the clipboard nor the share sheet took the link', async () => {
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValueOnce(false);
    jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('no share'));
    const { drawer } = await openTools();
    await fireEvent.press(drawer.getByTestId('tool-copy-link'));
    expect(await screen.findByText(ro.reader.linkNotCopied)).toBeTruthy();
  });

  it('bookmarks the work and takes the bookmark away again, remembering the edition (check R16)', async () => {
    const { work, edition, drawer, store } = await openTools();
    expect(drawer.getByTestId('tool-bookmark').props.accessibilityLabel).toBe('Marchează lucrarea');
    expect(drawer.getByTestId('tool-bookmark').props.accessibilityState).toMatchObject({
      selected: false,
    });
    await fireEvent.press(drawer.getByTestId('tool-bookmark'));
    await waitFor(() =>
      expect(JSON.parse(store.data.get(BOOKMARKS_KEY)!)).toMatchObject([
        { workId: work.workId, editionId: edition.editionId },
      ]),
    );
    expect(screen.getByTestId('tool-bookmark').props.accessibilityLabel).toBe(
      'Elimină marcajul lucrării',
    );
    expect(screen.getByTestId('tool-bookmark').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(within(screen.getByTestId('tool-bookmark')).getByText('Marcat')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tool-bookmark'));
    await waitFor(() => expect(JSON.parse(store.data.get(BOOKMARKS_KEY)!)).toEqual([]));
    expect(within(screen.getByTestId('tool-bookmark')).getByText('Marcaj')).toBeTruthy();
  });

  it('shows a work that was bookmarked before as marked', async () => {
    const loaded = await realLibrary();
    const { work, english: edition, englishSections } = await vosEditions(loaded.repository);
    const store = createMemoryStore({
      [BOOKMARKS_KEY]: JSON.stringify([
        { workId: work.workId, editionId: edition.editionId, addedAt: 1 },
      ]),
    });
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[0]!.id} />,
      { loaded, store },
    );
    await fireEvent.press(await screen.findByTestId('tools-button'));
    await waitFor(() =>
      expect(screen.getByTestId('tool-bookmark').props.accessibilityState).toMatchObject({
        selected: true,
      }),
    );
  });

  it('opens the transparency panel from "Raportează"', async () => {
    const { drawer } = await openTools();
    await fireEvent.press(drawer.getByTestId('tool-report'));
    expect(await screen.findByTestId('transparency-content')).toBeTruthy();
    // The drawer is closed behind the dialog.
    expect(screen.getByTestId('tools-button').props.accessibilityState).toMatchObject({
      expanded: false,
    });
    await waitFor(() => expect(screen.queryByTestId('tool-theme')).toBeNull());
  });

  it('goes to the first chapter with "La început" when the reader is further on, and scrolls to the top when not', async () => {
    const { work, englishSections, drawer } = await openTools({ section: 2 });
    await fireEvent.press(drawer.getByTestId('tool-top'));
    expect(router.replace).toHaveBeenLastCalledWith(readHref(work.workId, englishSections[0]!.id));
    expect(screen.getByTestId('tools-button').props.accessibilityState).toMatchObject({
      expanded: false,
    });
  });
});

describe('ReaderScreen: a phone (R13)', () => {
  beforeEach(() => setWindow(390, 844));

  const openOnPhone = async (sectionIndex = 1) => {
    const loaded = await realLibrary();
    const { work, romanianSections, englishSections, english, romanian } = await vosEditions(
      loaded.repository,
    );
    const store = createMemoryStore();
    await renderWithProviders(
      withFonts(
        <ReaderScreen workId={work.workId} sectionId={romanianSections[sectionIndex]!.id} />,
      ),
      { loaded, store },
    );
    await screen.findByTestId('reader-toolbar');
    return { work, romanianSections, englishSections, english, romanian, store };
  };

  it('has the title alone in the toolbar, and the rest in a bar of five cells under the text', async () => {
    await openOnPhone();
    const toolbar = within(screen.getByTestId('reader-toolbar'));
    expect(toolbar.getByTestId('reader-title')).toBeTruthy();
    for (const id of [
      'outline-toggle',
      'reader-previous',
      'reader-next',
      'reader-counter',
      'transparency-button',
      'find-button',
      'aa-button',
      'tools-button',
    ]) {
      expect(toolbar.queryByTestId(id)).toBeNull();
    }
    const bar = screen.getByTestId('thumb-bar');
    expect(bar.props.accessibilityLabel).toBe('Navigare în lectură');
    expect(
      within(bar)
        .getAllByTestId(/^thumb-cell-/)
        .map((cell) => cell.props.testID),
    ).toEqual([
      'thumb-cell-contents',
      'thumb-cell-find',
      'thumb-cell-language',
      'thumb-cell-text',
      'thumb-cell-tools',
    ]);
    // The outline is not in the flow: it is a drawer.
    expect(screen.queryByTestId('outline-panel')).toBeNull();
  });

  it('has four cells for a work of one edition: the language cell is the one that is missing', async () => {
    const onlyEnglish = await loadBundledRepository({ packs: [englishPack] });
    await renderWithProviders(
      withFonts(
        <ReaderScreen workId={english.work.id} sectionId={sorted(english.sections)[1]!.id} />,
      ),
      { loaded: onlyEnglish },
    );
    await screen.findByTestId('reader-toolbar');
    expect(
      within(screen.getByTestId('thumb-bar'))
        .getAllByTestId(/^thumb-cell-/)
        .map((cell) => cell.props.testID),
    ).toEqual(['thumb-cell-contents', 'thumb-cell-find', 'thumb-cell-text', 'thumb-cell-tools']);
  });

  it('opens the outline as a drawer and shuts it after an entry is chosen', async () => {
    const { work, romanianSections } = await openOnPhone();
    await fireEvent.press(screen.getByTestId('thumb-cell-contents'));
    const panel = await screen.findByTestId('outline-panel');
    await fireEvent.press(within(panel).getByTestId(`outline-entry-${romanianSections[3]!.id}`));
    expect(router.replace).toHaveBeenLastCalledWith(readHref(work.workId, romanianSections[3]!.id));
    await waitFor(() => expect(screen.queryByTestId('outline-panel')).toBeNull());
  });

  it('opens Text as a sheet with the size, the spacing, the face and the theme', async () => {
    await openOnPhone();
    expect(screen.queryByTestId('aa-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('thumb-cell-text'));
    const sheet = within(await screen.findByTestId('aa-sheet'));
    expect(sheet.getByTestId('aa-larger')).toBeTruthy();
    expect(sheet.getByTestId('aa-smaller')).toBeTruthy();
    expect(screen.getByTestId('thumb-cell-text').props.accessibilityState).toMatchObject({
      selected: true,
    });
    await fireEvent.press(sheet.getByTestId('aa-larger'));
    await waitFor(() => expect(sheet.getByTestId('aa-size')).toHaveTextContent('18 pt'));
  });

  it('opens Language as a sheet: the language of the text, then the side by side switch', async () => {
    const { work, englishSections, store, english } = await openOnPhone(2);
    await fireEvent.press(screen.getByTestId('thumb-cell-language'));
    const sheet = within(await screen.findByTestId('language-sheet'));
    expect(sheet.getByTestId('language-sheet-body')).toBeTruthy();
    await fireEvent.press(sheet.getByLabelText('EN'));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        readHref(work.workId, englishSections[2]!.id, { lang: 'en' }),
      ),
    );
    expect(JSON.parse(store.data.get(positionKey(english.editionId))!)).toMatchObject({
      sectionId: englishSections[2]!.id,
    });
  });

  it('opens Tools as a sheet of full-width rows, with the language among them', async () => {
    await openOnPhone();
    await fireEvent.press(screen.getByTestId('thumb-cell-tools'));
    const list = within(await screen.findByTestId('tools-list'));
    expect(list.getAllByTestId(/^tool-/).map((row) => row.props.testID)).toEqual([
      'tool-language',
      'tool-theme',
      'tool-copy-link',
      'tool-bookmark',
      'tool-report',
      'tool-top',
    ]);
    // "Limba" leads to the language sheet.
    await fireEvent.press(list.getByTestId('tool-language'));
    expect(await screen.findByTestId('language-sheet')).toBeTruthy();
  });

  it('opens find in a bar of its own from the Search cell', async () => {
    await openOnPhone();
    await fireEvent.press(screen.getByTestId('thumb-cell-find'));
    expect(await screen.findByTestId('find-bar')).toBeTruthy();
    expect(screen.getByTestId('find-input')).toBeTruthy();
  });
});
