import {
  type CleanupInput,
  type CleanupSuggestion,
  type FranchiseOption,
  parseCleanup,
} from './name-cleanup';

// Faxina "por fora da API": o lote vira um arquivo que você anexa no Claude (site), cola a resposta num
// arquivo e o ai:import lê. Mesmas regras da faxina pela API, em formato curto (uma linha por produto)
// para caber muitos produtos numa resposta só.

const CONFIDENCE_WORDS = { alta: 'high', media: 'medium', média: 'medium', baixa: 'low' } as const;

export function buildWebBatch(
  items: readonly CleanupInput[],
  franchises: readonly FranchiseOption[],
  batchNumber: number | 'todos'
): string {
  const label = typeof batchNumber === 'number' ? String(batchNumber).padStart(3, '0') : 'único';
  const known = franchises.map((franchise) => `${franchise.slug} (${franchise.name})`).join(', ');
  const lines = items.map((item, index) => `${index + 1} | ${item.category} | ${item.name}`);
  return `# Lote ${label} — limpeza de nomes de produtos de uma loja geek

Você organiza o catálogo de uma loja de itens geek (colecionáveis, mangás, jogos, canecas, roupas). Para cada produto da lista no fim deste arquivo, devolva:

1. **nome**: o nome limpo para a vitrine, em português do Brasil. Tire códigos internos do fabricante e do ERP (ex.: MC49222HP, #DMG9040S-MK13, WZK71603, CS2002, "e-Commerce"), mantendo o que ajuda o cliente (personagem, linha, tamanho, cor, capacidade, volume, quantidade de peças e o nº do set da LEGO quando for o identificador do produto). Corrija acentos e erros de digitação óbvios. **Não invente nada** que não esteja no nome e **nunca troque, some nem crie números**. Se o nome já está bom, devolva igual.
2. **franquia**: o universo do produto (Naruto, Disney, Overwatch...). Se estiver na lista abaixo, devolva o **slug**. Se não estiver mas for uma franquia conhecida, devolva \`+Nome da Franquia\`. Se não houver franquia clara (item genérico), devolva \`-\`. Na dúvida, \`-\`.
3. **confiança**: \`alta\`, \`media\` ou \`baixa\`.
4. **códigos**: os códigos que você TIROU do nome, exatamente como estavam, separados por vírgula; \`-\` se não tirou nenhum.

Franquias existentes: ${known}

## Formato da resposta

Responda **somente** com um bloco de código, **uma linha por produto, na mesma ordem e com o mesmo número**, assim:

\`\`\`
1 | Nome limpo | slug-ou-+Nova-ou-- | alta | CODIGO1, CODIGO2
2 | Outro nome | - | media | -
\`\`\`

Não pule nenhum número. ${items.length > 400 ? `A lista é longa (${items.length} produtos): responda em partes de uns 300 produtos, pare numa linha completa ao fim de cada parte e espere eu escrever "continua"; então retome exatamente do número seguinte, sem repetir linhas e sem texto fora do bloco de código.` : 'Se a resposta ficar longa demais, pare numa linha completa e eu peço "continua".'}

## Produtos (número | categoria | nome)

${lines.join('\n')}
`;
}

/** Lê a resposta colada (com ou sem a cerca ```), valida como na faxina pela API e devolve as sugestões. */
export function parseWebAnswer(
  text: string,
  items: readonly CleanupInput[],
  franchises: readonly FranchiseOption[]
): { suggestions: CleanupSuggestion[]; unreadable: number } {
  const rows: unknown[] = [];
  let unreadable = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('```')) continue;
    const parts = line.split('|').map((part) => part.trim());
    const number = Number(parts[0]);
    const item = Number.isInteger(number) ? items[number - 1] : undefined;
    if (parts.length < 4 || !item) {
      unreadable += 1;
      continue;
    }
    const [, name = '', franchiseText = '-', confidenceText = '', codesText = '-'] = parts;
    const confidence =
      CONFIDENCE_WORDS[confidenceText.toLowerCase() as keyof typeof CONFIDENCE_WORDS];
    if (!name || !confidence) {
      unreadable += 1;
      continue;
    }
    const franchise =
      franchiseText === '-' || franchiseText === ''
        ? null
        : franchiseText.startsWith('+')
          ? { new: franchiseText.slice(1).trim() }
          : { slug: franchiseText };
    const removed_codes = codesText === '-' ? [] : codesText.split(',').map((code) => code.trim());
    rows.push({ id: item.id, name, franchise, confidence, removed_codes });
  }
  const suggestions = parseCleanup(JSON.stringify(rows), items, franchises);
  return { suggestions, unreadable };
}
