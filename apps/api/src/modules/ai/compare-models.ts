import type { CleanupSuggestion } from './name-cleanup';
import { escapeHtml, wordDiff } from './sample-report';

// Compara o que dois modelos sugeriram para os MESMOS produtos: onde concordam, onde divergem (nome ou
// franquia) e o que cada um fez de arriscado. Quem decide é uma pessoa lendo as divergências.

export type CompareRow = {
  id: string;
  original: string;
  a: CleanupSuggestion | null;
  b: CleanupSuggestion | null;
  /** O que diverge entre os dois (vazio = concordam). */
  differs: ('name' | 'franchise' | 'only_a' | 'only_b')[];
};

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const franchiseKey = (row: CleanupSuggestion | null): string => {
  if (!row?.franchise) return '';
  return row.franchise.kind === 'existing' ? row.franchise.slug : fold(row.franchise.name);
};

export function compareResults(
  originals: ReadonlyMap<string, string>,
  a: readonly CleanupSuggestion[],
  b: readonly CleanupSuggestion[]
): CompareRow[] {
  const byA = new Map(a.map((row) => [row.id, row]));
  const byB = new Map(b.map((row) => [row.id, row]));
  const ids = [...new Set([...byA.keys(), ...byB.keys()])];
  return ids.map((id) => {
    const rowA = byA.get(id) ?? null;
    const rowB = byB.get(id) ?? null;
    const differs: CompareRow['differs'] = [];
    if (!rowA) differs.push('only_b');
    else if (!rowB) differs.push('only_a');
    else {
      // Diferença só de caixa, acento ou pontuação não conta: é o mesmo nome.
      if (fold(rowA.name) !== fold(rowB.name)) differs.push('name');
      if (franchiseKey(rowA) !== franchiseKey(rowB)) differs.push('franchise');
    }
    return { id, original: originals.get(id) ?? '', a: rowA, b: rowB, differs };
  });
}

export type CompareStats = {
  total: number;
  both: number;
  agree: number;
  nameDiffers: number;
  franchiseDiffers: number;
  onlyA: number;
  onlyB: number;
};

export function summarize(rows: readonly CompareRow[]): CompareStats {
  const both = rows.filter((row) => row.a && row.b);
  return {
    total: rows.length,
    both: both.length,
    agree: both.filter((row) => row.differs.length === 0).length,
    nameDiffers: both.filter((row) => row.differs.includes('name')).length,
    franchiseDiffers: both.filter((row) => row.differs.includes('franchise')).length,
    onlyA: rows.filter((row) => !row.b).length,
    onlyB: rows.filter((row) => !row.a).length,
  };
}

/** Junta os dois conjuntos: a preferência vale nas divergências, e o que só um modelo fez entra como está. */
export function mergeResults(
  rows: readonly CompareRow[],
  prefer: 'a' | 'b',
  overrides: Readonly<Record<string, 'a' | 'b'>> = {}
): CleanupSuggestion[] {
  return rows.flatMap((row) => {
    const choice = overrides[row.id] ?? prefer;
    const picked = choice === 'a' ? (row.a ?? row.b) : (row.b ?? row.a);
    return picked ? [picked] : [];
  });
}

const franchiseText = (row: CleanupSuggestion | null): string => {
  if (!row?.franchise) return '—';
  return row.franchise.kind === 'existing' ? row.franchise.slug : `NOVA: ${row.franchise.name}`;
};

const cell = (original: string, row: CleanupSuggestion | null): string => {
  if (!row) return '<em>sem resposta</em>';
  const diff = wordDiff(original, row.name)
    .map((piece) =>
      piece.kind === 'same'
        ? escapeHtml(piece.text)
        : `<${piece.kind === 'added' ? 'ins' : 'del'}>${escapeHtml(piece.text)}</${piece.kind === 'added' ? 'ins' : 'del'}>`
    )
    .join(' ');
  return `<div class="name">${diff}</div><div class="meta">${escapeHtml(franchiseText(row))} · ${row.confidence}${row.removed_codes.length ? ` · tirou ${escapeHtml(row.removed_codes.join(', '))}` : ''}</div>`;
};

