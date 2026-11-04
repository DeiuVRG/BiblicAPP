import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';

import { SettingsScreen } from '@/features/settings/settings-screen';
import { SETTINGS_KEY } from '@/settings/settings-store';
import { renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

describe('SettingsScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists typography settings and restores them on the next start', async () => {
    const first = await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByText('18 pt')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Mărește dimensiunea textului'));
    await fireEvent.press(screen.getByLabelText('Mărește spațierea rândurilor'));
    await fireEvent.press(screen.getByLabelText('Sepia'));

    expect(await screen.findByText('19 pt')).toBeTruthy();
    expect(screen.getByText('1,7')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!)).toEqual({
      fontSize: 19,
      lineHeight: 1.7,
      theme: 'sepia',
    });

    // A fresh app start reads the stored settings.
    first.unmount();
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByText('19 pt')).toBeTruthy();
    expect(screen.getByLabelText('Sepia').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('keeps the font size within 14 to 26 and ignores corrupt stored data', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ fontSize: 99, lineHeight: 'x', theme: 'neon' }),
    );
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByText('26 pt')).toBeTruthy();
    expect(screen.getByLabelText('Mărește dimensiunea textului')).toBeDisabled();
    expect(screen.getByLabelText('Automat').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});
