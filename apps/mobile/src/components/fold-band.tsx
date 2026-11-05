import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, toneColor } from '@/components/app-text';
import { Band } from '@/components/band';
import { useBandTone } from '@/components/band-context';
import type { BandTone } from '@/components/band-context';
import { useFocusRing } from '@/components/focus-ring';
import { useHover } from '@/components/hover';
import { Icon } from '@/components/icon';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/theme-context';

interface Props {
  tone: BandTone;
  /** The small caps line above the heading ("CREZURI ȘI CATEHISME"). */
  label: string;
  /** The heading (`displayM`, an `h2`). */
  title: string;
  /** Open when it is first drawn (the default). */
  defaultOpen?: boolean;
  topRule?: boolean;
  testID: string;
  children: ReactNode;
}

/**
 * A folding band of the curated page (docs/ui-spec-v2.md, 6.1): a `Band` whose header is a small
 * caps label and a `displayM` heading with a chevron at the far right; it is open by default, and
 * its header is a button (`aria-expanded`). Its body is not drawn while it is closed.
 */
export function FoldBand({
  tone,
  label,
  title,
  defaultOpen = true,
  topRule,
  testID,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <Band
      tone={tone}
      topRule={topRule}
      testID={testID}
      padding={{ top: 40, bottom: open ? 56 : 40 }}
    >
      <FoldHeader
        label={label}
        title={title}
        open={open}
        controls={bodyId}
        testID={`${testID}-toggle`}
        onToggle={() => setOpen(!open)}
      />
      {open ? (
        <View nativeID={bodyId} testID={`${testID}-body`} style={styles.body}>
          {children}
        </View>
      ) : null}
    </Band>
  );
}

function FoldHeader({
  label,
  title,
  open,
  controls,
  testID,
  onToggle,
}: {
  label: string;
  title: string;
  open: boolean;
  controls: string;
  testID: string;
  onToggle(): void;
}) {
  const t = useT();
  const { colors } = useTheme();
  const band = useBandTone();
  const { hovered, hoverProps } = useHover();
  const { focusProps, focusStyle } = useFocusRing();
  const chevron = hovered ? toneColor(colors, 'accent', band) : toneColor(colors, 'muted', band);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${open ? t.library.foldCollapse : t.library.foldExpand}`}
      accessibilityState={{ expanded: open }}
      // react-native-web reads the `aria-*` props only; React Native reads both forms.
      aria-expanded={open}
      aria-controls={controls}
      onPress={onToggle}
      {...hoverProps}
      {...focusProps}
      style={[styles.header, focusStyle]}
    >
      <View style={styles.headings}>
        <AppText variant="label" tone="accent">
          {label}
        </AppText>
        <AppText variant="displayM" level={2}>
          {title}
        </AppText>
      </View>
      <Icon name={open ? 'chevronUp' : 'chevronDown'} size={22} color={chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 16,
    minHeight: 44,
  },
  headings: { flexShrink: 1, gap: 6 },
  body: { marginTop: 24 },
});
