import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, Platform, StyleSheet } from 'react-native';
import { useState } from 'react';

import { Disclosure } from '@/components/disclosure';
import { TAB_HEIGHT, Tabs, tabKeyAction, tabLabel } from '@/components/tabs';
import { FontsProvider, loadedFonts } from '@/theme/fonts';
import { palettes } from '@/theme/palettes';
import { FOCUS_RING_ROOM } from '@/theme/tokens';
import { stubMatchMedia } from '@/test-support/match-media';
import { styleWhilePressed } from '@/test-support/press';
import { renderWithProviders } from '@/test-support/render';

const original = Dimensions.get('window');

// The caret animations are off in these tests (reduced motion): the state is what is asserted.
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(async () => {
  await act(async () => {
    Dimensions.set({ window: original });
  });
  jest.restoreAllMocks();
});

const light = palettes.light;
const TABS = [
  { key: 'toc', label: 'Cuprins', count: 11 },
  { key: 'about', label: 'Prezentare' },
  { key: 'index', label: 'Index' },
] as const;

type Key = (typeof TABS)[number]['key'];

/** A controlled tab strip, so that a press changes what is chosen. */
function Strip({ onChange, size }: { onChange?: (key: Key) => void; size?: 14 | 16 }) {
  const [value, setValue] = useState<Key>('toc');
  return (
    <FontsProvider value={loadedFonts}>
      <Tabs
        label="Vederi"
        size={size}
        tabs={TABS}
        value={value}
        onChange={(key) => {
          setValue(key);
          onChange?.(key);
        }}
      />
    </FontsProvider>
  );
}

const key = (name: string) => ({ nativeEvent: { key: name }, preventDefault: jest.fn() });

describe('Tabs: render', () => {
  it('is a list of tabs with a name, each tab named with its count', async () => {
    await renderWithProviders(<Strip />);
    expect(screen.getByLabelText('Vederi').props.accessibilityRole).toBe('tablist');
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    // "Cuprins · 11": the count is in the label.
    expect(screen.getByLabelText('Cuprins · 11')).toBeTruthy();
    expect(tabLabel(TABS[0])).toBe('Cuprins · 11');
    expect(tabLabel(TABS[1])).toBe('Prezentare');
  });

  it('writes the chosen tab in 600 `text` with a 2 px accent underline, the others in 400 `textMuted`', async () => {
    await renderWithProviders(<Strip />);
    const chosen = screen.getByText('Cuprins · 11');
    expect(chosen).toHaveStyle({ fontFamily: 'SourceSerif4_600SemiBold', color: light.text });
    expect(screen.getByText('Prezentare')).toHaveStyle({
      fontFamily: 'SourceSerif4_400Regular',
      color: light.textMuted,
    });
    expect(screen.getByLabelText('Cuprins · 11').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText('Prezentare').props.accessibilityState).toMatchObject({
      selected: false,
    });
    const underline = screen
      .getByLabelText('Cuprins · 11')
      .children.filter((child) => typeof child !== 'string')
      .at(-1) as unknown as { props: { style: object } };
    expect(StyleSheet.flatten(underline.props.style)).toMatchObject({
      height: 2,
      backgroundColor: light.accent,
    });
    expect(screen.queryByLabelText('Prezentare')!.children.length).toBe(1); // no underline
  });

  it('is 46 high and has the two sizes of the spec, 16 and 14', async () => {
    expect(TAB_HEIGHT).toBe(46);
    await renderWithProviders(<Strip size={14} />);
    expect(screen.getByText('Prezentare')).toHaveStyle({ fontSize: 14 });
    expect(screen.getByLabelText('Prezentare')).toHaveStyle({ minHeight: 46 });
  });

  it('has one tab stop on web (a roving tabindex): the chosen tab can be tabbed to', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<Strip />);
      expect(screen.getByLabelText('Cuprins · 11').props.tabIndex).toBe(0);
      expect(screen.getByLabelText('Prezentare').props.tabIndex).toBe(-1);
      expect(screen.getByLabelText('Index').props.tabIndex).toBe(-1);
    } finally {
      replaced.restore();
    }
  });

  it('leaves the tab order to the platform on iOS and Android', async () => {
    await renderWithProviders(<Strip />);
    expect(screen.getByLabelText('Prezentare').props.tabIndex).toBeUndefined();
  });

  it('shows no edge fade while everything fits', async () => {
    await renderWithProviders(<Strip />);
    const hidden = { includeHiddenElements: true };
    expect(screen.queryByTestId('tabs-fade-right', hidden)).toBeNull();
    expect(screen.queryByTestId('tabs-fade-left', hidden)).toBeNull();
  });

  it('fades the edge that has more when the strip scrolls sideways (a phone)', async () => {
    await renderWithProviders(<Strip />);
    const scroll = screen.getByTestId('tabs-scroll');
    await fireEvent(scroll, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 46 } },
    });
    await fireEvent(scroll, 'contentSizeChange', 520, 46);
    // The fades are decoration: hidden from assistive technology, so the queries ask for them.
    const hidden = { includeHiddenElements: true };
    expect(screen.getByTestId('tabs-fade-right', hidden)).toBeTruthy();
    expect(screen.queryByTestId('tabs-fade-left', hidden)).toBeNull();
    await fireEvent.scroll(scroll, {
      nativeEvent: {
        contentOffset: { x: 100, y: 0 },
        contentSize: { width: 520, height: 46 },
        layoutMeasurement: { width: 300, height: 46 },
      },
    });
    expect(screen.getByTestId('tabs-fade-left', hidden)).toBeTruthy();
    expect(screen.getByTestId('tabs-fade-right', hidden)).toBeTruthy();
    await fireEvent.scroll(scroll, {
      nativeEvent: {
        contentOffset: { x: 220, y: 0 },
        contentSize: { width: 520, height: 46 },
        layoutMeasurement: { width: 300, height: 46 },
      },
    });
    expect(screen.queryByTestId('tabs-fade-right', hidden)).toBeNull();
  });
});

