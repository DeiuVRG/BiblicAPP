import type { Pack } from '@biblioteca/shared';
import { fireEvent, screen, within } from '@testing-library/react-native';

import WorkRoute from '@/app/work/[id]';
import { loadBundledRepository } from '@/content/repository';
import type { LoadedRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import { WorkScreen } from '@/features/work/work-screen';
import { readHref } from '@/navigation-hrefs';
import { splitChapterHeading } from '@/reading/heading';
import { legacyPositionKey, positionKey } from '@/reading/position-store';
import { router, setMockParams } from '@/test-support/expo-router-mock';
import { bundledPack, createTestSigner, signPack, translationOf } from '@/test-support/packs';
import type { TranslationOptions } from '@/test-support/packs';
import { createMemoryStore, createSettingsStore, renderWithProviders } from '@/test-support/render';
import { vosEditions } from '@/test-support/vos';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

const signer = createTestSigner();
const englishPack = bundledPack('vos-1903-kingdom-en');
const english = englishPack.pack as Pack;

/** The English source plus a synthetic Romanian translation of its first sections. */
async function twoEditions(options: TranslationOptions = {}): Promise<{
  loaded: LoadedRepository;
  translation: Pack;
  workId: string;
}> {
  const translation = translationOf(english, { sections: 3, ...options });
  const loaded = await loadBundledRepository({
    packs: [englishPack, signPack(translation, signer, { packId: 'vos-synthetic-ro' })],
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

beforeEach(() => {
  router.push.mockClear();
  router.setParams.mockClear();
  setMockParams({});
});

describe('WorkScreen', () => {
  it('shows metadata, licence and the table of contents of the English source edition', async () => {
    const { repository } = await loadBundledRepository();
    const { english: edition, englishSections } = await vosEditions(repository);
    const { work } = await vosEditions(repository);
    await renderWithProviders(<WorkScreen workId={work.workId} editionId={edition.editionId} />);

    expect((await screen.findAllByText(work.titleRo)).length).toBeGreaterThan(0);
    expect(screen.getByText('Cuprins')).toBeTruthy();
    // The metadata block: a label and a value per row.
    for (const label of ['Ediție', 'Limbă', 'Licență']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // "Original" is the kind of this edition and the label of the row about the original text.
    expect(screen.getAllByText('Original')).toHaveLength(2);
    expect(screen.getByText('Engleză, 1903')).toBeTruthy();
    expect(screen.getByText('Domeniu public')).toBeTruthy();
    expect(screen.getByLabelText(`Deschide ${englishSections[0]!.heading}`)).toBeTruthy();
    expect(screen.getByLabelText('Începe lectura')).toBeTruthy();
    expect(englishSections).toHaveLength(11);
  });

  it('opens the edition in the reading language: Romanian, with its own metadata and sections', async () => {
    const { repository } = await loadBundledRepository();
    const { work, romanian, romanianSections } = await vosEditions(repository);
    await renderWithProviders(<WorkScreen workId={work.workId} />);

    await screen.findByLabelText('Începe lectura');
    expect(selected('Română')).toBe(true);
    expect(selected('English')).toBe(false);
    // The metadata of the Romanian translation, not of the English source.
    expect(screen.getByText('Sub licență')).toBeTruthy();
    expect(screen.queryByText('Domeniu public')).toBeNull();
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
    expect(selected('English')).toBe(true);
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
    expect(screen.getByLabelText(`Deschide ${englishSections[0]!.heading}`)).toBeTruthy();
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
    expect(screen.getByText('Domeniu public')).toBeTruthy();
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
  it('offers every edition by its language and selects the primary one', async () => {
    const { loaded, workId } = await twoEditions();
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    await screen.findByLabelText('Începe lectura');

    expect(switchGroup().props.accessibilityRole).toBe('radiogroup');
    expect(within(switchGroup()).getAllByRole('radio')).toHaveLength(2);
    expect(selected('Română')).toBe(true);
    expect(selected('English')).toBe(false);
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
    expect(screen.getByText('Sub licență')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Începe lectura'));
    expect(router.push).toHaveBeenLastCalledWith(readHref(workId, romanian[0]!.id));

    // English: eleven chapters of the source, its licence, its start target.
    await fireEvent.press(within(switchGroup()).getByLabelText('English'));
    expect(router.setParams).toHaveBeenCalledWith({ edition: english.edition.id });
    expect(selected('English')).toBe(true);
    expect(selected('Română')).toBe(false);
    const source = sectionsOf(english);
    expect(chapterRows().length).toBeGreaterThan(3);
    expect(screen.getByLabelText(`Deschide ${source[0]!.heading}`)).toBeTruthy();
    expect(screen.queryByLabelText(`Deschide ${romanian[0]!.heading}`)).toBeNull();
    expect(screen.getByText('Domeniu public')).toBeTruthy();
    expect(screen.queryByText('Sub licență')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Începe lectura'));
    expect(router.push).toHaveBeenLastCalledWith(readHref(workId, source[0]!.id));

    // And back.
    await fireEvent.press(within(switchGroup()).getByLabelText('Română'));
    expect(router.setParams).toHaveBeenLastCalledWith({ edition: translation.edition.id });
    expect(screen.getAllByLabelText(/^Deschide /)).toHaveLength(3);
    expect(selected('Română')).toBe(true);
  });

  it('opens the edition named by the ?edition= param', async () => {
    const { loaded, workId } = await twoEditions();
    setMockParams({ id: workId, edition: english.edition.id });
    await renderWithProviders(<WorkRoute />, { loaded });
    await screen.findByLabelText('Începe lectura');
    expect(selected('English')).toBe(true);
    expect(chapterRow(sectionsOf(english)[0]!.heading)).toBeTruthy();
    expect(chapterRows().length).toBeGreaterThan(3);
  });

  it('falls back to the primary edition for a param that names no edition of the work', async () => {
    const { loaded, workId } = await twoEditions();
    setMockParams({ id: workId, edition: 'not-an-edition' });
    await renderWithProviders(<WorkRoute />, { loaded });
    await screen.findByLabelText('Începe lectura');
    expect(selected('Română')).toBe(true);
    expect(chapterRows()).toHaveLength(3);
  });

  it('keeps the switch on screen while it changes editions', async () => {
    const { loaded, workId } = await twoEditions();
    setMockParams({ id: workId });
    await renderWithProviders(<WorkRoute />, { loaded });
    await screen.findByLabelText('Începe lectura');
    const group = switchGroup();
    await fireEvent.press(within(group).getByLabelText('English'));
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
    await fireEvent.press(within(switchGroup()).getByLabelText('English'));
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
    await fireEvent.press(within(switchGroup()).getByLabelText('English'));
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
    await fireEvent.press(within(switchGroup()).getByLabelText('English'));
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

    await fireEvent.press(within(switchGroup()).getByLabelText('English'));
    expect(screen.queryByText('Traducere parțială')).toBeNull();
  });

  it('shows no chip once the translation covers every section', async () => {
    const { loaded, translation, workId } = await twoEditions({ sections: 11 });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded });
    await screen.findByLabelText('Începe lectura');
    // The Romanian edition is the one shown, and it is whole.
    expect(selected('Română')).toBe(true);
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
    const { loaded, workId } = await twoEditions({ titleEn: 'The Kingdom, in English' });
    const store = createSettingsStore({ readingLanguage: 'en' });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded, store });
    expect(await screen.findByText('The Kingdom, in English')).toBeTruthy();
    // The original title is still shown when it differs from the title shown.
    expect(screen.getByText(english.work.titleOrig)).toBeTruthy();
  });

  it('shows the licence note in the language of the interface, falling back to the note itself', async () => {
    const { loaded, workId } = await twoEditions();
    setMockParams({ id: workId });
    const first = await renderWithProviders(<WorkRoute />, { loaded });
    expect(await screen.findByText('Traducere sintetică făcută pentru teste.')).toBeTruthy();
    // The English edition has no Romanian note: its own note is shown.
    await fireEvent.press(within(switchGroup()).getByLabelText('English'));
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
    expect(screen.getByText('Contents')).toBeTruthy();
    expect(screen.getByLabelText('Choose the edition')).toBeTruthy();
    for (const label of ['Edition', 'Language', 'Original', 'Licence']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('Translation')).toBeTruthy(); // the kind of the edition shown
    expect(screen.getByText('Licensed')).toBeTruthy();
  });

  it('labels the languages of the metadata block in the language of the interface', async () => {
    const { loaded, workId } = await twoEditions();
    const store = createSettingsStore({ uiLanguage: 'en' });
    await renderWithProviders(<WorkScreen workId={workId} />, { loaded, store });
    await screen.findByLabelText('Start reading');
    // "Română" in its own language; the language of the original in the interface language.
    expect(screen.getAllByText('Română').length).toBeGreaterThan(0);
    expect(screen.getByText('English, 1903')).toBeTruthy();
  });
});
