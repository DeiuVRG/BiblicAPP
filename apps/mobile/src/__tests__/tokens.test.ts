import { Platform } from 'react-native';

import { palettes } from '@/theme/palettes';
import {
  BAR_HEIGHT,
  FOCUS_RING,
  cssEasing,
  duration,
  easing,
  elevationStyle,
  motion,
  radii,
  shadowFor,
  spacing,
  transition,
} from '@/theme/tokens';

describe('tokens (docs/ui-spec-v2.md, sections 2.4 to 2.6)', () => {
  it('has the radii of the spec', () => {
    expect(radii).toEqual({ xs: 2, sm: 3, md: 6, lg: 12, xl: 14, pill: 999 });
  });

  it('has the spacing scale of the spec', () => {
    expect(spacing).toEqual([4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 88]);
  });

  it('has the bar heights of the spec', () => {
    expect(BAR_HEIGHT).toEqual({
      brand: 64,
      brandPhone: 56,
      section: 48,
      sectionPhone: 44,
      readerToolbar: 67,
      readerToolbarPhone: 53,
      thumb: 61,
      progress: 3,
    });
  });

  it('draws the focus ring 2 px wide with an offset of 2', () => {
    expect(FOCUS_RING).toEqual({ width: 2, offset: 2 });
  });

  it('has three durations and three easings', () => {
    expect(duration).toEqual({ press: 140, base: 200, slow: 300 });
    expect(cssEasing('default')).toBe('cubic-bezier(0.22,1,0.36,1)');
    expect(cssEasing('panel')).toBe('cubic-bezier(0.32,0.72,0,1)');
    expect(cssEasing('entrance')).toBe('cubic-bezier(0.23,1,0.32,1)');
    expect(Object.keys(easing)).toEqual(['default', 'panel', 'entrance']);
  });

  it('names the specific motions: press, drawer, hero sweep, pulse, shimmer, fade, dots', () => {
    expect(motion.pressScale).toBe(0.96);
    expect(motion.pressOpacity).toBe(0.7);
    expect(motion.outlineSweep).toBe(280);
    expect(motion.drawer).toBe(300);
    expect(motion.heroSweepDelay).toBe(250);
    expect(motion.heroSweep).toBe(550);
    expect(motion.kickerPulse).toBe(2400);
    expect(motion.shimmer).toBe(2400);
    expect(motion.targetFade).toBe(300);
    expect(motion.askDots).toBe(1400);
    expect(motion.toast).toBe(3000);
  });

  describe('transitions', () => {
    it('are CSS transitions on web, with the curve of the token', () => {
      const replaced = jest.replaceProperty(Platform, 'OS', 'web');
      try {
        expect(transition('transform, opacity', duration.press)).toEqual({
          transitionProperty: 'transform, opacity',
          transitionDuration: '140ms',
          transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
        });
        expect(transition('width', 300, 'panel')).toMatchObject({
          transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)',
        });
        // Reduced motion: state changes are instant.
        expect(transition('transform', 140, 'default', true)).toBeUndefined();
      } finally {
        replaced.restore();
      }
    });

    it('are nothing on iOS and Android', () => {
      expect(transition('transform', 140)).toBeUndefined();
    });
  });

  describe('elevation', () => {
    const { light, dark } = palettes;

    it('writes the shadows of the spec from the derived tokens', () => {
      expect(shadowFor('card', light)).toBe(
        `0 1px 2px ${light.shadowEdge}, 0 6px 20px ${light.shadowSoft}`,
      );
      expect(shadowFor('popover', light)).toBe(`0 10px 28px ${light.shadowPopover}`);
      expect(shadowFor('dialog', dark)).toBe(`0 24px 60px ${dark.shadowDialog}`);
      expect(shadowFor('drawer', light)).toBe(`0 14px 28px -18px ${light.shadowDrawer}`);
    });

    it('is a box shadow on web', () => {
      const replaced = jest.replaceProperty(Platform, 'OS', 'web');
      try {
        expect(elevationStyle('dialog', light)).toEqual({ boxShadow: shadowFor('dialog', light) });
      } finally {
        replaced.restore();
      }
    });

    it('is a plain border on native, with `elevation: 2` on popovers only', () => {
      expect(elevationStyle('dialog', light)).toEqual({});
      expect(elevationStyle('card', light)).toEqual({});
      expect(elevationStyle('popover', light)).toEqual({ elevation: 2 });
    });
  });
});
