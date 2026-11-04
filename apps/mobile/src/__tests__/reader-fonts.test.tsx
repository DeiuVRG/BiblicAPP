import type { Paragraph } from '@biblioteca/shared';
import { act, screen } from '@testing-library/react-native';

import { ReaderParagraph } from '@/features/reader/reader-paragraph';
import {
  FontsProvider,
  fontFamiliesFor,
  loadedFonts,
  resetFontGroups,
  useLoadedFontGroups,
} from '@/theme/fonts';
import { renderWithProviders } from '@/test-support/render';
import { Text } from 'react-native';

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
