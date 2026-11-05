import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FoldBand } from '@/components/fold-band';
import { Hairline } from '@/components/hairline';
import { useFocusRing } from '@/components/focus-ring';
import { Hero } from '@/components/hero';
import { PageTitle } from '@/components/page-title';
import { ResponsiveGrid } from '@/components/responsive-grid';
import { SearchField } from '@/components/search-field';
import { LoadingView, MessageView } from '@/components/state-views';
import { useFeatures } from '@/config/features';
import { originalTitleToShow } from '@/content/titles';
import { useT } from '@/i18n';
import type { ReadingLanguage } from '@/i18n/language';
import { formatLifespan, formatYear } from '@/i18n/labels';
import { groupNameOf, titleOf } from '@/library/labels';
import { groupName, shelfLabel } from '@/library/model';
import type { LibraryGroup, LibraryModel, LibraryWork } from '@/library/model';
import { useLibrary } from '@/library/use-library';
import {
  authorHref,
  authorsHref,
  futureHref,
  libraryAllHref,
  libraryAllWith,
  workHref,
} from '@/navigation-hrefs';
import { useSettings } from '@/settings/settings-context';
import { Main, PageScroll } from '@/shell/page-scroll';
import { useTheme } from '@/theme/theme-context';

import { LibraryRow } from './library-row';

/** At most this many authors in the band of authors (docs/ui-spec-v2.md, 6.1, band 3). */
const AUTHORS_MAX = 30;
/** At most this many works in the editorial list "Începe aici". */
const START_MAX = 10;
/** Featured works of a shelf block. */
const SHELF_FEATURED = 5;

/** The columns of a band: `wide` on a desktop, two on a tablet, one on a phone. */
function columnsFor(width: number, wide: number): number {
  return width >= 1100 ? wide : width >= 700 ? Math.min(2, wide) : 1;
}

function worksOfShelf(model: LibraryModel, slug: string): LibraryWork[] {
  return model.works.filter((work) => work.shelves.includes(slug));
}

/** Selecție, the curated page of the library (docs/ui-spec-v2.md, 6.1). */
export function CuratedScreen() {
  const t = useT();
  const { settings } = useSettings();
  const library = useLibrary();
  return (
    <PageScroll>
      <PageTitle parts={[t.nav.curated]} />
      <Main>
        <CuratedHero />
        {library.status === 'loading' ? <LoadingView message={t.library.loading} /> : null}
        {library.status === 'error' ? <MessageView message={t.common.error} /> : null}
        {library.status === 'ready' ? (
          <Bands model={library.data.model} language={settings.readingLanguage} />
        ) : null}
      </Main>
    </PageScroll>
  );
}

/** The hero: the question, a joined search form (it goes to the full library) and the buttons. */
function CuratedHero() {
  const t = useT();
  const features = useFeatures();
  const router = useRouter();
  const [text, setText] = useState('');
  const submit = () => {
    const q = text.trim();
    router.push(q === '' ? libraryAllHref : libraryAllWith({ q }));
  };
  return (
    <Hero
      kind="library"
      testID="library-hero"
      kicker={t.library.heroEyebrow}
      pilcrow={false}
      title={t.library.heroTitle}
      actions={
        <View style={styles.heroActions}>
          <View style={styles.form}>
            <View style={styles.formField}>
              <SearchField
                testID="library-hero-search"
                value={text}
                onChangeText={setText}
                placeholder={t.library.heroPlaceholder}
                label={t.library.heroPlaceholder}
                clearLabel={t.search.clear}
                onSubmit={submit}
                joined
              />
            </View>
            <Button
              testID="library-hero-submit"
              variant="primary"
              title={t.library.heroSubmit}
              onPress={submit}
              style={styles.formButton}
            />
          </View>
          <View style={styles.heroButtons}>
            <Link href={libraryAllHref} asChild>
              <Button
                variant="primary"
                title={t.library.heroAll}
                accessibilityRole="link"
                testID="hero-all"
              />
            </Link>
            {features.authors ? (
              <Link href={authorsHref} asChild>
                <Button
                  variant="outline"
                  title={t.library.heroAuthors}
                  accessibilityRole="link"
                  testID="hero-authors"
                />
              </Link>
            ) : null}
            {features.traditions ? (
              <Link href={futureHref('/traditions')} asChild>
                <Button
                  variant="outline"
                  title={t.library.heroTraditions}
                  accessibilityRole="link"
                  testID="hero-traditions"
                />
              </Link>
            ) : null}
            {features.guides ? (
              <Link href={futureHref('/guides')} asChild>
                <Button
                  variant="outline"
                  title={t.library.heroGuides}
                  accessibilityRole="link"
                  testID="hero-guides"
                />
              </Link>
            ) : null}
          </View>
        </View>
      }
    />
  );
}

