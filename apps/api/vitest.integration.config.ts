import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    // Banco real e, em desenvolvimento, com o catálogo inteiro (24 mil produtos): uma busca com
    // tolerância a erro de digitação leva alguns segundos quando outros testes rodam em paralelo.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
