import type { Edition, Section } from '@biblioteca/shared';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Column } from '@/components/column';
import { Disclosure } from '@/components/disclosure';
import { Hairline } from '@/components/hairline';
import { Icon } from '@/components/icon';
import { LinkRow } from '@/components/list-row';
import { PageTitle } from '@/components/page-title';
import { SegmentedControl } from '@/components/segmented-control';
import { StartList } from '@/components/start-list';
import { TextLink } from '@/components/text-link';
import type { StartEntry } from '@/components/start-list';
import { StatTile } from '@/components/stat-tile';
import { LoadingView, MessageView } from '@/components/state-views';
import { Tabs } from '@/components/tabs';
import { useFeatures } from '@/config/features';
import { isPartialEdition } from '@/content/editions';
import { resolveProvenance } from '@/content/provenance';
import { originalTitleToShow, workTitle } from '@/content/titles';
import type { EditionSummary, PackInfo, WorkDetail } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { useHashTab } from '@/hooks/use-hash-tab';
import { useT, useUiLanguage } from '@/i18n';
import {
  editionLabel,
  formatDateLong,
  formatLifespan,
  formatYear,
  licenceLabel,
  licenceNote,
} from '@/i18n/labels';
import { formatNumber } from '@/i18n/plural';
import type { Strings } from '@/i18n/strings';
import { shelfLabelOf } from '@/library/labels';
import { libraryAllWith, authorHref, readHref } from '@/navigation-hrefs';
import { useLibrary } from '@/library/use-library';
import type { LibraryGroup, LibraryWork } from '@/library/model';
import { splitChapterHeading } from '@/reading/heading';
import { sectionDepths } from '@/reading/navigation';
import { loadPosition } from '@/reading/position-store';
import type { ReadingPosition } from '@/reading/position-store';
import { useWorkBookmark } from '@/reading/use-bookmarks';
import { useSettings } from '@/settings/settings-context';
import { Main, PageScroll } from '@/shell/page-scroll';
import { useStorage } from '@/storage/key-value-store';
import { useFontFamilies } from '@/theme/fonts';
import { PHONE_MAX, PROSE_MAX_WIDTH, useLayout } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';
import { BAR_HEIGHT, radii } from '@/theme/tokens';
import { balancedLines, textLanguageProps } from '@/theme/web-styles';

import { TransparencyPanel } from '../transparency/transparency-panel';
import { statusChipLabel } from '../transparency/transparency-text';
import { countWords, roundedWords } from './work-model';
import { pairChoices } from '../reader/pair';

/** An installed edition of the work with what the page shows of it. */
export interface EditionView {
  summary: EditionSummary;
  edition: Edition;
  sections: Section[];
  pack: PackInfo;
  /** The words of the edition (every paragraph of every section). */
  words: number;
  /** "Where to start" in this edition: the paragraphs of the catalogue, found again here. */
  starts: StartPoint[];
}

/** One "where to start" paragraph, as it is in an edition. */
export interface StartPoint {
  paragraphId: string;
  sectionId: string;
  heading: string;
  whyRo: string;
  whyEn: string;
}

interface Loaded {
  detail: WorkDetail;
  editions: EditionView[];
}

/** No "where to start" entries: one constant, so that a query that depends on it is not run again and again. */
const NO_START: readonly { paragraphId: string; whyRo: string; whyEn: string }[] = [];

/**
 * The edition the page shows: the one named by `?edition=`, and the primary edition (the one in
 * the reading language) when the param is missing or names an edition the work does not have.
 */
export function selectEdition(
  editions: readonly EditionView[],
  requestedId: string | undefined,
  primaryId: string,
): EditionView | undefined {
  const withId = (id: string | undefined) =>
    id === undefined ? undefined : editions.find((view) => view.summary.editionId === id);
  return withId(requestedId) ?? withId(primaryId) ?? editions[0];
}

