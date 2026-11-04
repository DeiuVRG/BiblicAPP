import type { Edition, Section } from '@biblioteca/shared';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { useListContentStyle } from '@/components/column';
import { Hairline } from '@/components/hairline';
import { LinkRow } from '@/components/list-row';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { LoadingView, MessageView } from '@/components/state-views';
import { isPartialEdition } from '@/content/editions';
import { originalTitleToShow, workTitle } from '@/content/titles';
import type { EditionSummary, WorkDetail } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { useT, useUiLanguage } from '@/i18n';
import {
  editionKindLabel,
  editionLanguageLabel,
  formatLifespan,
  formatYear,
  languageName,
  licenceLabel,
  licenceNote,
} from '@/i18n/labels';
import type { Strings } from '@/i18n/strings';
import { readHref } from '@/navigation-hrefs';
import { splitChapterHeading } from '@/reading/heading';
import { sectionDepths } from '@/reading/navigation';
import { loadPosition } from '@/reading/position-store';
import type { ReadingPosition } from '@/reading/position-store';
import { useSettings } from '@/settings/settings-context';
import { useStorage } from '@/storage/key-value-store';
import { useFontFamilies } from '@/theme/fonts';
import { PROSE_MAX_WIDTH, useLayout } from '@/theme/layout';
import { balancedLines, textLanguageProps } from '@/theme/web-styles';

/** An installed edition of the work with what the page shows of it. */
export interface EditionView {
  summary: EditionSummary;
  edition: Edition;
  sections: Section[];
}

interface Loaded {
  detail: WorkDetail;
  editions: EditionView[];
}

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

/** The options of the edition switch: the language of each edition ("Română", "English"). */
function switchOptions(editions: readonly EditionView[], t: Strings) {
  const labelled = editions.map(({ summary }) => ({
    summary,
    language: editionLanguageLabel(summary.language, t),
  }));
  return labelled.map(({ summary, language }) => {
    // Two editions that read the same ("en" and "en-GB" are both "English") need more than the
    // language to be told apart.
    const shared = labelled.some(
      (other) => other.summary.editionId !== summary.editionId && other.language === language,
    );
    return {
      value: summary.editionId,
      label: shared ? `${language} · ${editionKindLabel(summary.kind, t).toLowerCase()}` : language,
    };
  });
}

/** One row of the two-column metadata block: a label and its value. */
function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <AppText variant="label" style={styles.metaLabel}>
        {label}
      </AppText>
      <AppText variant="meta" style={styles.metaValue}>
        {value}
      </AppText>
    </View>
  );
}

interface HeaderProps {
  detail: WorkDetail;
  editions: readonly EditionView[];
  selected: EditionView;
  position: ReadingPosition | null;
  onSelectEdition(editionId: string): void;
}

function WorkHeader({ detail, editions, selected, position, onSelectEdition }: HeaderProps) {
  const t = useT();
  const language = useUiLanguage();
  const { settings } = useSettings();
  const { wide } = useLayout();
  const { work } = detail;
  const { summary, edition, sections } = selected;
  const title = workTitle(work, settings.readingLanguage);
  const original = originalTitleToShow(work, title);
  const lifespan = formatLifespan(work.author.born, work.author.died, t);
  const author = lifespan ? `${work.author.name} (${lifespan})` : work.author.name;
  const resume =
    position && sections.some((section) => section.id === position.sectionId) ? position : null;
  const target = resume?.sectionId ?? sections[0]?.id;
  const year = formatYear(work.year, t);
  const note = licenceNote(edition.licence, language);
  const partial = isPartialEdition(summary, detail.editions);

  return (
    <View style={styles.header}>
      <AppText variant="displayM" style={balancedLines}>
        {title}
      </AppText>
      {original ? <AppText variant="original">{original}</AppText> : null}
      <AppText variant="caption" style={styles.author}>
        {author}
      </AppText>

      {editions.length > 1 ? (
        <View style={styles.switch}>
          <SegmentedControl
            label={t.work.editionSwitch}
            options={switchOptions(editions, t)}
            value={summary.editionId}
            onChange={onSelectEdition}
          />
        </View>
      ) : null}

      <View style={styles.meta}>
        <MetaRow label={t.work.edition} value={editionKindLabel(edition.kind, t)} />
        <MetaRow label={t.work.language} value={editionLanguageLabel(edition.language, t)} />
        <MetaRow
          label={t.work.original}
          value={[languageName(work.languageOrig, t), year].filter(Boolean).join(', ')}
        />
        <MetaRow label={t.work.licence} value={licenceLabel(edition.licence.status, t)} />
      </View>
      {partial ? (
        <View style={styles.chips}>
          <Chip label={t.work.partial} />
        </View>
      ) : null}
      {note ? (
        <AppText variant="caption" style={styles.licenceNote}>
          {note}
        </AppText>
      ) : null}

      {target ? (
        <Link href={readHref(work.id, target)} asChild>
          <Button
            variant="primary"
            title={resume ? t.work.continueReading : t.work.startReading}
            style={wide ? styles.ctaWide : styles.cta}
          />
        </Link>
      ) : null}
      <AppText variant="heading" style={styles.contentsTitle}>
        {t.work.contents}
      </AppText>
      <Hairline />
    </View>
  );
}

