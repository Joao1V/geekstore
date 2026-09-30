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
import { Action, Dialog, FieldInput } from '@/components/ui';
import { money, type Product, products } from '@/lib/catalog';

type BannerFormValues = { campaign: string; title: string; link: string };
type EditProductFormValues = { name: string; price: number; stock: number };

const TAB_BASE = 'gap-2 border border-border text-sm max-md:gap-[5px] max-md:p-2.5 max-md:text-xs';
const CELL = 'border-b border-border px-3 py-4 text-left';
const EDIT_LABEL = 'flex flex-col gap-1.5 text-sm font-extrabold';
const EDIT_INPUT = 'rounded-lg border border-border bg-surface-secondary p-2.5 text-foreground';

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

  const stats = [
    { label: 'Produtos no exemplo', value: rows.length },
    { label: 'Unidades no exemplo', value: rows.reduce((sum, p) => sum + p.stock, 0) },
    { label: 'Pedidos reais', value: 'Não conectado' },
  ];

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: 'Produto',
      cell: ({ row }) => (
        <span className="flex min-w-[220px] items-center gap-[13px] font-extrabold">
          <Image
            className="size-[46px] rounded-lg object-cover"
            src={row.original.image}
            alt=""
            width={46}
            height={46}
          />
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
      <div className="my-7 flex gap-3 max-md:flex-wrap max-md:gap-[7px]">
        {ADMIN_TABS.map((t) => (
          <Button
            key={t.name}
            className={`${TAB_BASE} ${tab === t.name ? 'bg-geek-yellow text-ink' : 'bg-surface text-foreground'}`}
            onPress={() => setTab(t.name)}
          >
            <t.icon size={18} />
            {t.name}
          </Button>
        ))}
      </div>
      {tab === 'Produtos' ? (
        <>
          <div className="mb-[30px] grid grid-cols-3 gap-5 max-md:grid-cols-1 max-md:gap-3">
            {stats.map(({ label, value }) => (
              <div
                key={label}
                className="surface p-[25px] max-md:flex max-md:items-center max-md:justify-between max-md:p-[18px]"
              >
                <small className="block text-sm text-muted">{label}</small>
                <strong className="mt-2.5 block text-3xl max-md:m-0 max-md:text-xl">{value}</strong>
              </div>
            ))}
          </div>
          <div className="surface overflow-x-auto p-[25px] max-md:p-[15px]">
            <input
              className="mb-6 w-[min(100%,380px)] rounded-lg border border-border bg-surface-secondary px-4 py-3 text-foreground"
              aria-label="Buscar produtos no admin"
              placeholder="Buscar produto ou categoria…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <table className="w-full border-collapse text-sm">
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th key={header.id} className={CELL}>
                        <button
                          type="button"
                          className="flex items-center gap-2 text-xs font-extrabold text-muted uppercase"
                          onClick={header.column.getToggleSortingHandler()}
                        >
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
                      <td key={cell.id} className={CELL}>
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
        <form
          className="surface grid max-w-[680px] gap-5 p-[30px]"
          onSubmit={handleBannerSubmit(submitBanner)}
        >
          <h2 className="text-xl font-extrabold">Planeje sua próxima campanha</h2>
          <p className="muted">Campos de referência para a futura gestão de banners.</p>
          <Controller
            control={bannerControl}
            name="campaign"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Nome da campanha" />
            )}
          />
          <Controller
            control={bannerControl}
            name="title"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Título" />
            )}
          />
          <Controller
            control={bannerControl}
            name="link"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Link de destino" />
            )}
          />
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
          <form className="grid gap-[18px]" onSubmit={handleEditSubmit(submitEdit)}>
            <label className={EDIT_LABEL} htmlFor="edit-product-name">
              Nome
              <Controller
                control={editControl}
                name="name"
                render={({ field }) => (
                  <input id="edit-product-name" className={EDIT_INPUT} {...field} required />
                )}
              />
            </label>
            <label className={EDIT_LABEL} htmlFor="edit-product-price">
              Preço
              <Controller
                control={editControl}
                name="price"
                render={({ field }) => (
                  <input
                    id="edit-product-price"
                    className={EDIT_INPUT}
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
            <label className={EDIT_LABEL} htmlFor="edit-product-stock">
              Estoque
              <Controller
                control={editControl}
                name="stock"
                render={({ field }) => (
                  <input
                    id="edit-product-stock"
                    className={EDIT_INPUT}
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