/** The label of the author line: "Geerhardus Vos (1862–1949)". */
function authorLine(name: string, born: number | null, died: number | null, t: Strings): string {
  const lifespan = formatLifespan(born, died, t);
  return lifespan ? `${name} (${lifespan})` : name;
}

interface ViewProps {
  workId: string;
  loaded: Loaded;
  selected: EditionView;
  /** The work as the library sees it (catalogue entry, kind, shelves, author or issuing body). */
  libraryWork: LibraryWork | null;
  group: LibraryGroup | null;
  shelfLabels: string[];
}

function WorkView({ workId, loaded, selected, libraryWork, group, shelfLabels }: ViewProps) {
  const t = useT();
  const language = useUiLanguage();
  const { settings } = useSettings();
  const features = useFeatures();
  const router = useRouter();
  const store = useStorage();
  const layout = useLayout();
  const { colors } = useTheme();
  const bookmark = useWorkBookmark(workId);
  const { detail, editions } = loaded;
  const { summary, edition, sections } = selected;
  const [panelOpen, setPanelOpen] = useState(false);
  const [positions, setPositions] = useState<Record<string, ReadingPosition | null>>({});

  // The screen stays mounted under the reader, so re-read the positions every time it regains
  // focus. Each edition has its own position; the source edition also finds the one an older
  // version saved for the whole work.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all(
        editions.map(
          async ({ summary: each }) =>
            [
              each.editionId,
              await loadPosition(
                store,
                each.editionId,
                each.kind === 'source' ? workId : undefined,
              ),
            ] as const,
        ),
      ).then((entries) => {
        if (!cancelled) setPositions(Object.fromEntries(entries));
      });
      return () => {
        cancelled = true;
      };
    }, [store, editions, workId]),
  );
  const position = positions[summary.editionId] ?? null;
  const resume =
    position && sections.some((section) => section.id === position.sectionId) ? position : null;
  const target = resume?.sectionId ?? sections[0]?.id;
  const reading = settings.readingLanguage;

  const resolved = useMemo(() => resolveProvenance(edition), [edition]);
  const entry = libraryWork?.entry ?? null;
  const title = workTitle(detail.work, reading);
  const original = originalTitleToShow(detail.work, title);
  const partial = isPartialEdition(summary, detail.editions);
  const note = licenceNote(edition.licence, language);
  const sourceSections = detail.editions.find(
    (candidate) => candidate.kind === 'source',
  )?.sectionCount;

  // Who wrote it: a person (a link), or the body that issued it (plain text, with the year).
  const person = group && group.kind !== 'body' ? group : null;
  const body = group?.kind === 'body' ? group : null;
  const personName = person
    ? reading === 'ro'
      ? person.nameRo
      : person.nameEn
    : detail.work.author.name;
  const bodyName = body ? (reading === 'ro' ? body.nameRo : body.nameEn) : '';
  const authorLink =
    person?.slug && features.authorPages
      ? authorHref(person.slug)
      : libraryAllWith({ q: person ? personName : detail.work.author.name });

  const pairs = pairChoices(detail.editions, reading);
  const blurb = entry ? (reading === 'ro' ? entry.blurbRo : entry.blurbEn) : '';
  const starts = selected.starts;
  const hasOverview = blurb.trim() !== '' || starts.length > 0;
  const tabKeys = hasOverview ? (['overview', 'contents'] as const) : (['contents'] as const);
  const [tab, setTab] = useHashTab(tabKeys, hasOverview ? 'overview' : 'contents');
  const tabs = [
    ...(hasOverview
      ? [{ key: 'overview' as const, label: t.work.tabOverview, testID: 'tab-overview' }]
      : []),
    ...(sections.length > 0 || !hasOverview
      ? [
          {
            key: 'contents' as const,
            label: t.work.tabContents,
            count: sections.length,
            testID: 'tab-contents',
          },
        ]
      : []),
  ];

  const startEntries: StartEntry[] = starts.map((point, index) => ({
    key: `${point.paragraphId}-${index}`,
    href: readHref(workId, point.sectionId, { p: point.paragraphId }),
    title: point.heading,
    why: reading === 'ro' ? point.whyRo : point.whyEn,
  }));

  const kind = libraryWork?.kind ? t.work.kinds[libraryWork.kind] : null;
  const wide = layout.wide;

  return (
    <PageScroll>
      <PageTitle parts={[title]} />
      <Main>
        <Column kind="wide" style={styles.page}>
          {person ? (
            <View style={styles.breadcrumb} accessibilityLabel={t.work.breadcrumb}>
              <Link href={authorLink} asChild>
                <TextLink testID="work-breadcrumb" title={personName} tall />
              </Link>
            </View>
          ) : null}

          <View
            testID="work-card"
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
              wide ? styles.cardWide : styles.cardPhone,
            ]}
          >
            <AppText
              variant="displayM"
              level={1}
              testID="work-title"
              style={[balancedLines, wide ? styles.titleWide : styles.titlePhone]}
            >
              {title}
            </AppText>
            {original ? <AppText variant="original">{original}</AppText> : null}
            {body ? (
              <AppText variant="meta" muted testID="work-body">
                {[bodyName, formatYear(body.year, t)].filter(Boolean).join(' · ')}
              </AppText>
            ) : (
              <View style={styles.authorRow}>
                <Link href={authorLink} asChild>
                  <TextLink
                    testID="work-author"
                    variant="body"
                    tall
                    title={authorLine(
                      personName,
                      detail.work.author.born,
                      detail.work.author.died,
                      t,
                    )}
                  />
                </Link>
              </View>
            )}
            {kind || shelfLabels.length > 0 ? (
              <View style={styles.chips}>
                {kind ? <Chip shape="tag" label={kind} testID="work-kind" /> : null}
                {shelfLabels.map((label) => (
                  <Chip key={label} shape="tag" label={label} />
                ))}
              </View>
            ) : null}
            <View style={styles.tiles}>
              <View style={styles.tile}>
                <StatTile
                  testID="stat-sections"
                  value={formatNumber(sections.length, language)}
                  caption={t.work.statSections}
                />
              </View>
              {selected.words > 0 ? (
                <View style={styles.tile}>
                  <StatTile
                    testID="stat-words"
                    value={t.work.wordsValue(formatNumber(roundedWords(selected.words), language))}
                    caption={t.work.statWords}
                  />
                </View>
              ) : null}
            </View>
          </View>

          {editions.length > 1 ? (
            <View testID="edition-switch" style={styles.switch}>
              <SegmentedControl
                label={t.work.editionSwitch}
                options={editions.map(({ summary: each }) => ({
                  value: each.editionId,
                  label: editionLabel(each, t),
                }))}
                value={summary.editionId}
                onChange={(editionId) => router.setParams({ edition: editionId })}
              />
            </View>
          ) : null}
          {partial ? (
            <View style={styles.chips}>
              <Chip label={t.work.partial} testID="partial-chip" />
              <AppText variant="caption" testID="partial-count">
                {t.work.partialCount(
                  selected.summary.sectionCount,
                  sourceSections ?? sections.length,
                )}
              </AppText>
            </View>
          ) : null}

          <View style={styles.transparencyRow} accessibilityLabel={t.work.transparencyRow}>
            <Chip status label={statusChipLabel(resolved, t)} testID="status-chip" />
            <Button
              testID="transparency-open"
              variant="text"
              title={t.work.details}
              label={t.work.detailsLabel}
              size="small"
              expanded={panelOpen}
              onPress={() => setPanelOpen(true)}
              style={styles.detailsButton}
            />
          </View>
          {note ? (
            <AppText variant="caption" testID="licence-note" style={styles.licenceNote}>
              {note}
            </AppText>
          ) : null}

          <View style={[styles.actions, wide ? styles.actionsWide : null]}>
            {target ? (
              <Link href={readHref(workId, target)} asChild>
                <Button
                  testID="work-cta-start"
                  variant="primary"
                  title={resume ? t.work.continueReading : t.work.startReading}
                  style={wide ? styles.primaryWide : styles.primary}
                />
              </Link>
            ) : null}
            {target && pairs.length > 0 ? (
              <Link href={readHref(workId, target, { pair: pairs[0]!.pair })} asChild>
                <Button
                  testID="work-cta-lanes"
                  variant="outline"
                  title={t.work.readBilingual}
                  accessibilityRole="link"
                  style={styles.secondary}
                />
              </Link>
            ) : null}
            {features.ask ? (
              <Link
                href={{ pathname: '/ask', params: { scope: `work:${workId}` } } as never}
                asChild
              >
                <Button
                  testID="work-cta-ask"
                  variant="outline"
                  title={t.work.askAboutBook}
                  accessibilityRole="link"
                  style={styles.secondary}
                />
              </Link>
            ) : null}
            <Button
              testID="work-bookmark"
              variant="text"
              title={bookmark.bookmarked ? t.work.bookmarked : t.work.bookmark}
              label={bookmark.bookmarked ? t.work.unbookmarkLabel : t.work.bookmarkLabel}
              onPress={() => bookmark.toggle(summary.editionId)}
              style={styles.bookmark}
            />
          </View>
        </Column>

        {/* The strip sticks under the section bar on web (a sticky child of the page, like the bar). */}
        {tabs.length > 1 ? (
          <StickyStrip>
            <Column kind="wide">
              <Tabs
                testID="work-tabs"
                label={t.work.tabs}
                tabs={tabs}
                value={tab}
                onChange={setTab}
                size={14}
                panelId={(key) => `work-panel-${key}`}
              />
            </Column>
          </StickyStrip>
        ) : null}

        <Column kind="wide" style={styles.panelColumn}>
          {tabs.length === 1 && sections.length > 0 ? (
            <AppText variant="heading" level={2} style={styles.contentsTitle}>
              {`${t.work.contents} · ${sections.length}`}
            </AppText>
          ) : null}
          <View
            role="tabpanel"
            nativeID={`work-panel-${tab}`}
            testID={`panel-${tab}`}
            style={styles.panel}
          >
            {tab === 'overview' ? (
              <OverviewTab
                blurb={blurb}
                kind={entry?.blurbKind ?? 'editorial'}
                starts={startEntries}
                twoColumns={layout.width >= 960}
              />
            ) : (
              <ContentsTab
                workId={workId}
                sections={sections}
                language={edition.language}
                current={resume?.sectionId ?? null}
              />
            )}
          </View>
          <AboutBook
            edition={edition}
            pack={selected.pack}
            licence={licenceLabel(edition.licence.status, t)}
          />
        </Column>
      </Main>
      <TransparencyPanel
        visible={panelOpen}
        onClose={() => setPanelOpen(false)}
        workId={workId}
        editionId={summary.editionId}
        onViewSource={(editionId) => router.setParams({ edition: editionId })}
      />
    </PageScroll>
  );
}

