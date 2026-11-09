import type { Pack } from '@biblioteca/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import WorkRoute from '@/app/work/[id]';
import { loadBundledRepository } from '@/content/repository';
import type { LoadedRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import { WorkScreen } from '@/features/work/work-screen';
import { loadBundledCatalogue } from '@/catalogue/verify-catalogue';
import { FeaturesProvider, BETA_1_FEATURES } from '@/config/features';
import { countWords, roundedWords } from '@/features/work/work-model';
import { BOOKMARKS_KEY } from '@/reading/bookmarks-store';
import { syntheticLibrary } from '@/test-support/library-fixtures';
import { readHref } from '@/navigation-hrefs';
import { splitChapterHeading } from '@/reading/heading';
import { legacyPositionKey, positionKey } from '@/reading/position-store';
import { router, setMockParams } from '@/test-support/expo-router-mock';
import {
  bareEnglishPack,
  bundledPack,
  createTestSigner,
  signPack,
  translationOf,
} from '@/test-support/packs';
import type { TranslationOptions } from '@/test-support/packs';
import { createMemoryStore, createSettingsStore, renderWithProviders } from '@/test-support/render';
import { vosEditions } from '@/test-support/vos';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

const signer = createTestSigner();
const englishPack = bundledPack('vos-1903-kingdom-en');
const english = englishPack.pack as Pack;

/** The English source plus a synthetic Romanian translation of its first sections. */
async function twoEditions(
  options: TranslationOptions = {},
  bare = false,
): Promise<{
  loaded: LoadedRepository;
  translation: Pack;
  workId: string;
}> {
  const translation = translationOf(english, { sections: 3, ...options });
  const loaded = await loadBundledRepository({
    packs: [
      bare ? bareEnglishPack(signer) : englishPack,
      signPack(translation, signer, { packId: 'vos-synthetic-ro' }),
    ],
    trustedKeys: [...trustedKeys, signer.key],
  });
  return { loaded, translation, workId: english.work.id };
}

const sectionsOf = (pack: Pack) => [...pack.sections].sort((a, b) => a.ordinal - b.ordinal);
const switchGroup = () => screen.getByLabelText('Alege ediția');
const selected = (label: string) =>
  within(switchGroup()).getByLabelText(label).props.accessibilityState.selected as boolean;
/** The chapters listed on the page. (A long list draws its first rows up front, ten at most.) */
const chapterRows = () => screen.queryAllByLabelText(/^Deschide /);
const chapterRow = (heading: string) => screen.queryByLabelText(`Deschide ${heading}`);
/** The edition labels of 17.7: "Română · traducere", "English · original". */
const RO = 'Română · traducere';
const EN = 'English · original';
const startButton = () => screen.getByTestId('work-cta-start');

beforeEach(() => {
  router.push.mockClear();
  router.setParams.mockClear();
  setMockParams({});
});

/** The real library: the two bundled Vos packs and the bundled, verified catalogue (blurb, start list). */
async function realLibrary() {
  const catalogue = await loadBundledCatalogue();
  return loadBundledRepository({ catalogue });
}

describe('WorkScreen: the card (W1)', () => {
  it('has the title, the original title, the author with the years, the kind and the shelf, and two tiles', async () => {
    const loaded = await realLibrary();
    const { repository } = loaded;
    const { english: edition, englishSections, work } = await vosEditions(repository);
    await renderWithProviders(<WorkScreen workId={work.workId} editionId={edition.editionId} />, {
      loaded,
    });
    const card = within(await screen.findByTestId('work-card'));
    expect(card.getByTestId('work-title')).toHaveTextContent(work.titleRo);
    expect(card.getByTestId('work-title').props['aria-level']).toBe(1);
    expect(card.getByText(work.titleOrig)).toBeTruthy();
    expect(card.getByTestId('work-author')).toHaveTextContent('Geerhardus Vos (1862–1949)');
    expect(card.getByTestId('work-kind')).toHaveTextContent('Tratat');
    expect(card.getByText('Teologie modernă')).toBeTruthy();
    // The tiles: the sections of the edition shown, and its words rounded to the hundred.
    expect(card.getByTestId('stat-sections').props.accessibilityLabel).toBe(
      `Secțiuni: ${englishSections.length}`,
    );
    const paragraphs = (
      await Promise.all(englishSections.map((section) => repository.getParagraphs(section.id)))
    ).flat();
    const words = paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph.text), 0);
    const rounded = roundedWords(words).toLocaleString('de-DE'); // "29.600": a point in Romanian
    expect(card.getByTestId('stat-words').props.accessibilityLabel).toBe(`Cuvinte: ~${rounded}`);
    expect(words).toBeGreaterThan(20000);
  });

  it('sets the title in IM Fell at 34/40 wide and 30/36 on a phone (check W1)', async () => {
    const { loaded, workId } = await twoEditions();
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    const title = await screen.findByTestId('work-title');
    expect(title).toHaveStyle({ fontSize: 30, lineHeight: 36 }); // the test window is a phone (390)
  });

  it("writes the work's tiles for the edition that is selected: the sections of that edition", async () => {
    const { loaded, workId } = await twoEditions({ sections: 3 });
    setMockParams({ id: workId });
    await renderWithProviders(<WorkRoute />, { loaded });
    await screen.findByTestId('work-card');
    expect(screen.getByTestId('stat-sections').props.accessibilityLabel).toBe('Secțiuni: 3');
    await fireEvent.press(within(switchGroup()).getByLabelText(EN));
    expect(screen.getByTestId('stat-sections').props.accessibilityLabel).toBe('Secțiuni: 11');
  });
});

