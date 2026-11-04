import type { Pack } from '@biblioteca/shared';
import { fireEvent, screen } from '@testing-library/react-native';

import { loadBundledRepository } from '@/content/repository';
import type { LoadedRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import { LibraryScreen } from '@/features/library/library-screen';
import { workHref } from '@/navigation-hrefs';
import { router } from '@/test-support/expo-router-mock';
import {
  bundledPack,
  clone,
  createTestSigner,
  signPack,
  translationOf,
} from '@/test-support/packs';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';
import { vosEditions } from '@/test-support/vos';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

const signer = createTestSigner();
const englishPack = bundledPack('vos-1903-kingdom-en');
const english = englishPack.pack as Pack;
const trusted = [...trustedKeys, signer.key];

beforeEach(() => {
  router.push.mockClear();
});

describe('LibraryScreen', () => {
  it('lists the verified works with author and language', async () => {
    const { repository } = await loadBundledRepository();
    const { work } = await vosEditions(repository);
    await renderWithProviders(<LibraryScreen />);

    expect(await screen.findByText(work.titleRo)).toBeTruthy();
    expect(screen.getByLabelText(new RegExp(work.authorName))).toBeTruthy();
  });

  it('hides a pack that fails verification and tells the user', async () => {
    const { repository } = await loadBundledRepository();
    const { work } = await vosEditions(repository);

    // verifyPack is mocked to reject everything (as a bad signature would).
    const verify = jest.fn(async () => ({ ok: false as const, reason: 'bad-signature' as const }));
    const loaded = await loadBundledRepository({ packs: [englishPack], verify });
    expect(verify).toHaveBeenCalled();

    await renderWithProviders(<LibraryScreen />, { loaded });
    expect(await screen.findByText('Nu există lucrări instalate.')).toBeTruthy();
    expect(screen.queryByText(work.titleRo)).toBeNull();
    expect(
      screen.getByText('Un pachet de conținut nu a putut fi verificat și nu este afișat.'),
    ).toBeTruthy();
  });

  it('counts the packs that were rejected, not the works', async () => {
    const verify = jest.fn(async () => ({ ok: false as const, reason: 'bad-signature' as const }));
    const loaded = await loadBundledRepository({ verify });
    await renderWithProviders(<LibraryScreen />, { loaded });
    expect(
      await screen.findByText(
        '2 pachete de conținut nu au putut fi verificate și nu sunt afișate.',
      ),
    ).toBeTruthy();
  });

  it('reports a pack that clashes with another one, like a pack that fails verification', async () => {
    const loaded = await loadBundledRepository({ packs: [englishPack, englishPack] });
    expect(loaded.rejected).toEqual([
      { packId: 'vos-1903-kingdom-en', reason: 'duplicate-edition' },
    ]);
    await renderWithProviders(<LibraryScreen />, { loaded });
    expect(await screen.findByText(english.work.titleRo)).toBeTruthy();
    expect(
      screen.getByText('Un pachet de conținut nu a putut fi verificat și nu este afișat.'),
    ).toBeTruthy();
  });
});

describe('LibraryScreen with several editions', () => {
  const twoEditions = async (sections = 3) => {
    const translation = translationOf(english, { sections });
    const loaded = await loadBundledRepository({
      packs: [englishPack, signPack(translation, signer, { packId: 'vos-synthetic-ro' })],
      trustedKeys: trusted,
    });
    return { loaded, translation };
  };

  it('has one row per work, however many editions it has', async () => {
    const { loaded } = await twoEditions();
    await renderWithProviders(<LibraryScreen />, { loaded });
    expect(await screen.findByText(english.work.titleRo)).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('shows the editions as short labels: the language and what the edition is', async () => {
    const { loaded } = await twoEditions();
    await renderWithProviders(<LibraryScreen />, { loaded });
    expect(await screen.findByText('Română · traducere')).toBeTruthy();
    expect(screen.getByText('English · original')).toBeTruthy();
  });

  it('opens the work page without choosing an edition: the page picks the primary one', async () => {
    const { loaded } = await twoEditions();
    await renderWithProviders(<LibraryScreen />, { loaded });
    await fireEvent.press(await screen.findByRole('link'));
    expect(router.push).toHaveBeenCalledWith(workHref(english.work.id));
    expect(workHref(english.work.id).params).toEqual({ id: english.work.id });
  });

  it('tells a partial translation on the row, and only when it covers fewer sections', async () => {
    const partial = await twoEditions(3);
    const first = await renderWithProviders(<LibraryScreen />, { loaded: partial.loaded });
    expect(await screen.findByText('Traducere parțială')).toBeTruthy();
    await first.unmount();

    const whole = await twoEditions(11);
    await renderWithProviders(<LibraryScreen />, { loaded: whole.loaded });
    await screen.findByText('Română · traducere');
    expect(screen.queryByText('Traducere parțială')).toBeNull();
  });

  it('tags the row with the licence of the edition that opens first', async () => {
    const { loaded } = await twoEditions();
    const first = await renderWithProviders(<LibraryScreen />, { loaded });
    // Romanian reading: the translation opens first, under its own licence.
    expect(await screen.findByText('Sub licență')).toBeTruthy();
    expect(screen.queryByText('Domeniu public')).toBeNull();
    await first.unmount();

    // English reading: the source text, in the public domain.
    await renderWithProviders(<LibraryScreen />, {
      loaded,
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    expect(await screen.findByText('Domeniu public')).toBeTruthy();
    expect(screen.queryByText('Sub licență')).toBeNull();
  });

  it('titles the row in the reading language, with the original title under it', async () => {
    const { loaded } = await twoEditions();
    const first = await renderWithProviders(<LibraryScreen />, { loaded });
    expect(await screen.findByText(english.work.titleRo)).toBeTruthy();
    expect(screen.getByText(english.work.titleOrig)).toBeTruthy();
    await first.unmount();

    // The original is English: for an English reader the title is the original, shown once.
    await renderWithProviders(<LibraryScreen />, {
      loaded,
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    expect(await screen.findAllByText(english.work.titleOrig)).toHaveLength(1);
    expect(screen.queryByText(english.work.titleRo)).toBeNull();
  });

  it('gives screen readers the title, the author line and the editions in the label of the row', async () => {
    const { loaded } = await twoEditions(3);
    await renderWithProviders(<LibraryScreen />, { loaded });
    const row = await screen.findByRole('link');
    expect(row.props.accessibilityLabel).toBe(
      `Deschide lucrarea ${english.work.titleRo}. Geerhardus Vos · 1903 · Engleză. ` +
        'Ediții: Română · traducere, traducere parțială; English · original',
    );
  });

  it('is written in English with an English interface', async () => {
    const { loaded } = await twoEditions(3);
    const store = createSettingsStore({ uiLanguage: 'en', readingLanguage: 'en' });
    await renderWithProviders(<LibraryScreen />, { loaded, store });
    expect(await screen.findByText('Old books, carefully translated.')).toBeTruthy();
    expect(screen.getByText('Română · translation')).toBeTruthy();
    expect(screen.getByText('English · original')).toBeTruthy();
    expect(screen.getByText('Partial translation')).toBeTruthy();
    expect(screen.getByText('Public domain')).toBeTruthy();
    expect(screen.getByText(/Geerhardus Vos · 1903 · English/)).toBeTruthy();
    const row = screen.getByRole('link');
    expect(row.props.accessibilityLabel).toContain('Open the work');
    expect(row.props.accessibilityLabel).toContain('Editions: ');
  });

  it('tells an empty library in English too', async () => {
    const verify = jest.fn(async () => ({ ok: false as const, reason: 'bad-signature' as const }));
    const loaded = await loadBundledRepository({ packs: [englishPack], verify });
    await renderWithProviders(<LibraryScreen />, {
      loaded,
      store: createSettingsStore({ uiLanguage: 'en' }),
    });
    expect(await screen.findByText('No works installed.')).toBeTruthy();
    expect(
      screen.getByText('One content pack could not be verified and is not shown.'),
    ).toBeTruthy();
  });
});

describe('LibraryScreen with a work whose original is not English', () => {
  // A Latin work read in Romanian and in English, whatever the original language.
  async function latinWork(): Promise<LoadedRepository> {
    const latin = clone(english);
    latin.work = {
      ...latin.work,
      id: 'latin-work',
      slug: 'de-spiritu',
      titleRo: 'Despre spirit și literă',
      titleOrig: 'De spiritu et littera',
      languageOrig: 'la',
    };
    latin.edition = { ...latin.edition, id: 'latin-edition', language: 'la' };
    latin.sections = latin.sections.map((section) => ({ ...section, id: `la-${section.id}` }));
    latin.paragraphs = latin.paragraphs.map((paragraph) => ({
      ...paragraph,
      id: `la-${paragraph.id}`,
      sectionId: `la-${paragraph.sectionId}`,
    }));
    const ro = translationOf(latin, { language: 'ro', sections: 2 });
    const en = translationOf(latin, {
      language: 'en',
      sections: 11,
      titleEn: 'On the Spirit and the Letter',
    });
    return loadBundledRepository({
      packs: [
        signPack(latin, signer, { packId: 'latin-la' }),
        signPack(en, signer, { packId: 'latin-en' }),
        signPack(ro, signer, { packId: 'latin-ro' }),
      ],
      trustedKeys: trusted,
    });
  }

  it('lists the translations into Romanian first, then the original, then the others', async () => {
    const loaded = await latinWork();
    expect(loaded.rejected).toEqual([]);
    await renderWithProviders(<LibraryScreen />, { loaded });
    await screen.findByText('Română · traducere');
    const labels = screen
      .getAllByText(/ · (traducere|original)$/)
      .map((node) => node.props.children as string);
    expect(labels).toEqual(['Română · traducere', 'Latină · original', 'English · traducere']);
    // The Romanian translation covers 2 of 11 sections, the English one all of them.
    expect(screen.getAllByText('Traducere parțială')).toHaveLength(1);
  });

  it('titles the row for an English reader with the English title, and keeps the Latin one under it', async () => {
    const loaded = await latinWork();
    await renderWithProviders(<LibraryScreen />, {
      loaded,
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    expect(await screen.findByText('On the Spirit and the Letter')).toBeTruthy();
    expect(screen.getByText('De spiritu et littera')).toBeTruthy();
    expect(screen.queryByText('Despre spirit și literă')).toBeNull();
  });

  it('titles the row for a Romanian reader with the Romanian title', async () => {
    const loaded = await latinWork();
    await renderWithProviders(<LibraryScreen />, { loaded });
    expect(await screen.findByText('Despre spirit și literă')).toBeTruthy();
    expect(screen.getByText('De spiritu et littera')).toBeTruthy();
    expect(screen.queryByText('On the Spirit and the Letter')).toBeNull();
  });
});
