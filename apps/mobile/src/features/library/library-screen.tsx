import { Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { HeaderLinks } from '@/components/header-links';
import { LinkRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { LoadingView, MessageView } from '@/components/state-views';
import { useContent } from '@/content/content-context';
import type { WorkSummary } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { t } from '@/i18n';
import { formatYear, languageName, licenceLabel } from '@/i18n/labels';
import { workHref } from '@/navigation-hrefs';

export function workMeta(work: WorkSummary): string {
  const year = formatYear(work.year);
  return [work.authorName, year, languageName(work.languageOrig)].filter(Boolean).join(' · ');
}

function WorkRow({ work }: { work: WorkSummary }) {
  const showOriginal = work.titleOrig.trim() !== '' && work.titleOrig !== work.titleRo;
  return (
    <LinkRow
      href={workHref(work.workId)}
      accessibilityLabel={`${t.library.openWork(work.titleRo)}. ${workMeta(work)}`}
    >
      <AppText variant="heading">{work.titleRo}</AppText>
      {showOriginal ? (
        <AppText variant="caption" muted style={styles.italic}>
          {work.titleOrig}
        </AppText>
      ) : null}
      <AppText variant="caption" muted>
        {workMeta(work)}
      </AppText>
      <AppText variant="caption" muted>
        {licenceLabel(work.licenceStatus)}
      </AppText>
    </LinkRow>
  );
}

export function LibraryScreen() {
  const content = useContent();
  const works = useRepositoryQuery((repository) => repository.listWorks(), []);
  const rejectedCount = content.status === 'ready' ? content.rejected.length : 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: t.library.title, headerRight: () => <HeaderLinks /> }} />
      {works.status === 'loading' ? <LoadingView message={t.library.loading} /> : null}
      {works.status === 'error' ? <MessageView message={t.common.error} /> : null}
      {works.status === 'ready' ? (
        <FlatList
          data={works.data}
          keyExtractor={(work) => work.editionId}
          renderItem={({ item }) => <WorkRow work={item} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <AppText muted>{t.library.subtitle}</AppText>
              {rejectedCount > 0 ? (
                <AppText accessibilityRole="alert">
                  {t.library.unverified(rejectedCount)}
                </AppText>
              ) : null}
            </View>
          }
          ListEmptyComponent={<MessageView message={t.library.empty} />}
          contentContainerStyle={styles.list}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingBottom: 24 },
  header: { padding: 16, gap: 8 },
  italic: { fontStyle: 'italic' },
});
