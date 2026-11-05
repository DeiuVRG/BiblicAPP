import { createContext, useContext } from 'react';

// Feature flags (docs/ui-spec-v2.md, section 4.2): a navigation item, a drawer entry and a link
// appear only when the screen behind them is live ("nothing dead", principle 4). Switch a flag on in
// the same change that makes its screen real; until then the route may exist (it shows the Coming
// state, `ComingScreen`) but nothing in the interface leads to it. The review build that shows every
// section with a "Curând" pill (`EXPO_PUBLIC_SHOW_ALL_SECTIONS`, 4.2) is P1b.

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
 * What is live in this build. The shell phase delivers the library, the authors list and search;
 * the screens behind `ask`, `bookmarks`, `about` and `transparency` come with their own phases, and
 * each of those phases switches its flag on. With all four on, the section bar of Beta 1 reads
 * home, search, read, research, about, as docs/ui-spec-v2.md 4.2 and check S1 expect.
 */
export const FEATURES: Features = {
  library: true,
  authors: true,
  authorPages: false,
  search: true,
  ask: false,
  bookmarks: false,
  about: false,
  transparency: false,
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
  ...FEATURES,
  ask: true,
  bookmarks: true,
  about: true,
  transparency: true,
};

const FeaturesContext = createContext<Features>(FEATURES);

export const FeaturesProvider = FeaturesContext.Provider;

/** The flags of this build; tests and review builds provide their own through `FeaturesProvider`. */
export function useFeatures(): Features {
  return useContext(FeaturesContext);
}
