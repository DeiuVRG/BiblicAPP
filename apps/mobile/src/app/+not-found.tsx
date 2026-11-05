import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PageTitle } from '@/components/page-title';
import { useT } from '@/i18n';
import { libraryHref } from '@/navigation-hrefs';
import { Main, PageScroll } from '@/shell/page-scroll';

export default function NotFoundRoute() {
  const t = useT();
  return (
    <PageScroll>
      <PageTitle parts={[t.notFound.title]} />
      <Main style={styles.main}>
        <View style={styles.center}>
          <AppText variant="title" level={1} style={styles.text}>
            {t.notFound.title}
          </AppText>
          <AppText variant="lead" style={styles.text}>
            {t.notFound.message}
          </AppText>
          <Link href={libraryHref} asChild>
            <Button variant="text" accessibilityRole="link" title={t.common.backToLibrary} />
          </Link>
        </View>
      </Main>
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  main: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 12, padding: 24 },
  text: { textAlign: 'center' },
});
