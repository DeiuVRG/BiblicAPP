import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { BETA_1_FEATURES, FEATURES, FeaturesProvider } from '@/config/features';
import type { Features } from '@/config/features';
import { loadBundledRepository } from '@/content/repository';
import { LandingScreen, collectionColumns, shelfColumns } from '@/features/landing/landing-screen';
import { en } from '@/i18n/en';
import { ro as t } from '@/i18n/ro';
import { libraryAllWith, workHref } from '@/navigation-hrefs';
import { resetMockRouter, router } from '@/test-support/expo-router-mock';
import { syntheticLibrary } from '@/test-support/library-fixtures';
import { bundledPack } from '@/test-support/packs';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';

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

/** The landing with these flags over the default ones, over the F-2 library unless told otherwise. */
async function resizeTo(width: number) {
  await act(async () => {
    Dimensions.set({ window: { ...original, width } });
  });
}

async function renderLanding(
  features: Partial<Features> = {},
  options: Parameters<typeof renderWithProviders>[1] = {},
) {
  const loaded = options.loaded ?? (await syntheticLibrary().load());
  return renderWithProviders(
    <FeaturesProvider value={{ ...FEATURES, ...features }}>
      <LandingScreen />
    </FeaturesProvider>,
    { ...options, loaded },
  );
}

/** A count line with its no-break spaces as plain ones. */
const plain = (text: unknown) => String(text).replace(/ /g, ' ');

describe('LandingScreen: the hero and the doors', () => {
  it('leads with the title in two lines, the Beta badge and the way into the library', async () => {
    await renderLanding();
    expect(screen.getByText('Tradiția creștină,')).toBeTruthy();
    expect(screen.getByText('în limba ta.')).toBeTruthy();
    const hero = within(screen.getByTestId('hero'));
    expect(hero.getByText(t.landing.kicker)).toBeTruthy();
    expect(hero.getByText(t.landing.badge)).toBeTruthy();
    expect(hero.getByText(t.landing.sub)).toBeTruthy();
    const start = screen.getByTestId('hero-cta-primary');
    expect(start.props.accessibilityRole).toBe('link');
    expect(start).toHaveTextContent(t.landing.start);
    await fireEvent.press(start);
    expect(router.push).toHaveBeenCalledWith('/library');
  });

  it('has no "Întreabă" anywhere while the chat is not live (nothing dead)', async () => {
    await renderLanding({ ask: false });
    expect(screen.queryByTestId('hero-cta-secondary')).toBeNull();
    expect(screen.queryByTestId('door-ask')).toBeNull();
    expect(screen.queryByTestId('ask-button')).toBeNull();
    expect(screen.queryByText(t.landing.freeAsk)).toBeNull();
    expect(screen.getByText(t.landing.freeBooks)).toBeTruthy();
  });

  it('adds the second call to action, the second door and the sentence about it when the chat is live', async () => {
    await renderLanding({ ask: true });
    const secondary = screen.getByTestId('hero-cta-secondary');
    expect(secondary).toHaveTextContent(t.landing.askCta);
    await fireEvent.press(secondary);
    expect(router.push).toHaveBeenCalledWith('/ask');
    expect(screen.getByTestId('door-ask')).toBeTruthy();
    expect(screen.getByTestId('free-statement')).toHaveTextContent(
      `${t.landing.freeBooks} ${t.landing.freeAsk}`,
    );
  });

  it('shows the "about" and "tour" links of the hero only when those screens are live', async () => {
    const first = await renderLanding();
    expect(screen.queryByTestId('hero-link-about')).toBeNull();
    expect(screen.queryByTestId('hero-link-tour')).toBeNull();
    await first.unmount();

    await renderLanding({ about: true, tour: true });
    await fireEvent.press(screen.getByTestId('hero-link-about'));
    expect(router.push).toHaveBeenCalledWith('/about');
    await fireEvent.press(screen.getByTestId('hero-link-tour'));
    expect(router.push).toHaveBeenCalledWith('/about/tour');
  });

  it('offers the door to reading, named with its sentence, as one link', async () => {
    await renderLanding();
    const door = screen.getByTestId('door-read');
    expect(door.props.accessibilityRole).toBe('link');
    expect(door.props.accessibilityLabel).toBe(
      `${t.landing.doorRead.title}. ${t.landing.doorRead.text}`,
    );
    await fireEvent.press(door);
    expect(router.push).toHaveBeenCalledWith('/library');
  });
});

