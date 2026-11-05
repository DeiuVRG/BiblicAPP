import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Dimensions, Platform, StyleSheet, Text } from 'react-native';

import { AppText, toneColor } from '@/components/app-text';
import { Band, bandBackground } from '@/components/band';
import { isDarkBand, useBandTone } from '@/components/band-context';
import { Button } from '@/components/button';
import { Hero, HighlightedLine } from '@/components/hero';
import { ICON_GRID, ICON_NAMES, ICON_STROKE, Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { FontsProvider, loadedFonts } from '@/theme/fonts';
import { palettes } from '@/theme/palettes';
import { stubMatchMedia } from '@/test-support/match-media';
import { styleWhilePressed } from '@/test-support/press';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';

const original = Dimensions.get('window');
const light = palettes.light;
const HIDDEN = { includeHiddenElements: true };

afterEach(async () => {
  await act(async () => {
    Dimensions.set({ window: original });
  });
  jest.restoreAllMocks();
});

/** The SVG view of an icon (decoration is hidden from queries unless they ask for it). */
const svgOf = (name: string) => screen.getByTestId(`icon-${name}`, HIDDEN);
/** The path data of every shape of an icon. */
const pathsOf = (name: string): string[] =>
  svgOf(name)
    .queryAll((node) => node.type === 'RNSVGPath')
    .map((node) => node.props.d as string);

describe('Icon: render', () => {
  it('has the icons of the spec: menu, close, four chevrons, search, link, copy, two bookmarks, flag, lanes, three themes, send, stop, external, check, info', () => {
    expect([...ICON_NAMES]).toEqual([
      'menu',
      'close',
      'chevronUp',
      'chevronDown',
      'chevronLeft',
      'chevronRight',
      'search',
      'link',
      'copy',
      'bookmark',
      'bookmarkFilled',
      'flag',
      'lanes',
      'themeAuto',
      'themeLight',
      'themeDark',
      'send',
      'stop',
      'external',
      'check',
      'info',
    ]);
  });

  it('draws every icon on a 20 point grid with 1.5 strokes, round caps and joins', async () => {
    expect([ICON_GRID, ICON_STROKE]).toEqual([20, 1.5]);
    await renderWithProviders(
      <>
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} />
        ))}
      </>,
    );
    for (const name of ICON_NAMES) {
      expect(svgOf(name).props).toMatchObject({
        width: 20,
        height: 20,
        vbWidth: 20,
        vbHeight: 20,
        fill: 'none',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      });
    }
  });

  it('draws each icon with shapes of its own (the two bookmarks share a shape and differ in the fill)', async () => {
    await renderWithProviders(
      <>
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} />
        ))}
      </>,
    );
    const shapes = ICON_NAMES.map((name) => {
      const node = svgOf(name);
      const drawn = node.queryAll((child) => /^RNSVG(Path|Circle|Rect)$/.test(child.type));
      expect(drawn.length).toBeGreaterThan(0);
      return JSON.stringify(
        drawn.map((child) => [
          child.type,
          child.props.d ?? child.props.cx ?? child.props.x,
          child.props.propList?.includes('fill') ?? false,
        ]),
      );
    });
    expect(new Set(shapes).size).toBe(ICON_NAMES.length);
  });

  it('scales to a size', async () => {
    await renderWithProviders(<Icon name="menu" size={32} />);
    expect(svgOf('menu').props).toMatchObject({ width: 32, height: 32, vbWidth: 20 });
  });

  it('takes the text colour of the theme, a colour it is given, and the ink of a masthead band', async () => {
    await renderWithProviders(
      <>
        <Icon name="check" testID="plain" />
        <Icon name="check" testID="given" color="#123456" />
        <Band tone="masthead">
          <Icon name="check" testID="dark" />
        </Band>
      </>,
    );
    expect(screen.getByTestId('plain', HIDDEN).props.stroke).toBe(light.text);
    expect(screen.getByTestId('given', HIDDEN).props.stroke).toBe('#123456');
    expect(screen.getByTestId('dark', HIDDEN).props.stroke).toBe(light.mastheadInk);
  });

  it('fills the filled bookmark and the stop, and the half of the theme icon; the outline bookmark stays open', async () => {
    await renderWithProviders(
      <>
        <Icon name="bookmark" />
        <Icon name="bookmarkFilled" />
        <Icon name="stop" />
      </>,
    );
    // A shape that sets its own fill lists it in `propList`; the others inherit `none`.
    const filled = (name: string) =>
      svgOf(name)
        .queryAll((node) => node.type === 'RNSVGPath' || node.type === 'RNSVGRect')
        .some((node) => node.props.propList?.includes('fill'));
    expect(filled('bookmark')).toBe(false);
    expect(filled('bookmarkFilled')).toBe(true);
    expect(filled('stop')).toBe(true);
    expect(pathsOf('bookmark')).toEqual(pathsOf('bookmarkFilled'));
  });

  it('is decoration (hidden from assistive technology) until it has a name', async () => {
    await renderWithProviders(
      <>
        <Icon name="info" />
        <Icon name="search" label="Căutare" />
      </>,
    );
    expect(svgOf('info').props.accessibilityElementsHidden).toBe(true);
    expect(svgOf('info').props.importantForAccessibility).toBe('no-hide-descendants');
    expect(screen.queryByTestId('icon-info')).toBeNull(); // not found by default queries
    const named = screen.getByLabelText('Căutare');
    expect(named.props.accessibilityRole).toBe('image');
  });
});

