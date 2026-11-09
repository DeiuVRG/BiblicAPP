import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { Hairline } from '@/components/hairline';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useT } from '@/i18n';
import { useFontFamilies } from '@/theme/fonts';
import { useCoarsePointer } from '@/theme/pointer';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';
import { READING_MAX_FONT_SCALE } from '@/theme/typography';
import { textLanguageProps } from '@/theme/web-styles';

import type { ChapterCardModel } from './chapter-card-model';

interface CardProps {
  model: ChapterCardModel;
  /** The language of the heading (the edition's). */
  language: string;
  /** The reader's size in points: the title is an `em` of it. */
  fontSize: number;
  /** A wide screen: the card is inset 54 on each side and the title is 1.42 em (1.24 on a phone). */
  wide: boolean;
  /** Where "§" goes: copies the link to the section. Absent in a lane, where there is no room. */
  onCopyLink?(): void;
  /** Phone: no "§" (the Tools sheet has "Copiază linkul"). */
  showAnchor?: boolean;
  /** A card in a lane: the room above and below it is the lane's, not the 48 and 26 of a single column. */
  compact?: boolean;
  testID?: string;
}

/**
 * The card that opens a section (docs/ui-spec-v2.md, 8.4). Tier 1 (a chapter) is a bordered `surface` card with
 * an eyebrow over the title (1.42 em, 600; 1.1 em for a long title); tier 2 a title under a rule; tier 3 a
 * smaller title. A "§" 18 points left of the card copies the link to the section: it shows on hover
 * and on focus (always on a touch screen).
 */
export function ChapterCard({
  model,
  language,
  fontSize,
  wide,
  onCopyLink,
  showAnchor = true,
  compact = false,
  testID = 'chapter-card',
}: CardProps) {
  const t = useT();
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const coarse = useCoarsePointer();
  const { hovered, hoverProps } = useHover();
  const [focused, setFocused] = useState(false);
  const { focusStyle } = useFocusRing();
  const { tier, eyebrow, title, long } = model;
  const em = tier === 1 ? (long ? 1.1 : wide ? 1.42 : 1.24) : tier === 2 ? 1.2 : 1.04;
  const size = Math.round(fontSize * em * 10) / 10;
  const titleStyle = {
    fontFamily: fonts.textSemiBold,
    fontSize: size,
    lineHeight: Math.round(size * (tier === 3 ? 1.4 : 1.25)),
    color: colors.text,
  };
  const heading = (
    <AppText
      variant="chapterTitle"
      level={tier === 1 ? 2 : tier === 2 ? 3 : 4}
      {...textLanguageProps(language)}
      maxFontSizeMultiplier={READING_MAX_FONT_SCALE}
      style={titleStyle}
    >
      {title}
    </AppText>
  );
  const body: ReactNode =
    tier === 1 ? (
      <View
        testID={testID}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            marginHorizontal: wide ? 54 : 0,
          },
        ]}
      >
        {eyebrow ? (
          <AppText variant="eyebrow" {...textLanguageProps(language)} style={styles.eyebrow}>
            {eyebrow}
          </AppText>
        ) : null}
        {heading}
      </View>
    ) : (
      <View
        testID={testID}
        style={[
          tier === 2 ? styles.tier2 : styles.tier3,
          tier === 2 ? { borderTopColor: colors.border, borderTopWidth: 1 } : null,
          {
            marginTop: Math.round(fontSize * (tier === 2 ? 2 : 1.6)),
            marginBottom: Math.round(fontSize * (tier === 2 ? 0.8 : 0.45)),
          },
        ]}
      >
        {heading}
      </View>
    );

  const visible = onCopyLink && showAnchor && wide;
  return (
    <Pressable
      accessible={false}
      focusable={false}
      {...hoverProps}
      style={[styles.wrap, tier === 1 ? (compact ? styles.wrapCompact : styles.wrapCard) : null]}
    >
      {body}
      {visible ? (
        <Pressable
          testID="chapter-anchor"
          accessibilityRole="button"
          accessibilityLabel={t.reader.copyAnchor}
          onPress={onCopyLink}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.anchor,
            { left: wide ? 54 - 44 : 0, opacity: hovered || focused || coarse ? 0.85 : 0 },
            focusStyle,
          ]}
        >
          <AppText
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ color: colors.textMuted, fontSize: 18 }}
          >
            §
          </AppText>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  // 48 above and 26 below a card.
  wrapCard: { marginTop: 48, marginBottom: 26 },
  wrapCompact: { marginTop: 24, marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 4,
  },
  eyebrow: { marginBottom: 2 },
  tier2: { paddingTop: 16, paddingRight: 40 },
  tier3: {},
  // 18 points to the left of the card; the hit area is 44 wide (the glyph is centred in it).
  anchor: {
    position: 'absolute',
    top: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

interface NextProps {
  /** The heading of the next section of the edition. */
  heading: string;
  language: string;
  onPress(): void;
}

/** The end of a chapter: a hairline and the card "Capitolul următor: <titlu> ›". */
export function NextChapterCard({ heading, language, onPress }: NextProps) {
  const t = useT();
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <View style={nextStyles.wrap}>
      <Hairline />
      <Pressable
        testID="next-chapter-card"
        accessibilityRole="link"
        accessibilityLabel={t.reader.nextChapterLabel(heading)}
        onPress={onPress}
        {...hoverProps}
        {...focusProps}
        style={({ pressed }) => [
          nextStyles.card,
          {
            backgroundColor: colors.surface,
            borderColor: hovered ? colors.accent : colors.border,
          },
          pressStyle(pressed, reduced),
          focusStyle,
        ]}
      >
        <View style={nextStyles.text}>
          <AppText variant="eyebrow">{t.reader.nextChapterEyebrow}</AppText>
          <AppText
            {...textLanguageProps(language)}
            style={{
              fontFamily: fonts.textSemiBold,
              fontSize: 17,
              lineHeight: 24,
              color: colors.text,
            }}
          >
            {heading}
          </AppText>
        </View>
        <AppText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ color: hovered ? colors.accentStrong : colors.textMuted, fontSize: 24 }}
        >
          ›
        </AppText>
      </Pressable>
    </View>
  );
}

/** The last section of the work: "Ai ajuns la sfârșitul lucrării." with the way back and, when Ask is live, a question. */
export function EndOfWork({
  onContents,
  onAsk,
}: {
  onContents(): void;
  /** Absent until Ask is live (nothing dead). */
  onAsk?: () => void;
}) {
  const t = useT();
  return (
    <View testID="end-of-work" style={nextStyles.wrap}>
      <Hairline />
      <View style={nextStyles.end}>
        <AppText variant="lead" accessibilityLiveRegion="polite">
          {t.reader.endOfWork}
        </AppText>
        <View style={nextStyles.actions}>
          <Button variant="outline" title={t.reader.toContents} onPress={onContents} />
          {onAsk ? (
            <Button
              variant="outline"
              title={t.work.askAboutBook}
              onPress={onAsk}
              testID="end-ask"
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const nextStyles = StyleSheet.create({
  wrap: { marginTop: 40, gap: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  text: { flex: 1, gap: 4 },
  end: { gap: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
