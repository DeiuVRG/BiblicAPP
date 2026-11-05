import { Link, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, TextInputInstance, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

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
import { filterWorks, groupName, matchingGroups, EMPTY_QUERY } from '@/library/model';
import type { LibraryModel } from '@/library/model';
import { useLibrary } from '@/library/use-library';
import { libraryAllWith, readHref } from '@/navigation-hrefs';
import { useSettings } from '@/settings/settings-context';
import { Main, PageScroll } from '@/shell/page-scroll';
import { setSlashTarget } from '@/shell/slash-target';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';
import { LibraryRow } from '@/features/library/library-row';

const MIN_QUERY_LENGTH = 2;
/** Same cap as the repository (`MAX_SEARCH_HITS`); used only to tell the reader the results are capped. */
const RESULT_CAP = 50;

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

  useFocusEffect(
    useCallback(() => {
      setSlashTarget({ focus: () => inputRef.current?.focus() });
      return () => setSlashTarget(null);
    }, []),
  );

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
                  <WorkResults model={library.data.model} query={state.q} language={language} />
                ) : null}
              </>
            ) : (
              <PassageResults query={state.q} language={language} />
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
}: {
  model: LibraryModel;
  query: string;
  language: ReadingLanguage;
}) {
  const t = useT();
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
                    testID={`search-author-${group.slug ?? group.key}`}
                    accessibilityLabel={t.search.openAuthor(name)}
                  >
                    <HighlightedText text={name} query={query} style={undefined} />
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
              <LibraryRow work={work} model={model} language={language} query={query} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The "Pasaje" mode: words in the texts, grouped by work, each hit opening the reader at its paragraph. */
function PassageResults({ query, language }: { query: string; language: ReadingLanguage }) {
  const t = useT();
  const results = useRepositoryQuery(
    async (repository) => {
      const [hits, works] = await Promise.all([
        repository.search(query),
        repository.listWorks(language),
      ]);
      const titles = new Map(works.map((work) => [work.workId, workTitle(work, language)]));
      return { hits, titles };
    },
    [query, language],
  );
  if (results.status === 'loading') return <LoadingView message={t.search.searching} />;
  if (results.status === 'error') return <MessageView message={t.common.error} />;
  const { hits, titles } = results.data;
  if (hits.length === 0) return <MessageView message={t.search.noResults} />;

  const byWork = new Map<string, SearchHit[]>();
  for (const hit of hits) byWork.set(hit.workId, [...(byWork.get(hit.workId) ?? []), hit]);
  const count =
    hits.length >= RESULT_CAP
      ? t.search.resultsCapped(hits.length)
      : t.search.inWorks(hits.length, byWork.size);
  let index = 0;
  return (
    <View testID="search-results" style={styles.results}>
      <AppText variant="label" testID="search-count" accessibilityLiveRegion="polite">
        {hits.length >= RESULT_CAP ? count : t.search.inWorks(hits.length, byWork.size)}
      </AppText>
      <Hairline />
      {[...byWork].map(([workId, workHits]) => (
        <View key={workId} style={styles.section}>
          <AppText variant="heading" level={2}>
            {titles.get(workId) ?? ''}
          </AppText>
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
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function HitRow({
  hit,
  query,
  title,
  position,
}: {
  hit: SearchHit;
  query: string;
  title: string;
  position: number;
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
  place: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10 },
  heading: { flexShrink: 1 },
});
