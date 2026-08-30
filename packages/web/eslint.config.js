// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Same privacy guarantee as the engine (see packages/engine/eslint.config.js):
      // even though packages/web is where price-provider fetches legitimately happen,
      // they must go through a reviewed PriceProvider implementation, not an ad hoc
      // fetch() next to transaction-handling code. Provider modules are explicitly
      // exempted (spec §2: tickers/dates only, never quantities/costs/account ids).
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Use a PriceProvider implementation (src/providers/) — never call fetch directly next to transaction data.' },
      ],
    },
  },
  {
    ignores: ['dist/**'],
  },
);
