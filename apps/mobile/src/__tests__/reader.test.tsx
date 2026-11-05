import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pack, Paragraph, Section } from '@biblioteca/shared';
import { stableId } from '@biblioteca/shared/ids';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { FlatList, Platform } from 'react-native';

import { loadBundledRepository } from '@/content/repository';
import type { LoadedRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import { ReaderScreen } from '@/features/reader/reader-screen';
import { readHref, workHref } from '@/navigation-hrefs';
import { legacyPositionKey, positionKey } from '@/reading/position-store';
import { router, screenOptions } from '@/test-support/expo-router-mock';
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

const signer = createTestSigner();
const englishPack = bundledPack('vos-1903-kingdom-en');
const english = englishPack.pack as Pack;
const sorted = <T extends { ordinal: number }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.ordinal - b.ordinal);

/** The English source (11 sections) and a synthetic Romanian translation of its first three. */
async function twoEditions(): Promise<{
  loaded: LoadedRepository;
  workId: string;
  romanian: Pack;
  romanianSections: Section[];
  romanianParagraphs: (sectionId: string) => Paragraph[];
  englishSections: Section[];
  englishParagraphs: (sectionId: string) => Paragraph[];
}> {
  const romanian = translationOf(english, { sections: 3, paragraphsPerSection: 2 });
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

describe('ReaderScreen', () => {
  beforeEach(() => {
    router.push.mockClear();
    router.replace.mockClear();
    screenOptions.length = 0;
  });

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
    expect(screen.getByRole('progressbar')).toBeTruthy();

    await waitFor(() => {
      const saved = store.data.get(positionKey(edition.editionId));
      expect(saved).toBeDefined();
      expect(JSON.parse(saved!)).toMatchObject({ sectionId: englishSections[0]!.id });
    });
    // Nothing is written under the work any more.
    expect(store.data.has(legacyPositionKey(work.workId))).toBe(false);
  });

  it('goes to the next chapter with the next button and disables previous on the first one', async () => {
    const { repository } = await loadBundledRepository();
    const { work, englishSections } = await vosEditions(repository);
    const paragraphs = await repository.getParagraphs(englishSections[0]!.id);
    expect(englishSections.length).toBeGreaterThan(1);
    await renderWithProviders(
      <ReaderScreen workId={work.workId} sectionId={englishSections[0]!.id} />,
    );
    await screen.findByText(paragraphs[0]!.text);

    expect(screen.getByLabelText('Capitolul anterior')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Capitolul următor'));
    expect(router.replace).toHaveBeenCalledWith(readHref(work.workId, englishSections[1]!.id));
  });

  it('shows a Romanian message for an unknown section', async () => {
    const { repository } = await loadBundledRepository();
    const { work } = await vosEditions(repository);
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId="missing" />);
    expect(await screen.findByText('Secțiunea nu a fost găsită.')).toBeTruthy();
  });

  afterAll(async () => {
    await AsyncStorage.clear();
  });
});

