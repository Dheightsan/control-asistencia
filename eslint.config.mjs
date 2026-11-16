import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/.pgdata*/**', '**/test-results/**', '**/playwright-report/**', 'web/next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: { globals: { module: 'readonly', process: 'readonly', console: 'readonly', setTimeout: 'readonly', URL: 'readonly' } },
  },
);
