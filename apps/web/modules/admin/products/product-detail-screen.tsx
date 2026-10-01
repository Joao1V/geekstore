'use client';

import { useQuery } from '@tanstack/react-query';

import { getErrorMessage } from '../lib/errors';
import { productDetailQueryOptions } from '../services/catalog/queries';
import { PageHeader } from '../ui/page-header';
import { ProductForm } from './product-form';

/** Carrega o produto e monta o formulário. */
export function ProductDetailScreen({ productId }: { productId: string }) {
  const { data, isPending, error } = useQuery(productDetailQueryOptions(productId));

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
      <PageHeader title={data.name} eyebrow="Produto" />
      <ProductForm product={data} />
    </>
  );
}
