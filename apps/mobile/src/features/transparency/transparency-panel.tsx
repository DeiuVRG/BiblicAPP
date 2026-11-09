import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Dialog, DIALOG_WIDTH_WIDE } from '@/components/dialog';
import { Hairline } from '@/components/hairline';
import { Icon } from '@/components/icon';
import { Sheet, useSheetWidth } from '@/components/sheet';
import { useFeatures } from '@/config/features';
import { correctionsPage, resolveProvenance } from '@/content/provenance';
import { workTitle } from '@/content/titles';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { useT } from '@/i18n';
import { editionLabel, formatDateLong } from '@/i18n/labels';
import { futureHref, transparencyHref } from '@/navigation-hrefs';
import { citationLine } from '@/reading/citation';
import { readUrl } from '@/reading/site-url';
import { useSettings } from '@/settings/settings-context';
import { useTheme } from '@/theme/theme-context';

import { ReportButton } from './report-button';
import {
  checkLines,
  factsLine,
  leadNote,
  passesText,
  publicSourceText,
  reportMailHref,
  reviewSentence,
  transcriptionNote,
} from './transparency-text';

/** Where the reader is when it opens the panel: the report names the place exactly. */
export interface ReaderPlace {
  sectionId: string;
  sectionHeading: string;
  /** The paragraph in view (the first visible one); null at the top of a section. */
  paragraphId: string | null;
}

interface Props {
  visible: boolean;
  onClose(): void;
  workId: string;
  /** The edition the panel is about. */
  editionId: string;
  /** The reader only: the section and paragraph in view, for the report. */
  place?: ReaderPlace;
  /** "Vezi ediția-sursă": the screen switches to the source edition. */
  onViewSource?(sourceEditionId: string): void;
}

/**
 * The Transparency panel (docs/ui-spec-v2.md, 8.6): how the text of an edition was made and who has
 * read it, opened from the reader's toolbar and from the work page. A dialog 560 wide, a bottom sheet
 * on a phone. Nothing in it is gated.
 */
export function TransparencyPanel({
  visible,
  onClose,
  workId,
  editionId,
  place,
  onViewSource,
}: Props) {
  const t = useT();
  const sheet = useSheetWidth();
  const name = t.transparency.panelLabel;
  const body = (
    <PanelBody
      workId={workId}
      editionId={editionId}
      place={place}
      onViewSource={onViewSource}
      onClose={onClose}
    />
  );
  return sheet ? (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={name} testID="transparency">
      {body}
    </Sheet>
  ) : (
    <Dialog
      visible={visible}
      onClose={onClose}
      accessibilityLabel={name}
      width={DIALOG_WIDTH_WIDE}
      testID="transparency"
    >
      {body}
    </Dialog>
  );
}

function Row({
  label,
  testID,
  children,
}: {
  label: string;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Hairline />
      <View testID={testID} style={styles.row}>
        <AppText variant="label">{label}</AppText>
        {children}
      </View>
    </View>
  );
}

