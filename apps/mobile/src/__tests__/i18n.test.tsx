import { act, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Platform, Text } from 'react-native';

import { I18nProvider, stringsFor, useT, useUiLanguage } from '@/i18n';
import type { Strings } from '@/i18n';
import { en } from '@/i18n/en';
import { baseLanguage, languageFromLocale, resolveUiLanguage } from '@/i18n/language';
import { ro } from '@/i18n/ro';
import { SettingsProvider, useSettings } from '@/settings/settings-context';
import { StorageProvider } from '@/storage/key-value-store';
import { createMemoryStore } from '@/test-support/render';
import { SETTINGS_KEY } from '@/settings/settings-store';

type Tree = { [key: string]: unknown };

/** Every path in a string table, with what is at the end of it: a string or a function. */
function shape(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = `${prefix}${key}`;
    if (typeof value === 'string') return [`${path}: string`];
    if (typeof value === 'function') return [`${path}: function(${value.length})`];
    return shape(value as Tree, `${path}.`);
  });
}

/** Every string a table can produce, calling its functions with sample numbers and with a title. */
function texts(tree: Tree): string[] {
  return Object.values(tree).flatMap((value) => {
    if (typeof value === 'string') return [value];
    if (typeof value === 'function') {
      const call = value as (...args: unknown[]) => unknown;
      const results: string[] = [];
      for (const args of [
        [1, 1, 1],
        [2, 11, 100],
        ['Titlu', 'Titlu', 'Titlu'],
      ]) {
        try {
          const result = call(...args);
          if (typeof result === 'string') results.push(result);
        } catch {
          // A function that takes numbers is not called with a title, and the other way round.
        }
      }
      return results;
    }
    return texts(value as Tree);
  });
}

describe('string tables', () => {
  it('give English every key of Romanian, with the same kind of value and the same arguments', () => {
    expect(shape(en as unknown as Tree)).toEqual(shape(ro as unknown as Tree));
    expect(shape(ro as unknown as Tree).length).toBeGreaterThan(100);
  });

  it('fail to type-check when a key is missing (checked by tsc, not at run time)', () => {
    const incomplete: Strings = {
      ...en,
      // @ts-expect-error -- `backToLibrary` is a key of ro.ts that this table lacks
      common: { loading: 'x', error: 'x', back: 'x' },
    };
    expect(incomplete.common.back).toBe('x');
  });

  it('write no string empty', () => {
    for (const table of [ro, en]) {
      expect(texts(table as unknown as Tree).filter((text) => text.trim() === '')).toEqual([]);
    }
  });

  it('write Romanian with comma-below diacritics, never the cedilla forms', () => {
    const cedilla = /[ŞşŢţ]/;
    expect(texts(ro as unknown as Tree).filter((text) => cedilla.test(text))).toEqual([]);
    expect(texts(en as unknown as Tree).filter((text) => cedilla.test(text))).toEqual([]);
  });

  it('keep Romanian out of the English table, except the names of the two languages', () => {
    const romanian = /[ăâîșțĂÂÎȘȚ]/;
    const found = shape(en as unknown as Tree)
      .map((entry) => entry.split(':')[0]!)
      .filter((path) => {
        const value = path.split('.').reduce<unknown>((node, key) => (node as Tree)[key], en);
        return typeof value === 'string' && romanian.test(value);
      });
    // "Română" is how Romanian writes its own name, in every interface language.
    expect(found.sort()).toEqual(['readingLanguages.ro', 'settings.uiLanguages.ro']);
  });

  it('say different things in the two languages for the words a reader sees', () => {
    expect(ro.library.title).toBe('Biblioteca');
    expect(en.library.title).toBe('Library');
    expect(ro.work.startReading).toBe('Începe lectura');
    expect(en.work.startReading).toBe('Start reading');
    expect(ro.work.partial).toBe('Traducere parțială');
    expect(en.work.partial).toBe('Partial translation');
    // The app is called the same in both.
    expect(en.appName).toBe(ro.appName);
  });

  it('are picked by the interface language', () => {
    expect(stringsFor('ro')).toBe(ro);
    expect(stringsFor('en')).toBe(en);
  });
});

describe('languages of the device', () => {
  it('maps a locale onto Romanian or English', () => {
    expect(languageFromLocale('ro')).toBe('ro');
    expect(languageFromLocale('ro-RO')).toBe('ro');
    expect(languageFromLocale('ro_MD')).toBe('ro');
    expect(languageFromLocale('RO-ro')).toBe('ro');
    expect(languageFromLocale('en-US')).toBe('en');
    expect(languageFromLocale('de-DE')).toBe('en');
    expect(languageFromLocale('hu-RO')).toBe('en'); // the language counts, not the country
  });

  it('is English when the locale is not known: only a Romanian device gets Romanian', () => {
    // The rule is "ro when the device is Romanian, else en" (docs/multi-edition-spec.md).
    expect(languageFromLocale(undefined)).toBe('en');
    expect(languageFromLocale(null)).toBe('en');
    expect(languageFromLocale('')).toBe('en');
    expect(languageFromLocale('   ')).toBe('en');
  });

  it('takes the language subtag of a code', () => {
    expect(baseLanguage('en-GB')).toBe('en');
    expect(baseLanguage('PT_br')).toBe('pt');
    expect(baseLanguage('grc')).toBe('grc');
    expect(baseLanguage('')).toBe('');
  });

  it('resolves "system" to the language of the device and keeps a chosen language', () => {
    expect(resolveUiLanguage('system', 'ro-RO')).toBe('ro');
    expect(resolveUiLanguage('system', 'en-GB')).toBe('en');
    expect(resolveUiLanguage('system', undefined)).toBe('en');
    expect(resolveUiLanguage('system', '')).toBe('en');
    expect(resolveUiLanguage('en', 'ro-RO')).toBe('en');
    expect(resolveUiLanguage('ro', 'en-GB')).toBe('ro');
  });
});

