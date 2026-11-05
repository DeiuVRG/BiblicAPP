import { Link, usePathname } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ElementRef, ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type {
  KeyDownEvent,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ViewStyle,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { EdgeFade } from '@/components/edge-fade';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { useEscapeKey } from '@/components/modal-behaviour';
import { pressStyle } from '@/components/press';
import { useFeatures } from '@/config/features';
import { useT } from '@/i18n';
import { PHONE_MAX, useLayout } from '@/theme/layout';
import { useFontFamilies } from '@/theme/fonts';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { BAR_HEIGHT, FOCUS_RING_ROOM, easing, elevationStyle, motion } from '@/theme/tokens';

import { entryTestId, liveSections } from './sections';
import type { LiveSection, SectionEntry, SectionKey } from './sections';
import { useShell } from './shell-state';

// The section bar, the "rail" of the reference (docs/ui-spec-v2.md, 4.2 and 4.3): sticky under the
// brand bar on every platform, small caps in `textMuted`, a drawer on "Citește", "Cercetare" and
// "Despre". On a wide screen a drawer opens along the bar; on a phone it drops as a panel under it.

/** What an item needs of its element: to be given the focus (an arrow key, the way back from Esc). */
interface FocusHandle {
  focus?: () => void;
}

/** Height of a drawer entry on a wide screen (12 point caps, in the 48 point bar). */
const ENTRY_HEIGHT = 42;
/** The phone panel: one row per entry. */
const PANEL_ROW = 48;
const DRAWER_GAP = 18;

function useBarMetrics() {
  const { width } = useLayout();
  const phone = width <= PHONE_MAX;
  return { phone, height: phone ? BAR_HEIGHT.sectionPhone : BAR_HEIGHT.section };
}

interface BarLinkProps {
  href: LiveSection['href'];
  path: string;
  testID: string;
  label: string;
  /** The text of the link, as drawn (a node: the brand item has two styles). */
  children: (color: string, hovered: boolean) => ReactNode;
  current: boolean;
  /** Where the item stands in the bar (an entry of a drawer is smaller and sits in a drawer). */
  height: number;
  paddingHorizontal: number;
  itemRef?(node: FocusHandle | null): void;
  onKey?(key: string): boolean;
  /** Called after the link was followed (the drawer closes). */
  onNavigate?(): void;
}

/** A link of the bar or of a drawer: hover, pressed and current states, a full-height hit area. */
function BarLink({
  href,
  path,
  testID,
  label,
  children,
  current,
  height,
  paddingHorizontal,
  itemRef,
  onKey,
  onNavigate,
}: BarLinkProps) {
  // `onPress` is not given to `Link`: with a `Pressable` child on web it would replace the
  // handler that follows the link. The child composes its own side effect instead.
  return (
    <Link href={href as never} asChild>
      <LinkPressable
        testID={testID}
        label={label}
        current={current}
        height={height}
        paddingHorizontal={paddingHorizontal}
        itemRef={itemRef}
        onKey={onKey}
        onNavigate={onNavigate}
        dataPath={path}
      >
        {children}
      </LinkPressable>
    </Link>
  );
}

type LinkPressableProps = {
  testID: string;
  label: string;
  children: (color: string, hovered: boolean) => ReactNode;
  current: boolean;
  height: number;
  paddingHorizontal: number;
  itemRef?(node: FocusHandle | null): void;
  onKey?(key: string): boolean;
  onNavigate?(): void;
  dataPath: string;
  /** What Link's slot merged in (a plain object), with the props it adds (`href`, `onPress`, `role`). */
  style?: ViewStyle;
} & Record<string, unknown>;

// Link's `asChild` slot adds props (href, onPress, role) to its child and merges `style` as plain
// objects, so the hover and pressed states live inside this wrapper (as in `LinkRow`).
function LinkPressable({
  testID,
  label,
  children,
  current,
  height,
  paddingHorizontal,
  itemRef,
  onKey,
  onNavigate,
  dataPath: _dataPath,
  style,
  ...rest
}: LinkPressableProps) {
  // The handler that follows the link comes from `Link`; this one runs it, then the side effect.
  const { onPress: follow, ...others } = rest as { onPress?: (event: unknown) => void };
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const color = hovered ? colors.accentStrong : current ? colors.text : colors.textMuted;
  return (
    <Pressable
      ref={itemRef}
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected: current }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-current={current ? 'page' : undefined}
      onKeyDown={
        onKey
          ? (event: KeyDownEvent) => {
              if (onKey(event.nativeEvent.key)) event.preventDefault();
            }
          : undefined
      }
      {...hoverProps}
      {...focusProps}
      {...(others as object)}
      onPress={(event: unknown) => {
        follow?.(event);
        onNavigate?.();
      }}
      style={({ pressed }) => [
        styles.link,
        { minHeight: height, paddingHorizontal },
        pressStyle(pressed, reduced),
        focusStyle,
        style,
      ]}
    >
      {children(color, hovered)}
    </Pressable>
  );
}

