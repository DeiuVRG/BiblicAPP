import { act, fireEvent, screen } from '@testing-library/react-native';
import { Dimensions, Platform, StyleSheet } from 'react-native';

import { Band } from '@/components/band';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { palettes } from '@/theme/palettes';
import { FontsProvider, loadedFonts } from '@/theme/fonts';
import { styleWhilePressed } from '@/test-support/press';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';

const original = Dimensions.get('window');

afterEach(async () => {
  // Still mounted here (the automatic cleanup runs later): the update has to go through act.
  await act(async () => {
    Dimensions.set({ window: original });
  });
});

const withFonts = (ui: React.ReactElement) => (
  <FontsProvider value={loadedFonts}>{ui}</FontsProvider>
);
const light = palettes.light;

describe('Button: render', () => {
  it('sets the label in the `button` style: Source Serif 4 600, 13/16, uppercase, tracked', async () => {
    await renderWithProviders(withFonts(<Button variant="primary" title="Începe lectura" />));
    expect(screen.getByText('Începe lectura')).toHaveStyle({
      fontFamily: 'SourceSerif4_600SemiBold',
      fontSize: 13,
      lineHeight: 16,
      letterSpacing: 1.8,
      textTransform: 'uppercase',
    });
  });

  it('draws primary as an accentStrong fill with an onAccent label (4.5:1), never the brand accent', async () => {
    await renderWithProviders(<Button variant="primary" title="Începe" />);
    expect(screen.getByLabelText('Începe')).toHaveStyle({
      backgroundColor: light.accentStrong,
      borderRadius: 3,
    });
    expect(screen.getByText('Începe')).toHaveStyle({ color: light.onAccent });
  });

  it('draws outline as a 1 px borderStrong outline with a text label and a fill that sweeps in', async () => {
    await renderWithProviders(<Button title="Alege" />);
    expect(screen.getByLabelText('Alege')).toHaveStyle({
      borderColor: light.borderStrong,
      borderWidth: 1,
      borderRadius: 3,
    });
    expect(screen.getByLabelText('Alege').props.style).not.toEqual(
      expect.objectContaining({ backgroundColor: expect.anything() }),
    );
  });

  it('draws text as an underlined accentStrong link, and pill as a round filled button', async () => {
    await renderWithProviders(
      <>
        <Button variant="text" title="Citește" />
        <Button variant="pill" title="Creează cont" />
      </>,
    );
    expect(screen.getByText('Citește')).toHaveStyle({
      color: light.accentStrong,
      textDecorationLine: 'underline',
    });
    expect(screen.getByLabelText('Creează cont')).toHaveStyle({
      borderRadius: 999,
      backgroundColor: light.accentStrong,
    });
  });

  it('follows the theme: the primary fill is the accentStrong of dark', async () => {
    await renderWithProviders(<Button variant="primary" title="Începe" />, {
      store: createSettingsStore({ theme: 'dark' }),
    });
    expect(await screen.findByLabelText('Începe')).toHaveStyle({
      backgroundColor: palettes.dark.accentStrong,
    });
    expect(screen.getByText('Începe')).toHaveStyle({ color: palettes.dark.onAccent });
  });

  it('is at least 44 high, and the primary button 48 on a phone', async () => {
    await renderWithProviders(
      <>
        <Button variant="primary" title="Primar" />
        <Button title="Contur" />
      </>,
    );
    expect(screen.getByLabelText('Primar')).toHaveStyle({ minHeight: 48 });
    expect(screen.getByLabelText('Contur')).toHaveStyle({ minHeight: 44 });
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 1024 } });
    });
    expect(screen.getByLabelText('Primar')).toHaveStyle({ minHeight: 44 });
  });

  it('sets a glyph label ("×", "−", "Aa") without capitals, tracking or underline', async () => {
    await renderWithProviders(<Button variant="text" glyph title="Aa" />);
    const label = screen.getByText('Aa');
    expect(label).toHaveStyle({ textTransform: 'none', letterSpacing: 0 });
    expect(StyleSheet.flatten(label.props.style).textDecorationLine).toBeUndefined();
  });

  it('lets textStyle override the colour of the label, and a glyph label still has no underline', async () => {
    // Regression: the label colour of the variant came after textStyle, so a quiet "×" (the clear
    // button of the search field) was drawn as an underlined terracotta link.
    await renderWithProviders(
      <>
        <Button
          variant="text"
          glyph
          title="×"
          label="Șterge"
          textStyle={{ color: light.textMuted, fontSize: 24 }}
        />
        <Button variant="text" title="Citește" textStyle={{ fontSize: 20 }} />
      </>,
    );
    const glyph = StyleSheet.flatten(screen.getByText('×').props.style);
    expect(glyph).toMatchObject({ color: light.textMuted, fontSize: 24, letterSpacing: 0 });
    expect(glyph.textDecorationLine).toBeUndefined();
    // Without a colour in textStyle the variant's own colour stays, and a link is still underlined.
    expect(screen.getByText('Citește')).toHaveStyle({
      color: light.accentStrong,
      fontSize: 20,
      textDecorationLine: 'underline',
    });
  });

  it('adds the arrow of a "NAME ›" link, hidden from screen readers', async () => {
    await renderWithProviders(<Button variant="text" arrow title="Despre bibliotecă" />);
    expect(screen.getByLabelText('Despre bibliotecă')).toBeTruthy();
    // The arrow is decoration: it is not part of the accessible name.
    expect(screen.queryByText('›')).toBeNull();
    expect(screen.getByText('›', { includeHiddenElements: true })).toBeTruthy();
  });

  it('turns an outline button into a ghost one on a masthead band, and links into mastheadAccent', async () => {
    await renderWithProviders(
      <Band tone="masthead">
        <Button title="Încearcă" />
        <Button variant="text" title="Autori" />
        <Button variant="ghost" title="Fantomă" />
      </Band>,
    );
    expect(screen.getByLabelText('Încearcă')).toHaveStyle({
      borderColor: light.mastheadBorder,
      borderRadius: 6,
    });
    expect(screen.getByText('Încearcă')).toHaveStyle({ color: light.mastheadInk });
    expect(screen.getByText('Autori')).toHaveStyle({ color: light.mastheadAccent });
    expect(screen.getByLabelText('Fantomă')).toHaveStyle({ borderColor: light.mastheadBorder });
  });

  it('shows "…" and says it is busy while loading, and is 60 % opaque when disabled', async () => {
    await renderWithProviders(
      <>
        <Button variant="primary" title="Trimite" loading />
        <Button variant="primary" title="Oprit" disabled />
      </>,
    );
    expect(screen.getByText('…')).toBeTruthy();
    expect(screen.getByLabelText('Trimite').props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.getByLabelText('Oprit')).toHaveStyle({ opacity: 0.6 });
  });

  it('exposes the open state of a button that opens something', async () => {
    await renderWithProviders(<Button title="Aa" label="Aspectul textului" expanded />);
    expect(screen.getByLabelText('Aspectul textului').props.accessibilityState).toMatchObject({
      expanded: true,
    });
  });
});

