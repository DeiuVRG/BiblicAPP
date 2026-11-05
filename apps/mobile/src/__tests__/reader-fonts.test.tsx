import type { Paragraph } from '@biblioteca/shared';
import { act, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { ReaderParagraph } from '@/features/reader/reader-paragraph';
import {
  FontsProvider,
  fontFamiliesFor,
  loadedFonts,
  resetFontGroups,
  useLoadedFontGroups,
} from '@/theme/fonts';
import { palettes } from '@/theme/palettes';
import { renderWithProviders } from '@/test-support/render';

const paragraph = (kind: Paragraph['kind'], text: string): Paragraph => ({
  id: `p-${kind}`,
  sectionId: 's1',
  ordinal: 0,
  kind,
  text,
});

beforeEach(() => resetFontGroups());

describe('ReaderParagraph fonts', () => {
  const render = (ui: React.ReactElement) =>
    renderWithProviders(<FontsProvider value={loadedFonts}>{ui}</FontsProvider>);

  it('reads in Source Serif 4 by default, in its italic for a quotation and its 600 for a heading', async () => {
    await render(
      <>
        <ReaderParagraph
          paragraph={paragraph('p', 'Text curent.')}
          fontSize={18}
          lineHeight={1.6}
        />
        <ReaderParagraph
          paragraph={paragraph('quote', 'O citare.')}
          fontSize={18}
          lineHeight={1.6}
        />
        <ReaderParagraph
          paragraph={paragraph('heading', 'Un subtitlu')}
          fontSize={18}
          lineHeight={1.6}
        />
      </>,
    );
    expect(screen.getByText('Text curent.')).toHaveStyle({ fontFamily: 'SourceSerif4_400Regular' });
    expect(screen.getByText('O citare.')).toHaveStyle({
      fontFamily: 'SourceSerif4_400Regular_Italic',
    });
    // Source Serif 4 has no 700 before P2: strong text is the 600.
    expect(screen.getByText('Un subtitlu')).toHaveStyle({ fontFamily: 'SourceSerif4_600SemiBold' });
  });

  it('follows the reading font the reader chose: Literata (its 700 for a heading) or Inter', async () => {
    await render(
      <>
        <ReaderParagraph
          paragraph={paragraph('p', 'În Literata.')}
          fontSize={18}
          lineHeight={1.6}
          readingFont="literata"
        />
        <ReaderParagraph
          paragraph={paragraph('heading', 'Subtitlu Literata')}
          fontSize={18}
          lineHeight={1.6}
          readingFont="literata"
        />
        <ReaderParagraph
          paragraph={paragraph('p', 'În Inter.')}
          fontSize={18}
          lineHeight={1.6}
          readingFont="sans"
        />
      </>,
    );
    expect(screen.getByText('În Literata.')).toHaveStyle({ fontFamily: 'Literata_400Regular' });
    expect(screen.getByText('Subtitlu Literata')).toHaveStyle({ fontFamily: 'Literata_700Bold' });
    expect(screen.getByText('În Inter.')).toHaveStyle({ fontFamily: 'Inter_400Regular' });
  });

  it('reads an ancient Greek edition in Gentium Plus, whatever the reading font', async () => {
    await render(
      <>
        <ReaderParagraph
          paragraph={paragraph('p', 'ἐν ἀρχῇ ἦν ὁ λόγος')}
          fontSize={18}
          lineHeight={1.6}
          language="grc"
          readingFont="literata"
        />
        <ReaderParagraph
          paragraph={paragraph('quote', 'ὁ λόγος σὰρξ ἐγένετο')}
          fontSize={18}
          lineHeight={1.6}
          language="grc"
        />
      </>,
    );
    expect(screen.getByText('ἐν ἀρχῇ ἦν ὁ λόγος')).toHaveStyle({
      fontFamily: 'GentiumPlus_400Regular',
    });
    expect(screen.getByText('ὁ λόγος σὰρξ ἐγένετο')).toHaveStyle({
      fontFamily: 'GentiumPlus_400Regular_Italic',
    });
  });

  describe('polytonic Greek quoted in a text that is not a Greek edition', () => {
    const TEXT = 'The church (ἐκκλησία) of God, and ἐν ἀρχῇ ἦν ὁ λόγος.';
    /** The nested spans of the paragraph with this whole text, by their text. */
    const spanFamilies = (whole: string) =>
      Object.fromEntries(
        screen
          .getByText(whole)
          .children.filter((child) => typeof child !== 'string')
          .map((child) => {
            const span = child as unknown as {
              props: { style: StyleProp<TextStyle> };
              children: (string | object)[];
            };
            return [span.children.join(''), StyleSheet.flatten(span.props.style)?.fontFamily];
          }),
      );

    it('sets the Greek phrases in Gentium Plus and the rest in the reading face', async () => {
      // Regression: Source Serif 4 has no polytonic letters, so the browser fell back to a system
      // serif for them and Gentium Plus was never loaded for an English or Romanian edition.
      await render(
        <ReaderParagraph
          paragraph={paragraph('p', TEXT)}
          fontSize={18}
          lineHeight={1.6}
          language="en"
        />,
      );
      expect(screen.getByText(TEXT)).toHaveStyle({
        fontFamily: 'SourceSerif4_400Regular',
      });
      expect(spanFamilies(TEXT)).toEqual({
        ἐκκλησία: 'GentiumPlus_400Regular',
        'ἐν ἀρχῇ ἦν ὁ λόγος': 'GentiumPlus_400Regular',
      });
    });

    it('uses the italic of Gentium Plus in a quotation', async () => {
      await render(
        <ReaderParagraph
          paragraph={paragraph('quote', 'Paul writes ἀγάπη here.')}
          fontSize={18}
          lineHeight={1.6}
          language="en"
        />,
      );
      expect(spanFamilies('Paul writes ἀγάπη here.')).toEqual({
        ἀγάπη: 'GentiumPlus_400Regular_Italic',
      });
    });

    it('loads the Greek face for such a paragraph, and for no other', async () => {
      function Probe() {
        return <Text testID="groups">{[...useLoadedFontGroups()].join(',')}</Text>;
      }
      await render(
        <>
          <ReaderParagraph
            paragraph={paragraph('p', 'Only English, and λόγος in plain Greek.')}
            fontSize={18}
            lineHeight={1.6}
            language="en"
          />
          <Probe />
        </>,
      );
      await act(async () => {});
      expect(screen.getByTestId('groups')).toHaveTextContent('');
      await render(
        <>
          <ReaderParagraph
            paragraph={paragraph('p', TEXT)}
            fontSize={18}
            lineHeight={1.6}
            language="en"
          />
          <Probe />
        </>,
      );
      expect(await screen.findByText('gentium')).toBeTruthy();
    });

    it('keeps the Greek phrases in their face inside a search highlight', async () => {
      await render(
        <ReaderParagraph
          paragraph={paragraph('p', TEXT)}
          fontSize={18}
          lineHeight={1.6}
          language="en"
          query="church"
        />,
      );
      const families = spanFamilies(TEXT);
      expect(families['ἐκκλησία']).toBe('GentiumPlus_400Regular');
      // The match is its own span, with the highlight colours.
      expect(screen.getByText('church')).toHaveStyle({
        backgroundColor: palettes.light.highlight,
      });
    });

    it('does nothing to a Greek edition, which reads in Gentium Plus as a whole', async () => {
      await render(
        <ReaderParagraph
          paragraph={paragraph('p', 'ἐν ἀρχῇ ἦν ὁ λόγος')}
          fontSize={18}
          lineHeight={1.6}
          language="grc"
        />,
      );
      expect(screen.getByText('ἐν ἀρχῇ ἦν ὁ λόγος')).toHaveStyle({
        fontFamily: 'GentiumPlus_400Regular',
      });
      expect(screen.getByText('ἐν ἀρχῇ ἦν ὁ λόγος').children).toEqual(['ἐν ἀρχῇ ἦν ὁ λόγος']);
    });
  });

  it('does not ask for the Greek face for any other language', async () => {
    function Probe() {
      return <Text testID="groups">{[...useLoadedFontGroups()].join(',')}</Text>;
    }
    await render(
      <>
        <ReaderParagraph
          paragraph={paragraph('p', 'In principio')}
          fontSize={18}
          lineHeight={1.6}
          language="la"
        />
        <Probe />
      </>,
    );
    await act(async () => {});
    expect(screen.getByTestId('groups')).toHaveTextContent('');
  });

  it('loads the Greek face when a Greek paragraph is shown (the bundled loader answers under Jest)', async () => {
    function Probe() {
      return <Text testID="groups">{[...useLoadedFontGroups()].join(',')}</Text>;
    }
    await renderWithProviders(
      <>
        <ReaderParagraph
          paragraph={paragraph('p', 'ἐν ἀρχῇ')}
          fontSize={18}
          lineHeight={1.6}
          language="grc"
        />
        <Probe />
      </>,
    );
    expect(await screen.findByText('gentium')).toBeTruthy();
  });

  it('shows the Source Serif 4 face in place of Greek until Gentium Plus has arrived', async () => {
    // What the paragraph sees before the group is loaded: the fallback of `fontFamiliesFor`.
    const before = fontFamiliesFor({ firstPaint: true, groups: new Set() });
    await renderWithProviders(
      <FontsProvider value={before}>
        <ReaderParagraph
          paragraph={paragraph('p', 'ἐν ἀρχῇ')}
          fontSize={18}
          lineHeight={1.6}
          language="grc"
        />
      </FontsProvider>,
    );
    expect(screen.getByText('ἐν ἀρχῇ')).toHaveStyle({ fontFamily: 'SourceSerif4_400Regular' });
  });
});
