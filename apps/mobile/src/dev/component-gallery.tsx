import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { AppText } from '@/components/app-text';
import type { TextVariant } from '@/components/app-text';
import { Band } from '@/components/band';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Dialog } from '@/components/dialog';
import { Disclosure } from '@/components/disclosure';
import { Hero } from '@/components/hero';
import { ICON_NAMES, Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SegmentedControl } from '@/components/segmented-control';
import { Sheet } from '@/components/sheet';
import { Tabs } from '@/components/tabs';
import { useToast } from '@/components/toast';
import { useTheme } from '@/theme/theme-context';

// The component gallery: every part of the kit on one page, in the active theme, built from the real
// components. It is a development tool and is not part of the app: no route imports it. The
// script `scripts/screenshots-components.mjs` puts a temporary route in front of it, exports the
// site, takes the three screenshots of docs/screenshots/v2/components-*.png and removes the route
// again; the focus, press and contrast checks of the review were run against the same page.
// Strings are Romanian, with comma-below letters.

/**
 * 1600 x 600, greyscale: pure white (the worst picture for text laid over it, check G5 of
 * docs/ui-spec-v2.md 20.3), a black disc in the middle (to see that the crop is centred) and a
 * grey stripe along the left and right edges (to see that the picture covers the whole hero).
 */
const PHOTO: ImageSourcePropType = require('./gallery-hero.png');

