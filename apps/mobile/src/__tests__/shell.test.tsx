import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import type { ReactElement } from 'react';
import { BETA_1_FEATURES, FeaturesProvider } from '@/config/features';
import type { Features } from '@/config/features';
import { en } from '@/i18n/en';
import { ro as t } from '@/i18n/ro';
import { LanguageSwitch } from '@/shell/language-switch';
import { PageScroll } from '@/shell/page-scroll';
import { ShellRoot } from '@/shell/shell-root';
import { ThemeButton, nextTheme } from '@/shell/theme-button';
import {
  MockScreen,
  resetMockRouter,
  router,
  setMockPathname,
} from '@/test-support/expo-router-mock';
import { installFakeDocument } from '@/test-support/fake-document';
import { stubMatchMedia } from '@/test-support/match-media';
import { createMemoryStore, createSettingsStore, renderWithProviders } from '@/test-support/render';
import { SETTINGS_KEY } from '@/settings/settings-store';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

const original = Dimensions.get('window');

async function resizeTo(width: number) {
  await act(async () => {
    Dimensions.set({ window: { ...original, width } });
  });
}

beforeEach(() => {
  resetMockRouter();
  // No slide, no fade: what is asserted is the state, not the animation (one test below has both).
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(async () => {
  await act(async () => {
    Dimensions.set({ window: original });
  });
  jest.restoreAllMocks();
});

/** The shell as the root layout mounts it: state, the bars of a page and the phone menu. */
async function renderShell(
  features: Partial<Features> = {},
  options: Parameters<typeof renderWithProviders>[1] = {},
  ui: ReactElement = <Text>Page</Text>,
) {
  return renderWithProviders(
    <FeaturesProvider value={{ ...BETA_1_FEATURES, ...features }}>
      <ShellRoot>
        <PageScroll>{ui}</PageScroll>
      </ShellRoot>
    </FeaturesProvider>,
    options,
  );
}

/** Under Jest every element answers `focus` with this one shared mock: it counts the moves. */
const focusMock = () =>
  jest.requireActual<{ default: { focus: jest.Mock } }>(
    '@react-native/jest-preset/jest/MockNativeMethods',
  ).default.focus;

const keyEvent = (key: string) => ({ nativeEvent: { key }, preventDefault: jest.fn() });

/** Whether a drawer item says its drawer is open (`aria-expanded` reaches the host as the state). */
const expanded = (item: { props: { accessibilityState?: { expanded?: boolean } } }) =>
  item.props.accessibilityState?.expanded;

const stored = (store: ReturnType<typeof createMemoryStore>) =>
  JSON.parse(store.data.get(SETTINGS_KEY) ?? '{}') as Record<string, unknown>;

describe('PageScroll', () => {
  /** The scroll container of the screen. */
  const scroll = () =>
    screen.getByTestId('screen').children[0] as unknown as {
      props: { stickyHeaderIndices?: number[] };
    };

  it('puts the brand bar and the section bar first, and the section bar is the sticky header', async () => {
    await renderShell({}, {}, <Text testID="page">Page</Text>);
    expect(scroll().props.stickyHeaderIndices).toEqual([1]);
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"testID":"${id}"`);
    expect(at('brand-bar')).toBeGreaterThan(-1);
    expect(at('brand-bar')).toBeLessThan(at('section-bar'));
    expect(at('section-bar')).toBeLessThan(at('page'));
  });

  it('leaves the brand bar out where the page has a toolbar of its own (the reader)', async () => {
    await renderWithProviders(
      <PageScroll brand={false}>
        <Text>Reader</Text>
      </PageScroll>,
    );
    expect(screen.queryByTestId('brand-bar')).toBeNull();
    expect(screen.getByTestId('section-bar')).toBeTruthy();
    expect(scroll().props.stickyHeaderIndices).toEqual([0]);
  });

  it('is the screen: one scroll container with the page inside it', async () => {
    await renderShell({}, {}, <Text testID="page">Page</Text>);
    expect(screen.getByTestId('screen').children).toHaveLength(1);
    expect(within(screen.getByTestId('screen')).getByTestId('page')).toBeTruthy();
  });
});

describe('BrandBar', () => {
  it('is the banner landmark, with the wordmark as a link to the landing', async () => {
    await renderShell();
    const bar = screen.getByTestId('brand-bar');
    expect(bar.props.role).toBe('banner');
    const brand = within(bar).getByLabelText(t.nav.homeLink);
    expect(brand.props.accessibilityRole).toBe('link');
    await fireEvent.press(brand);
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('is 64 high on a wide screen and 56 on a phone, on cream', async () => {
    await renderShell();
    const row = screen.getByTestId('brand-bar').children[0] as unknown as {
      props: { style: unknown };
    };
    expect(StyleSheet.flatten(row.props.style as never)).toMatchObject({ height: 64 });
    await resizeTo(390);
    const phone = screen.getByTestId('brand-bar').children[0] as unknown as {
      props: { style: unknown };
    };
    expect(StyleSheet.flatten(phone.props.style as never)).toMatchObject({ height: 56 });
  });

  it('has search, the interface language, the theme and Settings on the right of a wide screen', async () => {
    await renderShell();
    const bar = within(screen.getByTestId('brand-bar'));
    await fireEvent.press(bar.getByTestId('brand-search'));
    expect(router.push).toHaveBeenCalledWith('/search');
    expect(bar.getByLabelText(t.shell.languageSwitch)).toBeTruthy();
    expect(bar.getByTestId('theme-button')).toBeTruthy();
    expect(bar.getByTestId('settings-link').props.accessibilityRole).toBe('link');
    await fireEvent.press(bar.getByTestId('settings-link'));
    expect(router.push).toHaveBeenCalledWith('/settings');
    expect(bar.queryByTestId('menu-button')).toBeNull();
  });

  it('shows "Întreabă" only when the chat is live, and then as a link to it', async () => {
    const first = await renderShell({ ask: false });
    expect(screen.queryByTestId('ask-button')).toBeNull();
    await first.unmount();

    await renderShell({ ask: true });
    const ask = screen.getByTestId('ask-button');
    expect(ask.props.accessibilityRole).toBe('link');
    expect(ask.props.accessibilityLabel).toBe(t.shell.askButtonLabel);
    await fireEvent.press(ask);
    expect(router.push).toHaveBeenCalledWith('/ask');
  });

  it('pulls the Settings link back by its padding when it is the last item, so its text meets the column edge', async () => {
    await renderShell({ ask: false });
    expect(screen.getByTestId('settings-link')).toHaveStyle({ marginRight: -14 });
    await cleanup();
    // With "Întreabă" after it, the filled button is what ends at the edge.
    await renderShell({ ask: true });
    expect(StyleSheet.flatten(screen.getByTestId('settings-link').props.style).marginRight).toBe(
      undefined,
    );
  });

  it('on a phone keeps the wordmark and the menu button, and moves the rest into the menu', async () => {
    await resizeTo(390);
    await renderShell();
    const bar = within(screen.getByTestId('brand-bar'));
    expect(bar.getByLabelText(t.nav.homeLink)).toBeTruthy();
    expect(bar.getByTestId('ask-button')).toBeTruthy();
    expect(bar.queryByTestId('language-switch')).toBeNull();
    expect(bar.queryByTestId('theme-button')).toBeNull();
    expect(bar.queryByTestId('settings-link')).toBeNull();
    expect(bar.queryByTestId('brand-search')).toBeNull();
    expect(bar.getByTestId('menu-button').props.accessibilityLabel).toBe(t.nav.menuOpen);
  });

  it('opens the menu from the menu button', async () => {
    await resizeTo(390);
    await renderShell();
    expect(screen.queryByTestId('menu-drawer')).toBeNull();
    await fireEvent.press(screen.getByTestId('menu-button'));
    expect(await screen.findByTestId('menu-drawer')).toBeTruthy();
  });

  it('is written in English with an English interface', async () => {
    await renderShell({}, { store: createSettingsStore({ uiLanguage: 'en' }) });
    const bar = within(screen.getByTestId('brand-bar'));
    expect(bar.getByLabelText(en.nav.homeLink)).toBeTruthy();
    expect(bar.getByTestId('settings-link')).toHaveTextContent(en.nav.settings);
    expect(bar.getByLabelText(en.shell.askButtonLabel)).toBeTruthy();
  });

  it('opens the search on "/" from anywhere on web, unless a field is being typed in', async () => {
    const { document, uninstall } = installFakeDocument();
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderShell();
      expect(document.listening('keydown')).toBeGreaterThan(0);
      document.dispatch('keydown', { key: 'a', preventDefault: jest.fn() });
      expect(router.push).not.toHaveBeenCalled();
      // Typing in a field: the key is a character.
      document.dispatch('keydown', {
        key: '/',
        target: { tagName: 'INPUT' },
        preventDefault: jest.fn(),
      });
      expect(router.push).not.toHaveBeenCalled();
      // A shortcut with a modifier belongs to the browser.
      document.dispatch('keydown', { key: '/', ctrlKey: true, preventDefault: jest.fn() });
      expect(router.push).not.toHaveBeenCalled();

      const preventDefault = jest.fn();
      document.dispatch('keydown', { key: '/', target: { tagName: 'BODY' }, preventDefault });
      expect(preventDefault).toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledWith('/search');
      await cleanup();
      expect(document.listening('keydown')).toBe(0);
    } finally {
      await cleanup();
      replaced.restore();
      uninstall();
    }
  });

  it('listens to no keys on iOS and Android', async () => {
    const { document, uninstall } = installFakeDocument();
    try {
      await renderShell();
      expect(document.listening('keydown')).toBe(0);
    } finally {
      await cleanup();
      uninstall();
    }
  });
});

describe('LanguageSwitch', () => {
  const choose = (value: 'ro' | 'en') => screen.getByTestId(`language-${value}`);

  it('is a radio group of two segments, "RO" and "EN", the interface language chosen', async () => {
    await renderWithProviders(<LanguageSwitch />);
    const group = screen.getByTestId('language-switch');
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe(t.shell.languageSwitch);
    expect(choose('ro').props.accessibilityRole).toBe('radio');
    expect(choose('ro').props.accessibilityLabel).toBe('Română');
    expect(choose('en').props.accessibilityLabel).toBe('English');
    expect(choose('ro').props.accessibilityState).toMatchObject({ checked: true });
    expect(choose('en').props.accessibilityState).toMatchObject({ checked: false });
  });

  it('stores the choice as the interface language and changes the page at once', async () => {
    const store = createMemoryStore();
    await renderWithProviders(<LanguageSwitch />, { store });
    await fireEvent.press(choose('en'));
    expect(choose('en').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('language-switch').props.accessibilityLabel).toBe(
      en.shell.languageSwitch,
    );
    expect(stored(store).uiLanguage).toBe('en');
    await fireEvent.press(choose('ro'));
    expect(stored(store).uiLanguage).toBe('ro');
  });

  it('moves with the arrow keys, wrapping around, and chooses with Space', async () => {
    const store = createMemoryStore();
    await renderWithProviders(<LanguageSwitch />, { store });
    const key = async (value: 'ro' | 'en', pressed: string) => {
      const preventDefault = jest.fn();
      await fireEvent(choose(value), 'keyDown', { nativeEvent: { key: pressed }, preventDefault });
      return preventDefault;
    };
    expect(await key('ro', 'ArrowRight')).toHaveBeenCalled();
    expect(stored(store).uiLanguage).toBe('en');
    await key('en', 'ArrowRight');
    expect(stored(store).uiLanguage).toBe('ro');
    await key('ro', 'ArrowLeft');
    expect(stored(store).uiLanguage).toBe('en');
    await key('en', 'ArrowUp');
    expect(stored(store).uiLanguage).toBe('ro');
    await key('en', ' ');
    expect(stored(store).uiLanguage).toBe('en');
    // Other keys are left to the browser.
    expect(await key('en', 'a')).not.toHaveBeenCalled();
  });

  it('is 32 high for a mouse and 44 points a segment where the target must be a finger', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    const restore = stubMatchMedia({ '(pointer: coarse)': false });
    try {
      await renderWithProviders(<LanguageSwitch />);
      expect(screen.getByTestId('language-switch')).toHaveStyle({ height: 32 });
      expect(choose('en')).toHaveStyle({ minWidth: 36 });
      await cleanup();
      await renderWithProviders(<LanguageSwitch tall />);
      // The segments are the targets: 44 inside the 1 point border of the group.
      expect(screen.getByTestId('language-switch')).toHaveStyle({ height: 46 });
      expect(choose('en')).toHaveStyle({ minWidth: 44 });
      await cleanup();
      // A finger is the pointer on a phone and a tablet, wherever the window is wide.
      restore.change('(pointer: coarse)', true);
      await renderWithProviders(<LanguageSwitch />);
      expect(screen.getByTestId('language-switch')).toHaveStyle({ height: 46 });
      expect(choose('ro')).toHaveStyle({ minWidth: 44 });
    } finally {
      await cleanup();
      restore();
      replaced.restore();
    }
  });
});

describe('ThemeButton', () => {
  it('cycles light, sepia, dark and auto', () => {
    expect(nextTheme('light')).toBe('sepia');
    expect(nextTheme('sepia')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
    expect(nextTheme('system')).toBe('light');
  });

  it('says the current theme and what the next press gives, and stores each choice', async () => {
    const store = createSettingsStore({ theme: 'light' });
    await renderWithProviders(<ThemeButton />, { store });
    const button = screen.getByTestId('theme-button');
    expect(button.props.accessibilityLabel).toBe('Tema: Luminos. Apasă pentru Sepia.');
    await fireEvent.press(button);
    expect(stored(store).theme).toBe('sepia');
    expect(screen.getByTestId('theme-button').props.accessibilityLabel).toBe(
      'Tema: Sepia. Apasă pentru Întunecat.',
    );
    await fireEvent.press(screen.getByTestId('theme-button'));
    expect(stored(store).theme).toBe('dark');
    await fireEvent.press(screen.getByTestId('theme-button'));
    expect(stored(store).theme).toBe('system');
    await fireEvent.press(screen.getByTestId('theme-button'));
    expect(stored(store).theme).toBe('light');
  });

  it('draws the icon of the current theme', async () => {
    const store = createSettingsStore({ theme: 'sepia' });
    await renderWithProviders(<ThemeButton />, { store });
    // The icon is decorative (hidden from screen readers): the button carries the name.
    expect(
      await within(screen.getByTestId('theme-button')).findByTestId('icon-themeSepia', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });
});

describe('SectionBar', () => {
  const bar = () => within(screen.getByTestId('section-bar'));

  it('is the navigation landmark "Secțiuni"', async () => {
    await renderShell();
    const navigation = screen.getByTestId('section-bar');
    expect(navigation.props.role).toBe('navigation');
    expect(navigation.props['aria-label']).toBe(t.nav.sections);
  });

  it('shows home, search and read while the other screens are not live', async () => {
    await renderShell({ ask: false, bookmarks: false, about: false, transparency: false });
    expect(bar().getByTestId('section-item-home')).toBeTruthy();
    expect(bar().getByTestId('section-item-search')).toBeTruthy();
    expect(bar().getByTestId('section-item-read')).toBeTruthy();
    expect(bar().queryByTestId('section-item-research')).toBeNull();
    expect(bar().queryByTestId('section-item-about')).toBeNull();
  });

  it('shows the five sections of Beta 1 in order (check S1)', async () => {
    await renderShell();
    const ids = bar()
      .getAllByTestId(/^section-item-/)
      .map((node) => node.props.testID);
    expect(ids).toEqual([
      'section-item-home',
      'section-item-search',
      'section-item-read',
      'section-item-research',
      'section-item-about',
    ]);
  });

  it('draws "BIBLIOTECA | ACASĂ" as the first item, a link to the landing', async () => {
    await renderShell();
    const home = bar().getByTestId('section-item-home');
    expect(home.props.accessibilityRole).toBe('link');
    expect(home.props.accessibilityLabel).toBe(`${t.appName}, ${t.nav.home}`);
    expect(within(home).getByText(t.appName)).toBeTruthy();
    expect(within(home).getByText(`| ${t.nav.home}`)).toBeTruthy();
    await fireEvent.press(home);
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('marks the page the reader is on (aria-current)', async () => {
    setMockPathname('/library/all');
    await renderShell();
    const read = bar().getByTestId('section-item-read');
    expect(read.props['aria-current']).toBe('true');
    expect(read.props.accessibilityState).toMatchObject({ selected: true });
    expect(bar().getByTestId('section-item-search').props['aria-current']).toBeUndefined();
    expect(bar().getByTestId('section-item-home').props['aria-current']).toBeUndefined();

    // Reading a work belongs to "Citește" too; the landing belongs to home.
    await cleanup();
    setMockPathname('/work/abc');
    await renderShell();
    expect(bar().getByTestId('section-item-read').props['aria-current']).toBe('true');
    await cleanup();
    setMockPathname('/');
    await renderShell();
    expect(bar().getByTestId('section-item-home').props['aria-current']).toBe('page');
  });

  it('opens a drawer from its item and says so (aria-expanded, aria-controls)', async () => {
    setMockPathname('/library/all');
    await renderShell();
    const read = bar().getByTestId('section-item-read');
    expect(read.props.accessibilityRole).toBe('button');
    expect(expanded(read)).toBe(false);
    expect(bar().queryByTestId('section-drawer-read')).toBeNull();

    await fireEvent.press(read);
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(true);
    expect(bar().getByTestId('section-item-read').props['aria-controls']).toBe(
      'section-drawer-read',
    );
    const drawer = bar().getByTestId('section-drawer-read');
    expect(within(drawer).getByTestId('drawer-entry-read-library')).toHaveTextContent(
      t.nav.curated,
    );
    expect(within(drawer).getByTestId('drawer-entry-read-library-all')).toHaveTextContent(
      t.nav.all,
    );
    expect(within(drawer).getByTestId('drawer-entry-read-authors')).toHaveTextContent(
      t.nav.authors,
    );
    // The entry of the page the reader is on is the current one.
    expect(within(drawer).getByTestId('drawer-entry-read-library-all').props['aria-current']).toBe(
      'page',
    );
    expect(
      within(drawer).getByTestId('drawer-entry-read-library').props['aria-current'],
    ).toBeUndefined();
    expect(
      screen.getByTestId('section-caret-read', { includeHiddenElements: true }),
    ).toHaveTextContent('‹');
  });

  it('closes the drawer when the item is pressed again', async () => {
    await renderShell();
    await fireEvent.press(bar().getByTestId('section-item-read'));
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(true);
    await fireEvent.press(bar().getByTestId('section-item-read'));
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(false);
  });

  it('opens one drawer at a time', async () => {
    await renderShell();
    await fireEvent.press(bar().getByTestId('section-item-research'));
    expect(expanded(bar().getByTestId('section-item-research'))).toBe(true);
    await fireEvent.press(bar().getByTestId('section-item-read'));
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(true);
    expect(expanded(bar().getByTestId('section-item-research'))).toBe(false);
  });

  it('follows an entry and closes the drawer', async () => {
    await renderShell();
    await fireEvent.press(bar().getByTestId('section-item-read'));
    await fireEvent.press(bar().getByTestId('drawer-entry-read-library-all'));
    expect(router.push).toHaveBeenCalledWith('/library/all');
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(false);
  });

  it('closes the drawer when the page changes', async () => {
    await renderShell();
    await fireEvent.press(bar().getByTestId('section-item-read'));
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(true);
    await act(async () => setMockPathname('/search'));
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(false);
  });

  it('closes the drawer with Escape on web and gives nothing to a key on iOS and Android', async () => {
    const { document, uninstall } = installFakeDocument();
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await renderShell();
      await fireEvent.press(bar().getByTestId('section-item-read'));
      await act(async () => document.dispatch('keydown', { key: 'a' }));
      expect(expanded(bar().getByTestId('section-item-read'))).toBe(true);
      await act(async () => document.dispatch('keydown', { key: 'Escape' }));
      expect(expanded(bar().getByTestId('section-item-read'))).toBe(false);
    } finally {
      // Unmount while the document is still there: the shell takes its listeners off it.
      await cleanup();
      replaced.restore();
      uninstall();
    }
  });

  it('opens a drawer with the arrow Down key', async () => {
    await renderShell();
    const preventDefault = jest.fn();
    await fireEvent(bar().getByTestId('section-item-read'), 'keyDown', {
      nativeEvent: { key: 'ArrowDown' },
      preventDefault,
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(true);
    // The item without a drawer ignores it; the arrows Right and Left are the bar's own.
    const ignored = jest.fn();
    await fireEvent(bar().getByTestId('section-item-search'), 'keyDown', {
      nativeEvent: { key: 'ArrowDown' },
      preventDefault: ignored,
    });
    expect(ignored).not.toHaveBeenCalled();
    const moved = jest.fn();
    await fireEvent(bar().getByTestId('section-item-search'), 'keyDown', {
      nativeEvent: { key: 'ArrowRight' },
      preventDefault: moved,
    });
    expect(moved).toHaveBeenCalled();
  });

  describe('keys (check S3)', () => {
    beforeEach(() => focusMock().mockClear());

    it('moves the focus between the items of the bar with the arrows Right and Left, links too', async () => {
      await renderShell();
      // home -> search: both are links (Link's slot hands them a `ref` prop of its own).
      await fireEvent(bar().getByTestId('section-item-home'), 'keyDown', keyEvent('ArrowRight'));
      expect(focusMock()).toHaveBeenCalledTimes(1);
      // read -> search, the other way round.
      await fireEvent(bar().getByTestId('section-item-read'), 'keyDown', keyEvent('ArrowLeft'));
      expect(focusMock()).toHaveBeenCalledTimes(2);
      // search -> read: a drawer item is a plain button.
      await fireEvent(bar().getByTestId('section-item-search'), 'keyDown', keyEvent('ArrowRight'));
      expect(focusMock()).toHaveBeenCalledTimes(3);
    });

    it('stays where it is at the ends of the bar', async () => {
      await renderShell();
      const left = keyEvent('ArrowLeft');
      await fireEvent(bar().getByTestId('section-item-home'), 'keyDown', left);
      expect(left.preventDefault).toHaveBeenCalled();
      expect(focusMock()).not.toHaveBeenCalled();
    });

    it('opens a drawer with Down and moves the focus to its first entry', async () => {
      await renderShell();
      await fireEvent(bar().getByTestId('section-item-read'), 'keyDown', keyEvent('ArrowDown'));
      expect(expanded(bar().getByTestId('section-item-read'))).toBe(true);
      // The entry is a link: it was never given the focus while its ref was lost.
      await waitFor(() => expect(focusMock()).toHaveBeenCalledTimes(1));
      // With the drawer open, Down moves the focus at once.
      await fireEvent(bar().getByTestId('section-item-read'), 'keyDown', keyEvent('ArrowDown'));
      expect(focusMock()).toHaveBeenCalledTimes(2);
    });

    it('gives the focus back to the toggle with Esc on web', async () => {
      const { document, uninstall } = installFakeDocument();
      const replaced = jest.replaceProperty(Platform, 'OS', 'web');
      try {
        await renderShell();
        await fireEvent.press(bar().getByTestId('section-item-read'));
        focusMock().mockClear();
        await act(async () => document.dispatch('keydown', { key: 'Escape' }));
        expect(expanded(bar().getByTestId('section-item-read'))).toBe(false);
        expect(focusMock()).toHaveBeenCalledTimes(1);
      } finally {
        await cleanup();
        replaced.restore();
        uninstall();
      }
    });
  });

  describe('on a stack of screens (the screens a reader came from stay mounted)', () => {
    /** Two screens, each with the bars of the page: the one below is not in focus. */
    async function renderStack() {
      return renderWithProviders(
        <FeaturesProvider value={BETA_1_FEATURES}>
          <ShellRoot>
            <View testID="below">
              <MockScreen focused={false}>
                <PageScroll>
                  <Text>Below</Text>
                </PageScroll>
              </MockScreen>
            </View>
            <View testID="top">
              <MockScreen focused>
                <PageScroll>
                  <Text>Top</Text>
                </PageScroll>
              </MockScreen>
            </View>
          </ShellRoot>
        </FeaturesProvider>,
      );
    }
    const top = () => within(screen.getByTestId('top'));
    const below = () => within(screen.getByTestId('below'));

    it('lets only the bar of the screen in focus show the open drawer', async () => {
      await resizeTo(390);
      await renderStack();
      await fireEvent.press(top().getByTestId('section-item-read'));
      expect(top().getByTestId('section-drawer-read')).toBeTruthy();
      expect(expanded(top().getByTestId('section-item-read'))).toBe(true);
      expect(below().queryByTestId('section-drawer-read')).toBeNull();
      expect(expanded(below().getByTestId('section-item-read'))).toBe(false);
      // Pressing an entry of the visible drawer follows it.
      await fireEvent.press(top().getByTestId('drawer-entry-read-authors'));
      expect(router.push).toHaveBeenCalledWith('/authors');
    });

    it('lets only the bar in focus listen for a press outside it and for Esc', async () => {
      const { document, uninstall } = installFakeDocument();
      const replaced = jest.replaceProperty(Platform, 'OS', 'web');
      try {
        await renderStack();
        expect(document.listening('pointerdown')).toBe(0);
        await fireEvent.press(top().getByTestId('section-item-read'));
        // A bar that is not in focus took a press inside the visible drawer for a press outside
        // its own and closed the drawer under the finger: it must not listen at all.
        expect(document.listening('pointerdown')).toBe(1);
        expect(document.listening('keydown')).toBe(2); // the shortcut `/` of the brand bar, Esc
        await fireEvent.press(top().getByTestId('section-item-read'));
        expect(document.listening('pointerdown')).toBe(0);
      } finally {
        await cleanup();
        replaced.restore();
        uninstall();
      }
    });

    it('closes the drawer with the route change, as it does for a single screen', async () => {
      await renderStack();
      await fireEvent.press(top().getByTestId('section-item-read'));
      expect(expanded(top().getByTestId('section-item-read'))).toBe(true);
      await act(async () => setMockPathname('/search'));
      expect(expanded(top().getByTestId('section-item-read'))).toBe(false);
    });
  });

  describe('scroll cue (a wide bar that scrolls sideways)', () => {
    const scroller = () => bar().getByTestId('section-bar-scroll');
    // The cue and the fade are decoration, hidden from assistive technology: the queries ask for them.
    const hidden = { includeHiddenElements: true };
    async function layOut(width: number, content: number) {
      await fireEvent(scroller(), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width, height: 56 } },
      });
      await fireEvent(scroller(), 'contentSizeChange', content, 56);
    }

    it('shows no cue while the items fit', async () => {
      await renderShell();
      await layOut(900, 600);
      expect(screen.queryByTestId('section-bar-cue', hidden)).toBeNull();
    });

    it('draws a hairline with a thumb when the bar overflows: its length is the share in view', async () => {
      await renderShell();
      await layOut(660, 1320);
      const thumb = screen.getByTestId('section-bar-cue-thumb', hidden);
      expect(screen.getByTestId('section-bar-cue', hidden)).toHaveStyle({ height: 2 });
      expect(thumb).toHaveStyle({ width: 330, left: 0 });
      // Scrolled to the end, the thumb is at the end of the hairline.
      await fireEvent.scroll(scroller(), {
        nativeEvent: {
          contentOffset: { x: 660, y: 0 },
          contentSize: { width: 1320, height: 56 },
          layoutMeasurement: { width: 660, height: 56 },
        },
      });
      expect(screen.getByTestId('section-bar-cue-thumb', hidden)).toHaveStyle({
        width: 330,
        left: 330,
      });
    });

    it('leaves a phone to its edge fade', async () => {
      await resizeTo(390);
      await renderShell();
      await layOut(390, 700);
      expect(screen.queryByTestId('section-bar-cue', hidden)).toBeNull();
      expect(screen.getByTestId('section-bar-fade', hidden)).toBeTruthy();
    });
  });

  it('is 48 high on a wide screen and 44 on a phone', async () => {
    await renderShell();
    expect(bar().getByTestId('section-item-search')).toHaveStyle({ minHeight: 48 });
    await resizeTo(390);
    expect(bar().getByTestId('section-item-search')).toHaveStyle({ minHeight: 44 });
  });

  it('drops the drawer as a panel under the bar on a phone, one row per entry', async () => {
    await resizeTo(390);
    setMockPathname('/library/all');
    await renderShell();
    await fireEvent.press(bar().getByTestId('section-item-read'));
    const panel = bar().getByTestId('section-drawer-read');
    const entries = within(panel).getAllByRole('link');
    expect(entries.map((entry) => entry.props.accessibilityLabel)).toEqual([
      t.nav.curated,
      t.nav.all,
      t.nav.authors,
    ]);
    expect(entries[0]).toHaveStyle({ minHeight: 48 });
    expect(entries[1]!.props['aria-current']).toBe('page');
    await fireEvent.press(entries[2]!);
    expect(router.push).toHaveBeenCalledWith('/authors');
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(false);
  });

  it('closes an open drawer when the window crosses 640 points', async () => {
    await renderShell();
    await fireEvent.press(bar().getByTestId('section-item-read'));
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(true);
    await resizeTo(600);
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(false);
    await fireEvent.press(bar().getByTestId('section-item-read'));
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(true);
    await resizeTo(900);
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(false);
  });

  it('names the items in the interface language', async () => {
    await renderShell({}, { store: createSettingsStore({ uiLanguage: 'en' }) });
    expect(bar().getByTestId('section-item-search').props.accessibilityLabel).toBe(en.nav.search);
    expect(bar().getByTestId('section-item-read').props.accessibilityLabel).toBe(en.nav.read);
    expect(screen.getByTestId('section-bar').props['aria-label']).toBe(en.nav.sections);
  });

  it('takes the strip away at once under reduced motion', async () => {
    await renderShell();
    await fireEvent.press(bar().getByTestId('section-item-read'));
    expect(bar().getByTestId('section-drawer-read')).toBeTruthy();
    await fireEvent.press(bar().getByTestId('section-item-read'));
    expect(bar().queryByTestId('section-drawer-read')).toBeNull();
  });

  it('keeps the strip until its closing animation has ended, when motion is allowed', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await renderShell();
    await fireEvent.press(bar().getByTestId('section-item-read'));
    expect(bar().getByTestId('section-drawer-read')).toBeTruthy();
    await fireEvent.press(bar().getByTestId('section-item-read'));
    // The item says it is closed at once; the strip folds for 300 ms and then goes.
    expect(expanded(bar().getByTestId('section-item-read'))).toBe(false);
    await waitFor(() => expect(bar().queryByTestId('section-drawer-read')).toBeNull(), {
      timeout: 2000,
    });
  });
});

describe('MenuDrawer', () => {
  async function openMenu(features: Partial<Features> = {}) {
    await resizeTo(390);
    await renderShell(features);
    await fireEvent.press(screen.getByTestId('menu-button'));
    return within(await screen.findByTestId('menu-drawer'));
  }

  it('holds the interface language, the theme and the links, 304 points wide', async () => {
    const menu = await openMenu();
    expect(menu.getByTestId('menu-language-switch')).toBeTruthy();
    expect(menu.getByText(t.shell.menuLanguage)).toBeTruthy();
    expect(menu.getByText(t.shell.menuTheme)).toBeTruthy();
    expect(menu.getByTestId('menu-link-about')).toBeTruthy();
    expect(menu.getByTestId('menu-link-transparency')).toBeTruthy();
    expect(menu.getByTestId('menu-link-settings')).toBeTruthy();
    // 390 wide window: the panel is 304.
    expect(menu.getByTestId('menu-drawer-panel')).toHaveStyle({ width: 304 });
  });

  it('shows the links of screens that are live, and Settings always', async () => {
    const menu = await openMenu({ about: false, transparency: false });
    expect(menu.queryByTestId('menu-link-about')).toBeNull();
    expect(menu.queryByTestId('menu-link-transparency')).toBeNull();
    expect(menu.getByTestId('menu-link-settings')).toBeTruthy();
  });

  it('follows a link and closes', async () => {
    const menu = await openMenu();
    await fireEvent.press(menu.getByTestId('menu-link-settings'));
    expect(router.push).toHaveBeenCalledWith('/settings');
    // The panel slides away (260 ms) before it is gone.
    await waitFor(() => expect(screen.queryByTestId('menu-drawer-panel')).toBeNull());
  });

  it('closes with the × button and with the scrim', async () => {
    let menu = await openMenu();
    await fireEvent.press(menu.getByTestId('menu-drawer-close'));
    await waitFor(() => expect(screen.queryByTestId('menu-drawer-panel')).toBeNull());

    await fireEvent.press(screen.getByTestId('menu-button'));
    menu = within(await screen.findByTestId('menu-drawer'));
    await fireEvent(
      menu.getByTestId('menu-drawer-scrim', { includeHiddenElements: true }),
      'responderRelease',
    );
    await waitFor(() => expect(screen.queryByTestId('menu-drawer-panel')).toBeNull());
  });

  it('closes when the page changes', async () => {
    await openMenu();
    await act(async () => setMockPathname('/settings'));
    await waitFor(() => expect(screen.queryByTestId('menu-drawer-panel')).toBeNull());
  });

  it('closes when the window grows past 640 points: the wide brand bar has no menu button', async () => {
    await openMenu();
    expect(screen.getByTestId('menu-drawer-panel')).toBeTruthy();
    await resizeTo(1024);
    await waitFor(() => expect(screen.queryByTestId('menu-drawer-panel')).toBeNull());
    expect(screen.queryByTestId('menu-button')).toBeNull();
  });

  it('changes the interface language from the menu', async () => {
    const store = createMemoryStore();
    await resizeTo(390);
    await renderShell({}, { store });
    await fireEvent.press(screen.getByTestId('menu-button'));
    const menu = within(await screen.findByTestId('menu-drawer'));
    await fireEvent.press(menu.getByTestId('language-en'));
    expect(stored(store).uiLanguage).toBe('en');
    expect(await menu.findByText(en.shell.menuLanguage)).toBeTruthy();
  });
});
