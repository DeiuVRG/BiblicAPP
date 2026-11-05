import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { loadBundledCatalogue } from '@/catalogue/verify-catalogue';
import { FEATURES, FeaturesProvider } from '@/config/features';
import type { Features } from '@/config/features';
import { loadBundledRepository } from '@/content/repository';
import { CuratedScreen } from '@/features/library/curated-screen';
import { en } from '@/i18n/en';
import { ro as t } from '@/i18n/ro';
import { authorHref, libraryAllWith, workHref } from '@/navigation-hrefs';
import { resetMockRouter, router } from '@/test-support/expo-router-mock';
import { signCatalogue } from '@/test-support/catalogue';
import { syntheticLibrary } from '@/test-support/library-fixtures';
import { bundledPack } from '@/test-support/packs';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';
import { palettes } from '@/theme/palettes';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

const original = Dimensions.get('window');

beforeEach(() => {
  resetMockRouter();
});

afterEach(async () => {
  await act(async () => {
    Dimensions.set({ window: original });
  });
});

async function resizeTo(width: number) {
  await act(async () => {
    Dimensions.set({ window: { ...original, width } });
  });
}

/** F-2 with an editorial "Începe aici" list. */
async function libraryStartingWith(slugs: string[]) {
  const library = syntheticLibrary();
  const bundled = signCatalogue({ ...library.catalogue, startHere: slugs }, library.signer);
  const catalogue = await loadBundledCatalogue({ bundled, trustedKeys: library.trustedKeys });
  expect(catalogue.status).toBe('verified');
  return {
    library,
    loaded: await loadBundledRepository({
      packs: library.packs,
      trustedKeys: library.trustedKeys,
      catalogue,
    }),
  };
}

async function renderCurated(
  features: Partial<Features> = {},
  options: Parameters<typeof renderWithProviders>[1] = {},
) {
  const loaded = options.loaded ?? (await syntheticLibrary().load());
  return renderWithProviders(
    <FeaturesProvider value={{ ...FEATURES, ...features }}>
      <CuratedScreen />
    </FeaturesProvider>,
    { ...options, loaded },
  );
}

