import type { Paragraph, Section } from '@biblioteca/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Column } from '@/components/column';
import { useEscapeKey } from '@/components/modal-behaviour';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { LoadingView, MessageView } from '@/components/state-views';
import { TypographyControls } from '@/components/typography-controls';
import { workTitle } from '@/content/titles';
import type { EditionDetail, WorkDetail } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { useT } from '@/i18n';
import { editionLanguageLabel } from '@/i18n/labels';
import { readHref, workHref } from '@/navigation-hrefs';
import { scrollFraction, sectionNeighbours, toPercent } from '@/reading/navigation';
import { loadPosition } from '@/reading/position-store';
import { useStorage } from '@/storage/key-value-store';
import { useSettings } from '@/settings/settings-context';
import { SectionBar } from '@/shell/section-bar';
import { useFontFamilies } from '@/theme/fonts';
import { useColumnStyle } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';
import { textLanguageProps } from '@/theme/web-styles';

import { READING_MAX_FONT_SCALE, ReaderParagraph } from './reader-paragraph';
import { useReadingPositionWriter } from './use-reading-position';

/**
 * The typography panel is at most this share of the window high and scrolls inside itself, so that
 * on a small phone (320 x 568) or a phone on its side (667 x 375) it never covers all the text it
 * is there to preview. (The `Aa` sheet of docs/ui-spec-v2.md 8.7 replaces it, at 70 %.)
 */
export const TYPOGRAPHY_PANEL_MAX_HEIGHT = 0.45;

interface Props {
  /** The work the section is expected to belong to (the `id` of the route). */
  workId: string;
  /** A section id identifies its edition: the reader shows that edition. */
  sectionId: string;
  /** Paragraph to scroll to (search result); wins over the saved reading position. */
  targetParagraphId?: string;
  /** Query to highlight in the target paragraph. */
  query?: string;
}

interface ViewToken {
  item: unknown;
  index?: number | null;
}

type Loaded =
  | { found: false }
  | {
      found: true;
      detail: WorkDetail;
      edition: EditionDetail;
      /** The sections of this edition only: previous and next stay inside it. */
      sections: Section[];
      paragraphs: Paragraph[];
      savedParagraphId: string | null;
    };

/**
 * The reader's frame: the section bar shows (docs/ui-spec-v2.md, 4.1 and 8.1) and the brand bar does
 * not, because the reader has its own toolbar (the next phase builds it). The bar is not a sticky
 * header here: the list under it is the scroll container, so the bar stays where it is.
 */
function ReaderFrame({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <SectionBar />
      {children}
    </Screen>
  );
}

export function ReaderScreen({ workId, sectionId, targetParagraphId, query }: Props) {
  const t = useT();
  const store = useStorage();
  const data = useRepositoryQuery<Loaded>(
    async (repository) => {
      const location = await repository.locateSection(sectionId);
      // A section that is not in this work (or not in any) is not found.
      if (!location || location.workId !== workId) return { found: false };
      const [detail, edition, sections, paragraphs] = await Promise.all([
        repository.getWork(workId),
        repository.getEdition(location.editionId),
        repository.getSections(location.editionId),
        repository.getParagraphs(sectionId),
      ]);
      if (!detail || !edition) return { found: false };
      // The source edition also finds the position an older version saved for the whole work.
      const saved = await loadPosition(
        store,
        edition.editionId,
        edition.kind === 'source' ? workId : undefined,
      );
      return {
        found: true,
        detail,
        edition,
        sections,
        paragraphs,
        savedParagraphId: saved?.sectionId === sectionId ? saved.paragraphId : null,
      };
    },
    [workId, sectionId, store],
  );

  if (data.status === 'loading') {
    return (
      <ReaderFrame>
        <LoadingView message={t.common.loading} />
      </ReaderFrame>
    );
  }
  if (data.status === 'error') {
    return (
      <ReaderFrame>
        <MessageView message={t.common.error} />
      </ReaderFrame>
    );
  }
  const section = data.data.found
    ? data.data.sections.find((candidate) => candidate.id === sectionId)
    : undefined;
  if (!data.data.found || !section) {
    return (
      <ReaderFrame>
        <MessageView message={t.reader.notFound} />
      </ReaderFrame>
    );
  }
  const { detail, edition, sections, paragraphs, savedParagraphId } = data.data;
  return (
    <ChapterView
      key={sectionId}
      detail={detail}
      edition={edition}
      sections={sections}
      section={section}
      paragraphs={paragraphs}
      initialParagraphId={targetParagraphId ?? savedParagraphId}
      highlightedParagraphId={targetParagraphId}
      query={query}
    />
  );
}