describe('LandingScreen: the collection and the shelves', () => {
  it('shows the works as cards, at most twelve, each a link to the work', async () => {
    const library = syntheticLibrary();
    await renderLanding({}, { loaded: await library.load() });
    const grid = await screen.findByTestId('collection-grid');
    const cards = within(grid).getAllByTestId(/^work-card-/);
    // F-2 has sixteen works.
    expect(cards).toHaveLength(12);
    expect(cards[0]!.props.accessibilityRole).toBe('link');
    await fireEvent.press(cards[0]!);
    expect(router.push).toHaveBeenCalledWith(
      workHref(library.workIds[cards[0]!.props.testID.replace('work-card-', '')]!),
    );
  });

  it('names a work, who wrote it and its editions for a screen reader', async () => {
    await renderLanding();
    const card = await screen.findByTestId('work-card-despre-spirit-si-litera');
    expect(card.props.accessibilityLabel).toBe(
      'Deschide lucrarea Despre spirit și literă. Augustin · 412 · Latină. ' +
        'Ediții: Română · traducere; Latină · original; English · traducere',
    );
  });

  it('shows the badges of the editions on a card, and the description of the work on a wide screen', async () => {
    await resizeTo(1280);
    await renderLanding();
    const card = within(await screen.findByTestId('work-card-despre-spirit-si-litera'));
    expect(card.getByText('RO')).toBeTruthy();
    expect(card.getByText('LA')).toBeTruthy();
    expect(card.getByText('EN')).toBeTruthy();
    expect(card.getByText('Despre Despre spirit și literă.')).toBeTruthy();
    // "CITEȘTE ›" is decoration: the whole card is the link and has its name.
    expect(card.getByText(t.landing.read, { includeHiddenElements: true })).toBeTruthy();
  });

  it('keeps a card to a title, a group and the editions on a phone', async () => {
    await resizeTo(390);
    await renderLanding();
    const card = within(await screen.findByTestId('work-card-despre-spirit-si-litera'));
    expect(card.getByText('Despre spirit și literă')).toBeTruthy();
    expect(card.queryByText(t.landing.read, { includeHiddenElements: true })).toBeNull();
    expect(card.queryByText('Despre Despre spirit și literă.')).toBeNull();
    expect(card.queryByText(/412/)).toBeNull();
  });

  it('links to the whole library under the cards', async () => {
    await renderLanding();
    await screen.findByTestId('collection-grid');
    await fireEvent.press(screen.getByTestId('collection-all'));
    expect(router.push).toHaveBeenCalledWith('/library/all');
  });

  it('shows a card for each shelf that has works, with the count and the who-line', async () => {
    await renderLanding();
    const grid = await screen.findByTestId('shelves-grid');
    const cards = within(grid).getAllByTestId(/^shelf-card-/);
    expect(cards).toHaveLength(6);
    const fathers = within(grid).getByTestId('shelf-card-fathers');
    expect(plain(fathers.props.accessibilityLabel)).toMatch(/^Părinții Bisericii\. 4 lucrări\. /);
    await fireEvent.press(fathers);
    expect(router.push).toHaveBeenCalledWith(libraryAllWith({ shelf: 'fathers' }));
    await fireEvent.press(screen.getByTestId('shelves-all'));
    expect(router.push).toHaveBeenCalledWith('/library/all');
  });

  it('draws neither the collection nor the shelves around an empty library', async () => {
    const verify = jest.fn(async () => ({ ok: false as const, reason: 'bad-signature' as const }));
    const loaded = await loadBundledRepository({
      packs: [bundledPack('vos-1903-kingdom-en')],
      verify,
    });
    await renderLanding({}, { loaded });
    // The hero and the doors do not wait for the library.
    expect(screen.getByTestId('door-read')).toBeTruthy();
    await screen.findByTestId('beta-band');
    expect(screen.queryByTestId('collection')).toBeNull();
    expect(screen.queryByTestId('shelves')).toBeNull();
  });

  it('shows the work of the committed packs as a card, with no shelf of its own invented', async () => {
    const loaded = await loadBundledRepository();
    await renderLanding({}, { loaded });
    expect(await screen.findAllByTestId(/^work-card-/)).toHaveLength(1);
    // A work with no entry in the catalogue sits on "Altele" (the shelf of the rest).
    expect(screen.getAllByTestId(/^shelf-card-/).length).toBeGreaterThanOrEqual(1);
  });

  it('chooses the number of columns from the width', () => {
    expect(collectionColumns(1280)).toBe(4);
    expect(collectionColumns(1099)).toBe(2);
    expect(collectionColumns(600)).toBe(2);
    expect(collectionColumns(599)).toBe(1);
    expect(shelfColumns(1280)).toBe(5);
    expect(shelfColumns(1000)).toBe(4);
    expect(shelfColumns(800)).toBe(3);
    expect(shelfColumns(600)).toBe(2);
    expect(shelfColumns(390)).toBe(1);
  });
});

