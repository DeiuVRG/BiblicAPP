import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type {
  KeyDownEvent,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewInstance,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { EdgeFade } from '@/components/edge-fade';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { pressStyle } from '@/components/press';
import { useFontFamilies } from '@/theme/fonts';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { FOCUS_RING_ROOM } from '@/theme/tokens';

export interface TabItem<T extends string = string> {
  key: T;
  label: string;
  /** Appears in the label: "Cuprins · 11". */
  count?: number;
  testID?: string;
}

/** What the strip needs of the element of a tab: to give it the focus without a scroll of its own. */
interface TabHandle {
  focus?: (options?: { preventScroll?: boolean }) => void;
}

interface Props<T extends string> {
  /** The accessible name of the list of tabs. */
  label: string;
  tabs: readonly TabItem<T>[];
  /** The chosen tab. */
  value: T;
  onChange(key: T): void;
  /** Text size: 16 for the library views, 14 for the work hub. */
  size?: 14 | 16;
  /** The id of the panel a tab controls (`aria-controls` on web). */
  panelId?(key: T): string;
  testID?: string;
}

/** Height of a tab strip. */
export const TAB_HEIGHT = 46;
const UNDERLINE = 2;
const GAP = 28;

/** What a key does on a tab: move the focus, or activate the tab that has it. */
export function tabKeyAction(
  key: string,
): 'activate' | 'next' | 'previous' | 'first' | 'last' | null {
  switch (key) {
    case 'Enter':
    case ' ':
    case 'Spacebar':
      return 'activate';
    case 'ArrowRight':
      return 'next';
    case 'ArrowLeft':
      return 'previous';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return null;
  }
}

/** "Cuprins · 11": the label of a tab, with its count when it has one. */
export function tabLabel(tab: TabItem): string {
  return tab.count === undefined ? tab.label : `${tab.label} · ${tab.count}`;
}

/**
 * A row of text tabs, 46 high: the chosen one in 600 `text` with a 2 px `accent` underline, the
 * others in 400 `textMuted`. Manual activation (the pattern of the reference): the arrow keys, Home
 * and End move the focus along the tabs (one tab stop, a roving `tabIndex`), Enter or Space chooses
 * the tab that has it. The row scrolls sideways on a phone, with a fade at the edge that has more.
 * The scroller clips what overflows it, so it is taller and wider than the tabs by the room a
 * focus ring needs (4 points above, below and before them) and pulled back by the same amount with
 * negative margins: the ring is never cut and the strip keeps its 46 points. A tab that gets the
 * focus or is chosen is scrolled whole into view, ring included: a browser scrolls a tab that is
 * only partly visible not at all, and one that is hidden only as far as the edge, so the strip does
 * it itself.
 */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  size = 16,
  panelId,
  testID = 'tabs',
}: Props<T>) {
  const { colors } = useTheme();
  const id = useId();
  // The tab that holds the one tab stop; follows the chosen tab, and the arrow keys. (It is reset
  // while rendering when the chosen tab changes: no effect, no second pass with a stale stop.)
  const [stop, setStop] = useState<T>(value);
  const [chosen, setChosen] = useState<T>(value);
  if (chosen !== value) {
    setChosen(value);
    setStop(value);
  }
  const refs = useRef(new Map<T, TabHandle>());
  const scroller = useRef<ScrollViewInstance>(null);
  const [box, setBox] = useState({ width: 0, content: 0, offset: 0 });
  // Where each tab is in the scrolled content, and how far the strip is scrolled (read by the
  // handlers, so kept out of the state: they must not wait for a render).
  const places = useRef(new Map<T, { x: number; width: number }>());
  const scrolled = useRef(0);
  const reduced = useReducedMotion();

  /**
   * Scrolls the strip, if it has to, so that the tab and its focus ring are inside it. Returns
   * false while the layout is not known yet (nothing was done).
   */
  const reveal = useCallback(
    (key: T, animated: boolean): boolean => {
      const place = places.current.get(key);
      if (!place || box.width <= 0) return false;
      const start = place.x - FOCUS_RING_ROOM;
      const end = place.x + place.width + FOCUS_RING_ROOM;
      let target = scrolled.current;
      if (start < target) target = Math.max(0, start);
      else if (end > target + box.width) {
        target = Math.min(end - box.width, Math.max(0, box.content - box.width));
      }
      if (Math.abs(target - scrolled.current) >= 1) {
        scroller.current?.scrollTo({ x: target, animated });
      }
      return true;
    },
    [box.width, box.content],
  );

  // The chosen tab is scrolled into view when it changes (a tap on a half-hidden tab, a link that
  // sets the tab); the first time, once the layout is known, it is placed without animation.
  const placed = useRef(false);
  useEffect(() => {
    if (reveal(value, placed.current && !reduced)) placed.current = true;
  }, [value, reveal, reduced]);

  const move = (from: number, action: 'next' | 'previous' | 'first' | 'last') => {
    const last = tabs.length - 1;
    const target =
      action === 'first'
        ? 0
        : action === 'last'
          ? last
          : action === 'next'
            ? Math.min(from + 1, last)
            : Math.max(from - 1, 0);
    const tab = tabs[target];
    if (!tab) return;
    setStop(tab.key);
    // The strip scrolls the tab into view itself (`reveal`, from the focus handler of the tab).
    refs.current.get(tab.key)?.focus?.({ preventScroll: true });
  };

  const overflowing = box.content > box.width + 1;
  const moreAfter = overflowing && box.offset + box.width < box.content - 1;
  const moreBefore = overflowing && box.offset > 1;

  return (
    <View testID={testID} style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.list}>
        <ScrollView
          ref={scroller}
          testID={`${testID}-scroll`}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onLayout={(event: LayoutChangeEvent) => {
            const width = event.nativeEvent.layout.width;
            setBox((previous) => ({ ...previous, width }));
          }}
          onContentSizeChange={(content) => setBox((previous) => ({ ...previous, content }))}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offset = event.nativeEvent.contentOffset.x;
            scrolled.current = offset;
            setBox((previous) => ({ ...previous, offset }));
          }}
          style={styles.scroller}
          contentContainerStyle={styles.row}
        >
          {tabs.map((tab, index) => (
            <TabButton
              key={tab.key}
              tab={tab}
              size={size}
              selected={tab.key === value}
              stop={tab.key === stop}
              nativeId={`${id}-tab-${tab.key}`}
              controls={panelId?.(tab.key)}
              tabRef={(node) => {
                if (node) refs.current.set(tab.key, node);
                else refs.current.delete(tab.key);
              }}
              onPlace={(x, width) => places.current.set(tab.key, { x, width })}
              onReveal={() => reveal(tab.key, !reduced)}
              onSelect={() => onChange(tab.key)}
              onKey={(key) => {
                const action = tabKeyAction(key);
                if (action === null) return false;
                if (action === 'activate') onChange(tab.key);
                else move(index, action);
                return true;
              }}
            />
          ))}
        </ScrollView>
        {moreBefore ? <EdgeFade side="left" testID={`${testID}-fade-left`} /> : null}
        {moreAfter ? <EdgeFade side="right" testID={`${testID}-fade-right`} /> : null}
      </View>
    </View>
  );
}

