import { describe, expect, it } from 'vitest';

import { isSafeHref, parseInline, parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('reads headings, paragraphs and keeps a line break inside a paragraph', () => {
    expect(parseMarkdown('## Prazo\n\nSete dias.\nPara trocar.')).toEqual([
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Prazo' }] },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Sete dias.' },
          { type: 'br' },
          { type: 'text', text: 'Para trocar.' },
        ],
      },
    ]);
  });

  it('reads bullet and numbered lists as separate lists', () => {
    const blocks = parseMarkdown('- um\n- dois\n\n1. a\n2. b');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: false });
    expect(blocks[1]).toMatchObject({ type: 'list', ordered: true });
    expect((blocks[0] as { items: unknown[] }).items).toHaveLength(2);
  });

  it('reads a quote and a horizontal rule', () => {
    expect(parseMarkdown('> aviso\n\n---')).toEqual([
      { type: 'quote', children: [{ type: 'text', text: 'aviso' }] },
      { type: 'rule' },
    ]);
  });

  it('treats Windows line endings like Unix ones', () => {
    expect(parseMarkdown('# A\r\n\r\ntexto')).toHaveLength(2);
  });

  it('is empty for an empty text', () => {
    expect(parseMarkdown('  \n \n')).toEqual([]);
  });
});

describe('parseInline', () => {
  it('reads bold, italic, code and nesting', () => {
    expect(parseInline('**forte** e *leve* e `x`')).toEqual([
      { type: 'strong', children: [{ type: 'text', text: 'forte' }] },
      { type: 'text', text: ' e ' },
      { type: 'em', children: [{ type: 'text', text: 'leve' }] },
      { type: 'text', text: ' e ' },
      { type: 'code', text: 'x' },
    ]);
  });

  it('reads a safe link', () => {
    expect(parseInline('[fale](mailto:oi@loja.com)')).toEqual([
      { type: 'link', href: 'mailto:oi@loja.com', children: [{ type: 'text', text: 'fale' }] },
    ]);
  });

  it('drops the address of an unsafe link and keeps only its text (no javascript:)', () => {
    expect(parseInline('[clique](javascript:alert(1))')).toEqual([
      { type: 'text', text: 'clique' },
    ]);
    expect(parseInline('[x](data:text/html,<script>)')).toEqual([{ type: 'text', text: 'x' }]);
  });

  it('never produces HTML: a tag in the text stays plain text', () => {
    expect(parseInline('<script>alert(1)</script>')).toEqual([
      { type: 'text', text: '<script>alert(1)</script>' },
    ]);
  });

  it('does not treat snake_case as emphasis', () => {
    expect(parseInline('meu_arquivo_final')).toEqual([{ type: 'text', text: 'meu_arquivo_final' }]);
  });
});

describe('isSafeHref', () => {
  it('allows web, mail, phone, own-site paths and anchors only', () => {
    for (const href of [
      'https://a.com',
      'http://a.com',
      'mailto:a@b.c',
      'tel:+5517',
      '/catalogo/',
      '#topo',
    ]) {
      expect(isSafeHref(href)).toBe(true);
    }
    for (const href of ['javascript:alert(1)', '//evil.com', 'data:text/html,x', 'vbscript:x']) {
      expect(isSafeHref(href)).toBe(false);
    }
  });
});
