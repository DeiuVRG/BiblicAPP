import { act, fireEvent, screen } from '@testing-library/react-native';
import type { Paragraph } from '@biblioteca/shared';
import { Dimensions, Platform, StyleSheet, Text } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { STACK_BELOW, SettingRow } from '@/components/setting-row';
import {
  MIN_SEGMENT_WIDTH,
  radioKeyAction,
  SegmentedControl,
  segmentColumns,
} from '@/components/segmented-control';
import { loadBundledRepository } from '@/content/repository';
import { LibraryScreen } from '@/features/library/library-screen';
import { ReaderParagraph } from '@/features/reader/reader-paragraph';
import { ReaderScreen } from '@/features/reader/reader-screen';
import { SearchScreen } from '@/features/search/search-screen';
import { SettingsScreen } from '@/features/settings/settings-screen';
import NotFoundRoute from '@/app/+not-found';
import { libraryHref, workHref } from '@/navigation-hrefs';
import { loadedFonts, FontsProvider } from '@/theme/fonts';
import { palettes } from '@/theme/palettes';
import { router, screenOptions } from '@/test-support/expo-router-mock';
import { renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

async function bundled() {
  const { repository } = await loadBundledRepository();
  const [work] = await repository.listWorks();
  const sections = await repository.getSections(work!.workId);
  return { repository, work: work!, sections };
}

/** Installs (or removes) a stand-in `document`: there is none under Jest, and web code checks it. */
function setFakeDocument(value: unknown) {
  if (value === undefined) delete (globalThis as { document?: unknown }).document;
  else (globalThis as { document?: unknown }).document = value;
}

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  screenOptions.length = 0;
});

describe('AppText', () => {
  it('sets titles in the serif, exposes them as headings and mutes labels and captions', async () => {
    await renderWithProviders(
      <FontsProvider value={loadedFonts}>
        <AppText variant="title">Titlu</AppText>
        <AppText variant="label">Etichetă</AppText>
        <AppText variant="caption" muted={false}>
          Subsol
        </AppText>
        <AppText variant="ui">Buton</AppText>
      </FontsProvider>,
    );
    const title = screen.getByText('Titlu');
    expect(title).toHaveStyle({
      fontFamily: 'Literata_600SemiBold',
      fontSize: 22,
      color: palettes.light.text,
    });
    expect(title.props.accessibilityRole).toBe('header');

    const label = screen.getByText('Etichetă');
    expect(label).toHaveStyle({
      fontFamily: 'Inter_500Medium',
      textTransform: 'uppercase',
      color: palettes.light.textMuted,
    });
    expect(label.props.accessibilityRole).toBeUndefined();

    // `muted={false}` overrides the muted default of the variant.
    expect(screen.getByText('Subsol')).toHaveStyle({ color: palettes.light.text });
    expect(screen.getByText('Buton')).toHaveStyle({ color: palettes.light.text });
  });

  it('caps font scaling so layouts stay usable', async () => {
    await renderWithProviders(<AppText>Text</AppText>);
    expect(screen.getByText('Text').props.maxFontSizeMultiplier).toBe(1.5);
  });
});

