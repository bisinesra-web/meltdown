
import config from 'eslint-config-xo';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import react from 'eslint-plugin-react';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import pluginRouter from '@tanstack/eslint-plugin-router';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  {
    ignores: [
      '**/node_modules/**',
      '**/.yarn/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
    ],
  },
  {
    files: ['client/src/**/*.{ts,tsx}', 'server/**/*.ts'],
    extends: [
      config,
      eslintPluginUnicorn.configs.recommended,
      stylistic.configs.recommended,
      react.configs.flat.recommended,
      pluginRouter.configs['flat/recommended'],
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
    ],
    rules: {
      '@stylistic/max-len': [
        'error',
        {
          code: 100,
          ignoreComments: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
      'func-name-matching': ['off'],
      'react/react-in-jsx-scope': 0,
      'react/jsx-uses-react': 0
    },
    settings: {
      react: {
        version: '19.2',
      },
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
  },
]);
