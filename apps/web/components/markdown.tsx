import {
  isSafeHref,
  type MarkdownBlock,
  type MarkdownInline,
  parseMarkdown,
} from '@geekstore/shared';
import type { ReactNode } from 'react';

const HEADING_CLASS: Record<number, string> = {
  2: 'mt-8 mb-3 text-2xl font-black',
  3: 'mt-6 mb-2 text-xl font-black',
  4: 'mt-5 mb-2 text-lg font-extrabold',
  5: 'mt-4 mb-1 text-base font-extrabold',
  6: 'mt-4 mb-1 text-sm font-extrabold',
};

function Inline({ nodes }: { nodes: MarkdownInline[] }): ReactNode {
  return nodes.map((node, index) => {
    // A ordem do texto não muda entre renders, então o índice é uma chave estável aqui.
    const key = `${node.type}-${index}`;
    switch (node.type) {
      case 'text':
        return node.text;
      case 'br':
        return <br key={key} />;
      case 'strong':
        return (
          <strong key={key}>
            <Inline nodes={node.children} />
          </strong>
        );
      case 'em':
        return (
          <em key={key}>
            <Inline nodes={node.children} />
          </em>
        );
      case 'code':
        return (
          <code key={key} className="rounded bg-surface-secondary px-1 py-0.5 text-[0.9em]">
            {node.text}
          </code>
        );
      case 'link': {
        const external = /^https?:\/\//i.test(node.href);
        // Defesa em profundidade: o parser já descarta endereço inseguro, e aqui conferimos de novo.
        if (!isSafeHref(node.href)) return <Inline key={key} nodes={node.children} />;
        return (
          <a
            key={key}
            href={node.href}
            className="font-bold underline underline-offset-2"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <Inline nodes={node.children} />
          </a>
        );
      }
      default:
        return null;
    }
  });
}

function Block({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case 'heading': {
      // A página já tem o seu h1 (o título): "#" no texto vira h2, "##" vira h3, e assim por diante.
      const level = Math.min(block.level + 1, 6) as 2 | 3 | 4 | 5 | 6;
      const Tag = `h${level}` as const;
      return (
        <Tag className={HEADING_CLASS[level]}>
          <Inline nodes={block.children} />
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p className="my-3">
          <Inline nodes={block.children} />
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className={`my-3 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: itens de texto fixo, sem reordenar
            <li key={index} className="my-1">
              <Inline nodes={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote className="my-4 border-l-4 border-geek-yellow pl-4 italic">
          <Inline nodes={block.children} />
        </blockquote>
      );
    case 'rule':
      return <hr className="my-6 border-border" />;
    default:
      return null;
  }
}

/** Texto em Markdown (ver `parseMarkdown`) como elementos React: nunca injeta HTML. */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`leading-[1.8] ${className}`}>
      {parseMarkdown(text).map((block, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocos de texto fixo, sem reordenar
        <Block key={index} block={block} />
      ))}
    </div>
  );
}
