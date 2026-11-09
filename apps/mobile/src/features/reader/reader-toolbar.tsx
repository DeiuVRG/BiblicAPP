import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { AppText } from '@/components/app-text';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { Icon } from '@/components/icon';
import { useT } from '@/i18n';
import type { AppHref } from '@/navigation-hrefs';
import { useFontFamilies } from '@/theme/fonts';
import { useCoarsePointer } from '@/theme/pointer';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { FOCUS_RING_ROOM, easing, motion } from '@/theme/tokens';

import { controlHeight, toolbarHeight } from './layout';
import type { ReaderMode } from './layout';
import type { LangChoice } from './pair';
import { GroupCell, ToolbarCell, ToolbarGroup } from './toolbar-controls';

/** One item of the Tools drawer and of the Tools sheet of a phone. */
export interface ToolItem {
  key: string;
  label: string;
  /** The accessible name when it says more than the label ("Tema: Luminos. Apasă pentru Sepia."). */
  accessibilityLabel?: string;
  onPress(): void;
  /** A toggle that is on ("Marcat"). */
  active?: boolean;
}

export interface ToolbarProps {
  mode: ReaderMode;
  title: string;
  /** The author as a link, with the years and the edition after it; or the issuing body as plain text. */
  author: { name: string; href: AppHref | null } | null;
  /** "1862–1949", or "Conciliul din Calcedon · 451" for a body: after the name, in the same line. */
  meta: string;
  /** "Română · traducere", when the work has several editions. */
  editionLabel: string | null;
  contentsOpen: boolean;
  onToggleContents(): void;
  /** One-based index of the section in the edition, and how many sections it has. */
  index: number;
  total: number;
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  onJump(position: number): void;
  transparencyLabel: string;
  transparencyOpen: boolean;
  onTransparency(): void;
  /** The language control: absent for a work with one edition. */
  languages: readonly LangChoice[];
  /** The token of the edition shown, or null while two lanes are on. */
  language: string | null;
  disabledLanguages: ReadonlySet<string>;
  onLanguage(token: string): void;
  lanesAvailable: boolean;
  lanesOn: boolean;
  lanesMenuOpen: boolean;
  onLanes(): void;
  findOpen: boolean;
  onFind(): void;
  aaOpen: boolean;
  onAa(): void;
  toolsOpen: boolean;
  onTools(): void;
  tools: readonly ToolItem[];
  /** The Tools drawer: opens to the left of `Aa` and `Tools` (a wide screen). */
  drawer?: React.ReactNode;
  /** The popovers under the toolbar (the `Aa` panel, the menu of pairs): absolutely placed in the bar. */
  popovers?: React.ReactNode;
}

/**
 * The toolbar of the reader (docs/ui-spec-v2.md, 8.2): the outline toggle, the title block, the section
 * arrows and counter, Transparency, the language control, find, `Aa` and Tools. On a phone it is the
 * title block alone (the bottom bar carries the rest). While the Tools drawer is open the title block
 * and the counter fold away.
 */
export function ReaderToolbar(props: ToolbarProps) {
  const t = useT();
  const { colors } = useTheme();
  const coarse = useCoarsePointer();
  const { mode } = props;
  const phone = mode === 'phone';
  const height = toolbarHeight(mode, coarse);
  const folded = props.toolsOpen && !phone;
  return (
    <View
      testID="reader-toolbar"
      accessibilityRole="toolbar"
      accessibilityLabel={t.reader.toolbar}
      style={[
        styles.bar,
        {
          height,
          backgroundColor: colors.cream,
          borderBottomColor: colors.border,
          paddingHorizontal: phone ? 16 : 24,
          zIndex: 10,
        },
      ]}
    >
      {phone ? null : (
        <ToolbarCell
          testID="outline-toggle"
          label={t.reader.contentsToggleLabel}
          expanded={props.contentsOpen}
          onPress={props.onToggleContents}
          width={40}
          style={styles.iconCell}
        >
          <Icon name="menu" size={18} />
        </ToolbarCell>
      )}
      {folded ? <View style={styles.grow} /> : <TitleBlock {...props} />}
      {phone ? null : (
        <View style={styles.right}>
          {folded ? null : (
            <ToolbarGroup>
              <GroupCell
                testID="reader-previous"
                label={t.reader.previousLabel}
                disabled={props.onPrevious === null}
                onPress={props.onPrevious ?? undefined}
                width={35}
                style={styles.arrowCell}
              >
                <ArrowGlyph direction="previous" disabled={props.onPrevious === null} />
              </GroupCell>
              <GroupCell
                testID="reader-next"
                label={t.reader.nextLabel}
                disabled={props.onNext === null}
                onPress={props.onNext ?? undefined}
                width={35}
                divided
                style={styles.arrowCell}
              >
                <ArrowGlyph direction="next" disabled={props.onNext === null} />
              </GroupCell>
              <Counter index={props.index} total={props.total} onJump={props.onJump} />
            </ToolbarGroup>
          )}
          <ToolbarCell
            testID="transparency-button"
            label={props.transparencyLabel}
            expanded={props.transparencyOpen}
            accent={props.transparencyOpen}
            onPress={props.onTransparency}
          >
            {props.transparencyLabel}
          </ToolbarCell>
          {props.languages.length > 1 ? (
            <LanguageControl
              languages={props.languages}
              language={props.language}
              disabled={props.disabledLanguages}
              onLanguage={props.onLanguage}
              lanesAvailable={props.lanesAvailable}
              lanesOn={props.lanesOn}
              lanesMenuOpen={props.lanesMenuOpen}
              onLanes={props.onLanes}
            />
          ) : null}
          <ToolbarCell
            testID="find-button"
            label={t.reader.findLabel}
            expanded={props.findOpen}
            onPress={props.onFind}
            width={40}
            style={styles.iconCell}
          >
            <Icon name="search" size={18} />
          </ToolbarCell>
          {props.drawer}
          <ToolbarGroup>
            <GroupCell
              testID="aa-button"
              label={t.reader.typographyLabel}
              expanded={props.aaOpen}
              onPress={props.onAa}
              width={44}
            >
              {t.reader.typographyButton}
            </GroupCell>
            <GroupCell
              testID="tools-button"
              label={t.reader.toolsLabel}
              expanded={props.toolsOpen}
              onPress={props.onTools}
              divided
              style={styles.toolsCell}
            >
              <AppText variant="chrome" style={{ color: colors.text }}>
                {t.reader.tools}
              </AppText>
              <AppText variant="chrome" style={{ color: colors.textMuted }}>
                {props.toolsOpen ? '‹' : '›'}
              </AppText>
            </GroupCell>
          </ToolbarGroup>
        </View>
      )}
      {props.popovers}
    </View>
  );
}

