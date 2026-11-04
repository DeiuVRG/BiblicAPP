import { createContext, useContext } from 'react';

/**
 * The background of the band a component sits in. Text, links and the focus ring on a `masthead`
 * band use the dark-band inks (`mastheadInk`, `mastheadAccent`), never `accentStrong`
 * (docs/ui-spec-v2.md, section 2.1, rule 5); the components read the tone from here, so a caller
 * never has to say which colour to use.
 */
export type BandTone = 'background' | 'cream' | 'warm' | 'masthead';

const BandContext = createContext<BandTone>('background');

export const BandProvider = BandContext.Provider;

export function useBandTone(): BandTone {
  return useContext(BandContext);
}

/**
 * The colour of the plain links on a dark band: `mastheadAccent` by default (5.67:1 on the band), or
 * `mastheadInk` where the band is a picture under a scrim (the links of a hero, 12.61:1: the
 * orange has no contrast to spare over a bright pixel of a photograph).
 */
export type LinkTone = 'accent' | 'ink';

const LinkToneContext = createContext<LinkTone>('accent');

export const LinkToneProvider = LinkToneContext.Provider;

export function useLinkTone(): LinkTone {
  return useContext(LinkToneContext);
}

/** True for the bands that are dark in every theme. */
export function isDarkBand(tone: BandTone): boolean {
  return tone === 'masthead';
}