describe('IconButton', () => {
  it('has an accessible name, is 44 x 44 and calls onPress', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<IconButton name="search" label="Căutare" onPress={onPress} />);
    const button = screen.getByLabelText('Căutare');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button).toHaveStyle({ width: 44, height: 44 });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws its icon in the muted colour, and in accentStrong when hovered or selected', async () => {
    await renderWithProviders(
      <>
        <IconButton name="search" label="Căutare" testID="a" />
        <IconButton name="bookmarkFilled" label="Marcaj" selected testID="b" />
      </>,
    );
    expect(svgOf('search').props.stroke).toBe(light.textMuted);
    expect(svgOf('bookmarkFilled').props.stroke).toBe(light.accentStrong);
    await fireEvent(screen.getByTestId('a'), 'hoverIn');
    expect(svgOf('search').props.stroke).toBe(light.accentStrong);
    await fireEvent(screen.getByTestId('a'), 'hoverOut');
    expect(svgOf('search').props.stroke).toBe(light.textMuted);
  });

  it('says whether it is chosen or open, and does not press when disabled', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <>
        <IconButton name="menu" label="Meniu" expanded onPress={onPress} />
        <IconButton name="flag" label="Raportează" disabled onPress={onPress} />
      </>,
    );
    expect(screen.getByLabelText('Meniu').props.accessibilityState).toMatchObject({
      expanded: true,
    });
    await fireEvent.press(screen.getByLabelText('Raportează'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Raportează')).toHaveStyle({ opacity: 0.6 });
  });

  it('turns the icon into the ink of a masthead band, and of a photograph', async () => {
    await renderWithProviders(
      <>
        <Band tone="masthead">
          <IconButton name="search" label="Căutare" />
        </Band>
        <Band tone="photo">
          <IconButton name="menu" label="Meniu" />
        </Band>
      </>,
    );
    expect(svgOf('search').props.stroke).toBe(light.mastheadInk);
    expect(svgOf('menu').props.stroke).toBe(light.mastheadInk);
  });

  it('dims to opacity 0.7 when pressed on native, and is not pressed when disabled', async () => {
    await renderWithProviders(
      <>
        <IconButton name="search" label="Căutare" />
        <IconButton name="flag" label="Raportează" disabled />
      </>,
    );
    expect(await styleWhilePressed('Căutare')).toMatchObject({ opacity: 0.7 });
    expect(await styleWhilePressed('Raportează')).toMatchObject({ opacity: 0.6 });
  });

  it('shrinks to scale(.96) on web, with no opacity change', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<IconButton name="search" label="Căutare" />);
      const style = await styleWhilePressed('Căutare');
      expect(style.transform).toEqual([{ scale: 0.96 }]);
      expect(style.opacity).toBeUndefined();
    } finally {
      replaced.restore();
    }
  });
});

