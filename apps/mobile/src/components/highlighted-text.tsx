import { Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { splitByMatches } from '@/search/highlight';
import { useTheme } from '@/theme/theme-context';

interface Props {
  text: string;
  query: string;
  style?: StyleProp<TextStyle>;
}

/** Nested text spans, with every occurrence of `query` highlighted. Must be used inside <Text>. */
export function HighlightedSpans({ text, query }: { text: string; query: string }) {
  const { colors } = useTheme();
  const parts = splitByMatches(text, query);
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <Text
            key={index}
            style={{ backgroundColor: colors.highlight, color: colors.onHighlight }}
          >
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

/** Standalone text with highlighted matches. */
export function HighlightedText({ text, query, style }: Props) {
  return (
    <Text style={style} maxFontSizeMultiplier={1.6}>
      <HighlightedSpans text={text} query={query} />
    </Text>
  );
}
