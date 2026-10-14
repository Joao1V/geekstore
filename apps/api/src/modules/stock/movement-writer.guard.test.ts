import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const WRITER = ['modules', 'stock', 'movement-writer.ts'].join(sep);
const WRITE_CALL = /stockMovement\s*\.\s*(create|createMany|upsert|update|updateMany)\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

describe('movement-writer', () => {
  it('é o único código que grava stock_movement (com saldo resultante)', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => relative(SRC, file) !== WRITER)
      .filter((file) => WRITE_CALL.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file).split(sep).join('/'));

    expect(offenders).toEqual([]);
  });
});
