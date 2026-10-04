// Regera a página HTML (ia-amostra.html) a partir do ia-amostra.json já gravado, sem chamar a IA.
//   pnpm --filter api ai:report --out ../../.temp
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { type ReportRow, renderReport } from '../modules/ai/sample-report';

const { values } = parseArgs({ options: { out: { type: 'string', default: '../../.temp' } } });
const dir = resolve(values.out ?? '../../.temp');
const rows = JSON.parse(readFileSync(resolve(dir, 'ia-amostra.json'), 'utf8')) as ReportRow[];
writeFileSync(resolve(dir, 'ia-amostra.html'), renderReport(rows, new Date()));
console.log(`ia-amostra.html gerado em ${dir} (${rows.length} produtos).`);