const TABS = [
  { key: 'toc', label: 'Cuprins', count: 11, testID: 'g-tab-toc' },
  { key: 'about', label: 'Prezentare', testID: 'g-tab-about' },
  { key: 'index', label: 'Index', testID: 'g-tab-index' },
  { key: 'scripture', label: 'Scriptura' },
  { key: 'topics', label: 'Teme' },
  { key: 'more', label: 'Mai multe despre carte' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const VIEWS = [
  { key: 'author', label: 'Citește' },
  { key: 'century', label: 'Autor' },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'];

const THEMES = [
  { value: 'light', label: 'Luminos' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'dark', label: 'Întunecat' },
] as const;

const SCALE: readonly TextVariant[] = [
  'displayXL',
  'displayL',
  'displayM',
  'displayS',
  'displaySItalic',
  'numeral',
  'title',
  'heading',
  'lead',
  'body',
  'meta',
  'caption',
  'original',
  'label',
  'kicker',
  'button',
  'chip',
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="displayS" heading={false}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

/** The buttons, chips and the other small controls, with the states a reviewer looks at. */
function Controls() {
  const [theme, setTheme] = useState<(typeof THEMES)[number]['value']>('light');
  const [selected, setSelected] = useState(true);
  return (
    <>
      <Section title="Butoane">
        <View style={styles.row} testID="g-buttons">
          <Button variant="primary" title="Începe lectura" testID="g-primary" />
          <Button variant="outline" title="Outline" testID="g-outline" />
          <Button variant="text" arrow title="Citește" testID="g-text" />
          <Button variant="text" title="Link text" />
          <Button variant="pill" title="Creează cont" />
          <Button variant="primary" title="Dezactivat" disabled />
          <Button variant="primary" title="Se încarcă" loading />
          <Button variant="outline" glyph title="×" label="Închide" testID="g-glyph" />
          <Button
            variant="text"
            glyph
            title="×"
            label="Șterge căutarea"
            textStyle={{ fontSize: 24, lineHeight: 28 }}
          />
        </View>
      </Section>
      <Section title="Chip-uri">
        <View style={styles.rowCenter} testID="g-chips">
          <Chip label="RO" testID="g-chip-static" />
          <Chip label="English · original" />
          <Chip label="Traducere parțială" shape="tag" />
          <Chip label="Neverificată" status testID="g-chip-status" />
          <Chip
            label="Selectat"
            selected={selected}
            onPress={() => setSelected(!selected)}
            testID="g-chip-toggle"
          />
          <Chip label="Filtru" onPress={() => undefined} testID="g-chip-filter" />
          <Button variant="outline" title="Detalii" />
        </View>
      </Section>
      <Section title="Segmented">
        <SegmentedControl
          label="Tema"
          options={THEMES}
          value={theme}
          onChange={(value) => setTheme(value)}
        />
      </Section>
    </>
  );
}

function TabsSection() {
  const [tab, setTab] = useState<TabKey>('toc');
  const [view, setView] = useState<ViewKey>('author');
  return (
    <Section title="Tabs">
      <Tabs
        label="Vederi ale cărții"
        tabs={TABS}
        value={tab}
        onChange={(key) => setTab(key)}
        testID="g-tabs-16"
      />
      <Tabs
        label="Vederi ale bibliotecii"
        size={14}
        tabs={VIEWS}
        value={view}
        onChange={(key) => setView(key)}
        testID="g-tabs-14"
      />
      {/* A strip in a narrow box scrolls sideways, with a fade at the edge that has more. */}
      <View style={styles.narrow} testID="g-tabs-narrow-box">
        <Tabs
          label="Vederi, în loc îngust"
          tabs={TABS}
          value={tab}
          onChange={(key) => setTab(key)}
          testID="g-tabs-narrow"
        />
      </View>
    </Section>
  );
}

function Layers() {
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  return (
    <Section title="Dialog, Sheet, Toast">
      <View style={styles.row} testID="g-layers">
        <Button title="Deschide dialogul" onPress={() => setDialog(true)} testID="g-open-dialog" />
        <Button title="Deschide foaia" onPress={() => setSheet(true)} testID="g-open-sheet" />
        <Button title="Arată mesajul" onPress={() => toast.show('Link copiat.')} testID="g-toast" />
      </View>
      <Dialog
        visible={dialog}
        onClose={() => setDialog(false)}
        title="Transparență"
        testID="g-dialog"
      >
        <AppText variant="body">
          Textul a fost tradus de un model și verificat de un om; ce a fost verificat este spus
          aici.
        </AppText>
        <Button title="Raportează o greșeală" onPress={() => undefined} />
      </Dialog>
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Paragraful 3" testID="g-sheet">
        <AppText variant="body">Acțiuni pentru paragraf.</AppText>
        <Button title="Copiază linkul" onPress={() => undefined} />
      </Sheet>
    </Section>
  );
}

function Icons() {
  return (
    <Section title="Pictograme">
      <View style={styles.icons} testID="g-icons">
        {ICON_NAMES.map((name) => (
          <View key={name} style={styles.icon}>
            <Icon name={name} />
            <AppText variant="caption">{name}</AppText>
          </View>
        ))}
      </View>
      <View style={styles.row}>
        <IconButton name="search" label="Căutare" testID="g-icon-button" />
        <IconButton name="menu" label="Meniu" expanded={false} />
        <IconButton name="bookmarkFilled" label="Marcaj" selected />
        <IconButton name="flag" label="Raportează" disabled />
      </View>
    </Section>
  );
}

/** A band of each background, each with the kinds of text that sit on it. */
function Bands() {
  return (
    <>
      <Band tone="cream" testID="g-band-cream">
        <View style={styles.band}>
          <AppText variant="kicker">Studiu</AppText>
          <AppText variant="displayM" heading={false}>
            Citește traducerea lângă original.
          </AppText>
          <AppText variant="body">
            Un text pe fundal{' '}
            <AppText variant="body" tone="accent">
              cream
            </AppText>
            , cu un accent.
          </AppText>
          <AppText variant="label">Etichetă mută</AppText>
          <View style={styles.row}>
            <Button title="Încearcă" />
            <Button variant="primary" title="Citește" />
          </View>
        </View>
      </Band>
      <Band tone="warm" testID="g-band-warm">
        <View style={styles.band}>
          <AppText variant="displayS" heading={false}>
            Plăcuță caldă
          </AppText>
          {/* `label` and `caption` are muted by default: on warm they are `text` (rule 2 of 2.1). */}
          <AppText variant="label">Latină</AppText>
          <AppText variant="caption">12 lucrări · 3 autori</AppText>
          <AppText variant="kicker">Raft</AppText>
        </View>
      </Band>
      <Band tone="masthead" testID="g-band-masthead">
        <View style={styles.band}>
          <AppText variant="kicker">Cui se adresează</AppText>
          <AppText variant="displayM" heading={false}>
            Mireni, păstori, cercetători
          </AppText>
          <AppText variant="body" muted>
            Text pe masthead, cu cerneală mută.
          </AppText>
          <View style={styles.rowCenter}>
            <Button title="Încearcă" />
            <Button variant="primary" title="Citește" />
            <Button variant="text" arrow title="Autori" />
            <Chip status label="Beta" />
            <IconButton name="search" label="Căutare" />
          </View>
        </View>
      </Band>
      <Band tone="photo" testID="g-band-photo">
        <View style={styles.band}>
          <AppText variant="kicker">Peste o fotografie</AppText>
          <AppText variant="body" muted>
            Aici orange-ul nu are contrast: kickerul, insigna și legăturile sunt cerneala.
          </AppText>
          <View style={styles.rowCenter}>
            <Chip status label="Beta" />
            <Button variant="text" arrow title="Despre bibliotecă" />
          </View>
        </View>
      </Band>
    </>
  );
}

/** The type scale, one line per token. */
function TypeScale() {
  return (
    <Band tone="background" testID="g-type">
      <View style={styles.band}>
        {SCALE.map((variant) => (
          <AppText key={variant} variant={variant} heading={false}>
            {variant}: Învățătura lui Isus despre Împărăție
          </AppText>
        ))}
      </View>
    </Band>
  );
}

/** The component gallery (see the note at the top of the file). */
export function ComponentGallery() {
  const { colors } = useTheme();
  return (
    <ScrollView
      testID="gallery"
      style={[styles.fill, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Hero
        testID="g-hero-flat"
        kicker="Biblioteca"
        badge="Beta"
        title={['Tradiția creștină,', 'în limba ta.']}
        sub="Cărți creștine vechi, în română și în engleză, cu originalul alături. Un asistent răspunde numai din texte, cu trimiteri la paragraf."
        actions={
          <>
            <Button variant="primary" title="Începe lectura" testID="g-hero-primary" />
            <Button variant="outline" title="Întreabă biblioteca" />
          </>
        }
        links={
          <>
            <Button variant="text" arrow title="Despre bibliotecă" />
            <Button variant="text" arrow title="Tur ghidat" />
          </>
        }
      />
      <Hero
        testID="g-hero-photo"
        kind="page"
        image={PHOTO}
        kicker="Biblioteca"
        badge="Beta"
        title={['Tradiția creștină,', 'în limba ta.']}
        sub="Cărți creștine vechi, în română și în engleză, cu originalul alături."
        actions={<Button variant="primary" title="Începe lectura" />}
        links={<Button variant="text" arrow title="Despre bibliotecă" />}
      />
      <Band tone="background" testID="g-controls">
        <Controls />
        <TabsSection />
        <Section title="Disclosure">
          <Disclosure summary="Metodologie" testID="g-disclosure">
            Textul a fost tradus în trei treceri, cu un critic independent.
          </Disclosure>
        </Section>
        <Layers />
        <Icons />
      </Band>
      <Bands />
      <TypeScale />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1 },
  section: { gap: 12, paddingBottom: 24 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rowCenter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  narrow: { width: 280 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  icon: { width: 96, alignItems: 'center', gap: 4 },
  band: { gap: 12 },
});
