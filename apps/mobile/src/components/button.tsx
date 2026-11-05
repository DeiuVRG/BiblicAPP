import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, StyleProp, TextStyle, ViewStyle } from 'react-native';

import { UI_MAX_FONT_SCALE, useTypeStyle } from '@/components/app-text';
import { isDarkBand, isPhotoBand, useBandTone, useLinkTone } from '@/components/band-context';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { useLayout } from '@/theme/layout';
import { useCoarsePointer } from '@/theme/pointer';
import { useTheme } from '@/theme/theme-context';
import { useReducedMotion } from '@/theme/reduced-motion';
import { duration, easing, motion, radii, transition } from '@/theme/tokens';

/** Minimum touch target (44pt) following platform guidance. */
export const MIN_TARGET = 44;
/** The primary button is taller on a phone. */
const PRIMARY_PHONE_HEIGHT = 48;
/** The small button (the "Întreabă" of the brand bar) is this high for a mouse on a wide screen. */
const SMALL_HEIGHT = 36;
/** Side padding of a small button: a text one at the edge of a bar is pulled back by this much. */
export const SMALL_PADDING = 14;
/** How far the arrow of a "NAME ›" link moves on hover. */
const ARROW_SHIFT = 3;

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'text' | 'pill';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  /**
   * `primary`: `accentStrong` fill. `outline`: 1 px `borderStrong`; on hover a fill sweeps in.
   * `ghost`: for dark bands (an `outline` inside a `masthead` band becomes one). `text`: an
   * underlined link. `pill`: a round filled button (account forms).
   */
  variant?: ButtonVariant;
  /** Accessible name; defaults to `title`. */
  label?: string;
  /** For a button that opens and closes something: whether it is open (`aria-expanded` on web). */
  expanded?: boolean;
  /** The label becomes "…", the button reports `aria-busy` and ignores presses. */
  loading?: boolean;
  /** "NAME ›": the label is followed by an arrow that moves 3 px on hover. */
  arrow?: boolean;
  /**
   * `small` is for a bar (the brand bar): 36 high for a mouse on a wide screen and the 44 point
   * target for a finger and on a phone, with less padding. The look is the same.
   */
  size?: 'regular' | 'small';
  /** The label is a glyph or a sample ("×", "−", "Aa"): no capitals, no tracking, no underline. */
  glyph?: boolean;
  /** Layout of the button itself (must be a plain style: `Link asChild` merges it). */
  style?: ViewStyle;
  /**
   * Overrides for the title text: a font, a size, a colour. They are applied last, so a colour here
   * replaces the variant's own (hover included); keep the 4.5:1 of the surface it sits on.
   */
  textStyle?: StyleProp<TextStyle>;
}

/**
 * A button on the `button` type style: radius 3, at least 44 high (48 for the primary on a
 * phone). Hover (web) changes colour, never layout; pressed is `scale(.96)` on web and opacity 0.7
 * on native; the focus ring is the page's (web) or an outline (native); disabled is 60 % opacity.
 * Inside a `masthead` band the colours switch to the dark-band inks by themselves.
 */
