// Página HTML para conferir as sugestões da IA: antes e depois do nome com a diferença destacada,
// franquia, confiança, busca e filtros. Um arquivo só, sem dependências: abre com duplo clique.

export type ReportRow = {
  category: string;
  current_name: string;
  suggested_name: string;
  franchise: string;
  confidence: 'high' | 'medium' | 'low';
};

const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string
  );

type Piece = { text: string; kind: 'same' | 'removed' | 'added' };

/** Diferença palavra a palavra (maior subsequência comum): o que saiu, o que entrou, o que ficou. */
export function wordDiff(before: string, after: string): Piece[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] =
        a[i] === b[j]
          ? (table[i + 1]![j + 1] ?? 0) + 1
          : Math.max(table[i + 1]![j] ?? 0, table[i]![j + 1] ?? 0);
    }
  }
  const pieces: Piece[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      pieces.push({ text: a[i] as string, kind: 'same' });
      i++;
      j++;
    } else if (
      j < b.length &&
      (i === a.length || (table[i]![j + 1] ?? 0) >= (table[i + 1]![j] ?? 0))
    ) {
      pieces.push({ text: b[j] as string, kind: 'added' });
      j++;
    } else {
      pieces.push({ text: a[i] as string, kind: 'removed' });
      i++;
    }
  }
  return pieces;
}

const diffHtml = (before: string, after: string): string =>
  wordDiff(before, after)
    .map((piece) =>
      piece.kind === 'same'
        ? escapeHtml(piece.text)
        : `<${piece.kind === 'added' ? 'ins' : 'del'}>${escapeHtml(piece.text)}</${piece.kind === 'added' ? 'ins' : 'del'}>`
    )
    .join(' ');

const CONFIDENCE = { high: 'alta', medium: 'média', low: 'baixa' } as const;

