/* global jest */
// AsyncStorage has no native module under Jest: use the official in-memory mock everywhere.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The tests run as on a Romanian device, whatever the locale of the machine that runs them: the
// reading language and the interface language default from the device locale, and the existing
// expectations are written in Romanian. A test that needs another device passes its own locale.
jest.mock('./src/i18n/device-locale', () => ({ getDeviceLocale: () => 'ro-RO' }));