describe('WorkScreen: an anonymous work and the Latin work (B6, B11, W2)', () => {
  it('shows the issuing body and the year as plain text, with no author link and no breadcrumb', async () => {
    const library = syntheticLibrary();
    const loaded = await library.load();
    await renderWithProviders(
      <WorkScreen workId={library.workIds['definitia-de-la-calcedon']!} />,
      { loaded },
    );
    expect(await screen.findByTestId('work-body')).toBeTruthy();
    expect(screen.queryByTestId('work-author')).toBeNull();
    expect(screen.queryByTestId('work-breadcrumb')).toBeNull();
  });

  it('reads "English · traducere" for the English translation of a Latin work and "Latină · original" for its source', async () => {
    const library = syntheticLibrary();
    const loaded = await library.load();
    const latin = (await loaded.repository.listWorks('ro')).find(
      (work) => work.languageOrig === 'la',
    );
    expect(latin).toBeTruthy();
    await renderWithProviders(<WorkScreen workId={latin!.workId} />, { loaded });
    await screen.findByTestId('work-card');
    const labels = within(switchGroup())
      .getAllByRole('radio')
      .map((radio) => radio.props.accessibilityLabel as string);
    expect(labels).toEqual(expect.arrayContaining(['English · traducere', 'Latină · original']));
  });
});

describe('WorkScreen: the transparency row (W3)', () => {
  it('names how each edition was made, and "Detalii" opens the panel of the edition shown', async () => {
    const loaded = await realLibrary();
    const { work } = await vosEditions(loaded.repository);
    setMockParams({ id: work.workId });
    await renderWithProviders(<WorkRoute />, { loaded });
    // Romanian, the primary edition: made by a machine, not reviewed.
    expect(await screen.findByTestId('status-chip')).toHaveTextContent(
      'Traducere AI · Neverificată',
    );
    await fireEvent.press(within(switchGroup()).getByLabelText(EN));
    expect(screen.getByTestId('status-chip')).toHaveTextContent('Text original');
    await fireEvent.press(within(switchGroup()).getByLabelText(RO));

    await fireEvent.press(screen.getByTestId('transparency-open'));
    expect(await screen.findByTestId('transparency-lead')).toBeTruthy();
    expect(screen.getByText('Această traducere a fost făcută de o mașină.')).toBeTruthy();
    expect(screen.getByTestId('transparency-review')).toBeTruthy();
  });

  it('says it in English with an English interface', async () => {
    const loaded = await realLibrary();
    const { work } = await vosEditions(loaded.repository);
    await renderWithProviders(<WorkScreen workId={work.workId} />, {
      loaded,
      store: createSettingsStore({ uiLanguage: 'en' }),
    });
    expect(await screen.findByTestId('status-chip')).toHaveTextContent(
      'AI translation · Needs review',
    );
    expect(screen.getByLabelText('Details of how the text was made')).toBeTruthy();
  });
});

