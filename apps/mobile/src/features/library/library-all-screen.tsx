import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { TextInputInstance } from 'react-native';

import { AppText } from '@/components/app-text';
import { Band } from '@/components/band';
import { Button } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { Hero } from '@/components/hero';
import { Icon } from '@/components/icon';
import { PageTitle } from '@/components/page-title';
import { ResponsiveGrid } from '@/components/responsive-grid';
import { SearchField } from '@/components/search-field';
import { Select } from '@/components/select';
import type { SelectOption } from '@/components/select';
import { EmptyState, LoadingView, MessageView } from '@/components/state-views';
import { Tabs } from '@/components/tabs';
import { useFeatures } from '@/config/features';
import { useCommittedText } from '@/hooks/use-committed-text';
import { useT } from '@/i18n';
import { baseLanguage } from '@/i18n/language';
import { formatCenturyLabel, languageName } from '@/i18n/labels';
import type { Strings } from '@/i18n/strings';
import {
  OPEN_ALL_UP_TO,
  libraryPage,
  libraryParams,
  shelfDescription,
  shelfLabel,
} from '@/library/model';
import type { LibraryModel, LibraryQuery } from '@/library/model';
import { useLibrary } from '@/library/use-library';
import { useLibraryQuery } from '@/library/use-library-query';
import { authorsHref } from '@/navigation-hrefs';
import { useSettings } from '@/settings/settings-context';
import { Main, PageScroll } from '@/shell/page-scroll';
import { setSlashTarget } from '@/shell/slash-target';
import { useFontFamilies } from '@/theme/fonts';
import { columnStyle, useLayout } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

import { AuthorAccordion } from './author-accordion';
import { AzBar } from './az-bar';
import { CenturyTiles } from './century-tiles';
import { shelfColumns } from '../landing/landing-screen';
import { ShelfCard } from './shelf-card';

/** The words of a count line, in capitals by style: what the list is. */
export function countLineFor(
  t: Strings,
  model: LibraryModel,
  query: LibraryQuery,
  works: number,
  language: 'ro' | 'en',
): string {
  if (query.view === 'century') {
    return t.library.countLineCenturies(model.centuries.length, model.totals.works - model.undated);
  }
  const shelf =
    query.shelf === null ? undefined : model.shelves.find((entry) => entry.slug === query.shelf);
  const parts = {
    ...(query.q === '' ? null : { query: query.q }),
    ...(shelf ? { shelf: shelfLabel(shelf, language) } : null),
    ...(query.century === null ? null : { century: formatCenturyLabel(query.century, t, 'long') }),
  };
  const extras = [
    ...(query.lang === null ? [] : [t.library.countLineLang(languageName(query.lang, t))]),
    ...(query.availability === null ? [] : [availabilityLabel(t, query.availability)]),
    ...(query.letter === null ? [] : [t.library.countLineLetter(query.letter)]),
  ];
  return [t.library.countLine(works, parts), ...extras].join(' · ');
}

function availabilityLabel(t: Strings, value: 'ro' | 'en' | 'partial'): string {
  return value === 'partial'
    ? t.library.availabilityPartial
    : value === 'ro'
      ? t.readingLanguages.ro
      : t.readingLanguages.en;
}

/** Toată biblioteca: every work, with its filters in the URL (docs/ui-spec-v2.md, 6.2). */
export function LibraryAllScreen() {
  const t = useT();
  const { settings } = useSettings();
  const language = settings.readingLanguage;
  const library = useLibrary();
  const [query, update, clear] = useLibraryQuery();

  return (
    <PageScroll>
      <PageTitle parts={[t.nav.all]} />
      <Main>
        {library.status === 'loading' ? <LoadingView message={t.library.loading} /> : null}
        {library.status === 'error' ? <MessageView message={t.common.error} /> : null}
        {library.status === 'ready' ? (
          <LibraryBody
            model={library.data.model}
            unverified={library.data.unverified}
            query={query}
            update={update}
            clear={clear}
            language={language}
          />
        ) : null}
      </Main>
    </PageScroll>
  );
}

interface BodyProps {
  model: LibraryModel;
  unverified: number;
  query: LibraryQuery;
  update(patch: Partial<LibraryQuery>): void;
  clear(): void;
  language: 'ro' | 'en';
}