/** A full-width child of the page that sticks under the section bar on web (the work page's tab strip). */
function StickyStrip({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { width } = useLayout();
  // The section bar is 48 high (44 and a 1 point rule on a phone): the strip starts where it ends.
  const top = width <= PHONE_MAX ? BAR_HEIGHT.sectionPhone + 1 : BAR_HEIGHT.section;
  const sticky =
    Platform.OS === 'web' ? ({ position: 'sticky', top, zIndex: 9 } as unknown as ViewStyle) : null;
  return (
    <View
      testID="work-tabs-sticky"
      style={[
        styles.strip,
        { backgroundColor: colors.background, borderBottomColor: colors.border },
        sticky,
      ]}
    >
      {children}
    </View>
  );
}

function OverviewTab({
  blurb,
  kind,
  starts,
  twoColumns,
}: {
  blurb: string;
  kind: 'editorial' | 'ai';
  starts: readonly StartEntry[];
  twoColumns: boolean;
}) {
  const t = useT();
  return (
    <View style={[styles.overview, twoColumns ? styles.overviewWide : null]}>
      {blurb.trim() !== '' ? (
        <View testID="work-blurb" style={[styles.blurb, twoColumns ? styles.blurbWide : null]}>
          <AppText variant="label" tone="accent" testID="blurb-label">
            {kind === 'ai' ? t.work.overviewAi : t.work.overviewEditorial}
          </AppText>
          <AppText variant="body" style={styles.prose}>
            {blurb}
          </AppText>
          {kind === 'ai' ? (
            <Disclosure summary={t.work.methodology} testID="blurb-methodology">
              {t.work.methodologyAi}
            </Disclosure>
          ) : null}
        </View>
      ) : null}
      {starts.length > 0 ? (
        <View style={[styles.starts, twoColumns ? styles.startsWide : null]}>
          <AppText variant="heading" level={2}>
            {t.work.startHeading}
          </AppText>
          <StartList entries={starts} linkLabel={t.work.startLink} />
        </View>
      ) : null}
    </View>
  );
}

function ContentsTab({
  workId,
  sections,
  language,
  current,
}: {
  workId: string;
  sections: readonly Section[];
  language: string;
  current: string | null;
}) {
  const t = useT();
  const fonts = useFontFamilies();
  const { colors } = useTheme();
  const depths = useMemo(() => sectionDepths(sections), [sections]);
  const numbered = sections.some((section) => splitChapterHeading(section.heading).numeral);
  const currentIndex =
    current === null ? -1 : sections.findIndex((section) => section.id === current);
  if (sections.length === 0) return <MessageView message={t.work.emptyContents} />;
  return (
    <View testID="contents">
      {sections.map((section, index) => {
        const { numeral, title: heading } = splitChapterHeading(section.heading);
        const isCurrent = index === currentIndex;
        const done = currentIndex >= 0 && index < currentIndex;
        const status = isCurrent ? `, ${t.work.inProgress}` : done ? `, ${t.work.sectionDone}` : '';
        return (
          <View key={section.id}>
            {index > 0 ? <Hairline /> : null}
            <LinkRow
              testID={`contents-row-${section.id}`}
              href={readHref(workId, section.id)}
              accessibilityLabel={`${t.work.openSection(section.heading)}${status}`}
              indent={depths.get(section.id) ?? 0}
              current={isCurrent}
            >
              <View style={styles.tocRow}>
                {numbered ? (
                  <View style={styles.numeral}>
                    {/* The 600 face at 16 so that roman numerals read clearly (a heading is not what
                        a screen reader should announce for each row). */}
                    <AppText
                      variant="meta"
                      tone="text"
                      style={[styles.numeralText, { fontFamily: fonts.textSemiBold }]}
                    >
                      {numeral}
                    </AppText>
                  </View>
                ) : null}
                <AppText variant="body" {...textLanguageProps(language)} style={styles.tocTitle}>
                  {heading || '—'}
                </AppText>
                {isCurrent ? (
                  <AppText variant="caption" tone="accent" testID="contents-current">
                    {t.work.inProgress}
                  </AppText>
                ) : done ? (
                  <View testID={`contents-done-${section.id}`}>
                    <Icon name="check" size={16} color={colors.textMuted} />
                  </View>
                ) : null}
              </View>
            </LinkRow>
          </View>
        );
      })}
      <Hairline />
    </View>
  );
}

/** "Despre această carte": the details of the edition (source, licence, version, revision, size). */
function AboutBook({
  edition,
  pack,
  licence,
}: {
  edition: Edition;
  pack: PackInfo;
  licence: string;
}) {
  const t = useT();
  const candidates: [string, string][] = [
    [t.work.detailSource, edition.provenance.source],
    [t.work.detailLicence, licence],
    [t.work.detailVersion, pack.version],
    [t.work.detailRevision, t.work.revisionValue(pack.revision, formatDateLong(pack.createdAt, t))],
    [t.work.detailSize, t.work.sizeValue(String(Math.round(pack.size / 1024)))],
  ];
  const rows = candidates.filter(([, value]) => value.trim() !== '');
  return (
    <View style={styles.about}>
      <Hairline />
      <Disclosure summary={t.work.aboutBook} testID="about-book">
        <View style={styles.detailRows}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <AppText variant="label" style={styles.detailLabel}>
                {label}
              </AppText>
              <AppText variant="meta" style={styles.detailValue}>
                {value}
              </AppText>
            </View>
          ))}
        </View>
      </Disclosure>
    </View>
  );
}