export function renderReport(rows: readonly ReportRow[], generatedAt: Date): string {
  const changed = rows.filter((row) => row.current_name !== row.suggested_name).length;
  const newFranchises = new Map<string, number>();
  for (const row of rows) {
    if (row.franchise.startsWith('NOVA: ')) {
      const name = row.franchise.slice(6);
      newFranchises.set(name, (newFranchises.get(name) ?? 0) + 1);
    }
  }
  const cards = rows
    .map((row) => {
      const franchise = row.franchise
        ? row.franchise.startsWith('NOVA: ')
          ? `<span class="tag new">Franquia nova: ${escapeHtml(row.franchise.slice(6))}</span>`
          : `<span class="tag">Franquia: ${escapeHtml(row.franchise)}</span>`
        : '<span class="tag none">Sem franquia</span>';
      const isChanged = row.current_name !== row.suggested_name;
      const flags = [
        isChanged ? 'changed' : 'same',
        row.franchise ? (row.franchise.startsWith('NOVA: ') ? 'newfr hasfr' : 'hasfr') : 'nofr',
        `conf-${row.confidence}`,
      ].join(' ');
      return `<article class="item ${flags}" data-text="${escapeHtml(`${row.current_name} ${row.suggested_name} ${row.franchise} ${row.category}`.toLowerCase())}">
  <header><span class="cat">${escapeHtml(row.category)}</span><span class="conf ${row.confidence}">Confiança ${CONFIDENCE[row.confidence]}</span></header>
  <p class="name">${isChanged ? diffHtml(row.current_name, row.suggested_name) : `${escapeHtml(row.current_name)} <em>(sem mudança)</em>`}</p>
  <footer>${franchise}</footer>
</article>`;
    })
    .join('\n');
  const newList = [...newFranchises.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([name, count]) => `<li>${escapeHtml(name)} <small>${count}</small></li>`)
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sugestões da IA — conferência</title>
<style>
:root{--bg:#f4f3ef;--card:#fff;--ink:#151518;--muted:#606068;--line:#deddd6;--yellow:#f6c344;--green:#1f7a4d;--red:#b3261e;--blue:#2457a6}
@media (prefers-color-scheme:dark){:root{--bg:#18181d;--card:#23232a;--ink:#f8f7f2;--muted:#b1b0b9;--line:#42424c;--green:#58c98c;--red:#ff8a80;--blue:#8ab4ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:28px 16px 80px}h1{margin:0 0 4px;font-size:1.7rem}
.sub{color:var(--muted);margin:0 0 20px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}.card b{display:block;font-size:1.6rem}.card span{color:var(--muted);font-size:.85rem}
.help{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--yellow);border-radius:10px;padding:12px 16px;margin-bottom:20px}
.help ins,.name ins{color:var(--green);background:color-mix(in srgb,var(--green) 14%,transparent);text-decoration:none;border-radius:4px;padding:0 3px}
.help del,.name del{color:var(--red);background:color-mix(in srgb,var(--red) 14%,transparent);border-radius:4px;padding:0 3px}
.bar{position:sticky;top:0;background:var(--bg);padding:10px 0;z-index:2;display:grid;gap:10px}
input[type=search]{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font-size:1rem}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chips button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:7px 14px;font-weight:700;cursor:pointer}
.chips button[aria-pressed=true]{background:var(--yellow);border-color:var(--yellow);color:#151518}
.item{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:12px 0}
.item header,.item footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
.cat{color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.08em}.name{font-size:1.05rem;margin:8px 0;font-weight:600}.name em{color:var(--muted);font-weight:400}
.tag{background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--blue);border-radius:999px;padding:3px 12px;font-size:.85rem;font-weight:700}
.tag.new{background:color-mix(in srgb,var(--yellow) 30%,transparent);color:var(--ink)}.tag.none{background:transparent;color:var(--muted);border:1px dashed var(--line)}
.conf{font-size:.8rem;font-weight:700}.conf.high{color:var(--green)}.conf.medium{color:#b7791f}.conf.low{color:var(--red)}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 16px;margin-bottom:16px}summary{cursor:pointer;font-weight:700}
.fr{columns:2;margin:10px 0 0;padding-left:18px}.fr small{color:var(--muted);margin-left:6px}
.empty{display:none;text-align:center;color:var(--muted);padding:40px 0}
</style>
</head>
<body><main>
<h1>Sugestões da IA — conferência</h1>
<p class="sub">Amostra de ${rows.length} produtos · gerado em ${escapeHtml(generatedAt.toLocaleString('pt-BR'))} · nada disto foi gravado no banco</p>
<div class="cards">
  <div class="card"><b>${rows.length}</b><span>produtos na amostra</span></div>
  <div class="card"><b>${changed}</b><span>com o nome mudado</span></div>
  <div class="card"><b>${rows.filter((row) => row.franchise).length}</b><span>com franquia sugerida</span></div>
  <div class="card"><b>${newFranchises.size}</b><span>franquias novas</span></div>
</div>
<p class="help">Como ler: no nome, <del>riscado em vermelho</del> é o que a IA <b>tiraria</b> e <ins>em verde</ins> é o que ela <b>acrescentaria ou corrigiria</b> (acentos, códigos do fabricante). Se o nome está certo e a franquia também, nada a fazer. Me diga o que está errado e eu ajusto antes de aplicar no catálogo todo.</p>
${newList ? `<details><summary>Franquias novas que a IA criaria (${newFranchises.size})</summary><ul class="fr">${newList}</ul></details>` : ''}
<div class="bar">
  <input type="search" id="q" placeholder="Buscar por nome, franquia ou categoria…" aria-label="Buscar">
  <div class="chips" id="chips">
    <button type="button" data-f="all" aria-pressed="true">Todos</button>
    <button type="button" data-f="changed" aria-pressed="false">Nome mudou</button>
    <button type="button" data-f="hasfr" aria-pressed="false">Com franquia</button>
    <button type="button" data-f="newfr" aria-pressed="false">Franquia nova</button>
    <button type="button" data-f="nofr" aria-pressed="false">Sem franquia</button>
    <button type="button" data-f="conf-low" aria-pressed="false">Confiança baixa</button>
  </div>
</div>
<div id="list">
${cards}
</div>
<p class="empty" id="empty">Nada encontrado com esses filtros.</p>
</main>
<script>
(function(){
  var filter='all',q='';
  var items=[].slice.call(document.querySelectorAll('.item'));
  function apply(){
    var shown=0;
    items.forEach(function(el){
      var ok=(filter==='all'||el.classList.contains(filter))&&(!q||el.getAttribute('data-text').indexOf(q)>-1);
      el.style.display=ok?'':'none'; if(ok) shown++;
    });
    document.getElementById('empty').style.display=shown?'none':'block';
  }
  document.getElementById('q').addEventListener('input',function(e){q=e.target.value.toLowerCase().trim();apply();});
  document.getElementById('chips').addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return;
    filter=b.getAttribute('data-f');
    [].forEach.call(this.children,function(c){c.setAttribute('aria-pressed',String(c===b));});
    apply();
  });
})();
</script>
</body></html>
`;
}