describe('WorkScreen: the actions (W4)', () => {
  it('starts at the first section on a first visit and continues where the reader stopped', async () => {
    const { loaded, translation, workId } = await twoEditions();
    const first = await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    expect(await screen.findByLabelText('Începe lectura')).toBeTruthy();
    await fireEvent.press(startButton());
    expect(router.push).toHaveBeenLastCalledWith(readHref(workId, sectionsOf(translation)[0]!.id));
    await first.unmount();

    const store = createMemoryStore({
      [positionKey(translation.edition.id)]: JSON.stringify({
        sectionId: sectionsOf(translation)[1]!.id,
        paragraphId: null,
        updatedAt: 1,
      }),
    });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded, store });
    expect(await screen.findByLabelText('Continuă lectura')).toBeTruthy();
  });

  it('opens the reader with pair= for "Citește în două limbi", only when two editions are installed', async () => {
    const { loaded, translation, workId } = await twoEditions();
    const first = await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    await fireEvent.press(await screen.findByTestId('work-cta-lanes'));
    expect(router.push).toHaveBeenLastCalledWith(
      readHref(workId, sectionsOf(translation)[0]!.id, { pair: 'ro+en' }),
    );
    await first.unmount();

    const one = await loadBundledRepository({ packs: [englishPack] });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded: one });
    await screen.findByTestId('work-cta-start');
    expect(screen.queryByTestId('work-cta-lanes')).toBeNull();
  });

  it('asks about the book when Ask is live, and shows nothing for it before (nothing dead)', async () => {
    const { loaded, workId } = await twoEditions();
    const first = await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    await screen.findByTestId('work-cta-start');
    expect(screen.queryByTestId('work-cta-ask')).toBeNull();
    await first.unmount();

    await renderWithProviders(
      <FeaturesProvider value={BETA_1_FEATURES}>
        <WorkScreen workId={workId} />
      </FeaturesProvider>,
      { loaded },
    );
    await fireEvent.press(await screen.findByTestId('work-cta-ask'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/ask',
      params: { scope: `work:${workId}` },
    });
    // There is no offline button in P1.
    expect(screen.queryByText(/offline/i)).toBeNull();
  });

  it('marks the work and remembers it: "Marcaj" becomes "Marcat" and the store holds the work', async () => {
    const { loaded, workId } = await twoEditions();
    const store = createMemoryStore();
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded, store });
    const button = await screen.findByTestId('work-bookmark');
    expect(button).toHaveTextContent('Marcaj');
    await fireEvent.press(button);
    expect(screen.getByTestId('work-bookmark')).toHaveTextContent('Marcat');
    await waitFor(() => {
      const list = JSON.parse(store.data.get(BOOKMARKS_KEY)!) as { workId: string }[];
      expect(list.map((bookmark) => bookmark.workId)).toEqual([workId]);
    });
    await fireEvent.press(screen.getByTestId('work-bookmark'));
    expect(screen.getByTestId('work-bookmark')).toHaveTextContent('Marcaj');
  });
});

