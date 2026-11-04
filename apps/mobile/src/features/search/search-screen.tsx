import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { AppText, UI_MAX_FONT_SCALE, useTypeStyle } from '@/components/app-text';
import { Button, MIN_TARGET } from '@/components/button';
import { Column, useListContentStyle } from '@/components/column';
import { Hairline } from '@/components/hairline';
import { HighlightedText } from '@/components/highlighted-text';
import { LinkRow } from '@/components/list-row';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { LoadingView, MessageView } from '@/components/state-views';
import { workTitle } from '@/content/titles';
import type { SearchHit } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { useT } from '@/i18n';
import { editionLanguageLabel } from '@/i18n/labels';
import { readHref } from '@/navigation-hrefs';
import { useSettings } from '@/settings/settings-context';
import { useFontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

/** Same cap as the repository (`MAX_SEARCH_HITS`); used only to tell the user results are capped. */
const RESULT_CAP = 50;

/** Room the clear button takes at the right end of the field, so the text never runs under it. */
const CLEAR_SLOT = MIN_TARGET;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function SearchScreen({ initialQuery = '' }: { initialQuery?: string }) {
  const t = useT();
  const { settings } = useSettings();
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const contentStyle = useListContentStyle('list');
  const [text, setText] = useState(initialQuery);
  const query = useDebounced(text.trim(), DEBOUNCE_MS);
  const active = query.length >= MIN_QUERY_LENGTH;

  const results = useRepositoryQuery(
    async (repository) => {
      if (!active) return null;
      const [hits, works] = await Promise.all([
        repository.search(query),
        repository.listWorks(settings.readingLanguage),
      ]);
      const titles = new Map(
        works.map((work) => [work.workId, workTitle(work, settings.readingLanguage)]),
      );
      return { hits, titles };
    },
    [query, active, settings.readingLanguage],
  );
  // The work's title is only worth repeating on every hit when the hits come from several works.
  const manyWorks =
    results.status === 'ready' && results.data
      ? new Set(results.data.hits.map((hit) => hit.workId)).size > 1
      : false;

  return (
    <Screen>
      <Stack.Screen options={{ title: t.search.title }} />
      <PageTitle parts={[t.search.title]} />
      <Column kind="list" style={styles.inputRow}>
        <View style={styles.field}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t.search.placeholder}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t.search.label}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            maxFontSizeMultiplier={UI_MAX_FONT_SCALE}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.borderStrong,
                fontFamily: fonts.ui,
              },
            ]}
          />
          {text.length > 0 ? (
            // Inside the field, over the room the input leaves free: the field never resizes.
            <Button
              variant="text"
              title="×"
              label={t.search.clear}
              onPress={() => setText('')}
              textStyle={[styles.clearText, { color: colors.textMuted }]}
              style={styles.clear}
            />
          ) : null}
        </View>
      </Column>

      {!active ? <MessageView message={t.search.hint} /> : null}
      {active && results.status === 'loading' ? <LoadingView message={t.search.searching} /> : null}
      {active && results.status === 'error' ? <MessageView message={t.common.error} /> : null}
      {active && results.status === 'ready' && results.data ? (
        <FlatList
          data={results.data.hits}
          keyExtractor={(hit) => hit.paragraphId}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={Hairline}
          ListHeaderComponent={
            results.data.hits.length > 0 ? (
              <View>
                <AppText variant="caption" style={styles.count} accessibilityLiveRegion="polite">
                  {results.data.hits.length >= RESULT_CAP
                    ? t.search.resultsCapped(results.data.hits.length)
                    : t.search.results(results.data.hits.length)}
                </AppText>
                <Hairline />
              </View>
            ) : undefined
          }
          ListFooterComponent={results.data.hits.length > 0 ? <Hairline /> : undefined}
          ListEmptyComponent={<MessageView message={t.search.noResults} />}
          renderItem={({ item }) => (
            <ResultRow
              hit={item}
              query={query}
              title={results.data?.titles.get(item.workId) ?? ''}
              showWork={manyWorks}
            />
          )}
          contentContainerStyle={contentStyle}
        />
      ) : null}
    </Screen>
  );
}

function ResultRow({
  hit,
  query,
  title,
  showWork,
}: {
  hit: SearchHit;
  query: string;
  /** Title of the work, in the reading language. */
  title: string;
  showWork: boolean;
}) {
  const t = useT();
  const snippetStyle = useTypeStyle('body', false);
  // The language of the edition the hit is in, written next to the chapter.
  const language = editionLanguageLabel(hit.language, t);
  // Screen readers always hear where the hit is; the visible line names the work only when the
  // hits come from several works. It may use two lines and breaks between words.
  const withWork = [hit.sectionHeading, title].filter(Boolean).join(' · ');
  const heading = (showWork ? withWork : hit.sectionHeading) || withWork;
  const place = [hit.sectionHeading, language, title].filter(Boolean).join(' · ');
  return (
    <LinkRow
      href={readHref(hit.workId, hit.sectionId, { p: hit.paragraphId, q: query })}
      accessibilityLabel={`${t.search.openResult(place)}: ${hit.snippet}`}
    >
      <View style={styles.place}>
        <AppText variant="label" numberOfLines={2} style={styles.heading}>
          {heading}
        </AppText>
        <AppText variant="label" style={styles.language}>
          {language}
        </AppText>
      </View>
      <HighlightedText
        text={hit.snippet}
        query={query}
        style={snippetStyle}
        language={hit.language}
      />
    </LinkRow>
  );
}

const styles = StyleSheet.create({
  inputRow: { paddingTop: 24, paddingBottom: 16 },
  field: { width: '100%' },
  input: {
    width: '100%',
    minWidth: 0,
    height: 48,
    borderWidth: 1,
    borderRadius: 6,
    paddingLeft: 14,
    paddingRight: CLEAR_SLOT,
    fontSize: 16,
  },
  // 48 px field, 44 px button, 2 px around it.
  clear: { position: 'absolute', top: 2, right: 2, paddingHorizontal: 0 },
  clearText: { fontSize: 24, lineHeight: 28 },
  count: { paddingBottom: 12 },
  place: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10 },
  heading: { flexShrink: 1 },
  language: { flexShrink: 0 },
});
