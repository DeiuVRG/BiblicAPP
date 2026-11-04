import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText, useTypeStyle } from '@/components/app-text';
import { useListContentStyle } from '@/components/column';
import { Hairline } from '@/components/hairline';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { FontSizeControl, LineHeightControl, ThemeControl } from '@/components/typography-controls';
import { useContent } from '@/content/content-context';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { t } from '@/i18n';
import { licenceLabel } from '@/i18n/labels';
import { PROSE_MAX_WIDTH } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';

import { READING_MAX_FONT_SCALE } from '../reader/reader-paragraph';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** A rule (except above the first section), a label-style heading (CITIRE, TEMA, DESPRE...) and the rows. */
function Section({
  title,
  first = false,
  children,
}: {
  title: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View>
      {first ? null : <Hairline />}
      <View style={styles.section}>
        <AppText variant="label" accessibilityRole="header">
          {title}
        </AppText>
        {children}
      </View>
    </View>
  );
}

function Preview() {
  const { colors } = useTheme();
  const readingStyle = useTypeStyle('body', false);
  return (
    <View style={[styles.preview, { backgroundColor: colors.surface }]}>
      <AppText variant="caption">{t.settings.preview}</AppText>
      <Text maxFontSizeMultiplier={READING_MAX_FONT_SCALE} style={readingStyle}>
        {t.settings.previewText}
      </Text>
    </View>
  );
}

function ContentInfo() {
  const content = useContent();
  const works = useRepositoryQuery((repository) => repository.listWorks(), []);
  const rejected = content.status === 'ready' ? content.rejected.length : 0;
  const verified = works.status === 'ready' ? works.data.length : 0;
  return (
    <View style={styles.lines}>
      <AppText variant="caption">{t.settings.packs(verified, rejected)}</AppText>
      {works.status === 'ready' && works.data.length === 0 ? (
        <AppText variant="caption">{t.settings.noWorks}</AppText>
      ) : null}
      {works.status === 'ready'
        ? works.data.map((work) => (
            <AppText key={work.editionId} variant="caption">
              {work.titleRo}: {licenceLabel(work.licenceStatus)}
            </AppText>
          ))
        : null}
    </View>
  );
}

export function SettingsScreen() {
  const contentStyle = useListContentStyle('reading');
  return (
    <Screen>
      <Stack.Screen options={{ title: t.settings.title }} />
      <PageTitle parts={[t.settings.title]} />
      <ScrollView contentContainerStyle={[contentStyle, styles.content]}>
        <Section title={t.settings.reading} first>
          <FontSizeControl />
          <LineHeightControl />
          <Preview />
        </Section>
        <Section title={t.settings.theme}>
          <ThemeControl labelled={false} />
        </Section>
        <Section title={t.settings.content}>
          <ContentInfo />
        </Section>
        <Section title={t.settings.licenceTitle}>
          <AppText variant="caption" style={styles.prose}>
            {t.settings.licenceNote}
          </AppText>
        </Section>
        <Section title={t.settings.about}>
          <View style={styles.lines}>
            <AppText variant="caption">
              {t.appName} · {t.settings.version} {appVersion()}
            </AppText>
            <AppText variant="caption">{t.settings.fonts}</AppText>
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  section: { gap: 16, paddingTop: 20, paddingBottom: 28 },
  preview: { padding: 16, borderRadius: 6, gap: 8 },
  lines: { gap: 4 },
  prose: { maxWidth: PROSE_MAX_WIDTH },
});