describe('ReaderScreen scoped to an edition', () => {
  beforeEach(() => {
    router.push.mockClear();
    router.replace.mockClear();
    screenOptions.length = 0;
  });

  it('moves previous and next inside the edition: the last Romanian chapter is the last one', async () => {
    const { loaded, workId, romanianSections, romanianParagraphs } = await twoEditions();
    const last = romanianSections[2]!;
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={last.id} />, { loaded });
    await screen.findByText(romanianParagraphs(last.id)[0]!.text);

    // The work has eleven English chapters, but this edition ends here.
    expect(screen.queryByLabelText('Capitolul următor')).toBeNull();
    expect(screen.getByLabelText('Capitolul anterior')).not.toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Capitolul anterior'));
    expect(router.replace).toHaveBeenLastCalledWith(readHref(workId, romanianSections[1]!.id));
    // The progress counts the sections of the edition: "3 din 3".
    expect(screen.getByRole('progressbar')).toHaveTextContent(/^3 din 3 · /);
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
    expect(screen.queryByLabelText('Capitolul următor')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Capitolul anterior'));
    expect(router.replace).toHaveBeenLastCalledWith(readHref(workId, englishSections[9]!.id));
    expect(screen.getByRole('progressbar')).toHaveTextContent(/^11 din 11 · /);
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
    expect(screen.getByText(target.heading)).toBeTruthy();
    expect(screen.getByRole('progressbar')).toHaveTextContent(/^5 din 11 · /);
    await first.unmount();

    // And the other way round: English is the reading language, the link points into Romanian.
    const store = createSettingsStore({ readingLanguage: 'en' });
    const romanian = romanianSections[1]!;
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={romanian.id} />, {
      loaded,
      store,
    });
    expect(await screen.findByText(romanian.heading)).toBeTruthy();
    expect(screen.getByRole('progressbar')).toHaveTextContent(/^2 din 3 · /);
  });

  it('shows the not-found state for a section that is not in this work', async () => {
    const { loaded, workId, romanian } = await twoEditions();
    // Another work, with a section of its own.
    const other = clone(romanian);
    other.work = { ...other.work, id: stableId(), slug: 'another-work' };
    other.edition = { ...other.edition, id: stableId() };
    const idOf = new Map(other.sections.map((section) => [section.id, stableId()]));
    other.sections = other.sections.map((section) => ({ ...section, id: idOf.get(section.id)! }));
    other.paragraphs = other.paragraphs.map((paragraph) => ({
      ...paragraph,
      id: stableId(),
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
    // The section is fine on its own work.
    await renderWithProviders(<ReaderScreen workId={other.work.id} sectionId={foreign.id} />, {
      loaded: both,
    });
    expect(await screen.findByText(foreign.heading)).toBeTruthy();
  });

  it('shows the not-found state for a work that does not exist', async () => {
    const { loaded, englishSections } = await twoEditions();
    await renderWithProviders(
      <ReaderScreen workId="no-such-work" sectionId={englishSections[0]!.id} />,
      {
        loaded,
      },
    );
    expect(await screen.findByText('Secțiunea nu a fost găsită.')).toBeTruthy();
  });

  it('offers the table of contents of this edition at its end', async () => {
    const { loaded, workId, romanian, romanianSections, romanianParagraphs } = await twoEditions();
    const last = romanianSections[2]!;
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={last.id} />, { loaded });
    await screen.findByText(romanianParagraphs(last.id)[0]!.text);
    await fireEvent.press(screen.getByText('La cuprins'));
    // Back to the page of the work, on the edition that was being read.
    expect(router.replace).toHaveBeenLastCalledWith(workHref(workId, romanian.edition.id));
  });
});

describe('ReaderScreen running head and language label', () => {
  beforeEach(() => {
    screenOptions.length = 0;
  });

  it('says the language of the text at the head of the page when the work has several editions', async () => {
    const { loaded, workId, romanianSections, englishSections } = await twoEditions();
    const romanian = await renderWithProviders(
      <ReaderScreen workId={workId} sectionId={romanianSections[0]!.id} />,
      { loaded },
    );
    await screen.findByRole('progressbar');
    expect(screen.getByTestId('edition-language')).toHaveTextContent('Română');
    await romanian.unmount();

    await renderWithProviders(<ReaderScreen workId={workId} sectionId={englishSections[0]!.id} />, {
      loaded,
    });
    await screen.findByRole('progressbar');
    expect(screen.getByTestId('edition-language')).toHaveTextContent('English');
  });

  it('sets the label beside the position, in the same quiet label style, after the name of the work', async () => {
    const { loaded, workId, englishSections } = await twoEditions();
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={englishSections[0]!.id} />, {
      loaded,
    });
    const progress = await screen.findByRole('progressbar');
    const label = screen.getByTestId('edition-language');
    expect(label.parent).toBe(progress.parent);
    // The name of the work at the left (it takes the room), then the language, then the position.
    expect(label.parent).toHaveStyle({ flexDirection: 'row' });
    const row = label.parent!.children.filter((child) => typeof child !== 'string');
    expect(row.map((child) => (child as { props: { testID?: string } }).props.testID)).toEqual([
      'reader-running-title',
      'edition-language',
      undefined,
    ]);
  });

  it('shows no language label when the work has one edition, and keeps the position at the right', async () => {
    const loaded = await loadBundledRepository({ packs: [englishPack] });
    await renderWithProviders(
      <ReaderScreen workId={english.work.id} sectionId={sorted(english.sections)[0]!.id} />,
      { loaded },
    );
    const progress = await screen.findByRole('progressbar');
    expect(screen.queryByTestId('edition-language')).toBeNull();
    // The title of the work takes the room, so the position is the last thing of the row.
    const row = progress.parent!.children.filter((child) => typeof child !== 'string');
    expect((row[0] as { props: { testID?: string } }).props.testID).toBe('reader-running-title');
    expect(row.at(-1)).toBe(progress);
  });

  it('names the work in a quiet running head, since the navigator has no header any more', async () => {
    const { loaded, workId, englishSections } = await twoEditions();
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={englishSections[0]!.id} />, {
      loaded,
    });
    await screen.findByRole('progressbar');
    expect(screen.getByTestId('reader-running-title')).toHaveTextContent(english.work.titleRo);
    // The shell of the screen: the section bar, and no brand bar (the reader has its own toolbar).
    expect(screen.getByTestId('section-bar')).toBeTruthy();
    expect(screen.queryByTestId('brand-bar')).toBeNull();
    expect(screenOptions).toEqual([]);
  });

  it('names the work in the reading language', async () => {
    const { loaded, workId, englishSections } = await twoEditions();
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={englishSections[0]!.id} />, {
      loaded,
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    await screen.findByRole('progressbar');
    expect(screen.getByTestId('reader-running-title')).toHaveTextContent(english.work.titleOrig);
  });

  it('writes the label in its own language under an English interface', async () => {
    const { loaded, workId, romanianSections } = await twoEditions();
    await renderWithProviders(
      <ReaderScreen workId={workId} sectionId={romanianSections[0]!.id} />,
      {
        loaded,
        store: createSettingsStore({ uiLanguage: 'en' }),
      },
    );
    await screen.findByRole('progressbar');
    expect(screen.getByTestId('edition-language')).toHaveTextContent('Română');
  });
});

