import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { useFontFamilies } from '@/theme/fonts';
import { useLayout } from '@/theme/layout';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { easing, motion } from '@/theme/tokens';

/** Height of the summary line on wide screens; a phone gets the 44 pt touch target. */
const SUMMARY_HEIGHT = 36;
const PHONE_SUMMARY_HEIGHT = 44;

interface Props {
  /** The always-visible line: "Metodologie". */
  summary: string;
  /** Closed by default. */
  defaultOpen?: boolean;
  /** Called after the disclosure opened or closed. */
  onToggle?(open: boolean): void;
  /** The body; a string is set in the `caption` style. */
  children: ReactNode;
  testID?: string;
}

/**
 * A closed-by-default summary line with a `›` that turns 90 degrees, and a body in the `caption`
 * style: the "Metodologie" notes. On web the closed body stays in the page (hidden) so that it
 * prints open (`[data-disclosure-body]` in public/index.html); elsewhere it is not rendered.
 */
export function Disclosure({
  summary,
  defaultOpen = false,
  onToggle,
  children,
  testID = 'disclosure',
}: Props) {
  const { colors } = useTheme();
  const fonts = useFontFamilies();
  const { wide } = useLayout();
  const reduced = useReducedMotion();
  const bodyId = useId();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const [open, setOpen] = useState(defaultOpen);
  const [turn] = useState(() => new Animated.Value(defaultOpen ? 1 : 0));

  const openBefore = useRef(defaultOpen);
  useEffect(() => {
    if (openBefore.current === open) return undefined;
    openBefore.current = open;
    if (reduced) {
      turn.setValue(open ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(turn, {
      toValue: open ? 1 : 0,
      duration: motion.caret,
      easing: Easing.bezier(...easing.default),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [open, reduced, turn]);

  const toggle = () => {
    setOpen(!open);
    onToggle?.(!open);
  };

  const body =
    typeof children === 'string' ? <AppText variant="caption">{children}</AppText> : children;
  // The closed body stays in the page on web, hidden (it prints open); native does not render it.
  const bodyProps =
    Platform.OS === 'web'
      ? ({ dataSet: { disclosureBody: '' }, nativeID: bodyId } as object)
      : { nativeID: bodyId };
  const hiddenOnWeb: ViewStyle | undefined =
    Platform.OS === 'web' && !open ? { display: 'none' } : undefined;

  return (
    <View testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityState={{ expanded: open }}
        // react-native-web reads the `aria-*` props only; React Native reads both forms.
        aria-expanded={open}
        aria-controls={bodyId}
        onPress={toggle}
        {...hoverProps}
        {...focusProps}
        style={({ pressed }) => [
          styles.summary,
          { minHeight: wide ? SUMMARY_HEIGHT : PHONE_SUMMARY_HEIGHT, opacity: pressed ? 0.7 : 1 },
          focusStyle,
        ]}
      >
        <Animated.Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.caret,
            {
              fontFamily: fonts.text,
              color: hovered ? colors.accentStrong : colors.textMuted,
              transform: [
                {
                  rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }),
                },
              ],
            },
          ]}
        >
          ›
        </Animated.Text>
        <AppText variant="meta" style={{ color: hovered ? colors.accentStrong : colors.text }}>
          {summary}
        </AppText>
      </Pressable>
      {open || Platform.OS === 'web' ? (
        <View {...bodyProps} style={[styles.body, hiddenOnWeb]}>
          {body}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', columnGap: 10, alignSelf: 'flex-start' },
  caret: { width: 12, fontSize: 18, lineHeight: 20, textAlign: 'center' },
  body: { paddingLeft: 22, paddingBottom: 8, gap: 8 },
});
