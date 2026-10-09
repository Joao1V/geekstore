import type { Permission } from '@geekstore/shared';
import {
  Copy,
  FileText,
  FolderTree,
  Home,
  Layers,
  type LucideIcon,
  Package,
  ReceiptText,
  ScrollText,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  Ticket,
  Users,
  Warehouse,
} from 'lucide-react';

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission?: Permission;
};

export type AdminNavGroup = {
  /** `null` = sem cabeçalho (o item solto do topo). */
  label: string | null;
  items: AdminNavItem[];
};

/** Menu lateral agrupado por assunto. Os mesmos nomes de grupo aparecem no breadcrumb. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: null,
    items: [{ href: '/admin/', label: 'Início', description: 'Atalhos do painel', icon: Home }],
  },
  {
    label: 'Vendas',
    items: [
      {
        href: '/admin/pedidos/',
        label: 'Pedidos',
        description: 'Pagamento, separação, envio e rastreio',
        icon: ShoppingBag,
        permission: 'orders:read',
      },
      {
        href: '/admin/cupons/',
        label: 'Cupons',
        description: 'Cupons de desconto e frete grátis',
        icon: Ticket,
        permission: 'pricing:read',
      },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      {
        href: '/admin/produtos/',
        label: 'Produtos',
        description: 'Produtos, SKUs, imagens e SEO',
        icon: Package,
        permission: 'catalog:read',
      },
      {
        href: '/admin/categorias/',
        label: 'Categorias',
        description: 'Árvore de até 3 níveis',
        icon: FolderTree,
        permission: 'catalog:read',
      },
      {
        href: '/admin/colecoes/',
        label: 'Coleções',
        description: 'Franquias e curadorias',
        icon: Layers,
        permission: 'catalog:read',
      },
      {
        href: '/admin/marcas/',
        label: 'Marcas',
        description: 'Funko, LEGO, Konami… e quantos produtos cada uma tem',
        icon: Tag,
        permission: 'catalog:read',
      },
      {
        href: '/admin/atributos/',
        label: 'Atributos',
        description: 'Cor, tamanho, edição… e o código de SKU de cada valor',
        icon: SlidersHorizontal,
        permission: 'catalog:read',
      },
      {
        href: '/admin/duplicados/',
        label: 'Duplicados',
        description: 'Produtos repetidos: mesclar e somar o estoque',
        icon: Copy,
        permission: 'catalog:read',
      },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      {
        href: '/admin/paginas/',
        label: 'Páginas',
        description: 'Trocas e devoluções, nos conheça, contato…',
        icon: FileText,
        permission: 'content:read',
      },
    ],
  },
  {
    label: 'Estoque',
    items: [
      {
        href: '/admin/estoque/',
        label: 'Estoque e preços',
        description: 'Grade de edição rápida e movimentações',
        icon: Warehouse,
        permission: 'stock:read',
      },
      {
        href: '/admin/notas/',
        label: 'Notas de entrada',
        description: 'Notas de compra (XML) que dão entrada no estoque',
        icon: ReceiptText,
        permission: 'stock:read',
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        href: '/admin/usuarios/',
        label: 'Usuários',
        description: 'Equipe e perfis de acesso',
        icon: Users,
        permission: 'users:read',
      },
      {
        href: '/admin/auditoria/',
        label: 'Auditoria',
        description: 'Quem mudou o quê, e quando',
        icon: ScrollText,
        permission: 'audit:read',
      },
    ],
  },
];

/** Lista plana, para quem só precisa percorrer os itens (atalhos da página inicial). */
export const ADMIN_NAV: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
