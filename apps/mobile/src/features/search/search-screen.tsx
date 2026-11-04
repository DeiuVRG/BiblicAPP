import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { AppText, UI_MAX_FONT_SCALE, useTypeStyle } from '@/components/app-text';
import { Button } from '@/components/button';
import { Column, useListContentStyle } from '@/components/column';
import { Hairline } from '@/components/hairline';
import { HighlightedText } from '@/components/highlighted-text';
import { LinkRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { LoadingView, MessageView } from '@/components/state-views';
import type { SearchHit } from '@/content/types';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { t } from '@/i18n';
import { readHref } from '@/navigation-hrefs';
import { useFontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

/** Same cap as the repository (`MAX_SEARCH_HITS`); used only to tell the user results are capped. */
const RESULT_CAP = 50;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function SearchScreen({ initialQuery = '' }: { initialQuery?: string }) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const contentStyle = useListContentStyle('list');
  const [text, setText] = useState(initialQuery);
  const query = useDebounced(text.trim(), DEBOUNCE_MS);
  const active = query.length >= MIN_QUERY_LENGTH;

  const results = useRepositoryQuery(
    async (repository) => {
      if (!active) return null;
      const [hits, works] = await Promise.all([repository.search(query), repository.listWorks()]);
      return { hits, titles: new Map(works.map((work) => [work.workId, work.titleRo])) };
    },
    [query, active],
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: t.search.title }} />
      <Column kind="list" style={styles.inputRow}>
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
              borderColor: colors.border,
              fontFamily: fonts.ui,
            },
          ]}
        />
        {text.length > 0 ? (
          <Button
            variant="text"
            title="✕"
            label={t.search.clear}
            onPress={() => setText('')}
            style={styles.clear}
          />
        ) : null}
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
              workTitle={results.data?.titles.get(item.workId) ?? ''}
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
  workTitle,
}: {
  hit: SearchHit;
  query: string;
  workTitle: string;
}) {
  const snippetStyle = useTypeStyle('body', false);
  // The chapter comes first: when the line is too long it is the work title that gets cut off.
  const place = [hit.sectionHeading, workTitle].filter(Boolean).join(' · ');
  return (
    <LinkRow
      href={readHref(hit.workId, hit.sectionId, { p: hit.paragraphId, q: query })}
      accessibilityLabel={`${t.search.openResult(place)}: ${hit.snippet}`}
    >
      <AppText variant="label" numberOfLines={1}>
        {place}
      </AppText>
      <HighlightedText text={hit.snippet} query={query} style={snippetStyle} />
    </LinkRow>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  clear: { paddingHorizontal: 12 },
  count: { paddingBottom: 12 },
});
