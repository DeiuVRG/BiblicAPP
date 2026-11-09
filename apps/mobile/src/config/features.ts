import { createContext, useContext } from 'react';

// Feature flags (docs/ui-spec-v2.md, section 4.2): a navigation item, a drawer entry and a link
// appear only when the screen behind them is live ("nothing dead", principle 4). Switch a flag on in
// the same change that makes its screen real; until then the route may exist (it shows the Coming
// state, `ComingScreen`) but nothing in the interface leads to it. The review build that shows every
// section with a "Curând" pill (`EXPO_PUBLIC_SHOW_ALL_SECTIONS`, 4.2) is P1b.
//
// A build can be made with the flags of Beta 1 already on (`EXPO_PUBLIC_FEATURES=beta1`): the
// browser checks of docs/ui-spec-v2.md, section 20, that need the five items of the section bar,
// the two doors and the transparency band (S1, S2, L2, L3, L7) run on such an export, so that the
// configuration the owner will ship is exercised before every flag is switched on (never a
// production build: the delivered flags are the ones below).

export interface Features {
  /** `/library` (Selecție) and `/library/all` (Toată biblioteca). */
  library: boolean;
  /** `/authors`: the plain list of authors. */
  authors: boolean;
  /** `/authors/[slug]`: the author page (P1b). Until then a name leads to the library filtered by it. */
  authorPages: boolean;
  /** `/search`. */
  search: boolean;
  /** `/ask`: the chat with citations (the Ask phase). */
  ask: boolean;
  /** `/bookmarks`. */
  bookmarks: boolean;
  /** `/about`. */
  about: boolean;
  /** `/about/transparency`. */
  transparency: boolean;
  /** `/traditions` (P2), `/guides` (P3), the dictionary (when a reference work exists). */
  traditions: boolean;
  guides: boolean;
  dictionary: boolean;
  /** P2 and later sections. */
  scripture: boolean;
  topics: boolean;
  resources: boolean;
  notebook: boolean;
  semantic: boolean;
  compare: boolean;
  connections: boolean;
  decks: boolean;
  disputed: boolean;
  lexicon: boolean;
  indexes: boolean;
  scans: boolean;
  desk: boolean;
  howTo: boolean;
  tour: boolean;
}

export type FeatureName = keyof Features;

/**
 * What is live in a delivered build. The shell phase delivers the library, the authors list and
 * search; the reader phase adds the policy page (`transparency`); the screens behind `ask`,
 * `bookmarks` and `about` come with their own phases, and each of those phases switches its flag
 * on. With all four on, the section bar of Beta 1 reads home, search, read, research, about, as
 * docs/ui-spec-v2.md 4.2 and check S1 expect.
 */
export const DELIVERED_FEATURES: Features = {
  library: true,
  authors: true,
  authorPages: false,
  search: true,
  ask: false,
  bookmarks: false,
  about: false,
  transparency: true,
  traditions: false,
  guides: false,
  dictionary: false,
  scripture: false,
  topics: false,
  resources: false,
  notebook: false,
  semantic: false,
  compare: false,
  connections: false,
  decks: false,
  disputed: false,
  lexicon: false,
  indexes: false,
  scans: false,
  desk: false,
  howTo: false,
  tour: false,
};

/** The flags of Beta 1 (docs/ui-spec-v2.md): everything tagged P1 is live. */
export const BETA_1_FEATURES: Features = {
  ...DELIVERED_FEATURES,
  ask: true,
  bookmarks: true,
  about: true,
  transparency: true,
};

/**
 * The flags a build profile asks for: `beta1` gives those of Beta 1, anything else (and no
 * profile) the delivered ones. `EXPO_PUBLIC_FEATURES` is read by Metro at build time.
 */
export function featuresFor(profile: string | undefined): Features {
  return profile?.trim().toLowerCase() === 'beta1' ? BETA_1_FEATURES : DELIVERED_FEATURES;
}

/** The flags of this build. */
export const FEATURES: Features = featuresFor(process.env.EXPO_PUBLIC_FEATURES);

const FeaturesContext = createContext<Features>(FEATURES);

export const FeaturesProvider = FeaturesContext.Provider;

/** The flags of this build; tests and review builds provide their own through `FeaturesProvider`. */
export function useFeatures(): Features {
  return useContext(FeaturesContext);
}