function Bands({ model, language }: { model: LibraryModel; language: ReadingLanguage }) {
  const t = useT();
  const features = useFeatures();
  const { width } = useWindowDimensions();

  const creeds = worksOfShelf(model, 'creeds');
  const fathers = worksOfShelf(model, 'fathers');
  const start = (model.catalogue?.startHere ?? [])
    .map((slug) => model.works.find((work) => work.slug === slug))
    .filter((work): work is LibraryWork => work !== undefined)
    .slice(0, START_MAX);
  const authors = model.groups
    .filter((group) => group.kind !== 'body' && group.workIds.length > 0)
    .slice(0, AUTHORS_MAX);

  return (
    <>
      {creeds.length > 0 ? (
        <FoldBand
          tone="cream"
          label={t.library.bandCreeds.label}
          title={t.library.bandCreeds.title}
          testID="band-creeds"
        >
          {creeds.map((work, index) => (
            <View key={work.workId}>
              {index > 0 ? <Hairline /> : null}
              <LibraryRow work={work} model={model} language={language} variant="display" />
            </View>
          ))}
        </FoldBand>
      ) : null}

      {start.length > 0 ? (
        <FoldBand
          tone="background"
          label={t.library.bandStart.label}
          title={t.library.bandStart.title}
          testID="band-start"
        >
          <ResponsiveGrid columns={columnsFor(width, 2)} gap={32}>
            {start.map((work) => (
              <View key={work.workId}>
                <LibraryRow work={work} model={model} language={language} variant="compact" />
                <Hairline />
              </View>
            ))}
          </ResponsiveGrid>
        </FoldBand>
      ) : null}

      {authors.length > 0 ? (
        <FoldBand
          tone="masthead"
          label={t.library.bandAuthors.label}
          title={t.library.bandAuthors.title}
          testID="band-authors"
        >
          <ResponsiveGrid columns={columnsFor(width, 3)} gap={24}>
            {authors.map((group) => (
              <AuthorEntry key={group.key} group={group} language={language} />
            ))}
          </ResponsiveGrid>
          {features.authors ? (
            <View style={styles.bandFoot}>
              <Link href={authorsHref} asChild>
                <Button
                  variant="text"
                  arrow
                  title={t.library.bandAuthors.all}
                  accessibilityRole="link"
                  testID="band-authors-all"
                />
              </Link>
            </View>
          ) : null}
        </FoldBand>
      ) : null}

      {fathers.length > 0 ? (
        <FoldBand
          tone="cream"
          label={t.library.bandFathers.label}
          title={t.library.bandFathers.title}
          testID="band-fathers"
        >
          <ResponsiveGrid columns={columnsFor(width, 3)} gap={32}>
            {fathers.map((work) => (
              <View key={work.workId}>
                <LibraryRow work={work} model={model} language={language} variant="compact" />
                <Hairline />
              </View>
            ))}
          </ResponsiveGrid>
        </FoldBand>
      ) : null}

      {model.shelves.length > 0 ? (
        <FoldBand
          tone="warm"
          label={t.library.bandShelves.label}
          title={t.library.bandShelves.title}
          testID="band-shelves"
        >
          <ResponsiveGrid columns={columnsFor(width, 3)} gap={40}>
            {model.shelves.map((shelf) => (
              <ShelfBlock key={shelf.slug} model={model} slug={shelf.slug} language={language} />
            ))}
          </ResponsiveGrid>
        </FoldBand>
      ) : null}
    </>
  );
}