/** The text of a bar item: small caps, the colour of its state. */
function RailText({ children, color }: { children: string; color: string }) {
  return (
    <AppText variant="rail" numberOfLines={1} style={{ color }}>
      {children}
    </AppText>
  );
}

/** "BIBLIOTECA | ACASĂ": the brand item, "BIBLIOTECA" in 600 `text` and the rest in 400 `textMuted`. */
function BrandItemText({ current, hovered }: { current: boolean; hovered?: boolean }) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={styles.brand}>
      <AppText
        variant="railBrand"
        numberOfLines={1}
        style={{ color: hovered ? colors.accentStrong : colors.text }}
      >
        {t.appName}
      </AppText>
      <AppText
        variant="rail"
        numberOfLines={1}
        style={{ color: current && !hovered ? colors.text : colors.textMuted }}
      >
        {`| ${t.nav.home}`}
      </AppText>
    </View>
  );
}

interface ToggleProps {
  section: LiveSection;
  open: boolean;
  current: boolean;
  height: number;
  paddingHorizontal: number;
  controls: string;
  itemRef(node: FocusHandle | null): void;
  onToggle(): void;
  onKey(key: string): boolean;
}

/** The item of a drawer: "CITEȘTE ›", and "CITEȘTE ‹" while the drawer is open. */
function DrawerToggle({
  section,
  open,
  current,
  height,
  paddingHorizontal,
  controls,
  itemRef,
  onToggle,
  onKey,
}: ToggleProps) {
  const t = useT();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const fonts = useFontFamilies();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const label = t.nav[section.label];
  const color = open || hovered ? colors.accentStrong : current ? colors.text : colors.textMuted;
  return (
    <Pressable
      ref={itemRef}
      testID={`section-item-${section.key}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open, selected: current }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-expanded={open}
      aria-controls={controls}
      aria-current={current ? 'true' : undefined}
      onPress={onToggle}
      onKeyDown={(event: KeyDownEvent) => {
        if (onKey(event.nativeEvent.key)) event.preventDefault();
      }}
      {...hoverProps}
      {...focusProps}
      style={({ pressed }) => [
        styles.link,
        { minHeight: height, paddingHorizontal },
        pressStyle(pressed, reduced),
        focusStyle,
      ]}
    >
      <View style={styles.toggleRow}>
        <AppText variant="rail" numberOfLines={1} style={{ color }}>
          {label}
        </AppText>
        <AppText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID={`section-caret-${section.key}`}
          style={[styles.caret, { fontFamily: fonts.text, color }]}
        >
          {open ? '‹' : '›'}
        </AppText>
      </View>
    </Pressable>
  );
}

/**
 * The strip of entries that a drawer opens along the bar (wide screens): hidden until its first
 * use, then its width runs from 0 to its content width over 300 ms on the drawer curve; under
 * reduced motion it is simply there. It stays mounted until its closing animation has ended.
 */
function DrawerStrip({
  id,
  testID,
  open,
  children,
}: {
  id: string;
  testID: string;
  open: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const [natural, setNatural] = useState(0);
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0));
  // Opening mounts the strip at once (adjusting state while rendering); closing unmounts it when
  // the animation has ended, or at once under reduced motion.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (reduced) {
      progress.setValue(open ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: motion.drawer,
      easing: Easing.bezier(...easing.panel),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => animation.stop();
  }, [open, reduced, progress]);

  if (reduced ? !open : !mounted) return null;
  return (
    <Animated.View
      nativeID={id}
      testID={testID}
      style={[
        styles.strip,
        { width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, natural] }) },
      ]}
    >
      <View
        onLayout={(event: LayoutChangeEvent) => setNatural(event.nativeEvent.layout.width)}
        style={styles.stripContent}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/** One entry of a drawer: a link in `railDrawer` caps. */
function EntryLink({
  section,
  entry,
  pathname,
  phone,
  itemRef,
  onNavigate,
}: {
  section: SectionKey;
  entry: SectionEntry;
  pathname: string;
  phone: boolean;
  itemRef?(node: FocusHandle | null): void;
  onNavigate(): void;
}) {
  const t = useT();
  const label = t.nav[entry.label];
  return (
    <BarLink
      href={entry.href}
      path={entry.path}
      testID={entryTestId(section, entry.path)}
      label={label}
      current={pathname === entry.path}
      height={phone ? PANEL_ROW : ENTRY_HEIGHT}
      paddingHorizontal={phone ? 16 : DRAWER_GAP / 2}
      itemRef={itemRef}
      onNavigate={onNavigate}
    >
      {(color) => (
        <AppText variant="railDrawer" numberOfLines={1} style={{ color }}>
          {label}
        </AppText>
      )}
    </BarLink>
  );
}

/**
 * The section bar. Both bars of a screen are the first two children of its scroll container (the
 * `PageScroll` scaffold) and this one is the sticky header; it is the `navigation` landmark named
 * "Secțiuni". Which items it shows comes from the feature flags (`liveSections`).
 */
export function SectionBar() {
  const t = useT();
  const { colors } = useTheme();
  const features = useFeatures();
  const pathname = usePathname();
  const { openDrawer, setOpenDrawer } = useShell();
  const { phone, height } = useBarMetrics();
  const sections = useMemo(() => liveSections(features), [features]);
  const openSection = sections.find((section) => section.key === openDrawer && section.entries);
  const openKey = openSection?.key ?? null;

  const rootRef = useRef<ElementRef<typeof View>>(null);
  const items = useRef(new Map<SectionKey, FocusHandle>());
  const firstEntries = useRef(new Map<SectionKey, FocusHandle>());
  const pendingFocus = useRef<SectionKey | null>(null);

  const close = useCallback(() => setOpenDrawer(null), [setOpenDrawer]);

  // Esc closes the drawer and gives the focus back to the item that opened it.
  useEscapeKey(openKey !== null, () => {
    const key = openKey;
    close();
    if (key) items.current.get(key)?.focus?.();
  });

  // Crossing 640 points (a rotation, a resized window) closes it: the other form is not the open one.
  useEffect(() => {
    close();
  }, [phone, close]);

  // A press outside the bar closes it (web; on a phone the panel is part of the bar).
  useEffect(() => {
    if (Platform.OS !== 'web' || openKey === null || typeof document === 'undefined') {
      return undefined;
    }
    const onPointerDown = (event: Event) => {
      const root = rootRef.current as unknown as { contains?: (node: Node) => boolean } | null;
      if (root?.contains && event.target instanceof Node && !root.contains(event.target)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openKey, close]);

  // The arrow key Down opens a drawer and moves the focus to its first entry once it is there.
  useEffect(() => {
    const key = pendingFocus.current;
    if (key === null || openKey !== key) return undefined;
    pendingFocus.current = null;
    const timer = setTimeout(() => firstEntries.current.get(key)?.focus?.(), 40);
    return () => clearTimeout(timer);
  }, [openKey]);

  const move = (from: SectionKey, step: 1 | -1) => {
    const index = sections.findIndex((section) => section.key === from);
    const target = sections[index + step];
    if (target) items.current.get(target.key)?.focus?.();
  };
  const onItemKey = (section: LiveSection) => (key: string) => {
    if (key === 'ArrowRight') move(section.key, 1);
    else if (key === 'ArrowLeft') move(section.key, -1);
    else if (key === 'ArrowDown' && section.entries) {
      pendingFocus.current = section.key;
      setOpenDrawer(section.key);
      // Already open: the focus moves at once.
      if (openKey === section.key) firstEntries.current.get(section.key)?.focus?.();
    } else return false;
    return true;
  };

  // The strip scrolls sideways when the items do not fit (a phone; a wide screen with a long drawer).
  const [box, setBox] = useState({ width: 0, content: 0, offset: 0 });
  const overflowing = box.content > box.width + 1;
  const moreAfter = overflowing && box.offset + box.width < box.content - 1;

  const gutter = phone ? 16 : 24;
  const itemPadding = phone ? 8 : 12;

  return (
    <View
      ref={rootRef}
      testID="section-bar"
      role="navigation"
      aria-label={t.nav.sections}
      style={[styles.bar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
    >
      <View style={{ height }}>
        <View style={[styles.scrollerBox, { height: height + FOCUS_RING_ROOM * 2 }]}>
          <ScrollView
            horizontal
            testID="section-bar-scroll"
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={32}
            onLayout={(event: LayoutChangeEvent) => {
              const width = event.nativeEvent.layout.width;
              setBox((previous) => ({ ...previous, width }));
            }}
            onContentSizeChange={(content) => setBox((previous) => ({ ...previous, content }))}
            onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const offset = event.nativeEvent.contentOffset.x;
              setBox((previous) => ({ ...previous, offset }));
            }}
            contentContainerStyle={[
              styles.row,
              phone ? { paddingLeft: gutter, paddingRight: 34 } : styles.rowWide,
              { paddingTop: FOCUS_RING_ROOM, paddingBottom: FOCUS_RING_ROOM },
            ]}
          >
            {sections.map((section) => {
              const current = section.owns(pathname);
              if (!section.entries) {
                const label =
                  section.key === 'home' ? `${t.appName}, ${t.nav.home}` : t.nav[section.label];
                return (
                  <BarLink
                    key={section.key}
                    href={section.href}
                    path={section.path ?? '/'}
                    testID={`section-item-${section.key}`}
                    label={label}
                    current={current}
                    height={height}
                    paddingHorizontal={itemPadding}
                    itemRef={(node) => {
                      if (node) items.current.set(section.key, node);
                      else items.current.delete(section.key);
                    }}
                    onKey={onItemKey(section)}
                    onNavigate={close}
                  >
                    {(color, hovered) =>
                      section.key === 'home' ? (
                        <BrandItemText current={current} hovered={hovered} />
                      ) : (
                        <RailText color={color}>{t.nav[section.label]}</RailText>
                      )
                    }
                  </BarLink>
                );
              }
              const open = openKey === section.key;
              const drawerId = `section-drawer-${section.key}`;
              return (
                <Fragment key={section.key}>
                  <DrawerToggle
                    section={section}
                    open={open}
                    current={current}
                    height={height}
                    paddingHorizontal={itemPadding}
                    controls={drawerId}
                    itemRef={(node) => {
                      if (node) items.current.set(section.key, node);
                      else items.current.delete(section.key);
                    }}
                    onToggle={() => setOpenDrawer(open ? null : section.key)}
                    onKey={onItemKey(section)}
                  />
                  {!phone ? (
                    <DrawerStrip id={drawerId} testID={drawerId} open={open}>
                      {(section.entries ?? []).map((entry, index) => (
                        <EntryLink
                          key={entry.path + entry.label}
                          section={section.key}
                          entry={entry}
                          pathname={pathname}
                          phone={false}
                          itemRef={
                            index === 0
                              ? (node) => {
                                  if (node) firstEntries.current.set(section.key, node);
                                  else firstEntries.current.delete(section.key);
                                }
                              : undefined
                          }
                          onNavigate={close}
                        />
                      ))}
                    </DrawerStrip>
                  ) : null}
                </Fragment>
              );
            })}
          </ScrollView>
        </View>
        {phone && overflowing && moreAfter ? (
          <EdgeFade side="right" width={24} testID="section-bar-fade" />
        ) : null}
      </View>
      {phone && openSection ? (
        <View
          nativeID={`section-drawer-${openSection.key}`}
          testID={`section-drawer-${openSection.key}`}
          style={[
            styles.panel,
            { backgroundColor: colors.background, borderColor: colors.border },
            elevationStyle('drawer', colors),
          ]}
        >
          {(openSection.entries ?? []).map((entry, index) => (
            <Fragment key={entry.path + entry.label}>
              {index > 0 ? (
                <View style={[styles.rule, { backgroundColor: colors.border }]} />
              ) : null}
              <EntryLink
                section={openSection.key}
                entry={entry}
                pathname={pathname}
                phone
                itemRef={
                  index === 0
                    ? (node) => {
                        if (node) firstEntries.current.set(openSection.key, node);
                        else firstEntries.current.delete(openSection.key);
                      }
                    : undefined
                }
                onNavigate={close}
              />
            </Fragment>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The border is the 1 px under the 48 (44) points of the bar.
  bar: { width: '100%', borderBottomWidth: StyleSheet.hairlineWidth, position: 'relative' },
  // Room for the focus ring above and below the items (the scroller clips what overflows it),
  // taken back by the negative margins so that the bar keeps its height.
  scrollerBox: { marginTop: -FOCUS_RING_ROOM, marginBottom: -FOCUS_RING_ROOM },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rowWide: { minWidth: '100%', justifyContent: 'center', paddingHorizontal: 16 },
  link: { justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', columnGap: 5 },
  caret: { fontSize: 16, lineHeight: 16 },
  // A drawer is 56 high (the bar plus the room of the ring) and its content centred in it.
  strip: { overflow: 'hidden', justifyContent: 'center' },
  stripContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: FOCUS_RING_ROOM,
    paddingRight: FOCUS_RING_ROOM,
  },
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
  },
  rule: { height: StyleSheet.hairlineWidth },
});
