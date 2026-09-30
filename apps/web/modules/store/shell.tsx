'use client';

import { Button } from '@heroui/react';
import {
  ArrowRight,
  Heart,
  Menu,
  Moon,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Trash2,
  Truck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Dialog, Quantity } from '@/components/ui';
import { matches, money, products } from '@/lib/catalog';
import { getMascot } from '@/lib/mascot';
import { useCartStore } from './state/cart-store';
import { StoreAlert } from './store-alert';

const STORE_CATEGORIES = ['Colecionáveis', 'Games', 'Vestuário', 'RPG'];

const ICON_BTN =
  'place-items-center size-[39px] min-w-[39px] rounded-[10px] p-0 text-white hover:bg-white/8 max-md:size-[34px] max-md:min-w-[34px]';
const NAV_LINK = 'hover:text-geek-yellow';
const FOOTER_LINK = 'mb-2.5 block text-sm';
const FOOTER_TEXT = 'my-3 text-sm leading-[1.8]';
const FOOTER_TITLE = 'mb-[18px] text-base font-extrabold text-white';
const FREE_SHIPPING_THRESHOLD = 299;

const BENEFITS = [
  { icon: Truck, title: 'Entrega para seu CEP', text: 'Consulte opções na compra' },
  { icon: ShieldCheck, title: 'Condições transparentes', text: 'Preço e frete antes de finalizar' },
  {
    icon: PackageCheck,
    title: 'Sua coleção em boas mãos',
    text: 'Conheça cada detalhe do produto',
  },
];

type SearchFormValues = { q: string };

