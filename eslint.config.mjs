// Root ESLint flat config (base). App/packages extend via packages/config.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/.next/**', '**/dist/**', '**/node_modules/**', '**/.turbo/**', 'spike/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Tenant-facing app code must not import the raw DB client — use the wrappers.
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@maralito/db',
              importNames: ['createRawDbClient', 'createDbClient', 'getDb'],
              message:
                'Use withTenant() / withPrivilegedDbAccess() — never the raw DB client in app code.',
            },
          ],
        },
      ],
    },
  },
);
