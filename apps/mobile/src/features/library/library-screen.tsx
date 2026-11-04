import { Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { useListContentStyle } from '@/components/column';
import { Hairline } from '@/components/hairline';
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
      <AppText variant="title">{work.titleRo}</AppText>
      {showOriginal ? <AppText variant="original">{work.titleOrig}</AppText> : null}
      <AppText variant="label" style={styles.meta}>
        {workMeta(work)}
      </AppText>
      <View style={styles.chips}>
        <Chip label={licenceLabel(work.licenceStatus)} />
      </View>
    </LinkRow>
  );
}

export function LibraryScreen() {
  const content = useContent();
  const works = useRepositoryQuery((repository) => repository.listWorks(), []);
  const rejectedCount = content.status === 'ready' ? content.rejected.length : 0;
  const contentStyle = useListContentStyle('list');

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
          ItemSeparatorComponent={Hairline}
          ListHeaderComponent={
            <View style={styles.header}>
              <AppText variant="lead">{t.library.subtitle}</AppText>
              {rejectedCount > 0 ? (
                <AppText variant="ui" accessibilityRole="alert">
                  {t.library.unverified(rejectedCount)}
                </AppText>
              ) : null}
              {works.data.length > 0 ? <Hairline /> : null}
            </View>
          }
          ListFooterComponent={works.data.length > 0 ? <Hairline /> : undefined}
          ListEmptyComponent={<MessageView message={t.library.empty} />}
          contentContainerStyle={contentStyle}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 24, gap: 16 },
  meta: { marginTop: 4 },
  chips: { flexDirection: 'row', marginTop: 8 },
});
