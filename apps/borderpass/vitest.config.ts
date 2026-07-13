import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // `@` → ./src so co-located domain tests (e.g. `@/domain/...`) resolve like the app does.
  // `server-only` → empty stub so server modules (which import it as an RSC guard) are unit-testable.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    // Run BOTH the standalone unit suite and co-located source tests (payment state machine, etc.).
    include: ['tests/unit/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
