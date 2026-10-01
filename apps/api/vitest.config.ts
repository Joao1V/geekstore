import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testes de integração precisam de um DATABASE_URL real (PostgreSQL local ou de CI) e rodam
    // à parte via `vitest run --config vitest.integration.config.ts` — ver README/backlog.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    // Os unitários são herméticos: `envConfig` valida o schema inteiro, e `pnpm test` passa pelo
    // Turbo, que não repassa segredos do ambiente (modo estrito). Valores fictícios aqui evitam
    // depender do `.env` de quem roda, que escondia isso localmente e quebrava no CI.
    env: {
      DATABASE_URL: 'postgresql://unit:unit@localhost:5432/unit',
      JWT_ACCESS_SECRET: 'unit-test-jwt-secret-with-at-least-32-chars',
      COOKIE_SECRET: 'unit-test-cookie-secret-with-at-least-32-chars',
    },
  },
});