interface Props {
  workId: string;
  /** The edition to show (the `?edition=` param of the route); the primary edition by default. */
  editionId?: string;
}

export function WorkScreen({ workId, editionId }: Props) {
  const t = useT();
  const { settings } = useSettings();
  const library = useLibrary();
  // Everything the page can show is loaded together, so switching editions is instant and the
  // switch itself never disappears while the other edition loads.
  const data = useRepositoryQuery<Loaded | null>(
    async (repository) => {
      const detail = await repository.getWork(workId, settings.readingLanguage);
      if (!detail) return null;
      const views = await Promise.all(
        detail.editions.map(async (summary): Promise<EditionView | null> => {
          const [full, sections] = await Promise.all([
            repository.getEdition(summary.editionId),
            repository.getSections(summary.editionId),
          ]);
          if (!full) return null;
          const paragraphs = await Promise.all(
            sections.map((section) => repository.getParagraphs(section.id)),
          );
          const words = paragraphs.reduce(
            (sum, list) => sum + list.reduce((inner, p) => inner + countWords(p.text), 0),
            0,
          );
          return {
            summary,
            edition: full.edition,
            sections,
            pack: full.pack,
            words,
            starts: [],
          };
        }),
      );
      const editions = views.filter((view): view is EditionView => view !== null);
      return { detail, editions };
    },
    [workId, settings.readingLanguage],
  );

  if (data.status === 'loading' || library.status === 'loading')
    return (
      <PageScroll>
        <LoadingView message={t.common.loading} />
      </PageScroll>
    );
  if (data.status === 'error' || library.status === 'error')
    return (
      <PageScroll>
        <MessageView message={t.common.error} />
      </PageScroll>
    );
  const selected = data.data
    ? selectEdition(data.data.editions, editionId, data.data.detail.primaryEditionId)
    : undefined;
  if (!data.data || !selected)
    return (
      <PageScroll>
        <MessageView message={t.work.notFound} />
      </PageScroll>
    );
  const { model } = library.data;
  const libraryWork = model.workById.get(workId) ?? null;
  const group = libraryWork ? (model.groupByKey.get(libraryWork.groupKey) ?? null) : null;
  const shelfLabels = (libraryWork?.shelves ?? [])
    .map((slug) => shelfLabelOf(model, slug, settings.readingLanguage))
    .filter((label) => label !== '');
  return (
    <StartPoints workId={workId} loaded={data.data} libraryWork={libraryWork}>
      {(loaded) => {
        const view =
          selectEdition(loaded.editions, editionId, loaded.detail.primaryEditionId) ?? selected;
        return (
          <WorkView
            workId={workId}
            loaded={loaded}
            selected={view}
            libraryWork={libraryWork}
            group={group}
            shelfLabels={shelfLabels}
          />
        );
      }}
    </StartPoints>
  );
}

