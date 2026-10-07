// Compara dois conjuntos de sugestões (por padrão claude × gpt) dos MESMOS produtos e gera
// .temp/ia-comparacao.html só com as divergências. Depois de decidir, ai:compare --merge junta tudo em
// ia-resultados.jsonl (o arquivo que o ai:apply lê).
//
//   pnpm --filter api ai:import --source claude      (respostas em .temp/ia-web/respostas/claude/)
//   pnpm --filter api ai:import --source gpt         (respostas em .temp/ia-web/respostas/gpt/)
//   pnpm --filter api ai:compare
//   pnpm --filter api ai:compare --merge --prefer claude [--overrides ../../.temp/ia-escolhas.json]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  type CompareRow,
  compareResults,
  mergeResults,
  renderComparison,
  summarize,
} from '../modules/ai/compare-models';
import type { CleanupInput, CleanupSuggestion } from '../modules/ai/name-cleanup';

const readJsonl = (path: string): CleanupSuggestion[] =>
  existsSync(path)
    ? readFileSync(path, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as CleanupSuggestion)
    : [];

function loadOriginals(webDir: string): Map<string, string> {
  const originals = new Map<string, string>();
  for (const file of readdirSync(webDir).filter((name) => name.endsWith('.map.json'))) {
    for (const item of JSON.parse(readFileSync(resolve(webDir, file), 'utf8')) as CleanupInput[]) {
      originals.set(item.id, item.name);
    }
  }
  return originals;
}

function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: '../../.temp' },
      a: { type: 'string', default: 'claude' },
      b: { type: 'string', default: 'gpt' },
      merge: { type: 'boolean', default: false },
      prefer: { type: 'string' },
      overrides: { type: 'string' },
    },
  });
  const root = resolve(values.out ?? '../../.temp');
  const labelA = values.a ?? 'claude';
  const labelB = values.b ?? 'gpt';
  const resultsA = readJsonl(resolve(root, `ia-resultados-${labelA}.jsonl`));
  const resultsB = readJsonl(resolve(root, `ia-resultados-${labelB}.jsonl`));
  const rows = compareResults(loadOriginals(resolve(root, 'ia-web')), resultsA, resultsB);
  const stats = summarize(rows);

  if (values.merge) {
    if (values.prefer !== labelA && values.prefer !== labelB) {
      throw new Error(`Informe --prefer ${labelA} ou --prefer ${labelB}.`);
    }
    const picks = values.overrides
      ? (JSON.parse(readFileSync(resolve(values.overrides), 'utf8')) as Record<string, string>)
      : {};
    const overrides = Object.fromEntries(
      Object.entries(picks).map(([id, who]) => [id, who === labelA ? 'a' : 'b'])
    ) as Record<string, 'a' | 'b'>;
    const merged = mergeResults(
      rows as CompareRow[],
      values.prefer === labelA ? 'a' : 'b',
      overrides
    );
    writeFileSync(
      resolve(root, 'ia-resultados.jsonl'),
      merged.map((row) => `${JSON.stringify(row)}\n`).join('')
    );
    console.log(
      `Juntado: ${merged.length} sugestões em ia-resultados.jsonl (preferência: ${values.prefer}).`
    );
    return;
  }

  writeFileSync(
    resolve(root, 'ia-comparacao.html'),
    renderComparison(rows, { a: labelA, b: labelB }, stats)
  );
  console.log(
    `${labelA}: ${resultsA.length} · ${labelB}: ${resultsB.length} · nos dois: ${stats.both}. ` +
      `Concordam em tudo: ${stats.agree}. Nome diferente: ${stats.nameDiffers}. ` +
      `Franquia diferente: ${stats.franchiseDiffers}. Só um respondeu: ${stats.onlyA + stats.onlyB}.`
  );
  console.log(`Página: ${resolve(root, 'ia-comparacao.html')}`);
}

main();
