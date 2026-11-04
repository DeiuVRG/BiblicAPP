import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { CloseButton } from '@/components/close-button';
import { useWebModalBehaviour } from '@/components/modal-behaviour';
import { useT } from '@/i18n';
import { SHEET_MAX } from '@/theme/layout';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { duration, easing, elevationStyle, radii } from '@/theme/tokens';

/** The tallest a sheet gets, as a share of the window height. */
export const SHEET_MAX_HEIGHT = 0.7;

interface Props {
  visible: boolean;
  /** Called by the close button, a tap on the scrim, Escape (web) and the back button (Android). */
  onClose(): void;
  /** The heading of the sheet, in `heading`; it names the sheet. */
  title?: string;
  /** The name of a sheet that has no visible heading. */
  accessibilityLabel?: string;
  /** The name of the close button; "Închide" / "Close" by default. */
  closeLabel?: string;
  children: ReactNode;
  testID?: string;
}

/** True when the window is narrow enough (700 or less) for previews to be bottom sheets. */
export function useSheetWidth(): boolean {
  return useWindowDimensions().width <= SHEET_MAX;
}

/**
 * A bottom sheet: full width up to 700 points, at most 70 % of the window high, 12 points of
 * rounding on top and the bottom safe area as padding. It replaces popovers on touch. There is no
 * drag: the close button, a tap on the scrim, Escape and the back button close it. It slides up
 * over 300 ms (instant under reduced motion).
 */
export function Sheet({
  visible,
  onClose,
  title,
  accessibilityLabel,
  closeLabel,
  children,
  testID = 'sheet',
}: Props) {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reduced = useReducedMotion();
  useWebModalBehaviour(visible);

  // The sheet stays mounted until it has slid away: `leaving` is set while rendering, at the moment
  // `visible` turns false, and cleared when the slide ends.
  const [leaving, setLeaving] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    setLeaving(!visible && !reduced);
  }
  const mounted = visible || leaving;
  const [progress] = useState(() => new Animated.Value(visible ? 1 : 0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(visible ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: duration.slow,
      easing: Easing.bezier(...easing.panel),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setLeaving(false);
    });
    return () => animation.stop();
  }, [visible, reduced, progress]);

  const name = title ?? accessibilityLabel;
  const nameProps = name ? ({ accessibilityLabel: name } as object) : undefined;
  const slide = progress.interpolate({ inputRange: [0, 1], outputRange: [window.height, 0] });

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      {...nameProps}
    >
      <View style={styles.root} testID={testID}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          {/* A plain view with a responder, not a Pressable: it must not take the keyboard focus. */}
          <View
            testID={`${testID}-scrim`}
            accessible={false}
            importantForAccessibility="no"
            onStartShouldSetResponder={() => true}
            onResponderRelease={onClose}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrimDialog }]}
          />
        </Animated.View>
        <Animated.View
          testID={`${testID}-panel`}
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              maxHeight: window.height * SHEET_MAX_HEIGHT,
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: insets.bottom,
              transform: [{ translateY: slide }],
            },
            elevationStyle('dialog', colors),
          ]}
        >
          <View style={styles.header}>
            {title ? (
              <AppText variant="heading" level={2} style={styles.title}>
                {title}
              </AppText>
            ) : (
              <View style={styles.title} />
            )}
            <CloseButton
              testID={`${testID}-close`}
              label={closeLabel ?? t.common.close}
              onPress={onClose}
            />
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    width: '100%',
    maxWidth: SHEET_MAX,
    alignSelf: 'center',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 4 },
  title: { flex: 1, paddingTop: 8 },
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4, gap: 12 },
});
