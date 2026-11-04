import { fireEvent, screen } from '@testing-library/react-native';

import { SearchScreen } from '@/features/search/search-screen';
import { readHref } from '@/navigation-hrefs';
import { router } from '@/test-support/expo-router-mock';
import { renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

describe('SearchScreen', () => {
  it('finds text ignoring case and diacritics and opens the paragraph', async () => {
    const { loaded } = await renderWithProviders(<SearchScreen />);
    const { repository } = loaded;
    const [work] = await repository.listWorks();
    const [section] = await repository.getSections(work!.workId);
    const [paragraph] = await repository.getParagraphs(section!.id);
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
