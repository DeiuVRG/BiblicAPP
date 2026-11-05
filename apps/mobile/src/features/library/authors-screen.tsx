import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { AppText, useTypeStyle } from '@/components/app-text';
import { Band } from '@/components/band';
import { Hairline } from '@/components/hairline';
import { useFocusRing } from '@/components/focus-ring';
import { Hero } from '@/components/hero';
import { HighlightedText } from '@/components/highlighted-text';
import { useHover } from '@/components/hover';
import { PageTitle } from '@/components/page-title';
import { pressStyle } from '@/components/press';
import { SearchField } from '@/components/search-field';
import { EmptyState, LoadingView, MessageView } from '@/components/state-views';
import { useFeatures } from '@/config/features';
import { useT } from '@/i18n';
import { formatLifespan, languageName } from '@/i18n/labels';
import type { ReadingLanguage } from '@/i18n/language';
import { foldText } from '@/search/fold';
import { groupName, shelfLabel } from '@/library/model';
import type { LibraryGroup, LibraryModel } from '@/library/model';
import { useLibrary } from '@/library/use-library';
import { authorHref, libraryAllWith } from '@/navigation-hrefs';
import { useCommittedText } from '@/hooks/use-committed-text';
import { useUrlState } from '@/hooks/use-url-state';
import { useSettings } from '@/settings/settings-context';
import { Main, PageScroll } from '@/shell/page-scroll';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

/** The people of the library, alphabetically by their sort name (issuing bodies are not authors). */
export function authorsOf(model: LibraryModel): LibraryGroup[] {
  return model.groups.filter((group) => group.kind !== 'body' && group.workIds.length > 0);
}

/** The authors whose name has the words of the search in any of its forms (accents and case folded). */
export function filterAuthors(authors: readonly LibraryGroup[], text: string): LibraryGroup[] {
  const needle = foldText(text.trim());
  if (needle === '') return [...authors];
  return authors.filter((group) =>
    [group.nameRo, group.nameEn, group.nameOrig, group.sortName].some((name) =>
      foldText(name).includes(needle),
    ),
  );
}

const parseQ = (params: Record<string, string | string[] | undefined>) => {
  const raw = params.q;
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
};
const serializeQ = (q: string): Record<string, string> => (q === '' ? {} : { q });

/** `/authors`: the plain list of the authors (docs/ui-spec-v2.md, 6.6; the author room is P2). */
export function AuthorsScreen() {
  const t = useT();
  const { settings } = useSettings();
  const library = useLibrary();
  return (
    <PageScroll>
      <PageTitle parts={[t.nav.authors]} />
      <Main>
        <Hero
          kind="library"
          testID="authors-hero"
          kicker={t.authorsPage.eyebrow}
          pilcrow={false}
          title={t.authorsPage.title}
        />
        {library.status === 'loading' ? <LoadingView message={t.library.loading} /> : null}
        {library.status === 'error' ? <MessageView message={t.common.error} /> : null}
        {library.status === 'ready' ? (
          <AuthorsBody model={library.data.model} language={settings.readingLanguage} />
        ) : null}
      </Main>
    </PageScroll>
  );
}

function AuthorsBody({ model, language }: { model: LibraryModel; language: ReadingLanguage }) {
  const t = useT();
  const { colors } = useTheme();
  const [q, setQ] = useUrlState(parseQ, serializeQ);
  const [text, setText] = useCommittedText(q, setQ);

  const all = useMemo(() => authorsOf(model), [model]);
  const shown = useMemo(() => filterAuthors(all, q), [all, q]);
  return (
    <Band tone="background" padding={{ top: 32, bottom: 72 }} testID="authors-body">
      <View style={styles.column}>
        <View style={[styles.panel, { backgroundColor: colors.cream, borderColor: colors.border }]}>
          <SearchField
            testID="authors-search"
            value={text}
            onChangeText={setText}
            placeholder={t.authorsPage.placeholder}
            label={t.authorsPage.label}
            clearLabel={t.search.clear}
          />
          <AppText variant="label" testID="authors-count" accessibilityLiveRegion="polite">
            {t.counts.authors(shown.length)}
          </AppText>
        </View>
        {shown.length > 0 ? (
          <View>
            {shown.map((group, index) => (
              <View key={group.key}>
                {index > 0 ? <Hairline /> : null}
                <AuthorRow group={group} model={model} language={language} query={q} />
              </View>
            ))}
            <Hairline />
          </View>
        ) : (
          <EmptyState message={t.authorsPage.empty} />
        )}
      </View>
    </Band>
  );
}

/** A row of the list: the name, "354–430 · Părinții Bisericii · latină" and "N lucrări". */
function AuthorRow({
  group,
  model,
  language,
  query,
}: {
  group: LibraryGroup;
  model: LibraryModel;
  language: ReadingLanguage;
  query: string;
}) {
  const t = useT();
  const features = useFeatures();
  const name = groupName(group, language);
  const works = group.workIds
    .map((id) => model.workById.get(id))
    .filter((work) => work !== undefined);
  const shelf = works[0]?.shelves[0]
    ? model.shelves.find((entry) => entry.slug === works[0]?.shelves[0])
    : undefined;
  const languages = [
    ...new Set(works.map((work) => languageName(work?.summary.languageOrig ?? '', t))),
  ];
  const meta = [
    formatLifespan(group.born, group.died, t),
    shelf ? shelfLabel(shelf, language) : '',
    languages.join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
  const href =
    features.authorPages && group.kind === 'author' && group.slug
      ? authorHref(group.slug)
      : libraryAllWith({ q: name });
  return (
    <Link href={href} asChild>
      <RowLink
        testID={`author-row-${group.slug ?? group.key}`}
        accessibilityLabel={`${t.authorsPage.open(name)}. ${meta}. ${t.counts.works(works.length)}`}
        name={name}
        query={query}
        count={t.counts.works(works.length)}
      >
        {meta ? <AppText variant="label">{meta}</AppText> : null}
      </RowLink>
    </Link>
  );
}

type RowLinkProps = Omit<PressableProps, 'children' | 'style'> & {
  name: string;
  query: string;
  count: string;
  children: ReactNode;
  style?: ViewStyle;
};

function RowLink({ name, query, count, children, style, ...rest }: RowLinkProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const titleStyle = useTypeStyle('title');
  return (
    <Pressable
      accessibilityRole="link"
      {...hoverProps}
      {...focusProps}
      {...rest}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: hovered ? colors.surface : undefined },
        pressStyle(pressed, reduced),
        focusStyle,
        style,
      ]}
    >
      <View style={styles.rowText}>
        <HighlightedText
          text={name}
          query={query}
          style={[
            titleStyle,
            hovered ? { color: colors.accentStrong, textDecorationLine: 'underline' } : null,
          ]}
        />
        {children}
      </View>
      <AppText variant="meta">{count}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The list is 880 wide and starts at the left edge of the page, like the hero.
  column: { width: '100%', maxWidth: 880 },
  panel: { marginBottom: 24, padding: 20, gap: 16, borderWidth: 1, borderRadius: radii.sm },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 24,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderRadius: radii.sm,
  },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
});