function PanelBody({ workId, editionId, place, onViewSource, onClose }: Omit<Props, 'visible'>) {
  const t = useT();
  const { colors } = useTheme();
  const { settings } = useSettings();
  const features = useFeatures();
  const [page, setPage] = useState(0);

  const data = useRepositoryQuery(
    async (repository) => {
      const [detail, edition] = await Promise.all([
        repository.getWork(workId),
        repository.getEdition(editionId),
      ]);
      if (!detail || !edition) return null;
      const source = edition.sourceEditionId
        ? await repository.getEdition(edition.sourceEditionId)
        : null;
      // The paragraph in view and the source paragraph it renders: the report carries both.
      const paragraphs = place ? await repository.getParagraphs(place.sectionId) : [];
      const paragraph = paragraphs.find((candidate) => candidate.id === place?.paragraphId) ?? null;
      return { detail, edition, source, paragraph };
    },
    [workId, editionId, place?.sectionId, place?.paragraphId],
  );

  if (data.status !== 'ready' || data.data === null) {
    return <AppText variant="caption">{t.transparency.loading}</AppText>;
  }
  const { detail, edition: full, source, paragraph } = data.data;
  const { edition } = full;
  const resolved = resolveProvenance(edition);
  const translation = edition.kind === 'translation';
  const title = workTitle(detail.work, settings.readingLanguage);
  const lead = leadNote(resolved, edition, detail.work.languageOrig, t);
  const second = transcriptionNote(resolved, t);
  const checks = checkLines(resolved, t);
  const passes = passesText(resolved, t);
  const date = formatDateLong(resolved.generatedAt, t);
  const corrections = correctionsPage(resolved.corrections, page);

  const sourceLine = (() => {
    if (translation && source) {
      const base = t.transparency.sourceText(title, editionLabel(source, t));
      const origin = publicSourceText(source.edition.provenance.source);
      return origin === '' ? base : `${base}; ${origin}`;
    }
    const own = [
      publicSourceText(resolved.source),
      lead.body === resolved.sourceDescription ? '' : (resolved.sourceDescription ?? ''),
    ]
      .filter((part) => part !== '')
      .join(' ');
    return own === '' ? null : own;
  })();

  const citation = place
    ? citationLine(
        {
          author: detail.work.author.name,
          title,
          section: place.sectionHeading,
          editionLanguage: detail.editions.length > 1 ? edition.language : undefined,
          url: readUrl(workId, place.sectionId, place.paragraphId),
        },
        t,
      )
    : undefined;
  const mail = reportMailHref(
    {
      title,
      editionId,
      language: edition.language,
      ...(edition.sourceEditionId === undefined
        ? null
        : { sourceEditionId: edition.sourceEditionId }),
      ...(place === undefined ? null : { sectionId: place.sectionId }),
      ...(paragraph === null
        ? null
        : {
            paragraphId: paragraph.id,
            // A source paragraph is its own source; a translated one names it.
            sourceParagraphId: paragraph.sourceId ?? paragraph.id,
          }),
      ...(citation === undefined ? null : { citation }),
    },
    t,
  );

  return (
    <View testID="transparency-content" style={styles.body}>
      <View style={styles.titleRow}>
        <Icon name="chevronUp" size={14} color={colors.accentStrong} />
        <AppText variant="label" tone="accent" level={2} style={styles.titleLabel}>
          {resolved.machine ? t.transparency.titleAi : t.transparency.title}
        </AppText>
      </View>
      <AppText variant="meta" muted testID="transparency-facts">
        {factsLine(resolved, edition, t)}
      </AppText>

      <View testID="transparency-lead" style={[styles.lead, { borderLeftColor: colors.accent }]}>
        <AppText variant="meta" strong>
          {lead.lead}
        </AppText>
        <AppText variant="meta">{lead.body}</AppText>
      </View>
      {second ? (
        <View
          testID="transparency-transcription"
          style={[styles.lead, { borderLeftColor: colors.border }]}
        >
          <AppText variant="meta" strong>
            {second.lead}
          </AppText>
          <AppText variant="meta">{second.body}</AppText>
        </View>
      ) : null}

      {sourceLine ? (
        <Row label={t.transparency.rowSource} testID="transparency-source">
          <AppText variant="meta">{sourceLine}</AppText>
          {translation && source && onViewSource ? (
            <Button
              testID="transparency-view-source"
              variant="text"
              title={t.transparency.viewSource}
              onPress={() => {
                onViewSource(source.editionId);
                onClose();
              }}
              style={styles.textButton}
            />
          ) : null}
        </Row>
      ) : null}

      {translation && (resolved.model || passes || checks.length > 0) ? (
        <Row label={t.transparency.rowTranslation} testID="transparency-translation">
          {resolved.model ? (
            <AppText variant="meta">
              {t.transparency.translationModel(resolved.model, date)}
            </AppText>
          ) : null}
          {passes ? <AppText variant="meta">{passes}</AppText> : null}
          {checks.length > 0 ? (
            <View style={styles.checks}>
              <AppText variant="caption">{t.transparency.checksHeading}</AppText>
              {checks.map((check) => (
                <AppText key={check.code} variant="meta">
                  {`${check.name}: ${check.result}`}
                </AppText>
              ))}
            </View>
          ) : null}
        </Row>
      ) : null}

      <Row label={t.transparency.rowReview} testID="transparency-review">
        <View style={styles.reviewLine}>
          <Chip
            status
            testID="transparency-review-chip"
            label={resolved.reviewed ? t.transparency.reviewed : t.transparency.needsReview}
          />
          <AppText variant="meta" style={styles.reviewText}>
            {reviewSentence(resolved, translation, t)}
          </AppText>
        </View>
      </Row>

      <Row label={t.transparency.rowCorrections} testID="transparency-corrections">
        {corrections.items.length === 0 ? (
          <AppText variant="meta">{t.transparency.noCorrections}</AppText>
        ) : (
          <View style={styles.corrections}>
            {corrections.items.map((correction, index) => (
              <View key={`${correction.at}-${index}`} style={styles.correction}>
                <AppText variant="caption">
                  {formatDateLong(correction.at, t) || correction.at}
                </AppText>
                <AppText variant="meta">{correction.summary}</AppText>
              </View>
            ))}
            {corrections.pages > 1 ? (
              <View style={styles.pager}>
                <Button
                  testID="transparency-newer"
                  variant="text"
                  title={t.transparency.correctionsNewer}
                  disabled={corrections.page === 0}
                  onPress={() => setPage(corrections.page - 1)}
                />
                <AppText variant="caption" accessibilityLiveRegion="polite">
                  {t.transparency.correctionsPage(corrections.page + 1, corrections.pages)}
                </AppText>
                <Button
                  testID="transparency-older"
                  variant="text"
                  title={t.transparency.correctionsOlder}
                  disabled={corrections.page >= corrections.pages - 1}
                  onPress={() => setPage(corrections.page + 1)}
                />
              </View>
            ) : null}
          </View>
        )}
        <AppText variant="caption" testID="transparency-revision">
          {t.transparency.packRevision(full.pack.revision, formatDateLong(full.pack.createdAt, t))}
        </AppText>
      </Row>

      <Link href={futureHref(mail)} asChild>
        <ReportButton
          testID="transparency-report"
          title={t.transparency.report}
          style={styles.report}
        />
      </Link>
      {features.transparency ? (
        <Link href={transparencyHref} asChild>
          <Button
            testID="transparency-policy"
            variant="text"
            title={t.transparency.policyLink}
            accessibilityRole="link"
            onPress={onClose}
            style={styles.policy}
          />
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleLabel: { letterSpacing: 1.43 },
  lead: { borderLeftWidth: 3, paddingLeft: 14, gap: 6 },
  row: { paddingTop: 12, gap: 6 },
  checks: { gap: 2, marginTop: 4 },
  reviewLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  reviewText: { flexShrink: 1, flexBasis: 200, flexGrow: 1 },
  corrections: { gap: 10 },
  correction: { gap: 2 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textButton: { alignSelf: 'flex-start', marginLeft: -16 },
  report: { alignSelf: 'stretch', marginTop: 4 },
  policy: { alignSelf: 'center' },
});