describe('Button', () => {
  it('has primary, secondary and text variants that press and expose their name', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <>
        <Button variant="primary" title="Începe" onPress={onPress} />
        <Button title="Alege" label="Alege tema" onPress={onPress} />
        <Button variant="text" title="Înapoi" onPress={onPress} />
        <Button variant="text" title="Oprit" disabled onPress={onPress} />
      </>,
    );
    await fireEvent.press(screen.getByLabelText('Începe'));
    await fireEvent.press(screen.getByLabelText('Alege tema'));
    await fireEvent.press(screen.getByLabelText('Înapoi'));
    expect(onPress).toHaveBeenCalledTimes(3);
    expect(screen.getByLabelText('Oprit')).toBeDisabled();
    // The primary button is the accent colour with the matching text colour.
    expect(screen.getByLabelText('Începe')).toHaveStyle({ backgroundColor: palettes.light.accent });
    expect(screen.getByText('Începe')).toHaveStyle({ color: palettes.light.onAccent });
  });

  it('draws the outline of a secondary button with the control outline colour, not the hairline one', async () => {
    await renderWithProviders(<Button title="Alege" onPress={jest.fn()} />);
    expect(screen.getByLabelText('Alege')).toHaveStyle({
      borderColor: palettes.light.borderStrong,
    });
  });

  it('says whether the thing it opens is open, and keeps its disabled state', async () => {
    await renderWithProviders(
      <>
        <Button title="A" label="Deschis" expanded onPress={jest.fn()} />
        <Button title="B" label="Închis" expanded={false} onPress={jest.fn()} />
        <Button title="C" label="Fără stare" onPress={jest.fn()} />
        <Button title="D" label="Oprit" expanded disabled onPress={jest.fn()} />
      </>,
    );
    expect(screen.getByLabelText('Deschis').props.accessibilityState).toMatchObject({
      expanded: true,
      disabled: false,
    });
    expect(screen.getByLabelText('Închis').props.accessibilityState).toMatchObject({
      expanded: false,
    });
    expect(screen.getByLabelText('Fără stare').props.accessibilityState.expanded).toBeUndefined();
    expect(screen.getByLabelText('Oprit')).toBeDisabled();
  });
});

