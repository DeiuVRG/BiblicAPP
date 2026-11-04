import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Dimensions, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/button';
import { DIALOG_WIDTH, DIALOG_WIDTH_WIDE, Dialog } from '@/components/dialog';
import { useEscapeKey } from '@/components/modal-behaviour';
import { SHEET_MAX_HEIGHT, Sheet, useSheetWidth } from '@/components/sheet';
import { ToastProvider, useToast } from '@/components/toast';
import { palettes } from '@/theme/palettes';
import { createSettingsStore, renderWithProviders } from '@/test-support/render';

const original = Dimensions.get('window');
const light = palettes.light;

beforeEach(() => {
  // No slide, no fade: what is asserted is the state, not the animation.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(async () => {
  await act(async () => {
    Dimensions.set({ window: original });
  });
  jest.restoreAllMocks();
});

/** The `Modal` of the rendered tree: its `onRequestClose` is Escape on web and Back on Android. */
function requestClose() {
  const modal = screen.container.queryAll((instance) => instance.type === 'Modal')[0];
  expect(modal).toBeDefined();
  return modal!.props.onRequestClose as () => void;
}

const HIDDEN = { includeHiddenElements: true };

/** A layer (dialog or sheet) that opens from a button, the way a screen uses it. */
function Layer({
  kind,
  children,
  startOpen = false,
  onClose,
  title = 'Titlu',
  testID,
  width,
}: {
  kind: 'dialog' | 'sheet';
  children: ReactNode;
  startOpen?: boolean;
  onClose?: () => void;
  title?: string;
  testID?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(startOpen);
  const close = () => {
    onClose?.();
    setOpen(false);
  };
  return (
    <>
      <Button title="Deschide" onPress={() => setOpen(true)} />
      {kind === 'dialog' ? (
        <Dialog visible={open} onClose={close} title={title} testID={testID} width={width}>
          {children}
        </Dialog>
      ) : (
        <Sheet visible={open} onClose={close} title={title} testID={testID}>
          {children}
        </Sheet>
      )}
    </>
  );
}

describe('Dialog: render', () => {
  it('renders nothing while it is not visible, and opens from its trigger', async () => {
    await renderWithProviders(
      <Layer kind="dialog" title="Transparență">
        <Text>Corp</Text>
      </Layer>,
    );
    expect(screen.queryByText('Transparență')).toBeNull();
    expect(screen.queryByText('Corp')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Deschide'));
    expect(screen.getByText('Transparență')).toBeTruthy();
    expect(screen.getByText('Corp')).toBeTruthy();
  });

  it('shows its title as a heading and a close button named in the interface language', async () => {
    await renderWithProviders(
      <Layer kind="dialog" startOpen title="Transparență">
        <Text>Corp</Text>
      </Layer>,
    );
    expect(screen.getByText('Transparență').props.accessibilityRole).toBe('header');
    expect(screen.getByLabelText('Închide')).toBeTruthy();
  });

  it('names the close button in English when the interface is English', async () => {
    await renderWithProviders(
      <Layer kind="dialog" startOpen title="Transparency">
        <Text>Body</Text>
      </Layer>,
      { store: createSettingsStore({ uiLanguage: 'en' }) },
    );
    expect(await screen.findByLabelText('Close')).toBeTruthy();
  });

  it('draws the panel in `background` with a 1 px border and a radius of 12, on a scrimDialog backdrop', async () => {
    await renderWithProviders(
      <Layer kind="dialog" startOpen testID="d">
        <Text>Corp</Text>
      </Layer>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('d-panel').props.style)).toMatchObject({
      backgroundColor: light.background,
      borderColor: light.border,
      borderWidth: 1,
      borderRadius: 12,
    });
    expect(StyleSheet.flatten(screen.getByTestId('d-scrim', HIDDEN).props.style)).toMatchObject({
      backgroundColor: light.scrimDialog,
    });
  });

  it('is 480 wide, 560 when asked, and the window less 16 on each side on a phone', async () => {
    expect([DIALOG_WIDTH, DIALOG_WIDTH_WIDE]).toEqual([480, 560]);
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 1024, height: 768 } });
    });
    const widthOf = () => StyleSheet.flatten(screen.getByTestId('d-panel').props.style).width;
    await renderWithProviders(
      <Layer kind="dialog" startOpen testID="d">
        <Text>Corp</Text>
      </Layer>,
    );
    expect(widthOf()).toBe(480);
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 390, height: 844 } });
    });
    expect(widthOf()).toBe(358);
  });

  it('takes the width it is given (Transparency is 560)', async () => {
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 1024, height: 768 } });
    });
    await renderWithProviders(
      <Layer kind="dialog" startOpen testID="d" width={DIALOG_WIDTH_WIDE}>
        <Text>Corp</Text>
      </Layer>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('d-panel').props.style).width).toBe(560);
  });

  it('can carry its name without a visible title', async () => {
    await renderWithProviders(
      <Dialog visible onClose={jest.fn()} accessibilityLabel="Primul răspuns">
        <Text>Corp</Text>
      </Dialog>,
    );
    expect(screen.getByLabelText('Închide')).toBeTruthy();
    expect(screen.getByText('Corp')).toBeTruthy();
  });
});