/**
 * Finds the "where to start" paragraphs of the catalogue in each edition of the work (they name
 * paragraphs of the source edition): the section each is in, and for a translation the paragraph and the
 * section that render it. An entry that an edition has not translated yet is left out of that edition.
 */
function StartPoints({
  workId,
  loaded,
  libraryWork,
  children,
}: {
  workId: string;
  loaded: Loaded;
  libraryWork: LibraryWork | null;
  children(loaded: Loaded): React.ReactNode;
}) {
  const entries = libraryWork?.entry?.start ?? NO_START;
  const found = useRepositoryQuery<Record<string, StartPoint[]>>(
    async (repository) => {
      const result: Record<string, StartPoint[]> = {};
      for (const view of loaded.editions) result[view.summary.editionId] = [];
      for (const entry of entries) {
        const where = await repository.locateParagraph(entry.paragraphId);
        if (!where || where.workId !== workId) continue;
        for (const view of loaded.editions) {
          const editionId = view.summary.editionId;
          let place: { sectionId: string; paragraphId: string };
          if (where.editionId === editionId) {
            place = { sectionId: where.sectionId, paragraphId: entry.paragraphId };
          } else {
            const aligned = await repository.getAlignedSection(where.sectionId, editionId);
            if (!aligned) continue;
            const rows = await repository.getAlignedParagraphs(where.sectionId, editionId);
            const row = rows.find((candidate) => candidate.sourceId === entry.paragraphId);
            if (!row?.other) continue;
            place = { sectionId: aligned.id, paragraphId: row.other.id };
          }
          const heading =
            view.sections.find((section) => section.id === place.sectionId)?.heading ?? '';
          result[editionId] = [
            ...(result[editionId] ?? []),
            {
              ...place,
              heading,
              whyRo: entry.whyRo,
              whyEn: entry.whyEn,
            },
          ];
        }
      }
      return result;
    },
    [workId, loaded, entries],
  );
  const withStarts = useMemo<Loaded>(() => {
    if (found.status !== 'ready') return loaded;
    return {
      ...loaded,
      editions: loaded.editions.map((view) => ({
        ...view,
        starts: found.data[view.summary.editionId] ?? [],
      })),
    };
  }, [found, loaded]);
  return <>{children(withStarts)}</>;
}

