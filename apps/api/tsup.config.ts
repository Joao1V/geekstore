import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  clean: true,
  sourcemap: false,
  minify: true,
  dts: false,
  // @geekstore/shared não tem build próprio (TS puro, import sem extensão em
  // src/index.ts) — em runtime puro (node, sem tsx) isso não resolve. Empacotar
  // direto no bundle resolve; @geekstore/db fica externo de propósito (client
  // do Prisma gerado, binding nativo, não dá pra empacotar num arquivo só).
  noExternal: ['@geekstore/shared'],
});
