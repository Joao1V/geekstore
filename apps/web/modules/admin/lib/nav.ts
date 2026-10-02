import type { Permission } from '@geekstore/shared';
import {
  FolderTree,
  Home,
  Layers,
  type LucideIcon,
  Package,
  ScrollText,
  SlidersHorizontal,
  Tag,
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

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin/', label: 'Início', description: 'Atalhos do painel', icon: Home },
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
    href: '/admin/estoque/',
    label: 'Estoque e preços',
    description: 'Grade de edição rápida e movimentações',
    icon: Warehouse,
    permission: 'stock:read',
  },
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
];
