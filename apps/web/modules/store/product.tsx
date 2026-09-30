'use client';

import { Button } from '@heroui/react';
import {
  ArrowRight,
  ChevronRight,
  Heart,
  Package,
  ShieldCheck,
  ShoppingCart,
  Truck,
  ZoomIn,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Action, Dialog, FieldInput, Price, Quantity } from '@/components/ui';
import { money, type Product, pixPrice, products } from '@/lib/catalog';
import { ProductGrid } from './catalog';
import { useCartStore } from './state/cart-store';

const SIZE_BUTTON = 'min-w-[43px] rounded-lg text-foreground';

type FreightFormValues = { cep: string };

export function Freight() {
  const [result, setResult] = useState(false);
  const { control, handleSubmit, setError } = useForm<FreightFormValues>({
    defaultValues: { cep: '' },
  });

  const submit = ({ cep }: FreightFormValues) => {
    if (cep.replace(/\D/g, '').length !== 8) {
      setError('cep', { message: 'Digite um CEP com 8 números.' });
      setResult(false);
      return;
    }
    setResult(true);
  };

  return (
    <div className="freight mt-5 border-t border-border pt-5">
      <h3 className="flex items-center gap-2 text-sm font-extrabold">
        <Truck size={18} /> Frete e prazo
      </h3>
      <form onSubmit={handleSubmit(submit)} className="my-3 flex gap-2">
        <Controller
          control={control}
          name="cep"
          render={({ field, fieldState }) => (
            <FieldInput
              field={{
                ...field,
                onChange: (event) => {
                  const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
                  field.onChange(
                    digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
                  );
                  setResult(false);
                },
              }}
              fieldState={fieldState}
              label="CEP para cálculo de frete"
              inputMode="numeric"
              maxLength={9}
            />
          )}
        />
        <Action type="submit">Calcular</Action>
      </form>
      {result && (
        <p role="status" className="my-3 text-[13px]">
          Simulação: entrega padrão de R$ 19,90, em 5–8 dias úteis. A transportadora ainda não está
          conectada.
        </p>
      )}
      <small className="text-xs text-muted">
        Estimativa demonstrativa. Não consulte dados reais aqui.
      </small>
    </div>
  );
}