export function Button({
  title,
  variant = 'outline',
  label,
  expanded,
  loading = false,
  arrow = false,
  size = 'regular',
  glyph = false,
  disabled,
  onPress,
  style,
  textStyle,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const band = useBandTone();
  const dark = isDarkBand(band);
  // Links are the ink where the band is a picture, and in a hero (whose links are always the ink).
  const inkLinks = useLinkTone() === 'ink' || isPhotoBand(band);
  const { wide } = useLayout();
  const coarse = useCoarsePointer();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const text = useTypeStyle('button');
  const hover = hovered && !disabled && !loading;

  // On a dark band an outline button is a ghost one.
  const visual: ButtonVariant = dark && variant === 'outline' ? 'ghost' : variant;
  const filled = visual === 'primary' || visual === 'pill';
  const outline = visual === 'outline';
  const ghost = visual === 'ghost';
  const link = visual === 'text';

  // One value drives every hover effect: the sweep of the outline fill, the colour of its label
  // and the arrow of a "NAME ›" link.
  const [hoverValue] = useState(() => new Animated.Value(0));
  // Nothing animates until the pointer actually enters or leaves.
  const hoverBefore = useRef(false);
  useEffect(() => {
    if (hoverBefore.current === hover) return undefined;
    hoverBefore.current = hover;
    if (reduced) {
      hoverValue.setValue(hover ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(hoverValue, {
      toValue: hover ? 1 : 0,
      duration: outline ? motion.outlineSweep : duration.base,
      easing: Easing.bezier(...easing.default),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [hover, hoverValue, outline, reduced]);

  const linkColor = dark
    ? inkLinks
      ? colors.mastheadInk
      : colors.mastheadAccent
    : colors.accentStrong;
  const linkHover = dark
    ? inkLinks
      ? colors.mastheadAccent
      : colors.mastheadInk
    : colors.accentHover;
  const labelColor = filled
    ? colors.onAccent
    : ghost
      ? colors.mastheadInk
      : link
        ? hover
          ? linkHover
          : linkColor
        : colors.text;
  // Only the outline label changes colour together with the sweep that runs under it.
  const animatedColor: Animated.AnimatedInterpolation<string> | string = outline
    ? hoverValue.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.text, colors.onAccent],
      })
    : labelColor;

  const small = size === 'small';
  const height = small
    ? wide && !coarse
      ? SMALL_HEIGHT
      : MIN_TARGET
    : filled && !wide
      ? PRIMARY_PHONE_HEIGHT
      : MIN_TARGET;
  const busy = loading;
  const caption = loading ? '…' : title;

  const labelStyle = [
    text,
    styles.centered,
    glyph ? styles.glyph : null,
    link && !glyph ? styles.underline : null,
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{
        disabled: !!disabled,
        busy,
        ...(expanded === undefined ? null : { expanded }),
      }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-expanded={expanded}
      aria-busy={busy || undefined}
      // A button that is busy takes no presses; it says "busy", and "disabled" only if it is.
      disabled={disabled || busy}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          paddingHorizontal: small ? SMALL_PADDING : link ? 16 : 20,
          borderRadius: visual === 'pill' ? radii.pill : ghost ? radii.md : radii.sm,
          backgroundColor: filled ? (hover ? colors.accentHover : colors.accentStrong) : undefined,
          borderWidth: filled || link ? 0 : 1,
          borderColor: outline
            ? colors.borderStrong
            : ghost
              ? hover
                ? colors.mastheadInk
                : colors.mastheadBorder
              : undefined,
          opacity: disabled ? 0.6 : Platform.OS === 'web' ? 1 : pressed ? motion.pressOpacity : 1,
          ...(Platform.OS === 'web' && pressed && !disabled
            ? { transform: [{ scale: motion.pressScale }] }
            : null),
        },
        transition('transform, opacity', duration.press, 'default', reduced),
        focusStyle,
        style,
      ]}
    >
      {outline ? (
        // The fill sweeps from left to right; the button clips it to its rounded corners.
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweep,
            {
              backgroundColor: colors.accentStrong,
              transform: [{ scaleX: hoverValue }],
              transformOrigin: 'left center',
            } as object,
          ]}
        />
      ) : null}
      <View style={styles.row}>
        <Animated.Text
          maxFontSizeMultiplier={UI_MAX_FONT_SCALE}
          style={[labelStyle, { color: animatedColor }, textStyle] as StyleProp<TextStyle>}
        >
          {caption}
        </Animated.Text>
        {arrow ? (
          <Animated.Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            maxFontSizeMultiplier={UI_MAX_FONT_SCALE}
            style={
              [
                labelStyle,
                styles.arrow,
                {
                  color: animatedColor,
                  transform: [
                    {
                      translateX: hoverValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, ARROW_SHIFT],
                      }),
                    },
                  ],
                },
                textStyle,
              ] as StyleProp<TextStyle>
            }
          >
            ›
          </Animated.Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: MIN_TARGET,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sweep: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  centered: { textAlign: 'center' },
  glyph: { textTransform: 'none', letterSpacing: 0 },
  underline: { textDecorationLine: 'underline' },
  arrow: { textDecorationLine: 'none' },
});
