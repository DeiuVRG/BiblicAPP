import type { Paragraph } from '@biblioteca/shared';
import { memo, useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { HighlightedSpans } from '@/components/highlighted-text';
import { readingFaces, useFontFamilies, useGreekFace } from '@/theme/fonts';
import type { ReadingFont } from '@/theme/fonts';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { motion } from '@/theme/tokens';
import { READING_MAX_FONT_SCALE, lineHeightFor, paragraphFontSize } from '@/theme/typography';
import { textLanguageProps } from '@/theme/web-styles';

/** Reading text honours the system font scale, capped so very large settings stay usable. */
export { READING_MAX_FONT_SCALE } from '@/theme/typography';

/** How long the background of the paragraph a search result jumped to takes to appear. */
export const TARGET_FADE_MS = motion.targetFade;

interface Props {
  paragraph: Paragraph;
  fontSize: number;
  lineHeight: number;
  /** The face the reader chose (Source Serif 4 by default). */
  readingFont?: ReadingFont;
  /** Search query to highlight inside this paragraph (only set for the jump target). */
  query?: string;
  isTarget?: boolean;
  /** Language of the text (the edition's), when it can differ from the interface language. */
  language?: string;
}

/** The `target` background behind a paragraph, fading in over 300 ms (at once under reduced motion). */
function TargetBackground() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      return undefined;
    }
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: TARGET_FADE_MS,
      useNativeDriver: Platform.OS !== 'web',
    });
    fade.start();
    return () => fade.stop();
  }, [opacity, reduced]);
  return (
    <Animated.View
      style={[styles.target, { backgroundColor: colors.target, opacity }]}
      testID="target-paragraph"
    />
  );
}

function ReaderParagraphBase({
  paragraph,
  fontSize,
  lineHeight,
  readingFont = 'serif',
  query,
  isTarget = false,
  language,
}: Props) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  // A Greek edition reads in Gentium Plus (polytonic letters; Source Serif 4 has none): the face
  // loads when the first Greek paragraph is shown.
  const greek = useGreekFace(language);
  const faces = greek
    ? { regular: greek.regular, italic: greek.italic, bold: greek.regular }
    : readingFaces(fonts, readingFont);
  const { kind } = paragraph;

  const size = paragraphFontSize(kind, fontSize);
  const textStyle = {
    // Left-aligned, never justified: justification hurts readability on narrow screens.
    textAlign: 'left' as const,
    fontSize: size,
    lineHeight: lineHeightFor(size, lineHeight),
    color: kind === 'note' ? colors.textMuted : colors.text,
    fontFamily: kind === 'heading' ? faces.bold : kind === 'quote' ? faces.italic : faces.regular,
  };

  return (
    <View
      style={[
        styles.block,
        { marginBottom: Math.round(fontSize * 0.75) },
        kind === 'heading' && { marginTop: Math.round(fontSize * 0.5) },
        kind === 'quote' && [styles.quote, { borderLeftColor: colors.border }],
      ]}
    >
      {isTarget ? <TargetBackground /> : null}
      <Text
        selectable
        {...textLanguageProps(language)}
        maxFontSizeMultiplier={READING_MAX_FONT_SCALE}
        accessibilityRole={kind === 'heading' ? 'header' : undefined}
        // Below the chapter heading (level 2); react-native-web would render h1 otherwise.
        {...(kind === 'heading' ? ({ 'aria-level': 3 } as object) : undefined)}
        style={textStyle}
      >
        {query ? <HighlightedSpans text={paragraph.text} query={query} /> : paragraph.text}
      </Text>
    </View>
  );
}

export const ReaderParagraph = memo(ReaderParagraphBase);

const styles = StyleSheet.create({
  block: { borderRadius: 6 },
  quote: { borderLeftWidth: 3, paddingLeft: 14, marginLeft: 4 },
  // Reaches a little past the text on every side (into the gutter), behind the text.
  target: {
    position: 'absolute',
    left: -12,
    right: -12,
    top: -6,
    bottom: -6,
    borderRadius: 6,
    pointerEvents: 'none',
  },
});
