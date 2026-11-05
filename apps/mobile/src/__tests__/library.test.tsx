import type { Pack } from '@biblioteca/shared';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { loadBundledRepository } from '@/content/repository';
import type { LoadedRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import { LibraryAllScreen } from '@/features/library/library-all-screen';
import { en } from '@/i18n/en';
import { workHref } from '@/navigation-hrefs';
import { resetMockRouter, router } from '@/test-support/expo-router-mock';
import {
  barePack,
  bundledPack,
  createTestSigner,
  signPack,
  translationOf,
} from '@/test-support/packs';
import { styleWhilePressed } from '@/test-support/press';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';
import { vosEditions } from '@/test-support/vos';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

const signer = createTestSigner();
const englishPack = bundledPack('vos-1903-kingdom-en');
const english = englishPack.pack as Pack;
const trusted = [...trustedKeys, signer.key];

/** The rows of the list, in the order they are drawn. */
const rows = () => screen.getAllByTestId(/^library-row-/);

beforeEach(() => {
  resetMockRouter();
});

describe('LibraryRow: pressed look (docs/ui-spec-v2.md, 2.6 and 3)', () => {
  it('dims the row to opacity 0.7 on native', async () => {
    await renderWithProviders(<LibraryAllScreen />);
    await screen.findAllByTestId(/^library-row-/);
    expect(await styleWhilePressed(/^Deschide lucrarea/)).toMatchObject({ opacity: 0.7 });
  });

  it('shrinks the row to scale(.96) on web, with no opacity change', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<LibraryAllScreen />);
      await screen.findAllByTestId(/^library-row-/);
      const style = await styleWhilePressed(/^Deschide lucrarea/);
      expect(style.transform).toEqual([{ scale: 0.96 }]);
      expect(style.opacity).toBeUndefined();
    } finally {
      replaced.restore();
    }
  });
});

describe('LibraryAllScreen', () => {
  it('lists the verified works with author and language', async () => {
    const { repository } = await loadBundledRepository();
    const { work } = await vosEditions(repository);
    await renderWithProviders(<LibraryAllScreen />);

    expect(await screen.findByText(work.titleRo)).toBeTruthy();
    expect(
      screen.getByLabelText(new RegExp(`^Deschide lucrarea .*${work.authorName}`)),
    ).toBeTruthy();
  });

  it('hides a pack that fails verification and tells the user', async () => {
    const { repository } = await loadBundledRepository();
    const { work } = await vosEditions(repository);

    // verifyPack is mocked to reject everything (as a bad signature would).
    const verify = jest.fn(async () => ({ ok: false as const, reason: 'bad-signature' as const }));
    const loaded = await loadBundledRepository({ packs: [englishPack], verify });
    expect(verify).toHaveBeenCalled();

    await renderWithProviders(<LibraryAllScreen />, { loaded });
    expect(await screen.findByText('Nu există lucrări instalate.')).toBeTruthy();
    expect(screen.queryByText(work.titleRo)).toBeNull();
    expect(
      screen.getByText('Un pachet de conținut nu a putut fi verificat și nu este afișat.'),
    ).toBeTruthy();
    // Nothing to filter: the panel and the tabs are not drawn around an empty library.
    expect(screen.queryByTestId('filter-panel')).toBeNull();
    expect(screen.queryByTestId('view-tabs')).toBeNull();
  });

  it('counts the packs that were rejected, not the works', async () => {
    const verify = jest.fn(async () => ({ ok: false as const, reason: 'bad-signature' as const }));
    const loaded = await loadBundledRepository({ verify });
    await renderWithProviders(<LibraryAllScreen />, { loaded });
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
    await renderWithProviders(<LibraryAllScreen />, { loaded });
    expect(await screen.findByText(english.work.titleRo)).toBeTruthy();
    expect(
      screen.getByText('Un pachet de conținut nu a putut fi verificat și nu este afișat.'),
    ).toBeTruthy();
  });

  it('shows the alert as an alert, for screen readers', async () => {
    const loaded = await loadBundledRepository({ packs: [englishPack, englishPack] });
    await renderWithProviders(<LibraryAllScreen />, { loaded });
    const notice = await screen.findByTestId('library-unverified');
    expect(notice.props.accessibilityRole).toBe('alert');
  });
});

