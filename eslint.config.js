import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/playwright-report/**', '**/test-results/**', '.specify/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['shared/**/*.ts', 'server/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // XSS rule from the constitution: never inject raw HTML, copied beUI components included.
      'react/no-danger': 'error',
    },
  },
);
