import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { TypographyControls } from '@/components/typography-controls';
import { useContent } from '@/content/content-context';
import { useRepositoryQuery } from '@/hooks/use-repository-query';
import { t } from '@/i18n';
import { licenceLabel } from '@/i18n/labels';
import { useSettings } from '@/settings/settings-context';
import { useFontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';

import { READING_MAX_FONT_SCALE } from '../reader/reader-paragraph';

export function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}

function Preview() {
  const { settings } = useSettings();
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  return (
    <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="caption" muted>
        {t.settings.preview}
      </AppText>
      <Text
        maxFontSizeMultiplier={READING_MAX_FONT_SCALE}
        style={{
          color: colors.text,
          fontFamily: fonts.reading,
          fontSize: settings.fontSize,
          lineHeight: Math.round(settings.fontSize * settings.lineHeight),
          textAlign: 'left',
        }}
      >
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
    <>
      <AppText>{t.settings.packs(verified, rejected)}</AppText>
      {works.status === 'ready' && works.data.length === 0 ? (
        <AppText muted>{t.settings.noWorks}</AppText>
      ) : null}
      {works.status === 'ready'
        ? works.data.map((work) => (
            <AppText key={work.editionId} variant="caption" muted>
              {work.titleRo}: {licenceLabel(work.licenceStatus)}
            </AppText>
          ))
        : null}
    </>
  );
}

export function SettingsScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: t.settings.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t.settings.reading}>
          <TypographyControls />
          <Preview />
        </Section>
        <Section title={t.settings.content}>
          <ContentInfo />
        </Section>
        <Section title={t.settings.licenceTitle}>
          <AppText muted>{t.settings.licenceNote}</AppText>
        </Section>
        <Section title={t.settings.about}>
          <AppText>
            {t.appName} · {t.settings.version} {appVersion()}
          </AppText>
          <AppText variant="caption" muted>
            {t.settings.fonts}
          </AppText>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 8,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  section: { gap: 12, paddingTop: 16, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
  preview: { padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
});
