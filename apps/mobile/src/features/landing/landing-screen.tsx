import { Link } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';

import { AppText, useTypeStyle } from '@/components/app-text';
import { Band } from '@/components/band';
import { Button } from '@/components/button';
import { useFocusRing } from '@/components/focus-ring';
import { Hero } from '@/components/hero';
import { PageTitle } from '@/components/page-title';
import { ResponsiveGrid } from '@/components/responsive-grid';
import { mailtoHref } from '@/config/contact';
import { useFeatures } from '@/config/features';
import { ShelfCard } from '@/features/library/shelf-card';
import { WorkCard } from '@/features/library/work-card';
import { useT } from '@/i18n';
import { useLibrary } from '@/library/use-library';
import { futureHref, libraryAllHref, libraryHref } from '@/navigation-hrefs';
import { useSettings } from '@/settings/settings-context';
import { Footer } from '@/shell/footer';
import { Main, PageScroll } from '@/shell/page-scroll';
import { useLayout } from '@/theme/layout';
import { useTheme } from '@/theme/theme-context';

/** The collection shows at most this many works (docs/ui-spec-v2.md, 5, band 6). */
const COLLECTION_MAX = 12;

/** Columns of the work cards: four wide, two below 1100, one below 600 (5, band 6). */
export function collectionColumns(width: number): number {
  return width >= 1100 ? 4 : width >= 600 ? 2 : 1;
}

/** Columns of the shelf cards: five wide, one per row on a phone (5, band 8). */
export function shelfColumns(width: number): number {
  return width >= 1100 ? 5 : width >= 900 ? 4 : width >= 700 ? 3 : width >= 560 ? 2 : 1;
}

/** A door of band 2: the name of a section, a sentence and a "NAME ›" link line. */
function Door({
  testID,
  title,
  text,
  link,
  href,
  separated,
  wide,
}: {
  testID: string;
  title: string;
  text: string;
  link: string;
  href: ComponentProps<typeof Link>['href'];
  separated: boolean;
  wide: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Link href={href} asChild>
      <DoorBox
        testID={testID}
        accessibilityLabel={`${title}. ${text}`}
        style={{
          borderColor: colors.border,
          // The first door lines up with the rest of the page; the others are set off by a rule.
          ...(separated
            ? wide
              ? { borderLeftWidth: 1, paddingLeft: 24 }
              : { borderTopWidth: 1 }
            : { paddingLeft: 0 }),
        }}
      >
        <AppText variant="displayS" level={3}>
          {title}
        </AppText>
        <AppText variant="meta">{text}</AppText>
        {/* The link line of the door is text: the whole door is the link. */}
        <AppText variant="railDrawer" tone="accent" style={styles.doorLink}>
          {`${link} ›`}
        </AppText>
      </DoorBox>
    </Link>
  );
}

// Link's `asChild` slot adds props (href, onPress, role) to its child and merges `style` as a plain
// object: the door is a plain pressable that merges it.
function DoorBox({
  style,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { style?: ViewStyle; children: ReactNode }) {
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      {...focusProps}
      {...rest}
      style={[styles.door, focusStyle, style]}
    >
      {children}
    </Pressable>
  );
}