export function renderComparison(
  rows: readonly CompareRow[],
  labels: { a: string; b: string },
  stats: CompareStats
): string {
  const items = rows
    .filter((row) => row.differs.length > 0)
    .map(
      (
        row
      ) => `<article class="row ${row.differs.join(' ')}" data-text="${escapeHtml(`${row.original} ${row.a?.name ?? ''} ${row.b?.name ?? ''}`.toLowerCase())}">
  <p class="orig">${escapeHtml(row.original)}</p>
  <div class="cols"><section><h3>${escapeHtml(labels.a)}</h3>${cell(row.original, row.a)}</section><section><h3>${escapeHtml(labels.b)}</h3>${cell(row.original, row.b)}</section></div>
</article>`
    )
    .join('\n');
  const pct = stats.both ? Math.round((stats.agree / stats.both) * 100) : 0;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comparação de modelos</title>
<style>:root{--bg:#f4f3ef;--card:#fff;--ink:#151518;--muted:#606068;--line:#deddd6;--g:#1f7a4d;--r:#b3261e;--y:#f6c344}@media(prefers-color-scheme:dark){:root{--bg:#18181d;--card:#23232a;--ink:#f8f7f2;--muted:#b1b0b9;--line:#42424c;--g:#58c98c;--r:#ff8a80}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:24px 16px 80px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}.c{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.c b{display:block;font-size:1.5rem}.c span{color:var(--muted);font-size:.85rem}
input{width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font-size:1rem}.chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.chips button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 14px;font-weight:700;cursor:pointer}.chips button[aria-pressed=true]{background:var(--y);color:#151518;border-color:var(--y)}
.row{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0}.orig{margin:0 0 8px;color:var(--muted);font-size:.9rem}.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.cols{grid-template-columns:1fr}}
h3{margin:0 0 4px;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.name{font-weight:600}.meta{font-size:.85rem;color:var(--muted)}ins{color:var(--g);text-decoration:none;background:color-mix(in srgb,var(--g) 14%,transparent);border-radius:4px;padding:0 3px}del{color:var(--r);background:color-mix(in srgb,var(--r) 14%,transparent);border-radius:4px;padding:0 3px}</style></head>
<body><main><h1>Comparação: ${escapeHtml(labels.a)} × ${escapeHtml(labels.b)}</h1>
<div class="cards"><div class="c"><b>${stats.total}</b><span>produtos</span></div><div class="c"><b>${pct}%</b><span>concordam em tudo (${stats.agree} de ${stats.both})</span></div><div class="c"><b>${stats.nameDiffers}</b><span>nomes diferentes</span></div><div class="c"><b>${stats.franchiseDiffers}</b><span>franquias diferentes</span></div><div class="c"><b>${stats.onlyA + stats.onlyB}</b><span>só um respondeu</span></div></div>
<p>Só aparecem os produtos em que os dois divergem. <del>Vermelho</del> = o que o modelo tirou do nome original; <ins>verde</ins> = o que acrescentou ou corrigiu.</p>
<input type="search" id="q" placeholder="Buscar…" aria-label="Buscar">
<div class="chips" id="chips"><button type="button" data-f="all" aria-pressed="true">Todas</button><button type="button" data-f="name" aria-pressed="false">Nome</button><button type="button" data-f="franchise" aria-pressed="false">Franquia</button><button type="button" data-f="only_a" aria-pressed="false">Só ${escapeHtml(labels.a)}</button><button type="button" data-f="only_b" aria-pressed="false">Só ${escapeHtml(labels.b)}</button></div>
<div id="list">${items}</div></main>
<script>(function(){var f='all',q='',els=[].slice.call(document.querySelectorAll('.row'));function go(){els.forEach(function(e){var ok=(f==='all'||e.classList.contains(f))&&(!q||e.getAttribute('data-text').indexOf(q)>-1);e.style.display=ok?'':'none'})}
document.getElementById('q').addEventListener('input',function(e){q=e.target.value.toLowerCase().trim();go()});document.getElementById('chips').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;f=b.getAttribute('data-f');[].forEach.call(this.children,function(c){c.setAttribute('aria-pressed',String(c===b))});go()})})();</script></body></html>
`;
}
