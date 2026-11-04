import type { Paragraph, Section } from '@biblioteca/shared';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button, MIN_TARGET } from '@/components/button';
import { Screen } from '@/components/screen';
import { LoadingView, MessageView } from '@/components/state-views';
import { TypographyControls } from '@/components/typography-controls';
import type { WorkDetail } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { t } from '@/i18n';
import { readHref, workHref } from '@/navigation-hrefs';
import { scrollFraction, sectionNeighbours, toPercent } from '@/reading/navigation';
import { loadPosition } from '@/reading/position-store';
import { useStorage } from '@/storage/key-value-store';
import { useSettings } from '@/settings/settings-context';
import { useFontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';

import { READING_MAX_FONT_SCALE, ReaderParagraph } from './reader-paragraph';
import { useReadingPositionWriter } from './use-reading-position';

interface Props {
  workId: string;
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

interface Loaded {
  detail: WorkDetail | null;
  sections: Section[];
  paragraphs: Paragraph[];
  savedParagraphId: string | null;
}

export function ReaderScreen({ workId, sectionId, targetParagraphId, query }: Props) {
  const store = useStorage();
  const data = useRepositoryQuery<Loaded>(
    async (repository) => {
      const [detail, sections, paragraphs, saved] = await Promise.all([
        repository.getWork(workId),
        repository.getSections(workId),
        repository.getParagraphs(sectionId),
        loadPosition(store, workId),
      ]);
      return {
        detail,
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
  const { detail, sections, paragraphs, savedParagraphId } = data.data;
  const section = sections.find((candidate) => candidate.id === sectionId);
  if (!detail || !section) {
    return (
      <Screen>
        <MessageView message={t.reader.notFound} />
      </Screen>
    );
  }
  return (
    <ChapterView
      key={sectionId}
      detail={detail}
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
  sections,
  section,
  paragraphs,
  initialParagraphId,
  highlightedParagraphId,
  query,
}: ChapterProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const workId = detail.work.id;
  const neighbours = sectionNeighbours(sections, section.id);

  const listRef = useRef<FlatList<Paragraph>>(null);
  const retries = useRef(0);
  const [fraction, setFraction] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const writer = useReadingPositionWriter(workId, section.id);

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
    : `${percent}%`;

  const header = section.heading ? (
    <View style={styles.chapterHeading}>
      <AppText
        accessibilityRole="header"
        style={{
          fontFamily: fonts.readingBold,
          fontSize: Math.round(settings.fontSize * 1.4),
          lineHeight: Math.round(settings.fontSize * 1.4 * 1.3),
          color: colors.text,
          textAlign: 'left',
        }}
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
          title: detail.work.titleRo,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.reader.typographyLabel}
              accessibilityState={{ expanded: panelOpen }}
              onPress={() => setPanelOpen((open) => !open)}
              style={styles.typographyButton}
            >
              <AppText variant="label" style={{ color: colors.accent }}>
                {t.reader.typographyButton}
              </AppText>
            </Pressable>
          ),
        }}
      />
      {panelOpen ? (
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TypographyControls />
        </View>
      ) : null}
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
        contentContainerStyle={styles.content}
        style={styles.list}
      />
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${t.reader.progressLabel}: ${positionText}`}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          style={[styles.track, { backgroundColor: colors.border }]}
        >
          <View style={[styles.fill, { backgroundColor: colors.accent, width: `${percent}%` }]} />
        </View>
        <View style={styles.navRow}>
          <Button
            title={`‹ ${t.reader.previous}`}
            label={t.reader.previousLabel}
            disabled={!neighbours?.previous}
            onPress={() => goTo(neighbours?.previous ?? null)}
          />
          <AppText variant="caption" muted style={styles.position}>
            {positionText}
          </AppText>
          {neighbours?.next ? (
            <Button
              title={`${t.reader.next} ›`}
              label={t.reader.nextLabel}
              onPress={() => goTo(neighbours.next)}
            />
          ) : (
            <Button title={t.reader.toContents} onPress={() => router.replace(workHref(workId))} />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  chapterHeading: { marginBottom: 16, marginTop: 4 },
  panel: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  typographyButton: {
    minHeight: MIN_TARGET,
    minWidth: MIN_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 12, gap: 8 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  position: { flexShrink: 1, textAlign: 'center' },
});