describe('Band: render', () => {
  const TONES = ['background', 'cream', 'warm', 'masthead'] as const;

  it.each(['light', 'sepia', 'dark'] as const)('has the four backgrounds in %s', async (name) => {
    await renderWithProviders(
      <>
        {TONES.map((tone) => (
          <Band key={tone} tone={tone} testID={`band-${tone}`}>
            <Text>{tone}</Text>
          </Band>
        ))}
      </>,
      { store: createSettingsStore({ theme: name }) },
    );
    const palette = palettes[name];
    await screen.findByTestId('band-cream');
    expect(screen.getByTestId('band-background')).toHaveStyle({
      backgroundColor: palette.background,
    });
    expect(screen.getByTestId('band-cream')).toHaveStyle({ backgroundColor: palette.cream });
    expect(screen.getByTestId('band-warm')).toHaveStyle({ backgroundColor: palette.warm });
    expect(screen.getByTestId('band-masthead')).toHaveStyle({ backgroundColor: palette.masthead });
    expect(bandBackground(palette, 'masthead')).toBe(palette.masthead);
  });

  it('pads by 88 on wide screens and 56 on a phone, or by what it is told', async () => {
    await renderWithProviders(
      <>
        <Band testID="default">
          <Text>a</Text>
        </Band>
        <Band testID="none" padding="none">
          <Text>b</Text>
        </Band>
        <Band testID="exact" padding={{ top: 92, bottom: 84 }}>
          <Text>c</Text>
        </Band>
      </>,
    );
    expect(screen.getByTestId('default')).toHaveStyle({ paddingTop: 56, paddingBottom: 56 });
    expect(screen.getByTestId('none')).toHaveStyle({ paddingTop: 0, paddingBottom: 0 });
    expect(screen.getByTestId('exact')).toHaveStyle({ paddingTop: 92, paddingBottom: 84 });
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 1366 } });
    });
    expect(screen.getByTestId('default')).toHaveStyle({ paddingTop: 88, paddingBottom: 88 });
  });

  it('centres its content in a container: wide by default, another kind, or none', async () => {
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 1366 } });
    });
    await renderWithProviders(
      <>
        <Band testID="wide">
          <Text>wide</Text>
        </Band>
        <Band testID="narrow" container="narrow">
          <Text>narrow</Text>
        </Band>
        <Band testID="full" container={false}>
          <Text>full</Text>
        </Band>
      </>,
    );
    const box = (text: string) => StyleSheet.flatten(screen.getByText(text).parent!.props.style);
    expect(box('wide')).toMatchObject({ maxWidth: 1124 + 80, alignSelf: 'center', width: '100%' });
    expect(box('narrow')).toMatchObject({ maxWidth: 664 + 80 });
    // No container: the text sits straight in the band.
    expect(screen.getByText('full').parent).toBe(screen.getByTestId('full'));
  });

  it('can have a hairline above it', async () => {
    await renderWithProviders(
      <Band testID="ruled" topRule>
        <Text>a</Text>
      </Band>,
    );
    expect(screen.getByTestId('ruled')).toHaveStyle({
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: light.border,
    });
  });

  it('marks only a masthead band for the focus ring on web (data-band)', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(
        <>
          <Band testID="dark" tone="masthead">
            <Text>a</Text>
          </Band>
          <Band testID="page">
            <Text>b</Text>
          </Band>
        </>,
      );
      expect(screen.getByTestId('dark').props.dataSet).toEqual({ band: 'masthead' });
      expect(screen.getByTestId('page').props.dataSet).toBeUndefined();
    } finally {
      replaced.restore();
    }
  });
});

