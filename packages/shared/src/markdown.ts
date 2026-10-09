// Markdown mínimo e seguro para as páginas da loja: títulos, parágrafos, listas, citação, linha, e no
// texto **negrito**, *itálico*, `código` e [links](url). Devolve uma árvore (nunca HTML): quem renderiza
// monta elementos React, então um texto escrito no admin não consegue injetar HTML nem script.

export type MarkdownInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: MarkdownInline[] }
  | { type: 'em'; children: MarkdownInline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: MarkdownInline[] }
  | { type: 'br' };

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: MarkdownInline[] }
  | { type: 'paragraph'; children: MarkdownInline[] }
  | { type: 'list'; ordered: boolean; items: MarkdownInline[][] }
  | { type: 'quote'; children: MarkdownInline[] }
  | { type: 'rule' };

/** Só endereços que não executam nada: http(s), e-mail, telefone, caminho da própria loja e âncora. */
export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href.trim());
}

const INLINE_PATTERNS: { type: 'strong' | 'em' | 'code' | 'link'; regex: RegExp }[] = [
  { type: 'link', regex: /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/ },
  { type: 'code', regex: /`([^`\n]+)`/ },
  { type: 'strong', regex: /\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/ },
  { type: 'em', regex: /\*([^*\n]+?)\*|(?<![A-Za-z0-9])_([^_\n]+?)_(?![A-Za-z0-9])/ },
];

export function parseInline(text: string): MarkdownInline[] {
  const out: MarkdownInline[] = [];
  let rest = text;
  while (rest.length > 0) {
    let best: { index: number; length: number; node: MarkdownInline } | null = null;
    for (const { type, regex } of INLINE_PATTERNS) {
      const match = regex.exec(rest);
      if (!match || (best && match.index >= best.index)) continue;
      const inner = match[1] ?? match[2] ?? '';
      const node: MarkdownInline =
        type === 'code'
          ? { type, text: inner }
          : type === 'link'
            ? isSafeHref(match[2] ?? '')
              ? { type, href: (match[2] ?? '').trim(), children: parseInline(inner) }
              : { type: 'text', text: inner }
            : { type, children: parseInline(inner) };
      best = { index: match.index, length: match[0].length, node };
    }
    if (!best) {
      out.push({ type: 'text', text: rest });
      break;
    }
    if (best.index > 0) out.push({ type: 'text', text: rest.slice(0, best.index) });
    out.push(best.node);
    rest = rest.slice(best.index + best.length);
  }
  return out;
}

/** Linhas de um parágrafo viram uma quebra de linha cada: quem escreve no admin espera isso. */
function paragraphInline(lines: string[]): MarkdownInline[] {
  return lines.flatMap((line, index) => [
    ...(index > 0 ? [{ type: 'br' } as const] : []),
    ...parseInline(line.trim()),
  ]);
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: MarkdownInline[][] } | null = null;
  let quote: string[] = [];

  const flush = () => {
    if (paragraph.length > 0)
      blocks.push({ type: 'paragraph', children: paragraphInline(paragraph) });
    if (list) blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
    if (quote.length > 0) blocks.push({ type: 'quote', children: paragraphInline(quote) });
    paragraph = [];
    list = null;
    quote = [];
  };

  for (const line of lines) {
    if (line.trim() === '') {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: 'heading',
        level: (heading[1] as string).length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(heading[2] ?? ''),
      });
      continue;
    }
    if (RULE.test(line)) {
      flush();
      blocks.push({ type: 'rule' });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush();
      if (paragraph.length > 0 || quote.length > 0) flush();
      list = list ?? { ordered, items: [] };
      list.items.push(parseInline((item[1] ?? '').trim()));
      continue;
    }
    const quoted = QUOTE.exec(line);
    if (quoted) {
      if (paragraph.length > 0 || list) flush();
      quote.push(quoted[1] ?? '');
      continue;
    }
    if (list || quote.length > 0) flush();
    paragraph.push(line);
  }
  flush();
  return blocks;
}
