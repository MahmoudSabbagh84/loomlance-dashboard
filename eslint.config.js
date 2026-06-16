import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'supabase/.temp'],
  },

  js.configs.recommended,

  // Application + library source (browser runtime)
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs['recommended-latest'].rules,
      // We don't use prop-types — types are tracked elsewhere.
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Empty catch is an intentional idiom around storage access (private mode).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Test files — Vitest globals are enabled in vite.config.js (test.globals: true)
  {
    files: ['**/*.test.{js,jsx}', 'src/test-setup.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },

  // Node-context tooling files at the repo root (build-script.js, *.config.js)
  {
    files: ['*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]
