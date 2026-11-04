import { screen } from '@testing-library/react-native';

import { loadBundledRepository } from '@/content/repository';
import { LibraryScreen } from '@/features/library/library-screen';
import { renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

describe('LibraryScreen', () => {
  it('lists the verified works with author and language', async () => {
    const { repository } = await loadBundledRepository();
    const [work] = await repository.listWorks();
    await renderWithProviders(<LibraryScreen />);

    expect(await screen.findByText(work!.titleRo)).toBeTruthy();
    expect(screen.getByLabelText(new RegExp(work!.authorName))).toBeTruthy();
  });

  it('hides a pack that fails verification and tells the user', async () => {
    const { repository } = await loadBundledRepository();
    const [work] = await repository.listWorks();

    // verifyPack is mocked to reject everything (as a bad signature would).
    const verify = jest.fn(async () => ({ ok: false as const, reason: 'bad-signature' as const }));
    const loaded = await loadBundledRepository({ verify });
    expect(verify).toHaveBeenCalled();

    await renderWithProviders(<LibraryScreen />, { loaded });
    expect(await screen.findByText('Nu există lucrări instalate.')).toBeTruthy();
    expect(screen.queryByText(work!.titleRo)).toBeNull();
    expect(
      screen.getByText('Un pachet de conținut nu a putut fi verificat și nu este afișat.'),
    ).toBeTruthy();
  });
});