describe('Band: the tone reaches what is inside', () => {
  function Tone() {
    return <Text testID="tone">{useBandTone()}</Text>;
  }

  it('gives text the page inks on the light bands and the dark-band inks on masthead', async () => {
    await renderWithProviders(
      <>
        <AppText variant="body">Pagină</AppText>
        <AppText variant="caption">Mută</AppText>
        <AppText variant="kicker">Accent</AppText>
        <Band tone="masthead">
          <AppText variant="body">Întunecat</AppText>
          <AppText variant="caption">Mută pe întunecat</AppText>
          <AppText variant="kicker">Accent pe întunecat</AppText>
          <AppText variant="body" tone="danger">
            Eroare pe întunecat
          </AppText>
        </Band>
      </>,
    );
    expect(screen.getByText('Pagină')).toHaveStyle({ color: light.text });
    expect(screen.getByText('Mută')).toHaveStyle({ color: light.textMuted });
    expect(screen.getByText('Accent')).toHaveStyle({ color: light.accentStrong });
    expect(screen.getByText('Întunecat')).toHaveStyle({ color: light.mastheadInk });
    expect(screen.getByText('Mută pe întunecat')).toHaveStyle({ color: light.mastheadInkMuted });
    expect(screen.getByText('Accent pe întunecat')).toHaveStyle({ color: light.mastheadAccent });
    // accentStrong is 2.64:1 on masthead: never the colour of anything there.
    expect(screen.getByText('Eroare pe întunecat')).toHaveStyle({ color: light.mastheadAccent });
  });

  it('computes the colour of a tone on a band (also for the other light bands)', () => {
    expect(toneColor(light, 'text')).toBe(light.text);
    expect(toneColor(light, 'muted', 'cream')).toBe(light.textMuted);
    expect(toneColor(light, 'accent', 'warm')).toBe(light.accentStrong);
    expect(toneColor(light, 'danger')).toBe(light.danger);
    expect(toneColor(light, 'text', 'masthead')).toBe(light.mastheadInk);
  });

  it('never puts the muted text colour on warm: textMuted is 4.14:1 there in light (rule 2 of 2.1)', async () => {
    // Regression: a `label`, `caption` or `lead` (muted by default) on a warm plate was textMuted.
    await renderWithProviders(
      <>
        <Band tone="warm">
          <AppText variant="label">Latină</AppText>
          <AppText variant="caption">Un rând</AppText>
          <AppText variant="kicker">Raft</AppText>
        </Band>
        <Band tone="cream">
          <AppText variant="label">Pe cremă</AppText>
        </Band>
      </>,
    );
    expect(screen.getByText('Latină')).toHaveStyle({ color: light.text });
    expect(screen.getByText('Un rând')).toHaveStyle({ color: light.text });
    // The accent label is allowed on warm (accentStrong is 4.54:1 there).
    expect(screen.getByText('Raft')).toHaveStyle({ color: light.accentStrong });
    // The other light bands keep the muted colour.
    expect(screen.getByText('Pe cremă')).toHaveStyle({ color: light.textMuted });
    expect(toneColor(light, 'muted', 'warm')).toBe(light.text);
    for (const name of ['light', 'sepia', 'dark'] as const) {
      expect(toneColor(palettes[name], 'muted', 'warm')).toBe(palettes[name].text);
    }
  });

  it('is dark and masthead-coloured on a photograph, with the accent ink replaced by the ink', async () => {
    // The orange reaches 2.1:1 against a white pixel under the scrim (4.5:1 is needed, G5).
    expect(isDarkBand('photo')).toBe(true);
    expect(isDarkBand('masthead')).toBe(true);
    expect(isDarkBand('warm')).toBe(false);
    expect(bandBackground(light, 'photo')).toBe(light.masthead);
    expect(toneColor(light, 'accent', 'masthead')).toBe(light.mastheadAccent);
    expect(toneColor(light, 'accent', 'photo')).toBe(light.mastheadInk);
    expect(toneColor(light, 'danger', 'photo')).toBe(light.mastheadInk);
    expect(toneColor(light, 'muted', 'photo')).toBe(light.mastheadInkMuted);
    expect(toneColor(light, 'text', 'photo')).toBe(light.mastheadInk);
    await renderWithProviders(
      <>
        <Band tone="photo">
          <AppText variant="kicker">Pe fotografie</AppText>
          <Button variant="text" title="Legătură" />
        </Band>
        <Band tone="masthead">
          <AppText variant="kicker">Pe fundal plat</AppText>
        </Band>
      </>,
    );
    expect(screen.getByText('Pe fotografie')).toHaveStyle({ color: light.mastheadInk });
    expect(screen.getByText('Legătură')).toHaveStyle({ color: light.mastheadInk });
    expect(screen.getByText('Pe fundal plat')).toHaveStyle({ color: light.mastheadAccent });
  });

  it('marks a photograph band for the focus ring on web like a masthead band', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(
        <Band testID="photo" tone="photo">
          <Text>a</Text>
        </Band>,
      );
      expect(screen.getByTestId('photo').props.dataSet).toEqual({ band: 'masthead' });
    } finally {
      replaced.restore();
    }
  });

  it('is "background" outside any band and the band tone inside it', async () => {
    await renderWithProviders(
      <>
        <Tone />
        <Band tone="warm">
          <Tone />
        </Band>
      </>,
    );
    const tones = screen.getAllByTestId('tone').map((node) => node.props.children);
    expect(tones).toEqual(['background', 'warm']);
  });
});

