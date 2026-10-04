'use client';

import { Button } from '@heroui/react';
import {
  ArrowRight,
  Droplets,
  Heart,
  Menu,
  Moon,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Trash2,
  Truck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Dialog, Quantity } from '@/components/ui';
import { getMascot } from '@/lib/mascot';
import { formatBRL } from './lib/money';
import { ProductImage } from './product-image';
import { useCartStore } from './state/cart-store';
import { StoreAlert } from './store-alert';
import { StoreSearch } from './store-search';

// Barra de categorias do cabeçalho: some ao descer mais que o limiar e volta ao subir.
const NAV_SCROLL_THRESHOLD = 8;
const NAV_ALWAYS_VISIBLE_Y = 80;

export type NavCategory = { name: string; slug: string };

const ICON_BTN =
  'place-items-center size-[39px] min-w-[39px] rounded-[10px] p-0 text-white hover:bg-white/8 max-md:size-[34px] max-md:min-w-[34px]';
const NAV_LINK = 'hover:text-geek-yellow';
const FOOTER_LINK = 'mb-2.5 block text-sm';
const FOOTER_TEXT = 'my-3 text-sm leading-[1.8]';
const FOOTER_TITLE = 'mb-[18px] text-base font-extrabold text-white';
const FREE_SHIPPING_THRESHOLD = 299;
const CENTS_PER_REAL = 100;

const BENEFITS = [
  { icon: Truck, title: 'Entrega para seu CEP', text: 'Consulte opções na compra' },
  { icon: ShieldCheck, title: 'Condições transparentes', text: 'Preço e frete antes de finalizar' },
  {
    icon: PackageCheck,
    title: 'Sua coleção em boas mãos',
    text: 'Conheça cada detalhe do produto',
  },
];

