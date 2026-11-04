import expoConfig from 'eslint-config-expo/flat.js';
import prettier from 'eslint-config-prettier';

import { ignores } from '../../eslint.config.base.mjs';

export default [
  ignores,
  ...expoConfig,
  prettier,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