describe('Hero: render', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });

  const hero = (props: Partial<React.ComponentProps<typeof Hero>> = {}) => (
    <FontsProvider value={loadedFonts}>
      <Hero
        kicker="Biblioteca"
        badge="Beta"
        title={['Tradiția creștină,', 'în limba ta.']}
        sub="Cărți creștine vechi, în română și în engleză."
        {...props}
      />
    </FontsProvider>
  );

  it('shows the kicker with its pilcrow, the badge, the two title lines and the sub line', async () => {
    await renderWithProviders(hero());
    expect(screen.getByText('Biblioteca')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Tradiția creștină,')).toBeTruthy();
    expect(screen.getByText('în limba ta.')).toBeTruthy();
    expect(screen.getByText('Cărți creștine vechi, în română și în engleză.')).toBeTruthy();
    expect(screen.getByText('¶', HIDDEN)).toBeTruthy();
  });

  it('sets the title as the one level-1 heading, in IM Fell at 29/33 on a phone, with `mastheadInk`', async () => {
    await renderWithProviders(hero());
    const title = screen.getByTestId('hero-title');
    expect(title.props.accessibilityRole).toBe('header');
    expect(title.props['aria-level']).toBe(1);
    expect(screen.getByText('Tradiția creștină,')).toHaveStyle({
      fontFamily: 'IMFellGreatPrimer_400Regular',
      color: light.mastheadInk,
    });
    // The jest window is 750 wide: 7.4 % of it is 55, capped at 32.
    expect(screen.getByText('Tradiția creștină,')).toHaveStyle({ fontSize: 32, lineHeight: 36 });
  });

  it('has exactly one heading: the title groups its lines, which are plain text (one h1 per screen)', async () => {
    // Regression: the wrapper and each of its two lines were headings, which react-native-web
    // renders as three nested h1 (an <h1> inside an <h1>).
    const headings = () =>
      screen.container.queryAll((node) => node.props?.accessibilityRole === 'header');
    await renderWithProviders(hero());
    expect(headings()).toHaveLength(1);
    expect(headings()[0]!.props.testID).toBe('hero-title');
    for (const line of ['Tradiția creștină,', 'în limba ta.']) {
      expect(screen.getByText(line).props.accessibilityRole).toBeUndefined();
      expect(screen.getByText(line).props['aria-level']).toBeUndefined();
    }
    // The same for a title of one line (the screen shows the latest render only).
    await renderWithProviders(hero({ title: 'Despre bibliotecă', testID: 'single' }));
    expect(headings()).toHaveLength(1);
    expect(headings()[0]!.props.testID).toBe('single-title');
    expect(screen.getByText('Despre bibliotecă').props.accessibilityRole).toBeUndefined();
  });

  it('is one element for a screen reader on native, and not a tab stop on web', async () => {
    await renderWithProviders(hero());
    expect(screen.getByTestId('hero-title').props.accessible).toBe(true);
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(hero({ testID: 'web-hero' }));
      expect(screen.getByTestId('web-hero-title').props.accessible).toBeUndefined();
      expect(screen.getByTestId('web-hero-title').props['aria-level']).toBe(1);
    } finally {
      replaced.restore();
    }
  });

  it('keeps AppText headings as they were, and lets a line opt out', async () => {
    await renderWithProviders(
      <>
        <AppText variant="displayL">Titlu</AppText>
        <AppText variant="displayL" heading={false}>
          Linie
        </AppText>
        <AppText variant="body" heading>
          Forțat
        </AppText>
      </>,
    );
    expect(screen.getByText('Titlu').props.accessibilityRole).toBe('header');
    expect(screen.getByText('Titlu').props['aria-level']).toBe(1);
    expect(screen.getByText('Linie').props.accessibilityRole).toBeUndefined();
    expect(screen.getByText('Forțat').props.accessibilityRole).toBe('header');
  });

  it('sets the title at 52/56 on wide screens, and a page hero (not the landing) at displayL', async () => {
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 1366 } });
    });
    await renderWithProviders(hero());
    expect(screen.getByText('Tradiția creștină,')).toHaveStyle({ fontSize: 52, lineHeight: 56 });
    await renderWithProviders(hero({ kind: 'page', title: 'Despre bibliotecă' }));
    expect(screen.getByText('Despre bibliotecă')).toHaveStyle({ fontSize: 52, lineHeight: 56 });
  });

  it('puts the highlight bar behind the second line only, in accentBar, fully drawn under reduced motion', async () => {
    await renderWithProviders(hero());
    await act(async () => {});
    const bar = screen.getByTestId('hero-highlight', HIDDEN);
    expect(StyleSheet.flatten(bar.props.style)).toMatchObject({
      backgroundColor: light.accentBar,
      transform: [{ scaleX: 1 }],
    });
    expect(screen.getAllByTestId('hero-highlight', HIDDEN)).toHaveLength(1);
    // The second line sits in the same box as the bar; the first does not.
    expect(screen.getByText('în limba ta.').parent).toBe(bar.parent);
    expect(screen.getByText('Tradiția creștină,').parent).not.toBe(bar.parent);
  });

  it('has no bar for a one-line title', async () => {
    await renderWithProviders(hero({ title: 'Despre bibliotecă' }));
    expect(screen.queryByTestId('hero-highlight', HIDDEN)).toBeNull();
  });

  it('is the flat masthead colour without a picture, with the sub line in the muted ink and the kicker in the accent ink', async () => {
    await renderWithProviders(hero());
    expect(screen.getByTestId('hero-band')).toHaveStyle({ backgroundColor: light.masthead });
    expect(screen.getByText('Cărți creștine vechi, în română și în engleză.')).toHaveStyle({
      color: light.mastheadInkMuted,
      fontSize: 17,
    });
    expect(screen.getByText('Biblioteca')).toHaveStyle({
      color: light.mastheadAccent,
      textTransform: 'uppercase',
      letterSpacing: 3.6,
    });
    expect(screen.container.queryAll((node) => node.type === 'Image')).toHaveLength(0);
  });

  it('puts a picture under a scrim of two flat halves on native', async () => {
    await renderWithProviders(hero({ image: { uri: 'https://example.org/hero.webp' } }));
    const picture = screen.container.queryAll((node) => node.type === 'Image');
    expect(picture).toHaveLength(1);
    expect(picture[0]!.props.source).toEqual({ uri: 'https://example.org/hero.webp' });
    expect(picture[0]!.props.resizeMode).toBe('cover');
    // Regression: without an explicit size react-native-web drew a local picture at its own pixel
    // size from the top left corner, instead of covering the hero.
    expect(StyleSheet.flatten(picture[0]!.props.style)).toMatchObject({
      width: '100%',
      height: '100%',
    });
    const scrim = screen.container.queryAll(
      (node) =>
        node.props.style &&
        StyleSheet.flatten(node.props.style).backgroundColor === light.heroScrimTop,
    );
    const lower = screen.container.queryAll(
      (node) =>
        node.props.style &&
        StyleSheet.flatten(node.props.style).backgroundColor === light.heroScrimBottom,
    );
    expect(scrim.length).toBeGreaterThan(0);
    expect(lower.length).toBeGreaterThan(0);
  });

  it('writes the kicker, the pilcrow and the badge in the ink over a picture, and in the orange on the flat hero', async () => {
    // The orange reaches only 2.1:1 against a white pixel under the scrim (G5 needs 4.5:1).
    await renderWithProviders(
      <>
        {hero({ image: { uri: 'https://example.org/hero.webp' }, testID: 'photo' })}
        {hero({ testID: 'flat' })}
      </>,
    );
    const photo = within(screen.getByTestId('photo'));
    expect(photo.getByText('Biblioteca')).toHaveStyle({ color: light.mastheadInk });
    expect(photo.getByText('¶', HIDDEN)).toHaveStyle({ color: light.mastheadInk });
    expect(photo.getByText('Beta')).toHaveStyle({ color: light.mastheadInk });
    expect(photo.getByText('Beta').parent).toHaveStyle({ borderColor: light.mastheadInk });
    const flat = within(screen.getByTestId('flat'));
    expect(flat.getByText('Biblioteca')).toHaveStyle({ color: light.mastheadAccent });
    expect(flat.getByText('¶', HIDDEN)).toHaveStyle({ color: light.mastheadAccent });
    expect(flat.getByText('Beta')).toHaveStyle({ color: light.mastheadAccent });
  });

  it('puts a gradient scrim over the picture on web: heroScrimTop to heroScrimBottom at 78 %', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(hero({ image: { uri: 'https://example.org/hero.webp' } }));
      const gradient = screen.container.queryAll(
        (node) =>
          node.props.style &&
          typeof StyleSheet.flatten(node.props.style).backgroundImage === 'string',
      );
      expect(gradient.length).toBeGreaterThan(0);
      expect(StyleSheet.flatten(gradient[0]!.props.style).backgroundImage).toBe(
        `linear-gradient(${light.heroScrimTop}, ${light.heroScrimBottom} 78%)`,
      );
    } finally {
      replaced.restore();
    }
  });

  it('pads the landing hero 68/60 on a phone and 128/120 wide, an inner page 56/52 and 92/84', async () => {
    await renderWithProviders(
      <>
        {hero({ testID: 'landing' })}
        {hero({ kind: 'page', testID: 'page' })}
      </>,
    );
    expect(screen.getByTestId('landing-band')).toHaveStyle({ paddingTop: 68, paddingBottom: 60 });
    expect(screen.getByTestId('page-band')).toHaveStyle({ paddingTop: 56, paddingBottom: 52 });
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 1366 } });
    });
    expect(screen.getByTestId('landing-band')).toHaveStyle({ paddingTop: 128, paddingBottom: 120 });
    expect(screen.getByTestId('page-band')).toHaveStyle({ paddingTop: 92, paddingBottom: 84 });
  });
});