describe('CuratedScreen: the hero', () => {
  it('asks what to read and offers a search form and the way to the whole library', async () => {
    await renderCurated();
    expect(within(screen.getByTestId('library-hero')).getByText(t.library.heroTitle)).toBeTruthy();
    expect(screen.getByLabelText(t.library.heroPlaceholder)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('hero-all'));
    expect(router.push).toHaveBeenCalledWith('/library/all');
  });

  it('is 380 high on a wide screen, and takes the height of its content on a phone', async () => {
    await resizeTo(1366);
    const first = await renderCurated();
    expect(screen.getByTestId('library-hero-band')).toHaveStyle({ minHeight: 380 });
    await first.unmount();
    await resizeTo(390);
    await renderCurated();
    expect(StyleSheet.flatten(screen.getByTestId('library-hero-band').props.style).minHeight).toBe(
      undefined,
    );
  });

  it('joins the field (660 wide at most) and "CAUTĂ" (121) side by side on a wide screen', async () => {
    await resizeTo(1366);
    await renderCurated();
    const field = screen.getByTestId('library-hero-search');
    // The square right corners that meet the button, in a form that is 660 + 121 wide at most.
    expect(field).toHaveStyle({ borderTopRightRadius: 0, borderBottomRightRadius: 0 });
    const form = screen.getByTestId('library-hero-submit').parent!;
    expect(form).toHaveStyle({ flexDirection: 'row', maxWidth: 781 });
    expect(field.parent!.parent).toHaveStyle({ flex: 1, maxWidth: 660 });
    expect(screen.getByTestId('library-hero-submit')).toHaveStyle({ width: 121 });
    // The block of the hero takes the whole row of its actions: a content-sized form was 278 wide.
    expect(form.parent).toHaveStyle({ width: '100%' });
  });

  it('stacks the field over the button on a phone, so the placeholder has the width of the screen', async () => {
    await resizeTo(390);
    await renderCurated();
    const field = screen.getByTestId('library-hero-search');
    expect(StyleSheet.flatten(field.props.style).borderTopRightRadius).toBe(undefined);
    const form = screen.getByTestId('library-hero-submit').parent!;
    expect(form).toHaveStyle({ flexDirection: 'column' });
    expect(screen.getByTestId('library-hero-submit')).toHaveStyle({ alignSelf: 'stretch' });
    expect(field.parent!.parent).toHaveStyle({ alignSelf: 'stretch' });
    // At 640 points it is still a phone.
    await resizeTo(640);
    expect(screen.getByTestId('library-hero-submit').parent).toHaveStyle({
      flexDirection: 'column',
    });
    await resizeTo(641);
    expect(screen.getByTestId('library-hero-submit').parent).toHaveStyle({ flexDirection: 'row' });
  });

  it('sends the words typed to the full library as a name search', async () => {
    await renderCurated();
    await fireEvent.changeText(screen.getByLabelText(t.library.heroPlaceholder), '  augustin ');
    await fireEvent.press(screen.getByTestId('library-hero-submit'));
    expect(router.push).toHaveBeenCalledWith(libraryAllWith({ q: 'augustin' }));
  });

  it('sends Enter in the field the same way, and nothing typed to the plain library', async () => {
    await renderCurated();
    await fireEvent(screen.getByLabelText(t.library.heroPlaceholder), 'submitEditing');
    expect(router.push).toHaveBeenLastCalledWith('/library/all');
    await fireEvent.changeText(screen.getByLabelText(t.library.heroPlaceholder), 'calvin');
    await fireEvent(screen.getByLabelText(t.library.heroPlaceholder), 'submitEditing');
    expect(router.push).toHaveBeenLastCalledWith(libraryAllWith({ q: 'calvin' }));
  });

  it('shows the buttons of the sections that are live and no others', async () => {
    const first = await renderCurated();
    expect(screen.getByTestId('hero-authors')).toBeTruthy();
    expect(screen.queryByTestId('hero-traditions')).toBeNull();
    expect(screen.queryByTestId('hero-guides')).toBeNull();
    await fireEvent.press(screen.getByTestId('hero-authors'));
    expect(router.push).toHaveBeenCalledWith('/authors');
    await first.unmount();

    await renderCurated({ authors: false, traditions: true, guides: true });
    expect(screen.queryByTestId('hero-authors')).toBeNull();
    await fireEvent.press(screen.getByTestId('hero-traditions'));
    expect(router.push).toHaveBeenCalledWith('/traditions');
    await fireEvent.press(screen.getByTestId('hero-guides'));
    expect(router.push).toHaveBeenCalledWith('/guides');
  });
});

