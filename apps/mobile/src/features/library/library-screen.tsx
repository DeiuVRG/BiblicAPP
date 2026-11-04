import { Stack } from 'expo-router';
import { Fragment } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Chip } from '@/components/chip';
import { useListContentStyle } from '@/components/column';
import { Hairline } from '@/components/hairline';
import { HeaderLinks } from '@/components/header-links';
import { LinkRow } from '@/components/list-row';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { LoadingView, MessageView } from '@/components/state-views';
import { useContent } from '@/content/content-context';
import { isPartialEdition } from '@/content/editions';
import { originalTitleToShow, workTitle } from '@/content/titles';
import type { WorkSummary } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { useT } from '@/i18n';
import { editionLabel, formatYear, languageName, licenceLabel } from '@/i18n/labels';
import type { Strings } from '@/i18n/strings';
import { workHref } from '@/navigation-hrefs';
import { useSettings } from '@/settings/settings-context';

/** "Geerhardus Vos · 1903 · Engleză": author, year of the original and its language. */
export function workMeta(work: WorkSummary, t: Strings): string {
  const year = formatYear(work.year, t);
  return [work.authorName, year, languageName(work.languageOrig, t)].filter(Boolean).join(' · ');
}

function WorkRow({ work }: { work: WorkSummary }) {
  const t = useT();
  const { settings } = useSettings();
  const title = workTitle(work, settings.readingLanguage);
  const original = originalTitleToShow(work, title);
  const primary = work.editions.find((edition) => edition.editionId === work.primaryEditionId);
  // Screen readers get the editions in the label of the row (the chips below carry them visually).
  const editions = work.editions
    .map((edition) =>
      isPartialEdition(edition, work.editions)
        ? `${editionLabel(edition, t)}, ${t.work.partial.toLowerCase()}`
        : editionLabel(edition, t),
    )
    .join('; ');
  return (
    <LinkRow
      href={workHref(work.workId)}
      accessibilityLabel={`${t.library.openWork(title)}. ${workMeta(work, t)}. ${t.library.editions}: ${editions}`}
    >
      <AppText variant="title">{title}</AppText>
      {original ? <AppText variant="original">{original}</AppText> : null}
      <AppText variant="label" style={styles.meta}>
        {workMeta(work, t)}
      </AppText>
      <View style={styles.chips}>
        {primary ? <Chip label={licenceLabel(primary.licenceStatus, t)} /> : null}
        {work.editions.map((edition) => (
          <Fragment key={edition.editionId}>
            <Chip label={editionLabel(edition, t)} />
            {isPartialEdition(edition, work.editions) ? <Chip label={t.work.partial} /> : null}
          </Fragment>
        ))}
      </View>
    </LinkRow>
  );
}

export function LibraryScreen() {
  const t = useT();
  const { settings } = useSettings();
  const content = useContent();
  const works = useRepositoryQuery(
    (repository) => repository.listWorks(settings.readingLanguage),
    [settings.readingLanguage],
  );
  const rejectedCount = content.status === 'ready' ? content.rejected.length : 0;
  const contentStyle = useListContentStyle('list');

  return (
    <Screen>
      <Stack.Screen options={{ title: t.library.title, headerRight: () => <HeaderLinks /> }} />
      <PageTitle parts={[t.library.title]} />
      {works.status === 'loading' ? <LoadingView message={t.library.loading} /> : null}
      {works.status === 'error' ? <MessageView message={t.common.error} /> : null}
      {works.status === 'ready' ? (
        <FlatList
          data={works.data}
          keyExtractor={(work) => work.workId}
          renderItem={({ item }) => <WorkRow work={item} />}
          ItemSeparatorComponent={Hairline}
          ListHeaderComponent={
            <View style={styles.header}>
              <AppText variant="lead">{t.library.subtitle}</AppText>
              {rejectedCount > 0 ? (
                <AppText variant="meta" accessibilityRole="alert">
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