describe('Hero: links and badge', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  });

  it('writes the text links of a hero in mastheadInk (12.61:1; the orange has no room over a photograph)', async () => {
    await renderWithProviders(
      <>
        <Hero title="Titlu" links={<Button variant="text" title="Despre bibliotecă" />} />
        <Band tone="masthead">
          <Button variant="text" title="Autori" />
        </Band>
      </>,
    );
    expect(screen.getByText('Despre bibliotecă')).toHaveStyle({ color: light.mastheadInk });
    // A link elsewhere on a dark band stays the accent ink (5.67:1 on the band).
    expect(screen.getByText('Autori')).toHaveStyle({ color: light.mastheadAccent });
  });

  it('turns an ink link to the accent colour on hover, and back', async () => {
    await renderWithProviders(
      <Hero title="Titlu" links={<Button variant="text" title="Despre bibliotecă" />} />,
    );
    await fireEvent(screen.getByLabelText('Despre bibliotecă'), 'hoverIn');
    expect(screen.getByText('Despre bibliotecă')).toHaveStyle({ color: light.mastheadAccent });
    await fireEvent(screen.getByLabelText('Despre bibliotecă'), 'hoverOut');
    expect(screen.getByText('Despre bibliotecă')).toHaveStyle({ color: light.mastheadInk });
  });

  it('draws the badge as a status chip on the dark band', async () => {
    await renderWithProviders(<Hero kicker="Biblioteca" badge="Beta" title="Titlu" />);
    expect(screen.getByText('Beta')).toHaveStyle({
      color: light.mastheadAccent,
      textTransform: 'uppercase',
    });
    expect(screen.getByText('Beta').parent).toHaveStyle({
      borderColor: light.mastheadAccent,
      borderRadius: 999,
    });
  });

  it('sets both lines of a page hero in displayL, the highlighted one too', async () => {
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 390 } });
    });
    await renderWithProviders(<Hero kind="page" title={['Despre', 'bibliotecă']} />);
    expect(screen.getByText('Despre')).toHaveStyle({ fontSize: 32, lineHeight: 36 });
    expect(screen.getByText('bibliotecă')).toHaveStyle({ fontSize: 32, lineHeight: 36 });
  });
});

