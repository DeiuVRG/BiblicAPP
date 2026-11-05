import { Link } from 'expo-router';
import { Fragment, useCallback, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, TextInputInstance, ViewStyle } from 'react-native';
import type { ElementRef, ReactNode, Ref } from 'react';

import { AppText, useTypeStyle } from '@/components/app-text';
import { Band } from '@/components/band';
import { Chip } from '@/components/chip';
import { useFocusRing } from '@/components/focus-ring';
import { Hairline } from '@/components/hairline';
import { Hero } from '@/components/hero';
import { HighlightedText } from '@/components/highlighted-text';
import { useHover } from '@/components/hover';
import { PageTitle } from '@/components/page-title';
import { pressStyle } from '@/components/press';
import { SearchField } from '@/components/search-field';
import { SegmentedControl } from '@/components/segmented-control';
import { LoadingView, MessageView } from '@/components/state-views';
import { workTitle } from '@/content/titles';
import type { SearchHit } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { useCommittedText } from '@/hooks/use-committed-text';
import { useUrlState } from '@/hooks/use-url-state';
import { useT } from '@/i18n';
import type { ReadingLanguage } from '@/i18n/language';
import { editionLanguageLabel } from '@/i18n/labels';
import { editionBadges, groupNameOf } from '@/library/labels';
import { filterWorks, groupName, matchingGroups, EMPTY_QUERY } from '@/library/model';
import type { LibraryModel } from '@/library/model';
import { useLibrary } from '@/library/use-library';
import { libraryAllWith, readHref } from '@/navigation-hrefs';
import { useSettings } from '@/settings/settings-context';
import { Main, PageScroll } from '@/shell/page-scroll';
import { useSlashTarget } from '@/shell/use-slash-target';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';
import { EditionBadges, LibraryRow } from '@/features/library/library-row';

const MIN_QUERY_LENGTH = 2;
/**
 * At most this many passages are listed (the same cap as the repository's `MAX_SEARCH_HITS`), and
 * each edition is asked for no more than this: when an edition reaches it, there may be more.
 */
const RESULT_CAP = 50;

/** What the arrow Down in the field moves the focus to: the first result on the page. */
type FocusHandle = ElementRef<typeof View>;

export type SearchMode = 'works' | 'passages';

interface SearchState {
  q: string;
  mode: SearchMode;
}

const parseSearch = (params: Record<string, string | string[] | undefined>): SearchState => {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return {
    q: one(params.q)?.trim() ?? '',
    mode: one(params.mode) === 'passages' ? 'passages' : 'works',
  };
};

const serializeSearch = (state: SearchState): Record<string, string> => ({
  ...(state.q === '' ? null : { q: state.q }),
  ...(state.mode === 'works' ? null : { mode: state.mode }),
});

/**
 * Search (docs/ui-spec-v2.md, 10): a large field and a choice of what to search. "Lucrări" finds
 * authors and works by name, on the catalogue (the engine of the library's search by name);
 * "Pasaje" finds words in the texts, in every installed edition. The state is in the URL
 * (`?q=&mode=`); `/` focuses the field from anywhere on web, Escape clears it.
 */
export function SearchScreen() {
  const t = useT();
  const { settings } = useSettings();
  const library = useLibrary();
  const [state, setState] = useUrlState(parseSearch, serializeSearch);
  const commitQuery = useCallback(
    (q: string) => setState((previous) => ({ ...previous, q })),
    [setState],
  );
  const [text, setText] = useCommittedText(state.q, commitQuery);
  const inputRef = useRef<TextInputInstance>(null);
  // The first result of the page, whatever it is: the arrow Down in the field moves the focus to it.
  const firstResult = useRef<FocusHandle | null>(null);

  useSlashTarget(inputRef);

  const active = state.q.length >= MIN_QUERY_LENGTH;
  const language = settings.readingLanguage;
  return (
    <PageScroll>
      <PageTitle parts={[t.search.title]} />
      <Main>
        <Hero
          kind="library"
          testID="search-hero"
          kicker={t.search.eyebrow}
          pilcrow={false}
          title={t.search.title}
        />
        <Band tone="background" padding={{ top: 32, bottom: 72 }} testID="search-body">
          <View style={styles.column}>
            <View style={styles.controls}>
              <SearchField
                testID="search-input"
                value={text}
                onChangeText={setText}
                placeholder={t.search.fieldPlaceholder}
                label={t.search.label}
                clearLabel={t.search.clear}
                autoFocus
                inputRef={inputRef}
                onArrowDown={() => firstResult.current?.focus()}
              />
              <View style={styles.modes}>
                <SegmentedControl
                  label={t.search.modes}
                  options={[
                    { value: 'works' as const, label: t.search.modeWorks },
                    { value: 'passages' as const, label: t.search.modePassages },
                  ]}
                  value={state.mode}
                  onChange={(mode) => setState((previous) => ({ ...previous, mode }))}
                />
              </View>
            </View>
            {!active ? (
              <AppText variant="lead" style={styles.hint} accessibilityLiveRegion="polite">
                {t.search.hint}
              </AppText>
            ) : state.mode === 'works' ? (
              <>
                {library.status === 'loading' ? <LoadingView message={t.search.searching} /> : null}
                {library.status === 'error' ? <MessageView message={t.common.error} /> : null}
                {library.status === 'ready' ? (
                  <WorkResults
                    model={library.data.model}
                    query={state.q}
                    language={language}
                    first={firstResult}
                  />
                ) : null}
              </>
            ) : (
              <PassageResults query={state.q} language={language} first={firstResult} />
            )}
          </View>
        </Band>
      </Main>
    </PageScroll>
  );
}