/** An author of the dark band: the name in `mastheadInk` at 28 points and "NUME COMPLET · n. AN". */
function AuthorEntry({ group, language }: { group: LibraryGroup; language: ReadingLanguage }) {
  const t = useT();
  const features = useFeatures();
  const name = groupName(group, language);
  const full = group.nameOrig.toLowerCase() === name.toLowerCase() ? '' : group.nameOrig;
  const lifespan = formatLifespan(group.born, null, t);
  const meta = [full, lifespan].filter(Boolean).join(' · ');
  const href =
    features.authorPages && group.kind === 'author' && group.slug
      ? authorHref(group.slug)
      : libraryAllWith({ q: name });
  return (
    <Link href={href} asChild>
      <PlainLink
        testID={`curated-author-${group.slug ?? group.key}`}
        accessibilityLabel={`${name}${meta ? `, ${meta}` : ''}`}
      >
        <AppText variant="displayS" level={3}>
          {name}
        </AppText>
        {meta ? <AppText variant="label">{meta}</AppText> : null}
      </PlainLink>
    </Link>
  );
}

/** One block of the shelves band: the name, the count, five featured works and a footer link. */
function ShelfBlock({
  model,
  slug,
  language,
}: {
  model: LibraryModel;
  slug: string;
  language: ReadingLanguage;
}) {
  const t = useT();
  const { colors } = useTheme();
  const shelf = model.shelves.find((entry) => entry.slug === slug);
  if (!shelf) return null;
  const works = worksOfShelf(model, slug);
  return (
    <View testID={`shelf-block-${slug}`} style={[styles.block, { borderTopColor: colors.text }]}>
      <AppText variant="heading" level={3}>
        {shelfLabel(shelf, language)}
      </AppText>
      <View style={styles.blockWorks}>
        {works.slice(0, SHELF_FEATURED).map((work) => (
          <Link key={work.workId} href={workHref(work.workId)} asChild>
            <PlainLink
              accessibilityLabel={`${titleOf(work, language)}, ${groupNameOf(model, work, language)}`}
            >
              <AppText variant="heading" heading={false}>
                {titleOf(work, language)}
              </AppText>
              {originalTitleToShow(work.summary, titleOf(work, language)) ? (
                <AppText variant="original">{work.summary.titleOrig}</AppText>
              ) : null}
              <AppText variant="label">{`${groupNameOf(model, work, language)}${work.year === null ? '' : ` · ${formatYear(work.year, t)}`}`}</AppText>
            </PlainLink>
          </Link>
        ))}
      </View>
      <Link href={libraryAllWith({ shelf: slug })} asChild>
        <Button
          variant="text"
          arrow
          title={t.library.allOfShelf(shelf.workIds.length)}
          accessibilityRole="link"
          testID={`shelf-block-${slug}-all`}
          style={styles.blockLink}
        />
      </Link>
    </View>
  );
}

type PlainLinkProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  style?: ViewStyle;
};

/** A block of text that is a link (Link's slot merges its props and `style`): no frame, a focus ring. */
function PlainLink({ children, style, ...rest }: PlainLinkProps) {
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      {...focusProps}
      {...rest}
      style={[styles.plain, focusStyle, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroActions: { gap: 16, alignSelf: 'stretch' },
  form: { flexDirection: 'row', alignItems: 'flex-start', maxWidth: 781 },
  formField: { flex: 1, minWidth: 0, maxWidth: 660 },
  formButton: { width: 121, minHeight: 48, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  heroButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bandFoot: { marginTop: 24, marginLeft: -16, flexDirection: 'row' },
  plain: { gap: 4, paddingVertical: 6, alignItems: 'flex-start' },
  block: { borderTopWidth: 2, paddingTop: 12, gap: 12 },
  blockWorks: { gap: 8 },
  blockLink: { alignSelf: 'flex-start', marginLeft: -16 },
});