describe('getDeviceLocale', () => {
  const { getDeviceLocale } =
    jest.requireActual<typeof import('@/i18n/device-locale')>('@/i18n/device-locale');
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const setNavigator = (value: unknown) =>
    Object.defineProperty(globalThis, 'navigator', { value, configurable: true });

  afterEach(() => {
    jest.restoreAllMocks();
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete (globalThis as { navigator?: unknown }).navigator;
  });

  const intl = (locale: string | (() => never)) =>
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => {
            if (typeof locale === 'function') return locale();
            return { locale };
          },
        }) as unknown as Intl.DateTimeFormat,
    );

  it('asks Intl on iOS and Android', () => {
    intl('ro-RO');
    // Not the browser's: a phone has no navigator.language.
    setNavigator({ language: 'de-DE' });
    expect(Platform.OS).not.toBe('web');
    expect(getDeviceLocale()).toBe('ro-RO');
  });

  it('asks the browser on web', () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      intl('en-US');
      setNavigator({ language: 'ro-RO' });
      expect(getDeviceLocale()).toBe('ro-RO');
    } finally {
      replaced.restore();
    }
  });

  it('falls back to Intl on web when the browser says nothing', () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      intl('en-GB');
      setNavigator({});
      expect(getDeviceLocale()).toBe('en-GB');
      setNavigator(undefined);
      expect(getDeviceLocale()).toBe('en-GB');
    } finally {
      replaced.restore();
    }
  });

  it('is undefined when nothing can be read, and never throws', () => {
    intl(() => {
      throw new RangeError('Intl is not available');
    });
    expect(getDeviceLocale()).toBeUndefined();
    jest.restoreAllMocks();
    intl('');
    expect(getDeviceLocale()).toBeUndefined();
    jest.restoreAllMocks();
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl');
    });
    expect(getDeviceLocale()).toBeUndefined();
  });
});

describe('I18nProvider', () => {
  const sink: { update?: ReturnType<typeof useSettings>['update'] } = {};

  function Probe() {
    const t = useT();
    const language = useUiLanguage();
    const { update } = useSettings();
    useEffect(() => {
      sink.update = update;
    });
    return (
      <>
        <Text testID="title">{t.library.title}</Text>
        <Text testID="language">{language}</Text>
      </>
    );
  }

  const mount = (deviceLocale: string | undefined, stored?: object) =>
    render(
      <StorageProvider
        store={createMemoryStore(stored ? { [SETTINGS_KEY]: JSON.stringify(stored) } : {})}
      >
        <SettingsProvider>
          <I18nProvider deviceLocale={deviceLocale}>
            <Probe />
          </I18nProvider>
        </SettingsProvider>
      </StorageProvider>,
    );

  it('follows the device while the setting is "system"', async () => {
    await mount('en-GB');
    expect(screen.getByTestId('language')).toHaveTextContent('en');
    expect(screen.getByTestId('title')).toHaveTextContent('Library');
  });

  it('is Romanian on a Romanian device and English on one that cannot say what it is', async () => {
    const first = await mount('ro-RO');
    expect(screen.getByTestId('title')).toHaveTextContent('Biblioteca');
    await first.unmount();
    // An empty locale is an unreadable one (`getDeviceLocale` itself returns undefined for it).
    const second = await mount('');
    expect(screen.getByTestId('language')).toHaveTextContent('en');
    expect(screen.getByTestId('title')).toHaveTextContent('Library');
    await second.unmount();
    // No locale given at all: the provider asks the device, which the tests pin to Romanian.
    await mount(undefined);
    expect(screen.getByTestId('language')).toHaveTextContent('ro');
  });

  it('re-renders what reads the strings when the language changes', async () => {
    await mount('ro-RO', { uiLanguage: 'ro' });
    await screen.findByText('Biblioteca');
    await act(async () => {
      sink.update?.({ uiLanguage: 'en' });
    });
    expect(screen.getByTestId('title')).toHaveTextContent('Library');
    expect(screen.getByTestId('language')).toHaveTextContent('en');
    await act(async () => {
      sink.update?.({ uiLanguage: 'system' });
    });
    // "System" is the device again: Romanian.
    expect(screen.getByTestId('title')).toHaveTextContent('Biblioteca');
  });

  it('lets a chosen language win over the device', async () => {
    await mount('en-US', { uiLanguage: 'ro' });
    await screen.findByText('Biblioteca');
    expect(screen.getByTestId('language')).toHaveTextContent('ro');
  });

  it('serves Romanian to components rendered outside a provider', async () => {
    await render(<Probe />);
    expect(screen.getByTestId('title')).toHaveTextContent('Biblioteca');
  });
});
