import { notFound } from 'next/navigation';

import { ApiError } from '@/lib/api';
import { getQueryClient } from '@/lib/get-query-client';
import { ProductDetail } from '@/modules/store/product-detail';
import { storeProductQuery } from '@/modules/store/services/catalog/queries';

type Props = { params: Promise<{ slug: string }> };

async function loadProduct(slug: string) {
  try {
    return await getQueryClient().fetchQuery(storeProductQuery(slug));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: 'Produto não encontrado' };
  return {
    title: product.name,
    description: product.description?.slice(0, 160) ?? `Compre ${product.name} na GeekStore.`,
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!(await loadProduct(slug))) notFound();
  return <ProductDetail slug={slug} />;
}