const styles = StyleSheet.create({
  page: { paddingTop: 24, gap: 16 },
  breadcrumb: { alignSelf: 'flex-start' },
  card: { borderWidth: 1, borderRadius: radii.sm, gap: 8 },
  cardWide: { padding: 24 },
  cardPhone: { padding: 20 },
  titleWide: { fontSize: 34, lineHeight: 40 },
  titlePhone: { fontSize: 30, lineHeight: 36 },
  authorRow: { alignSelf: 'flex-start', marginVertical: -6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  tile: { flexGrow: 1, flexBasis: 160, maxWidth: 220 },
  switch: { maxWidth: 480 },
  transparencyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 },
  detailsButton: { paddingHorizontal: 8 },
  licenceNote: { maxWidth: PROSE_MAX_WIDTH, marginTop: -4 },
  actions: { gap: 12, alignItems: 'stretch' },
  actionsWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  primary: { alignSelf: 'stretch' },
  primaryWide: { width: 320, maxWidth: 320 },
  secondary: { alignSelf: 'stretch' },
  bookmark: { alignSelf: 'flex-start' },
  strip: { borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  panelColumn: { paddingTop: 24, paddingBottom: 64 },
  contentsTitle: { marginBottom: 8 },
  panel: { minHeight: 120 },
  overview: { gap: 32 },
  overviewWide: { flexDirection: 'row', gap: 56, alignItems: 'flex-start' },
  blurb: { gap: 12 },
  blurbWide: { flex: 1.15 },
  prose: { maxWidth: 70 * 9.2 },
  starts: { gap: 12 },
  startsWide: { flex: 1 },
  tocRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  numeral: { width: 44 },
  numeralText: { fontSize: 16, lineHeight: 22 },
  tocTitle: { flex: 1 },
  about: { marginTop: 40 },
  detailRows: { gap: 8, paddingTop: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'baseline', gap: 16 },
  detailLabel: { width: 96 },
  detailValue: { flex: 1 },
});
