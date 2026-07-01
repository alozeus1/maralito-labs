// Shared ESLint preset for Maralito apps/packages (flat config).
import tseslint from 'typescript-eslint';

export const base = tseslint.config(
  { ignores: ['**/.next/**', '**/dist/**', '**/node_modules/**', '**/.turbo/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-imports': [
        'error',
        {
          // Contract-only boundary: apps must not deep-import platform internals.
          patterns: ['**/platform/**/internal/**', '**/automation/**/internal/**'],
        },
      ],
    },
  },
);

export default base;
