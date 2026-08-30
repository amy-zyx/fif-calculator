// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The privacy guarantee (PRIVACY.md, spec §2 "Hard rules") depends on the engine
      // never reaching the network directly. Enforced here AND by a filesystem-scan
      // unit test (no-fetch.test.ts) so it survives even if lint is skipped locally.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Engine code must never call fetch — see PRIVACY.md.' },
      ],
    },
  },
  {
    ignores: ['dist/**'],
  },
);
