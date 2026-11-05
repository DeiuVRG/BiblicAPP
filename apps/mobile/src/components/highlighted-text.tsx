import { Fragment } from 'react';
import { Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { splitByMatches } from '@/search/highlight';
import { splitGreekRuns, useGreekFace } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';
import { textLanguageProps } from '@/theme/web-styles';

interface Props {
  text: string;
  query: string;
  style?: StyleProp<TextStyle>;
  /** Language of the text, when it can differ from the interface language. */
  language?: string;
}

interface SpansProps {
  text: string;
  /** Every occurrence of the query is highlighted; empty for plain text. */
  query: string;
  /**
   * The family of the Greek Extended runs of the text (Gentium Plus): the text is not a Greek
   * edition, but it quotes Greek words that the reading face has no letters for. Without it the
   * text is one run.
   */
  greekFamily?: string;
}

/**
 * Nested text spans, with every occurrence of `query` highlighted and, when `greekFamily` is
 * given, every polytonic Greek phrase in that family. Must be used inside <Text>.
 */
export function HighlightedSpans({ text, query, greekFamily }: SpansProps) {
  const { colors } = useTheme();
  const parts = splitByMatches(text, query);
  const runs = (piece: string) =>
    greekFamily
      ? splitGreekRuns(piece).map((run, index) =>
          run.greek ? (
            <Text key={index} style={{ fontFamily: greekFamily }}>
              {run.text}
            </Text>
          ) : (
            run.text
          ),
        )
      : piece;
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <Text
            key={index}
            style={{ backgroundColor: colors.highlight, color: colors.onHighlight }}
          >
            {runs(part.text)}
          </Text>
        ) : greekFamily ? (
          <Fragment key={index}>{runs(part.text)}</Fragment>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

/** Standalone text with highlighted matches (polytonic Greek in its own face). */
export function HighlightedText({ text, query, style, language }: Props) {
  const greek = useGreekFace(language, text);
  return (
    <Text style={style} maxFontSizeMultiplier={1.6} {...textLanguageProps(language)}>
      <HighlightedSpans text={text} query={query} greekFamily={greek?.regular} />
    </Text>
  );
}