describe('Tabs: the focus ring is not clipped (check G7)', () => {
  // The scroller clips what overflows it, and a ring reaches 4 points outside the tab (2 wide,
  // offset 2): the scroller has to be that much bigger than the tabs, and be pulled back.
  it('leaves room for the ring above, below and before the tabs, and takes it back with negative margins', async () => {
    expect(FOCUS_RING_ROOM).toBe(4);
    await renderWithProviders(<Strip />);
    const scroll = screen.getByTestId('tabs-scroll');
    const outer = StyleSheet.flatten(scroll.props.style);
    const inner = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(inner.paddingTop).toBeGreaterThanOrEqual(FOCUS_RING_ROOM);
    expect(inner.paddingBottom).toBeGreaterThanOrEqual(FOCUS_RING_ROOM);
    expect(inner.paddingLeft).toBeGreaterThanOrEqual(FOCUS_RING_ROOM);
    // The room is given back, so the strip keeps its 46 points and its place.
    expect(outer.marginTop).toBe(-inner.paddingTop);
    expect(outer.marginBottom).toBe(-inner.paddingBottom);
    expect(outer.marginLeft).toBe(-inner.paddingLeft);
  });

  it('keeps the room at the end of the strip too (the last tab can be focused)', async () => {
    await renderWithProviders(<Strip />);
    const inner = StyleSheet.flatten(screen.getByTestId('tabs-scroll').props.contentContainerStyle);
    expect(inner.paddingRight).toBeGreaterThanOrEqual(FOCUS_RING_ROOM);
  });
});

describe('Tabs: pressed look', () => {
  it('presses to opacity 0.7 on native', async () => {
    await renderWithProviders(<Strip />);
    expect(await styleWhilePressed('Prezentare')).toMatchObject({ opacity: 0.7 });
  });

  it('presses to scale(.96) on web, with no opacity change', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<Strip />);
      const style = await styleWhilePressed('Prezentare');
      expect(style.transform).toEqual([{ scale: 0.96 }]);
      expect(style.opacity).toBeUndefined();
    } finally {
      replaced.restore();
    }
  });
});

