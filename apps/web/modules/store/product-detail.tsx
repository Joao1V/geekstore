import type { StoreProductDetail } from '@geekstore/shared';
import { ArrowRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { getQueryClient } from '@/lib/get-query-client';
import { ProductBuy } from './product-buy';
import { ProductGrid } from './product-card';
import { storeProductQuery, storeProductsQuery } from './services/catalog/queries';

const RELATED = 4;

/** Endereço da categoria na posição `index` do caminho: `/colecionaveis/funko/`. */
const categoryHref = (path: { slug: string }[], index: number): string =>
  `/${path
    .slice(0, index + 1)
    .map((item) => item.slug)
    .join('/')}/`;

/** Dados estruturados (JSON-LD) para o Google: preço, moeda e disponibilidade (RF-VIT-06). */
function jsonLd(product: StoreProductDetail, url: string) {
  const prices = product.skus.map((sku) => sku.price_cents / 100);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? undefined,
    sku: product.skus[0]?.code,
    image: product.images.map((image) => image.url),
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: product.skus.length,
      availability: product.skus.some((sku) => sku.available > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url,
    },
  };
}

export async function ProductDetail({ slug }: { slug: string }) {
  const client = getQueryClient();
  const product = await client.fetchQuery(storeProductQuery(slug));
  const category = product.category_path.at(-1);
  const related = category
    ? await client.fetchQuery(
        storeProductsQuery({ category: category.slug, in_stock: true, page_size: RELATED + 1 })
      )
    : null;
  const others = (related?.data ?? [])
    .filter((item) => item.product_id !== product.product_id)
    .slice(0, RELATED);

  return (
    <section className="wrap section max-md:pb-[65px]">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD gerado por nós a partir de dados da API, sem HTML do usuário
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd(product, product.path)).replace(/</g, '\\u003c'),
        }}
      />
      <nav
        aria-label="Você está em"
        className="mb-[26px] flex flex-wrap items-center gap-2.5 text-sm text-muted max-md:text-xs"
      >
        <Link href="/">Início</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link href="/catalogo/">Catálogo</Link>
        {product.category_path.map((item, index) => (
          <span key={item.slug} className="flex items-center gap-2.5">
            <ChevronRight size={14} aria-hidden="true" />
            <Link href={categoryHref(product.category_path, index)}>{item.name}</Link>
          </span>
        ))}
      </nav>
      <ProductBuy product={product} />
      <div className="mb-[15px] grid grid-cols-2 gap-[65px] py-[60px] max-md:grid-cols-1 max-md:gap-5 max-md:py-[35px]">
        <div>
          <p className="eyebrow muted leading-[1.8]">Conheça seu próximo achado</p>
          <h2 className="section-title max-md:text-3xl">Detalhes que importam</h2>
          <p className="leading-[1.8] whitespace-pre-line text-muted">
            {product.description ?? 'A descrição deste produto ainda não foi cadastrada.'}
          </p>
        </div>
        <dl className="h-max rounded-[14px] border border-border bg-surface p-[25px]">
          {[
            ['Marca', product.brand?.name],
            ['Categoria', product.category_path.map((item) => item.name).join(' › ')],
            ['Versões', String(product.skus.length)],
            ...product.options.map((option) => [
              option.name,
              option.values.map((value) => value.label).join(', '),
            ]),
          ]
            .filter((row): row is [string, string] => Boolean(row[1]))
            .map(([key, value]) => (
              <div
                key={key}
                className="grid grid-cols-[1fr_1.5fr] gap-2.5 border-b border-border py-[13px] text-sm"
              >
                <dt className="font-extrabold">{key}</dt>
                <dd className="text-muted">{value}</dd>
              </div>
            ))}
        </dl>
      </div>
      {others.length > 0 && (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow orange">Continue explorando</p>
              <h2 className="section-title">Mais de {category?.name}</h2>
            </div>
            <Link href={categoryHref(product.category_path, product.category_path.length - 1)}>
              Ver todos <ArrowRight size={18} />
            </Link>
          </div>
          <ProductGrid items={others} />
        </>
      )}
    </section>
  );
}
