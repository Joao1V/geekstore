'use client';

import { useQuery } from '@tanstack/react-query';
import { categoryPath } from '../lib/category-tree';
import { getErrorMessage } from '../lib/errors';
import { categoriesQueryOptions, productDetailQueryOptions } from '../services/catalog/queries';
import { PageHeader } from '../ui/page-header';
import { ProductCollectionsCard } from './product-collections-card';
import { ProductForm } from './product-form';
import { ProductSummaryCard } from './product-summary-card';

/** Carrega o produto e monta o formulário. */
export function ProductDetailScreen({ productId }: { productId: string }) {
  const { data, isPending, error } = useQuery(productDetailQueryOptions(productId));
  const { data: categories } = useQuery(categoriesQueryOptions());

  if (isPending) return <p className="muted">Carregando produto…</p>;
  if (error || !data) {
    return (
      <p className="error" role="alert">
        {getErrorMessage(error)}
      </p>
    );
  }

  return (
    <>
      <PageHeader
        title={data.name}
        eyebrow="Produto"
        crumbs={[
          { label: 'Catálogo' },
          { label: 'Produtos', href: '/admin/produtos/' },
          ...categoryPath(categories ?? [], data.category_id).map((category) => ({
            label: category.name,
            href: `/admin/produtos/?category_id=${category.category_id}`,
          })),
          { label: data.name },
        ]}
      />
      <div className="grid grid-cols-[18rem_minmax(0,1fr)] items-start gap-6 max-tablet:grid-cols-1">
        <div className="grid gap-4 self-start max-tablet:max-h-none max-tablet:static sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] max-tablet:overflow-visible">
          <ProductSummaryCard product={data} />
          <ProductCollectionsCard product={data} />
        </div>
        <ProductForm product={data} />
      </div>
    </>
  );
}
