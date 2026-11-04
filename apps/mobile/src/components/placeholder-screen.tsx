import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';

interface Props {
  title: string;
  description?: string;
  children?: ReactNode;
}

/** Temporary screen body used while the real screens are built by the UI work. */
export function PlaceholderScreen({ title, description, children }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View accessible accessibilityRole="header">
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{description ?? t.placeholder}</Text>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
});