describe('Chip and SegmentedControl', () => {
  it('shows a chip as outlined label text', async () => {
    await renderWithProviders(<Chip label="Domeniu public" />);
    expect(screen.getByText('Domeniu public')).toBeTruthy();
  });

  it('selects one option and reports the change', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <SegmentedControl
        label="Tema"
        options={[
          { value: 'a', label: 'Unu' },
          { value: 'b', label: 'Doi' },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText('Tema').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByLabelText('Unu').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Doi').props.accessibilityState).toMatchObject({
      selected: false,
    });
    await fireEvent.press(screen.getByLabelText('Doi'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('SegmentedControl layout and keyboard', () => {
  const four = [
    { value: 'system', label: 'Automat' },
    { value: 'light', label: 'Luminos' },
    { value: 'sepia', label: 'Sepia' },
    { value: 'dark', label: 'Întunecat' },
  ] as const;
  const original = Dimensions.get('window');

  afterEach(async () => {
    // Still mounted here (the automatic cleanup runs later): the update has to go through act.
    await act(async () => {
      Dimensions.set({ window: original });
    });
  });

  const control = (onChange = jest.fn(), value: (typeof four)[number]['value'] = 'system') => (
    <SegmentedControl label="Tema" options={four} value={value} onChange={onChange} />
  );
  const resizeTo = (width: number) =>
    fireEvent(screen.getByLabelText('Tema'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width, height: 44 } },
    });

  it('decides how many options share a row from the width and the system font size', () => {
    expect(MIN_SEGMENT_WIDTH).toBe(84);
    expect(segmentColumns(4, null)).toBe(4); // not laid out yet: one row
    expect(segmentColumns(4, 0)).toBe(4);
    expect(segmentColumns(4, 4 * MIN_SEGMENT_WIDTH)).toBe(4);
    expect(segmentColumns(4, 4 * MIN_SEGMENT_WIDTH - 1)).toBe(2);
    expect(segmentColumns(4, 342, 1)).toBe(4); // a 390 px phone
    expect(segmentColumns(4, 312, 1)).toBe(2); // a 360 px phone
    expect(segmentColumns(4, 342, 1.2)).toBe(2); // larger system text needs more room
    expect(segmentColumns(4, 4 * MIN_SEGMENT_WIDTH * 1.5, 3)).toBe(4); // the scale is capped
    expect(segmentColumns(3, 100)).toBe(2);
    expect(segmentColumns(2, 100)).toBe(2); // two options never wrap
    expect(segmentColumns(1, 10)).toBe(1);
  });

  it('keeps the options in one row when there is room and wraps them into two when there is not', async () => {
    Dimensions.set({ window: { ...original, fontScale: 1 } });
    await renderWithProviders(control());
    const row = (label: string) => screen.getByLabelText(label).parent;

    await resizeTo(342);
    expect(row('Automat')).toBe(row('Întunecat'));

    await resizeTo(312);
    expect(row('Automat')).toBe(row('Luminos'));
    expect(row('Sepia')).toBe(row('Întunecat'));
    expect(row('Automat')).not.toBe(row('Sepia'));

    await resizeTo(342);
    expect(row('Automat')).toBe(row('Întunecat'));
  });

  it('rounds only the corners of the group, so that nothing has to be clipped (the focus ring is not)', async () => {
    Dimensions.set({ window: { ...original, fontScale: 1 } });
    await renderWithProviders(control());
    const radius = (label: string) => {
      const style = StyleSheet.flatten(screen.getByLabelText(label).props.style);
      return [
        style.borderTopLeftRadius,
        style.borderTopRightRadius,
        style.borderBottomRightRadius,
        style.borderBottomLeftRadius,
      ];
    };
    expect(screen.getByLabelText('Tema').props.style).not.toContainEqual(
      expect.objectContaining({ overflow: 'hidden' }),
    );
    // One row: the first segment has the left corners, the last one the right ones.
    expect(radius('Automat')).toEqual([5, 0, 0, 5]);
    expect(radius('Luminos')).toEqual([0, 0, 0, 0]);
    expect(radius('Sepia')).toEqual([0, 0, 0, 0]);
    expect(radius('Întunecat')).toEqual([0, 5, 5, 0]);

    // Two rows: one segment per corner.
    await resizeTo(312);
    expect(radius('Automat')).toEqual([5, 0, 0, 0]);
    expect(radius('Luminos')).toEqual([0, 5, 0, 0]);
    expect(radius('Sepia')).toEqual([0, 0, 0, 5]);
    expect(radius('Întunecat')).toEqual([0, 0, 5, 0]);
  });

  it('draws the group and its dividers with the control outline colour', async () => {
    await renderWithProviders(control());
    expect(screen.getByLabelText('Tema')).toHaveStyle({ borderColor: palettes.light.borderStrong });
    expect(screen.getByLabelText('Luminos')).toHaveStyle({
      borderLeftColor: palettes.light.borderStrong,
      borderLeftWidth: 1,
    });
    expect(screen.getByLabelText('Automat')).toHaveStyle({ borderLeftWidth: 0 });
  });

  it('maps keys to what a native radio group does', () => {
    expect(radioKeyAction(' ')).toBe('select');
    expect(radioKeyAction('Spacebar')).toBe('select');
    expect(radioKeyAction('ArrowRight')).toBe('next');
    expect(radioKeyAction('ArrowDown')).toBe('next');
    expect(radioKeyAction('ArrowLeft')).toBe('previous');
    expect(radioKeyAction('ArrowUp')).toBe('previous');
    expect(radioKeyAction('Home')).toBe('first');
    expect(radioKeyAction('End')).toBe('last');
    expect(radioKeyAction('Tab')).toBeNull();
    expect(radioKeyAction('a')).toBeNull();
  });

  it('lets the keyboard choose: Space selects, arrows move and wrap around, other keys do nothing', async () => {
    const onChange = jest.fn();
    await renderWithProviders(control(onChange, 'light'));
    const press = async (label: string, key: string) => {
      const preventDefault = jest.fn();
      await fireEvent(screen.getByLabelText(label), 'keyDown', {
        nativeEvent: { key },
        preventDefault,
      });
      return preventDefault;
    };

    expect(await press('Luminos', ' ')).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith('light');
    await press('Luminos', 'ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith('sepia');
    await press('Luminos', 'ArrowLeft');
    expect(onChange).toHaveBeenLastCalledWith('system');
    await press('Automat', 'ArrowLeft'); // wraps to the last option
    expect(onChange).toHaveBeenLastCalledWith('dark');
    await press('Întunecat', 'ArrowDown'); // and back to the first
    expect(onChange).toHaveBeenLastCalledWith('system');
    await press('Luminos', 'End');
    expect(onChange).toHaveBeenLastCalledWith('dark');
    await press('Luminos', 'Home');
    expect(onChange).toHaveBeenLastCalledWith('system');

    onChange.mockClear();
    expect(await press('Luminos', 'Tab')).not.toHaveBeenCalled(); // the page keeps its own keys
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is one tab stop on web: only the chosen option can be tabbed to', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(control(jest.fn(), 'sepia'));
      expect(screen.getByLabelText('Sepia').props.tabIndex).toBe(0);
      expect(screen.getByLabelText('Luminos').props.tabIndex).toBe(-1);
      expect(screen.getByLabelText('Întunecat').props.tabIndex).toBe(-1);
    } finally {
      replaced.restore();
    }
  });

  it('leaves the tab order to the platform on iOS and Android', async () => {
    await renderWithProviders(control());
    expect(screen.getByLabelText('Luminos').props.tabIndex).toBeUndefined();
  });
});

describe('SettingRow', () => {
  const original = Dimensions.get('window');
  afterEach(async () => {
    // Still mounted here (the automatic cleanup runs later): the update has to go through act.
    await act(async () => {
      Dimensions.set({ window: original });
    });
  });

  const rowOf = (text: string) => screen.getByText(text).parent!;

  it('puts the control beside its label on a phone that is wide enough, and under it below 380 px', async () => {
    expect(STACK_BELOW).toBe(380);
    Dimensions.set({ window: { ...original, width: 390 } });
    await renderWithProviders(
      <SettingRow label="Mărimea textului">
        <Text>control</Text>
      </SettingRow>,
    );
    expect(rowOf('control')).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });

    await act(async () => {
      Dimensions.set({ window: { ...original, width: 360 } });
    });
    // Every row of a group looks alike: no stepper inline in one row and under the label in another.
    expect(rowOf('control')).toHaveStyle({
      flexDirection: 'column',
      flexWrap: 'nowrap',
      alignItems: 'flex-start',
    });
  });

  it('lets a wide control fill the row, shrink on a narrow one, and never use its basis as a height', async () => {
    Dimensions.set({ window: { ...original, width: 390 } });
    await renderWithProviders(
      <SettingRow label="Tema" fill>
        <Text>control</Text>
      </SettingRow>,
    );
    expect(rowOf('control')).toHaveStyle({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 300,
      minWidth: 0,
      maxWidth: 420,
    });

    await act(async () => {
      Dimensions.set({ window: { ...original, width: 320 } });
    });
    const stacked = rowOf('control');
    expect(stacked).toHaveStyle({ alignSelf: 'stretch', maxWidth: 420 });
    expect(stacked.props.style).not.toEqual(
      expect.objectContaining({ flexBasis: expect.anything() }),
    );
  });
});

describe('LibraryScreen design', () => {
  it('leads with the editorial line and tags each work with its licence', async () => {
    await renderWithProviders(<LibraryScreen />);
    expect(await screen.findByText('Cărți vechi, traduse cu grijă.')).toBeTruthy();
    expect(screen.getByText('Domeniu public')).toBeTruthy();
    // Author, year and language on one label line.
    expect(screen.getByText(/Geerhardus Vos · 1903 · Engleză/)).toBeTruthy();
  });
});

describe('ReaderScreen design', () => {
  it('shows the position as a running head and as a progress value', async () => {
    const { work, sections } = await bundled();
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={sections[0]!.id} />);
    const progress = await screen.findByRole('progressbar');
    expect(progress).toHaveTextContent(`1 din ${sections.length} · 0 %`);
    expect(progress.props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 0 });
    expect(progress.props.accessibilityLabel).toContain('Progresul lecturii');
  });

  it('shows the chapter heading as printed, numeral included', async () => {
    const { work, sections } = await bundled();
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={sections[0]!.id} />);
    expect(await screen.findByText(sections[0]!.heading)).toBeTruthy();
  });

  it('opens the typography sheet from the Aa button, changes the size and closes it again', async () => {
    const { work, sections } = await bundled();
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={sections[0]!.id} />);
    const toggle = await screen.findByLabelText('Aspectul textului: mărime, spațiere, temă');
    expect(screen.queryByText('Mărimea textului')).toBeNull();

    await fireEvent.press(toggle);
    expect(screen.getByText('Mărimea textului')).toBeTruthy();
    expect(screen.getByText('Spațierea rândurilor')).toBeTruthy();
    expect(screen.getByLabelText('Întunecat')).toBeTruthy();
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: true });

    await fireEvent.press(screen.getByLabelText('Mărește dimensiunea textului'));
    expect(await screen.findByText('19 pt')).toBeTruthy();

    await fireEvent.press(toggle);
    expect(screen.queryByText('Mărimea textului')).toBeNull();
  });

  it('closes the typography sheet with Escape on web, and only then', async () => {
    const listeners = new Map<string, (event: { key: string }) => void>();
    setFakeDocument({
      addEventListener: (type: string, listener: (event: { key: string }) => void) =>
        listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    });
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const { work, sections } = await bundled();
      await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={sections[0]!.id} />);
      const toggle = await screen.findByLabelText('Aspectul textului: mărime, spațiere, temă');
      expect(listeners.has('keydown')).toBe(false); // nothing listens while the sheet is closed

      await fireEvent.press(toggle);
      expect(screen.getByText('Mărimea textului')).toBeTruthy();
      expect(listeners.has('keydown')).toBe(true);

      await act(async () => listeners.get('keydown')!({ key: 'a' }));
      expect(screen.getByText('Mărimea textului')).toBeTruthy();
      await act(async () => listeners.get('keydown')!({ key: 'Escape' }));
      expect(screen.queryByText('Mărimea textului')).toBeNull();
      expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
      expect(listeners.has('keydown')).toBe(false);
    } finally {
      replaced.restore();
      setFakeDocument(undefined);
    }
  });

  it('listens to no keys on iOS and Android', async () => {
    const addEventListener = jest.fn();
    setFakeDocument({ addEventListener, removeEventListener: jest.fn() });
    try {
      const { work, sections } = await bundled();
      await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={sections[0]!.id} />);
      await fireEvent.press(
        await screen.findByLabelText('Aspectul textului: mărime, spațiere, temă'),
      );
      expect(addEventListener).not.toHaveBeenCalled();
    } finally {
      setFakeDocument(undefined);
    }
  });

  it('sets the work title in the native header as a quiet running head, not a second heading', async () => {
    const { work, sections } = await bundled();
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={sections[0]!.id} />);
    await screen.findByRole('progressbar');
    expect(screenOptions.at(-1)).toMatchObject({
      title: work.titleRo,
      headerTitleStyle: {
        fontFamily: undefined, // fonts are not loaded under Jest: the system face
        fontSize: 15,
        color: palettes.light.textMuted,
      },
    });
  });

  it('offers the table of contents instead of "next" on the last chapter', async () => {
    const { work, sections } = await bundled();
    const last = sections[sections.length - 1]!;
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={last.id} />);
    await screen.findByText(last.heading);

    expect(screen.queryByLabelText('Capitolul următor')).toBeNull();
    expect(screen.getByLabelText('Capitolul anterior')).not.toBeDisabled();
    await fireEvent.press(screen.getByText('La cuprins'));
    expect(router.replace).toHaveBeenCalledWith(workHref(work.workId));
  });
});

