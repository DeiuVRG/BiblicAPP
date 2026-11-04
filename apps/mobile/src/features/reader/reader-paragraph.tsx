import type { Paragraph } from '@biblioteca/shared';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HighlightedSpans } from '@/components/highlighted-text';
import { useFontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';

/** Reading text honours the system font scale, capped so very large settings stay usable. */
export const READING_MAX_FONT_SCALE = 1.6;

interface Props {
  paragraph: Paragraph;
  fontSize: number;
  lineHeight: number;
  /** Search query to highlight inside this paragraph (only set for the jump target). */
  query?: string;
  isTarget?: boolean;
}

function ReaderParagraphBase({ paragraph, fontSize, lineHeight, query, isTarget = false }: Props) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const { kind } = paragraph;

  const size =
    kind === 'note'
      ? Math.round(fontSize * 0.88)
      : kind === 'heading'
        ? Math.round(fontSize * 1.15)
        : fontSize;
  const textStyle = {
    // Left-aligned, never justified: justification hurts readability on narrow screens.
    textAlign: 'left' as const,
    fontSize: size,
    lineHeight: Math.round(size * lineHeight),
    color: kind === 'note' ? colors.textMuted : colors.text,
    fontFamily:
      kind === 'heading'
        ? fonts.readingBold
        : kind === 'quote'
          ? fonts.readingItalic
          : fonts.reading,
  };

  return (
    <View
      style={[
        styles.block,
        { marginBottom: Math.round(fontSize * 0.75) },
        kind === 'heading' && { marginTop: Math.round(fontSize * 0.5) },
        kind === 'quote' && [styles.quote, { borderLeftColor: colors.border }],
        isTarget && { backgroundColor: colors.target },
      ]}
    >
      <Text
        selectable
        maxFontSizeMultiplier={READING_MAX_FONT_SCALE}
        accessibilityRole={kind === 'heading' ? 'header' : undefined}
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
});