export function Shell({ children }: { children: ReactNode }) {
  const store = useCartStore();
  const router = useRouter();
  const path = usePathname();
  const { control, handleSubmit } = useForm<SearchFormValues>({ defaultValues: { q: '' } });
  const search = useWatch({ control, name: 'q' });
  const [menu, setMenu] = useState(false);
  const [focused, setFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = store.theme;
  }, [store.theme]);

  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 20);
    handle();
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: path isn't read here, it's only the trigger to close menu/search on route change.
  useEffect(() => {
    setMenu(false);
    setFocused(false);
  }, [path]);

  const count = store.lines.reduce((sum, line) => sum + line.qty, 0);
  const results = products.filter((p) => matches(p, search ?? '')).slice(0, 4);

  const submit = ({ q }: SearchFormValues) => {
    setFocused(false);
    router.push(`/catalogo/?q=${encodeURIComponent(q)}`);
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/12 bg-night text-white transition-shadow duration-200 ${scrolled ? '[box-shadow:0_8px_24px_#00000059]' : ''}`}
      >
        <div className="wrap flex h-[78px] items-center gap-6 max-tablet:gap-[15px] max-md:grid max-md:h-28 max-md:grid-cols-[1fr_auto] max-md:gap-2 max-md:py-2">
          <Link
            className="w-[165px] shrink-0 rounded-xl bg-night px-3 py-[5px] max-tablet:w-[140px] max-md:w-[127px] max-md:px-2 max-md:py-0.5"
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
          <div className="relative min-w-[120px] flex-1 max-md:col-span-full max-md:row-start-2">
            <form
              onSubmit={handleSubmit(submit)}
              className="flex h-[46px] items-center gap-2.5 rounded-[10px] bg-paper py-1 pr-[5px] pl-[15px] text-sm leading-normal font-semibold text-ink max-md:h-[41px]"
            >
              <Search size={20} />
              <Controller
                control={control}
                name="q"
                render={({ field }) => (
                  <input
                    {...field}
                    className="w-full border-0 bg-transparent focus-visible:outline-none!"
                    aria-label="Buscar produtos"
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                      field.onBlur();
                      setTimeout(() => setFocused(false), 180);
                    }}
                    placeholder="Qual é o seu próximo universo?"
                  />
                )}
              />
              <Button
                isIconOnly
                type="submit"
                aria-label="Pesquisar"
                className="size-9 min-w-9 rounded-lg bg-geek-yellow text-ink"
              >
                <ArrowRight size={20} />
              </Button>
            </form>
            {focused && search && (
              <div className="absolute inset-x-0 top-[54px] z-[51] rounded-xl border border-border bg-surface p-[18px] text-foreground [box-shadow:0_20px_45px_#0003]">
                <small className="text-xs tracking-[0.12em] text-muted">PRODUTOS</small>
                {results.length ? (
                  results.map((p) => (
                    <Link
                      key={p.id}
                      href={`/produto/${p.slug}/`}
                      onClick={() => setFocused(false)}
                      className="flex gap-3 border-b border-border py-3 text-sm font-extrabold"
                    >
                      <Image
                        className="size-[45px] rounded-[7px] object-cover"
                        src={p.image}
                        alt=""
                        width={45}
                        height={45}
                      />
                      <span>
                        {p.name}
                        <small className="mt-1 block text-xs text-muted">{money(p.price)}</small>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p>Nenhum produto. Tente “games” ou “RPG”.</p>
                )}
              </div>
            )}
          </div>
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
        <div className="wrap flex h-10 items-center justify-between text-sm text-night-fg">
          <nav className="flex gap-[27px] font-bold max-md:w-full max-md:gap-[22px] max-md:overflow-x-auto max-md:text-xs max-md:whitespace-nowrap">
            {STORE_CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/catalogo/?categoria=${encodeURIComponent(category)}`}
                className={NAV_LINK}
              >
                {category}
              </Link>
            ))}
            <Link href="/catalogo/?ofertas=1" className={`${NAV_LINK} text-geek-yellow`}>
              Ofertas
            </Link>
          </nav>
          <span className="flex items-center gap-2 max-md:hidden">
            <Truck size={15} /> Seu próximo drop está aqui
          </span>
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
            Faltam <strong>{money(remaining)}</strong> para frete grátis*
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
  const total = store.lines.reduce((sum, line) => {
    const product = products.find((p) => p.id === line.id);
    return sum + (product ? product.price * line.qty : 0);
  }, 0);
  return (
    <Dialog open={store.cartOpen} onChange={store.setCartOpen} title="Seu carrinho">
      {store.lines.length ? (
        <>
          <ShippingProgress total={total} />
          <div className="grid max-h-[42vh] gap-[15px] overflow-x-hidden overflow-y-auto">
            {store.lines.map((line, i) => {
              const product = products.find((p) => p.id === line.id);
              if (!product) return null;
              const reservedElsewhere = store.lines
                .filter((l, j) => l.id === line.id && i !== j)
                .reduce((sum, l) => sum + l.qty, 0);
              return (
                <div
                  className="grid grid-cols-[72px_1fr_30px] gap-3.5 border-b border-border pb-[15px]"
                  key={`${line.id}-${line.size}`}
                >
                  <Link href={`/produto/${product.slug}/`} onClick={() => store.setCartOpen(false)}>
                    <Image
                      className="h-[85px] w-[72px] rounded-[9px] object-cover"
                      src={product.image}
                      alt={product.name}
                      width={72}
                      height={85}
                    />
                  </Link>
                  <div className="min-w-0">
                    <Link
                      className="text-sm font-extrabold wrap-anywhere"
                      href={`/produto/${product.slug}/`}
                      onClick={() => store.setCartOpen(false)}
                    >
                      {product.name}
                    </Link>
                    {line.size && (
                      <small className="my-[5px] block text-sm">Tamanho: {line.size}</small>
                    )}
                    <strong className="my-[5px] block text-sm">
                      {money(product.price * line.qty)}
                    </strong>
                    <Quantity
                      value={line.qty}
                      max={product.stock - reservedElsewhere}
                      onChange={(qty) => store.quantity(i, qty)}
                    />
                  </div>
                  <Button
                    isIconOnly
                    className="min-w-[26px] bg-transparent p-0 text-muted"
                    aria-label={`Remover ${product.name}`}
                    onPress={() => store.quantity(i, 0)}
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between text-xl font-extrabold">
            <span>Subtotal</span>
            <strong>{money(total)}</strong>
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