export function LandingScreen() {
  const t = useT();
  const features = useFeatures();
  const library = useLibrary();
  const { settings } = useSettings();
  const layout = useLayout();
  const { width } = useWindowDimensions();
  const betaKicker = useTypeStyle('kicker');
  const language = settings.readingLanguage;
  const model = library.status === 'ready' ? library.data.model : null;
  const doorWide = layout.width >= 641;

  const doors = [
    {
      key: 'read',
      testID: 'door-read',
      title: t.landing.doorRead.title,
      text: t.landing.doorRead.text,
      link: t.landing.doorRead.link,
      href: libraryHref,
    },
    ...(features.ask
      ? [
          {
            key: 'ask',
            testID: 'door-ask',
            title: t.landing.doorAsk.title,
            text: t.landing.doorAsk.text,
            link: t.landing.doorAsk.link,
            href: futureHref('/ask'),
          },
        ]
      : []),
  ];

  return (
    <PageScroll>
      <PageTitle parts={[]} />
      <Main>
        <Hero
          kind="landing"
          kicker={t.landing.kicker}
          badge={t.landing.badge}
          title={[t.landing.titleFirst, t.landing.titleSecond]}
          sub={t.landing.sub}
          actions={
            <>
              <Link href={libraryHref} asChild>
                <Button
                  testID="hero-cta-primary"
                  variant="primary"
                  title={t.landing.start}
                  accessibilityRole="link"
                />
              </Link>
              {features.ask ? (
                <Link href={futureHref('/ask')} asChild>
                  <Button
                    testID="hero-cta-secondary"
                    variant="outline"
                    title={t.landing.askCta}
                    accessibilityRole="link"
                  />
                </Link>
              ) : null}
            </>
          }
          links={
            features.about || features.tour ? (
              <>
                {features.about ? (
                  <Link href={futureHref('/about')} asChild>
                    <Button
                      testID="hero-link-about"
                      variant="text"
                      arrow
                      title={t.landing.about}
                      accessibilityRole="link"
                    />
                  </Link>
                ) : null}
                {features.tour ? (
                  <Link href={futureHref('/about/tour')} asChild>
                    <Button
                      testID="hero-link-tour"
                      variant="text"
                      arrow
                      title={t.landing.tour}
                      accessibilityRole="link"
                    />
                  </Link>
                ) : null}
              </>
            ) : undefined
          }
        />

        <Band tone="background" testID="doors">
          <View style={styles.doors}>
            {doors.map((door, index) => (
              <View key={door.key} style={styles.doorCell}>
                <Door
                  testID={door.testID}
                  title={door.title}
                  text={door.text}
                  link={door.link}
                  href={door.href}
                  separated={index > 0}
                  wide={doorWide}
                />
              </View>
            ))}
          </View>
        </Band>

        <Band tone="background" topRule testID="free-statement">
          <AppText variant="body" style={styles.statement}>
            {features.ask ? `${t.landing.freeBooks} ${t.landing.freeAsk}` : t.landing.freeBooks}
          </AppText>
        </Band>

        {model && model.works.length > 0 ? (
          <Band tone="background" topRule testID="collection">
            <View style={styles.bandHead}>
              <AppText variant="displayM" level={2}>
                {t.landing.collectionTitle}
              </AppText>
            </View>
            <ResponsiveGrid columns={collectionColumns(width)} gap={14} testID="collection-grid">
              {model.works.slice(0, COLLECTION_MAX).map((work) => (
                <WorkCard key={work.workId} work={work} model={model} language={language} />
              ))}
            </ResponsiveGrid>
            <View style={[styles.bandFoot, styles.textFoot]}>
              <Link href={libraryAllHref} asChild>
                <Button
                  testID="collection-all"
                  variant="text"
                  arrow
                  title={t.landing.collectionAll}
                  accessibilityRole="link"
                />
              </Link>
            </View>
          </Band>
        ) : null}

        {model && model.shelves.length > 0 ? (
          <Band tone="background" topRule testID="shelves">
            <View style={styles.bandHead}>
              <AppText variant="displayM" level={2}>
                {t.landing.shelvesTitle}
              </AppText>
            </View>
            <ResponsiveGrid columns={shelfColumns(width)} gap={24} testID="shelves-grid">
              {model.shelves.map((shelf) => (
                <ShelfCard key={shelf.slug} shelf={shelf} language={language} />
              ))}
            </ResponsiveGrid>
            <View style={styles.bandFoot}>
              <Link href={libraryAllHref} asChild>
                <Button
                  testID="shelves-all"
                  variant="primary"
                  title={t.landing.shelvesAll}
                  accessibilityRole="link"
                />
              </Link>
            </View>
          </Band>
        ) : null}

        <Band tone="cream" testID="beta-band" padding={{ top: 56, bottom: 56 }}>
          <View style={styles.beta}>
            <AppText
              variant="kicker"
              style={[betaKicker, styles.betaKicker]}
              accessibilityRole="header"
            >
              {t.landing.betaKicker}
            </AppText>
            <AppText variant="lead" style={styles.betaText}>
              {t.landing.betaText}
            </AppText>
            <Link href={futureHref(mailtoHref(t.landing.feedbackSubject))} asChild>
              <Button
                testID="beta-feedback"
                variant="outline"
                title={t.landing.feedback}
                accessibilityRole="link"
              />
            </Link>
          </View>
        </Band>

        {features.transparency ? (
          <Band tone="background" container="narrow" topRule testID="transparency-band">
            <View style={styles.transparency}>
              <AppText variant="displayM" level={2}>
                {t.landing.transparencyTitle}
              </AppText>
              <AppText variant="body">{t.landing.transparencyText}</AppText>
              <Link href={futureHref('/about/transparency')} asChild>
                <Button
                  testID="transparency-cta"
                  variant="primary"
                  title={t.landing.transparencyCta}
                  accessibilityRole="link"
                />
              </Link>
            </View>
          </Band>
        ) : null}
      </Main>
      <Footer />
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  // Two doors share the width (`auto-fit, minmax(240px, 1fr)`); on a phone they stack.
  doors: { flexDirection: 'row', flexWrap: 'wrap' },
  doorCell: { flexGrow: 1, flexBasis: 240, minWidth: 0 },
  door: { paddingVertical: 24, paddingRight: 24, gap: 8, alignItems: 'flex-start' },
  doorLink: { marginTop: 4 },
  statement: { maxWidth: 720 },
  bandHead: { marginBottom: 32 },
  bandFoot: { marginTop: 32, flexDirection: 'row' },
  // A text button carries 16 points of padding: pulled back so its text meets the edge.
  textFoot: { marginLeft: -16 },
  beta: { gap: 16, alignItems: 'flex-start' },
  betaKicker: { fontSize: 17, lineHeight: 22, letterSpacing: 5 },
  betaText: { maxWidth: 680 },
  transparency: { gap: 16, alignItems: 'flex-start' },
});
