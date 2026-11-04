import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { t } from '@/i18n';

export default function LibraryScreen() {
  return (
    <PlaceholderScreen title={t.library.title}>
      <View style={styles.links}>
        <Link href="/search">{t.library.search}</Link>
        <Link href="/settings">{t.library.settings}</Link>
      </View>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  links: { gap: 8 },
});
