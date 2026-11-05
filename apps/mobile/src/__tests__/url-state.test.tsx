import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, Text, TextInput } from 'react-native';

import { COMMIT_DELAY_MS, useCommittedText } from '@/hooks/use-committed-text';
import { queryString, replaceUrlParams, useUrlState } from '@/hooks/use-url-state';
import { resetMockRouter, setMockParams } from '@/test-support/expo-router-mock';

jest.mock('expo-router', () => jest.requireActual('@/test-support/expo-router-mock'));

beforeEach(() => {
  resetMockRouter();
});

function stubLocation(pathname = '/library/all', hash = '') {
  const replaceState = jest.fn();
  const target = globalThis as unknown as Record<string, unknown>;
  target.location = { pathname, hash };
  target.history = { state: { key: 1 }, replaceState };
  return {
    replaceState,
    restore() {
      delete target.location;
      delete target.history;
    },
  };
}

describe('queryString', () => {
  it('percent-encodes keys and values, a space as %20 and never as "+"', () => {
    expect(queryString({ q: 'toma d’aquino', shelf: 'fathers' })).toBe(
      `q=${encodeURIComponent('toma d’aquino')}&shelf=fathers`,
    );
    expect(queryString({ q: 'a b' })).toBe('q=a%20b');
    expect(queryString({ 'a&b': 'c=d' })).toBe('a%26b=c%3Dd');
    expect(queryString({})).toBe('');
  });
});

describe('replaceUrlParams', () => {
  it('writes the query string of the page on web, keeping the path and the hash, as a replacement', () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    const location = stubLocation('/app/library/all', '#top');
    try {
      replaceUrlParams({ shelf: 'fathers', century: '5' });
      expect(location.replaceState).toHaveBeenCalledWith(
        { key: 1 },
        '',
        '/app/library/all?shelf=fathers&century=5#top',
      );
      replaceUrlParams({});
      expect(location.replaceState).toHaveBeenLastCalledWith(
        { key: 1 },
        '',
        '/app/library/all#top',
      );
    } finally {
      location.restore();
      replaced.restore();
    }
  });

  it('does nothing on iOS and Android', () => {
    const location = stubLocation();
    try {
      replaceUrlParams({ shelf: 'fathers' });
      expect(location.replaceState).not.toHaveBeenCalled();
    } finally {
      location.restore();
    }
  });

  it('survives a browser that refuses, and a page without a location', () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    const location = stubLocation();
    try {
      location.replaceState.mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(() => replaceUrlParams({ q: 'x' })).not.toThrow();
      location.restore();
      expect(() => replaceUrlParams({ q: 'x' })).not.toThrow();
    } finally {
      replaced.restore();
    }
  });
});

type Params = Record<string, string | string[] | undefined>;
const parse = (params: Params) => ({ tab: typeof params.tab === 'string' ? params.tab : 'one' });
const serialize = (value: { tab: string }): Record<string, string> =>
  value.tab === 'one' ? {} : { tab: value.tab };

function Tabs() {
  const [state, setState] = useUrlState(parse, serialize);
  return (
    <>
      <Text testID="tab">{state.tab}</Text>
      <Text testID="two" onPress={() => setState({ tab: 'two' })}>
        two
      </Text>
      <Text testID="bump" onPress={() => setState((previous) => ({ tab: `${previous.tab}!` }))}>
        bump
      </Text>
    </>
  );
}