describe('ReaderParagraph', () => {
  const paragraph: Paragraph = {
    id: 'p1',
    sectionId: 's1',
    ordinal: 0,
    kind: 'p',
    text: 'The kingdom of God is at hand.',
  };

  it('highlights the search match and sets the target background behind the jump target', async () => {
    await renderWithProviders(
      <ReaderParagraph
        paragraph={paragraph}
        fontSize={18}
        lineHeight={1.6}
        isTarget
        query="kingdom"
      />,
    );
    expect(screen.getByTestId('target-paragraph')).toBeTruthy();
    expect(screen.getByText('kingdom')).toHaveStyle({
      backgroundColor: palettes.light.highlight,
      color: palettes.light.onHighlight,
    });
  });

  it('draws an ordinary paragraph without a target background', async () => {
    await renderWithProviders(
      <ReaderParagraph paragraph={paragraph} fontSize={20} lineHeight={1.5} />,
    );
    expect(screen.queryByTestId('target-paragraph')).toBeNull();
    expect(screen.getByText(paragraph.text)).toHaveStyle({
      fontSize: 20,
      lineHeight: 30,
      textAlign: 'left',
    });
  });
});

describe('SearchScreen design', () => {
  it('puts the chapter first in each result, so a long line cuts off the work title', async () => {
    const { work, sections } = await bundled();
    await renderWithProviders(<SearchScreen initialQuery="kingdom" />);
    const rows = await screen.findAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);
    const label = rows[0]!.props.accessibilityLabel as string;
    const place = label.slice('Deschide rezultatul din '.length, label.indexOf(': '));
    expect(
      sections.map((section) => section.heading).some((heading) => place.startsWith(heading)),
    ).toBe(true);
    expect(place.endsWith(work.titleRo)).toBe(true);
  });
});