function LibraryBody({ model, unverified, query, update, clear, language }: BodyProps) {
  const t = useT();
  const { colors } = useTheme();
  const features = useFeatures();
  const layout = useLayout();
  const { width } = useWindowDimensions();
  const phone = width < 641;
  const shelf =
    query.shelf === null ? undefined : model.shelves.find((entry) => entry.slug === query.shelf);

  // The field keeps what is typed at once; the list follows 180 ms after the last key. When the
  // query changes from outside (the filters were cleared, a link) the field follows.
  const commitQuery = useCallback((q: string) => update({ q }), [update]);
  const [text, setText] = useCommittedText(query.q, commitQuery);
  const inputRef = useRef<TextInputInstance>(null);

  // `/` focuses the field from anywhere on web (the brand bar asks which field before it navigates).
  useFocusEffect(
    useCallback(() => {
      setSlashTarget({ focus: () => inputRef.current?.focus() });
      return () => setSlashTarget(null);
    }, []),
  );

  const page = useMemo(() => libraryPage(model, query), [model, query]);
  const authorView = query.view === 'author';

  // Every accordion starts open when the result has twelve authors or fewer; the reader's own
  // choices win until the filters change.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const filterKey = JSON.stringify(
    libraryParams({ ...query, page: 1, letter: null, view: 'author' }),
  );
  const [overridesFor, setOverridesFor] = useState(filterKey);
  if (overridesFor !== filterKey) {
    // Adjusting state while rendering: the filters changed, so the reader's own choices go.
    setOverridesFor(filterKey);
    setOverrides({});
  }
  const startOpen = page.all.length <= OPEN_ALL_UP_TO;

  const shelfOptions: SelectOption[] = model.shelves.map((entry) => ({
    value: entry.slug,
    label: shelfLabel(entry, language),
  }));
  const centuryOptions: SelectOption[] = model.centuries.map(({ century, count }) => ({
    value: String(century),
    label: `${formatCenturyLabel(century, t, 'short')} (${count})`,
  }));
  const originals = [
    ...new Set(model.works.map((work) => baseLanguage(work.summary.languageOrig))),
  ].sort();
  const langOptions: SelectOption[] = originals.map((code) => ({
    value: code,
    label: languageName(code, t),
  }));
  const traditions = model.catalogue?.traditions ?? [];
  const traditionOptions: SelectOption[] = traditions.map((entry) => ({
    value: entry.slug,
    label: language === 'ro' ? entry.labelRo : entry.labelEn,
  }));
  const availabilityOptions: SelectOption[] = [
    { value: 'ro', label: t.readingLanguages.ro },
    { value: 'en', label: t.readingLanguages.en },
    { value: 'partial', label: t.library.availabilityPartial },
  ];

  const countLine = countLineFor(t, model, query, page.workCount, language);
  const heroTitle = shelf ? shelfLabel(shelf, language) : t.library.allTitle;
  const heroSub = shelf ? shelfDescription(shelf, language) : t.library.allSub;
  const contentStyle = columnStyle('tool', layout);

  return (
    <>
      <Hero
        kind="library"
        testID="library-hero"
        kicker={shelf ? t.library.shelfEyebrow : t.library.allEyebrow}
        pilcrow={false}
        title={heroTitle}
        sub={heroSub || undefined}
        actions={
          features.authors ? (
            <Link href={authorsHref} asChild>
              <Button
                variant="outline"
                title={t.library.heroAuthors}
                accessibilityRole="link"
                testID="hero-authors"
              />
            </Link>
          ) : undefined
        }
      />

      <Band
        tone="background"
        container="wide"
        padding={{ top: 32, bottom: 72 }}
        testID="library-body"
      >
        {unverified > 0 ? (
          <AppText
            variant="meta"
            accessibilityRole="alert"
            style={styles.notice}
            testID="library-unverified"
          >
            {t.library.unverified(unverified)}
          </AppText>
        ) : null}

        {model.works.length === 0 ? (
          <EmptyState message={t.library.empty} testID="library-empty" />
        ) : null}

        {model.works.length > 0 && model.shelves.length > 0 ? (
          shelf ? (
            <Button
              testID="all-shelves"
              variant="text"
              title={`← ${t.library.allShelves}`}
              onPress={() => update({ shelf: null })}
              style={styles.back}
            />
          ) : (
            <ShelvesFold model={model} language={language} width={width} />
          )
        ) : null}

        {model.works.length > 0 ? (
          <>
            <Tabs
              testID="view-tabs"
              label={t.library.viewTabs}
              value={query.view}
              size={16}
              tabs={[
                { key: 'author', label: t.library.viewAuthor, testID: 'view-tab-author' },
                { key: 'century', label: t.library.viewCentury, testID: 'view-tab-century' },
              ]}
              onChange={(view) => update({ view })}
            />

            <View
              testID="filter-panel"
              style={[styles.panel, { backgroundColor: colors.cream, borderColor: colors.border }]}
            >
              <SearchField
                testID="library-search"
                value={text}
                onChangeText={setText}
                placeholder={t.library.searchPlaceholder}
                label={t.library.searchLabel}
                clearLabel={t.search.clear}
                inputRef={inputRef}
              />
              <AppText
                variant="label"
                testID="library-count"
                accessibilityLiveRegion="polite"
                style={styles.count}
              >
                {countLine}
              </AppText>
              <View style={[styles.selects, phone ? styles.selectsPhone : null]}>
                {shelfOptions.length > 0 ? (
                  <View style={phone ? styles.selectStacked : styles.select}>
                    <Select
                      testID="filter-shelf"
                      label={t.library.filterShelf}
                      chooseLabel={t.library.filterChoose(t.library.filterShelf)}
                      allLabel={t.library.filterAll}
                      value={query.shelf}
                      options={shelfOptions}
                      onChange={(value) => update({ shelf: value })}
                    />
                  </View>
                ) : null}
                {centuryOptions.length > 0 ? (
                  <View style={phone ? styles.selectStacked : styles.select}>
                    <Select
                      testID="filter-century"
                      label={t.library.filterCentury}
                      chooseLabel={t.library.filterChoose(t.library.filterCentury)}
                      allLabel={t.library.filterAll}
                      value={query.century === null ? null : String(query.century)}
                      options={centuryOptions}
                      onChange={(value) =>
                        update({ century: value === null ? null : Number(value) })
                      }
                    />
                  </View>
                ) : null}
                {traditionOptions.length > 0 ? (
                  <View style={phone ? styles.selectStacked : styles.select}>
                    <Select
                      testID="filter-tradition"
                      label={t.library.filterTradition}
                      chooseLabel={t.library.filterChoose(t.library.filterTradition)}
                      allLabel={t.library.filterAll}
                      value={query.tradition}
                      options={traditionOptions}
                      onChange={(value) => update({ tradition: value })}
                    />
                  </View>
                ) : null}
                {langOptions.length > 0 ? (
                  <View style={phone ? styles.selectStacked : styles.select}>
                    <Select
                      testID="filter-lang"
                      label={t.library.filterLang}
                      chooseLabel={t.library.filterChoose(t.library.filterLang)}
                      allLabel={t.library.filterAll}
                      value={query.lang}
                      options={langOptions}
                      onChange={(value) => update({ lang: value })}
                    />
                  </View>
                ) : null}
                <View style={phone ? styles.selectStacked : styles.select}>
                  <Select
                    testID="filter-availability"
                    label={t.library.filterAvailability}
                    chooseLabel={t.library.filterChoose(t.library.filterAvailability)}
                    allLabel={t.library.filterAll}
                    value={query.availability}
                    options={availabilityOptions}
                    onChange={(value) =>
                      update({
                        availability: value === null ? null : (value as 'ro' | 'en' | 'partial'),
                      })
                    }
                  />
                </View>
              </View>
              {model.undated > 0 ? (
                <AppText variant="caption" testID="library-undated">
                  {t.library.undated(model.undated)}
                </AppText>
              ) : null}
            </View>

            {authorView ? (
              <View style={contentStyle ? styles.list : undefined}>
                {page.all.length > 0 ? (
                  <>
                    <View style={styles.az}>
                      <AzBar
                        letters={page.letters}
                        total={page.all.length}
                        active={query.letter}
                        onChoose={(letter) => update({ letter })}
                      />
                    </View>
                    <ResponsiveGrid columns={phone ? 1 : 2} gap={32} testID="author-list">
                      {page.page.map((result) => (
                        <AuthorAccordion
                          key={result.group.key}
                          result={result}
                          model={model}
                          language={language}
                          query={query.q}
                          open={overrides[result.group.key] ?? startOpen}
                          onToggle={() =>
                            setOverrides((previous) => ({
                              ...previous,
                              [result.group.key]: !(previous[result.group.key] ?? startOpen),
                            }))
                          }
                        />
                      ))}
                    </ResponsiveGrid>
                    {page.pageCount > 1 ? (
                      <Pager
                        pageNumber={page.pageNumber}
                        pageCount={page.pageCount}
                        onChoose={(next) => update({ page: next })}
                      />
                    ) : null}
                  </>
                ) : (
                  <EmptyState
                    message={t.library.emptyFilters}
                    actionLabel={t.library.clearFilters}
                    onAction={clear}
                  />
                )}
              </View>
            ) : (
              <CenturyTiles
                centuries={model.centuries}
                undated={model.undated}
                onChoose={(century) => update({ century, view: 'author' })}
              />
            )}
          </>
        ) : null}
      </Band>
    </>
  );
}

