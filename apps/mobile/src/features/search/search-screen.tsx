import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, UI_MAX_FONT_SCALE } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
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
      <View style={styles.inputRow}>
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
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, fontFamily: fonts.ui },
          ]}
        />
        {text.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.search.clear}
            onPress={() => setText('')}
            style={styles.clear}
          >
            <AppText variant="label" style={{ color: colors.accent }}>
              ✕
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {!active ? <MessageView message={t.search.hint} /> : null}
      {active && results.status === 'loading' ? <LoadingView message={t.search.searching} /> : null}
      {active && results.status === 'error' ? <MessageView message={t.common.error} /> : null}
      {active && results.status === 'ready' && results.data ? (
        <FlatList
          data={results.data.hits}
          keyExtractor={(hit) => hit.paragraphId}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            results.data.hits.length > 0 ? (
              <AppText variant="caption" muted style={styles.count} accessibilityLiveRegion="polite">
                {results.data.hits.length >= RESULT_CAP
                  ? t.search.resultsCapped(results.data.hits.length)
                  : t.search.results(results.data.hits.length)}
              </AppText>
            ) : undefined
          }
          ListEmptyComponent={<MessageView message={t.search.noResults} />}
          renderItem={({ item }) => (
            <ResultRow hit={item} query={query} workTitle={results.data?.titles.get(item.workId) ?? ''} />
          )}
          contentContainerStyle={styles.list}
        />
      ) : null}
    </Screen>
  );
}

function ResultRow({ hit, query, workTitle }: { hit: SearchHit; query: string; workTitle: string }) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const place = [workTitle, hit.sectionHeading].filter(Boolean).join(' · ');
  return (
    <LinkRow
      href={readHref(hit.workId, hit.sectionId, { p: hit.paragraphId, q: query })}
      accessibilityLabel={`${t.search.openResult(place)}: ${hit.snippet}`}
    >
      <AppText variant="caption" muted>
        {place}
      </AppText>
      <HighlightedText
        text={hit.snippet}
        query={query}
        style={{ color: colors.text, fontFamily: fonts.reading, fontSize: 16, lineHeight: 24, textAlign: 'left' }}
      />
    </LinkRow>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },
  input: {
    flex: 1,
    minHeight: MIN_TARGET,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  clear: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, paddingBottom: 24 },
  count: { paddingHorizontal: 16, paddingBottom: 8 },
});
