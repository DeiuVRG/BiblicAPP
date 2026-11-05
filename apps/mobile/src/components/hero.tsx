import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType, ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import type { TextVariant } from '@/components/app-text';
import { Band } from '@/components/band';
import { LinkToneProvider } from '@/components/band-context';
import { Chip } from '@/components/chip';
import { heroPadding, useLayout } from '@/theme/layout';
import type { HeroKind } from '@/theme/layout';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { easing, motion } from '@/theme/tokens';

/** The sub line of a hero is at most this wide. */
const SUB_MAX_WIDTH = 527;

interface HighlightedLineProps {
  children: string;
  /** The type of the line: `displayXL` on the landing, `displayL` on the other heroes. */
  variant?: TextVariant;
  /** Turns the sweep off: the bar is simply there. */
  still?: boolean;
  testID?: string;
}

/**
 * A line of display type with a bar of `accentBar` (the `accent` at 78 %) that sweeps in behind it
 * from the left, over 550 ms after a delay of 250 ms, once. Under reduced motion the bar is just
 * there, from the first frame. The bar sits behind large light text (3:1 holds, also over a white
 * photograph under the scrim: `theme.test.ts`).
 *
 * The line must be a short phrase that fits on one line at the narrowest phone width (320): the
 * bar is one rectangle as wide as the text block, so a line that wraps would get a slab with empty
 * bar to the right of its last line. (A bar per line needs the width of each wrapped line, and
 * react-native-web has no `onTextLayout`.) The line is plain text: the heading is the hero's title.
 */