describe('SearchScreen field and results', () => {
  it('keeps the clear button inside the field, so typing never resizes the input', async () => {
    await renderWithProviders(<SearchScreen />);
    const input = screen.getByLabelText('Caută în text');
    expect(screen.queryByLabelText('Șterge căutarea')).toBeNull();
    const emptyStyle = { paddingRight: 44, borderColor: palettes.light.borderStrong };
    expect(input).toHaveStyle(emptyStyle);

    await fireEvent.changeText(input, 'k');
    const clear = screen.getByLabelText('Șterge căutarea');
    // The same box as the input (an overlay), and the room for it is reserved from the start.
    expect(clear.parent).toBe(input.parent);
    expect(clear).toHaveStyle({ position: 'absolute', right: 2, top: 2 });
    expect(input).toHaveStyle(emptyStyle);
    // A glyph Inter has (the heavy ballot cross U+2715 fell back to a system font).
    expect(screen.getByText('×')).toBeTruthy();

    await fireEvent.press(clear);
    expect(screen.getByLabelText('Caută în text').props.value).toBe('');
    expect(screen.queryByLabelText('Șterge căutarea')).toBeNull();
  });

  it('names only the chapter on a hit when every hit is from the same work', async () => {
    const { work, sections } = await bundled();
    await renderWithProviders(<SearchScreen initialQuery="kingdom" />);
    const rows = await screen.findAllByRole('link');
    expect(rows.length).toBeGreaterThan(0);
    // The visible line is the chapter; the work title is repeated only for screen readers.
    expect(screen.queryByText(new RegExp(work.titleRo))).toBeNull();
    expect((await screen.findAllByText(sections[0]!.heading)).length).toBeGreaterThan(0);
    expect(rows[0]!.props.accessibilityLabel).toContain(work.titleRo);
  });
});

describe('SettingsScreen design', () => {
  it('groups the settings under label-style headings', async () => {
    await renderWithProviders(<SettingsScreen />);
    for (const title of ['Citire', 'Tema', 'Conținut', 'Licența conținutului', 'Despre']) {
      expect((await screen.findAllByText(title)).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole('header').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText('Previzualizare')).toBeTruthy();
    expect(screen.getByLabelText('Tema').props.accessibilityRole).toBe('radiogroup');
  });
});

describe('NotFoundRoute', () => {
  it('says "Pagină negăsită" once on the page: the header names the library', async () => {
    await renderWithProviders(<NotFoundRoute />);
    expect(screenOptions.at(-1)).toMatchObject({
      title: 'Pagină negăsită', // the browser tab
      headerTitle: 'Biblioteca', // the header (the page itself carries the title below)
    });
    expect(screen.getAllByText('Pagină negăsită')).toHaveLength(1);
  });

  it('shows a serif title and a text button back to the library', async () => {
    await renderWithProviders(<NotFoundRoute />);
    expect(screen.getByText('Pagină negăsită')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Înapoi la bibliotecă'));
    expect(router.push).toHaveBeenCalledWith(libraryHref);
  });
});
