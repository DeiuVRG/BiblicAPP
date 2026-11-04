import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { t } from '@/i18n';
import { libraryHref } from '@/navigation-hrefs';

export default function NotFoundRoute() {
  return (
    <Screen style={styles.center}>
      {/* The page says what happened; the header only says where we are (not the same words twice). */}
      <Stack.Screen options={{ title: t.notFound.title, headerTitle: t.library.title }} />
      <PageTitle parts={[t.notFound.title]} />
      <AppText variant="title" style={styles.text}>
        {t.notFound.title}
      </AppText>
      <AppText variant="lead" style={styles.text}>
        {t.notFound.message}
      </AppText>
      <Link href={libraryHref} asChild>
        <Button variant="text" accessibilityRole="link" title={t.common.backToLibrary} />
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  text: { textAlign: 'center' },
});