/** The fold "Răsfoiește rafturile": a 62 point row that opens to the shelf cards. */
function ShelvesFold({
  model,
  language,
  width,
}: {
  model: LibraryModel;
  language: 'ro' | 'en';
  width: number;
}) {
  const t = useT();
  const { colors } = useTheme();
  const { focusProps, focusStyle } = useFocusRing();
  const [open, setOpen] = useState(false);
  return (
    <View testID="shelves-fold" style={styles.fold}>
      <Pressable
        testID="shelves-fold-toggle"
        accessibilityRole="button"
        accessibilityLabel={`${t.library.shelvesFold}. ${t.counts.shelves(model.shelves.length)}`}
        accessibilityState={{ expanded: open }}
        // react-native-web reads the `aria-*` props only; React Native reads both forms.
        aria-expanded={open}
        onPress={() => setOpen(!open)}
        {...focusProps}
        style={[
          styles.foldHeader,
          { backgroundColor: colors.cream, borderColor: colors.border },
          focusStyle,
        ]}
      >
        <AppText variant="heading" level={2} style={styles.foldTitle}>
          {t.library.shelvesFold}
        </AppText>
        <AppText variant="label">{t.counts.shelves(model.shelves.length)}</AppText>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={20} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.foldBody}>
          <ResponsiveGrid
            columns={Math.min(3, shelfColumns(width))}
            gap={24}
            testID="shelves-fold-grid"
          >
            {model.shelves.map((shelf) => (
              <ShelfCard key={shelf.slug} shelf={shelf} language={language} />
            ))}
          </ResponsiveGrid>
        </View>
      ) : null}
    </View>
  );
}