describe('Button: handlers', () => {
  it('calls onPress with the press event', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button variant="primary" title="Începe" onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Începe'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress.mock.calls[0]![0]).toBeDefined();
  });

  it('does not call onPress while loading or disabled', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <>
        <Button title="Trimite" loading onPress={onPress} />
        <Button title="Oprit" disabled onPress={onPress} />
      </>,
    );
    await fireEvent.press(screen.getByLabelText('Trimite'));
    await fireEvent.press(screen.getByLabelText('Oprit'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('darkens the primary fill to accentHover on hover, and back when the pointer leaves', async () => {
    await renderWithProviders(<Button variant="primary" title="Începe" />);
    const button = screen.getByLabelText('Începe');
    await fireEvent(button, 'hoverIn');
    expect(screen.getByLabelText('Începe')).toHaveStyle({ backgroundColor: light.accentHover });
    await fireEvent(button, 'hoverOut');
    expect(screen.getByLabelText('Începe')).toHaveStyle({ backgroundColor: light.accentStrong });
  });

  it('keeps a hover on a disabled button from doing anything', async () => {
    await renderWithProviders(<Button variant="primary" title="Oprit" disabled />);
    await fireEvent(screen.getByLabelText('Oprit'), 'hoverIn');
    expect(screen.getByLabelText('Oprit')).toHaveStyle({ backgroundColor: light.accentStrong });
  });

  it('passes through the props a Link hands to its child (href, role)', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Button variant="text" title="Setări" accessibilityRole="link" onPress={onPress} />,
    );
    expect(screen.getByLabelText('Setări').props.accessibilityRole).toBe('link');
    await fireEvent.press(screen.getByLabelText('Setări'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Button: pressed look', () => {
  it('dims to opacity 0.7 on native', async () => {
    await renderWithProviders(<Button variant="primary" title="Începe" />);
    expect(await styleWhilePressed('Începe')).toMatchObject({ opacity: 0.7 });
  });

  it('shrinks to scale(.96) on web and keeps full opacity', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<Button variant="primary" title="Începe" />);
      const style = await styleWhilePressed('Începe');
      expect(style.transform).toEqual([{ scale: 0.96 }]);
      expect(style.opacity).toBe(1);
    } finally {
      replaced.restore();
    }
  });
});