export function Shell({
  children,
  categories,
}: {
  children: ReactNode;
  categories: NavCategory[];
}) {
  const store = useCartStore();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = store.theme;
  }, [store.theme]);

  // A barra de categorias some ao rolar para baixo e volta ao rolar para cima (ou no topo da página).
  useEffect(() => {
    const handle = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      setScrolled(y > 20);
      if (y < NAV_ALWAYS_VISIBLE_Y || delta < -NAV_SCROLL_THRESHOLD) setNavHidden(false);
      else if (delta > NAV_SCROLL_THRESHOLD) setNavHidden(true);
      if (Math.abs(delta) > NAV_SCROLL_THRESHOLD) lastScrollY.current = y;
    };
    handle();
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  // Publica a altura atual do cabeçalho: o que "gruda" abaixo dele (filtros do catálogo) acompanha.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const publish = () =>
      document.documentElement.style.setProperty('--store-header-h', `${header.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: path isn't read here, it's only the trigger to close menu/search on route change.
  useEffect(() => {
    setMenu(false);
  }, [path]);

  const count = store.lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed inset-x-0 top-0 z-50 border-b text-white transition-[box-shadow,background-color] duration-200 ${
          store.headerStyle === 'glass' && scrolled
            ? 'border-white/10 bg-night/60 backdrop-blur-xl backdrop-saturate-150'
            : 'border-white/12 bg-night'
        } ${scrolled ? '[box-shadow:0_8px_24px_#00000059]' : ''}`}
      >
        <div className="wrap flex h-[78px] items-center gap-6 max-tablet:gap-[15px] max-md:grid max-md:h-28 max-md:grid-cols-[1fr_auto] max-md:gap-2 max-md:py-2">
          <Link
            className="w-[165px] shrink-0 px-3 py-[5px] max-tablet:w-[140px] max-md:w-[127px] max-md:px-2 max-md:py-0.5"
            href="/"
            aria-label="GeekStore, início"
          >
            <Image
              className="block h-[53px] w-full max-md:h-[42px]"
              src="/assets/geekstore-logo.png"
              alt="GeekStore"
              width={170}
              height={64}
              priority
            />
          </Link>
          <StoreSearch />
          <nav className="flex gap-[18px] text-sm font-extrabold whitespace-nowrap max-tablet:gap-2.5 max-md:hidden">
            <Link href="/entrar/">Entrar</Link>
            <Link href="/cadastro/">Cadastre-se</Link>
          </nav>
          <div className="flex items-center gap-[9px] max-md:col-start-2 max-md:row-start-1 max-md:gap-1.5">
            <Link
              className={`${ICON_BTN} grid max-tablet:hidden`}
              href="/favoritos/"
              aria-label="Favoritos"
            >
              <Heart size={21} />
            </Link>
            <Button
              isIconOnly
              aria-label={`Abrir carrinho, ${count} itens`}
              onPress={() => store.setCartOpen(true)}
              className={`${ICON_BTN} relative grid bg-night`}
            >
              <ShoppingCart size={22} />
              <span className="absolute -top-1.5 -right-[7px] h-[18px] min-w-[18px] rounded-full bg-geek-yellow px-1 text-2xs font-black text-ink">
                {count}
              </span>
            </Button>
            {/* Temporário, para comparar os dois estilos de cabeçalho (vidro x preto sólido). */}
            <Button
              isIconOnly
              className={`${ICON_BTN} grid bg-transparent max-md:hidden`}
              aria-label={`Cabeçalho ${store.headerStyle === 'glass' ? 'vidro' : 'sólido'}: alternar`}
              aria-pressed={store.headerStyle === 'glass'}
              onPress={store.toggleHeaderStyle}
            >
              <Droplets size={20} />
            </Button>
            <Button
              isIconOnly
              className={`${ICON_BTN} grid bg-transparent`}
              aria-label={store.theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              onPress={store.toggleTheme}
            >
              {store.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            <Button
              isIconOnly
              className={`${ICON_BTN} hidden bg-transparent max-md:grid`}
              aria-label="Menu"
              onPress={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </Button>
          </div>
        </div>
        <div
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
            navHidden ? 'max-h-0 opacity-0' : 'max-h-10 opacity-100'
          }`}
          aria-hidden={navHidden}
          inert={navHidden}
        >
          <div className="wrap flex h-10 items-center justify-between text-sm text-night-fg">
            <nav className="flex gap-[27px] font-bold max-md:w-full max-md:gap-[22px] max-md:overflow-x-auto max-md:text-xs max-md:whitespace-nowrap">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/catalogo/?categoria=${category.slug}`}
                  className={NAV_LINK}
                >
                  {category.name}
                </Link>
              ))}
              <Link href="/catalogo/?ordem=newest" className={`${NAV_LINK} text-geek-yellow`}>
                Novidades
              </Link>
            </nav>
            <span className="flex items-center gap-2 max-md:hidden">
              <Truck size={15} /> Seu próximo drop está aqui
            </span>
          </div>
        </div>
        {menu && (
          <nav className="hidden gap-[15px] bg-night-raised px-5 py-[15px] text-sm max-md:flex max-md:flex-col">
            <Link href="/entrar/">Entrar</Link>
            <Link href="/cadastro/">Criar conta</Link>
            <Link href="/favoritos/">Favoritos</Link>
            <Link href="/catalogo/">Catálogo completo</Link>
          </nav>
        )}
      </header>
      <main className="min-h-[70vh] pt-[119px] max-md:pt-[152px]">{children}</main>
      <footer className="bg-night pt-[50px] text-night-muted">
        <div className="wrap grid grid-cols-[1.4fr_1fr_1fr_1.3fr] gap-[50px] max-tablet:gap-[25px] max-md:grid-cols-2 max-md:gap-x-5 max-md:gap-y-7">
          <div>
            <Link href="/">
              <Image
                className="h-[65px] object-contain max-md:h-[50px] max-md:w-[150px]"
                src="/assets/geekstore-logo.png"
                alt="GeekStore"
                width={180}
                height={75}
              />
            </Link>
            <p className={FOOTER_TEXT}>
              Seu universo. Sua coleção.
              <br />
              Uma história nova em cada escolha.
            </p>
          </div>
          <div>
            <h3 className={FOOTER_TITLE}>Explore</h3>
            <Link className={FOOTER_LINK} href="/catalogo/">
              Todos os produtos
            </Link>
            <Link className={FOOTER_LINK} href="/catalogo/?ofertas=1">
              Ofertas
            </Link>
            <Link className={FOOTER_LINK} href="/favoritos/">
              Meus favoritos
            </Link>
          </div>
          <div>
            <h3 className={FOOTER_TITLE}>Sua conta</h3>
            <Link className={FOOTER_LINK} href="/entrar/">
              Entrar
            </Link>
            <Link className={FOOTER_LINK} href="/cadastro/">
              Cadastre-se
            </Link>
            <Link className={FOOTER_LINK} href="/ajuda/">
              Atendimento e trocas
            </Link>
          </div>
          <div>
            <h3 className={FOOTER_TITLE}>Sobre esta versão</h3>
            <p className={FOOTER_TEXT}>
              Loja demonstrativa. Produtos, preços e condições ilustrativos. Não recebe pagamentos.
            </p>
            <Link className={FOOTER_LINK} href="/admin/">
              Prévia do painel de gestão
            </Link>
          </div>
        </div>
        <div className="wrap mt-[35px] flex justify-between border-t border-white/12 py-[22px] text-xs max-md:gap-5 max-md:text-2xs">
          © 2026 GeekStore <span>Feito para quem coleciona histórias.</span>
        </div>
      </footer>
      <CartDialog />
      <StoreAlert notice={store.toast} onDismiss={store.dismissToast} />
    </>
  );
}

