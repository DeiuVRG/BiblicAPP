import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import type { Paragraph } from '@biblioteca/shared';
import { Dimensions, Platform, StyleSheet, Text } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { SearchField } from '@/components/search-field';
import { STACK_BELOW, SettingRow } from '@/components/setting-row';
import {
  MIN_SEGMENT_WIDTH,
  radioKeyAction,
  SegmentedControl,
  segmentColumns,
} from '@/components/segmented-control';
import { loadBundledRepository } from '@/content/repository';
import { LibraryAllScreen } from '@/features/library/library-all-screen';
import { ReaderParagraph } from '@/features/reader/reader-paragraph';
import { ReaderScreen, TYPOGRAPHY_PANEL_MAX_HEIGHT } from '@/features/reader/reader-screen';
import { SettingsScreen } from '@/features/settings/settings-screen';
import NotFoundRoute from '@/app/+not-found';
import { libraryHref, workHref } from '@/navigation-hrefs';
import { loadedFonts, FontsProvider } from '@/theme/fonts';
import { palettes } from '@/theme/palettes';
import { router, screenOptions } from '@/test-support/expo-router-mock';
import { renderWithProviders } from '@/test-support/render';
import { styleWhilePressed } from '@/test-support/press';
import { vosEditions } from '@/test-support/vos';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