describe('WorkScreen: the tabs, the overview and the contents (W5, W6)', () => {
  it('has the overview and the contents, with the count in the label, and only the tabs that have content', async () => {
    const loaded = await realLibrary();
    const { work } = await vosEditions(loaded.repository);
    await renderWithProviders(<WorkScreen workId={work.workId} />, { loaded });
    await screen.findByTestId('work-tabs');
    expect(screen.getByTestId('tab-overview').props.accessibilityLabel).toBe('Prezentare');
    expect(screen.getByTestId('tab-contents').props.accessibilityLabel).toBe('Cuprins · 11');
    expect(screen.getByTestId('tab-overview').props.accessibilityState.selected).toBe(true);
    // No tab for what Vos does not have yet.
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('writes the blurb with its label and the methodology of an AI text, and the start list into the reader', async () => {
    const loaded = await realLibrary();
    const { work, romanian, romanianSections } = await vosEditions(loaded.repository);
    await renderWithProviders(<WorkScreen workId={work.workId} />, { loaded });
    expect(await screen.findByTestId('blurb-label')).toHaveTextContent('Text generat cu AI');
    expect(screen.getByTestId('work-blurb')).toHaveTextContent(/Vos se întreabă ce a înțeles Isus/);
    expect(screen.getByTestId('blurb-methodology')).toBeTruthy();
    // "Unde să începi": three entries, each a link into the Romanian edition at its paragraph.
    const list = await screen.findByTestId('start-list');
    expect(within(list).getAllByRole('link')).toHaveLength(3);
    await fireEvent.press(screen.getByTestId('start-1'));
    const href = router.push.mock.calls.at(-1)![0] as ReturnType<typeof readHref>;
    expect(href.pathname).toBe('/read/[id]/[section]');
    expect(href.params.id).toBe(work.workId);
    expect(romanianSections.map((section) => section.id)).toContain(href.params.section);
    expect(href.params.p).toBeTruthy();
    expect(romanian.sectionCount).toBe(11);
  });

  it('lists the contents with a numeral column, marks the section in progress and checks those before it', async () => {
    const loaded = await realLibrary();
    const { work, english: edition, englishSections } = await vosEditions(loaded.repository);
    const store = createMemoryStore({
      [positionKey(edition.editionId)]: JSON.stringify({
        sectionId: englishSections[2]!.id,
        paragraphId: null,
        updatedAt: 1,
      }),
    });
    await renderWithProviders(<WorkScreen workId={work.workId} editionId={edition.editionId} />, {
      loaded,
      store,
    });
    await fireEvent.press(await screen.findByTestId('tab-contents'));
    const contents = within(await screen.findByTestId('contents'));
    expect(contents.getAllByTestId(/^contents-row-/)).toHaveLength(11);
    // The numeral of each row is in its own column, in the 600 face.
    const { numeral } = splitChapterHeading(englishSections[0]!.heading);
    expect(contents.getByText(numeral)).toBeTruthy();
    expect(contents.getByTestId('contents-current')).toHaveTextContent('în curs');
    expect(contents.getByTestId(`contents-done-${englishSections[0]!.id}`)).toBeTruthy();
    expect(contents.getByTestId(`contents-done-${englishSections[1]!.id}`)).toBeTruthy();
    expect(contents.queryByTestId(`contents-done-${englishSections[3]!.id}`)).toBeNull();
    expect(screen.getByLabelText(`Deschide ${englishSections[2]!.heading}, în curs`)).toBeTruthy();
    expect(screen.getByLabelText(`Deschide ${englishSections[0]!.heading}, parcursă`)).toBeTruthy();
  });

  it('has no overview tab, and so no tab strip, for a work with no blurb and no start list', async () => {
    const { loaded, workId } = await twoEditions();
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    await screen.findByTestId('work-card');
    expect(screen.queryByTestId('work-tabs')).toBeNull();
    expect(screen.getByText('Cuprins · 3')).toBeTruthy();
  });

  it('shows the details of the edition under "Despre această carte"', async () => {
    const { loaded, workId } = await twoEditions();
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    await fireEvent.press(await screen.findByLabelText('Despre această carte'));
    const details = within(screen.getByTestId('about-book'));
    expect(details.getByText('Sub licență')).toBeTruthy();
    expect(details.getByText('Versiunea')).toBeTruthy();
    expect(details.getByText('Revizia')).toBeTruthy();
    expect(details.getByText('Mărimea')).toBeTruthy();
  });
});

describe('WorkScreen: a phone (W7)', () => {
  it('stacks the actions, and the primary one fills the width', async () => {
    const { loaded, workId } = await twoEditions();
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    const primary = await screen.findByTestId('work-cta-start');
    expect(primary).toHaveStyle({ alignSelf: 'stretch' });
  });
});

describe('WorkScreen: editions, titles and the table of contents (kept from before the redesign)', () => {
  it('shows the title, the licence note and the table of contents of the English source edition', async () => {
    const { repository } = await loadBundledRepository();
    const { english: edition, englishSections } = await vosEditions(repository);
    const { work } = await vosEditions(repository);
    await renderWithProviders(<WorkScreen workId={work.workId} editionId={edition.editionId} />);

    expect((await screen.findAllByText(work.titleRo)).length).toBeGreaterThan(0);
    expect(screen.getByText('Cuprins · 11')).toBeTruthy();
    // The licence note of the edition under the transparency row (the status label is in the details).
    expect(screen.getByTestId('licence-note')).toBeTruthy();
    expect(screen.getByLabelText(`Deschide ${englishSections[0]!.heading}`)).toBeTruthy();
    expect(screen.getByLabelText('Începe lectura')).toBeTruthy();
    expect(englishSections).toHaveLength(11);
  });

  it('opens the edition in the reading language: Romanian, with its own metadata and sections', async () => {
    const { repository } = await loadBundledRepository();
    const { work, romanian, romanianSections } = await vosEditions(repository);
    await renderWithProviders(<WorkScreen workId={work.workId} />);

    await screen.findByLabelText('Începe lectura');
    expect(selected(RO)).toBe(true);
    expect(selected(EN)).toBe(false);
    // The note of the Romanian translation, not of the English source.
    expect(screen.getByTestId('licence-note')).toHaveTextContent(/Traducere nouă în română/);
    for (const section of romanianSections) {
      expect(screen.getByLabelText(`Deschide ${section.heading}`)).toBeTruthy();
    }
    await fireEvent.press(screen.getByLabelText('Începe lectura'));
    expect(router.push).toHaveBeenCalledWith(readHref(work.workId, romanianSections[0]!.id));
    expect(romanian.sectionCount).toBe(romanianSections.length);
  });

  it('opens the English edition when English is the reading language', async () => {
    const { repository } = await loadBundledRepository();
    const { work, englishSections } = await vosEditions(repository);
    await renderWithProviders(<WorkScreen workId={work.workId} />, {
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    await screen.findByLabelText('Începe lectura');
    expect(selected(EN)).toBe(true);
    expect(chapterRow(englishSections[0]!.heading)).toBeTruthy();
    expect(chapterRows().length).toBeGreaterThan(3); // the English text, not the few Romanian chapters
  });

  it('sets the chapter numeral apart from the heading in the table of contents', async () => {
    const { repository } = await loadBundledRepository();
    const { work, english: edition, englishSections } = await vosEditions(repository);
    const { numeral, title } = splitChapterHeading(englishSections[0]!.heading);
    expect(numeral).not.toBe('');
    await renderWithProviders(<WorkScreen workId={work.workId} editionId={edition.editionId} />);

    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.getByText(numeral)).toBeTruthy();
    // The row keeps the full heading for assistive technology.
    expect(screen.getByLabelText(`Deschide ${englishSections[0]!.heading}`)).toBeTruthy();
  });

  it('offers to continue where the reader stopped, in the edition that is shown', async () => {
    const { repository } = await loadBundledRepository();
    const { work, english: edition, englishSections } = await vosEditions(repository);
    const store = createMemoryStore({
      [positionKey(edition.editionId)]: JSON.stringify({
        sectionId: englishSections[1]!.id,
        paragraphId: null,
        updatedAt: 1,
      }),
    });
    await renderWithProviders(<WorkScreen workId={work.workId} editionId={edition.editionId} />, {
      store,
    });

    expect(await screen.findByLabelText('Continuă lectura')).toBeTruthy();
    // The chapter in progress carries the accent rule; for screen readers its label says so.
    expect(screen.getByLabelText(`Deschide ${englishSections[1]!.heading}, în curs`)).toBeTruthy();
    // The chapter before it counts as read.
    expect(screen.getByLabelText(`Deschide ${englishSections[0]!.heading}, parcursă`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Continuă lectura'));
    expect(router.push).toHaveBeenCalledWith(readHref(work.workId, englishSections[1]!.id));
  });

  it('reports an unknown work', async () => {
    await renderWithProviders(<WorkScreen workId="missing" />);
    expect(await screen.findByText('Lucrarea nu a fost găsită.')).toBeTruthy();
  });
});

describe('WorkScreen with one edition', () => {
  it('hides the edition switch', async () => {
    const loaded = await loadBundledRepository({ packs: [englishPack] });
    await renderWithProviders(<WorkScreen workId={english.work.id} />, { loaded });
    await screen.findByLabelText('Începe lectura');
    expect(screen.queryByLabelText('Alege ediția')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    // The one edition is shown whatever the reading language is.
    expect(screen.getByTestId('licence-note')).toBeTruthy();
    expect(chapterRow(sectionsOf(english)[0]!.heading)).toBeTruthy();
  });

  it('shows no "partial translation" chip on a source edition', async () => {
    const loaded = await loadBundledRepository({ packs: [englishPack] });
    await renderWithProviders(<WorkScreen workId={english.work.id} />, { loaded });
    await screen.findByLabelText('Începe lectura');
    expect(screen.queryByText('Traducere parțială')).toBeNull();
  });
});

describe('WorkScreen edition switch', () => {
  it('offers every edition by its language and role (17.7) and selects the primary one', async () => {
    const { loaded, workId } = await twoEditions();
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    await screen.findByLabelText('Începe lectura');

    expect(switchGroup().props.accessibilityRole).toBe('radiogroup');
    expect(within(switchGroup()).getAllByRole('radio')).toHaveLength(2);
    expect(selected(RO)).toBe(true);
    expect(selected(EN)).toBe(false);
  });

  it('tells editions that read the same apart by their kind, even when their codes differ', async () => {
    // "en" and "en-GB" are both "English" to the reader: the language alone would label both.
    const british = translationOf(english, { language: 'en-GB', sections: 2 });
    const loaded = await loadBundledRepository({
      packs: [englishPack, signPack(british, signer, { packId: 'vos-synthetic-en-gb' })],
      trustedKeys: [...trustedKeys, signer.key],
    });
    await renderWithProviders(<WorkScreen workId={english.work.id} />, { loaded });
    await screen.findByLabelText('Începe lectura');

    const labels = within(switchGroup())
      .getAllByRole('radio')
      .map((radio) => radio.props.accessibilityLabel as string);
    expect(labels).toEqual(['English · original', 'English · traducere']);
    expect(selected('English · original')).toBe(true);
    // Each option opens its own edition.
    await fireEvent.press(within(switchGroup()).getByLabelText('English · traducere'));
    expect(router.setParams).toHaveBeenLastCalledWith({ edition: british.edition.id });
  });

  it('switches the table of contents, the metadata and the start target with the route param', async () => {
    const { loaded, translation, workId } = await twoEditions();
    setMockParams({ id: workId });
    await renderWithProviders(<WorkRoute />, { loaded });
    await screen.findByLabelText('Începe lectura');

    // Romanian, the primary edition: three synthetic chapters, the translation's licence.
    const romanian = sectionsOf(translation);
    expect(screen.getAllByLabelText(/^Deschide /)).toHaveLength(3);
    expect(screen.getByLabelText(`Deschide ${romanian[0]!.heading}`)).toBeTruthy();
    expect(screen.getByTestId('licence-note')).toHaveTextContent(/Synthetic|sintetică/);
    await fireEvent.press(screen.getByLabelText('Începe lectura'));
    expect(router.push).toHaveBeenLastCalledWith(readHref(workId, romanian[0]!.id));

    // English: eleven chapters of the source, its licence, its start target.
    await fireEvent.press(within(switchGroup()).getByLabelText(EN));
    expect(router.setParams).toHaveBeenCalledWith({ edition: english.edition.id });
    expect(selected(EN)).toBe(true);
    expect(selected(RO)).toBe(false);
    const source = sectionsOf(english);
    expect(chapterRows().length).toBeGreaterThan(3);
    expect(screen.getByLabelText(`Deschide ${source[0]!.heading}`)).toBeTruthy();
    expect(screen.queryByLabelText(`Deschide ${romanian[0]!.heading}`)).toBeNull();
    expect(screen.getByTestId('licence-note')).toHaveTextContent(/Text original publicat/);
    await fireEvent.press(screen.getByLabelText('Începe lectura'));
    expect(router.push).toHaveBeenLastCalledWith(readHref(workId, source[0]!.id));

    // And back.
    await fireEvent.press(within(switchGroup()).getByLabelText(RO));
    expect(router.setParams).toHaveBeenLastCalledWith({ edition: translation.edition.id });
    expect(screen.getAllByLabelText(/^Deschide /)).toHaveLength(3);
    expect(selected(RO)).toBe(true);
  });

  it('opens the edition named by the ?edition= param', async () => {
    const { loaded, workId } = await twoEditions();
    setMockParams({ id: workId, edition: english.edition.id });
    await renderWithProviders(<WorkRoute />, { loaded });
    await screen.findByLabelText('Începe lectura');
    expect(selected(EN)).toBe(true);
    expect(chapterRow(sectionsOf(english)[0]!.heading)).toBeTruthy();
    expect(chapterRows().length).toBeGreaterThan(3);
  });

  it('falls back to the primary edition for a param that names no edition of the work', async () => {
    const { loaded, workId } = await twoEditions();
    setMockParams({ id: workId, edition: 'not-an-edition' });
    await renderWithProviders(<WorkRoute />, { loaded });
    await screen.findByLabelText('Începe lectura');
    expect(selected(RO)).toBe(true);
    expect(chapterRows()).toHaveLength(3);
  });

  it('keeps the switch on screen while it changes editions', async () => {
    const { loaded, workId } = await twoEditions();
    setMockParams({ id: workId });
    await renderWithProviders(<WorkRoute />, { loaded });
    await screen.findByLabelText('Începe lectura');
    const group = switchGroup();
    await fireEvent.press(within(group).getByLabelText(EN));
    // The same control, not a loading screen and a new one: a keyboard user keeps the focus.
    expect(switchGroup()).toBe(group);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('continues from the position saved for the edition that is selected', async () => {
    const { loaded, translation, workId } = await twoEditions();
    const romanian = sectionsOf(translation);
    const source = sectionsOf(english);
    const store = createMemoryStore({
      [positionKey(translation.edition.id)]: JSON.stringify({
        sectionId: romanian[2]!.id,
        paragraphId: null,
        updatedAt: 2,
      }),
    });
    setMockParams({ id: workId });
    await renderWithProviders(<WorkRoute />, { loaded, store });

    // Romanian was read to its third chapter...
    expect(await screen.findByLabelText('Continuă lectura')).toBeTruthy();
    expect(screen.getByLabelText(`Deschide ${romanian[2]!.heading}, în curs`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Continuă lectura'));
    expect(router.push).toHaveBeenLastCalledWith(readHref(workId, romanian[2]!.id));

    // ...English was never opened: it starts at the beginning.
    await fireEvent.press(within(switchGroup()).getByLabelText(EN));
    expect(screen.getByLabelText('Începe lectura')).toBeTruthy();
    expect(screen.queryByLabelText('Continuă lectura')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Începe lectura'));
    expect(router.push).toHaveBeenLastCalledWith(readHref(workId, source[0]!.id));
  });

  it('ignores a position saved for an edition when the section is not in the one shown', async () => {
    const { loaded, translation, workId } = await twoEditions();
    // A (stale) Romanian position that points into the English text: not a place in this edition.
    const store = createMemoryStore({
      [positionKey(translation.edition.id)]: JSON.stringify({
        sectionId: english.sections[4]!.id,
        paragraphId: null,
        updatedAt: 2,
      }),
    });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded, store });
    expect(await screen.findByLabelText('Începe lectura')).toBeTruthy();
    expect(screen.queryByLabelText('Continuă lectura')).toBeNull();
  });

  it('uses the position an older version saved for the work as the one of the source edition only', async () => {
    const { loaded, workId } = await twoEditions();
    const source = sectionsOf(english);
    const store = createMemoryStore({
      [legacyPositionKey(workId)]: JSON.stringify({
        sectionId: source[3]!.id,
        paragraphId: null,
        updatedAt: 1,
      }),
    });
    setMockParams({ id: workId });
    await renderWithProviders(<WorkRoute />, { loaded, store });

    // The translation never read it: it starts at the beginning.
    expect(await screen.findByLabelText('Începe lectura')).toBeTruthy();
    // The source edition resumes where the old version left the reader.
    await fireEvent.press(within(switchGroup()).getByLabelText(EN));
    expect(screen.getByLabelText('Continuă lectura')).toBeTruthy();
    expect(screen.getByLabelText(`Deschide ${source[3]!.heading}, în curs`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Continuă lectura'));
    expect(router.push).toHaveBeenLastCalledWith(readHref(workId, source[3]!.id));
  });

  it('opens the right chapter from the table of contents of each edition', async () => {
    const { loaded, translation, workId } = await twoEditions();
    setMockParams({ id: workId });
    await renderWithProviders(<WorkRoute />, { loaded });
    const romanian = sectionsOf(translation);
    await fireEvent.press(await screen.findByLabelText(`Deschide ${romanian[1]!.heading}`));
    expect(router.push).toHaveBeenLastCalledWith(readHref(workId, romanian[1]!.id));
    await fireEvent.press(within(switchGroup()).getByLabelText(EN));
    const source = sectionsOf(english);
    await fireEvent.press(screen.getByLabelText(`Deschide ${source[1]!.heading}`));
    expect(router.push).toHaveBeenLastCalledWith(readHref(workId, source[1]!.id));
  });
});

describe('WorkScreen partial translation', () => {
  it('tells that a translation covers fewer sections than its source, on that edition only', async () => {
    const { loaded, workId } = await twoEditions({ sections: 3 });
    setMockParams({ id: workId });
    await renderWithProviders(<WorkRoute />, { loaded });
    expect(await screen.findByText('Traducere parțială')).toBeTruthy();

    await fireEvent.press(within(switchGroup()).getByLabelText(EN));
    expect(screen.queryByText('Traducere parțială')).toBeNull();
  });

  it('shows no chip once the translation covers every section', async () => {
    const { loaded, translation, workId } = await twoEditions({ sections: 11 });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    await screen.findByLabelText('Începe lectura');
    // The Romanian edition is the one shown, and it is whole.
    expect(selected(RO)).toBe(true);
    expect(chapterRow(sectionsOf(translation)[0]!.heading)).toBeTruthy();
    expect(chapterRows().length).toBeGreaterThan(3);
    expect(screen.queryByText('Traducere parțială')).toBeNull();
  });

  it('shows no chip for a translation whose source is not installed', async () => {
    const translation = translationOf(english, { sections: 2 });
    const loaded = await loadBundledRepository({
      packs: [signPack(translation, signer, { packId: 'vos-synthetic-ro' })],
      trustedKeys: [...trustedKeys, signer.key],
    });
    await renderWithProviders(<WorkScreen workId={english.work.id} />, { loaded });
    await screen.findByLabelText('Începe lectura');
    expect(screen.queryByText('Traducere parțială')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('says it in English with an English interface', async () => {
    const { loaded, workId } = await twoEditions({ sections: 3 });
    const store = createSettingsStore({ uiLanguage: 'en' });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded, store });
    expect(await screen.findByText('Partial translation')).toBeTruthy();
  });
});

describe('WorkScreen titles and notes by language', () => {
  it('titles the work in the reading language, with the original title under it', async () => {
    const { loaded, workId } = await twoEditions({ language: 'ro' });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    expect(await screen.findByText(english.work.titleRo)).toBeTruthy();
    expect(screen.getByText(english.work.titleOrig)).toBeTruthy();
  });

  it('titles an English-original work with its original title for an English reader, and says it once', async () => {
    const { loaded, workId } = await twoEditions();
    const store = createSettingsStore({ readingLanguage: 'en' });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded, store });
    expect(await screen.findAllByText(english.work.titleOrig)).toHaveLength(1);
    expect(screen.queryByText(english.work.titleRo)).toBeNull();
  });

  it('titles a work with the English title of the pack for an English reader', async () => {
    // The bare source has no titleEn of its own, so the translation's is the one shown.
    const { loaded, workId } = await twoEditions({ titleEn: 'The Kingdom, in English' }, true);
    const store = createSettingsStore({ readingLanguage: 'en' });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded, store });
    expect(await screen.findByText('The Kingdom, in English')).toBeTruthy();
    // The original title is still shown when it differs from the title shown.
    expect(screen.getByText(english.work.titleOrig)).toBeTruthy();
  });

  it('shows the licence note of the real English pack in Romanian or English, by the interface', async () => {
    const { loaded, workId } = await twoEditions();
    const licence = english.edition.licence;
    expect(licence.noteRo).toBeTruthy();
    expect(licence.noteEn).toBeUndefined();
    setMockParams({ id: workId });
    const first = await renderWithProviders(<WorkRoute />, { loaded });
    await screen.findByLabelText('Începe lectura');
    await fireEvent.press(within(switchGroup()).getByLabelText(EN));
    expect(screen.getByText(licence.noteRo!)).toBeTruthy();
    expect(screen.queryByText(licence.note)).toBeNull();
    await first.unmount();

    // The English edition has no English-specific note: the English interface shows `note`.
    setMockParams({ id: workId });
    const store = createSettingsStore({ uiLanguage: 'en', readingLanguage: 'en' });
    await renderWithProviders(<WorkRoute />, { loaded, store });
    expect(await screen.findByText(licence.note)).toBeTruthy();
    expect(screen.queryByText(licence.noteRo!)).toBeNull();
  });

  it('shows the licence note in the language of the interface, falling back to the note itself', async () => {
    const { loaded, workId } = await twoEditions({}, true);
    setMockParams({ id: workId });
    const first = await renderWithProviders(<WorkRoute />, { loaded });
    expect(await screen.findByText('Traducere sintetică făcută pentru teste.')).toBeTruthy();
    // The English edition has no Romanian note: its own note is shown.
    await fireEvent.press(within(switchGroup()).getByLabelText(EN));
    expect(screen.getByText(english.edition.licence.note)).toBeTruthy();
    await first.unmount();

    setMockParams({ id: workId });
    const store = createSettingsStore({ uiLanguage: 'en' });
    await renderWithProviders(<WorkRoute />, { loaded, store });
    expect(
      await screen.findByText('Synthetic translation made for tests (English note).'),
    ).toBeTruthy();
  });

  it('is written in English with an English interface', async () => {
    const { loaded, workId } = await twoEditions();
    const store = createSettingsStore({ uiLanguage: 'en' });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded, store });
    expect(await screen.findByLabelText('Start reading')).toBeTruthy();
    expect(screen.getByText('Contents · 3')).toBeTruthy();
    expect(screen.getByLabelText('Choose the edition')).toBeTruthy();
    expect(screen.getByLabelText('Read in two languages')).toBeTruthy();
    expect(screen.getByLabelText('Sections: 3')).toBeTruthy();
  });

  it('labels the editions with their language in its own language, in any interface', async () => {
    const { loaded, workId } = await twoEditions();
    const store = createSettingsStore({ uiLanguage: 'en' });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded, store });
    await screen.findByLabelText('Start reading');
    // "Română" in its own language; the role in the language of the interface.
    const group = within(screen.getByLabelText('Choose the edition'));
    expect(group.getByLabelText('Română · translation')).toBeTruthy();
    expect(group.getByLabelText('English · original')).toBeTruthy();
  });
});
