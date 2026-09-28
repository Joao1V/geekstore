import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testes de integração precisam de um DATABASE_URL real (MySQL local ou de CI) e rodam
    // à parte via `vitest run --config vitest.integration.config.ts` — ver README/backlog.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
  },
});
