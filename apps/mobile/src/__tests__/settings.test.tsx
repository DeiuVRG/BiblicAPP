import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, within } from '@testing-library/react-native';

import { SettingsScreen } from '@/features/settings/settings-screen';
import { SETTINGS_KEY } from '@/settings/settings-store';
import { FontsProvider, loadedFonts } from '@/theme/fonts';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

const stored = async () => JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!);

describe('SettingsScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists typography settings and restores them on the next start', async () => {
    const first = await renderWithProviders(<SettingsScreen />);
    // No size chosen yet: the window decides (17 on a phone, which is what the tests render in).
    expect(await screen.findByText('17 pt')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Mărește dimensiunea textului'));
    await fireEvent.press(screen.getByLabelText('Mărește spațierea rândurilor'));
    await fireEvent.press(screen.getByLabelText('Sepia'));

    expect(await screen.findByText('18 pt')).toBeTruthy();
    expect(screen.getByText('1,7')).toBeTruthy();
    expect(await stored()).toEqual({
      fontSize: 18,
      lineSpacing: 1.7,
      theme: 'sepia',
      readingFont: 'serif',
      readingLanguage: 'ro', // the tests run as on a Romanian device
      uiLanguage: 'system',
      readerPair: null,
    });

    // A fresh app start reads the stored settings.
    await first.unmount();
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByText('18 pt')).toBeTruthy();
    expect(screen.getByLabelText('Sepia').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('chooses the face of the reading text: Serif by default, Literata and Sans on request, and remembers it', async () => {
    await renderWithProviders(
      <FontsProvider value={loadedFonts}>
        <SettingsScreen />
      </FontsProvider>,
    );
    const group = within(await screen.findByLabelText('Fontul lecturii'));
    expect(group.getByLabelText('Serif').props.accessibilityState).toMatchObject({
      selected: true,
    });
    // The preview is set in the reader's face: Source Serif 4 to begin with.
    expect(screen.getByText(/Împărăția lui Dumnezeu nu vine/)).toHaveStyle({
      fontFamily: 'SourceSerif4_400Regular',
    });

    await fireEvent.press(group.getByLabelText('Literata'));
    expect(screen.getByText(/Împărăția lui Dumnezeu nu vine/)).toHaveStyle({
      fontFamily: 'Literata_400Regular',
    });
    expect(await stored()).toMatchObject({ readingFont: 'literata' });

    await fireEvent.press(group.getByLabelText('Sans'));
    expect(screen.getByText(/Împărăția lui Dumnezeu nu vine/)).toHaveStyle({
      fontFamily: 'Inter_400Regular',
    });
    expect(await stored()).toMatchObject({ readingFont: 'sans' });
  });

  it('keeps the font size within 14 to 34 and ignores corrupt stored data', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ fontSize: 99, lineHeight: 'x', theme: 'neon', readingLanguage: 'fr' }),
    );
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByText('34 pt')).toBeTruthy();
    expect(screen.getByLabelText('Mărește dimensiunea textului')).toBeDisabled();
    expect(screen.getByLabelText('Automat').props.accessibilityState).toMatchObject({
      selected: true,
    });
    // An unknown reading language falls back to the language of the device.
    const reading = within(screen.getByLabelText('Limba lecturii'));
    expect(reading.getByLabelText('Română').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});

describe('SettingsScreen languages', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  const reading = () => within(screen.getByLabelText('Limba lecturii'));
  const ui = () => within(screen.getByLabelText('Limba interfeței'));

  it('has a control for the reading language and one for the interface language, both labelled', async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findAllByText('Limbă')).toHaveLength(1); // the section heading
    expect(screen.getByLabelText('Limba lecturii').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByLabelText('Limba interfeței').props.accessibilityRole).toBe('radiogroup');

    // Reading language: Romanian or English, each written in its own language.
    expect(reading().getAllByRole('radio')).toHaveLength(2);
    expect(reading().getByLabelText('Română')).toBeTruthy();
    expect(reading().getByLabelText('English')).toBeTruthy();
    // Interface language: the device, Romanian or English. "Sistem" is not "Automat" (the theme).
    expect(ui().getAllByRole('radio')).toHaveLength(3);
    expect(ui().getByLabelText('Sistem')).toBeTruthy();
    expect(ui().getByLabelText('Română')).toBeTruthy();
    expect(ui().getByLabelText('English')).toBeTruthy();
    expect(screen.getByText('Sistem urmează limba dispozitivului.')).toBeTruthy();
    expect(screen.getByText(/Ediția în această limbă se deschide prima/)).toBeTruthy();
  });

  it('starts from the device: Romanian, with the interface following the system', async () => {
    await renderWithProviders(<SettingsScreen />);
    await screen.findByText('17 pt');
    expect(reading().getByLabelText('Română').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(reading().getByLabelText('English').props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(ui().getByLabelText('Sistem').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('persists the reading language and restores it on the next start', async () => {
    const first = await renderWithProviders(<SettingsScreen />);
    await screen.findByText('17 pt');
    await fireEvent.press(reading().getByLabelText('English'));
    expect(reading().getByLabelText('English').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(await stored()).toMatchObject({ readingLanguage: 'en', uiLanguage: 'system' });

    await first.unmount();
    await renderWithProviders(<SettingsScreen />);
    await screen.findByText('17 pt');
    expect(reading().getByLabelText('English').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('switches the whole interface to English at once, persists it and keeps it', async () => {
    const first = await renderWithProviders(<SettingsScreen />);
    await screen.findByText('17 pt');
    expect(screen.getByText('Mărimea textului')).toBeTruthy();

    await fireEvent.press(ui().getByLabelText('English'));
    // The screen re-renders in English straight away, without a restart.
    expect(await screen.findByText('Text size')).toBeTruthy();
    expect(screen.queryByText('Mărimea textului')).toBeNull();
    expect(screen.getByLabelText('Interface language')).toBeTruthy();
    expect(screen.getByLabelText('Reading language')).toBeTruthy();
    expect(screen.getByLabelText('Increase the text size')).toBeTruthy();
    expect(screen.getByText('System follows the language of the device.')).toBeTruthy();
    expect(await stored()).toMatchObject({ uiLanguage: 'en' });
    // The reading language is a different setting: it did not move.
    expect(
      within(screen.getByLabelText('Reading language')).getByLabelText('Română').props
        .accessibilityState,
    ).toMatchObject({ selected: true });

    await first.unmount();
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByText('Text size')).toBeTruthy();

    // And back to Romanian.
    await fireEvent.press(
      within(screen.getByLabelText('Interface language')).getByLabelText('Română'),
    );
    expect(await screen.findByText('Mărimea textului')).toBeTruthy();
  });

  it('lists each pack of the installed editions with its licence, and counts packs, not works', async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(await screen.findByText('Pachete de conținut verificate: 2. Respinse: 0.')).toBeTruthy();
    expect(screen.getByText(/\(English · original\): Domeniu public/)).toBeTruthy();
    expect(screen.getByText(/\(Română · traducere\): Sub licență/)).toBeTruthy();
  });

  it('writes the pack list in English too, with the title in the reading language', async () => {
    const store = createSettingsStore({ readingLanguage: 'en', uiLanguage: 'en' });
    await renderWithProviders(<SettingsScreen />, { store });
    expect(await screen.findByText('Content packs verified: 2. Rejected: 0.')).toBeTruthy();
    expect(
      screen.getByText(
        'The Teaching of Jesus Concerning the Kingdom of God and the Church (English · original): Public domain',
      ),
    ).toBeTruthy();
  });
});
