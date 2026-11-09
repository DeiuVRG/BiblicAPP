import type { Paragraph } from '@biblioteca/shared';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/theme-context';
import { textLanguageProps } from '@/theme/web-styles';

import { ChapterCard } from './chapter-card';
import type { ChapterCardModel } from './chapter-card-model';
import { PARAGRAPH_SPACING_EM, ReaderParagraph } from './reader-paragraph';
import type { ReadingFont } from '@/theme/fonts';

// Two editions read side by side (docs/ui-spec-v2.md, 8.5): one row per aligned source paragraph, the first
// lane at the left and the second at the right, 50/50, a hairline between them; where an edition has
// no paragraph for a row (a partial translation) the lane says so in a muted italic line. Below
// 900 points of text area the lanes stack inside each row, under a muted label.

/** One side of the pair: the edition's language, the label that heads it and the text. */
export interface LaneInfo {
  /** "ro", "en", "la": the language of the edition (the `lang` of its text and the id of its label). */
  language: string;
  /** "ROMÂNĂ · TRADUCERE": the edition's label of 17.7 (capitals by style). */
  label: string;
  /** "Română": the short label above a block when the lanes are stacked. */
  short: string;
}

/** What the rows of two lanes are set in. */
export interface LaneSettings {
  fontSize: number;
  lineHeight: number;
  readingFont: ReadingFont;
  /** The words of the find bar. */
  query?: string;
}

/** The sticky head of the lanes: each lane named by its edition (wide only). */
export function LaneLabels({ first, second }: { first: LaneInfo; second: LaneInfo }) {
  const { colors } = useTheme();
  return (
    <View
      testID="lane-labels"
      style={[
        styles.labels,
        { backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.lane}>
        <AppText
          variant="label"
          testID={`lane-label-${first.language}`}
          {...textLanguageProps(first.language)}
        >
          {first.label}
        </AppText>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.lane}>
        <AppText
          variant="label"
          testID={`lane-label-${second.language}`}
          {...textLanguageProps(second.language)}
        >
          {second.label}
        </AppText>
      </View>
    </View>
  );
}

/** The heading cards of the two lanes: the section of each edition (a gap says so). */
export function LaneCards({
  first,
  second,
  firstCard,
  secondCard,
  fontSize,
  stacked,
}: {
  first: LaneInfo;
  second: LaneInfo;
  /** Null: the edition has not translated this section. */
  firstCard: ChapterCardModel | null;
  secondCard: ChapterCardModel | null;
  fontSize: number;
  stacked: boolean;
}) {
  const card = (info: LaneInfo, model: ChapterCardModel | null) =>
    model ? (
      <ChapterCard
        model={model}
        language={info.language}
        fontSize={fontSize}
        wide={false}
        compact
        testID={`chapter-card-${info.language}`}
      />
    ) : (
      <Gap />
    );
  if (stacked) {
    return (
      <View testID="lane-cards" style={styles.stackedCards}>
        <StackLabel info={first} />
        {card(first, firstCard)}
        <StackLabel info={second} />
        {card(second, secondCard)}
      </View>
    );
  }
  return (
    <View testID="lane-cards" style={styles.row}>
      <View style={styles.lane}>{card(first, firstCard)}</View>
      <View style={styles.divider} />
      <View style={styles.lane}>{card(second, secondCard)}</View>
    </View>
  );
}

function StackLabel({ info }: { info: LaneInfo }) {
  return (
    <AppText variant="caption" testID={`lane-label-${info.language}`} style={styles.stackLabel}>
      {info.short}
    </AppText>
  );
}

/** "Traducerea acestui pasaj nu este încă disponibilă.": the lane that has nothing for a row. */
function Gap() {
  const t = useT();
  return (
    <AppText variant="lead" testID="lane-gap" style={styles.gap}>
      {t.reader.gap}
    </AppText>
  );
}

export interface LaneRowData {
  /** The source paragraph both sides render: the key of the row. */
  key: string;
  first: Paragraph | null;
  second: Paragraph | null;
}

interface RowProps {
  row: LaneRowData;
  first: LaneInfo;
  second: LaneInfo;
  settings: LaneSettings;
  stacked: boolean;
  targetId: string | null;
  hitId: string | null;
}

function LaneRowBase({ row, first, second, settings, stacked, targetId, hitId }: RowProps) {
  const { colors } = useTheme();
  const spacing = Math.round(settings.fontSize * PARAGRAPH_SPACING_EM);
  const side = (paragraph: Paragraph | null, info: LaneInfo) =>
    paragraph ? (
      <ReaderParagraph
        paragraph={paragraph}
        fontSize={settings.fontSize}
        lineHeight={settings.lineHeight}
        readingFont={settings.readingFont}
        query={settings.query}
        isTarget={paragraph.id === targetId}
        isHit={paragraph.id === hitId}
        language={info.language}
        indent
        flush
      />
    ) : (
      <Gap />
    );
  if (stacked) {
    return (
      <View testID={`lane-row-${row.key}`} style={{ marginBottom: spacing }}>
        <StackLabel info={first} />
        <View testID="lane-left">{side(row.first, first)}</View>
        <StackLabel info={second} />
        <View testID="lane-right">{side(row.second, second)}</View>
      </View>
    );
  }
  return (
    <View testID={`lane-row-${row.key}`} style={[styles.row, { marginBottom: spacing }]}>
      <View testID="lane-left" style={styles.lane}>
        {side(row.first, first)}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View testID="lane-right" style={styles.lane}>
        {side(row.second, second)}
      </View>
    </View>
  );
}

/** A row of the pair: the two lanes are one block as high as the taller of them. */
export const LaneRow = memo(LaneRowBase);

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1 },
  // Stretch: the two lanes of a row are the same height, so that the divider runs the whole row.
  row: { flexDirection: 'row', alignItems: 'stretch' },
  lane: { flex: 1, flexBasis: 0, minWidth: 0, paddingHorizontal: 24 },
  divider: { width: 1, backgroundColor: 'transparent' },
  stackedCards: { gap: 8 },
  stackLabel: { marginTop: 8, marginBottom: 2 },
  gap: { fontSize: 15, lineHeight: 22 },
});
