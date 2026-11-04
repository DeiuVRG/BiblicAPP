// Shared flat ESLint config. Packages extend it:
//   import base from '../../eslint.config.base.mjs';
//   export default [...base];
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const ignores = {
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.expo/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/android/**',
    '**/ios/**',
    '**/expo-env.d.ts',
  ],
};

export default [
  ignores,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },
  prettier,
];