/** "← ANTERIOARĂ | 1 2 3 | URMĂTOAREA →": only above one hundred authors. */
function Pager({
  pageNumber,
  pageCount,
  onChoose,
}: {
  pageNumber: number;
  pageCount: number;
  onChoose(page: number): void;
}) {
  const t = useT();
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  return (
    <View
      testID="pager"
      accessibilityRole="toolbar"
      accessibilityLabel={t.library.pager}
      style={styles.pager}
    >
      <Button
        variant="text"
        title={`← ${t.library.pagerPrevious}`}
        disabled={pageNumber <= 1}
        onPress={() => onChoose(pageNumber - 1)}
        testID="pager-previous"
      />
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
        <Button
          key={number}
          variant="text"
          glyph
          title={String(number)}
          label={t.library.pagerPage(number)}
          onPress={() => onChoose(number)}
          testID={`pager-${number}`}
          textStyle={
            number === pageNumber
              ? [styles.pageCurrent, { fontFamily: fonts.textSemiBold, color: colors.text }]
              : undefined
          }
        />
      ))}
      <Button
        variant="text"
        title={`${t.library.pagerNext} →`}
        disabled={pageNumber >= pageCount}
        onPress={() => onChoose(pageNumber + 1)}
        testID="pager-next"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: 16 },
  back: { alignSelf: 'flex-start', marginLeft: -16, marginBottom: 8 },
  fold: { marginBottom: 24 },
  foldHeader: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  foldTitle: { flex: 1 },
  foldBody: { paddingTop: 24 },
  panel: {
    marginTop: 0,
    marginBottom: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  count: { marginTop: 4 },
  selects: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  selectsPhone: { flexDirection: 'column', flexWrap: 'nowrap' },
  select: { flexGrow: 1, flexBasis: 180, minWidth: 0, maxWidth: 360 },
  // In a column a flex basis would be a height: the select just takes the width of the panel.
  selectStacked: { alignSelf: 'stretch', maxWidth: undefined },
  list: { gap: 16 },
  az: { marginBottom: 16 },
  pager: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  pageCurrent: { textDecorationLine: 'none' },
});