describe('LandingScreen: the beta band, transparency and the footer', () => {
  it('invites feedback with a mail link', async () => {
    await renderLanding();
    const band = within(screen.getByTestId('beta-band'));
    expect(band.getByText(t.landing.betaKicker)).toBeTruthy();
    expect(band.getByText(t.landing.betaText)).toBeTruthy();
    const feedback = screen.getByTestId('beta-feedback');
    expect(feedback.props.accessibilityRole).toBe('link');
    await fireEvent.press(feedback);
    const href = router.push.mock.calls.at(-1)![0] as string;
    expect(href.startsWith('mailto:')).toBe(true);
    expect(decodeURIComponent(href)).toContain(`subject=${t.landing.feedbackSubject}`);
  });

  it('shows the transparency band only when its screen is live', async () => {
    const first = await renderLanding({ transparency: false });
    expect(screen.queryByTestId('transparency-band')).toBeNull();
    await first.unmount();

    await renderLanding({ transparency: true });
    await fireEvent.press(screen.getByTestId('transparency-cta'));
    expect(router.push).toHaveBeenCalledWith('/about/transparency');
  });

  it('ends with the footer: the links that exist, the language and the version', async () => {
    await renderLanding();
    const footer = within(screen.getByTestId('footer'));
    expect(footer.getByTestId('footer-link-contact')).toBeTruthy();
    expect(footer.getByTestId('footer-link-settings')).toBeTruthy();
    expect(footer.queryByTestId('footer-link-about')).toBeNull();
    expect(footer.queryByTestId('footer-link-transparency')).toBeNull();
    expect(footer.getByTestId('footer-language-switch')).toBeTruthy();
    expect(footer.getByTestId('footer-version')).toHaveTextContent(/^Versiunea \d/);
    await fireEvent.press(footer.getByTestId('footer-link-settings'));
    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  it('adds "Despre" and "Transparență" to the footer with their screens', async () => {
    await renderLanding(BETA_1_FEATURES);
    const footer = within(screen.getByTestId('footer'));
    await fireEvent.press(footer.getByTestId('footer-link-about'));
    expect(router.push).toHaveBeenCalledWith('/about');
    await fireEvent.press(footer.getByTestId('footer-link-transparency'));
    expect(router.push).toHaveBeenCalledWith('/about/transparency');
  });

  it('is written in English with an English interface and the titles in the reading language', async () => {
    await renderLanding(
      {},
      {
        store: createSettingsStore({ uiLanguage: 'en', readingLanguage: 'en' }),
        loaded: await syntheticLibrary().load(),
      },
    );
    expect(await within(screen.getByTestId('hero')).findByText(en.landing.kicker)).toBeTruthy();
    expect(screen.getByText(en.landing.titleFirst)).toBeTruthy();
    expect(screen.getByTestId('hero-cta-primary')).toHaveTextContent(en.landing.start);
    const card = await screen.findByTestId('work-card-despre-spirit-si-litera');
    expect(card.props.accessibilityLabel).toMatch(/^Open the work On the Spirit and the Letter\./);
  });
});
