import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Band } from '@/components/band';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Disclosure } from '@/components/disclosure';
import { Hairline } from '@/components/hairline';
import { Hero } from '@/components/hero';
import { PageTitle } from '@/components/page-title';
import { resolveProvenance } from '@/content/provenance';
import type { ResolvedProvenance } from '@/content/provenance';
import { workTitle } from '@/content/titles';
import type { ContentRepository } from '@/content/repository';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { useT } from '@/i18n';
import { formatDateLong, languageName } from '@/i18n/labels';
import { futureHref } from '@/navigation-hrefs';
import { useSettings } from '@/settings/settings-context';
import { Footer } from '@/shell/footer';
import { Main, PageScroll } from '@/shell/page-scroll';

import { reportMailHref } from '../transparency/transparency-text';

/** How many editions the list of machine translations shows before "Arată mai multe". */
export const AI_WORKS_PAGE = 50;

interface AiEdition {
  editionId: string;
  workId: string;
  title: string;
  author: string;
  from: string;
  to: string;
  resolved: ResolvedProvenance;
}

const NO_ENTRIES: readonly AiEdition[] = [];

/** Every installed edition that a machine translated, in the order of the library. */
async function loadAiEditions(
  repository: ContentRepository,
  readingLanguage: 'ro' | 'en',
): Promise<AiEdition[]> {
  const works = await repository.listWorks(readingLanguage);
  const loaded = await Promise.all(
    works.flatMap((work) =>
      work.editions
        .filter((edition) => edition.kind === 'translation')
        .map(async (edition) => {
          const detail = await repository.getEdition(edition.editionId);
          if (!detail) return null;
          const resolved = resolveProvenance(detail.edition);
          if (!resolved.machine) return null;
          return {
            editionId: edition.editionId,
            workId: work.workId,
            title: workTitle(work, readingLanguage),
            author: work.authorName,
            from: resolved.sourceLanguage ?? work.languageOrig,
            to: edition.language,
            resolved,
          } satisfies AiEdition;
        }),
    ),
  );
  return loaded.filter((entry): entry is AiEdition => entry !== null);
}

/**
 * `/about/transparency` (docs/ui-spec-v2.md, 15): the policy page. Eight commitments, each a heading and a
 * short paragraph, a ninth block on Ask, a button to report a problem and the closed list of every
 * work that a machine translated, with its model, date and status.
 */
export function TransparencyPage() {
  const t = useT();
  const { settings } = useSettings();
  const language = settings.readingLanguage;
  const ai = useRepositoryQuery((repository) => loadAiEditions(repository, language), [language]);
  const mail = reportMailHref({ title: t.appName, editionId: '', language }, t);
  const x = t.transparency;
  return (
    <PageScroll>
      <PageTitle parts={[x.pageTitle]} />
      <Main>
        <Hero
          kind="page"
          testID="transparency-hero"
          kicker={x.pageEyebrow}
          pilcrow={false}
          title={x.pageTitle}
          sub={x.pageLead}
        />
        <Band
          container="narrow"
          padding={{ top: 48, bottom: 56 }}
          testID="transparency-policy-body"
        >
          <View style={styles.column}>
            {x.commitments.map((commitment, index) => (
              <View key={commitment.title} testID={`commitment-${index + 1}`} style={styles.block}>
                <AppText variant="heading" level={2}>
                  {commitment.title}
                </AppText>
                <AppText variant="body" style={styles.prose}>
                  {commitment.body}
                </AppText>
              </View>
            ))}
            <View testID="commitment-ask" style={styles.block}>
              <AppText variant="heading" level={2}>
                {x.askTitle}
              </AppText>
              <AppText variant="body" style={styles.prose}>
                {x.askBody}
              </AppText>
            </View>
            <Link href={futureHref(mail)} asChild>
              <Button
                testID="transparency-page-report"
                variant="primary"
                title={x.reportButton}
                accessibilityRole="link"
                style={styles.report}
              />
            </Link>
            <Hairline />
            <Disclosure summary={x.aiWorks} testID="ai-works">
              <AiWorks state={ai} />
            </Disclosure>
          </View>
        </Band>
        <Footer />
      </Main>
    </PageScroll>
  );
}

function AiWorks({ state }: { state: ReturnType<typeof useRepositoryQuery<AiEdition[]>> }) {
  const t = useT();
  const [shown, setShown] = useState(AI_WORKS_PAGE);
  const data = state.status === 'ready' ? state.data : null;
  const entries = data ?? NO_ENTRIES;
  const visible = useMemo(() => entries.slice(0, shown), [entries, shown]);
  if (state.status === 'loading') return <AppText variant="caption">{t.common.loading}</AppText>;
  if (entries.length === 0) return <AppText variant="meta">{t.transparency.aiWorksNone}</AppText>;
  return (
    <View style={styles.list}>
      {visible.map((entry) => (
        <AiWorkRow key={entry.editionId} entry={entry} />
      ))}
      {entries.length > visible.length ? (
        <Button
          variant="text"
          title={t.transparency.aiWorksMore}
          onPress={() => setShown(shown + AI_WORKS_PAGE)}
          style={styles.more}
        />
      ) : null}
    </View>
  );
}

function AiWorkRow({ entry }: { entry: AiEdition }) {
  const t = useT();
  const { resolved } = entry;
  const status = resolved.reviewed ? t.transparency.reviewed : t.transparency.needsReview;
  const date = formatDateLong(resolved.generatedAt, t);
  return (
    <View
      testID={`ai-work-${entry.editionId}`}
      accessible
      accessibilityLabel={t.transparency.aiRowLabel(entry.title, status)}
      style={styles.workRow}
    >
      <AppText variant="meta" strong>
        {entry.title}
      </AppText>
      <AppText variant="caption">
        {[
          entry.author,
          t.transparency.aiRow(languageName(entry.from, t), languageName(entry.to, t)),
          resolved.model ?? '',
          date,
        ]
          .filter((part) => part !== '')
          .join(' · ')}
      </AppText>
      <View style={styles.status}>
        <Chip status label={status} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 28 },
  block: { gap: 8 },
  prose: { maxWidth: 560 },
  report: { alignSelf: 'flex-start' },
  list: { gap: 14, paddingTop: 4 },
  workRow: { gap: 2 },
  status: { alignSelf: 'flex-start', paddingTop: 4 },
  more: { alignSelf: 'flex-start', marginLeft: -16 },
});
