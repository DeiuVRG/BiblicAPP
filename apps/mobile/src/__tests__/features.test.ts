import { BETA_1_FEATURES, DELIVERED_FEATURES, FEATURES, featuresFor } from '@/config/features';
import { liveSections } from '@/shell/sections';

describe('the feature flags of a build', () => {
  it('deliver the library, the authors list, search and the policy page, and not yet the screens of later phases', () => {
    expect(DELIVERED_FEATURES).toMatchObject({
      library: true,
      authors: true,
      search: true,
      ask: false,
      bookmarks: false,
      about: false,
      transparency: true,
    });
  });

  it('are the delivered ones without a profile, and for a profile that is not known', () => {
    expect(featuresFor(undefined)).toBe(DELIVERED_FEATURES);
    expect(featuresFor('')).toBe(DELIVERED_FEATURES);
    expect(featuresFor('everything')).toBe(DELIVERED_FEATURES);
    // The build under test has no profile: a delivered build never carries the Beta 1 flags.
    expect(FEATURES).toBe(DELIVERED_FEATURES);
  });

  it('are those of Beta 1 for the profile `beta1`, and nothing else changes', () => {
    expect(featuresFor('beta1')).toBe(BETA_1_FEATURES);
    expect(featuresFor(' Beta1 ')).toBe(BETA_1_FEATURES);
    const changed = Object.keys(BETA_1_FEATURES).filter(
      (name) =>
        BETA_1_FEATURES[name as keyof typeof BETA_1_FEATURES] !==
        DELIVERED_FEATURES[name as keyof typeof DELIVERED_FEATURES],
    );
    expect(changed.sort()).toEqual(['about', 'ask', 'bookmarks']);
  });

  it('give the section bar of Beta 1 its five items, and the delivered build its four', () => {
    expect(liveSections(BETA_1_FEATURES).map((section) => section.key)).toEqual([
      'home',
      'search',
      'read',
      'research',
      'about',
    ]);
    // "Despre" is there for the policy page alone until the About page comes.
    expect(liveSections(DELIVERED_FEATURES).map((section) => section.key)).toEqual([
      'home',
      'search',
      'read',
      'about',
    ]);
  });
});
