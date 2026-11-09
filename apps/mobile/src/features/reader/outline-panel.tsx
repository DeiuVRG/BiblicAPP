import { useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { TextInputInstance } from 'react-native';

import { AppText } from '@/components/app-text';
import { CLOSE_INSET, CloseButton } from '@/components/close-button';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { SearchField } from '@/components/search-field';
import { useT } from '@/i18n';
import { useFontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';
import { radii } from '@/theme/tokens';
import { textLanguageProps } from '@/theme/web-styles';

import { OUTLINE_OVERLAY_WIDTH, OUTLINE_WIDTH } from './layout';
import type { ReaderMode } from './layout';
import { isHierarchical, outlineIndent, visibleOutline } from './outline-model';
import type { OutlineEntry } from './outline-model';

interface Props {
  mode: ReaderMode;
  entries: readonly OutlineEntry[];
  /** The section being read. */
  currentId: string;
  /** The language of the headings (the edition's). */
  language: string;
  query: string;
  onQuery(query: string): void;
  open: ReadonlySet<string>;
  onToggleBranch(sectionId: string): void;
  onOpenAll(): void;
  onCloseAll(): void;
  /** "Arată curentul": the screen opens the branches above the current entry and clears the search. */
  onShowCurrent(): void;
  onChoose(sectionId: string): void;
  /** "Ascunde cuprinsul" (a wide screen) and the close button of the drawer (a phone). */
  onHide(): void;
  /** Whether the panel is in the flow (300) or an overlay (220); a phone has a full-width drawer. */
  testID?: string;
}

/**
 * The outline panel (docs/ui-spec-v2.md, 8.3): the sections of the edition as a list, a search of the
 * headings, "Arată curentul", the count line and, for an outline with branches, "Desfășoară tot" and
 * "Pliază tot". 300 wide in the flow of a desktop, 220 as an overlay on a tablet and the full width as a
 * drawer on a phone, where the rows are 56 high and the head carries a close button.
 */
export function OutlinePanel({
  mode,
  entries,
  currentId,
  language,
  query,
  onQuery,
  open,
  onToggleBranch,
  onOpenAll,
  onCloseAll,
  onShowCurrent,
  onChoose,
  onHide,
  testID = 'outline-panel',
}: Props) {
  const t = useT();
  const { colors } = useTheme();
  const phone = mode === 'phone';
  const visible = useMemo(() => visibleOutline(entries, open, query), [entries, open, query]);
  const listRef = useRef<FlatList<OutlineEntry>>(null);
  const input = useRef<TextInputInstance>(null);
  const firstEntry = useRef<{ focus?: () => void } | null>(null);
  const hierarchical = isHierarchical(entries);
  const filtering = query.trim() !== '';
  const currentIndex = visible.findIndex((entry) => entry.section.id === currentId);

  // The current entry is in view when the panel opens, and again whenever it changes.
  useEffect(() => {
    if (currentIndex < 0) return;
    const timer = setTimeout(
      () =>
        listRef.current?.scrollToIndex({ index: currentIndex, animated: false, viewPosition: 0.3 }),
      0,
    );
    return () => clearTimeout(timer);
    // Only when the section changes or the panel is first drawn, not at every key of the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  // "Arată curentul" opens the branches above the entry first; once it is in the list, it is scrolled to.
  const pending = useRef(false);
  useEffect(() => {
    if (!pending.current || currentIndex < 0) return;
    pending.current = false;
    listRef.current?.scrollToIndex({ index: currentIndex, animated: false, viewPosition: 0.3 });
  }, [currentIndex, visible]);
  const showCurrent = () => {
    pending.current = true;
    onShowCurrent();
    // The entry may already be in the list (nothing to open): then nothing changes and it is scrolled to now.
    if (currentIndex >= 0 && !filtering) {
      pending.current = false;
      listRef.current?.scrollToIndex({ index: currentIndex, animated: false, viewPosition: 0.3 });
    }
  };

  const width = phone ? undefined : mode === 'tablet' ? OUTLINE_OVERLAY_WIDTH : OUTLINE_WIDTH;
  return (
    <View
      testID={testID}
      accessibilityRole="none"
      style={[
        styles.panel,
        width === undefined ? styles.full : { width },
        { backgroundColor: colors.cream, borderRightColor: colors.border },
      ]}
    >
      {phone ? (
        <View style={styles.head}>
          <AppText variant="heading" level={2} style={styles.headTitle}>
            {t.reader.outline.title}
          </AppText>
          <CloseButton testID="outline-close" label={t.reader.outline.close} onPress={onHide} />
        </View>
      ) : (
        <View style={styles.actions}>
          <PanelButton testID="outline-hide" label={t.reader.outline.hide} onPress={onHide} />
        </View>
      )}

      <View style={styles.tabRow}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel={t.reader.outline.tabs}
          style={[styles.tabs, { borderColor: colors.borderStrong }]}
        >
          <View
            testID="outline-tab-contents"
            accessibilityRole="tab"
            accessibilityState={{ selected: true }}
            // The only tab of P1 (the index and the library come in P2): chosen, filled `accentStrong`.
            style={[
              styles.tab,
              { backgroundColor: colors.accentStrong, minHeight: phone ? 44 : 30 },
            ]}
          >
            <AppText variant="chrome" style={{ color: colors.onAccent }}>
              {t.reader.outline.tab}
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.search}>
        <SearchField
          testID="outline-search"
          value={query}
          onChangeText={onQuery}
          placeholder={t.reader.outline.search}
          label={t.reader.outline.search}
          clearLabel={t.reader.outline.clear}
          inputRef={input}
          height={phone ? 44 : 34}
          onSubmit={() => {
            const first = visible[0];
            if (first) onChoose(first.section.id);
          }}
          onArrowDown={() => firstEntry.current?.focus?.()}
        />
      </View>

      <View style={styles.tools}>
        <PanelButton
          testID="outline-show-current"
          label={t.reader.outline.showCurrent}
          disabled={!entries.some((entry) => entry.section.id === currentId)}
          onPress={showCurrent}
        />
        {hierarchical ? (
          <>
            <PanelButton
              testID="outline-expand-all"
              label={t.reader.outline.expandAll}
              onPress={onOpenAll}
            />
            <PanelButton
              testID="outline-collapse-all"
              label={t.reader.outline.collapseAll}
              onPress={onCloseAll}
            />
          </>
        ) : null}
      </View>

      <AppText
        variant="label"
        testID="outline-count"
        accessibilityRole="none"
        role="status"
        accessibilityLiveRegion="polite"
        style={styles.count}
      >
        {filtering
          ? visible.length === 0
            ? t.reader.outline.noMatch
            : t.reader.outline.matches(visible.length)
          : t.reader.outline.entries(entries.length)}
      </AppText>
      <View style={[styles.rule, { backgroundColor: colors.border }]} />

      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(entry) => entry.section.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={30}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false,
          });
        }}
        renderItem={({ item, index }) => (
          <EntryRow
            entry={item}
            first={index === 0}
            firstRef={firstEntry}
            current={item.section.id === currentId}
            open={open.has(item.section.id)}
            flat={filtering}
            phone={phone}
            language={language}
            onToggle={() => onToggleBranch(item.section.id)}
            onChoose={() => onChoose(item.section.id)}
          />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

/** A small caps button of the panel (28 high on a wide screen, 44 on a phone). */
function PanelButton({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      style={[
        styles.panelButton,
        {
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          opacity: disabled ? 0.6 : 1,
        },
        focusStyle,
      ]}
    >
      <AppText
        variant="chrome"
        numberOfLines={1}
        style={[
          styles.panelButtonText,
          {
            fontFamily: fonts.text,
            color: hovered && !disabled ? colors.accentStrong : colors.text,
          },
        ]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

interface RowProps {
  entry: OutlineEntry;
  first: boolean;
  firstRef: { current: { focus?: () => void } | null };
  current: boolean;
  open: boolean;
  /** A search of the headings lists matches flat: no indent, no chevron. */
  flat: boolean;
  phone: boolean;
  language: string;
  onToggle(): void;
  onChoose(): void;
}

/** One entry: 14 point text (16 on a phone), the branch chevron, the current entry in 600 with a 2 point bar. */
function EntryRow({
  entry,
  first,
  firstRef,
  current,
  open,
  flat,
  phone,
  language,
  onToggle,
  onChoose,
}: RowProps) {
  const t = useT();
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const { section, depth, hasChildren } = entry;
  return (
    <View style={styles.entryRow}>
      {hasChildren && !flat ? (
        <Pressable
          testID={`outline-branch-${section.id}`}
          accessibilityRole="button"
          accessibilityLabel={
            open
              ? t.reader.outline.collapseBranch(section.heading)
              : t.reader.outline.expandBranch(section.heading)
          }
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={onToggle}
          style={[styles.chevron, { marginLeft: outlineIndent(depth) - 4 }]}
        >
          <AppText
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ color: colors.textMuted, fontSize: 16 }}
          >
            {open ? '⌄' : '›'}
          </AppText>
        </Pressable>
      ) : null}
      <Pressable
        ref={
          first
            ? (node) => void (firstRef.current = node as { focus?: () => void } | null)
            : undefined
        }
        testID={`outline-entry-${section.id}`}
        accessibilityRole="link"
        accessibilityLabel={t.reader.outline.entry(section.heading)}
        accessibilityState={{ selected: current }}
        // The reading position is "the current location" of the list (web only: not a React Native prop).
        {...(current ? ({ 'aria-current': 'location' } as object) : null)}
        onPress={onChoose}
        {...hoverProps}
        {...focusProps}
        style={[
          styles.entry,
          {
            paddingLeft: hasChildren && !flat ? 4 : flat ? 8 : outlineIndent(depth),
            minHeight: phone ? 56 : undefined,
            borderRadius: radii.md - 1,
          },
          focusStyle,
        ]}
      >
        {current ? <View style={[styles.bar, { backgroundColor: colors.accentStrong }]} /> : null}
        <AppText
          {...textLanguageProps(language)}
          style={{
            fontFamily: current ? fonts.textSemiBold : fonts.text,
            fontSize: phone ? 16 : 14,
            lineHeight: phone ? 22 : 20,
            color: current ? colors.text : hovered ? colors.accentStrong : colors.text,
          }}
        >
          {section.heading}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRightWidth: 1, paddingTop: 12 },
  full: { flex: 1, width: '100%', borderRightWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: CLOSE_INSET },
  headTitle: { flex: 1 },
  actions: { paddingHorizontal: 16, paddingBottom: 8 },
  tabRow: { paddingHorizontal: 16, paddingTop: 4 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: radii.sm, overflow: 'hidden' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  search: { paddingHorizontal: 16, paddingTop: 10 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  panelButton: {
    flexGrow: 1,
    minHeight: 28,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelButtonText: { fontSize: 11, letterSpacing: 0.84, textTransform: 'uppercase' },
  count: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, letterSpacing: 1.47 },
  rule: { height: 1, marginHorizontal: 16 },
  list: { flex: 1 },
  listContent: { paddingVertical: 8, paddingHorizontal: 8 },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start' },
  chevron: { width: 28, height: 30, alignItems: 'center', justifyContent: 'center' },
  entry: { flex: 1, paddingRight: 8, paddingVertical: 5, justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2 },
});
