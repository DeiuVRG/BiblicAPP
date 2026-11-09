import type { Paragraph, Section } from '@biblioteca/shared';
import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { useEscapeKey } from '@/components/modal-behaviour';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { LoadingView, MessageView } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { Button } from '@/components/button';
import { useFeatures } from '@/config/features';
import { useContent } from '@/content/content-context';
import { resolveProvenance } from '@/content/provenance';
import { workTitle } from '@/content/titles';
import type { EditionDetail, SearchHit, WorkDetail } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { useT } from '@/i18n';
import { editionLabel, formatLifespan, formatYear } from '@/i18n/labels';
import { baseLanguage } from '@/i18n/language';
import { ro } from '@/i18n/ro';
import { en } from '@/i18n/en';
import { libraryAllWith, authorHref, readHref, workHref } from '@/navigation-hrefs';
import { copyText } from '@/reading/clipboard';
import { scrollFraction, sectionDepths, sectionNeighbours, toPercent } from '@/reading/navigation';
import { loadPair, savePair } from '@/reading/pair-store';
import { loadPosition, savePosition } from '@/reading/position-store';
import { getWorkSession, patchWorkSession } from '@/reading/reader-session';
import { readUrl } from '@/reading/site-url';
import { useWorkBookmark } from '@/reading/use-bookmarks';
import { useReadingMetrics } from '@/settings/reading-metrics';
import { useSettings } from '@/settings/settings-context';
import type { Strings } from '@/i18n/strings';
import { SectionBar } from '@/shell/section-bar';
import { useStorage } from '@/storage/key-value-store';
import { useLibrary } from '@/library/use-library';
import { useTheme } from '@/theme/theme-context';
import { BAR_HEIGHT } from '@/theme/tokens';

import { BottomBar } from './bottom-bar';
import type { BarKey } from './bottom-bar';
import { ChapterCard, EndOfWork, NextChapterCard } from './chapter-card';
import { chapterCardModel } from './chapter-card-model';
import { FindBar } from './find-bar';
import { LaneCards, LaneLabels, LaneRow } from './lanes';
import type { LaneInfo, LaneRowData } from './lanes';
import { OUTLINE_OVERLAY_WIDTH, LANES_MIN_AREA, readerMode, textPadding } from './layout';
import type { ReaderMode } from './layout';
import { OutlinePanel } from './outline-panel';
import { branchIds, buildOutline, revealing } from './outline-model';
import { initialPair, languageChoices, pairChoices, resolvePair } from './pair';
import { READING_MAX_FONT_SCALE, ReaderParagraph } from './reader-paragraph';
import { ReaderToolbar, ToolsDrawer } from './reader-toolbar';
import type { ToolItem } from './reader-toolbar';
import { useReaderKeys } from './reader-keys';
import { LanguageSheetBody, PairMenu, ToolsList } from './tools-panel';
import { TYPOGRAPHY_PANEL_WIDTH, TypographyBody, TypographyPopover } from './typography-panel';
import { TransparencyPanel } from '../transparency/transparency-panel';
import { buttonLabel } from '../transparency/transparency-text';
import { useFind } from './use-find';
import { useReadingPositionWriter } from './use-reading-position';
import { paragraphInView } from './viewable';
import type { ViewToken } from './viewable';

export { TYPOGRAPHY_PANEL_WIDTH };

interface Props {
  /** The work the section is expected to belong to (the `id` of the route). */
  workId: string;
  /** A section id identifies its edition: the reader shows that edition. */
  sectionId: string;
  /** Paragraph to scroll to (a link, a search result): it gets the `target` wash and bar. */
  targetParagraphId?: string;
  /** Words to find (a search result): the find bar opens with them. */
  query?: string;
  /** The language of the edition to read: the reader opens the aligned section of that edition. */
  lang?: string;
  /** Two editions read side by side ("ro+en"). */
  pair?: string;
}

interface LanesData {
  first: EditionDetail;
  second: EditionDetail;
  firstSection: Section | null;
  secondSection: Section | null;
  /** One row per paragraph of the source section. */
  rows: LaneRowData[];
  /** Which side the route's edition (the one whose sections the outline lists) is on. */
  driverIsFirst: boolean;
  pair: string;
}

interface ReaderData {
  detail: WorkDetail;
  /** The edition whose sections the reader moves through (the route's). */
  edition: EditionDetail;
  sections: Section[];
  section: Section;
  paragraphs: Paragraph[];
  savedParagraphId: string | null;
  /** The section of every other edition that renders this one; null where it is not translated yet. */
  aligned: Record<string, Section | null>;
  lanes: LanesData | null;
}

type Loaded =
  | { kind: 'missing' }
  | {
      kind: 'redirect';
      sectionId: string;
      paragraphId?: string;
      keep: { lang?: string; pair?: string };
    }
  | { kind: 'ready'; data: ReaderData };

/**
 * The reader's frame: the section bar shows (docs/ui-spec-v2.md, 4.1 and 8.1) and the brand bar does not,
 * because the reader has its own toolbar. The bar is not a sticky header here: the list under it is the
 * scroll container, so the bar stays where it is.
 */
function ReaderFrame({ children }: { children: React.ReactNode }) {
  return (
    <Screen>
      <SectionBar />
      {children}
    </Screen>
  );
}

