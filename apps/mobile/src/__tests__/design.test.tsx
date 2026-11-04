import { fireEvent, screen } from '@testing-library/react-native';
import type { Paragraph } from '@biblioteca/shared';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { SegmentedControl } from '@/components/segmented-control';
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
import { router } from '@/test-support/expo-router-mock';
import { renderWithProviders } from '@/test-support/render';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

async function bundled() {
  const { repository } = await loadBundledRepository();
  const [work] = await repository.listWorks();
  const sections = await repository.getSections(work!.workId);
  return { repository, work: work!, sections };
}

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
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
  it('shows a serif title and a text button back to the library', async () => {
    await renderWithProviders(<NotFoundRoute />);
    expect(screen.getByText('Pagină negăsită')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Înapoi la bibliotecă'));
    expect(router.push).toHaveBeenCalledWith(libraryHref);
  });
});
