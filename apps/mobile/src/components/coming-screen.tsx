import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { PageTitle } from '@/components/page-title';
import { useT } from '@/i18n';
import { libraryHref } from '@/navigation-hrefs';
import { Main, PageScroll } from '@/shell/page-scroll';
import type { NavLabel } from '@/shell/sections';

/**
 * The Coming state of a section whose screen is not built yet (docs/ui-spec-v2.md, 4.2): a centred
 * title and one sentence. The route exists so that a link never lands on "not found", but nothing
 * in the interface leads here until the feature flag of its section is switched on.
 */
export function ComingScreen({ label }: { label: NavLabel }) {
  const t = useT();
  const title = t.nav[label];
  return (
    <PageScroll>
      <PageTitle parts={[title]} />
      <Main style={styles.main}>
        <View style={styles.center}>
          <AppText variant="displayM" level={1} style={styles.text}>
            {title}
          </AppText>
          <AppText variant="lead" style={styles.text}>
            {t.coming.text}
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
  center: { alignItems: 'center', gap: 12, padding: 24, maxWidth: 560 },
  text: { textAlign: 'center' },
});