describe('LibraryAllScreen with several editions', () => {
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
    await renderWithProviders(<LibraryAllScreen />, { loaded });
    expect(await screen.findByText(english.work.titleRo)).toBeTruthy();
    expect(rows()).toHaveLength(1);
  });

  it('shows the editions as badges: the language code, and for screen readers what the edition is', async () => {
    const { loaded } = await twoEditions();
    await renderWithProviders(<LibraryAllScreen />, { loaded });
    const row = (await screen.findAllByTestId(/^library-row-/))[0]!;
    expect(within(row).getByText('RO')).toBeTruthy();
    expect(within(row).getByText('EN')).toBeTruthy();
    expect(within(row).getByLabelText('Română · traducere')).toBeTruthy();
    expect(within(row).getByLabelText('English · original')).toBeTruthy();
  });

  it('opens the work page without choosing an edition: the page picks the primary one', async () => {
    const { loaded } = await twoEditions();
    await renderWithProviders(<LibraryAllScreen />, { loaded });
    await fireEvent.press((await screen.findAllByTestId(/^library-row-/))[0]!);
    expect(router.push).toHaveBeenCalledWith(workHref(english.work.id));
    expect(workHref(english.work.id).params).toEqual({ id: english.work.id });
  });

  it('tells a partial translation on the row, and only when it covers fewer sections', async () => {
    const partial = await twoEditions(3);
    const first = await renderWithProviders(<LibraryAllScreen />, { loaded: partial.loaded });
    const chip = await screen.findByText('Parțial');
    expect(chip.parent!.props.accessibilityLabel).toBe('Traducere parțială');
    await first.unmount();

    const whole = await twoEditions(11);
    await renderWithProviders(<LibraryAllScreen />, { loaded: whole.loaded });
    await screen.findByText('RO');
    expect(screen.queryByText('Parțial')).toBeNull();
  });

  it('has no licence text in a row, in either reading language (the licence lives on the work page)', async () => {
    // docs/ui-spec-v2.md section 6 and check B6: the list shows no licence chip (task "Finisare
    // UI"); the "Sub licență" and "Domeniu public" tags of the first design are gone.
    const { loaded } = await twoEditions();
    const first = await renderWithProviders(<LibraryAllScreen />, { loaded });
    await screen.findByText('RO');
    expect(screen.queryByText('Sub licență')).toBeNull();
    expect(screen.queryByText('Domeniu public')).toBeNull();
    expect(screen.queryByText(/licen/i)).toBeNull();
    expect(rows()[0]!.props.accessibilityLabel).not.toMatch(/licen/i);
    await first.unmount();

    await renderWithProviders(<LibraryAllScreen />, {
      loaded,
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    await screen.findByText('RO');
    expect(screen.queryByText('Sub licență')).toBeNull();
    expect(screen.queryByText('Domeniu public')).toBeNull();
    expect(screen.queryByText(/licen/i)).toBeNull();
  });

  it('titles the row in the reading language, with the original title under it', async () => {
    const { loaded } = await twoEditions();
    const first = await renderWithProviders(<LibraryAllScreen />, { loaded });
    expect(await screen.findByText(english.work.titleRo)).toBeTruthy();
    expect(screen.getByText(english.work.titleOrig)).toBeTruthy();
    await first.unmount();

    // The original is English: for an English reader the title is the original, shown once.
    await renderWithProviders(<LibraryAllScreen />, {
      loaded,
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    expect(await screen.findAllByText(english.work.titleOrig)).toHaveLength(1);
    expect(screen.queryByText(english.work.titleRo)).toBeNull();
  });

  it('gives screen readers the title, the author line and the editions in the label of the row', async () => {
    const { loaded } = await twoEditions(3);
    await renderWithProviders(<LibraryAllScreen />, { loaded });
    const [row] = await screen.findAllByTestId(/^library-row-/);
    expect(row!.props.accessibilityLabel).toBe(
      `Deschide lucrarea ${english.work.titleRo}. Geerhardus Vos · 1903 · Engleză. ` +
        'Ediții: Română · traducere, traducere parțială; English · original',
    );
  });

  it('is written in English with an English interface', async () => {
    const { loaded } = await twoEditions(3);
    const store = createSettingsStore({ uiLanguage: 'en', readingLanguage: 'en' });
    await renderWithProviders(<LibraryAllScreen />, { loaded, store });
    expect(await screen.findByText(en.library.allTitle)).toBeTruthy();
    expect(screen.getByLabelText('Română · translation')).toBeTruthy();
    expect(screen.getByLabelText('English · original')).toBeTruthy();
    expect(screen.getByText('Partial')).toBeTruthy();
    expect(screen.queryByText('Public domain')).toBeNull(); // no licence tag in the list
    expect(screen.getByText(/Geerhardus Vos · 1903 · English/)).toBeTruthy();
    const row = rows()[0]!;
    expect(row.props.accessibilityLabel).toContain('Open the work');
    expect(row.props.accessibilityLabel).toContain('Editions: ');
  });

  it('tells an empty library in English too', async () => {
    const verify = jest.fn(async () => ({ ok: false as const, reason: 'bad-signature' as const }));
    const loaded = await loadBundledRepository({ packs: [englishPack], verify });
    await renderWithProviders(<LibraryAllScreen />, {
      loaded,
      store: createSettingsStore({ uiLanguage: 'en' }),
    });
    expect(await screen.findByText('No works installed.')).toBeTruthy();
    expect(
      screen.getByText('One content pack could not be verified and is not shown.'),
    ).toBeTruthy();
  });
});

describe('LibraryAllScreen with a work whose original is not English', () => {
  // A Latin work read in Romanian and in English, whatever the original language.
  async function latinWork(): Promise<LoadedRepository> {
    // Without the English title the real pack now carries: only the English translation has one.
    const latin = barePack(english);
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
    await renderWithProviders(<LibraryAllScreen />, { loaded });
    const row = (await screen.findAllByTestId(/^library-row-/))[0]!;
    const codes = within(row)
      .getAllByText(/^(RO|EN|LA)$/)
      .map((node) => node.props.children as string);
    expect(codes).toEqual(['RO', 'LA', 'EN']);
    expect(within(row).getByLabelText('Latină · original')).toBeTruthy();
    expect(within(row).getByLabelText('English · traducere')).toBeTruthy();
    // The Romanian translation covers 2 of 11 sections, the English one all of them.
    expect(within(row).getAllByText('Parțial')).toHaveLength(1);
  });

  it('titles the row for an English reader with the English title, and keeps the Latin one under it', async () => {
    const loaded = await latinWork();
    await renderWithProviders(<LibraryAllScreen />, {
      loaded,
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    expect(await screen.findByText('On the Spirit and the Letter')).toBeTruthy();
    expect(screen.getByText('De spiritu et littera')).toBeTruthy();
    expect(screen.queryByText('Despre spirit și literă')).toBeNull();
  });

  it('titles the row for a Romanian reader with the Romanian title', async () => {
    const loaded = await latinWork();
    await renderWithProviders(<LibraryAllScreen />, { loaded });
    expect(await screen.findByText('Despre spirit și literă')).toBeTruthy();
    expect(screen.getByText('De spiritu et littera')).toBeTruthy();
    expect(screen.queryByText('On the Spirit and the Letter')).toBeNull();
  });
});
