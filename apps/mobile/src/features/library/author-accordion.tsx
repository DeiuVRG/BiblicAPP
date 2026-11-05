import { Link } from 'expo-router';
import { useId } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, useTypeStyle } from '@/components/app-text';
import { Button } from '@/components/button';
import { Hairline } from '@/components/hairline';
import { useFocusRing } from '@/components/focus-ring';
import { HighlightedText } from '@/components/highlighted-text';
import { useHover } from '@/components/hover';
import { Icon } from '@/components/icon';
import { useFeatures } from '@/config/features';
import { useT } from '@/i18n';
import { formatYear } from '@/i18n/labels';
import type { ReadingLanguage } from '@/i18n/language';
import { groupName } from '@/library/model';
import type { GroupResult, LibraryModel } from '@/library/model';
import { authorHref } from '@/navigation-hrefs';
import { useTheme } from '@/theme/theme-context';

import { LibraryRow } from './library-row';

interface Props {
  result: GroupResult;
  model: LibraryModel;
  language: ReadingLanguage;
  open: boolean;
  onToggle(): void;
  /** The words to mark in the names and titles (the name search). */
  query: string;
}

/**
 * An author, or an issuing body, of the list (docs/ui-spec-v2.md, 6.2): an accordion with a chevron,
 * the name in 13 point 600 capitals in `accentStrong` and "N lucrări" at the right. An issuing body
 * carries its year after its name ("CONCILIUL DIN CALCEDON · 451", 6.3). Opened, it shows the link
 * "DESPRE <NUME> ›" (when the author page is live) and one row per work.
 */
export function AuthorAccordion({ result, model, language, open, onToggle, query }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const features = useFeatures();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const bodyId = useId();
  const nameStyle = useTypeStyle('button');
  const { group, works } = result;
  const name = groupName(group, language);
  // A body is told by its name and the year it issued its documents.
  const year = group.kind === 'body' ? formatYear(group.year, t) : '';
  const heading = year === '' ? name : `${name} · ${year}`;
  const testID =
    group.kind === 'body'
      ? `issuing-body-${group.slug}`
      : `author-accordion-${group.slug ?? group.key}`;
  return (
    <View testID={testID}>
      <Pressable
        testID={`${testID}-toggle`}
        accessibilityRole="button"
        accessibilityLabel={t.library.authorWorks(heading, works.length)}
        accessibilityState={{ expanded: open }}
        // react-native-web reads the `aria-*` props only; React Native reads both forms.
        aria-expanded={open}
        aria-controls={bodyId}
        onPress={onToggle}
        {...hoverProps}
        {...focusProps}
        style={[styles.header, focusStyle]}
      >
        <Icon
          name={open ? 'chevronDown' : 'chevronRight'}
          size={16}
          color={hovered ? colors.accentStrong : colors.textMuted}
        />
        <View style={styles.name}>
          <HighlightedText
            text={heading}
            query={query}
            style={[nameStyle, { color: colors.accentStrong, letterSpacing: 1 }]}
          />
        </View>
        <AppText variant="meta">{t.counts.works(works.length)}</AppText>
      </Pressable>
      {open ? (
        <View nativeID={bodyId} style={styles.body}>
          {features.authorPages && group.kind === 'author' && group.slug ? (
            <Link href={authorHref(group.slug)} asChild>
              <Button
                variant="text"
                arrow
                title={t.library.aboutAuthor(name)}
                accessibilityRole="link"
                style={styles.about}
              />
            </Link>
          ) : null}
          {works.map((work, index) => (
            <View key={work.workId}>
              {index > 0 ? <Hairline /> : null}
              <LibraryRow work={work} model={model} language={language} query={query} />
            </View>
          ))}
        </View>
      ) : null}
      <Hairline />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    paddingVertical: 8,
  },
  name: { flex: 1, minWidth: 0 },
  body: { paddingLeft: 28, paddingBottom: 8 },
  about: { alignSelf: 'flex-start', marginLeft: -16 },
});
