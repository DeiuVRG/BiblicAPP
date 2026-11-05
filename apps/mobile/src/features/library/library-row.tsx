import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';
import type { ElementRef, Ref } from 'react';

import { AppText, useTypeStyle } from '@/components/app-text';
import { MIN_TARGET } from '@/components/button';
import { Chip } from '@/components/chip';
import { useFocusRing } from '@/components/focus-ring';
import { HighlightedText } from '@/components/highlighted-text';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { originalTitleToShow } from '@/content/titles';
import { useT } from '@/i18n';
import type { ReadingLanguage } from '@/i18n/language';
import type { LibraryModel, LibraryWork } from '@/library/model';
import {
  editionBadges,
  fullMeta,
  shelfLabelOf,
  shortMeta,
  titleOf,
  workAccessibleName,
} from '@/library/labels';
import { workHref } from '@/navigation-hrefs';
import { useLayout } from '@/theme/layout';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';

/** How far a row's hover background reaches past the text, into the gutter. */
const BLEED = 12;

interface Props {
  work: LibraryWork;
  model: LibraryModel;
  language: ReadingLanguage;
  /**
   * `row`: the library list (full meta line, badges). `display`: the curated bands, with 28 point
   * titles, group and date, no badges. `compact`: the same with the title of a row.
   */
  variant?: 'row' | 'display' | 'compact';
  /** The words to mark in the title and the name (the name search). */
  query?: string;
  /** Gives the row to a screen that moves the focus into its list (Search, with the arrow Down). */
  focusRef?: Ref<ElementRef<typeof View>>;
}

/**
 * A work in a list (docs/ui-spec-v2.md, 3 and 6.2): the title in the reading language, the original
 * title in italic when it differs, a small-caps line (who, when, in what language), and on the right
 * the badges of its editions ("RO", "EN", "LA", "PARȚIAL") with, under them on a wide screen, its
 * shelf. On a phone there is no room at the right: the badges sit under the small-caps line. The
 * whole row is the link to the work. No licence anywhere in it. On hover the title is `accentStrong`.
 */
export function LibraryRow({
  work,
  model,
  language,
  variant = 'row',
  query = '',
  focusRef,
}: Props) {
  const t = useT();
  const { wide } = useLayout();
  const title = titleOf(work, language);
  const original = originalTitleToShow(work.summary, title);
  const display = variant === 'display';
  const listed = variant === 'row';
  const meta = listed ? fullMeta(model, work, language, t) : shortMeta(model, work, language, t);
  const badges = editionBadges(work.summary.editions, t);
  const shelf = work.shelves[0] ? shelfLabelOf(model, work.shelves[0], language) : '';
  return (
    <Link href={workHref(work.workId)} asChild>
      <RowPressable
        ref={focusRef}
        testID={`library-row-${work.slug}`}
        accessibilityLabel={workAccessibleName(title, meta, badges, t)}
        title={title}
        query={query}
        display={display}
        side={
          listed && wide ? (
            <View testID={`row-side-${work.slug}`} style={styles.side}>
              <EditionBadges badges={badges} end />
              {shelf ? (
                <AppText variant="caption" numberOfLines={1} style={styles.shelf}>
                  {shelf}
                </AppText>
              ) : null}
            </View>
          ) : null
        }
      >
        {original ? (
          <AppText variant="original" numberOfLines={2}>
            {original}
          </AppText>
        ) : null}
        <MetaLine text={meta} query={query} />
        {listed && !wide ? <EditionBadges badges={badges} /> : null}
      </RowPressable>
    </Link>
  );
}

/** The editions of a work as chips: "RO", "EN", "LA", and "PARȚIAL" after the one that is partial. */
export function EditionBadges({
  badges,
  end = false,
}: {
  badges: ReturnType<typeof editionBadges>;
  /** Right-aligned (the right column of a wide row). */
  end?: boolean;
}) {
  const t = useT();
  return (
    <View testID="row-badges" style={[styles.badges, end ? styles.badgesEnd : styles.badgesStart]}>
      {badges.map((badge) => (
        <View key={badge.key} style={styles.badgeRow}>
          <Chip label={badge.code} accessibilityLabel={badge.label} />
          {badge.partial ? (
            <Chip label={t.library.partialChip} accessibilityLabel={t.work.partial} shape="tag" />
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** The small-caps meta line, with the words of the search marked. */
function MetaLine({ text, query }: { text: string; query: string }) {
  const style = useTypeStyle('label');
  return <HighlightedText text={text} query={query} style={[style, styles.meta]} />;
}

type RowPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  /** React 19 hands a ref to a function component as a prop; it goes on to the pressable. */
  ref?: Ref<ElementRef<typeof View>>;
  title: string;
  query: string;
  display: boolean;
  side: React.ReactNode;
  children: React.ReactNode;
  /** Whatever style Link's slot merged in (a plain object). */
  style?: ViewStyle;
};

// Link's `asChild` slot adds props (href, onPress, role) to its child, so the hover and pressed
// states live inside this wrapper rather than in a style callback handed to Link.
function RowPressable({
  title,
  query,
  display,
  side,
  children,
  style,
  ...rest
}: RowPressableProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const titleStyle = useTypeStyle(display ? 'displayS' : 'title');
  return (
    <Pressable
      accessibilityRole="link"
      {...hoverProps}
      {...focusProps}
      {...rest}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: hovered ? colors.surface : undefined },
        pressStyle(pressed, reduced),
        focusStyle,
        style,
      ]}
    >
      <View style={styles.text}>
        {/* The title is the name of the row; the heading is not announced for each row. */}
        <HighlightedText
          text={title}
          query={query}
          style={[
            titleStyle,
            hovered ? { color: colors.accentStrong, textDecorationLine: 'underline' } : null,
          ]}
        />
        {children}
      </View>
      {side}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TARGET,
    marginHorizontal: -BLEED,
    paddingVertical: 16,
    paddingHorizontal: BLEED,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 24,
  },
  text: { flex: 1, gap: 2, minWidth: 0 },
  meta: { marginTop: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  badgesStart: { marginTop: 8 },
  badgesEnd: { justifyContent: 'flex-end' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The right column: the badges level with the title, the shelf under them.
  side: { alignItems: 'flex-end', flexShrink: 0, maxWidth: 200, rowGap: 6, paddingTop: 2 },
  shelf: { textAlign: 'right' },
});
