'use client';

import { Button } from '@heroui/react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  Image as ImageIcon,
  Package,
  Pencil,
  Save,
  ShoppingBag,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Action, Dialog, Field } from '@/components/ui';
import { money, type Product, products } from '@/lib/catalog';

type BannerFormValues = { campaign: string; title: string; link: string };
type EditProductFormValues = { name: string; price: number; stock: number };

const ADMIN_TABS = [
  { name: 'Produtos', icon: Package },
  { name: 'Banners', icon: ImageIcon },
  { name: 'Pedidos', icon: ShoppingBag },
  { name: 'Clientes', icon: Users },
];

export function Admin() {
  const [tab, setTab] = useState('Produtos');
  const [rows, setRows] = useState(products);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [notice, setNotice] = useState('');
  const { control: bannerControl, handleSubmit: handleBannerSubmit } = useForm<BannerFormValues>();
  const { control: editControl, handleSubmit: handleEditSubmit } = useForm<EditProductFormValues>({
    values: editing
      ? { name: editing.name, price: editing.price, stock: editing.stock }
      : undefined,
  });

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: 'Produto',
      cell: ({ row }) => (
        <span className="table-product">
          <Image src={row.original.image} alt="" width={46} height={46} />
          {row.original.name}
        </span>
      ),
    },
    { accessorKey: 'category', header: 'Categoria' },
    { accessorKey: 'price', header: 'Preço', cell: ({ getValue }) => money(getValue<number>()) },
    { accessorKey: 'stock', header: 'Estoque' },
    {
      id: 'edit',
      header: 'Ações',
      cell: ({ row }) => (
        <Button
          isIconOnly
          aria-label={`Editar ${row.original.name}`}
          onPress={() => setEditing(row.original)}
        >
          <Pencil size={16} />
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter: search, sorting },
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const submitBanner = () => {
    setNotice(
      'Configuração validada. Para publicar campanhas pelo admin, conecte a API e o armazenamento de imagens.'
    );
  };

  const submitEdit = (data: EditProductFormValues) => {
    if (!editing) return;
    setRows((current) => current.map((p) => (p.id === editing.id ? { ...p, ...data } : p)));
    setEditing(null);
  };

  return (
    <section className="wrap section">
      <p className="eyebrow orange">GeekStore Studio</p>
      <h1 className="section-title">Painel de gestão</h1>
      <p className="notice">
        Prévia pública de interface, sem dados reais ou permissões administrativas. Edições duram
        apenas enquanto esta tela estiver aberta e não alteram a loja.
      </p>
      <div className="admin-tabs">
        {ADMIN_TABS.map((t) => (
          <Button
            key={t.name}
            className={tab === t.name ? 'active' : ''}
            onPress={() => setTab(t.name)}
          >
            <t.icon size={18} />
            {t.name}
          </Button>
        ))}
      </div>
      {tab === 'Produtos' ? (
        <>
          <div className="admin-stats">
            <div className="surface">
              <small>Produtos no exemplo</small>
              <strong>{rows.length}</strong>
            </div>
            <div className="surface">
              <small>Unidades no exemplo</small>
              <strong>{rows.reduce((sum, p) => sum + p.stock, 0)}</strong>
            </div>
            <div className="surface">
              <small>Pedidos reais</small>
              <strong>Não conectado</strong>
            </div>
          </div>
          <div className="surface table-wrap">
            <input
              className="admin-search"
              aria-label="Buscar produtos no admin"
              placeholder="Buscar produto ou categoria…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <table>
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th key={header.id}>
                        <button type="button" onClick={header.column.getToggleSortingHandler()}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && <ArrowUpDown size={13} />}
                        </button>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!table.getRowModel().rows.length && <p>Nenhum produto encontrado.</p>}
          </div>
        </>
      ) : tab === 'Banners' ? (
        <form className="surface admin-banner" onSubmit={handleBannerSubmit(submitBanner)}>
          <h2>Planeje sua próxima campanha</h2>
          <p className="muted">Campos de referência para a futura gestão de banners.</p>
          <Field control={bannerControl} name="campaign" label="Nome da campanha" />
          <Field control={bannerControl} name="title" label="Título" />
          <Field control={bannerControl} name="link" label="Link de destino" />
          <label className="form-field">
            Imagem da campanha
            <input type="file" accept="image/png,image/jpeg,image/webp" />
          </label>
          <p className="demo-note">O arquivo não é enviado nem publicado.</p>
          <Action type="submit">
            <Save size={17} /> Validar prévia
          </Action>
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
        </form>
      ) : (
        <div className="surface empty">
          <Package size={42} />
          <h2>{tab === 'Pedidos' ? 'Nenhum pedido real' : 'Nenhum cliente cadastrado'}</h2>
          <p>Essa área será alimentada pela API com autenticação e autorização no servidor.</p>
        </div>
      )}
      <Dialog
        open={!!editing}
        onChange={(open) => {
          if (!open) setEditing(null);
        }}
        title="Editar produto de exemplo"
      >
        {editing && (
          <form className="edit-form" onSubmit={handleEditSubmit(submitEdit)}>
            <label htmlFor="edit-product-name">
              Nome
              <Controller
                control={editControl}
                name="name"
                render={({ field }) => <input id="edit-product-name" {...field} required />}
              />
            </label>
            <label htmlFor="edit-product-price">
              Preço
              <Controller
                control={editControl}
                name="price"
                render={({ field }) => (
                  <input
                    id="edit-product-price"
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                  />
                )}
              />
            </label>
            <label htmlFor="edit-product-stock">
              Estoque
              <Controller
                control={editControl}
                name="stock"
                render={({ field }) => (
                  <input
                    id="edit-product-stock"
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    required
                    type="number"
                    min="0"
                    step="1"
                  />
                )}
              />
            </label>
            <Action type="submit">Aplicar à prévia</Action>
          </form>
        )}
      </Dialog>
    </section>
  );
}
