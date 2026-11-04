import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { t } from '@/i18n';
import { searchHref, settingsHref } from '@/navigation-hrefs';
import { useTheme } from '@/theme/theme-context';

/** Search and Settings shortcuts for the library header. */
export function HeaderLinks() {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Link href={searchHref} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t.library.search}
          style={styles.link}
        >
          <AppText variant="label" style={{ color: colors.accent }}>
            {t.library.search}
          </AppText>
        </Pressable>
      </Link>
      <Link href={settingsHref} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t.library.settings}
          style={styles.link}
        >
          <AppText variant="label" style={{ color: colors.accent }}>
            {t.library.settings}
          </AppText>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  link: { minHeight: MIN_TARGET, paddingHorizontal: 10, justifyContent: 'center' },
});
