/**
 * Hermes ships no `crypto.getRandomValues`. Everything the app imports at startup from
 * `@biblioteca/shared` must therefore load without it (the id generator lives in the
 * `@biblioteca/shared/ids` subpath, which only tooling imports).
 */
describe('shared package without crypto', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'crypto', original);
    else delete (globalThis as { crypto?: unknown }).crypto;
  });

  it('imports the package index and the verifier when globalThis.crypto is missing', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    jest.isolateModules(() => {
      const shared = jest.requireActual('@biblioteca/shared') as Record<string, unknown>;
      expect(typeof shared.canonicalJson).toBe('function');
      expect('stableId' in shared).toBe(false);
      expect(() => jest.requireActual('../content/verify-pack')).not.toThrow();
    });
  });
});