describe('Dialog: handlers', () => {
  it('closes with the × button', async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <Layer kind="dialog" startOpen onClose={onClose}>
        <Text>Corp</Text>
      </Layer>,
    );
    await fireEvent.press(screen.getByLabelText('Închide'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Corp')).toBeNull();
  });

  it('closes with a tap on the scrim, which is not a tab stop', async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <Layer kind="dialog" startOpen onClose={onClose} testID="d">
        <Text>Corp</Text>
      </Layer>,
    );
    const scrim = screen.getByTestId('d-scrim', HIDDEN);
    expect(scrim.props.onStartShouldSetResponder()).toBe(true);
    expect(scrim.props.accessible).toBe(false);
    await act(async () => {
      scrim.props.onResponderRelease({});
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with Escape on web and Back on Android: both reach `Modal`'s onRequestClose", async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <Layer kind="dialog" startOpen onClose={onClose}>
        <Text>Corp</Text>
      </Layer>,
    );
    await act(async () => {
      requestClose()();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the content pressable while it is open', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Layer kind="dialog" startOpen>
        <Button title="Raportează" onPress={onPress} />
      </Layer>,
    );
    await fireEvent.press(screen.getByLabelText('Raportează'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Sheet: render and handlers', () => {
  it('renders nothing while it is not visible, and shows its title, content and close button when it opens', async () => {
    await renderWithProviders(
      <Layer kind="sheet" title="Paragraful 3">
        <Text>Acțiuni</Text>
      </Layer>,
    );
    expect(screen.queryByText('Acțiuni')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Deschide'));
    expect(await screen.findByText('Acțiuni')).toBeTruthy();
    expect(screen.getByText('Paragraful 3').props.accessibilityRole).toBe('header');
    expect(screen.getByLabelText('Închide')).toBeTruthy();
  });

  it('is full width up to 700, at most 70 % high, rounded by 12 on top, with the bottom safe area as padding', async () => {
    expect(SHEET_MAX_HEIGHT).toBe(0.7);
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 390, height: 844 } });
    });
    await renderWithProviders(
      <Layer kind="sheet" startOpen testID="s">
        <Text>Acțiuni</Text>
      </Layer>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('s-panel').props.style)).toMatchObject({
      width: '100%',
      maxWidth: 700,
      maxHeight: 844 * 0.7,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      backgroundColor: light.background,
      paddingBottom: 0, // the test device has no home indicator
    });
  });

  it('tells a phone from a wider window at 700', async () => {
    function Probe() {
      return <Text testID="narrow">{String(useSheetWidth())}</Text>;
    }
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 700 } });
    });
    await renderWithProviders(<Probe />);
    expect(screen.getByTestId('narrow')).toHaveTextContent('true');
    await act(async () => {
      Dimensions.set({ window: { ...original, width: 701 } });
    });
    expect(screen.getByTestId('narrow')).toHaveTextContent('false');
  });

  it('closes with the × button, a tap on the scrim and Back', async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <Layer kind="sheet" startOpen onClose={onClose} testID="s">
        <Text>Acțiuni</Text>
      </Layer>,
    );
    await act(async () => {
      screen.getByTestId('s-scrim', HIDDEN).props.onResponderRelease({});
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Closed by the scrim: open it again for the other two.
    await fireEvent.press(screen.getByLabelText('Deschide'));
    await fireEvent.press(await screen.findByLabelText('Închide'));
    expect(onClose).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByLabelText('Deschide'));
    await screen.findByText('Acțiuni');
    await act(async () => {
      requestClose()();
    });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('unmounts its content when it closes (instantly under reduced motion)', async () => {
    await renderWithProviders(
      <Layer kind="sheet" startOpen>
        <Text>Acțiuni</Text>
      </Layer>,
    );
    expect(screen.getByText('Acțiuni')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Închide'));
    await act(async () => {});
    expect(screen.queryByText('Acțiuni')).toBeNull();
  });
});

