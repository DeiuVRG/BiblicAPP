import type { Pack } from '@biblioteca/shared';
import { fireEvent, screen } from '@testing-library/react-native';

import { loadBundledRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import { SearchScreen } from '@/features/search/search-screen';
import { readHref } from '@/navigation-hrefs';
import { router } from '@/test-support/expo-router-mock';
import { bundledPack, createTestSigner, signPack, translationOf } from '@/test-support/packs';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';
import { vosEditions } from '@/test-support/vos';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

const signer = createTestSigner();
const englishPack = bundledPack('vos-1903-kingdom-en');
const english = englishPack.pack as Pack;

async function twoEditions() {
  const romanian = translationOf(english, { sections: 3 });
  const loaded = await loadBundledRepository({
    packs: [englishPack, signPack(romanian, signer, { packId: 'vos-synthetic-ro' })],
    trustedKeys: [...trustedKeys, signer.key],
  });
  return { loaded, romanian };
}

beforeEach(() => {
  router.push.mockClear();
});

describe('SearchScreen', () => {
  it('finds text ignoring case and diacritics and opens the paragraph', async () => {
    const { loaded } = await renderWithProviders(<SearchScreen />);
    const { repository } = loaded;
    const { englishSections } = await vosEditions(repository);
    const [paragraph] = await repository.getParagraphs(englishSections[0]!.id);
    // First word of 5+ letters in the first paragraph, upper-cased and stripped of diacritics.
    const word = paragraph!.text.match(/\p{L}{5,}/u)![0];
    const typed = word
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase();

    await fireEvent.changeText(screen.getByLabelText('Caută în text'), typed);
    const rows = await screen.findAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);

    const hits = await repository.search(typed);
    await fireEvent.press(rows[0]!);
    expect(router.push).toHaveBeenCalledWith(
      readHref(hits[0]!.workId, hits[0]!.sectionId, { p: hits[0]!.paragraphId, q: typed }),
    );
  });

  it('asks for at least two characters', async () => {
    await renderWithProviders(<SearchScreen />);
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'a');
    expect(screen.getByText(/cel puțin 2 caractere/)).toBeTruthy();
  });
});

describe('SearchScreen with several editions', () => {
  it('names the language of the edition next to the heading of the section', async () => {
    const { loaded, romanian } = await twoEditions();
    await renderWithProviders(<SearchScreen initialQuery="kingdom" />, { loaded });
    const rows = await screen.findAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);
    // English text, so the English edition: the label sits beside the chapter, not inside it.
    expect(screen.getAllByText('English').length).toBe(rows.length);
    expect(screen.queryByText('Română')).toBeNull();
    expect((await screen.findAllByText(/^I\. Introductory/)).length).toBeGreaterThan(0);

    await fireEvent.changeText(screen.getByLabelText('Caută în text'), 'Dumnezeu este aproape');
    const synthetic = await screen.findAllByText(romanian.sections[0]!.heading);
    expect(synthetic.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Română').length).toBe(romanian.paragraphs.length);
  });

  it('opens the edition the hit is in: the section identifies it', async () => {
    const { loaded, romanian } = await twoEditions();
    const { repository } = loaded;
    await renderWithProviders(<SearchScreen initialQuery="Dumnezeu este aproape" />, { loaded });
    const rows = await screen.findAllByRole('link');
    expect(rows).toHaveLength(romanian.paragraphs.length);
    await fireEvent.press(rows[0]!);

    const hits = await repository.search('Dumnezeu este aproape');
    expect(hits[0]).toMatchObject({ editionId: romanian.edition.id, language: 'ro' });
    expect(router.push).toHaveBeenCalledWith(
      readHref(english.work.id, hits[0]!.sectionId, {
        p: hits[0]!.paragraphId,
        q: 'Dumnezeu este aproape',
      }),
    );
    expect(romanian.sections.map((section) => section.id)).toContain(hits[0]!.sectionId);
    expect((await repository.locateSection(hits[0]!.sectionId))?.editionId).toBe(
      romanian.edition.id,
    );
  });

  it('opens a hit in the English edition on its section, too', async () => {
    const { loaded } = await twoEditions();
    const { repository } = loaded;
    await renderWithProviders(<SearchScreen initialQuery="kingdom" />, { loaded });
    const rows = await screen.findAllByRole('link');
    await fireEvent.press(rows[0]!);
    const hits = await repository.search('kingdom');
    const pressed = router.push.mock.calls[0]![0] as { params: { section: string } };
    expect(pressed.params.section).toBe(hits[0]!.sectionId);
    expect((await repository.locateSection(pressed.params.section))?.editionId).toBe(
      english.edition.id,
    );
  });

  it('gives screen readers the chapter, the language and the work, then the passage', async () => {
    const { loaded } = await twoEditions();
    await renderWithProviders(<SearchScreen initialQuery="kingdom" />, { loaded });
    const [row] = await screen.findAllByRole('link');
    const label = row!.props.accessibilityLabel as string;
    expect(label).toMatch(
      new RegExp(
        `^Deschide rezultatul din I\\. Introductory · English · ${english.work.titleRo}: `,
      ),
    );
  });

  it('names the work in the reading language in the label of a hit', async () => {
    const { loaded } = await twoEditions();
    await renderWithProviders(<SearchScreen initialQuery="kingdom" />, {
      loaded,
      store: createSettingsStore({ readingLanguage: 'en' }),
    });
    const [row] = await screen.findAllByRole('link');
    expect(row!.props.accessibilityLabel).toContain(`English · ${english.work.titleOrig}: `);
  });

  it('is written in English with an English interface', async () => {
    const { loaded } = await twoEditions();
    await renderWithProviders(<SearchScreen />, {
      loaded,
      store: createSettingsStore({ uiLanguage: 'en' }),
    });
    expect(await screen.findByLabelText('Search the text')).toBeTruthy();
    expect(screen.getByText(/at least 2 characters/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search the text'), 'kingdom of heaven');
    const rows = await screen.findAllByRole('link');
    expect(rows[0]!.props.accessibilityLabel).toMatch(/^Open the result in /);
    expect(screen.getByText(/^\d+ results?$|^First 50 results$/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search the text'), 'zzzzqq');
    expect(await screen.findByText('No results.')).toBeTruthy();
  });

  it('marks the language of a snippet on web', async () => {
    const { Platform } = jest.requireActual<typeof import('react-native')>('react-native');
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const { loaded } = await twoEditions();
      await renderWithProviders(<SearchScreen initialQuery="Dumnezeu este aproape" />, { loaded });
      const rows = await screen.findAllByRole('link');
      const snippet = rows[0]!.props.accessibilityLabel as string;
      expect(snippet).toContain('Română');
      const text = screen.getAllByText(/Text sintetic/)[0]!;
      expect(text.props.lang).toBe('ro');
    } finally {
      replaced.restore();
    }
  });
});
