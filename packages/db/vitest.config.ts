import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // PGlite boots a PostgreSQL runtime per test file. Running those boots in
    // parallel causes resource contention and false hook timeouts in CI.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