export function ReaderScreen({ workId, sectionId, targetParagraphId, query, lang, pair }: Props) {
  const t = useT();
  const store = useStorage();
  const router = useRouter();
  const { settings } = useSettings();
  const data = useRepositoryQuery<Loaded>(
    async (repository) => {
      const location = await repository.locateSection(sectionId);
      // A section that is not in this work (or not in any) is not found.
      if (!location || location.workId !== workId) return { kind: 'missing' };
      const [detail, edition] = await Promise.all([
        repository.getWork(workId, settings.readingLanguage),
        repository.getEdition(location.editionId),
      ]);
      if (!detail || !edition) return { kind: 'missing' };

      // `?lang=` names the language to read: the aligned section of that edition, if there is one.
      if (lang && baseLanguage(edition.language) !== lang) {
        const choice = languageChoices(detail.editions).find(
          (candidate) =>
            candidate.token === lang || baseLanguage(candidate.edition.language) === lang,
        );
        if (choice && choice.edition.editionId !== edition.editionId) {
          const aligned = await repository.getAlignedSection(sectionId, choice.edition.editionId);
          if (aligned) {
            let paragraphId: string | undefined;
            if (targetParagraphId) {
              const rows = await repository.getAlignedParagraphs(
                sectionId,
                choice.edition.editionId,
              );
              paragraphId = rows.find((row) => row.paragraph?.id === targetParagraphId)?.other?.id;
            }
            return { kind: 'redirect', sectionId: aligned.id, paragraphId, keep: { lang } };
          }
        }
      }

      // `?pair=` names two editions to read side by side; the outline is the fuller one's.
      const resolved = resolvePair(pair, detail.editions);
      let driverId = edition.editionId;
      if (resolved) {
        const driver =
          resolved.second.sectionCount > resolved.first.sectionCount
            ? resolved.second
            : resolved.first;
        if (driver.editionId !== edition.editionId) {
          const aligned = await repository.getAlignedSection(sectionId, driver.editionId);
          if (aligned) {
            let paragraphId: string | undefined;
            if (targetParagraphId) {
              const rows = await repository.getAlignedParagraphs(sectionId, driver.editionId);
              paragraphId = rows.find((row) => row.paragraph?.id === targetParagraphId)?.other?.id;
            }
            return { kind: 'redirect', sectionId: aligned.id, paragraphId, keep: { pair } };
          }
        } else {
          driverId = driver.editionId;
        }
      }

      const driverEdition =
        driverId === edition.editionId ? edition : await repository.getEdition(driverId);
      if (!driverEdition) return { kind: 'missing' };
      const [sections, paragraphs] = await Promise.all([
        repository.getSections(driverEdition.editionId),
        repository.getParagraphs(sectionId),
      ]);
      const section = sections.find((candidate) => candidate.id === sectionId);
      if (!section) return { kind: 'missing' };

      const aligned: Record<string, Section | null> = {};
      await Promise.all(
        detail.editions
          .filter((other) => other.editionId !== driverEdition.editionId)
          .map(async (other) => {
            aligned[other.editionId] = await repository.getAlignedSection(
              sectionId,
              other.editionId,
            );
          }),
      );

      // The source edition also finds the position an older version saved for the whole work.
      const saved = await loadPosition(
        store,
        driverEdition.editionId,
        driverEdition.kind === 'source' ? workId : undefined,
      );

      let lanes: LanesData | null = null;
      if (resolved && driverId === edition.editionId) {
        const driverIsFirst = resolved.first.editionId === driverEdition.editionId;
        const other = driverIsFirst ? resolved.second : resolved.first;
        const [otherEdition, otherSection, aligned2] = await Promise.all([
          repository.getEdition(other.editionId),
          repository.getAlignedSection(sectionId, other.editionId),
          repository.getAlignedParagraphs(sectionId, other.editionId),
        ]);
        if (otherEdition) {
          lanes = {
            first: driverIsFirst ? driverEdition : otherEdition,
            second: driverIsFirst ? otherEdition : driverEdition,
            firstSection: driverIsFirst ? section : otherSection,
            secondSection: driverIsFirst ? otherSection : section,
            rows: aligned2.map((row) => ({
              key: row.sourceId,
              first: driverIsFirst ? row.paragraph : row.other,
              second: driverIsFirst ? row.other : row.paragraph,
            })),
            driverIsFirst,
            pair: resolved.pair,
          };
        }
      }

      return {
        kind: 'ready',
        data: {
          detail,
          edition: driverEdition,
          sections,
          section,
          paragraphs,
          savedParagraphId: saved?.sectionId === sectionId ? saved.paragraphId : null,
          aligned,
          lanes,
        },
      };
    },
    [workId, sectionId, store, lang, pair, targetParagraphId, settings.readingLanguage],
  );

  const loaded = data.status === 'ready' ? data.data : null;
  // A redirect (the language or the pair asked for is in another section) is a replace, once.
  useEffect(() => {
    if (loaded?.kind !== 'redirect') return;
    router.replace(
      readHref(workId, loaded.sectionId, {
        ...(loaded.paragraphId ? { p: loaded.paragraphId } : null),
        ...(query ? { q: query } : null),
        ...loaded.keep,
      }),
    );
  }, [loaded, router, workId, query]);

  if (data.status === 'loading' || loaded?.kind === 'redirect') {
    return (
      <ReaderFrame>
        <LoadingView message={t.reader.loadingText} />
      </ReaderFrame>
    );
  }
  if (data.status === 'error') {
    return (
      <ReaderFrame>
        <MessageView message={t.common.error} heading />
      </ReaderFrame>
    );
  }
  if (!loaded || loaded.kind === 'missing') {
    return (
      <ReaderFrame>
        <MessageView message={t.reader.notFound} heading />
      </ReaderFrame>
    );
  }
  return (
    <ReaderView
      key={sectionId}
      data={loaded.data}
      targetParagraphId={targetParagraphId}
      query={query}
      lang={lang}
      pair={pair}
    />
  );
}