describe('Tabs: handlers', () => {
  it('chooses a tab when it is pressed', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Strip onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Prezentare'));
    expect(onChange).toHaveBeenCalledWith('about');
    expect(screen.getByLabelText('Prezentare').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('maps keys the way the ARIA pattern does: arrows, Home and End move; Enter and Space choose', () => {
    expect(tabKeyAction('ArrowRight')).toBe('next');
    expect(tabKeyAction('ArrowLeft')).toBe('previous');
    expect(tabKeyAction('Home')).toBe('first');
    expect(tabKeyAction('End')).toBe('last');
    expect(tabKeyAction('Enter')).toBe('activate');
    expect(tabKeyAction(' ')).toBe('activate');
    expect(tabKeyAction('Spacebar')).toBe('activate');
    expect(tabKeyAction('Tab')).toBeNull();
    expect(tabKeyAction('a')).toBeNull();
  });

  it('moves the focus with the arrow keys without choosing (manual activation)', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const onChange = jest.fn();
      await renderWithProviders(<Strip onChange={onChange} />);
      const event = key('ArrowRight');
      await fireEvent(screen.getByLabelText('Cuprins · 11'), 'keyDown', event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      // The one tab stop moved with the focus; the chosen tab did not.
      expect(screen.getByLabelText('Prezentare').props.tabIndex).toBe(0);
      expect(screen.getByLabelText('Cuprins · 11').props.tabIndex).toBe(-1);
      expect(screen.getByLabelText('Cuprins · 11').props.accessibilityState).toMatchObject({
        selected: true,
      });
    } finally {
      replaced.restore();
    }
  });

  it('stops at the ends and jumps with Home and End', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<Strip />);
      await fireEvent(screen.getByLabelText('Cuprins · 11'), 'keyDown', key('ArrowLeft'));
      expect(screen.getByLabelText('Cuprins · 11').props.tabIndex).toBe(0); // nothing before it
      await fireEvent(screen.getByLabelText('Cuprins · 11'), 'keyDown', key('End'));
      expect(screen.getByLabelText('Index').props.tabIndex).toBe(0);
      await fireEvent(screen.getByLabelText('Index'), 'keyDown', key('ArrowRight'));
      expect(screen.getByLabelText('Index').props.tabIndex).toBe(0); // nothing after it
      await fireEvent(screen.getByLabelText('Index'), 'keyDown', key('Home'));
      expect(screen.getByLabelText('Cuprins · 11').props.tabIndex).toBe(0);
    } finally {
      replaced.restore();
    }
  });

  it('chooses the tab that has the focus with Enter or Space', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Strip onChange={onChange} />);
    const enter = key('Enter');
    await fireEvent(screen.getByLabelText('Index'), 'keyDown', enter);
    expect(onChange).toHaveBeenLastCalledWith('index');
    expect(enter.preventDefault).toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Prezentare'), 'keyDown', key(' '));
    expect(onChange).toHaveBeenLastCalledWith('about');
  });

  it('leaves other keys alone: the page keeps Tab and the letters', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Strip onChange={onChange} />);
    const event = key('Tab');
    await fireEvent(screen.getByLabelText('Cuprins · 11'), 'keyDown', event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Disclosure: render', () => {
  it('is closed by default: the summary says so and the body is not rendered (native)', async () => {
    await renderWithProviders(<Disclosure summary="Metodologie">Cum a fost făcută.</Disclosure>);
    expect(screen.getByLabelText('Metodologie').props.accessibilityState).toMatchObject({
      expanded: false,
    });
    expect(screen.queryByText('Cum a fost făcută.')).toBeNull();
  });

  it('writes the summary in `meta` with a › caret that is not part of its name', async () => {
    await renderWithProviders(
      <FontsProvider value={loadedFonts}>
        <Disclosure summary="Metodologie">Corp</Disclosure>
      </FontsProvider>,
    );
    expect(screen.getByText('Metodologie')).toHaveStyle({
      fontFamily: 'SourceSerif4_400Regular',
      fontSize: 14,
    });
    expect(screen.getByText('›', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('›')).toBeNull();
  });

  it('sets a string body in the `caption` style', async () => {
    await renderWithProviders(
      <Disclosure summary="Metodologie" defaultOpen>
        Corp
      </Disclosure>,
    );
    expect(screen.getByText('Corp')).toHaveStyle({ fontSize: 13, lineHeight: 18 });
  });

  it('opens with its body showing when asked to', async () => {
    await renderWithProviders(
      <Disclosure summary="Metodologie" defaultOpen>
        Corp
      </Disclosure>,
    );
    expect(screen.getByText('Corp')).toBeTruthy();
    expect(screen.getByLabelText('Metodologie').props.accessibilityState).toMatchObject({
      expanded: true,
    });
  });

  describe('the height of the summary follows the pointer, not only the width', () => {
    const MOUSE = { '(pointer: coarse)': false };
    const FINGER = { '(pointer: coarse)': true };

    /** Renders on web with the given pointer and window width, and returns the summary height. */
    async function heightOn(answers: Record<string, boolean>, width: number): Promise<unknown> {
      const restore = stubMatchMedia(answers);
      const replaced = jest.replaceProperty(Platform, 'OS', 'web');
      try {
        await act(async () => {
          Dimensions.set({ window: { ...original, width } });
        });
        await renderWithProviders(<Disclosure summary="Metodologie">x</Disclosure>);
        return StyleSheet.flatten(screen.getByLabelText('Metodologie').props.style).minHeight;
      } finally {
        replaced.restore();
        restore();
      }
    }

    it('is 36 for a mouse on a wide screen', async () => {
      expect(await heightOn(MOUSE, 1024)).toBe(36);
    });

    it('is a 44 point target on a phone, with a mouse too', async () => {
      expect(await heightOn(MOUSE, 390)).toBe(44);
    });

    it('is 44 for a finger on a wide screen (a tablet: check G6b)', async () => {
      expect(await heightOn(FINGER, 1024)).toBe(44);
    });

    it('is 44 on iOS and Android at any width: the pointer there is always a finger', async () => {
      await act(async () => {
        Dimensions.set({ window: { ...original, width: 1024 } });
      });
      await renderWithProviders(<Disclosure summary="Metodologie">x</Disclosure>);
      expect(screen.getByLabelText('Metodologie')).toHaveStyle({ minHeight: 44 });
    });
  });

  it('dims to opacity 0.7 when it is pressed on native', async () => {
    await renderWithProviders(<Disclosure summary="Metodologie">x</Disclosure>);
    expect(await styleWhilePressed('Metodologie')).toMatchObject({ opacity: 0.7 });
  });

  it('shrinks to 96 % on web when it is pressed, and keeps its opacity', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<Disclosure summary="Metodologie">x</Disclosure>);
      const style = await styleWhilePressed('Metodologie');
      expect(style.transform).toEqual([{ scale: 0.96 }]);
      expect(style.opacity).toBeUndefined();
    } finally {
      replaced.restore();
    }
  });

  it('keeps a closed body in the page on web, hidden, so that it prints open', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderWithProviders(<Disclosure summary="Metodologie">Corp tipărit</Disclosure>);
      const body = screen.getByText('Corp tipărit', { includeHiddenElements: true }).parent!;
      expect(body).toHaveStyle({ display: 'none' });
      expect(body.props.dataSet).toEqual({ disclosureBody: '' });
      await fireEvent.press(screen.getByLabelText('Metodologie'));
      expect(screen.getByText('Corp tipărit').parent!.props.style).not.toContainEqual(
        expect.objectContaining({ display: 'none' }),
      );
    } finally {
      replaced.restore();
    }
  });
});

describe('Disclosure: handlers', () => {
  it('opens and closes with each press and reports the new state', async () => {
    const onToggle = jest.fn();
    await renderWithProviders(
      <Disclosure summary="Metodologie" onToggle={onToggle}>
        Corp
      </Disclosure>,
    );
    await fireEvent.press(screen.getByLabelText('Metodologie'));
    expect(onToggle).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('Corp')).toBeTruthy();
    expect(screen.getByLabelText('Metodologie').props.accessibilityState).toMatchObject({
      expanded: true,
    });
    await fireEvent.press(screen.getByLabelText('Metodologie'));
    expect(onToggle).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText('Corp')).toBeNull();
  });

  it('turns the caret by 90 degrees when it opens (and at once under reduced motion)', async () => {
    {
      await renderWithProviders(<Disclosure summary="Metodologie">Corp</Disclosure>);
      const rotation = () => {
        const style = StyleSheet.flatten(
          screen.getByText('›', { includeHiddenElements: true }).props.style,
        );
        return style.transform[0].rotate;
      };
      expect(rotation()).toBe('0deg');
      await fireEvent.press(screen.getByLabelText('Metodologie'));
      await act(async () => {});
      expect(rotation()).toBe('90deg');
    }
  });
});
