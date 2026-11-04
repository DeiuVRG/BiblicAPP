import { GentiumPlus_400Regular } from '@expo-google-fonts/gentium-plus/400Regular';
import { GentiumPlus_400Regular_Italic } from '@expo-google-fonts/gentium-plus/400Regular_Italic';
import { IMFellGreatPrimer_400Regular } from '@expo-google-fonts/im-fell-great-primer/400Regular';
import { IMFellGreatPrimer_400Regular_Italic } from '@expo-google-fonts/im-fell-great-primer/400Regular_Italic';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_400Regular_Italic } from '@expo-google-fonts/literata/400Regular_Italic';
import { Literata_500Medium } from '@expo-google-fonts/literata/500Medium';
import { Literata_600SemiBold } from '@expo-google-fonts/literata/600SemiBold';
import { Literata_700Bold } from '@expo-google-fonts/literata/700Bold';
import { SourceSerif4_400Regular } from '@expo-google-fonts/source-serif-4/400Regular';
import { SourceSerif4_400Regular_Italic } from '@expo-google-fonts/source-serif-4/400Regular_Italic';
import { SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4/600SemiBold';
import { SourceSerif4_600SemiBold_Italic } from '@expo-google-fonts/source-serif-4/600SemiBold_Italic';

// The font files of the app, as the asset modules of the @expo-google-fonts packages (always the
// npm TTFs, never the hosted Google Fonts CSS: its `latin` slice of IM Fell Great Primer drops
// ă ș ț). Importing a module only registers the asset; the bytes are fetched when the font is
// loaded. docs/ui-spec-v2.md, section 2.2.

/**
 * The first-paint set (about 1.3 MB): the only fonts the first paint waits for. IM Fell Great
 * Primer 400 and 400 italic (the brand wordmark is `displayS` italic) and Source Serif 4 400, 400
 * italic and 600.
 */
export const FIRST_PAINT_FONTS = {
  IMFellGreatPrimer_400Regular,
  IMFellGreatPrimer_400Regular_Italic,
  SourceSerif4_400Regular,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_600SemiBold,
};

/** The fonts that load on demand, in groups: a group is loaded whole, once. */
export const FONT_GROUPS = {
  /** Source Serif 4 600 italic (bold italic emphasis). */
  serifSemiBoldItalic: { SourceSerif4_600SemiBold_Italic },
  /** The "Literata" reading option (the five files that were always bundled). */
  literata: {
    Literata_400Regular,
    Literata_400Regular_Italic,
    Literata_500Medium,
    Literata_600SemiBold,
    Literata_700Bold,
  },
  /** The "Sans" reading option. */
  inter: { Inter_400Regular, Inter_500Medium, Inter_600SemiBold },
  /** Polytonic Greek for a reading lane whose edition language is `grc` (Source Serif 4 has none). */
  gentium: { GentiumPlus_400Regular, GentiumPlus_400Regular_Italic },
} as const;

export type FontGroup = keyof typeof FONT_GROUPS;
