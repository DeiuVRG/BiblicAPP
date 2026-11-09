import type { Paragraph } from '@biblioteca/shared';
import { memo, useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { HighlightedSpans } from '@/components/highlighted-text';
import { needsGreekFace, readingFaces, useFontFamilies, useGreekFace } from '@/theme/fonts';
import type { ReadingFont } from '@/theme/fonts';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { FOCUS_RING, motion } from '@/theme/tokens';
import { READING_MAX_FONT_SCALE, lineHeightFor, paragraphFontSize } from '@/theme/typography';
import { textLanguageProps } from '@/theme/web-styles';

/** Reading text honours the system font scale, capped so very large settings stay usable. */
export { READING_MAX_FONT_SCALE } from '@/theme/typography';

/** How long the background of the paragraph a search result jumped to takes to appear. */
export const TARGET_FADE_MS = motion.targetFade;

/** The space after a paragraph: 0.58 em (docs/ui-spec-v2.md, 8.4). */
export const PARAGRAPH_SPACING_EM = 0.58;
/** The first-line indent of a running paragraph in two lanes. */
const LANE_INDENT = '1.45em';

interface Props {
  paragraph: Paragraph;
  fontSize: number;
  lineHeight: number;
  /** The face the reader chose (Source Serif 4 by default). */
  readingFont?: ReadingFont;
  /** The words of the find bar, marked everywhere in this paragraph. */
  query?: string;
  /** The paragraph a link jumped to: the `target` wash and a 3 point bar in `accentStrong`, fading in. */
  isTarget?: boolean;
  /** The current hit of the find bar: a 2 point ring in `accentStrong`. */
  isHit?: boolean;
  /** Language of the text (the edition's), when it can differ from the interface language. */
  language?: string;
  /** A running paragraph of a lane is indented 1.45 em on its first line (web). */
  indent?: boolean;
  /** No space after it (the row of two lanes spaces itself). */
  flush?: boolean;
}

/** The `target` wash and its 3 point bar, fading in over 300 ms (at once under reduced motion). */
function TargetMarks() {
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
    <>
      <Animated.View
        style={[styles.target, { backgroundColor: colors.target, opacity }]}
        testID="target-paragraph"
      />
      {/* The wash is 1.02:1 against the page in light: the bar says it too (docs/ui-spec-v2.md, 8.4). */}
      <Animated.View
        style={[styles.bar, { backgroundColor: colors.accentStrong, opacity }]}
        testID="target-bar"
      />
    </>
  );
}

function ReaderParagraphBase({
  paragraph,
  fontSize,
  lineHeight,
  readingFont = 'serif',
  query,
  isTarget = false,
  isHit = false,
  language,
  indent = false,
  flush = false,
}: Props) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  // A Greek edition reads in Gentium Plus (polytonic letters; Source Serif 4 has none): the face
  // loads when the first Greek paragraph is shown. In any other edition only the polytonic phrases
  // it quotes ("ἐκκλησία") are set in it, inside text in the reading face.
  const greek = useGreekFace(language, paragraph.text);
  const greekEdition = needsGreekFace(language);
  const faces =
    greek && greekEdition
      ? { regular: greek.regular, italic: greek.italic, bold: greek.regular }
      : readingFaces(fonts, readingFont);
  const { kind } = paragraph;
  const quotedGreek =
    greek && !greekEdition ? (kind === 'quote' ? greek.italic : greek.regular) : undefined;

  const size = paragraphFontSize(kind, fontSize);
  const textStyle = {
    // Left-aligned, never justified: justification hurts readability on narrow screens.
    textAlign: 'left' as const,
    fontSize: size,
    lineHeight: lineHeightFor(size, lineHeight),
    color: kind === 'note' ? colors.textMuted : colors.text,
    fontFamily: kind === 'heading' ? faces.bold : kind === 'quote' ? faces.italic : faces.regular,
    // `textIndent` is CSS only: react-native-web passes it on, the native text has no indent.
    ...(indent && kind === 'p' && Platform.OS === 'web'
      ? ({ textIndent: LANE_INDENT } as object)
      : null),
  };
  // The identity of the row of a work read in two editions: the source paragraph both render (web: `data-source-id`).
  const source = paragraph.sourceId ?? paragraph.id;
  const marker =
    Platform.OS === 'web'
      ? ({ dataSet: { sourceId: source, paragraphId: paragraph.id } } as object)
      : null;

  return (
    <View
      testID={`paragraph-${paragraph.id}`}
      {...marker}
      style={[
        styles.block,
        flush ? null : { marginBottom: Math.round(fontSize * PARAGRAPH_SPACING_EM) },
        kind === 'heading' && { marginTop: Math.round(fontSize * 0.5) },
        // A quotation is set in 1.2 em from the left, under a 3 point rule.
        kind === 'quote' && [
          styles.quote,
          { borderLeftColor: colors.border, marginLeft: Math.round(fontSize * 1.2) },
        ],
        isHit
          ? ({
              outlineStyle: 'solid',
              outlineWidth: FOCUS_RING.width,
              outlineColor: colors.accentStrong,
              outlineOffset: 4,
            } as object)
          : null,
      ]}
    >
      {isTarget ? <TargetMarks /> : null}
      <Text
        selectable
        {...textLanguageProps(language)}
        maxFontSizeMultiplier={READING_MAX_FONT_SCALE}
        accessibilityRole={kind === 'heading' ? 'header' : undefined}
        // Below the chapter heading (level 2); react-native-web would render h1 otherwise.
        {...(kind === 'heading' ? ({ 'aria-level': 3 } as object) : undefined)}
        style={textStyle}
      >
        {query || quotedGreek ? (
          <HighlightedSpans text={paragraph.text} query={query ?? ''} greekFamily={quotedGreek} />
        ) : (
          paragraph.text
        )}
      </Text>
    </View>
  );
}

export const ReaderParagraph = memo(ReaderParagraphBase);

const styles = StyleSheet.create({
  block: { borderRadius: 6 },
  quote: { borderLeftWidth: 3, paddingLeft: 14 },
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
  bar: {
    position: 'absolute',
    left: -12,
    top: -6,
    bottom: -6,
    width: 3,
    borderRadius: 1,
    pointerEvents: 'none',
  },
});