interface ViewProps {
  data: ReaderData;
  targetParagraphId: string | undefined;
  query: string | undefined;
  lang: string | undefined;
  pair: string | undefined;
}

const MAX_SCROLL_RETRIES = 12;
/** Upper bound of rows rendered up front so that a saved position can be measured. */
const MAX_EAGER_ITEMS = 400;

type Item =
  | { kind: 'labels' }
  | { kind: 'cards' }
  | { kind: 'paragraph'; paragraph: Paragraph }
  | { kind: 'row'; row: LaneRowData };

function ReaderView({ data, targetParagraphId, query, lang, pair }: ViewProps) {
  const t = useT();
  const router = useRouter();
  const store = useStorage();
  const focused = useIsFocused();
  const toast = useToast();
  const features = useFeatures();
  const content = useContent();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { settings, update } = useSettings();
  const { colors, name: themeName } = useTheme();
  const metrics = useReadingMetrics();
  const library = useLibrary();
  const bookmark = useWorkBookmark(data.detail.work.id);
  const mode: ReaderMode = readerMode(windowWidth);
  const phone = mode === 'phone';
  const { detail, edition, sections, section, paragraphs, lanes, aligned } = data;
  const workId = detail.work.id;
  const reading = settings.readingLanguage;
  const title = workTitle(detail.work, reading);
  const provenance = useMemo(() => resolveProvenance(edition.edition), [edition]);
  const neighbours = sectionNeighbours(sections, section.id);
  const outline = useMemo(() => buildOutline(sections), [sections]);
  const depth = useMemo(() => sectionDepths(sections).get(section.id) ?? 0, [sections, section.id]);
  const session = getWorkSession(workId);
  const several = detail.editions.length > 1;

  // ---- who wrote it, for the title block --------------------------------------------------------
  const libraryWork =
    library.status === 'ready' ? library.data.model.workById.get(workId) : undefined;
  const group =
    library.status === 'ready' && libraryWork
      ? library.data.model.groupByKey.get(libraryWork.groupKey)
      : undefined;
  const body = group?.kind === 'body' ? group : null;
  const authorName = group
    ? reading === 'ro'
      ? group.nameRo
      : group.nameEn
    : detail.work.author.name;
  const author = body
    ? null
    : {
        name: authorName,
        href:
          group?.slug && features.authorPages && group.kind === 'author'
            ? authorHref(group.slug)
            : libraryAllWith({ q: authorName }),
      };
  const meta = body
    ? [reading === 'ro' ? body.nameRo : body.nameEn, formatYear(body.year, t)]
        .filter(Boolean)
        .join(' · ')
    : formatLifespan(detail.work.author.born, detail.work.author.died, t);

  // ---- panels ------------------------------------------------------------------------------------
  const [outlineOpen, setOutlineOpenState] = useState<boolean>(
    () => session.outlineOpen ?? mode === 'desktop',
  );
  const setOutlineOpen = useCallback(
    (open: boolean) => {
      setOutlineOpenState(open);
      patchWorkSession(workId, { outlineOpen: open });
    },
    [workId],
  );
  const [aaOpen, setAaOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [pairMenuOpen, setPairMenuOpen] = useState(false);
  const [transparencyOpen, setTransparencyOpen] = useState(false);
  // The paragraph the reader was at when the panel opened: the report names the place exactly.
  const [transparencyParagraph, setTransparencyParagraph] = useState<string | null>(null);
  const [outlineQuery, setOutlineQueryState] = useState(session.outlineQuery);
  const [openBranches, setOpenBranchesState] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        session.openBranches ??
          outline.find((entry) => entry.section.id === section.id)?.ancestors ??
          [],
      ),
  );
  const setOutlineQuery = (value: string) => {
    setOutlineQueryState(value);
    patchWorkSession(workId, { outlineQuery: value });
  };
  const setOpenBranches = (next: ReadonlySet<string>) => {
    setOpenBranchesState(next);
    patchWorkSession(workId, { openBranches: [...next] });
  };

  // ---- the text, its position and its progress --------------------------------------------------
  const listRef = useRef<FlatList<Item>>(null);
  const retries = useRef(0);
  // Where the reader is: the place the text opens at until the list reports what is in view.
  const currentParagraph = useRef<string | null>(
    targetParagraphId ?? data.savedParagraphId ?? null,
  );
  const [fraction, setFraction] = useState(0);
  const [areaWidth, setAreaWidth] = useState(0);
  const [target, setTarget] = useState<string | null>(targetParagraphId ?? null);
  const writer = useReadingPositionWriter(edition.editionId, section.id);
  const stacked = lanes !== null && areaWidth > 0 && areaWidth < LANES_MIN_AREA;
  const initialParagraphId = targetParagraphId ?? data.savedParagraphId;

  const items = useMemo<Item[]>(() => {
    if (!lanes) return paragraphs.map((paragraph) => ({ kind: 'paragraph', paragraph }));
    return [
      ...(stacked ? [] : [{ kind: 'labels' as const }]),
      { kind: 'cards' as const },
      ...lanes.rows.map((row) => ({ kind: 'row' as const, row })),
    ];
  }, [lanes, paragraphs, stacked]);

  /** The index of the item that holds a paragraph of the edition read (the route's). */
  const indexOfParagraph = useCallback(
    (paragraphId: string | null | undefined): number => {
      if (!paragraphId) return -1;
      return items.findIndex((item) =>
        item.kind === 'paragraph'
          ? item.paragraph.id === paragraphId
          : item.kind === 'row'
            ? item.row.first?.id === paragraphId || item.row.second?.id === paragraphId
            : false,
      );
    },
    [items],
  );
  const targetIndex = useMemo(
    () => indexOfParagraph(initialParagraphId),
    [indexOfParagraph, initialParagraphId],
  );

  // Restore the saved position (or jump to a link) once the list is mounted.
  useEffect(() => {
    const first = lanes ? (stacked ? 1 : 2) : 1;
    if (targetIndex < first) {
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
  }, [targetIndex, writer, lanes, stacked]);

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
  const driverIsFirst = lanes?.driverIsFirst ?? true;
  const driverSide = useRef(driverIsFirst);
  useEffect(() => {
    driverSide.current = driverIsFirst;
  }, [driverIsFirst]);
  const [onViewableItemsChanged] = useState(
    () =>
      ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const paragraphId = paragraphInView(viewableItems, driverSide.current);
        if (paragraphId) {
          currentParagraph.current = paragraphId;
          writer.track(paragraphId);
        }
      },
  );
  const [viewabilityConfig] = useState(() => ({ itemVisiblePercentThreshold: 10 }));

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const next = scrollFraction(contentOffset.y, contentSize.height, layoutMeasurement.height);
    setFraction((previous) => (toPercent(previous) === toPercent(next) ? previous : next));
  }, []);

  const scrollToParagraph = useCallback(
    (paragraphId: string) => {
      const index = indexOfParagraph(paragraphId);
      if (index < 0) return;
      retries.current = 0;
      listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.2 });
    },
    [indexOfParagraph],
  );

  // ---- going somewhere ---------------------------------------------------------------------------
  const carry = useMemo(() => (lanes ? { pair: lanes.pair } : lang ? { lang } : {}), [lanes, lang]);
  const go = useCallback(
    (sectionId: string, extra?: { p?: string; q?: string }) => {
      router.replace(readHref(workId, sectionId, { ...carry, ...extra }));
    },
    [router, workId, carry],
  );
  const goTo = (target: Section | null) => {
    if (target) go(target.id);
  };
  const index = neighbours ? neighbours.index + 1 : 1;
  const total = sections.length;

  // ---- find in text ------------------------------------------------------------------------------
  const find = useFind({
    editionId: edition.editionId,
    initialQuery: query ?? session.findQuery,
    targetParagraphId,
    sectionId: section.id,
    onOpenHit: (hit: SearchHit, words: string) => {
      if (hit.sectionId === section.id) {
        setTarget(hit.paragraphId);
        scrollToParagraph(hit.paragraphId);
      } else {
        go(hit.sectionId, { p: hit.paragraphId, q: words });
      }
    },
    onQuery: (value) => patchWorkSession(workId, { findQuery: value }),
  });
  const openFind = useCallback(() => {
    if (!find.open) {
      patchWorkSession(workId, {
        findOrigin: {
          editionId: edition.editionId,
          sectionId: section.id,
          paragraphId: currentParagraph.current,
        },
      });
    }
    find.openBar();
    // The bar replaces the panels that were open: it is the topmost layer.
    setAaOpen(false);
    setPairMenuOpen(false);
  }, [find, workId, edition.editionId, section.id]);
  const closeFind = useCallback(() => {
    const origin = getWorkSession(workId).findOrigin;
    find.closeBar();
    patchWorkSession(workId, { findOrigin: null });
    setTarget(targetParagraphId ?? null);
    // Escape puts the reader back where they were when the bar opened.
    if (!origin) return;
    if (origin.sectionId === section.id) {
      if (origin.paragraphId) scrollToParagraph(origin.paragraphId);
    } else {
      void savePosition(store, origin.editionId, {
        sectionId: origin.sectionId,
        paragraphId: origin.paragraphId,
      }).then(() => go(origin.sectionId));
    }
  }, [find, workId, section.id, scrollToParagraph, store, go, targetParagraphId]);

  // ---- the toolbar's actions ---------------------------------------------------------------------
  const choices = useMemo(() => languageChoices(detail.editions), [detail.editions]);
  const pairs = useMemo(() => pairChoices(detail.editions, reading), [detail.editions, reading]);
  const currentToken =
    choices.find((choice) => choice.edition.editionId === edition.editionId)?.token ?? null;
  const disabledLanguages = useMemo(
    () =>
      new Set(
        choices
          .filter(
            (choice) =>
              choice.edition.editionId !== edition.editionId && !aligned[choice.edition.editionId],
          )
          .map((choice) => choice.token),
      ),
    [choices, edition.editionId, aligned],
  );

  /** Switches the text to another edition and keeps the place: the aligned paragraph is where it opens. */
  const switchLanguage = useCallback(
    async (token: string) => {
      const choice = choices.find((candidate) => candidate.token === token);
      if (!choice || content.status !== 'ready') return;
      if (!lanes && choice.edition.editionId === edition.editionId) return;
      const otherId = choice.edition.editionId;
      const to = otherId === edition.editionId ? section : aligned[otherId];
      if (!to) return;
      const place = currentParagraph.current;
      let paragraphId: string | null = null;
      if (place && otherId !== edition.editionId) {
        const rows = await content.repository.getAlignedParagraphs(section.id, otherId);
        paragraphId = rows.find((row) => row.paragraph?.id === place)?.other?.id ?? null;
      } else if (place) {
        paragraphId = place;
      }
      await savePosition(store, otherId, { sectionId: to.id, paragraphId });
      setPairMenuOpen(false);
      setLanguageOpen(false);
      router.replace(readHref(workId, to.id, { lang: token }));
    },
    [choices, content, lanes, edition.editionId, section, aligned, store, router, workId],
  );

  const startLanes = useCallback(
    async (chosen?: string) => {
      const remembered = await loadPair(store, workId);
      const next = chosen ?? initialPair(detail.editions, reading, remembered, settings.readerPair);
      if (!next) return;
      await savePair(store, workId, next);
      update({ readerPair: next });
      setPairMenuOpen(false);
      setLanguageOpen(false);
      router.replace(readHref(workId, section.id, { pair: next }));
    },
    [store, workId, detail.editions, reading, settings.readerPair, update, router, section.id],
  );
  const stopLanes = useCallback(() => {
    setPairMenuOpen(false);
    setLanguageOpen(false);
    const token = choices.find((choice) => choice.edition.editionId === edition.editionId)?.token;
    router.replace(readHref(workId, section.id, token ? { lang: token } : undefined));
  }, [choices, edition.editionId, router, workId, section.id]);
  const onLanes = () => {
    if (pairs.length > 1) setPairMenuOpen((open) => !open);
    else if (lanes) stopLanes();
    else void startLanes();
  };

  // ---- tools -------------------------------------------------------------------------------------
  const nextTheme = (() => {
    const order = ['light', 'sepia', 'dark', 'system'] as const;
    const current = settings.theme === 'system' ? 'system' : settings.theme;
    return order[(order.indexOf(current) + 1) % order.length] ?? 'light';
  })();
  const themeNames = t.settings.themes;
  const copyLink = useCallback(async () => {
    const ok = await copyText(readUrl(workId, section.id, currentParagraph.current));
    toast.show(ok ? t.reader.linkCopied : t.reader.linkNotCopied);
  }, [workId, section.id, toast, t]);
  const openTransparency = () => {
    setTransparencyParagraph(currentParagraph.current);
    setTransparencyOpen(true);
  };
  const askHref = { pathname: '/ask', params: { scope: `work:${workId}` } } as never;
  const toolItems: ToolItem[] = [
    ...(phone && several
      ? [
          {
            key: 'language',
            label: t.reader.toolsPanel.language,
            onPress: () => {
              setToolsOpen(false);
              setLanguageOpen(true);
            },
          },
        ]
      : []),
    {
      key: 'theme',
      label: t.reader.toolsPanel.theme(themeNames[settings.theme]),
      accessibilityLabel: t.reader.toolsPanel.themeLabel(
        themeNames[settings.theme],
        themeNames[nextTheme],
      ),
      onPress: () => update({ theme: nextTheme }),
    },
    { key: 'copy-link', label: t.reader.toolsPanel.copyLink, onPress: () => void copyLink() },
    {
      key: 'bookmark',
      label: bookmark.bookmarked ? t.reader.toolsPanel.bookmarked : t.reader.toolsPanel.bookmark,
      accessibilityLabel: bookmark.bookmarked
        ? t.reader.toolsPanel.unbookmarkLabel
        : t.reader.toolsPanel.bookmarkLabel,
      active: bookmark.bookmarked,
      onPress: () => bookmark.toggle(edition.editionId),
    },
    {
      key: 'report',
      label: t.reader.toolsPanel.report,
      onPress: () => {
        setToolsOpen(false);
        openTransparency();
      },
    },
    {
      key: 'top',
      label: t.reader.toolsPanel.top,
      onPress: () => {
        setToolsOpen(false);
        const first = sections[0];
        if (first && first.id !== section.id) go(first.id);
        else listRef.current?.scrollToOffset({ offset: 0, animated: false });
      },
    },
    ...(features.ask
      ? [
          {
            key: 'ask',
            label: t.reader.toolsPanel.ask,
            accessibilityLabel: t.reader.toolsPanel.askLabel,
            onPress: () => router.push(askHref),
          },
        ]
      : []),
  ];

  // ---- the keyboard ------------------------------------------------------------------------------
  const modalOpen =
    transparencyOpen || (phone && (aaOpen || toolsOpen || languageOpen || outlineOpen));
  const closeTopmost = () => {
    if (find.open) closeFind();
    else if (aaOpen) setAaOpen(false);
    else if (pairMenuOpen) setPairMenuOpen(false);
    else if (toolsOpen) setToolsOpen(false);
    else if (mode !== 'desktop' && outlineOpen) setOutlineOpen(false);
  };
  useReaderKeys(focused && !modalOpen, {
    previous: () => goTo(neighbours?.previous ?? null),
    next: () => goTo(neighbours?.next ?? null),
    outline: () => setOutlineOpen(!outlineOpen),
    find: openFind,
    escape: closeTopmost,
    ...(features.ask ? { ask: () => router.push(askHref) } : null),
  });
  // A phone's panels are modals (Esc is theirs); the wide layers close with Escape through the handler above.
  useEscapeKey(false, () => undefined);

  // ---- drawing -----------------------------------------------------------------------------------
  const pad = textPadding(mode);
  const measure = lanes ? undefined : Math.min(960, Math.round(37 * metrics.fontSize));
  const contentStyle = {
    width: '100%' as const,
    alignSelf: 'center' as const,
    maxWidth: lanes ? 1440 + pad.side * 2 : (measure ?? 680) + pad.side * 2,
    paddingHorizontal: pad.side,
    paddingTop: pad.top,
    paddingBottom: pad.bottom,
  };
  const percent = toPercent(
    neighbours ? (neighbours.index + fraction) / neighbours.total : fraction,
  );
  // The words of a chapter card ("Capitolul", "Chapter") are the text's own language, not the interface's.
  const cardFor = (s: Section, language: string) => {
    const table: Strings =
      baseLanguage(language) === 'en' ? en : baseLanguage(language) === 'ro' ? ro : t;
    return chapterCardModel(s, depth, {
      chapter: table.reader.chapterWord,
      section: table.reader.sectionWord,
    });
  };
  const cardModel = cardFor(section, edition.language);

  const laneInfo = (e: EditionDetail): LaneInfo => ({
    language: e.language,
    label: editionLabel(e, t),
    short: editionLabel(e, t).split(' · ')[0] ?? editionLabel(e, t),
  });
  const firstLane = lanes ? laneInfo(lanes.first) : null;
  const secondLane = lanes ? laneInfo(lanes.second) : null;

  const partial =
    edition.kind === 'translation' && edition.sourceEditionId !== undefined
      ? (() => {
          const source = detail.editions.find(
            (candidate) => candidate.editionId === edition.sourceEditionId,
          );
          return source && edition.sectionCount < source.sectionCount
            ? t.reader.partialNote(edition.sectionCount, source.sectionCount)
            : null;
        })()
      : null;

  const hitId = find.hitParagraphId;
  const settingsKey = `${metrics.fontSize}|${metrics.lineHeight}|${themeName}|${settings.readingFont}|${target ?? ''}|${hitId ?? ''}|${find.query}|${stacked}`;

  const header = (
    <View>
      {partial ? (
        <AppText variant="caption" testID="partial-note" style={styles.partialNote}>
          {partial}
        </AppText>
      ) : null}
      {lanes ? null : (
        <ChapterCard
          model={cardModel}
          language={edition.language}
          fontSize={metrics.fontSize}
          wide={!phone && windowWidth >= 768}
          onCopyLink={() => void copyLink()}
          showAnchor={!phone}
        />
      )}
    </View>
  );
  const footer = (
    <View>
      {neighbours?.next ? (
        <NextChapterCard
          heading={neighbours.next.heading}
          language={edition.language}
          onPress={() => goTo(neighbours.next)}
        />
      ) : (
        <EndOfWork
          onContents={() => router.replace(workHref(workId, edition.editionId))}
          onAsk={features.ask ? () => router.push(askHref) : undefined}
        />
      )}
    </View>
  );

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case 'labels':
        return firstLane && secondLane ? (
          <LaneLabels first={firstLane} second={secondLane} />
        ) : null;
      case 'cards':
        return firstLane && secondLane && lanes ? (
          <LaneCards
            first={firstLane}
            second={secondLane}
            firstCard={
              lanes.firstSection ? cardFor(lanes.firstSection, lanes.first.language) : null
            }
            secondCard={
              lanes.secondSection ? cardFor(lanes.secondSection, lanes.second.language) : null
            }
            fontSize={metrics.fontSize}
            stacked={stacked}
          />
        ) : null;
      case 'row':
        return firstLane && secondLane ? (
          <LaneRow
            row={item.row}
            first={firstLane}
            second={secondLane}
            settings={{
              fontSize: metrics.fontSize,
              lineHeight: metrics.lineHeight,
              readingFont: settings.readingFont,
              query: find.query,
            }}
            stacked={stacked}
            targetId={target}
            hitId={hitId}
          />
        ) : null;
      case 'paragraph':
        return (
          <ReaderParagraph
            paragraph={item.paragraph}
            fontSize={metrics.fontSize}
            lineHeight={metrics.lineHeight}
            readingFont={settings.readingFont}
            isTarget={item.paragraph.id === target}
            isHit={item.paragraph.id === hitId}
            query={find.query || undefined}
            language={edition.language}
          />
        );
    }
  };

  const outlinePanel = (variant: ReaderMode) => (
    <OutlinePanel
      mode={variant}
      entries={outline}
      currentId={section.id}
      language={edition.language}
      query={outlineQuery}
      onQuery={setOutlineQuery}
      open={openBranches}
      onToggleBranch={(id) => {
        const next = new Set(openBranches);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setOpenBranches(next);
      }}
      onOpenAll={() => setOpenBranches(new Set(branchIds(outline)))}
      onCloseAll={() => setOpenBranches(new Set())}
      onShowCurrent={() => {
        setOutlineQuery('');
        setOpenBranches(revealing(outline, openBranches, section.id));
      }}
      onChoose={(id) => {
        // Below 1100 the outline closes after a choice; on a desktop it stays open.
        if (mode !== 'desktop') setOutlineOpen(false);
        if (id !== section.id) go(id);
      }}
      onHide={() => setOutlineOpen(false)}
    />
  );

  const popoverOpen = aaOpen || pairMenuOpen;
  const closePopovers = () => {
    setAaOpen(false);
    setPairMenuOpen(false);
  };
  const barActive: BarKey | null = outlineOpen
    ? 'contents'
    : find.open
      ? 'find'
      : languageOpen
        ? 'language'
        : aaOpen
          ? 'text'
          : toolsOpen
            ? 'tools'
            : null;
  const onBar = (key: BarKey) => {
    switch (key) {
      case 'contents':
        setOutlineOpen(!outlineOpen);
        break;
      case 'find':
        if (find.open) closeFind();
        else openFind();
        break;
      case 'language':
        setLanguageOpen(true);
        break;
      case 'text':
        setAaOpen(true);
        break;
      case 'tools':
        setToolsOpen(true);
        break;
    }
  };

  const transparencyEditionId = lanes
    ? (
        [lanes.first, lanes.second].find((candidate) => candidate.kind === 'translation') ??
        lanes.first
      ).editionId
    : edition.editionId;
  const transparencyProvenance =
    transparencyEditionId === edition.editionId
      ? provenance
      : resolveProvenance(
          (lanes?.first.editionId === transparencyEditionId ? lanes.first : lanes!.second).edition,
        );

  const stickyHeaderIndices = lanes && !stacked ? [0] : undefined;

  return (
    <Screen>
      <PageTitle parts={[section.heading, title]} />
      <SectionBar />
      {/* The first stop of the keyboard is the section bar; the skip link comes right after it. */}
      {Platform.OS === 'web' ? <SkipLink label={t.reader.skipToText} /> : null}
      <ReaderToolbar
        mode={mode}
        title={title}
        author={author}
        meta={meta}
        editionLabel={several ? editionLabel(edition, t) : null}
        contentsOpen={outlineOpen}
        onToggleContents={() => setOutlineOpen(!outlineOpen)}
        index={index}
        total={total}
        onPrevious={neighbours?.previous ? () => goTo(neighbours.previous) : null}
        onNext={neighbours?.next ? () => goTo(neighbours.next) : null}
        onJump={(position) => goTo(sections[position - 1] ?? null)}
        transparencyLabel={buttonLabel(transparencyProvenance, t)}
        transparencyOpen={transparencyOpen}
        onTransparency={openTransparency}
        languages={several ? choices : []}
        language={lanes ? null : currentToken}
        disabledLanguages={disabledLanguages}
        onLanguage={(token) => void switchLanguage(token)}
        lanesAvailable={pairs.length > 0}
        lanesOn={lanes !== null}
        lanesMenuOpen={pairMenuOpen}
        onLanes={onLanes}
        findOpen={find.open}
        onFind={() => (find.open ? closeFind() : openFind())}
        aaOpen={aaOpen}
        onAa={() => {
          setAaOpen(!aaOpen);
          setPairMenuOpen(false);
        }}
        toolsOpen={toolsOpen}
        onTools={() => setToolsOpen(!toolsOpen)}
        tools={toolItems}
        drawer={phone ? null : <ToolsDrawer items={toolItems} open={toolsOpen} />}
        popovers={
          phone ? null : (
            <>
              {aaOpen ? (
                <TypographyPopover right={24}>
                  <TypographyBody />
                </TypographyPopover>
              ) : null}
              {pairMenuOpen ? (
                <PairMenuPopover>
                  <PairMenu
                    pairs={pairs}
                    pair={lanes?.pair ?? null}
                    onPair={(next) => void startLanes(next)}
                  />
                  {lanes ? (
                    <Button
                      testID="pair-off"
                      variant="text"
                      title={t.reader.pair.off}
                      onPress={stopLanes}
                    />
                  ) : null}
                </PairMenuPopover>
              ) : null}
            </>
          )
        }
      />

      <View style={styles.body}>
        {mode === 'desktop' && outlineOpen ? outlinePanel('desktop') : null}
        <View
          testID="reader-text"
          nativeID="reader-text"
          {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : null)}
          onLayout={(event) => setAreaWidth(event.nativeEvent.layout.width)}
          style={styles.area}
        >
          {find.open ? (
            <FindBar
              text={find.text}
              onText={find.setText}
              onSearch={find.searchNow}
              status={find.status}
              onNext={find.next}
              onPrevious={find.previous}
              onClose={closeFind}
              phone={phone}
            />
          ) : null}
          <FlatList
            ref={listRef}
            testID="reader-list"
            data={items}
            keyExtractor={(item, position) =>
              item.kind === 'paragraph'
                ? item.paragraph.id
                : item.kind === 'row'
                  ? `row-${item.row.key}`
                  : `${item.kind}-${position}`
            }
            extraData={settingsKey}
            renderItem={renderItem}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            ListEmptyComponent={<AppText muted>{t.reader.emptySection}</AppText>}
            stickyHeaderIndices={stickyHeaderIndices}
            initialNumToRender={targetIndex > 0 ? Math.min(targetIndex + 8, MAX_EAGER_ITEMS) : 12}
            windowSize={11}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScroll={onScroll}
            scrollEventThrottle={64}
            onScrollToIndexFailed={onScrollToIndexFailed}
            contentContainerStyle={contentStyle}
            style={styles.list}
          />
        </View>
      </View>

      <ProgressBar
        percent={percent}
        bottom={phone ? 61 + insets.bottom : 0}
        label={t.reader.progressLabel}
      />
      {phone ? <BottomBar active={barActive} bilingual={several} onPress={onBar} /> : null}

      {/* A tablet: the outline is an overlay of 220 over the text, with a scrim behind it. */}
      {mode === 'tablet' && outlineOpen ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <Pressable
            testID="outline-scrim"
            accessible={false}
            onPress={() => setOutlineOpen(false)}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrimDrawer }]}
          />
          <View style={[styles.overlayPanel, { width: OUTLINE_OVERLAY_WIDTH }]}>
            {outlinePanel('tablet')}
          </View>
        </View>
      ) : null}
      {/* A phone: the outline is a full-width drawer (a modal: the page behind it is inert). */}
      {phone ? (
        <Modal
          visible={outlineOpen}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => setOutlineOpen(false)}
        >
          <View
            style={[
              styles.drawer,
              {
                backgroundColor: colors.cream,
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
              },
            ]}
          >
            {outlinePanel('phone')}
          </View>
        </Modal>
      ) : null}

      {popoverOpen && !phone ? (
        <Pressable
          testID="popover-backdrop"
          accessible={false}
          importantForAccessibility="no"
          onPress={closePopovers}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
      ) : null}

      {phone ? (
        <>
          <Sheet
            visible={aaOpen}
            onClose={() => setAaOpen(false)}
            title={t.reader.aa.title}
            testID="aa-sheet"
          >
            <TypographyBody
              phone
              onPrevious={
                neighbours?.previous
                  ? () => {
                      setAaOpen(false);
                      goTo(neighbours.previous);
                    }
                  : null
              }
              onNext={
                neighbours?.next
                  ? () => {
                      setAaOpen(false);
                      goTo(neighbours.next);
                    }
                  : null
              }
              onAbout={() => router.replace(workHref(workId, edition.editionId))}
            />
          </Sheet>
          <Sheet
            visible={toolsOpen}
            onClose={() => setToolsOpen(false)}
            title={t.reader.toolsPanel.title}
            testID="tools-sheet"
          >
            <ToolsList items={toolItems} />
          </Sheet>
          <Sheet
            visible={languageOpen}
            onClose={() => setLanguageOpen(false)}
            title={t.reader.toolsPanel.language}
            testID="language-sheet"
          >
            <LanguageSheetBody
              languages={choices}
              language={currentToken}
              disabled={disabledLanguages}
              onLanguage={(token) => void switchLanguage(token)}
              lanesAvailable={pairs.length > 0}
              lanesOn={lanes !== null}
              onLanes={() => void startLanes()}
              onOneLanguage={stopLanes}
              pairs={pairs}
              pair={lanes?.pair ?? null}
              onPair={(next) => void startLanes(next)}
            />
          </Sheet>
        </>
      ) : null}

      <TransparencyPanel
        visible={transparencyOpen}
        onClose={() => setTransparencyOpen(false)}
        workId={workId}
        editionId={transparencyEditionId}
        place={{
          sectionId: section.id,
          sectionHeading: section.heading,
          paragraphId: transparencyParagraph,
        }}
        onViewSource={(sourceEditionId) => {
          const choice = choices.find(
            (candidate) => candidate.edition.editionId === sourceEditionId,
          );
          if (choice) void switchLanguage(choice.token);
        }}
      />
    </Screen>
  );
}