export function HighlightedLine({
  children,
  variant = 'displayXL',
  still = false,
  testID = 'hero-highlight',
}: HighlightedLineProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const staticBar = still || reduced;
  const [sweep] = useState(() => new Animated.Value(staticBar ? 1 : 0));
  useEffect(() => {
    if (staticBar) {
      sweep.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(sweep, {
      toValue: 1,
      duration: motion.heroSweep,
      delay: motion.heroSweepDelay,
      easing: Easing.bezier(...easing.default),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [staticBar, sweep]);
  return (
    <View style={styles.line}>
      <Animated.View
        testID={testID}
        pointerEvents="none"
        style={
          [
            styles.bar,
            {
              backgroundColor: colors.accentBar,
              transform: [{ scaleX: sweep }],
              transformOrigin: 'left center',
            },
          ] as unknown as ViewStyle
        }
      />
      <AppText variant={variant} heading={false} style={styles.lineText}>
        {children}
      </AppText>
    </View>
  );
}

interface HeroProps {
  /** The small line above the title ("¶ BIBLIOTECA"); the pilcrow pulses. */
  kicker?: string;
  /** A small bordered pill after the kicker ("BETA"). */
  badge?: string;
  /**
   * The H1: one string, or two lines of which the second carries the highlight bar (the second
   * line must fit on one line at 320 points, see `HighlightedLine`).
   */
  title: string | readonly [string, string];
  /** The sentence under the title. */
  sub?: string;
  /** The buttons, side by side on wide screens and stacked on a phone. */
  actions?: ReactNode;
  /** The text links under the buttons. */
  links?: ReactNode;
  /** The background picture; without one the hero is the flat `masthead`. */
  image?: ImageSourcePropType;
  /** Padding and title size: the landing, an inner page or the library hero. */
  kind?: HeroKind;
  testID?: string;
}

/**
 * The top of a page: a kicker, the H1, a sub line and buttons on `masthead`, optionally over a
 * picture under a scrim. All text uses the dark-band inks; over a picture the kicker, the pilcrow,
 * the badge and the links are the ink too (the orange accent reaches only 2.1:1 against a white
 * pixel under the scrim), the band is a `photo` band. Without a picture, or while it loads, the
 * hero is the flat `masthead` colour with the same type. The title is the one heading (`h1`) of
 * the hero: its lines are plain text inside it.
 */
export function Hero({
  kicker,
  badge,
  title,
  sub,
  actions,
  links,
  image,
  kind = 'landing',
  testID = 'hero',
}: HeroProps) {
  const { wide } = useLayout();
  const reduced = useReducedMotion();
  const lines = typeof title === 'string' ? [title] : [...title];
  const titleVariant = kind === 'landing' ? 'displayXL' : 'displayL';
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!kicker || reduced) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: motion.kickerPulse / 2,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: motion.kickerPulse / 2,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [kicker, reduced, pulse]);

  return (
    <View testID={testID} style={styles.hero}>
      {image ? <HeroImage source={image} /> : null}
      <Band
        tone={image ? 'photo' : 'masthead'}
        container="wide"
        padding={heroPadding(kind, wide)}
        testID={`${testID}-band`}
        style={image ? styles.overImage : undefined}
      >
        <View style={styles.content}>
          {kicker ? (
            <View style={styles.kickerRow}>
              <View style={styles.kickerText}>
                <Animated.View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{ opacity: pulse }}
                >
                  <AppText variant="kicker">¶</AppText>
                </Animated.View>
                <AppText variant="kicker">{kicker}</AppText>
              </View>
              {badge ? <Chip status label={badge} /> : null}
            </View>
          ) : null}
          <View
            testID={`${testID}-title`}
            accessibilityRole="header"
            // The heading groups its lines (react-native-web renders it as one h1; on native it is
            // one element for a screen reader, which would otherwise read the lines apart). On web
            // `accessible` would make it a tab stop, so it is native only.
            {...(Platform.OS === 'web' ? null : { accessible: true })}
            {...({ 'aria-level': 1 } as object)}
            style={styles.title}
          >
            {lines.map((line, index) =>
              index === 1 ? (
                <HighlightedLine key={line} variant={titleVariant}>
                  {line}
                </HighlightedLine>
              ) : (
                <AppText key={line} variant={titleVariant} heading={false}>
                  {line}
                </AppText>
              ),
            )}
          </View>
          {sub ? (
            <AppText variant="body" muted style={styles.sub}>
              {sub}
            </AppText>
          ) : null}
          {actions ? (
            <View style={[styles.actions, wide ? styles.actionsWide : null]}>{actions}</View>
          ) : null}
          {links ? (
            <LinkToneProvider value="ink">
              <View style={styles.links}>{links}</View>
            </LinkToneProvider>
          ) : null}
        </View>
      </Band>
    </View>
  );
}

/** The picture behind the hero, with the scrim that keeps the text readable (4.7:1 at worst). */
function HeroImage({ source }: { source: ImageSourcePropType }) {
  const { colors } = useTheme();
  const scrim =
    Platform.OS === 'web' ? (
      <View
        pointerEvents="none"
        style={
          [
            StyleSheet.absoluteFill,
            {
              backgroundImage: `linear-gradient(${colors.heroScrimTop}, ${colors.heroScrimBottom} 78%)`,
            },
          ] as unknown as ViewStyle
        }
      />
    ) : (
      // Native has no gradient module: two flat halves.
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.half, { backgroundColor: colors.heroScrimTop }]} />
        <View style={[styles.half, { backgroundColor: colors.heroScrimBottom }]} />
      </View>
    );
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.masthead }]}
    >
      {/* Explicit 100 %: react-native-web gives a local picture its own pixel size otherwise. */}
      <Image source={source} resizeMode="cover" style={styles.picture} />
      {scrim}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden' },
  overImage: { backgroundColor: 'transparent' },
  content: { gap: 20, maxWidth: 880 },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 6,
  },
  kickerText: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  title: { alignSelf: 'stretch' },
  line: { alignSelf: 'flex-start', justifyContent: 'center' },
  lineText: { paddingHorizontal: 8, marginHorizontal: -8 },
  bar: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, marginHorizontal: -8 },
  sub: { maxWidth: SUB_MAX_WIDTH },
  actions: { gap: 12, alignItems: 'stretch', marginTop: 8 },
  actionsWide: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  // The text buttons carry 16 points of padding: pulled back so the links meet the left edge.
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 0, marginLeft: -16 },
  half: { flex: 1 },
  picture: { width: '100%', height: '100%' },
});