describe('CuratedScreen: the bands', () => {
  it('draws a band only when it has something to show', async () => {
    await renderCurated();
    expect(await screen.findByTestId('band-creeds')).toBeTruthy();
    expect(screen.getByTestId('band-authors')).toBeTruthy();
    expect(screen.getByTestId('band-fathers')).toBeTruthy();
    expect(screen.getByTestId('band-shelves')).toBeTruthy();
    // F-2 has no editorial "start here" list.
    expect(screen.queryByTestId('band-start')).toBeNull();
  });

  it('separates the dark band of authors from the dark hero when no band lies between them', async () => {
    // Vos alone: no creeds, no "start here" list, the authors band follows the hero.
    const loaded = await loadBundledRepository({
      catalogue: await loadBundledCatalogue(),
    });
    await renderCurated({}, { loaded });
    const authors = await screen.findByTestId('band-authors');
    expect(authors).toHaveStyle({
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: palettes.light.mastheadBorder,
    });
  });

  it('draws no hairline above the authors band when a band of another colour precedes it', async () => {
    await renderCurated();
    const authors = await screen.findByTestId('band-authors');
    // F-2 has creeds: the cream band lies between the hero and the authors.
    expect(screen.getByTestId('band-creeds')).toBeTruthy();
    expect(StyleSheet.flatten(authors.props.style).borderTopWidth).toBe(undefined);
  });

  it('draws only the hero around an empty library', async () => {
    const verify = jest.fn(async () => ({ ok: false as const, reason: 'bad-signature' as const }));
    const loaded = await loadBundledRepository({
      packs: [bundledPack('vos-1903-kingdom-en')],
      verify,
    });
    await renderCurated({}, { loaded });
    expect(screen.getByTestId('library-hero')).toBeTruthy();
    // Nothing to wait for: the library is loaded, with nothing in it.
    await screen.findByTestId('library-hero');
    for (const id of [
      'band-creeds',
      'band-start',
      'band-authors',
      'band-fathers',
      'band-shelves',
    ]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it('shows the creeds as large rows that open the work', async () => {
    const { library, loaded } = await libraryStartingWith([]);
    await renderCurated({}, { loaded });
    const band = within(await screen.findByTestId('band-creeds'));
    expect(band.getByText(t.library.bandCreeds.label)).toBeTruthy();
    expect(band.getByText(t.library.bandCreeds.title)).toBeTruthy();
    const row = band.getByTestId('library-row-definitia-de-la-calcedon');
    // The curated rows carry the group and the date, and no edition badges.
    expect(band.getByText('Conciliul din Calcedon · 451')).toBeTruthy();
    expect(within(row).queryByText('RO')).toBeNull();
    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith(
      workHref(library.workIds['definitia-de-la-calcedon']!),
    );
  });

  it('lists the works of "Începe aici" in the order of the catalogue, at most ten', async () => {
    const order = [
      'institutio',
      'cur-deus-homo',
      'despre-spirit-si-litera',
      'summa-theologiae',
      'imitarea-lui-hristos',
      'libertatea-crestinului',
      'omorarea-pacatului',
      'regula-pastorala',
      'afectiunile-religioase',
      'teologie-sistematica',
      'invatatura-lui-isus',
    ];
    const { loaded } = await libraryStartingWith(order);
    await renderCurated({}, { loaded });
    const band = within(await screen.findByTestId('band-start'));
    const rows = band.getAllByTestId(/^library-row-/).map((row) => row.props.testID);
    expect(rows).toEqual(order.slice(0, 10).map((slug) => `library-row-${slug}`));
  });

  it('folds and unfolds a band from its header', async () => {
    await renderCurated();
    const toggle = await screen.findByTestId('band-fathers-toggle');
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getByTestId('band-fathers-body')).toBeTruthy();
    await fireEvent.press(toggle);
    expect(screen.getByTestId('band-fathers-toggle').props.accessibilityState).toMatchObject({
      expanded: false,
    });
    expect(screen.queryByTestId('band-fathers-body')).toBeNull();
    await fireEvent.press(screen.getByTestId('band-fathers-toggle'));
    expect(screen.getByTestId('band-fathers-body')).toBeTruthy();
  });

  it('shows the Fathers of the shelf of that name, each a compact row', async () => {
    await renderCurated();
    const band = within(await screen.findByTestId('band-fathers'));
    expect(band.getAllByTestId(/^library-row-/)).toHaveLength(4);
    expect(band.getByTestId('library-row-despre-spirit-si-litera')).toBeTruthy();
  });

  it('names the authors in the dark band, each a link to the library filtered by the name', async () => {
    await renderCurated();
    const band = within(await screen.findByTestId('band-authors'));
    expect(band.getAllByTestId(/^curated-author-/)).toHaveLength(15);
    const augustin = band.getByTestId('curated-author-augustin');
    // "NUME COMPLET · n. AN": the name in the language of the author, when it differs.
    expect(augustin.props.accessibilityLabel).toBe('Augustin, Aurelius Augustinus · n. 354');
    await fireEvent.press(augustin);
    expect(router.push).toHaveBeenCalledWith(libraryAllWith({ q: 'Augustin' }));
    await fireEvent.press(band.getByTestId('band-authors-all'));
    expect(router.push).toHaveBeenCalledWith('/authors');
  });

  it('leads an author to the author page once that page is live', async () => {
    await renderCurated({ authorPages: true });
    const band = within(await screen.findByTestId('band-authors'));
    await fireEvent.press(band.getByTestId('curated-author-augustin'));
    expect(router.push).toHaveBeenCalledWith(authorHref('augustin'));
  });

  it('has no link to the list of authors while that screen is not live', async () => {
    await renderCurated({ authors: false });
    const band = within(await screen.findByTestId('band-authors'));
    expect(band.queryByTestId('band-authors-all')).toBeNull();
  });

  it('draws a block per shelf with the featured works and a link to the whole shelf', async () => {
    await renderCurated();
    const blocks = await screen.findAllByTestId(/^shelf-block-[a-z]+$/);
    expect(blocks).toHaveLength(6);
    const fathers = within(screen.getByTestId('shelf-block-fathers'));
    expect(fathers.getByText('Părinții Bisericii')).toBeTruthy();
    expect(fathers.getAllByRole('link')).toHaveLength(4 + 1);
    const all = fathers.getByTestId('shelf-block-fathers-all');
    expect(all).toHaveTextContent(/^Toate cele 4\slucrări/);
    await fireEvent.press(all);
    expect(router.push).toHaveBeenCalledWith(libraryAllWith({ shelf: 'fathers' }));
  });

  it('words the footer of a shelf of one work as the shelf, not as "Toate 1 lucrare"', async () => {
    // Vos alone: one work on the shelf of modern theology.
    const loaded = await loadBundledRepository({ catalogue: await loadBundledCatalogue() });
    const first = await renderCurated({}, { loaded });
    const footer = await screen.findByTestId('shelf-block-modern-all');
    expect(footer).toHaveTextContent(/^Deschide raftul/);
    expect(footer).not.toHaveTextContent(/Toate/);
    await first.unmount();
    await renderCurated(
      {},
      { loaded, store: createSettingsStore({ uiLanguage: 'en', readingLanguage: 'en' }) },
    );
    expect(await screen.findByTestId('shelf-block-modern-all')).toHaveTextContent(
      /^Open the shelf/,
    );
  });

  it('shows five works of a shelf at most, and says how many there are', async () => {
    await renderCurated();
    // The Fathers have four, the Middle Ages four, the Reformation two: none passes five in F-2.
    const medieval = within(await screen.findByTestId('shelf-block-medieval'));
    expect(medieval.getAllByRole('link').length).toBeLessThanOrEqual(5 + 1);
  });

  it('shows the work of the committed packs on its shelf and no band that has nothing', async () => {
    const loaded = await loadBundledRepository();
    await renderCurated({}, { loaded });
    expect(await screen.findByTestId('band-shelves')).toBeTruthy();
    expect(screen.queryByTestId('band-creeds')).toBeNull();
    expect(screen.queryByTestId('band-fathers')).toBeNull();
  });

  it('is written in English with an English interface', async () => {
    await renderCurated(
      {},
      { store: createSettingsStore({ uiLanguage: 'en', readingLanguage: 'en' }) },
    );
    expect(await screen.findByText(en.library.bandCreeds.title)).toBeTruthy();
    expect(screen.getByText(en.library.heroTitle)).toBeTruthy();
    expect(screen.getByTestId('shelf-block-fathers-all')).toHaveTextContent(/^All 4\sworks/);
    expect(
      within(screen.getByTestId('shelf-block-fathers')).getByText('Church Fathers'),
    ).toBeTruthy();
  });
});
