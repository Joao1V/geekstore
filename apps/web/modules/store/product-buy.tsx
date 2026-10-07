'use client';

import type { StoreProductDetail } from '@geekstore/shared';
import { Button } from '@heroui/react';
import { ArrowRight, Heart, Package, ShieldCheck, ShoppingCart, Truck, ZoomIn } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Action, Dialog, FieldInput, Price, Quantity } from '@/components/ui';
import { discountPercent, formatBRL, installmentPlan, pixCents } from './lib/money';
import { ProductImage } from './product-image';
import { useCartStore } from './state/cart-store';

const OPTION_BUTTON = 'min-w-[43px] rounded-lg px-3 text-foreground';
const LOW_STOCK_NOTICE = 3;

type Selection = Record<string, string>;
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
    <div className="mt-5 border-t border-border pt-5">
      <h3 className="flex items-center gap-2 text-sm font-extrabold">
        <Truck size={18} /> Frete e prazo
      </h3>
      <form onSubmit={handleSubmit(submit)} className="my-3 flex items-start gap-2">
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
        <Action
          type="submit"
          className="shrink-0 whitespace-nowrap [--action-bg:var(--surface-secondary)] [--action-fg:var(--foreground)]"
        >
          Calcular
        </Action>
      </form>
      {result && (
        <p role="status" className="my-3 text-sm">
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

const sameSelection = (sku: Selection, selection: Selection) =>
  Object.entries(selection).every(([code, value]) => sku[code] === value);

/** Galeria + painel de compra: escolher cor/tamanho, ver preço e saldo do SKU, adicionar ao carrinho. */
export function ProductBuy({ product }: { product: StoreProductDetail }) {
  const router = useRouter();
  const add = useCartStore((state) => state.add);
  const favorites = useCartStore((state) => state.favorites);
  const toggleFavorite = useCartStore((state) => state.favorite);

  // Atributo com um valor só já vem escolhido (não há o que decidir).
  const [selection, setSelection] = useState<Selection>(() =>
    Object.fromEntries(
      product.options.flatMap((option) =>
        option.values.length === 1 && option.values[0] ? [[option.code, option.values[0].code]] : []
      )
    )
  );
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [error, setError] = useState('');
  const isFavorite = favorites.includes(product.product_id);

  const complete = product.options.every((option) => selection[option.code]);
  const sku = useMemo(
    () =>
      complete
        ? product.skus.find((candidate) => sameSelection(candidate.attributes, selection))
        : undefined,
    [complete, product.skus, selection]
  );
  const prices = product.skus.map((item) => item.price_cents);
  const priceCents = sku?.price_cents ?? Math.min(...prices);
  const compareAt = sku ? sku.compare_at_cents : null;
  const fromPrice = !sku && Math.max(...prices) > Math.min(...prices);
  const available = sku?.available ?? 0;
  const inStockAny = product.skus.some((item) => item.available > 0);

  // Fotos: a do SKU escolhido (se tiver) vem primeiro; senão, as do produto.
  const images = useMemo(() => {
    const own = sku ? product.images.filter((image) => image.sku_id === sku.sku_id) : [];
    const shared = product.images.filter((image) => !own.includes(image));
    // Sem repetir a mesma foto (o endereço serve de chave na galeria).
    return [...own, ...shared].filter(
      (image, index, all) => all.findIndex((other) => other.url === image.url) === index
    );
  }, [product.images, sku]);
  const current = images[Math.min(imageIndex, Math.max(0, images.length - 1))];

  /** Um valor fica riscado quando nenhum SKU com ele (e com o resto já escolhido) tem estoque. */
  const valueAvailable = (code: string, value: string) =>
    product.skus.some(
      (item) =>
        item.available > 0 &&
        item.attributes[code] === value &&
        sameSelection(
          item.attributes,
          Object.fromEntries(Object.entries(selection).filter(([key]) => key !== code))
        )
    );

  const variantLabel = product.options
    .map((option) => option.values.find((value) => value.code === selection[option.code])?.label)
    .filter(Boolean)
    .join(' · ');

  const submit = (buyNow: boolean) => {
    if (!complete) {
      const missing = product.options
        .filter((option) => !selection[option.code])
        .map((option) => option.name.toLowerCase());
      setError(`Escolha uma opção de ${missing.join(' e ')} antes de continuar.`);
      return;
    }
    if (!sku || sku.available <= 0) {
      setError('Esta combinação está esgotada.');
      return;
    }
    setError('');
    const added = add(
      {
        sku_id: sku.sku_id,
        slug: product.slug,
        name: product.name,
        variant: variantLabel,
        image_url: images[0]?.url ?? null,
        price_cents: sku.price_cents,
        max: sku.available,
      },
      qty
    );
    if (added && buyNow) router.push('/checkout/');
  };

  const choose = (code: string, value: string) => {
    setSelection((currentSelection) => ({ ...currentSelection, [code]: value }));
    setQty(1);
    setError('');
    setImageIndex(0);
  };

  const onSale = compareAt !== null && compareAt > priceCents;
  const plan = installmentPlan(priceCents);

  return (
    <>
      <div className="grid grid-cols-[1.1fr_1fr] gap-[65px] max-tablet:gap-[35px] max-md:grid-cols-1 max-md:gap-7">
        <div>
          <button
            className="relative block aspect-square w-full overflow-hidden rounded-[20px] border-2 border-ink bg-placeholder [box-shadow:9px_9px_var(--ink-shadow)] max-md:max-h-[470px]"
            type="button"
            onClick={() => setZoom(true)}
            aria-label="Ampliar imagem do produto"
          >
            <ProductImage
              src={current?.url ?? null}
              alt={current?.alt ?? product.name}
              priority
              className="object-contain"
            />
            {current && (
              <span className="absolute right-[15px] bottom-[15px] flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-extrabold text-ink">
                <ZoomIn size={18} /> Ampliar
              </span>
            )}
          </button>
          {images.length > 1 && (
            <ul className="mt-4 flex flex-wrap gap-2.5 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-2">
              {images.map((image, index) => (
                <li key={image.url} className="shrink-0">
                  <button
                    type="button"
                    aria-label={`Ver foto ${index + 1}`}
                    aria-current={index === imageIndex ? 'true' : undefined}
                    onClick={() => setImageIndex(index)}
                    className={`size-[68px] overflow-hidden rounded-[10px] border-2 bg-placeholder ${index === imageIndex ? 'border-geek-yellow' : 'border-border'}`}
                  >
                    <ProductImage src={image.url} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
          <p className="eyebrow orange">
            {product.brand ? (
              <Link href={`/catalogo/?marca=${product.brand.slug}`}>{product.brand.name}</Link>
            ) : (
              product.category_path.at(-1)?.name
            )}
          </p>
          <h1 className="mt-2.5 mb-4 text-3xl leading-[1.16] font-black tracking-[-0.035em]">
            {product.name}
          </h1>
          <p className="muted text-sm">
            {sku
              ? `SKU ${sku.code}`
              : `${product.skus.length} ${product.skus.length === 1 ? 'versão' : 'versões'} disponíveis`}
          </p>
          <div className="my-6">
            {onSale && (
              <del className="mb-2 block text-sm text-muted">
                {formatBRL(compareAt ?? 0)}{' '}
                <span className="ml-1 font-extrabold text-status-success">
                  -{discountPercent(priceCents, compareAt ?? priceCents)}%
                </span>
              </del>
            )}
            {fromPrice && <span className="mb-1 block text-xs text-muted">A partir de</span>}
            <Price size="lg" value={priceCents / 100} />
            {plan && (
              <p className="mt-2.5 text-base font-extrabold text-status-success">
                em {plan.count}x {formatBRL(plan.valueCents)} sem juros*
              </p>
            )}
            <p className="mt-2 text-sm text-muted">
              ou <strong className="text-foreground">{formatBRL(pixCents(priceCents))}</strong> no
              Pix (5% de desconto*)
            </p>
          </div>
          {product.options.map((option) => (
            <fieldset key={option.code} className="mb-5 flex flex-wrap gap-2.5 border-0 p-0">
              <legend className="mb-[9px] text-sm font-extrabold">
                {option.name}
                {selection[option.code] &&
                  ` — ${option.values.find((value) => value.code === selection[option.code])?.label ?? ''}`}
              </legend>
              {option.values.map((value) => {
                const selected = selection[option.code] === value.code;
                const inStock = valueAvailable(option.code, value.code);
                return (
                  <Button
                    key={value.code}
                    className={`${OPTION_BUTTON} ${selected ? 'border-2 border-geek-yellow bg-geek-yellow/13' : 'border border-border bg-surface'} ${inStock ? '' : 'opacity-50'}`}
                    aria-pressed={selected}
                    aria-label={inStock ? value.label : `${value.label} (esgotado)`}
                    onPress={() => choose(option.code, value.code)}
                  >
                    {value.color_hex && (
                      <span
                        aria-hidden="true"
                        className="mr-2 inline-block size-4 rounded-full border border-border"
                        style={{ backgroundColor: value.color_hex }}
                      />
                    )}
                    <span className={inStock ? '' : 'line-through'}>{value.label}</span>
                  </Button>
                );
              })}
            </fieldset>
          ))}
          <div className="my-[22px] flex items-end justify-between">
            <div className="flex flex-col text-sm font-extrabold">
              <span>Quantidade</span>
              <Quantity value={qty} max={Math.max(1, available)} onChange={setQty} />
            </div>
            <small className="text-xs text-muted">
              {!sku
                ? inStockAny
                  ? 'Escolha as opções para ver o estoque'
                  : 'Produto esgotado'
                : available <= 0
                  ? 'Esgotado nesta combinação'
                  : available <= LOW_STOCK_NOTICE
                    ? available === 1
                      ? 'Última unidade'
                      : `Últimas ${available} unidades`
                    : `${available} disponíveis`}
            </small>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Action className="full" onPress={() => submit(true)} disabled={!inStockAny}>
            {inStockAny ? 'Comprar agora' : 'Esgotado'} <ArrowRight size={19} />
          </Action>
          <div className="mt-3 mb-5 flex gap-3">
            <Action
              className="action-outline flex-1"
              onPress={() => submit(false)}
              disabled={!inStockAny}
            >
              <ShoppingCart size={18} /> Adicionar
            </Action>
            <Button
              isIconOnly
              className="size-[49px] border border-border bg-surface text-foreground"
              aria-label="Favoritar produto"
              aria-pressed={isFavorite}
              onPress={() => toggleFavorite(product.product_id)}
            >
              <Heart size={21} fill={isFavorite ? 'currentColor' : 'none'} />
            </Button>
          </div>
          <Freight />
          <Link href="/ajuda/" className="mt-[18px] flex items-center gap-2 text-sm">
            <ShieldCheck size={17} /> Consulte atendimento, trocas e devoluções
          </Link>
          <p className="demo-note">*Preços e condições de exemplo. Nenhuma cobrança é realizada.</p>
        </div>
      </div>
      {/* "mobile-buy" é marcador: o StoreAlert sobe quando ele existe (in-has-[.mobile-buy]). */}
      <div className="mobile-buy fixed inset-x-0 bottom-0 z-40 hidden items-center justify-between border-t border-border bg-surface px-4 py-2.5 [box-shadow:0_-5px_20px_#0001] max-md:flex">
        <Price value={priceCents / 100} />
        <Action
          className="max-md:min-h-[42px] max-md:px-4 max-md:py-2.5 max-md:text-sm"
          onPress={() => submit(true)}
          disabled={!inStockAny}
        >
          {inStockAny ? 'Comprar agora' : 'Esgotado'}
        </Action>
      </div>
      <Dialog open={zoom} onChange={setZoom} title={product.name} size="lg">
        <div className="flex max-h-[70vh] justify-center">
          <ProductImage
            src={current?.url ?? null}
            alt={current?.alt ?? product.name}
            className="max-h-[70vh] object-contain"
          />
        </div>
      </Dialog>
    </>
  );
}
