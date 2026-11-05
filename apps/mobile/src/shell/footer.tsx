import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Band } from '@/components/band';
import { Button } from '@/components/button';
import { mailtoHref } from '@/config/contact';
import { useFeatures } from '@/config/features';
import { getAppVersion } from '@/content/app-version';
import { useT } from '@/i18n';
import { futureHref, settingsHref } from '@/navigation-hrefs';
import type { AppHref } from '@/navigation-hrefs';

import { LanguageSwitch } from './language-switch';

/**
 * The footer (band 13 of the landing, and the end of About): the links that exist (About and
 * Transparency when their screens are live, Contact as a mail link, Settings), the interface
 * language and the version (docs/ui-spec-v2.md, 5; Terms and Privacy join in P4).
 */
export function Footer() {
  const t = useT();
  const features = useFeatures();
  const links: { key: string; label: string; href: AppHref }[] = [];
  if (features.about) links.push({ key: 'about', label: t.nav.about, href: futureHref('/about') });
  if (features.transparency) {
    links.push({
      key: 'transparency',
      label: t.nav.transparency,
      href: futureHref('/about/transparency'),
    });
  }
  links.push({
    key: 'contact',
    label: t.landing.contact,
    href: futureHref(mailtoHref(t.landing.feedbackSubject)),
  });
  links.push({ key: 'settings', label: t.nav.settings, href: settingsHref });

  return (
    <Band tone="background" topRule padding={{ top: 40, bottom: 48 }} testID="footer">
      <View style={styles.row}>
        <View
          accessibilityRole="list"
          accessibilityLabel={t.landing.footerLinks}
          style={styles.links}
        >
          {links.map((link) => (
            <Link key={link.key} href={link.href} asChild>
              <Button
                testID={`footer-link-${link.key}`}
                variant="text"
                title={link.label}
                accessibilityRole="link"
              />
            </Link>
          ))}
        </View>
        <View style={styles.meta}>
          <LanguageSwitch testID="footer-language-switch" />
          <AppText variant="caption" testID="footer-version">
            {t.landing.version(getAppVersion() ?? '0.0.0')}
          </AppText>
        </View>
      </View>
    </Band>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    rowGap: 16,
    columnGap: 24,
  },
  // The text buttons carry 16 points of padding: pulled back so the first link meets the edge.
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginLeft: -16 },
  meta: { flexDirection: 'row', alignItems: 'center', columnGap: 16 },
});