describe('modal layers on web (inert page, focus back to the opener)', () => {
  let root: { setAttribute: jest.Mock; removeAttribute: jest.Mock };
  let opener: { focus: jest.Mock };
  let replaced: { restore(): void };

  beforeEach(() => {
    jest.useFakeTimers();
    root = { setAttribute: jest.fn(), removeAttribute: jest.fn() };
    opener = { focus: jest.fn() };
    (globalThis as { document?: unknown }).document = {
      getElementById: (id: string) => (id === 'root' ? root : null),
      activeElement: opener,
      body: {},
      contains: () => true,
    };
    replaced = jest.replaceProperty(Platform, 'OS', 'web');
  });

  afterEach(() => {
    replaced.restore();
    delete (globalThis as { document?: unknown }).document;
    jest.useRealTimers();
  });

  it('makes the page inert while a dialog is open and gives the focus back when it closes', async () => {
    await renderWithProviders(
      <Layer kind="dialog" startOpen>
        <Text>Corp</Text>
      </Layer>,
    );
    expect(root.setAttribute).toHaveBeenCalledWith('inert', '');
    expect(root.removeAttribute).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Închide'));
    expect(root.removeAttribute).toHaveBeenCalledWith('inert');
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    expect(opener.focus).toHaveBeenCalledTimes(1);
  });

  it('keeps the page inert until the last layer is gone', async () => {
    function Two() {
      const [a, setA] = useState(true);
      const [b, setB] = useState(true);
      return (
        <>
          <Dialog visible={a} onClose={() => setA(false)} title="A">
            <Text>A</Text>
          </Dialog>
          <Sheet visible={b} onClose={() => setB(false)} title="B">
            <Text>B</Text>
          </Sheet>
        </>
      );
    }
    await renderWithProviders(<Two />);
    const closes = screen.getAllByLabelText('Închide');
    expect(closes).toHaveLength(2);
    await fireEvent.press(closes[0]!);
    expect(root.removeAttribute).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Închide'));
    expect(root.removeAttribute).toHaveBeenCalledWith('inert');
  });

  it('does nothing on iOS and Android', async () => {
    replaced.restore();
    await renderWithProviders(
      <Layer kind="dialog" startOpen>
        <Text>Corp</Text>
      </Layer>,
    );
    expect(root.setAttribute).not.toHaveBeenCalled();
    replaced = jest.replaceProperty(Platform, 'OS', 'web');
  });
});

