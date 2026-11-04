import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { t } from '@/i18n';
import { libraryHref } from '@/navigation-hrefs';
import { useTheme } from '@/theme/theme-context';

export default function NotFoundRoute() {
  const { colors } = useTheme();
  return (
    <Screen style={styles.center}>
      <Stack.Screen options={{ title: t.notFound.title }} />
      <AppText variant="title">{t.notFound.title}</AppText>
      <AppText muted>{t.notFound.message}</AppText>
      <Link href={libraryHref}>
        <AppText variant="label" style={{ color: colors.accent }}>
          {t.common.backToLibrary}
        </AppText>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
});
