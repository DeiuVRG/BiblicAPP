import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { t } from '@/i18n';
import { searchHref, settingsHref } from '@/navigation-hrefs';

/** Search and Settings shortcuts for the library header: text links, accent colour. */
export function HeaderLinks() {
  return (
    <View style={styles.row}>
      <Link href={searchHref} asChild>
        <Button
          variant="text"
          accessibilityRole="link"
          title={t.library.search}
          style={styles.link}
        />
      </Link>
      <Link href={settingsHref} asChild>
        <Button
          variant="text"
          accessibilityRole="link"
          title={t.library.settings}
          style={styles.link}
        />
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  link: { paddingHorizontal: 10 },
});