describe('Hero: handlers and motion', () => {
  it('presses its buttons: a primary one and a ghost one on the dark band', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const start = jest.fn();
    const ask = jest.fn();
    await renderWithProviders(
      <Hero
        title="Tradiția creștină"
        actions={
          <>
            <Button variant="primary" title="Începe lectura" onPress={start} />
            <Button variant="outline" title="Întreabă biblioteca" onPress={ask} />
          </>
        }
        links={<Button variant="text" title="Despre bibliotecă" arrow />}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Începe lectura'));
    await fireEvent.press(screen.getByLabelText('Întreabă biblioteca'));
    expect(start).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledTimes(1);
    // The outline button became a ghost one on the dark band.
    expect(screen.getByLabelText('Întreabă biblioteca')).toHaveStyle({
      borderColor: light.mastheadBorder,
    });
    expect(screen.getByLabelText('Despre bibliotecă')).toBeTruthy();
  });

  it('stacks the buttons on a phone and puts them side by side wide', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderWithProviders(
      <Hero title="T" actions={<Button variant="primary" title="Începe" />} />,
    );
    const row = screen.getByLabelText('Începe').parent!;
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBeUndefined();
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 1366 } });
    });
    expect(StyleSheet.flatten(screen.getByLabelText('Începe').parent!.props.style)).toMatchObject({
      flexDirection: 'row',
    });
  });

  describe('the sweep of the highlight bar', () => {
    const scale = () =>
      StyleSheet.flatten(screen.getByTestId('hero-highlight', HIDDEN).props.style).transform[0]
        .scaleX;

    it('starts empty and sweeps once: a 250 ms delay, then 550 ms, on the default curve', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      await renderWithProviders(<HighlightedLine>în limba ta.</HighlightedLine>);
      const sweep = timing.mock.calls.find(
        ([, config]) => config.toValue === 1 && config.delay === 250,
      );
      expect(sweep).toBeDefined();
      expect(sweep![1]).toMatchObject({ toValue: 1, delay: 250, duration: 550 });
      // Once, not a loop.
      expect(timing.mock.calls.filter(([, config]) => config.delay === 250)).toHaveLength(1);
    });

    it('is drawn at once when told to keep still, and starts no animation', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      await renderWithProviders(<HighlightedLine still>în limba ta.</HighlightedLine>);
      expect(scale()).toBe(1);
      expect(timing).not.toHaveBeenCalled();
    });

    it('is drawn at once under reduced motion', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      await renderWithProviders(<HighlightedLine>în limba ta.</HighlightedLine>);
      await act(async () => {});
      expect(scale()).toBe(1);
    });

    it('is full from the very first frame under reduced motion on web, not after the platform answers', async () => {
      // Regression: the hook started as false until a promise resolved, so the bar was absent for
      // about 80 ms and then jumped in. On web `prefers-reduced-motion` can be read at once.
      const restore = stubMatchMedia({ '(prefers-reduced-motion: reduce)': true });
      const replaced = jest.replaceProperty(Platform, 'OS', 'web');
      // The platform never answers during this test: only the synchronous read can know.
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
      const timing = jest.spyOn(Animated, 'timing');
      const loop = jest.spyOn(Animated, 'loop');
      try {
        await renderWithProviders(
          <Hero kicker="Biblioteca" title={['Tradiția creștină,', 'în limba ta.']} />,
        );
        expect(scale()).toBe(1);
        // No sweep, and no pulse of the pilcrow either.
        expect(timing).not.toHaveBeenCalled();
        expect(loop).not.toHaveBeenCalled();
      } finally {
        replaced.restore();
        restore();
      }
    });

    it('still sweeps on web when the user did not ask for reduced motion', async () => {
      const restore = stubMatchMedia({ '(prefers-reduced-motion: reduce)': false });
      const replaced = jest.replaceProperty(Platform, 'OS', 'web');
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const timing = jest.spyOn(Animated, 'timing');
      try {
        await renderWithProviders(<HighlightedLine>în limba ta.</HighlightedLine>);
        expect(timing).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ delay: 250, duration: 550 }),
        );
        expect(scale()).toBe(0);
      } finally {
        replaced.restore();
        restore();
      }
    });
  });
});
