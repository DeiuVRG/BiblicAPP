const preset = require('jest-expo/jest-preset');

// Pure-ESM dependencies (@noble/*) must go through the Babel transform in Jest.
const transformIgnorePatterns = preset.transformIgnorePatterns.map((pattern) =>
  pattern.includes('standard-navigation')
    ? pattern.replace('standard-navigation', 'standard-navigation|@noble')
    : pattern,
);

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
};