describe('ReaderScreen language', () => {
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
    expect(screen.getByRole('progressbar')).toHaveTextContent('1 of 3 · 0%');
    expect(screen.getByRole('progressbar').props.accessibilityLabel).toContain('Reading progress');
    expect(screen.getByLabelText('Text appearance: size, spacing, theme')).toBeTruthy();
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
      expect(screen.getByText(first.heading).props.lang).toBe('en');
    } finally {
      replaced.restore();
    }
  });
});

describe('ReaderScreen saved position', () => {
  let scrollToIndex: jest.SpyInstance;

  beforeEach(() => {
    scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
  });
  afterEach(() => {
    scrollToIndex.mockRestore();
  });

  /** A chapter long enough to scroll within: the first English chapter has more than five paragraphs. */
  const chapter = () => sorted(english.sections)[0]!;
  const paragraphsOf = (sectionId: string) =>
    sorted(english.paragraphs.filter((paragraph) => paragraph.sectionId === sectionId));

  it('scrolls to the position saved for the edition', async () => {
    const { loaded, workId } = await twoEditions();
    const paragraphs = paragraphsOf(chapter().id);
    const store = createMemoryStore({
      [positionKey(english.edition.id)]: JSON.stringify({
        sectionId: chapter().id,
        paragraphId: paragraphs[4]!.id,
        updatedAt: 1,
      }),
    });
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={chapter().id} />, {
      loaded,
      store,
    });
    await waitFor(() =>
      expect(scrollToIndex).toHaveBeenCalledWith(expect.objectContaining({ index: 4 })),
    );
  });

  it('migrates the position saved for the work by an older version: the source edition resumes there', async () => {
    const { loaded, workId } = await twoEditions();
    const paragraphs = paragraphsOf(chapter().id);
    const store = createMemoryStore({
      [legacyPositionKey(workId)]: JSON.stringify({
        sectionId: chapter().id,
        paragraphId: paragraphs[3]!.id,
        updatedAt: 1,
      }),
    });
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={chapter().id} />, {
      loaded,
      store,
    });
    await waitFor(() =>
      expect(scrollToIndex).toHaveBeenCalledWith(expect.objectContaining({ index: 3 })),
    );
  });

  it('prefers the position of the edition to the one saved for the work', async () => {
    const { loaded, workId } = await twoEditions();
    const paragraphs = paragraphsOf(chapter().id);
    const saved = (paragraphId: string) =>
      JSON.stringify({ sectionId: chapter().id, paragraphId, updatedAt: 1 });
    const store = createMemoryStore({
      [legacyPositionKey(workId)]: saved(paragraphs[3]!.id),
      [positionKey(english.edition.id)]: saved(paragraphs[5]!.id),
    });
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={chapter().id} />, {
      loaded,
      store,
    });
    await waitFor(() =>
      expect(scrollToIndex).toHaveBeenCalledWith(expect.objectContaining({ index: 5 })),
    );
    expect(scrollToIndex).not.toHaveBeenCalledWith(expect.objectContaining({ index: 3 }));
  });

  it('does not use the position saved for the work in a translation', async () => {
    const { loaded, workId, romanianSections, romanianParagraphs } = await twoEditions();
    const section = romanianSections[0]!;
    const store = createMemoryStore({
      [legacyPositionKey(workId)]: JSON.stringify({
        sectionId: section.id,
        paragraphId: romanianParagraphs(section.id)[1]!.id,
        updatedAt: 1,
      }),
    });
    await renderWithProviders(<ReaderScreen workId={workId} sectionId={section.id} />, {
      loaded,
      store,
    });
    await screen.findByText(romanianParagraphs(section.id)[0]!.text);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(scrollToIndex).not.toHaveBeenCalled();
  });
});