export function ShippingProgress({ total }: { total: number }) {
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - total);
  return (
    <div className="mt-2.5 mb-5 rounded-xl bg-surface-secondary p-3.5">
      <p className="flex flex-wrap items-center gap-1 text-sm">
        <Truck className="mr-1" size={18} />
        {remaining ? (
          <>
            Faltam <strong>{formatBRL(Math.round(remaining * CENTS_PER_REAL))}</strong> para frete
            grátis*
          </>
        ) : (
          <strong>Frete grátis desbloqueado neste exemplo!</strong>
        )}
      </p>
      <div className="mt-3 mb-[7px] h-[5px] overflow-hidden rounded-lg bg-border">
        <span
          className="block h-full bg-geek-yellow"
          style={{ width: `${Math.min(100, (total / FREE_SHIPPING_THRESHOLD) * 100)}%` }}
        />
      </div>
      <small className="text-2xs text-muted">
        *Condição demonstrativa, sujeita à configuração da loja.
      </small>
    </div>
  );
}

export function CartDialog() {
  const store = useCartStore();
  const totalCents = store.lines.reduce((sum, line) => sum + line.price_cents * line.qty, 0);
  return (
    <Dialog open={store.cartOpen} onChange={store.setCartOpen} title="Seu carrinho">
      {store.lines.length ? (
        <>
          <ShippingProgress total={totalCents / CENTS_PER_REAL} />
          <div className="grid max-h-[42vh] gap-[15px] overflow-x-hidden overflow-y-auto">
            {store.lines.map((line) => (
              <div
                className="grid grid-cols-[72px_1fr_30px] gap-3.5 border-b border-border pb-[15px]"
                key={line.sku_id}
              >
                <Link href={`/produto/${line.slug}/`} onClick={() => store.setCartOpen(false)}>
                  <span className="block h-[85px] w-[72px] overflow-hidden rounded-[9px]">
                    <ProductImage src={line.image_url} alt={line.name} />
                  </span>
                </Link>
                <div className="min-w-0">
                  <Link
                    className="text-sm font-extrabold wrap-anywhere"
                    href={`/produto/${line.slug}/`}
                    onClick={() => store.setCartOpen(false)}
                  >
                    {line.name}
                  </Link>
                  {line.variant && <small className="my-[5px] block text-sm">{line.variant}</small>}
                  <strong className="my-[5px] block text-sm">
                    {formatBRL(line.price_cents * line.qty)}
                  </strong>
                  <Quantity
                    value={line.qty}
                    max={line.max}
                    onChange={(qty) => store.quantity(line.sku_id, qty)}
                  />
                </div>
                <Button
                  isIconOnly
                  className="min-w-[26px] bg-transparent p-0 text-muted"
                  aria-label={`Remover ${line.name}`}
                  onPress={() => store.quantity(line.sku_id, 0)}
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between text-xl font-extrabold">
            <span>Subtotal</span>
            <strong>{formatBRL(totalCents)}</strong>
          </div>
          <p className="muted text-sm">Frete e descontos calculados na próxima etapa.</p>
          <Link
            href="/checkout/"
            className="action full mt-5"
            onClick={() => store.setCartOpen(false)}
          >
            Continuar para checkout <ArrowRight size={18} />
          </Link>
          <Button className="quiet full mt-2.5" onPress={() => store.setCartOpen(false)}>
            Continuar comprando
          </Button>
        </>
      ) : (
        <div className="empty">
          <Image {...getMascot('parcel')} width={210} height={240} />
          <h3>Sua próxima história está esperando.</h3>
          <p>Escolha algo que tenha a sua cara.</p>
          <Link href="/catalogo/" className="action" onClick={() => store.setCartOpen(false)}>
            Explorar produtos
          </Link>
        </div>
      )}
    </Dialog>
  );
}

export function Benefits() {
  return (
    <div className="wrap grid grid-cols-3 gap-[35px] py-[42px] max-md:grid-cols-1 max-md:gap-6 max-md:py-8">
      {BENEFITS.map(({ icon: Icon, title, text }) => (
        <span key={title} className="flex items-center gap-[15px]">
          <Icon className="w-7 text-brand-orange" />
          <div>
            <strong className="block text-sm">{title}</strong>
            <small className="text-xs text-muted">{text}</small>
          </div>
        </span>
      ))}
    </div>
  );
}