/** The Tools drawer opens to the left of `Aa` and `Tools`: its width grows from 0 to its content in 320 ms. */
export function ToolsDrawer({ items, open }: { items: readonly ToolItem[]; open: boolean }) {
  const reduced = useReducedMotion();
  const [content, setContent] = useState(0);
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0));
  // The tools are in the tree while the drawer is open or still closing: a closed drawer has nothing
  // in it to tab to (a zero-width box does not hide a focusable button).
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setClosing(!open && !reduced);
  }
  const shown = open || closing;
  // Where the animation is going: a drawer that is already there (the first render, closed) has
  // nothing to animate.
  const settled = useRef(open);
  useEffect(() => {
    if (reduced) {
      progress.setValue(open ? 1 : 0);
      settled.current = open;
      return undefined;
    }
    if (settled.current === open) return undefined;
    settled.current = open;
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: motion.drawer + 20,
      easing: Easing.bezier(...easing.panel),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && !open) setClosing(false);
    });
    return () => animation.stop();
  }, [open, reduced, progress]);
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: [0, content] });
  return (
    <Animated.View
      testID="tools-drawer"
      pointerEvents={open ? 'auto' : 'none'}
      style={[styles.drawer, { width }]}
    >
      {/* The row has its natural width: it is measured, and the box around it is opened to it. */}
      {shown ? (
        <View
          onLayout={(event: LayoutChangeEvent) => setContent(event.nativeEvent.layout.width)}
          style={styles.drawerRow}
        >
          {items.map((item) => (
            <ToolbarCell
              key={item.key}
              testID={`tool-${item.key}`}
              label={item.accessibilityLabel ?? item.label}
              pressed={item.active}
              onPress={item.onPress}
            >
              {item.label}
            </ToolbarCell>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

function TitleBlock({
  title,
  author,
  meta,
  editionLabel,
}: Pick<ToolbarProps, 'title' | 'author' | 'meta' | 'editionLabel'>) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  return (
    <View style={styles.title}>
      <AppText
        variant="readerTitle"
        heading
        level={1}
        numberOfLines={1}
        testID="reader-title"
        style={{ color: colors.text }}
      >
        {title}
      </AppText>
      <View style={styles.metaLine}>
        {author ? (
          author.href ? (
            <Link href={author.href} asChild>
              <MetaLink name={author.name} />
            </Link>
          ) : (
            <AppText variant="caption" numberOfLines={1} style={styles.meta12}>
              {author.name}
            </AppText>
          )
        ) : null}
        {[meta, editionLabel]
          .filter((part) => part !== null && part !== '')
          .map((part) => (
            <AppText
              key={part}
              variant="caption"
              numberOfLines={1}
              style={[styles.meta12, { fontFamily: fonts.text }]}
            >
              {part}
            </AppText>
          ))}
      </View>
    </View>
  );
}

/** The author's name in the title block: a link, 12 points, in `accentStrong`. */
function MetaLink({ name, ...rest }: { name: string } & Record<string, unknown>) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="link"
      {...hoverProps}
      {...focusProps}
      {...rest}
      style={focusStyle}
    >
      <AppText
        variant="caption"
        numberOfLines={1}
        style={[
          styles.meta12,
          styles.underline,
          { color: hovered ? colors.accentHover : colors.accentStrong },
        ]}
      >
        {name}
      </AppText>
    </Pressable>
  );
}

function ArrowGlyph({
  direction,
  disabled,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <AppText
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.arrow, { color: disabled ? colors.textMuted : colors.text }]}
    >
      {direction === 'previous' ? '‹' : '›'}
    </AppText>
  );
}

/** "3 / 11": an input for the number of the section and the total; Enter jumps, letters and numbers out of range do nothing. */
function Counter({ index, total, onJump }: Pick<ToolbarProps, 'index' | 'total' | 'onJump'>) {
  const t = useT();
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const coarse = useCoarsePointer();
  const [text, setText] = useState(String(index));
  const [seen, setSeen] = useState(index);
  if (seen !== index) {
    setSeen(index);
    setText(String(index));
  }
  const commit = () => {
    const wanted = Number(text);
    if (Number.isInteger(wanted) && wanted >= 1 && wanted <= total && wanted !== index) {
      onJump(wanted);
    } else {
      setText(String(index));
    }
  };
  return (
    <View
      testID="reader-counter-box"
      style={[
        styles.counter,
        { borderLeftColor: colors.borderStrong, height: controlHeight(coarse) },
      ]}
    >
      <TextInput
        testID="reader-counter"
        accessibilityLabel={t.reader.counterLabel}
        value={text}
        onChangeText={(value) => setText(value.replace(/[^0-9]/g, '').slice(0, 5))}
        onSubmitEditing={commit}
        onBlur={() => setText(String(index))}
        inputMode="numeric"
        returnKeyType="go"
        selectTextOnFocus
        style={[styles.counterInput, { color: colors.text, fontFamily: fonts.text }]}
      />
      <AppText variant="chrome" muted>
        {t.reader.counterTotal(total)}
      </AppText>
    </View>
  );
}

/** RO, EN, Original and the lanes toggle (docs/ui-spec-v2.md, 8.2 and 8.5). */
function LanguageControl({
  languages,
  language,
  disabled,
  onLanguage,
  lanesAvailable,
  lanesOn,
  lanesMenuOpen,
  onLanes,
}: {
  languages: readonly LangChoice[];
  language: string | null;
  disabled: ReadonlySet<string>;
  onLanguage(token: string): void;
  lanesAvailable: boolean;
  lanesOn: boolean;
  lanesMenuOpen: boolean;
  onLanes(): void;
}) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <ToolbarGroup testID="reader-language" label={t.reader.languageGroup}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t.reader.languageGroup}
        style={styles.segments}
      >
        {languages.map((choice, position) => (
          <GroupCell
            key={choice.token}
            testID={`lang-${choice.token}`}
            role="radio"
            label={choice.code === 'Original' ? t.reader.langOriginal : choice.code}
            chosen={!lanesOn && language === choice.token}
            disabled={disabled.has(choice.token)}
            divided={position > 0}
            onPress={() => onLanguage(choice.token)}
          >
            {choice.code === 'Original' ? t.reader.langOriginal : choice.code}
          </GroupCell>
        ))}
      </View>
      {lanesAvailable ? (
        <GroupCell
          testID="lang-pair-toggle"
          label={t.reader.lanesLabel}
          pressed={lanesOn}
          expanded={lanesMenuOpen}
          divided
          onPress={onLanes}
          width={40}
          style={styles.iconCell}
        >
          <Icon name="lanes" size={18} color={lanesOn ? colors.accentStrong : colors.text} />
        </GroupCell>
      ) : null}
    </ToolbarGroup>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    borderBottomWidth: 1,
  },
  grow: { flex: 1 },
  iconCell: { paddingHorizontal: 0 },
  title: { flex: 1, minWidth: 0, gap: 1 },
  metaLine: { flexDirection: 'row', alignItems: 'baseline', columnGap: 10, overflow: 'hidden' },
  meta12: { fontSize: 12, lineHeight: 16 },
  underline: { textDecorationLine: 'underline' },
  right: { flexDirection: 'row', alignItems: 'center', columnGap: 8, flexShrink: 0 },
  arrowCell: { paddingHorizontal: 0 },
  arrow: { fontSize: 22, lineHeight: 24 },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: 8,
    width: 87,
    borderLeftWidth: 1,
    justifyContent: 'center',
  },
  counterInput: {
    width: 34,
    height: '100%',
    padding: 0,
    textAlign: 'right',
    fontSize: 13,
  },
  segments: { flexDirection: 'row', alignItems: 'stretch' },
  toolsCell: { columnGap: 6, minWidth: 66 },
  // Tall enough for a control and the room its focus ring needs on both sides (the row is absolute).
  drawer: { overflow: 'hidden', height: 44 + FOCUS_RING_ROOM * 2 },
  // The ring of a button needs room around it inside the box that clips (4 points).
  drawerRow: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    padding: FOCUS_RING_ROOM,
  },
});