interface TabButtonProps<T extends string> {
  tab: TabItem<T>;
  size: 14 | 16;
  selected: boolean;
  stop: boolean;
  nativeId: string;
  controls: string | undefined;
  tabRef(node: TabHandle | null): void;
  /** Reports where the tab is in the scrolled content (its layout, relative to the content). */
  onPlace(x: number, width: number): void;
  /** The tab got the focus: the strip scrolls it, ring included, into view. */
  onReveal(): void;
  onSelect(): void;
  /** Handles a key press; returns true when the key was used (the page must not scroll). */
  onKey(key: string): boolean;
}

function TabButton<T extends string>({
  tab,
  size,
  selected,
  stop,
  nativeId,
  controls,
  tabRef,
  onPlace,
  onReveal,
  onSelect,
  onKey,
}: TabButtonProps<T>) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const reduced = useReducedMotion();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const text = tabLabel(tab);
  const lineHeight = Math.round(size * 1.4);
  const common = { fontSize: size, lineHeight };
  return (
    <Pressable
      ref={tabRef}
      testID={tab.testID}
      nativeID={nativeId}
      accessibilityRole="tab"
      accessibilityLabel={text}
      accessibilityState={{ selected }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-selected={selected}
      aria-controls={controls}
      // One tab stop for the list (the roving tabindex), as in the ARIA pattern.
      {...(Platform.OS === 'web' ? { tabIndex: stop ? 0 : -1 } : null)}
      onPress={onSelect}
      onLayout={(event: LayoutChangeEvent) => {
        const { x, width } = event.nativeEvent.layout;
        onPlace(x, width);
      }}
      onKeyDown={(event: KeyDownEvent) => {
        if (onKey(event.nativeEvent.key)) event.preventDefault();
      }}
      {...hoverProps}
      onFocus={() => {
        focusProps.onFocus?.();
        onReveal();
      }}
      onBlur={focusProps.onBlur}
      style={({ pressed }) => [styles.tab, pressStyle(pressed, reduced), focusStyle]}
    >
      <View>
        {/* The 600 label is wider than the 400 one: the hidden copy reserves the room, so the
            tabs do not shift when the chosen one changes. */}
        <AppText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={[common, styles.reserve, { fontFamily: fonts.textSemiBold }]}
        >
          {text}
        </AppText>
        <AppText
          variant="meta"
          numberOfLines={1}
          style={[
            common,
            styles.label,
            {
              fontFamily: selected ? fonts.textSemiBold : fonts.text,
              color: selected ? colors.text : hovered ? colors.text : colors.textMuted,
            },
          ]}
        >
          {text}
        </AppText>
      </View>
      {selected ? <View style={[styles.underline, { backgroundColor: colors.accent }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  list: { position: 'relative' },
  // Room for the focus ring on three sides (the strip's own end has 24 of padding), taken back by
  // the negative margins of the scroller.
  scroller: {
    marginTop: -FOCUS_RING_ROOM,
    marginBottom: -FOCUS_RING_ROOM,
    marginLeft: -FOCUS_RING_ROOM,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    columnGap: GAP,
    paddingTop: FOCUS_RING_ROOM,
    paddingBottom: FOCUS_RING_ROOM,
    paddingLeft: FOCUS_RING_ROOM,
    paddingRight: 24,
  },
  tab: { minHeight: TAB_HEIGHT, justifyContent: 'center', minWidth: 44 },
  reserve: { height: 0, opacity: 0, overflow: 'hidden' },
  label: { textAlign: 'center' },
  underline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: UNDERLINE },
});
