import { Link } from 'expo-router';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';
import { useEffect, useState } from 'react';

import { AppText, UI_MAX_FONT_SCALE, useTypeStyle } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useT } from '@/i18n';
import type { ReadingLanguage } from '@/i18n/language';
import { formatCenturyLabel, formatYear } from '@/i18n/labels';
import {
  editionBadges,
  groupNameOf,
  titleOf,
  workAccessibleName,
  fullMeta,
} from '@/library/labels';
import type { LibraryModel, LibraryWork } from '@/library/model';
import { workHref } from '@/navigation-hrefs';
import { useLayout } from '@/theme/layout';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { duration, radii } from '@/theme/tokens';

/** How far the arrow of "CITEȘTE ›" moves on hover. */
const ARROW_SHIFT = 3;

interface Props {
  work: LibraryWork;
  model: LibraryModel;
  language: ReadingLanguage;
}

/**
 * A work of the collection (docs/ui-spec-v2.md, 3 and 5, band 6): a bordered card with its group
 * (small caps, `accentStrong`), its era (small caps, `textMuted`), its title, its description (not on
 * a phone), the badges of its editions and "CITEȘTE ›". The whole card is the link to the work hub.
 * On hover the border turns `accent` and the arrow moves 3 points.
 */
export function WorkCard({ work, model, language }: Props) {
  const t = useT();
  const { wide } = useLayout();
  const title = titleOf(work, language);
  const group = groupNameOf(model, work, language);
  const era = [formatYear(work.year, t), formatCenturyLabel(work.century, t, 'short')]
    .filter(Boolean)
    .join(' · ');
  const description = work.entry
    ? language === 'ro'
      ? work.entry.blurbRo
      : work.entry.blurbEn
    : '';
  const badges = editionBadges(work.summary.editions, t);
  return (
    <Link href={workHref(work.workId)} asChild>
      <CardPressable
        testID={`work-card-${work.slug}`}
        // A phone card is compact (140 points or less, docs/ui-spec-v2.md check L5).
        style={wide ? undefined : styles.compact}
        accessibilityLabel={workAccessibleName(
          title,
          fullMeta(model, work, language, t),
          badges,
          t,
        )}
      >
        {(hovered) => (
          <>
            <AppText variant="label" tone="accent" numberOfLines={1}>
              {group}
            </AppText>
            {/* On a phone the card is compact (a title, who wrote it, the editions): no era line. */}
            {wide && era ? (
              <AppText variant="label" numberOfLines={1}>
                {era}
              </AppText>
            ) : null}
            <AppText
              variant={wide ? 'title' : 'heading'}
              level={3}
              numberOfLines={wide ? undefined : 2}
              style={wide ? styles.title : styles.titleCompact}
            >
              {title}
            </AppText>
            {wide && description ? (
              <AppText variant="meta" numberOfLines={3}>
                {description}
              </AppText>
            ) : null}
            <View style={styles.badges}>
              {badges.map((badge) => (
                <Chip key={badge.key} label={badge.code} accessibilityLabel={badge.label} />
              ))}
            </View>
            {wide ? <ReadArrow hovered={hovered} label={t.landing.read} /> : null}
          </>
        )}
      </CardPressable>
    </Link>
  );
}

/** "CITEȘTE ›": the arrow moves 3 points on hover (nothing moves under reduced motion). */
function ReadArrow({ hovered, label }: { hovered: boolean; label: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [shift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      shift.setValue(hovered ? ARROW_SHIFT : 0);
      return undefined;
    }
    const animation = Animated.timing(shift, {
      toValue: hovered ? ARROW_SHIFT : 0,
      duration: duration.base,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [hovered, reduced, shift]);
  const color = hovered ? colors.accentHover : colors.accentStrong;
  // The arrow is set in the type of the label (Source Serif 4, 13 points): a bare `Text` is drawn in
  // the system font.
  const text = useTypeStyle('button');
  return (
    <View
      style={styles.read}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppText variant="button" style={{ color }}>
        {label}
      </AppText>
      <Animated.Text
        testID="work-card-arrow"
        maxFontSizeMultiplier={UI_MAX_FONT_SCALE}
        style={[text, { color, transform: [{ translateX: shift }] }]}
      >
        ›
      </Animated.Text>
    </View>
  );
}

type CardPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  children: (hovered: boolean) => React.ReactNode;
  /** Whatever style Link's slot merged in (a plain object). */
  style?: ViewStyle;
};

// Link's `asChild` slot adds props (href, onPress, role) to its child, so the hover and pressed
// states live inside this wrapper (as in `LinkRow`).
function CardPressable({ children, style, ...rest }: CardPressableProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      {...hoverProps}
      {...focusProps}
      {...rest}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: hovered ? colors.accent : colors.border,
        },
        pressStyle(pressed, reduced),
        focusStyle,
        style,
      ]}
    >
      {children(hovered)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 4,
    alignItems: 'flex-start',
  },
  compact: { paddingTop: 14, paddingBottom: 12 },
  title: { marginTop: 4, marginBottom: 2 },
  titleCompact: { marginTop: 0, marginBottom: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  read: { flexDirection: 'row', alignItems: 'center', columnGap: 6, marginTop: 10 },
});