interface ViewProps {
  workId: string;
  loaded: Loaded;
  selected: EditionView;
}

function WorkView({ workId, loaded, selected }: ViewProps) {
  const t = useT();
  const { settings } = useSettings();
  const router = useRouter();
  const store = useStorage();
  const fonts = useFontFamilies();
  const contentStyle = useListContentStyle('list');
  const { detail, editions } = loaded;
  const { summary, sections } = selected;
  const [positions, setPositions] = useState<Record<string, ReadingPosition | null>>({});
  // The screen stays mounted under the reader, so re-read the positions every time it regains
  // focus. Each edition has its own position; the source edition also finds the one an older
  // version saved for the whole work.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void Promise.all(
        editions.map(
          async ({ summary: edition }) =>
            [
              edition.editionId,
              await loadPosition(
                store,
                edition.editionId,
                edition.kind === 'source' ? workId : undefined,
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

  const depths = sectionDepths(sections);
  const numbered = sections.some((section) => splitChapterHeading(section.heading).numeral);
  const title = workTitle(detail.work, settings.readingLanguage);

  return (
    <Screen>
      {/* The title page below carries the work's title; the header only says where we are. */}
      <Stack.Screen options={{ title, headerTitle: t.work.title }} />
      <PageTitle parts={[title]} />
      <FlatList
        data={sections}
        keyExtractor={(section) => section.id}
        ListHeaderComponent={
          <WorkHeader
            detail={detail}
            editions={editions}
            selected={selected}
            position={position}
            onSelectEdition={(editionId) => router.setParams({ edition: editionId })}
          />
        }
        ListFooterComponent={sections.length > 0 ? <Hairline /> : undefined}
        ListEmptyComponent={<MessageView message={t.work.emptyContents} />}
        ItemSeparatorComponent={Hairline}
        renderItem={({ item }) => {
          const { numeral, title: heading } = splitChapterHeading(item.heading);
          const current = position?.sectionId === item.id;
          return (
            <LinkRow
              href={readHref(workId, item.id)}
              accessibilityLabel={`${t.work.openSection(item.heading)}${current ? `, ${t.work.inProgress}` : ''}`}
              indent={depths.get(item.id) ?? 0}
              current={current}
            >
              <View style={styles.tocRow}>
                {numbered ? (
                  <View style={styles.numeral}>
                    {/* The 600 face at 16 so that roman numerals read clearly (a heading is not
                        what a screen reader should announce for each row). */}
                    <AppText
                      variant="meta"
                      tone="text"
                      style={[styles.numeralText, { fontFamily: fonts.textSemiBold }]}
                    >
                      {numeral}
                    </AppText>
                  </View>
                ) : null}
                <AppText
                  variant="body"
                  {...textLanguageProps(selected.edition.language)}
                  style={styles.tocTitle}
                >
                  {heading || '—'}
                </AppText>
              </View>
            </LinkRow>
          );
        }}
        contentContainerStyle={contentStyle}
      />
    </Screen>
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
          return full ? { summary, edition: full.edition, sections } : null;
        }),
      );
      return { detail, editions: views.filter((view): view is EditionView => view !== null) };
    },
    [workId, settings.readingLanguage],
  );

  if (data.status === 'loading')
    return (
      <Screen>
        <LoadingView message={t.common.loading} />
      </Screen>
    );
  if (data.status === 'error')
    return (
      <Screen>
        <MessageView message={t.common.error} />
      </Screen>
    );
  const selected = data.data
    ? selectEdition(data.data.editions, editionId, data.data.detail.primaryEditionId)
    : undefined;
  if (!data.data || !selected)
    return (
      <Screen>
        <MessageView message={t.work.notFound} />
      </Screen>
    );
  return <WorkView workId={workId} loaded={data.data} selected={selected} />;
}

const styles = StyleSheet.create({
  header: { paddingTop: 32, gap: 8 },
  author: { marginTop: 4 },
  switch: { marginTop: 16, maxWidth: 420 },
  meta: { marginTop: 20, gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 16 },
  metaLabel: { width: 96 },
  metaValue: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  licenceNote: { marginTop: 4, maxWidth: PROSE_MAX_WIDTH },
  cta: { alignSelf: 'stretch', marginTop: 24 },
  ctaWide: { alignSelf: 'flex-start', width: 320, marginTop: 24 },
  contentsTitle: { marginTop: 32, marginBottom: 8 },
  tocRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  numeral: { width: 44 },
  numeralText: { fontSize: 16, lineHeight: 22 },
  tocTitle: { flex: 1 },
});
