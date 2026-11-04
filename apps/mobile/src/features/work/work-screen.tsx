import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { Section } from '@biblioteca/shared';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { useListContentStyle } from '@/components/column';
import { Hairline } from '@/components/hairline';
import { LinkRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { LoadingView, MessageView } from '@/components/state-views';
import type { WorkDetail } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { t } from '@/i18n';
import {
  editionKindLabel,
  formatLifespan,
  formatYear,
  languageName,
  licenceLabel,
} from '@/i18n/labels';
import { readHref } from '@/navigation-hrefs';
import { splitChapterHeading } from '@/reading/heading';
import { sectionDepths } from '@/reading/navigation';
import { loadPosition } from '@/reading/position-store';
import type { ReadingPosition } from '@/reading/position-store';
import { useStorage } from '@/storage/key-value-store';
import { useLayout } from '@/theme/layout';

/** One row of the two-column metadata block: a label and its value. */
function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <AppText variant="label" style={styles.metaLabel}>
        {label}
      </AppText>
      <AppText variant="ui" style={styles.metaValue}>
        {value}
      </AppText>
    </View>
  );
}

function WorkHeader({
  detail,
  sections,
  position,
}: {
  detail: WorkDetail;
  sections: Section[];
  position: ReadingPosition | null;
}) {
  const { wide } = useLayout();
  const { work, edition } = detail;
  const lifespan = formatLifespan(work.author.born, work.author.died);
  const author = lifespan ? `${work.author.name} (${lifespan})` : work.author.name;
  const resume =
    position && sections.some((section) => section.id === position.sectionId) ? position : null;
  const target = resume?.sectionId ?? sections[0]?.id;
  const year = formatYear(work.year);

  return (
    <View style={styles.header}>
      <AppText variant="display">{work.titleRo}</AppText>
      {work.titleOrig !== work.titleRo ? (
        <AppText variant="original">{work.titleOrig}</AppText>
      ) : null}
      <AppText variant="caption" style={styles.author}>
        {author}
      </AppText>

      <View style={styles.meta}>
        <MetaRow label={t.work.edition} value={editionKindLabel(edition.kind)} />
        <MetaRow label={t.work.language} value={languageName(edition.language)} />
        <MetaRow
          label={t.work.original}
          value={[languageName(work.languageOrig), year].filter(Boolean).join(', ')}
        />
        <MetaRow label={t.work.licence} value={licenceLabel(edition.licence.status)} />
      </View>
      {edition.licence.note ? (
        <AppText variant="caption" style={styles.licenceNote}>
          {edition.licence.note}
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

export function WorkScreen({ workId }: { workId: string }) {
  const store = useStorage();
  const contentStyle = useListContentStyle('list');
  const data = useRepositoryQuery(
    async (repository) => {
      const [detail, sections] = await Promise.all([
        repository.getWork(workId),
        repository.getSections(workId),
      ]);
      return { detail, sections };
    },
    [workId],
  );
  const [position, setPosition] = useState<ReadingPosition | null>(null);
  // The screen stays mounted under the reader, so re-read the position every time it regains focus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadPosition(store, workId).then((stored) => {
        if (!cancelled) setPosition(stored);
      });
      return () => {
        cancelled = true;
      };
    }, [store, workId]),
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
  const { detail, sections } = data.data;
  if (!detail)
    return (
      <Screen>
        <MessageView message={t.work.notFound} />
      </Screen>
    );
  const depths = sectionDepths(sections);
  const numbered = sections.some((section) => splitChapterHeading(section.heading).numeral);

  return (
    <Screen>
      {/* The title page below carries the work's title; the header only says where we are. */}
      <Stack.Screen options={{ title: detail.work.titleRo, headerTitle: t.work.title }} />
      <FlatList
        data={sections}
        keyExtractor={(section) => section.id}
        ListHeaderComponent={<WorkHeader detail={detail} sections={sections} position={position} />}
        ListFooterComponent={sections.length > 0 ? <Hairline /> : undefined}
        ListEmptyComponent={<MessageView message={t.work.emptyContents} />}
        ItemSeparatorComponent={Hairline}
        renderItem={({ item }) => {
          const { numeral, title } = splitChapterHeading(item.heading);
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
                    <AppText variant="label">{numeral}</AppText>
                  </View>
                ) : null}
                <AppText variant="body" style={styles.tocTitle}>
                  {title || '—'}
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

const styles = StyleSheet.create({
  header: { paddingTop: 32, gap: 8 },
  author: { marginTop: 4 },
  meta: { marginTop: 20, gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 16 },
  metaLabel: { width: 96 },
  metaValue: { flex: 1 },
  licenceNote: { marginTop: 4 },
  cta: { alignSelf: 'stretch', marginTop: 24 },
  ctaWide: { alignSelf: 'flex-start', width: 320, marginTop: 24 },
  contentsTitle: { marginTop: 32, marginBottom: 8 },
  tocRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  numeral: { width: 44 },
  tocTitle: { flex: 1 },
});