/** The "Lucrări" mode: authors whose name matches, then the works (ranked as the library ranks them). */
function WorkResults({
  model,
  query,
  language,
  first,
}: {
  model: LibraryModel;
  query: string;
  language: ReadingLanguage;
  first: Ref<FocusHandle>;
}) {
  const t = useT();
  // The name of an author is set like the title of a row: its own colour and face (a bare `Text`
  // is black, which is invisible on the dark theme).
  const nameStyle = useTypeStyle('title');
  const authors = matchingGroups(model, query);
  const works = filterWorks(model, { ...EMPTY_QUERY, q: query });
  if (authors.length === 0 && works.length === 0) {
    return <MessageView message={t.search.noResults} />;
  }
  return (
    <View testID="search-results" style={styles.results}>
      <AppText variant="label" testID="search-count" accessibilityLiveRegion="polite">
        {t.search.nameResults(authors.length, works.length)}
      </AppText>
      <Hairline />
      {authors.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading" level={2}>
            {t.search.authorsHeading}
          </AppText>
          {authors.map((group, index) => {
            const name = groupName(group, language);
            return (
              <Fragment key={group.key}>
                {index > 0 ? <Hairline /> : null}
                <Link href={libraryAllWith({ q: name })} asChild>
                  <ResultLink
                    ref={index === 0 ? first : undefined}
                    testID={`search-author-${group.slug ?? group.key}`}
                    accessibilityLabel={t.search.openAuthor(name)}
                  >
                    <HighlightedText text={name} query={query} style={nameStyle} />
                    <AppText variant="meta">{t.counts.works(group.workIds.length)}</AppText>
                  </ResultLink>
                </Link>
              </Fragment>
            );
          })}
        </View>
      ) : null}
      {works.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading" level={2}>
            {t.search.worksHeading}
          </AppText>
          {works.map((work, index) => (
            <View key={work.workId} testID={`search-result-${index}`}>
              {index > 0 ? <Hairline /> : null}
              <LibraryRow
                work={work}
                model={model}
                language={language}
                query={query}
                focusRef={index === 0 && authors.length === 0 ? first : undefined}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * What a search of the passages found: the hits to show grouped by work, and how many were found
 * at most. Every installed edition is searched on its own (`searchEdition`), so the first edition
 * cannot fill the cap for the others; the hits shown are taken from the editions in turn.
 */
export interface PassageResultsData {
  /** The hits that are listed, by work, in the order of the library; an edition's own in reading order. */
  byWork: Map<string, SearchHit[]>;
  /** The titles of the works, in the reading language. */
  titles: Map<string, string>;
  /** How many hits are listed. */
  shown: number;
  /** True when the list was cut: more than the cap was found, or an edition reached its own cap. */
  capped: boolean;
}

/** Takes up to `cap` hits from the lists in turn (one from each, then one more from each ...). */
export function takeInTurn<T>(lists: readonly (readonly T[])[], cap: number): T[][] {
  const taken: T[][] = lists.map(() => []);
  let total = 0;
  for (let round = 0; total < cap; round += 1) {
    let any = false;
    lists.forEach((list, index) => {
      const item = list[round];
      if (total < cap && item !== undefined) {
        taken[index]!.push(item);
        total += 1;
        any = true;
      }
    });
    if (!any) break;
  }
  return taken;
}

/** The "Pasaje" mode: words in the texts, grouped by work, each hit opening the reader at its paragraph. */
function PassageResults({
  query,
  language,
  first,
}: {
  query: string;
  language: ReadingLanguage;
  first: Ref<FocusHandle>;
}) {
  const t = useT();
  const library = useLibrary();
  const results = useRepositoryQuery<PassageResultsData>(
    async (repository) => {
      const works = await repository.listWorks(language);
      const editions = works.flatMap((work) =>
        work.editions.map((edition) => ({ workId: work.workId, editionId: edition.editionId })),
      );
      const found = await Promise.all(
        editions.map(({ editionId }) =>
          repository.searchEdition(editionId, query, { limit: RESULT_CAP }),
        ),
      );
      const kept = takeInTurn(found, RESULT_CAP);
      const byWork = new Map<string, SearchHit[]>();
      editions.forEach(({ workId }, index) => {
        const hits = kept[index] ?? [];
        if (hits.length > 0) byWork.set(workId, [...(byWork.get(workId) ?? []), ...hits]);
      });
      const total = found.reduce((sum, hits) => sum + hits.length, 0);
      return {
        byWork,
        titles: new Map(works.map((work) => [work.workId, workTitle(work, language)])),
        shown: kept.reduce((sum, hits) => sum + hits.length, 0),
        capped: total > RESULT_CAP || found.some((hits) => hits.length >= RESULT_CAP),
      };
    },
    [query, language],
  );
  if (results.status === 'loading') return <LoadingView message={t.search.searching} />;
  if (results.status === 'error') return <MessageView message={t.common.error} />;
  const { byWork, titles, shown, capped } = results.data;
  if (shown === 0) return <MessageView message={t.search.noResults} />;

  const model = library.status === 'ready' ? library.data.model : null;
  let index = 0;
  return (
    <View testID="search-results" style={styles.results}>
      <AppText variant="label" testID="search-count" accessibilityLiveRegion="polite">
        {capped
          ? t.search.resultsCappedInWorks(shown, byWork.size)
          : t.search.inWorks(shown, byWork.size)}
      </AppText>
      <Hairline />
      {[...byWork].map(([workId, workHits]) => {
        const work = model?.workById.get(workId);
        return (
          <View key={workId} style={styles.section}>
            <AppText variant="heading" level={2}>
              {titles.get(workId) ?? ''}
            </AppText>
            {model && work ? (
              <View testID={`search-group-${work.slug}`} style={styles.group}>
                <AppText variant="label">{groupNameOf(model, work, language)}</AppText>
                <EditionBadges badges={editionBadges(work.summary.editions, t)} />
              </View>
            ) : null}
            {workHits.map((hit) => {
              const position = index;
              index += 1;
              return (
                <HitRow
                  key={hit.paragraphId}
                  hit={hit}
                  query={query}
                  title={titles.get(workId) ?? ''}
                  position={position}
                  focusRef={position === 0 ? first : undefined}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function HitRow({
  hit,
  query,
  title,
  position,
  focusRef,
}: {
  hit: SearchHit;
  query: string;
  title: string;
  position: number;
  focusRef?: Ref<FocusHandle>;
}) {
  const t = useT();
  const snippetStyle = useTypeStyle('reading', false);
  const language = editionLanguageLabel(hit.language, t);
  const place = [hit.sectionHeading, language, title].filter(Boolean).join(' · ');
  return (
    <>
      {position >= 0 ? <Hairline /> : null}
      <Link href={readHref(hit.workId, hit.sectionId, { p: hit.paragraphId, q: query })} asChild>
        <ResultLink
          ref={focusRef}
          testID={`search-result-${position}`}
          accessibilityLabel={`${t.search.openResult(place)}: ${hit.snippet}`}
          stacked
        >
          <View style={styles.place}>
            <AppText variant="label" numberOfLines={2} style={styles.heading}>
              {hit.sectionHeading || title}
            </AppText>
            <Chip label={hit.language.toUpperCase()} accessibilityLabel={language} />
          </View>
          <HighlightedText
            text={hit.snippet}
            query={query}
            style={snippetStyle}
            language={hit.language}
          />
        </ResultLink>
      </Link>
    </>
  );
}

type ResultLinkProps = Omit<PressableProps, 'children' | 'style'> & {
  /** React 19 hands a ref to a function component as a prop; it goes on to the pressable. */
  ref?: Ref<FocusHandle>;
  children: ReactNode;
  stacked?: boolean;
  style?: ViewStyle;
};

function ResultLink({ children, stacked = false, style, ...rest }: ResultLinkProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      {...hoverProps}
      {...focusProps}
      {...rest}
      style={({ pressed }) => [
        styles.link,
        stacked ? styles.linkStacked : null,
        { backgroundColor: hovered ? colors.surface : undefined },
        pressStyle(pressed, reduced),
        focusStyle,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The content is as wide as a list (880) and starts at the left edge of the page, like the hero.
  column: { width: '100%', maxWidth: 880 },
  controls: { gap: 16, marginBottom: 24 },
  modes: { maxWidth: 360 },
  hint: { marginTop: 8 },
  results: { gap: 16 },
  section: { gap: 4, marginTop: 12 },
  link: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderRadius: radii.sm,
  },
  linkStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    rowGap: 6,
  },
  // Who wrote the work and which editions there are, under its title (the heading of a group).
  group: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  place: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10 },
  heading: { flexShrink: 1 },
});
