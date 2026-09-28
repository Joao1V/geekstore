import { notFound } from 'next/navigation';
import { products } from '@/lib/catalog';
import { ProductDetail } from '@/modules/store/product';

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((p) => p.slug === slug);
  return { title: product?.name || 'Produto', description: product?.description };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