/** The menu of pairs under the lanes control: a card like the `Aa` popover. */
function PairMenuPopover({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      testID="pair-popover"
      style={[styles.pairPopover, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {children}
    </View>
  );
}

/** The link "Treci la text" (web): the first stop of the keyboard, it takes the focus to the text. */
function SkipLink({ label }: { label: string }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID="skip-link"
      accessibilityRole="link"
      accessibilityLabel={label}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => {
        if (typeof document !== 'undefined') document.getElementById('reader-text')?.focus();
      }}
      style={[
        styles.skip,
        {
          backgroundColor: colors.surface,
          borderColor: colors.accentStrong,
          opacity: focused ? 1 : 0,
        },
        focused ? null : styles.skipHidden,
      ]}
    >
      <AppText variant="meta" style={{ color: colors.accentStrong }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** The 3 point bar at the very bottom: the share of the edition read, growing with the scroll. */
function ProgressBar({
  percent,
  bottom,
  label,
}: {
  percent: number;
  bottom: number;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID="progress-bar"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      pointerEvents="none"
      style={[styles.progress, { bottom, backgroundColor: colors.border }]}
    >
      <View style={[styles.fill, { backgroundColor: colors.text, width: `${percent}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, flexDirection: 'row' },
  area: { flex: 1, minWidth: 0 },
  list: { flex: 1 },
  partialNote: { marginBottom: 12 },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 25, flexDirection: 'row' },
  overlayPanel: { height: '100%' },
  drawer: { flex: 1 },
  backdrop: { zIndex: 5 },
  pairPopover: {
    position: 'absolute',
    top: '100%',
    right: 190,
    marginTop: 4,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderRadius: 6,
    zIndex: 30,
  },
  skip: {
    position: 'absolute',
    // Under the section bar, over the toolbar, only while it has the focus.
    top: 56,
    left: 8,
    zIndex: 50,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 3,
  },
  skipHidden: { top: -80 },
  progress: { position: 'absolute', left: 0, right: 0, height: BAR_HEIGHT.progress, zIndex: 15 },
  fill: { height: BAR_HEIGHT.progress },
});

export { READING_MAX_FONT_SCALE };
