import { Modal, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ReactNode } from 'react';

import { AppText } from '@/components/app-text';
import { CloseButton } from '@/components/close-button';
import { useWebModalBehaviour } from '@/components/modal-behaviour';
import { useT } from '@/i18n';
import { useReducedMotion } from '@/theme/reduced-motion';
import { useTheme } from '@/theme/theme-context';
import { elevationStyle, radii } from '@/theme/tokens';

/** Width of a dialog panel; the Transparency panel is 560. */
export const DIALOG_WIDTH = 480;
export const DIALOG_WIDTH_WIDE = 560;
/** Room kept free around the panel (16 on each side of a phone). */
const MARGIN = 16;

interface Props {
  visible: boolean;
  /** Called by the close button, a tap on the scrim, Escape (web) and the back button (Android). */
  onClose(): void;
  /** The heading of the dialog, in `displayS` italic; it names the dialog. */
  title?: string;
  /** The name of a dialog that has no visible heading. */
  accessibilityLabel?: string;
  /** The name of the close button; "Închide" / "Close" by default. */
  closeLabel?: string;
  /** Width of the panel in points (480, or 560 for Transparency). */
  width?: number;
  children: ReactNode;
  testID?: string;
}

/**
 * A centred panel on a `scrimDialog` backdrop: `background`, 1 px `border`, radius 12 and a close
 * "×". On a phone it is the window width less 16 on each side. The focus is trapped inside while
 * it is open and returns to the control that opened it; Escape, the scrim and the close button
 * all close it, and the page behind is inert (docs/ui-spec-v2.md, section 3).
 */
export function Dialog({
  visible,
  onClose,
  title,
  accessibilityLabel,
  closeLabel,
  width = DIALOG_WIDTH,
  children,
  testID = 'dialog',
}: Props) {
  const t = useT();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const window = useWindowDimensions();
  useWebModalBehaviour(visible);
  const name = title ?? accessibilityLabel;
  // The dialog role and name live on the element react-native-web wraps the content in.
  const nameProps = name ? ({ accessibilityLabel: name } as object) : undefined;
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={onClose}
      {...nameProps}
    >
      <View style={styles.root} testID={testID}>
        {/* A plain view with a responder, not a Pressable: it must not take the keyboard focus. */}
        <View
          testID={`${testID}-scrim`}
          accessible={false}
          importantForAccessibility="no"
          onStartShouldSetResponder={() => true}
          onResponderRelease={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrimDialog }]}
        />
        <View
          testID={`${testID}-panel`}
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              width: Math.min(width, window.width - MARGIN * 2),
              maxHeight: window.height - MARGIN * 2,
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
            elevationStyle('dialog', colors),
          ]}
        >
          <View style={styles.header}>
            {title ? (
              <AppText variant="displaySItalic" level={2} style={styles.title}>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: { borderWidth: 1, borderRadius: radii.lg, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 24, paddingRight: 4 },
  title: { flex: 1, paddingTop: 20, paddingBottom: 4 },
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 4, gap: 12 },
});
