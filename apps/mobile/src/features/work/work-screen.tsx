import { Link, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { Section } from '@biblioteca/shared';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
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
import { sectionDepths } from '@/reading/navigation';
import { loadPosition } from '@/reading/position-store';
import type { ReadingPosition } from '@/reading/position-store';
import { useStorage } from '@/storage/key-value-store';

function MetaLine({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <AppText variant="caption" muted>
      {label}: {value}
    </AppText>
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
  const { work, edition } = detail;
  const lifespan = formatLifespan(work.author.born, work.author.died);
  const author = lifespan ? `${work.author.name} (${lifespan})` : work.author.name;
  const resume =
    position && sections.some((section) => section.id === position.sectionId) ? position : null;
  const target = resume?.sectionId ?? sections[0]?.id;
  const year = formatYear(work.year);

  return (
    <View style={styles.header}>
      <AppText variant="title">{work.titleRo}</AppText>
      {work.titleOrig !== work.titleRo ? (
        <AppText muted style={styles.italic}>
          {work.titleOrig}
        </AppText>
      ) : null}
      <MetaLine label={t.work.author} value={author} />
      <MetaLine
        label={t.work.originalLanguage}
        value={[languageName(work.languageOrig), year].filter(Boolean).join(', ')}
      />
      <MetaLine
        label={t.work.edition}
        value={`${editionKindLabel(edition.kind)}, ${languageName(edition.language)}`}
      />
      <MetaLine
        label={t.work.licence}
        value={[licenceLabel(edition.licence.status), edition.licence.note]
          .filter(Boolean)
          .join('. ')}
      />
      {target ? (
        <Link href={readHref(work.id, target)} asChild>
          <Button variant="primary" title={resume ? t.work.continueReading : t.work.startReading} />
        </Link>
      ) : null}
      <AppText variant="heading" style={styles.contentsTitle}>
        {t.work.contents}
      </AppText>
    </View>
  );
}

export function WorkScreen({ workId }: { workId: string }) {
  const store = useStorage();
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
  useEffect(() => {
    let cancelled = false;
    void loadPosition(store, workId).then((stored) => {
      if (!cancelled) setPosition(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [store, workId]);

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

  return (
    <Screen>
      <Stack.Screen options={{ title: detail.work.titleRo }} />
      <FlatList
        data={sections}
        keyExtractor={(section) => section.id}
        ListHeaderComponent={<WorkHeader detail={detail} sections={sections} position={position} />}
        ListEmptyComponent={<MessageView message={t.work.emptyContents} />}
        renderItem={({ item }) => (
          <LinkRow
            href={readHref(workId, item.id)}
            accessibilityLabel={t.work.openSection(item.heading)}
            indent={depths.get(item.id) ?? 0}
          >
            <AppText>
              {item.heading || '—'}
              {position?.sectionId === item.id ? `  (${t.work.inProgress})` : ''}
            </AppText>
          </LinkRow>
        )}
        contentContainerStyle={styles.list}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  header: { padding: 16, gap: 6 },
  italic: { fontStyle: 'italic' },
  contentsTitle: { marginTop: 16 },
});
