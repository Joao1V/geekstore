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
import { Action, Dialog, Price, Quantity } from '@/components/ui';
import { money, type Product, pixPrice, products } from '@/lib/catalog';
import { ProductGrid } from './catalog';
import { useCartStore } from './state/cart-store';

export function Freight() {
  const [cep, setCep] = useState('');
  const [result, setResult] = useState(false);
  const [error, setError] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (cep.replace(/\D/g, '').length !== 8) {
      setError('Digite um CEP com 8 números.');
      setResult(false);
      return;
    }
    setError('');
    setResult(true);
  };

  const onCepChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
    setCep(digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits);
    setResult(false);
  };

  return (
    <div className="freight">
      <h3>
        <Truck size={18} /> Frete e prazo
      </h3>
      <form onSubmit={submit}>
        <input
          inputMode="numeric"
          aria-label="CEP para cálculo de frete"
          placeholder="00000-000"
          value={cep}
          maxLength={9}
          onChange={onCepChange}
        />
        <Button type="submit">Calcular</Button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && (
        <p role="status">
          Simulação: entrega padrão de R$ 19,90, em 5–8 dias úteis. A transportadora ainda não está
          conectada.
        </p>
      )}
      <small>Estimativa demonstrativa. Não consulte dados reais aqui.</small>
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
      <section className="wrap section product-detail">
        <nav className="breadcrumbs">
          <Link href="/">Início</Link>
          <ChevronRight size={14} />
          <Link href="/catalogo/">Produtos</Link>
          <ChevronRight size={14} />
          <span>{p.category}</span>
        </nav>
        <div className="detail-grid">
          <div>
            <button
              className="detail-image"
              type="button"
              onClick={() => setZoom(true)}
              aria-label="Ampliar imagem do produto"
            >
              <Image src={p.image} alt={p.name} fill sizes="(max-width: 767px) 100vw, 50vw" />
              <span>
                <ZoomIn size={18} /> Ampliar
              </span>
            </button>
            <p className="demo-note">Imagem ilustrativa do catálogo demonstrativo.</p>
            <div className="detail-note">
              <Package size={22} />
              <p>
                Feito para fazer parte da sua história.
                <br />
                <span className="muted">Confira as informações antes de escolher.</span>
              </p>
            </div>
          </div>
          <div className="buy-panel">
            <p className="eyebrow orange">{p.universe}</p>
            <h1>{p.name}</h1>
            <p className="muted text-sm">Produto demonstrativo • Sem avaliações ainda</p>
            <div className="detail-price">
              {p.previousPrice && <del>{money(p.previousPrice)}</del>}
              <Price value={pixPrice(p.price)} />
              <p className="pix">no Pix com 5% de desconto*</p>
              <p>
                ou {money(p.price)} em <strong>6x de {money(p.price / 6)} sem juros*</strong>
              </p>
            </div>
            {p.sizes && (
              <fieldset className="sizes">
                <legend>Tamanho {size && `— ${size}`}</legend>
                {p.sizes.map((v) => (
                  <Button
                    key={v}
                    className={size === v ? 'chosen' : ''}
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
            <div className="quantity-row">
              <div className="quantity-label">
                <span>Quantidade</span>
                <Quantity value={qty} max={p.stock} onChange={setQty} />
              </div>
              <small>{p.stock} disponíveis neste exemplo</small>
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Action className="full" onPress={() => add(true)}>
              Comprar agora <ArrowRight size={19} />
            </Action>
            <div className="secondary-actions">
              <Action className="outline" onPress={() => add()}>
                <ShoppingCart size={18} /> Adicionar
              </Action>
              <Button
                isIconOnly
                className="favorite-detail"
                aria-label="Favoritar produto"
                aria-pressed={isFavorite}
                onPress={() => store.favorite(p.id)}
              >
                <Heart size={21} fill={isFavorite ? 'currentColor' : 'none'} />
              </Button>
            </div>
            <Freight />
            <Link href="/ajuda/" className="trust-link">
              <ShieldCheck size={17} /> Consulte atendimento, trocas e devoluções
            </Link>
            <p className="demo-note">
              *Preços e condições de exemplo. Nenhuma cobrança é realizada.
            </p>
          </div>
        </div>
        <div className="detail-information">
          <div>
            <p className="eyebrow orange">Conheça seu próximo achado</p>
            <h2 className="section-title">Detalhes que importam</h2>
            <p>{p.description}</p>
          </div>
          <dl>
            {Object.entries(p.specs).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
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
      <div className="mobile-buy">
        <Price value={pixPrice(p.price)} />
        <Action onPress={() => add(true)}>Comprar agora</Action>
      </div>
      <Dialog open={zoom} onChange={setZoom} title={p.name} className="zoom-dialog">
        {/* biome-ignore lint/performance/noImgElement: zoom preview has no fixed container to size a next/image fill against */}
        <img src={p.image} alt={p.name} className="zoom-image" />
      </Dialog>
    </>
  );
}