describe('useUrlState', () => {
  it('starts from the params of the route', async () => {
    setMockParams({ tab: 'three' });
    await render(<Tabs />);
    expect(screen.getByTestId('tab')).toHaveTextContent('three');
  });

  it('starts from the default when the route has nothing', async () => {
    await render(<Tabs />);
    expect(screen.getByTestId('tab')).toHaveTextContent('one');
  });

  it('keeps a change in the screen and takes an updater function', async () => {
    await render(<Tabs />);
    await fireEvent.press(screen.getByTestId('two'));
    expect(screen.getByTestId('tab')).toHaveTextContent('two');
    await fireEvent.press(screen.getByTestId('bump'));
    expect(screen.getByTestId('tab')).toHaveTextContent('two!');
  });

  it('mirrors the state into the address on web, defaults left out', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    const location = stubLocation('/library/all');
    try {
      await render(<Tabs />);
      expect(location.replaceState).toHaveBeenLastCalledWith({ key: 1 }, '', '/library/all');
      await fireEvent.press(screen.getByTestId('two'));
      expect(location.replaceState).toHaveBeenLastCalledWith(
        { key: 1 },
        '',
        '/library/all?tab=two',
      );
    } finally {
      location.restore();
      replaced.restore();
    }
  });

  it('lets a change of the params of the route (a link to the same page) replace the state', async () => {
    await render(<Tabs />);
    await fireEvent.press(screen.getByTestId('two'));
    await act(async () => setMockParams({ tab: 'elsewhere' }));
    expect(screen.getByTestId('tab')).toHaveTextContent('elsewhere');
  });

  it('does not let its own writing come back as a change from outside', async () => {
    await render(<Tabs />);
    await fireEvent.press(screen.getByTestId('two'));
    // The same value arrives as a param (the router echoes what was written): nothing changes.
    await act(async () => setMockParams({ tab: 'two' }));
    expect(screen.getByTestId('tab')).toHaveTextContent('two');
  });
});

function Field({ committed, onCommit }: { committed: string; onCommit: (text: string) => void }) {
  const [text, setText] = useCommittedText(committed, onCommit);
  return <TextInput testID="field" value={text} onChangeText={setText} />;
}

describe('useCommittedText', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const type = (text: string) => fireEvent.changeText(screen.getByTestId('field'), text);
  const wait = (ms: number) => act(async () => jest.advanceTimersByTime(ms));

  it('shows what is typed at once and commits the trimmed text after the delay', async () => {
    const onCommit = jest.fn();
    await render(<Field committed="" onCommit={onCommit} />);
    await type('  calvin ');
    expect(screen.getByTestId('field').props.value).toBe('  calvin ');
    expect(onCommit).not.toHaveBeenCalled();
    await wait(COMMIT_DELAY_MS - 1);
    expect(onCommit).not.toHaveBeenCalled();
    await wait(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('calvin');
  });

  it('commits only the last text of a burst of keys', async () => {
    const onCommit = jest.fn();
    await render(<Field committed="" onCommit={onCommit} />);
    await type('c');
    await wait(100);
    await type('ca');
    await wait(100);
    await type('cal');
    await wait(COMMIT_DELAY_MS);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('cal');
  });

  it('commits nothing when the text is what is already committed', async () => {
    const onCommit = jest.fn();
    await render(<Field committed="calvin" onCommit={onCommit} />);
    await type('calvin ');
    await wait(COMMIT_DELAY_MS * 2);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('follows the committed value when it changes from outside', async () => {
    const onCommit = jest.fn();
    const view = await render(<Field committed="calvin" onCommit={onCommit} />);
    expect(screen.getByTestId('field').props.value).toBe('calvin');
    await view.rerender(<Field committed="" onCommit={onCommit} />);
    expect(screen.getByTestId('field').props.value).toBe('');
    await wait(COMMIT_DELAY_MS * 2);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('keeps what was typed when the committed value is the trimmed form of it', async () => {
    const onCommit = jest.fn();
    const view = await render(<Field committed="" onCommit={onCommit} />);
    await type('calvin ');
    await wait(COMMIT_DELAY_MS);
    await view.rerender(<Field committed="calvin" onCommit={onCommit} />);
    // The trailing space is the reader's: the field is not rewritten under their fingers.
    expect(screen.getByTestId('field').props.value).toBe('calvin ');
  });
});