export function ProductDetail({ product: p }: { product: Product }) {
  const store = useCartStore();
  const router = useRouter();
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState(false);
  const [error, setError] = useState('');
  const isFavorite = store.favorites.includes(p.id);

  const add = (buy = false) => {
    if (p.sizes && !size) {
      setError('Escolha um tamanho antes de continuar.');
      return;
    }
    setError('');
    if (store.add(p, qty, size) && buy) router.push('/checkout/');
  };

  return (
    <>
      <section className="wrap section max-md:pb-[65px]">
        <nav className="mb-[26px] flex items-center gap-2.5 text-[13px] text-muted max-md:text-xs">
          <Link href="/">Início</Link>
          <ChevronRight size={14} />
          <Link href="/catalogo/">Produtos</Link>
          <ChevronRight size={14} />
          <span>{p.category}</span>
        </nav>
        <div className="grid grid-cols-[1.1fr_1fr] gap-[65px] max-tablet:gap-[35px] max-md:grid-cols-1 max-md:gap-7">
          <div>
            <button
              className="relative block aspect-square w-full overflow-hidden rounded-[20px] border-2 border-[#111] bg-[#eae9e8] [box-shadow:9px_9px_var(--ink-shadow)] max-md:max-h-[470px]"
              type="button"
              onClick={() => setZoom(true)}
              aria-label="Ampliar imagem do produto"
            >
              <Image
                className="object-cover"
                src={p.image}
                alt={p.name}
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
              />
              <span className="absolute right-[15px] bottom-[15px] flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-extrabold text-[#111]">
                <ZoomIn size={18} /> Ampliar
              </span>
            </button>
            <p className="demo-note">Imagem ilustrativa do catálogo demonstrativo.</p>
            <div className="mt-[25px] flex items-center gap-[15px] border-t border-border pt-[25px] text-sm max-md:hidden">
              <Package className="shrink-0 text-brand-orange" size={22} />
              <p>
                Feito para fazer parte da sua história.
                <br />
                <span className="muted">Confira as informações antes de escolher.</span>
              </p>
            </div>
          </div>
          <div>
            <p className="eyebrow orange">{p.universe}</p>
            <h1 className="mt-2.5 mb-4 text-[32px] leading-[1.16] font-black tracking-[-0.035em] max-md:text-[29px]">
              {p.name}
            </h1>
            <p className="muted text-sm">Produto demonstrativo • Sem avaliações ainda</p>
            <div className="my-6">
              {p.previousPrice && (
                <del className="mb-2 block text-sm text-muted">{money(p.previousPrice)}</del>
              )}
              <Price size="lg" value={pixPrice(p.price)} />
              <p className="pix">no Pix com 5% de desconto*</p>
              <p className="mt-2.5 text-sm text-muted">
                ou {money(p.price)} em <strong>6x de {money(p.price / 6)} sem juros*</strong>
              </p>
            </div>
            {p.sizes && (
              <fieldset className="mb-5 flex gap-2.5 border-0 p-0">
                <legend className="mb-[9px] text-sm font-extrabold">
                  Tamanho {size && `— ${size}`}
                </legend>
                {p.sizes.map((v) => (
                  <Button
                    key={v}
                    className={`${SIZE_BUTTON} ${size === v ? 'border-2 border-geek-yellow bg-[#ffbd0822]' : 'border border-border bg-surface'}`}
                    aria-pressed={size === v}
                    onPress={() => {
                      setSize(v);
                      setError('');
                    }}
                  >
                    {v}
                  </Button>
                ))}
              </fieldset>
            )}
            <div className="my-[22px] flex items-end justify-between">
              <div className="flex flex-col text-[13px] font-extrabold">
                <span>Quantidade</span>
                <Quantity value={qty} max={p.stock} onChange={setQty} />
              </div>
              <small className="text-xs text-muted">{p.stock} disponíveis neste exemplo</small>
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Action className="full" onPress={() => add(true)}>
              Comprar agora <ArrowRight size={19} />
            </Action>
            <div className="mt-3 mb-5 flex gap-3">
              <Action className="outline flex-1" onPress={() => add()}>
                <ShoppingCart size={18} /> Adicionar
              </Action>
              <Button
                isIconOnly
                className="size-[49px] border border-border bg-surface text-foreground"
                aria-label="Favoritar produto"
                aria-pressed={isFavorite}
                onPress={() => store.favorite(p.id)}
              >
                <Heart size={21} fill={isFavorite ? 'currentColor' : 'none'} />
              </Button>
            </div>
            <Freight />
            <Link href="/ajuda/" className="mt-[18px] flex items-center gap-2 text-[13px]">
              <ShieldCheck size={17} /> Consulte atendimento, trocas e devoluções
            </Link>
            <p className="demo-note">
              *Preços e condições de exemplo. Nenhuma cobrança é realizada.
            </p>
          </div>
        </div>
        <div className="mb-[15px] grid grid-cols-2 gap-[65px] py-[60px] max-md:grid-cols-1 max-md:gap-5 max-md:py-[35px]">
          <div>
            <p className="eyebrow muted leading-[1.8]">Conheça seu próximo achado</p>
            <h2 className="section-title max-md:text-[32px]">Detalhes que importam</h2>
            <p className="leading-[1.8] text-muted">{p.description}</p>
          </div>
          <dl className="rounded-[14px] border border-border bg-surface p-[25px]">
            {Object.entries(p.specs).map(([key, value]) => (
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
        <div className="section-heading">
          <div>
            <p className="eyebrow orange">Continue explorando</p>
            <h2 className="section-title">Combine universos</h2>
          </div>
          <Link href="/catalogo/">
            Ver todos <ArrowRight size={18} />
          </Link>
        </div>
        <ProductGrid items={products.filter((item) => item.id !== p.id)} />
      </section>
      {/* "mobile-buy" fica como marcador: o globals.css sobe o alerta (.store-alert-region) quando ele existe. */}
      <div className="mobile-buy fixed inset-x-0 bottom-0 z-40 hidden items-center justify-between border-t border-border bg-surface px-4 py-2.5 [box-shadow:0_-5px_20px_#0001] max-md:flex">
        <Price value={pixPrice(p.price)} />
        <Action
          className="max-md:min-h-[42px] max-md:px-4 max-md:py-2.5 max-md:text-[13px]"
          onPress={() => add(true)}
        >
          Comprar agora
        </Action>
      </div>
      <Dialog open={zoom} onChange={setZoom} title={p.name} className="zoom-dialog">
        {/* biome-ignore lint/performance/noImgElement: zoom preview has no fixed container to size a next/image fill against */}
        <img src={p.image} alt={p.name} className="max-h-[70vh] w-full object-contain" />
      </Dialog>
    </>
  );
}
