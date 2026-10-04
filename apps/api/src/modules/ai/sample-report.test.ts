import { describe, expect, it } from 'vitest';

import { renderReport, wordDiff } from './sample-report';

describe('wordDiff', () => {
  it('marks what left, what came in and what stayed', () => {
    const pieces = wordDiff('Mochilete Preto MC49222HP', 'Mochilete Preto');
    expect(pieces).toEqual([
      { text: 'Mochilete', kind: 'same' },
      { text: 'Preto', kind: 'same' },
      { text: 'MC49222HP', kind: 'removed' },
    ]);
    const fixed = wordDiff('Caneca Pocao', 'Caneca Poção');
    expect(fixed.map((piece) => piece.kind)).toContain('removed');
    expect(fixed.map((piece) => piece.kind)).toContain('added');
  });
});

describe('renderReport', () => {
  const rows = [
    {
      category: 'Mangás',
      current_name: 'Manga <b>X</b> Vol 02',
      suggested_name: 'Manga <b>X</b> Vol. 02',
      franchise: 'NOVA: X & Y',
      confidence: 'high' as const,
    },
    {
      category: 'Canecas',
      current_name: 'Caneca Lisa',
      suggested_name: 'Caneca Lisa',
      franchise: '',
      confidence: 'low' as const,
    },
  ];

  it('escapes the product names, so nothing from the catalog becomes HTML', () => {
    const html = renderReport(rows, new Date('2026-10-04T12:00:00Z'));
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(html).toContain('X &amp; Y');
  });

  it('summarizes and offers the filters', () => {
    const html = renderReport(rows, new Date());
    expect(html).toContain('2</b><span>produtos na amostra');
    expect(html).toContain('1</b><span>com o nome mudado');
    expect(html).toContain('data-f="newfr"');
    expect(html).toContain('(sem mudança)');
  });
});