/** The Vos work and the sections of its English edition (eleven chapters). */
async function bundled() {
  const { repository } = await loadBundledRepository();
  const { work, english, englishSections } = await vosEditions(repository);
  return { repository, work, english, sections: englishSections };
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
        <AppText variant="meta">Buton</AppText>
      </FontsProvider>,
    );
    const title = screen.getByText('Titlu');
    expect(title).toHaveStyle({
      fontFamily: 'SourceSerif4_600SemiBold',
      fontSize: 20,
      color: palettes.light.text,
    });
    expect(title.props.accessibilityRole).toBe('header');

    const label = screen.getByText('Etichetă');
    expect(label).toHaveStyle({
      fontFamily: 'SourceSerif4_600SemiBold',
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
  it('has primary, outline and text variants that press and expose their name', async () => {
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
    // The primary button is `accentStrong` (4.5:1 under its label), the label `onAccent`; the
    // brand colour `accent` is for fills without text.
    expect(screen.getByLabelText('Începe')).toHaveStyle({
      backgroundColor: palettes.light.accentStrong,
    });
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

describe('SegmentedControl: pressed look (docs/ui-spec-v2.md, 2.6 and 3)', () => {
  const options = [
    { value: 'a', label: 'Unu' },
    { value: 'b', label: 'Doi' },
  ];
  const control = () => (
    <SegmentedControl label="Tema" options={options} value="a" onChange={jest.fn()} />
  );

  it('dims to opacity 0.7 on native', async () => {
    await renderWithProviders(control());
    expect(await styleWhilePressed('Doi')).toMatchObject({ opacity: 0.7 });
  });

  it('shrinks to scale(.96) on web, with no opacity change (it was 0.7 everywhere before)', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(control());
      const style = await styleWhilePressed('Doi');
      expect(style.transform).toEqual([{ scale: 0.96 }]);
      expect(style.opacity).toBeUndefined();
    } finally {
      replaced.restore();
    }
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
    // (The group has radius 3 and a 1 px border: the segments round their corners by 2.)
    expect(radius('Automat')).toEqual([2, 0, 0, 2]);
    expect(radius('Luminos')).toEqual([0, 0, 0, 0]);
    expect(radius('Sepia')).toEqual([0, 0, 0, 0]);
    expect(radius('Întunecat')).toEqual([0, 2, 2, 0]);

    // Two rows: one segment per corner.
    await resizeTo(312);
    expect(radius('Automat')).toEqual([2, 0, 0, 0]);
    expect(radius('Luminos')).toEqual([0, 2, 0, 0]);
    expect(radius('Sepia')).toEqual([0, 0, 0, 2]);
    expect(radius('Întunecat')).toEqual([0, 0, 2, 0]);
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

describe('LibraryAllScreen design', () => {
  it('leads with the title of the page and names the author, year and language of each work', async () => {
    await renderWithProviders(<LibraryAllScreen />);
    expect(await screen.findByText('Toate lucrările bibliotecii')).toBeTruthy();
    // Author, year and language on one label line.
    expect(screen.getByText(/Geerhardus Vos · 1903 · Engleză/)).toBeTruthy();
  });

  it('does not tag a work with its licence, whichever language is read (check B6)', async () => {
    await renderWithProviders(<LibraryAllScreen />);
    await screen.findByText('EN');
    expect(screen.queryByText(/licen/i)).toBeNull();
    expect(screen.queryByText('Domeniu public')).toBeNull();
  });

  it('sets the editions as outlined badges that wrap', async () => {
    await renderWithProviders(<LibraryAllScreen />);
    const edition = await screen.findByText('EN');
    // code > badge > the badge and its partial tag > the wrapping row of editions
    const row = edition.parent!.parent!.parent!;
    expect(row).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap', gap: 6 });
    expect(screen.getByText('RO').parent!.parent!.parent).toBe(row);
    expect(edition.parent).toHaveStyle({ borderWidth: 1, borderRadius: 999 });
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

  it('keeps the typography panel to 45 % of the window and scrolls inside it (never covers all the text)', async () => {
    // Regression: the panel grew with its content (four rows since the reading font was added) and
    // left no text on a 320 x 568 phone or on a phone on its side.
    expect(TYPOGRAPHY_PANEL_MAX_HEIGHT).toBe(0.45);
    const before = Dimensions.get('window');
    const { work, sections } = await bundled();
    try {
      await act(async () => {
        Dimensions.set({ window: { ...before, width: 320, height: 568 } });
      });
      await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={sections[0]!.id} />);
      await fireEvent.press(
        await screen.findByLabelText('Aspectul textului: mărime, spațiere, temă'),
      );
      const panel = screen.getByTestId('typography-panel');
      expect(StyleSheet.flatten(panel.props.style).maxHeight).toBe(Math.round(568 * 0.45));
      // The controls are inside a scroll view, so what does not fit can still be reached.
      const scroll = panel.queryAll((node) => node.type === 'RCTScrollView');
      expect(scroll).toHaveLength(1);
      expect(within(scroll[0]!).getByText('Mărimea textului')).toBeTruthy();
      expect(within(scroll[0]!).getByLabelText('Întunecat')).toBeTruthy();
      // On its side: 45 % of 375.
      await act(async () => {
        Dimensions.set({ window: { ...before, width: 667, height: 375 } });
      });
      expect(StyleSheet.flatten(screen.getByTestId('typography-panel').props.style).maxHeight).toBe(
        Math.round(375 * 0.45),
      );
    } finally {
      await act(async () => {
        Dimensions.set({ window: before });
      });
    }
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

  it('sets the work title as a quiet running head in the reader, which is also its one h1', async () => {
    const { work, sections } = await bundled();
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={sections[0]!.id} />);
    await screen.findByRole('progressbar');
    const head = screen.getByTestId('reader-running-title');
    expect(head).toHaveTextContent(work.titleRo);
    expect(head).toHaveStyle({ color: palettes.light.textMuted });
    expect(head.props.numberOfLines).toBe(1);
    // It looks like a running head, and it is the level-1 heading of the screen (one h1 per
    // screen, docs/ui-spec-v2.md 18): the chapter title below it is the level 2.
    expect(head.props.accessibilityRole).toBe('header');
    expect(head.props['aria-level']).toBe(1);
  });

  it('offers the table of contents instead of "next" on the last chapter', async () => {
    const { work, english, sections } = await bundled();
    const last = sections[sections.length - 1]!;
    await renderWithProviders(<ReaderScreen workId={work.workId} sectionId={last.id} />);
    await screen.findByText(last.heading);

    expect(screen.queryByLabelText('Capitolul următor')).toBeNull();
    expect(screen.getByLabelText('Capitolul anterior')).not.toBeDisabled();
    await fireEvent.press(screen.getByText('La cuprins'));
    // Back to the page of the work, on the edition that was being read.
    expect(router.replace).toHaveBeenCalledWith(workHref(work.workId, english.editionId));
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

describe('SearchField', () => {
  function Field({ onChange }: { onChange?: (text: string) => void }) {
    const [value, setValue] = useState('');
    return (
      <SearchField
        value={value}
        onChangeText={(text) => {
          setValue(text);
          onChange?.(text);
        }}
        placeholder="Caută"
        label="Caută în text"
        clearLabel="Șterge căutarea"
      />
    );
  }

  it('keeps the clear button inside the field, so typing never resizes the input', async () => {
    await renderWithProviders(<Field />);
    const input = screen.getByLabelText('Caută în text');
    expect(screen.queryByLabelText('Șterge căutarea')).toBeNull();
    const box = { height: 48, borderWidth: 1, fontSize: 16 };
    expect(input).toHaveStyle({ borderColor: palettes.light.borderStrong });
    expect(input).toHaveStyle(box);

    await fireEvent.changeText(input, 'k');
    const clear = screen.getByLabelText('Șterge căutarea');
    // The same box as the input (an overlay): the box keeps its size, only the room for the text
    // changes.
    expect(clear.parent).toBe(input.parent);
    expect(clear).toHaveStyle({ position: 'absolute', right: 2, top: 2 });
    expect(input).toHaveStyle(box);
    expect(input).toHaveStyle({ borderColor: palettes.light.borderStrong });
    // A glyph Inter has (the heavy ballot cross U+2715 fell back to a system font).
    expect(screen.getByText('×')).toBeTruthy();
    // Regression: the button's own colour came after textStyle, so the quiet muted "×" was drawn as
    // an underlined terracotta link.
    const glyph = StyleSheet.flatten(screen.getByText('×').props.style);
    expect(glyph).toMatchObject({ color: palettes.light.textMuted, letterSpacing: 0 });
    expect(glyph.textDecorationLine).toBeUndefined();

    await fireEvent.press(clear);
    expect(screen.getByLabelText('Caută în text').props.value).toBe('');
    expect(screen.queryByLabelText('Șterge căutarea')).toBeNull();
  });

  it('gives an empty field its whole width: the room of the clear button is taken only by text', async () => {
    // A placeholder of 214 points did not fit in the 161 left of a 221 point field (390 point phone).
    await renderWithProviders(<Field />);
    const input = screen.getByLabelText('Caută în text');
    expect(input).toHaveStyle({ paddingLeft: 14, paddingRight: 14 });
    await fireEvent.changeText(input, 'k');
    expect(screen.getByLabelText('Caută în text')).toHaveStyle({ paddingLeft: 14, paddingRight: 44 });
    await fireEvent.changeText(screen.getByLabelText('Caută în text'), '');
    expect(screen.getByLabelText('Caută în text')).toHaveStyle({ paddingRight: 14 });
  });

  it('hands the arrow Down to the screen, which moves the focus into its results, and keeps the caret still', async () => {
    const down = jest.fn();
    await renderWithProviders(
      <SearchField
        value="kingdom"
        onChangeText={() => undefined}
        placeholder="Caută"
        label="Caută în text"
        clearLabel="Șterge căutarea"
        onArrowDown={down}
      />,
    );
    const preventDefault = jest.fn();
    await fireEvent(screen.getByLabelText('Caută în text'), 'keyPress', {
      nativeEvent: { key: 'ArrowDown' },
      preventDefault,
    });
    expect(down).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalled();
    // Other keys are the field's own.
    await fireEvent(screen.getByLabelText('Caută în text'), 'keyPress', {
      nativeEvent: { key: 'ArrowUp' },
      preventDefault,
    });
    expect(down).toHaveBeenCalledTimes(1);
  });

  it('leaves the arrow Down alone when the screen has no results to give it to', async () => {
    await renderWithProviders(<Field />);
    const preventDefault = jest.fn();
    await fireEvent(screen.getByLabelText('Caută în text'), 'keyPress', {
      nativeEvent: { key: 'ArrowDown' },
      preventDefault,
    });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ends a placeholder that is too long for a narrow field in an ellipsis on web, instead of cutting a letter', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<Field />);
      expect(StyleSheet.flatten(screen.getByLabelText('Caută în text').props.style)).toMatchObject({
        textOverflow: 'ellipsis',
      });
    } finally {
      replaced.restore();
    }
    await cleanup();
    await renderWithProviders(<Field />);
    expect(
      StyleSheet.flatten(screen.getByLabelText('Caută în text').props.style).textOverflow,
    ).toBeUndefined();
  });

  it('clears with Escape, and says nothing when it is already empty', async () => {
    const changes: string[] = [];
    await renderWithProviders(<Field onChange={(text) => changes.push(text)} />);
    const input = screen.getByLabelText('Caută în text');
    await fireEvent(input, 'keyPress', { nativeEvent: { key: 'Escape' } });
    expect(changes).toEqual([]);
    await fireEvent.changeText(input, 'kingdom');
    await fireEvent(input, 'keyPress', { nativeEvent: { key: 'Escape' } });
    expect(changes).toEqual(['kingdom', '']);
  });

  it('is a search field for the keyboard: no capitals, no corrections, a search key', async () => {
    await renderWithProviders(<Field />);
    const input = screen.getByLabelText('Caută în text');
    expect(input.props).toMatchObject({
      autoCapitalize: 'none',
      autoCorrect: false,
      inputMode: 'search',
      returnKeyType: 'search',
    });
  });
});

describe('SettingsScreen design', () => {
  it('draws the preview as a card: 1 px border and 3 px corners', async () => {
    await renderWithProviders(<SettingsScreen />);
    const card = (await screen.findByText('Previzualizare')).parent!;
    expect(card).toHaveStyle({
      borderWidth: 1,
      borderColor: palettes.light.border,
      borderRadius: 3,
      backgroundColor: palettes.light.surface,
    });
  });

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
  it('says "Pagină negăsită" once on the page, inside the shell', async () => {
    await renderWithProviders(<NotFoundRoute />);
    expect(screen.getAllByText('Pagină negăsită')).toHaveLength(1);
    // The bars are there: a reader who lands on a wrong address can still go somewhere.
    expect(screen.getByTestId('brand-bar')).toBeTruthy();
    expect(screen.getByTestId('section-bar')).toBeTruthy();
  });

  it('names the browser tab after the page', async () => {
    const fakeDocument = {
      title: '',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    setFakeDocument(fakeDocument);
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<NotFoundRoute />);
      expect(fakeDocument.title).toBe('Pagină negăsită · Biblioteca');
      await cleanup();
    } finally {
      replaced.restore();
      setFakeDocument(undefined);
    }
  });

  it('shows a serif title and a text button back to the library', async () => {
    await renderWithProviders(<NotFoundRoute />);
    expect(screen.getByText('Pagină negăsită')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Înapoi la bibliotecă'));
    expect(router.push).toHaveBeenCalledWith(libraryHref);
  });
});