interface ChapterProps {
  detail: WorkDetail;
  edition: EditionDetail;
  sections: Section[];
  section: Section;
  paragraphs: Paragraph[];
  initialParagraphId: string | null | undefined;
  highlightedParagraphId: string | undefined;
  query: string | undefined;
}

const MAX_SCROLL_RETRIES = 12;
/** Upper bound of paragraphs rendered up front so that a saved position can be measured. */
const MAX_EAGER_PARAGRAPHS = 400;

function ChapterView({
  detail,
  edition,
  sections,
  section,
  paragraphs,
  initialParagraphId,
  highlightedParagraphId,
  query,
}: ChapterProps) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const column = useColumnStyle('reading');
  const { settings } = useSettings();
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const workId = detail.work.id;
  const editionId = edition.editionId;
  const neighbours = sectionNeighbours(sections, section.id);
  const title = workTitle(detail.work, settings.readingLanguage);
  // The language of the text, said at the head of the page only when the work has more than one.
  const languageLabel =
    detail.editions.length > 1 ? editionLanguageLabel(edition.language, t) : null;

  const listRef = useRef<FlatList<Paragraph>>(null);
  const retries = useRef(0);
  const [fraction, setFraction] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const writer = useReadingPositionWriter(editionId, section.id);

  // Web: Escape closes the typography panel, like any other disclosure.
  useEscapeKey(panelOpen, () => setPanelOpen(false));

  const targetIndex = useMemo(
    () =>
      initialParagraphId
        ? paragraphs.findIndex((paragraph) => paragraph.id === initialParagraphId)
        : -1,
    [initialParagraphId, paragraphs],
  );

  // Restore the saved position (or jump to a search hit) once the list is mounted.
  useEffect(() => {
    if (targetIndex <= 0) {
      writer.enable();
      return undefined;
    }
    const jump = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: targetIndex, animated: false, viewPosition: 0 });
    }, 100);
    const enable = setTimeout(writer.enable, 1200);
    return () => {
      clearTimeout(jump);
      clearTimeout(enable);
    };
  }, [targetIndex, writer]);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      retries.current += 1;
      if (retries.current > MAX_SCROLL_RETRIES) return;
      // Items before the target are not measured yet: jump close, then retry once they render.
      listRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 });
      }, 100);
    },
    [],
  );

  // FlatList requires a stable callback, so it only touches refs and the stable `writer.track`.
  const [onViewableItemsChanged] = useState(
    () =>
      ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const indexes = viewableItems
          .map((token) => token.index)
          .filter((index): index is number => index != null);
        if (indexes.length === 0) return;
        const first = Math.min(...indexes);
        const item = viewableItems.find((token) => token.index === first)?.item as
          Paragraph | undefined;
        if (item) writer.track(item.id);
      },
  );
  const [viewabilityConfig] = useState(() => ({ itemVisiblePercentThreshold: 10 }));

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const next = scrollFraction(contentOffset.y, contentSize.height, layoutMeasurement.height);
    setFraction((previous) => (toPercent(previous) === toPercent(next) ? previous : next));
  }, []);

  const goTo = (target: Section | null) => {
    if (target) router.replace(readHref(workId, target.id));
  };

  const overall = neighbours ? (neighbours.index + fraction) / neighbours.total : fraction;
  const percent = toPercent(overall);
  const positionText = neighbours
    ? t.reader.position(neighbours.index + 1, neighbours.total, percent)
    : t.reader.percent(percent);

  const header = section.heading ? (
    <View style={styles.chapterHeading}>
      <AppText
        variant="chapterTitle"
        {...textLanguageProps(edition.language)}
        maxFontSizeMultiplier={READING_MAX_FONT_SCALE}
      >
        {section.heading}
      </AppText>
    </View>
  ) : undefined;

  return (
    <ReaderFrame>
      <PageTitle parts={[section.heading, title]} />
      <Column kind="reading" style={styles.runningHead}>
        {/* The name of the work, as a quiet running head (the header that carried it is gone). */}
        <AppText
          variant="original"
          numberOfLines={1}
          testID="reader-running-title"
          style={styles.workTitle}
        >
          {title}
        </AppText>
        {languageLabel ? (
          <AppText variant="label" testID="edition-language">
            {languageLabel}
          </AppText>
        ) : null}
        <AppText
          variant="label"
          accessibilityRole="progressbar"
          accessibilityLabel={`${t.reader.progressLabel}: ${positionText}`}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          // react-native-web reads the `aria-*` props only; React Native reads both forms.
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          {positionText}
        </AppText>
      </Column>
      <FlatList
        ref={listRef}
        data={paragraphs}
        keyExtractor={(paragraph) => paragraph.id}
        extraData={`${settings.fontSize}|${settings.lineHeight}|${settings.theme}|${settings.readingFont}|${highlightedParagraphId ?? ''}`}
        renderItem={({ item }) => (
          <ReaderParagraph
            paragraph={item}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
            readingFont={settings.readingFont}
            isTarget={item.id === highlightedParagraphId}
            query={item.id === highlightedParagraphId ? query : undefined}
            language={edition.language}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={<AppText muted>{t.reader.emptySection}</AppText>}
        initialNumToRender={targetIndex > 0 ? Math.min(targetIndex + 8, MAX_EAGER_PARAGRAPHS) : 12}
        windowSize={11}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={onScroll}
        scrollEventThrottle={64}
        onScrollToIndexFailed={onScrollToIndexFailed}
        contentContainerStyle={[column, styles.content]}
        style={styles.list}
      />
      {panelOpen ? (
        <View
          testID="typography-panel"
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              maxHeight: Math.round(windowHeight * TYPOGRAPHY_PANEL_MAX_HEIGHT),
            },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <Column kind="reading" style={styles.sheetContent}>
              <AppText variant="label" accessibilityRole="header">
                {t.reader.typography}
              </AppText>
              <TypographyControls />
            </Column>
          </ScrollView>
        </View>
      ) : null}
      <View
        style={[
          styles.bar,
          { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        {/* Decorative: the running head above the text carries the progress for assistive tech. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.track, { backgroundColor: colors.border }]}
        >
          <View
            style={[styles.fill, { backgroundColor: colors.textMuted, width: `${percent}%` }]}
          />
        </View>
        <Column kind="reading" style={styles.navRow}>
          <Button
            variant="text"
            title={`← ${t.reader.previous}`}
            label={t.reader.previousLabel}
            disabled={!neighbours?.previous}
            onPress={() => goTo(neighbours?.previous ?? null)}
            style={styles.navStart}
          />
          <Button
            variant="text"
            title={t.reader.typographyButton}
            label={t.reader.typographyLabel}
            expanded={panelOpen}
            onPress={() => setPanelOpen((open) => !open)}
            glyph
            textStyle={{ fontFamily: fonts.text, fontSize: 18 }}
          />
          {neighbours?.next ? (
            <Button
              variant="text"
              title={`${t.reader.next} →`}
              label={t.reader.nextLabel}
              onPress={() => goTo(neighbours.next)}
              style={styles.navEnd}
            />
          ) : (
            <Button
              variant="text"
              title={t.reader.toContents}
              onPress={() => router.replace(workHref(workId, editionId))}
              style={styles.navEnd}
            />
          )}
        </Column>
      </View>
    </ReaderFrame>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingTop: 12, paddingBottom: 48 },
  // The work at the left, then the language of the text (when the work has several) and the position.
  runningHead: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  workTitle: { flex: 1, minWidth: 0 },
  chapterHeading: { marginBottom: 24, marginTop: 8 },
  sheet: { borderTopWidth: StyleSheet.hairlineWidth },
  sheetContent: { paddingTop: 16, paddingBottom: 20, gap: 12 },
  bar: { paddingTop: 0 },
  track: { height: 2 },
  fill: { height: 2 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  // The text buttons carry 16 px of padding: pull the outer ones back so their text meets the
  // edges of the reading column.
  navStart: { marginLeft: -16 },
  navEnd: { marginRight: -16 },
});
