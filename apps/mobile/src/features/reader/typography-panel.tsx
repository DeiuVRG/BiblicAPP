import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { SegmentedControl } from '@/components/segmented-control';
import { useT } from '@/i18n';
import { clamp } from '@/settings/sanitize';
import { nearestPreset, useReadingMetrics } from '@/settings/reading-metrics';
import { useSettings } from '@/settings/settings-context';
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  LINE_SPACING_NAMES,
  THEME_PREFERENCES,
} from '@/settings/types';
import { READING_FONTS } from '@/theme/font-families';
import { useTheme } from '@/theme/theme-context';
import { elevationStyle, radii } from '@/theme/tokens';

/** The popover is 340 wide (docs/ui-spec-v2.md, 8.7). */
export const TYPOGRAPHY_PANEL_WIDTH = 340;
/** The segments of the sheet are narrower than the 84 of the forms: three options fit one row in 340. */
const COMPACT_SEGMENT = 72;

function Row({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <AppText variant="label" numberOfLines={1} style={styles.caption}>
        {caption}
      </AppText>
      <View style={styles.control}>{children}</View>
    </View>
  );
}

interface BodyProps {
  /** A phone: the buttons Anterior, Următor and "Despre această carte" end the sheet. */
  phone?: boolean;
  onPrevious?: (() => void) | null;
  onNext?: (() => void) | null;
  onAbout?(): void;
}

/**
 * The rows of the `Aa` sheet (docs/ui-spec-v2.md, 8.7): the face, the spacing in three presets, the size in
 * a stepper (14 to 34), the theme. They apply live and persist in the settings. On a phone, which has no
 * counter or arrows in its toolbar, the buttons to move between chapters and to open the page of the
 * work end the sheet.
 */
export function TypographyBody({ phone = false, onPrevious, onNext, onAbout }: BodyProps) {
  const t = useT();
  const { name } = useTheme();
  const { settings, update } = useSettings();
  const { fontSize } = useReadingMetrics();
  return (
    <View testID="typography-panel-body" style={styles.body}>
      <Row caption={t.reader.aa.font}>
        <SegmentedControl
          label={t.settings.readingFont}
          options={READING_FONTS.map((value) => ({ value, label: t.settings.readingFonts[value] }))}
          value={settings.readingFont}
          onChange={(readingFont) => update({ readingFont })}
          minSegment={COMPACT_SEGMENT}
        />
      </Row>
      <Row caption={t.reader.aa.spacing}>
        <SegmentedControl
          label={t.reader.aa.spacing}
          options={LINE_SPACING_NAMES.map((value) => ({
            value,
            label: t.reader.aa.spacingNames[value],
          }))}
          value={nearestPreset(settings.lineSpacing, name === 'dark')}
          onChange={(lineSpacing) => update({ lineSpacing })}
          minSegment={COMPACT_SEGMENT}
        />
      </Row>
      <Row caption={t.reader.aa.size}>
        <View style={styles.stepper}>
          <Button
            testID="aa-smaller"
            glyph
            title="A−"
            label={t.settings.decreaseFontSize}
            disabled={fontSize <= FONT_SIZE_MIN}
            onPress={() => update({ fontSize: clamp(fontSize - 1, FONT_SIZE_MIN, FONT_SIZE_MAX) })}
          />
          <AppText
            variant="meta"
            testID="aa-size"
            style={styles.value}
            accessibilityLiveRegion="polite"
          >
            {t.settings.fontSizeValue(fontSize)}
          </AppText>
          <Button
            testID="aa-larger"
            glyph
            title="A+"
            label={t.settings.increaseFontSize}
            disabled={fontSize >= FONT_SIZE_MAX}
            onPress={() => update({ fontSize: clamp(fontSize + 1, FONT_SIZE_MIN, FONT_SIZE_MAX) })}
          />
        </View>
      </Row>
      <Row caption={t.reader.aa.theme}>
        <SegmentedControl
          label={t.settings.theme}
          options={THEME_PREFERENCES.map((value) => ({ value, label: t.settings.themes[value] }))}
          value={settings.theme}
          onChange={(theme) => update({ theme })}
          minSegment={COMPACT_SEGMENT}
        />
      </Row>
      {phone ? (
        <View style={styles.phoneButtons}>
          <Button
            testID="aa-previous"
            variant="outline"
            title={t.reader.aa.previous}
            label={t.reader.previousLabel}
            disabled={!onPrevious}
            onPress={onPrevious ?? undefined}
            style={styles.half}
          />
          <Button
            testID="aa-next"
            variant="outline"
            title={t.reader.aa.next}
            label={t.reader.nextLabel}
            disabled={!onNext}
            onPress={onNext ?? undefined}
            style={styles.half}
          />
          {onAbout ? (
            <Button
              testID="aa-about"
              variant="text"
              title={t.reader.aa.aboutBook}
              onPress={onAbout}
              style={styles.about}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The popover version: a card under the toolbar, 340 wide, right aligned. Closing is the screen's. */
export function TypographyPopover({ children, right }: { children: ReactNode; right: number }) {
  const { colors } = useTheme();
  return (
    <View
      testID="typography-panel"
      accessibilityViewIsModal={false}
      style={[
        styles.popover,
        { right, backgroundColor: colors.surface, borderColor: colors.border },
        elevationStyle('popover', colors),
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // The caption column: 3.4 rem; its capitals are tracked less than elsewhere, so that "SPAȚIERE" fits.
  caption: { width: 64, letterSpacing: 0.8 },
  control: { flex: 1, minWidth: 0 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { minWidth: 52, textAlign: 'center' },
  phoneButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  half: { flexGrow: 1, flexBasis: 140 },
  about: { alignSelf: 'center' },
  popover: {
    position: 'absolute',
    top: '100%',
    width: TYPOGRAPHY_PANEL_WIDTH,
    marginTop: 4,
    padding: 12,
    borderWidth: 1,
    borderRadius: radii.md,
    zIndex: 30,
  },
});
