import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, Text } from 'react-native';

import { pressStyle } from '@/components/press';
import { useCoarsePointer } from '@/theme/pointer';
import { useReducedMotion } from '@/theme/reduced-motion';
import { stubMatchMedia } from '@/test-support/match-media';

const REDUCE = '(prefers-reduced-motion: reduce)';
const COARSE = '(pointer: coarse)';

afterEach(() => jest.restoreAllMocks());

describe('pressStyle (pressed = scale(.96) on web and opacity 0.7 on native, docs/ui-spec-v2.md 2.6)', () => {
  it('dims on native and does not move', () => {
    expect(pressStyle(true, false)).toEqual([{ opacity: 0.7 }]);
    expect(pressStyle(false, false)).toEqual([{ opacity: 1 }]);
  });

  describe('on web', () => {
    let replaced: { restore(): void };
    beforeEach(() => {
      replaced = jest.replaceProperty(Platform, 'OS', 'web');
    });
    afterEach(() => replaced.restore());

    it('shrinks to 96 % while pressed and leaves the opacity alone', () => {
      const pressed = pressStyle(true, false);
      expect(pressed[0]).toEqual({ transform: [{ scale: 0.96 }] });
      expect(JSON.stringify(pressed)).not.toContain('opacity');
      expect(pressStyle(false, false)[0]).toEqual({});
    });

    it('eases the change over the press duration, except under reduced motion', () => {
      expect(pressStyle(true, false)[1]).toMatchObject({
        transitionProperty: 'transform',
        transitionDuration: '140ms',
      });
      expect(pressStyle(true, true)).toEqual([{ transform: [{ scale: 0.96 }] }]);
    });
  });
});

describe('useReducedMotion', () => {
  function Probe() {
    return <Text testID="reduced">{String(useReducedMotion())}</Text>;
  }

  it('knows on web at the first render, without waiting for the platform to answer', async () => {
    const restore = stubMatchMedia({ [REDUCE]: true });
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
    try {
      await render(<Probe />);
      expect(screen.getByTestId('reduced')).toHaveTextContent('true');
    } finally {
      replaced.restore();
      restore();
    }
  });

  it('is false on web when the user did not ask for it, or when the browser cannot say', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const restore = stubMatchMedia({ [REDUCE]: false });
      await render(<Probe />);
      expect(screen.getByTestId('reduced')).toHaveTextContent('false');
      restore();
      // No matchMedia at all.
      await render(<Probe />);
      expect(screen.getByTestId('reduced')).toHaveTextContent('false');
    } finally {
      replaced.restore();
    }
  });

  it('starts as false on iOS and Android and follows the platform when it answers', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<Probe />);
    await act(async () => {});
    expect(screen.getByTestId('reduced')).toHaveTextContent('true');
  });

  it('follows a change of the setting while the app runs', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    let notify: (value: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (value: boolean) => void,
    ) => {
      notify = handler;
      return { remove: () => {} };
    }) as never);
    await render(<Probe />);
    expect(screen.getByTestId('reduced')).toHaveTextContent('false');
    await act(async () => notify(true));
    expect(screen.getByTestId('reduced')).toHaveTextContent('true');
  });
});

describe('useCoarsePointer', () => {
  function Probe() {
    return <Text testID="coarse">{String(useCoarsePointer())}</Text>;
  }

  it('is always true on iOS and Android: the pointer there is a finger', async () => {
    await render(<Probe />);
    expect(screen.getByTestId('coarse')).toHaveTextContent('true');
  });

  it('reads `(pointer: coarse)` on web', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const mouse = stubMatchMedia({ [COARSE]: false });
      await render(<Probe />);
      expect(screen.getByTestId('coarse')).toHaveTextContent('false');
      mouse();
      const finger = stubMatchMedia({ [COARSE]: true });
      await render(<Probe />);
      expect(screen.getByTestId('coarse')).toHaveTextContent('true');
      finger();
    } finally {
      replaced.restore();
    }
  });

  it('follows the pointer when it changes (a keyboard dock, a tablet used with a mouse)', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    const media = stubMatchMedia({ [COARSE]: false });
    try {
      await render(<Probe />);
      expect(screen.getByTestId('coarse')).toHaveTextContent('false');
      await act(async () => media.change(COARSE, true));
      expect(screen.getByTestId('coarse')).toHaveTextContent('true');
    } finally {
      replaced.restore();
      media();
    }
  });

  it('is false on web when the browser cannot say', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      await render(<Probe />);
      expect(screen.getByTestId('coarse')).toHaveTextContent('false');
    } finally {
      replaced.restore();
    }
  });
});
