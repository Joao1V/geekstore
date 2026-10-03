import {
  ArrowRight,
  Blocks,
  BookOpen,
  ChevronRight,
  Cookie,
  Dices,
  Headphones,
  Lamp,
  type LucideIcon,
  Luggage,
  Package,
  Pencil,
  Shirt,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { getQueryClient } from '@/lib/get-query-client';
import { getMascot } from '@/lib/mascot';
import { CampaignSlider } from './campaign-slider';
import { ProductGrid } from './product-card';
import { Reveal } from './reveal';
import { storeHomeQuery, storeProductsQuery } from './services/catalog/queries';
import { Benefits } from './shell';

const MAX_UNIVERSES = 6;
const BRAND_ROWS = 2;
const BRAND_ROW_SIZE = 4;
const NEW_ARRIVALS_SHOWN = 8;

// Ícone por categoria raiz (pelo endereço); categoria nova sem ícone cai em "pacote".
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'jogos-e-cartas': Dices,
  colecionaveis: Package,
  'lego-e-blocos': Blocks,
  'hqs-mangas-e-livros': BookOpen,
  'moda-geek': Shirt,
  'casa-e-utensilios': Lamp,
  'bolsas-e-mochilas': Luggage,
  'papelaria-e-escritorio': Pencil,
  'eletronicos-e-gadgets': Headphones,
  'alimentos-e-guloseimas': Cookie,
};

export async function Home() {
  const client = getQueryClient();
  const home = await client.fetchQuery(storeHomeQuery());
  const universes = [...home.categories]
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, MAX_UNIVERSES);
  const brandRows = await Promise.all(
    home.brands.slice(0, BRAND_ROWS).map(async (brand) => ({
      brand,
      products: (
        await client.fetchQuery(
          storeProductsQuery({ brand: brand.slug, in_stock: true, page_size: BRAND_ROW_SIZE })
        )
      ).data,
    }))
  );

  return (
    <>
      <div className="flex items-center justify-center gap-6 bg-geek-yellow px-5 py-[9px] text-xs font-black text-ink max-tablet:gap-[15px] max-md:flex-wrap max-md:gap-2.5 max-md:px-[5px] max-md:py-2 max-md:text-2xs">
        5% no Pix* <span className="size-[3px] rounded-[10px] bg-ink" /> Até 6x sem juros*{' '}
        <span className="size-[3px] rounded-[10px] bg-ink" /> Frete grátis a partir de R$ 299*{' '}
        <small className="text-2xs font-medium max-md:hidden">*Condições demonstrativas</small>
      </div>
      <CampaignSlider />
      <section className="wrap flex items-center gap-[25px] py-7 max-md:py-[22px]">
        <div className="flex items-center gap-3 text-sm font-black whitespace-nowrap max-tablet:hidden">
          Escolha seu universo <ChevronRight size={18} />
        </div>
        <div className="flex flex-1 gap-3.5 max-md:gap-2.5 max-md:overflow-auto max-md:pt-0.5 max-md:pr-[5px] max-md:pb-[9px]">
          {universes.map((category) => {
            const Icon = CATEGORY_ICONS[category.slug] ?? Package;
            return (
              <Link
                key={category.category_id}
                href={`/catalogo/?categoria=${category.slug}`}
                className="flex flex-1 items-center justify-between gap-2.5 rounded-xl border-2 border-foreground bg-surface px-[15px] py-[17px] text-sm font-black transition-transform duration-200 [box-shadow:3px_3px_var(--ink-shadow)] hover:-translate-y-[3px] hover:bg-geek-yellow hover:text-ink max-md:min-w-[145px] max-md:px-3 max-md:py-[13px] max-md:text-xs max-md:[&>svg:first-child]:w-5 max-md:[&>svg:last-child]:hidden"
              >
                <Icon size={24} />
                <span className="truncate">{category.name}</span>
                <ArrowRight size={16} />
              </Link>
            );
          })}
        </div>
      </section>
      <section className="wrap pt-[18px] pb-[40px] max-md:pt-1 max-md:pb-[30px]">
        <div className="section-heading">
          <div>
            <p className="eyebrow orange">Escolhidos para a sua próxima fase</p>
            <h2 className="section-title">Novos drops</h2>
          </div>
          <Link href="/catalogo/?ordem=newest">
            Ver todas as novidades <ArrowRight size={18} />
          </Link>
        </div>
        <Reveal>
          <ProductGrid items={home.new_arrivals.slice(0, NEW_ARRIVALS_SHOWN)} />
        </Reveal>
      </section>
      {brandRows.map(({ brand, products }) =>
        products.length > 0 ? (
          <section key={brand.slug} className="wrap pb-[40px] max-md:pb-[30px]">
            <div className="section-heading">
              <div>
                <p className="eyebrow orange">
                  {brand.product_count.toLocaleString('pt-BR')} produtos
                </p>
                <h2 className="section-title">Mais de {brand.name}</h2>
              </div>
              <Link href={`/catalogo/?marca=${brand.slug}`}>
                Ver tudo de {brand.name} <ArrowRight size={18} />
              </Link>
            </div>
            <Reveal>
              <ProductGrid items={products} />
            </Reveal>
          </section>
        ) : null
      )}
      <section className="overflow-hidden bg-geek-yellow text-ink">
        <div className="wrap relative flex min-h-[320px] items-center justify-between max-md:min-h-[270px]">
          <div className="py-[35px] max-md:relative max-md:z-1 max-md:max-w-[70%]">
            <p className="eyebrow max-md:text-2xs">Tem presente que vira coleção.</p>
            <h2 className="section-title mb-[25px] text-5xl max-md:max-w-[260px] max-md:text-3xl">
              Encontre o próximo
              <br />
              “era isso que eu queria!”
            </h2>
            <Link
              href="/catalogo/"
              className="action action-black max-md:max-w-[220px] max-md:px-3.5 max-md:py-2.5 max-md:text-xs"
            >
              Escolher um presente <ArrowRight size={18} />
            </Link>
          </div>
          <Image
            {...getMascot('parcel')}
            width={340}
            height={350}
            loading="lazy"
            className="-mb-[25px] h-[350px] w-[340px] self-end object-contain max-md:absolute max-md:-right-[38px] max-md:bottom-0 max-md:h-[230px] max-md:w-[190px]"
          />
        </div>
      </section>
      <Benefits />
    </>
  );
}
