import type { Paragraph } from '@biblioteca/shared';
import { act } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { ReaderParagraph, TARGET_FADE_MS } from '@/features/reader/reader-paragraph';
import { renderWithProviders } from '@/test-support/render';

const paragraph: Paragraph = {
  id: 'p1',
  sectionId: 's1',
  ordinal: 0,
  kind: 'p',
  text: 'Împărăția lui Dumnezeu este aproape.',
};

afterEach(() => jest.restoreAllMocks());

describe('the paragraph a link jumped to', () => {
  const target = () =>
    renderWithProviders(
      <ReaderParagraph paragraph={paragraph} fontSize={18} lineHeight={1.6} isTarget />,
    );

  it('fades its background in over 300 ms, the duration of the motion token', async () => {
    expect(TARGET_FADE_MS).toBe(300);
    const timing = jest.spyOn(Animated, 'timing');
    await target();
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, duration: 300 }),
    );
  });

  it('sets its background at once under reduced motion, instead of fading it', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    await target();
    await act(async () => {});
    // The platform answers a moment after the first render; the value then jumps to 1.
    expect(setValue).toHaveBeenCalledWith(1);
  });
});
