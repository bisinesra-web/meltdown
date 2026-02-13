import config from 'eslint-config-xo'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import react from 'eslint-plugin-react'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config'
import pluginRouter from '@tanstack/eslint-plugin-router'
import globals from 'globals'

export default defineConfig([
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', 'eslint.config.js'],
    extends: [config,
      eslintPluginUnicorn.configs.recommended,
      stylistic.configs.recommended,
      react.configs.flat.recommended,

      pluginRouter.configs['flat/recommended']],

    rules: {
      '@stylistic/max-len': ['error', {
        code: 100, ignoreComments: true, ignoreStrings: true, ignoreTemplateLiterals: true,
      }],
      'func-name-matching': ['off'],
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
  },
])
