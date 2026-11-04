import type { Paragraph, Section } from '@biblioteca/shared';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Column } from '@/components/column';
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
import { useFontFamilies } from '@/theme/fonts';
import { useColumnStyle } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';
import { textLanguageProps } from '@/theme/web-styles';

import { READING_MAX_FONT_SCALE, ReaderParagraph } from './reader-paragraph';
import { useReadingPositionWriter } from './use-reading-position';

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
      <Screen>
        <LoadingView message={t.common.loading} />
      </Screen>
    );
  }
  if (data.status === 'error') {
    return (
      <Screen>
        <MessageView message={t.common.error} />
      </Screen>
    );
  }
  const section = data.data.found
    ? data.data.sections.find((candidate) => candidate.id === sectionId)
    : undefined;
  if (!data.data.found || !section) {
    return (
      <Screen>
        <MessageView message={t.reader.notFound} />
      </Screen>
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
  useEffect(() => {
    if (!panelOpen || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [panelOpen]);

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
        variant="chapter"
        {...textLanguageProps(edition.language)}
        maxFontSizeMultiplier={READING_MAX_FONT_SCALE}
      >
        {section.heading}
      </AppText>
    </View>
  ) : undefined;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title,
          // A running head, quiet next to the chapter heading (the web header does the same).
          headerTitleStyle: {
            fontFamily: fonts.readingItalic,
            fontSize: 15,
            color: colors.textMuted,
          },
        }}
      />
      <PageTitle parts={[section.heading, title]} />
      <Column
        kind="reading"
        style={[styles.runningHead, languageLabel ? styles.withLanguage : null]}
      >
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
        extraData={`${settings.fontSize}|${settings.lineHeight}|${settings.theme}|${highlightedParagraphId ?? ''}`}
        renderItem={({ item }) => (
          <ReaderParagraph
            paragraph={item}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
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
          style={[styles.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
        >
          <Column kind="reading" style={styles.sheetContent}>
            <AppText variant="label" accessibilityRole="header">
              {t.reader.typography}
            </AppText>
            <TypographyControls />
          </Column>
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
            textStyle={{ fontFamily: fonts.readingMedium, fontSize: 18 }}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingTop: 12, paddingBottom: 48 },
  // The position at the right; the language of the text (when the work has several) at the left.
  runningHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 8,
    paddingBottom: 4,
  },
  withLanguage: { justifyContent: 'space-between' },
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