describe('useEscapeKey', () => {
  const listeners = new Map<string, (event: { key: string }) => void>();
  let replaced: { restore(): void };

  beforeEach(() => {
    listeners.clear();
    (globalThis as { document?: unknown }).document = {
      addEventListener: (type: string, listener: (event: { key: string }) => void) =>
        listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    replaced = jest.replaceProperty(Platform, 'OS', 'web');
  });

  afterEach(() => {
    replaced.restore();
    delete (globalThis as { document?: unknown }).document;
  });

  /** A panel that closes with Escape, with the handler written inline, as a screen would. */
  function Panel() {
    const [open, setOpen] = useState(false);
    const [closed, setClosed] = useState(0);
    useEscapeKey(open, () => {
      setOpen(false);
      setClosed(closed + 1);
    });
    return (
      <>
        <Button title="Deschide" onPress={() => setOpen(true)} />
        <Text testID="state">{`${open ? 'open' : 'closed'} ${closed}`}</Text>
      </>
    );
  }

  it('listens only while it is active, and only for Escape', async () => {
    await renderWithProviders(<Panel />);
    expect(listeners.has('keydown')).toBe(false);
    await fireEvent.press(screen.getByLabelText('Deschide'));
    expect(listeners.has('keydown')).toBe(true);
    await act(async () => listeners.get('keydown')!({ key: 'a' }));
    expect(screen.getByTestId('state')).toHaveTextContent('open 0');
    await act(async () => listeners.get('keydown')!({ key: 'Escape' }));
    expect(screen.getByTestId('state')).toHaveTextContent('closed 1');
    expect(listeners.has('keydown')).toBe(false);
  });

  it('always calls the latest handler, so an inline function is fine', async () => {
    await renderWithProviders(<Panel />);
    // Open, close and open again: the count the handler adds to is the current one each time.
    for (const expected of ['closed 1', 'closed 2']) {
      await fireEvent.press(screen.getByLabelText('Deschide'));
      await act(async () => listeners.get('keydown')!({ key: 'Escape' }));
      expect(screen.getByTestId('state')).toHaveTextContent(expected);
    }
  });

  it('does nothing on iOS and Android', async () => {
    replaced.restore();
    await renderWithProviders(<Panel />);
    await fireEvent.press(screen.getByLabelText('Deschide'));
    expect(listeners.has('keydown')).toBe(false);
    replaced = jest.replaceProperty(Platform, 'OS', 'web');
  });
});

describe('Toast', () => {
  function Trigger({ message = 'Link copiat.' }: { message?: string }) {
    const toast = useToast();
    return <Button title="Copiază" onPress={() => toast.show(message)} />;
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps an empty status region in the page, so that a screen reader sees the text arrive', async () => {
    await renderWithProviders(<Trigger />);
    const region = screen.getByTestId('toast');
    expect(region.props.role).toBe('status');
    expect(region.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.queryByTestId('toast-message')).toBeNull();
  });

  it('shows the message when asked and takes it away after 3 seconds', async () => {
    await renderWithProviders(<Trigger />);
    await fireEvent.press(screen.getByLabelText('Copiază'));
    expect(screen.getByText('Link copiat.')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(2900);
    });
    expect(screen.getByText('Link copiat.')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Link copiat.')).toBeNull();
  });

  it('writes the message in `meta` on an ink pill, as a status line at the bottom', async () => {
    await renderWithProviders(<Trigger />);
    await fireEvent.press(screen.getByLabelText('Copiază'));
    expect(screen.getByText('Link copiat.')).toHaveStyle({ color: light.background, fontSize: 14 });
    expect(StyleSheet.flatten(screen.getByTestId('toast').props.style)).toMatchObject({
      position: 'absolute',
      bottom: 24,
    });
  });

  it('replaces the message on screen with a new one and starts the 3 seconds again', async () => {
    function Two() {
      const toast = useToast();
      return (
        <>
          <Button title="Unu" onPress={() => toast.show('Primul')} />
          <Button title="Doi" onPress={() => toast.show('Al doilea')} />
        </>
      );
    }
    await renderWithProviders(<Two />);
    await fireEvent.press(screen.getByLabelText('Unu'));
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await fireEvent.press(screen.getByLabelText('Doi'));
    expect(screen.queryByText('Primul')).toBeNull();
    expect(screen.getByText('Al doilea')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('Al doilea')).toBeTruthy(); // 2 s after the second message, not the first
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('Al doilea')).toBeNull();
  });

  it('announces the message out loud on iOS, where a live region is not read on its own', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    await renderWithProviders(<Trigger />);
    await fireEvent.press(screen.getByLabelText('Copiază'));
    expect(announce).toHaveBeenCalledWith('Link copiat.');
  });

  it('can be used from a screen that is rendered outside the app providers (a no-op)', async () => {
    function Alone() {
      const toast = useToast();
      toast.show('x');
      return <Text>ok</Text>;
    }
    await render(<Alone />);
    expect(screen.getByText('ok')).toBeTruthy();
    expect(ToastProvider).toBeDefined();
  });
});
