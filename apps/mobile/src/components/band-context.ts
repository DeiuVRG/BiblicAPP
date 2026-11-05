import { createContext, useContext } from 'react';

/**
 * The background of the band a component sits in. Text, links and the focus ring on a `masthead`
 * band use the dark-band inks (`mastheadInk`, `mastheadAccent`), never `accentStrong`
 * (docs/ui-spec-v2.md, section 2.1, rule 5); the components read the tone from here, so a caller
 * never has to say which colour to use. `photo` is a dark band whose background is a photograph
 * under its scrim (a hero with a picture): everything is as on `masthead`, except that the orange
 * accent ink becomes `mastheadInk`, because the orange reaches only 2.1:1 (light) to 4.0:1 (dark)
 * against a white pixel under the scrim and the rule for text over a photograph is 4.5:1 (rule 3
 * of 2.1, check G5).
 */
export type BandTone = 'background' | 'cream' | 'warm' | 'masthead' | 'photo';

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

/** True for the bands that are dark in every theme: the masthead, and a photograph under a scrim. */
export function isDarkBand(tone: BandTone): boolean {
  return tone === 'masthead' || tone === 'photo';
}

/** True for a band that is a photograph: the accent ink there is `mastheadInk`. */
export function isPhotoBand(tone: BandTone): boolean {
  return tone === 'photo';
}