describe('Chip: render', () => {
  it('sets the label in the `chip` style with a 1 px border, round by default', async () => {
    await renderWithProviders(withFonts(<Chip label="RO" testID="chip" />));
    expect(screen.getByText('RO')).toHaveStyle({
      fontFamily: 'SourceSerif4_600SemiBold',
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      color: light.text,
    });
    expect(screen.getByTestId('chip')).toHaveStyle({
      borderWidth: 1,
      borderColor: light.border,
      borderRadius: 999,
    });
  });

  it('is a plain badge, not a button, until it has a press handler', async () => {
    await renderWithProviders(<Chip label="Română · traducere" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has a tag shape with a radius of 3 for kind chips', async () => {
    await renderWithProviders(<Chip label="Traducere parțială" shape="tag" testID="chip" />);
    expect(screen.getByTestId('chip')).toHaveStyle({ borderRadius: 3 });
  });

  it('writes a status in accentStrong with an accentStrong border', async () => {
    await renderWithProviders(<Chip label="Neverificată" status testID="chip" />);
    expect(screen.getByText('Neverificată')).toHaveStyle({ color: light.accentStrong });
    expect(screen.getByTestId('chip')).toHaveStyle({ borderColor: light.accentStrong });
  });

  it('fills a selected chip with `text` and writes the label in `background`', async () => {
    await renderWithProviders(<Chip label="Latină" selected onPress={jest.fn()} />);
    expect(screen.getByText('Latină')).toHaveStyle({ color: light.background });
    expect(screen.getByLabelText('Latină').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('uses the dark-band inks on a masthead band', async () => {
    await renderWithProviders(
      <Band tone="masthead">
        <Chip label="Beta" status testID="status" />
        <Chip label="Plain" testID="plain" />
      </Band>,
    );
    expect(screen.getByTestId('status')).toHaveStyle({ borderColor: light.mastheadAccent });
    expect(screen.getByText('Beta')).toHaveStyle({ color: light.mastheadAccent });
    expect(screen.getByTestId('plain')).toHaveStyle({ borderColor: light.mastheadBorder });
  });

  it('gives a chip that can be pressed a touch target of at least 44', async () => {
    await renderWithProviders(<Chip label="Filtru" onPress={jest.fn()} />);
    expect(screen.getByLabelText('Filtru')).toHaveStyle({ minHeight: 44 });
  });

  it('does not pin itself to the top of a row: the row decides how its chips line up', async () => {
    // Regression: `alignSelf: flex-start` beat the `alignItems: center` of the row, so a status
    // chip sat 10 points above the middle of the button next to it, and a pressable chip (a 44
    // point target around a 24 point pill) sat 10 points below a static one.
    await renderWithProviders(
      <>
        <Chip label="RO" testID="static" />
        <Chip label="Filtru" onPress={jest.fn()} testID="pressable" />
      </>,
    );
    const drawn = StyleSheet.flatten(screen.getByTestId('static').props.style);
    expect(drawn.alignSelf).toBeUndefined();
    expect(
      StyleSheet.flatten(screen.getByTestId('pressable').props.style).alignSelf,
    ).toBeUndefined();
    expect(
      StyleSheet.flatten(screen.getByText('Filtru').parent!.props.style).alignSelf,
    ).toBeUndefined();
  });
});

describe('Chip: pressed look', () => {
  it('dims to opacity 0.7 on native', async () => {
    await renderWithProviders(<Chip label="Filtru" onPress={jest.fn()} />);
    expect(await styleWhilePressed('Filtru')).toMatchObject({ opacity: 0.7 });
  });

  it('shrinks to scale(.96) on web, with no opacity change', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<Chip label="Filtru" onPress={jest.fn()} />);
      const style = await styleWhilePressed('Filtru');
      expect(style.transform).toEqual([{ scale: 0.96 }]);
      expect(style.opacity).toBeUndefined();
    } finally {
      replaced.restore();
    }
  });
});

describe('Chip: handlers', () => {
  it('calls onPress when a filter chip is pressed, and reports the chosen state', async () => {
    const onPress = jest.fn();
    const { rerender } = await renderWithProviders(
      <Chip label="Latină" selected={false} onPress={onPress} />,
    );
    expect(screen.getByLabelText('Latină').props.accessibilityState).toMatchObject({
      selected: false,
    });
    await fireEvent.press(screen.getByLabelText('Latină'));
    expect(onPress).toHaveBeenCalledTimes(1);
    void rerender;
  });

  it('turns the border to borderStrong on hover over a filter chip', async () => {
    await renderWithProviders(<Chip label="Latină" onPress={jest.fn()} />);
    await fireEvent(screen.getByLabelText('Latină'), 'hoverIn');
    expect(screen.getByText('Latină').parent).toHaveStyle({ borderColor: light.borderStrong });
  });
});
