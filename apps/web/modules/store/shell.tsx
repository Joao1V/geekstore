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
import { Dialog, Quantity } from '@/components/ui';
import { matches, money, products } from '@/lib/catalog';
import { getMascot } from '@/lib/mascot';
import { useCartStore } from './state/cart-store';
import { StoreAlert } from './store-alert';

const STORE_CATEGORIES = ['Colecionáveis', 'Games', 'Vestuário', 'RPG'];

export function Shell({ children }: { children: ReactNode }) {
  const store = useCartStore();
  const router = useRouter();
  const path = usePathname();
  const [search, setSearch] = useState('');
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
  const results = products.filter((p) => matches(p, search)).slice(0, 4);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFocused(false);
    router.push(`/catalogo/?q=${encodeURIComponent(search)}`);
  };

  return (
    <>
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="header-main wrap">
          <Link className="logo" href="/" aria-label="GeekStore, início">
            <Image
              src="/assets/geekstore-logo.png"
              alt="GeekStore"
              width={170}
              height={64}
              priority
            />
          </Link>
          <div className="search-wrap">
            <form onSubmit={submit} className="search">
              <Search size={20} />
              <input
                aria-label="Buscar produtos"
                value={search}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 180)}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Qual é o seu próximo universo?"
              />
              <Button isIconOnly type="submit" aria-label="Pesquisar">
                <ArrowRight size={20} />
              </Button>
            </form>
            {focused && search && (
              <div className="suggestions">
                <small>PRODUTOS</small>
                {results.length ? (
                  results.map((p) => (
                    <Link key={p.id} href={`/produto/${p.slug}/`} onClick={() => setFocused(false)}>
                      <Image src={p.image} alt="" width={45} height={45} />
                      <span>
                        {p.name}
                        <small>{money(p.price)}</small>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p>Nenhum produto. Tente “games” ou “RPG”.</p>
                )}
              </div>
            )}
          </div>
          <nav className="account-nav">
            <Link href="/entrar/">Entrar</Link>
            <Link href="/cadastro/">Cadastre-se</Link>
          </nav>
          <div className="header-actions">
            <Link className="icon-btn favorites-icon" href="/favoritos/" aria-label="Favoritos">
              <Heart size={21} />
            </Link>
            <Button
              isIconOnly
              aria-label={`Abrir carrinho, ${count} itens`}
              onPress={() => store.setCartOpen(true)}
              className="icon-btn cart-trigger"
            >
              <ShoppingCart size={22} />
              <span>{count}</span>
            </Button>
            <Button
              isIconOnly
              className="icon-btn"
              aria-label={store.theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              onPress={store.toggleTheme}
            >
              {store.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            <Button
              isIconOnly
              className="icon-btn mobile-menu"
              aria-label="Menu"
              onPress={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </Button>
          </div>
        </div>
        <div className="header-bottom wrap">
          <nav>
            {STORE_CATEGORIES.map((category) => (
              <Link key={category} href={`/catalogo/?categoria=${encodeURIComponent(category)}`}>
                {category}
              </Link>
            ))}
            <Link href="/catalogo/?ofertas=1" className="yellow">
              Ofertas
            </Link>
          </nav>
          <span>
            <Truck size={15} /> Seu próximo drop está aqui
          </span>
        </div>
        {menu && (
          <nav className="mobile-links">
            <Link href="/entrar/">Entrar</Link>
            <Link href="/cadastro/">Criar conta</Link>
            <Link href="/favoritos/">Favoritos</Link>
            <Link href="/catalogo/">Catálogo completo</Link>
          </nav>
        )}
      </header>
      <main>{children}</main>
      <footer>
        <div className="wrap footer-grid">
          <div>
            <Link href="/">
              <Image
                className="footer-logo"
                src="/assets/geekstore-logo.png"
                alt="GeekStore"
                width={180}
                height={75}
              />
            </Link>
            <p>
              Seu universo. Sua coleção.
              <br />
              Uma história nova em cada escolha.
            </p>
          </div>
          <div>
            <h3>Explore</h3>
            <Link href="/catalogo/">Todos os produtos</Link>
            <Link href="/catalogo/?ofertas=1">Ofertas</Link>
            <Link href="/favoritos/">Meus favoritos</Link>
          </div>
          <div>
            <h3>Sua conta</h3>
            <Link href="/entrar/">Entrar</Link>
            <Link href="/cadastro/">Cadastre-se</Link>
            <Link href="/ajuda/">Atendimento e trocas</Link>
          </div>
          <div>
            <h3>Sobre esta versão</h3>
            <p>
              Loja demonstrativa. Produtos, preços e condições ilustrativos. Não recebe pagamentos.
            </p>
            <Link href="/admin/">Prévia do painel de gestão</Link>
          </div>
        </div>
        <div className="wrap footer-bottom">
          © 2026 GeekStore <span>Feito para quem coleciona histórias.</span>
        </div>
      </footer>
      <CartDialog />
      <StoreAlert notice={store.toast} onDismiss={store.dismissToast} />
    </>
  );
}

export function ShippingProgress({ total }: { total: number }) {
  const FREE_SHIPPING_THRESHOLD = 299;
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - total);
  return (
    <div className="shipping-progress">
      <p>
        <Truck size={18} />
        {remaining ? (
          <>
            Faltam <strong>{money(remaining)}</strong> para frete grátis*
          </>
        ) : (
          <strong>Frete grátis desbloqueado neste exemplo!</strong>
        )}
      </p>
      <div>
        <span style={{ width: `${Math.min(100, (total / FREE_SHIPPING_THRESHOLD) * 100)}%` }} />
      </div>
      <small>*Condição demonstrativa, sujeita à configuração da loja.</small>
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
    <Dialog
      open={store.cartOpen}
      onChange={store.setCartOpen}
      title="Seu carrinho"
      className="cart-dialog"
    >
      {store.lines.length ? (
        <>
          <ShippingProgress total={total} />
          <div className="cart-lines">
            {store.lines.map((line, i) => {
              const product = products.find((p) => p.id === line.id);
              if (!product) return null;
              const reservedElsewhere = store.lines
                .filter((l, j) => l.id === line.id && i !== j)
                .reduce((sum, l) => sum + l.qty, 0);
              return (
                <div className="cart-line" key={`${line.id}-${line.size}`}>
                  <Link href={`/produto/${product.slug}/`} onClick={() => store.setCartOpen(false)}>
                    <Image src={product.image} alt={product.name} width={72} height={85} />
                  </Link>
                  <div>
                    <Link
                      href={`/produto/${product.slug}/`}
                      onClick={() => store.setCartOpen(false)}
                    >
                      {product.name}
                    </Link>
                    {line.size && <small>Tamanho: {line.size}</small>}
                    <strong>{money(product.price * line.qty)}</strong>
                    <Quantity
                      value={line.qty}
                      max={product.stock - reservedElsewhere}
                      onChange={(qty) => store.quantity(i, qty)}
                    />
                  </div>
                  <Button
                    isIconOnly
                    aria-label={`Remover ${product.name}`}
                    onPress={() => store.quantity(i, 0)}
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="cart-total">
            <span>Subtotal</span>
            <strong>{money(total)}</strong>
          </div>
          <p className="muted text-sm">Frete e descontos calculados na próxima etapa.</p>
          <Link href="/checkout/" className="action full" onClick={() => store.setCartOpen(false)}>
            Continuar para checkout <ArrowRight size={18} />
          </Link>
          <Button className="quiet full" onPress={() => store.setCartOpen(false)}>
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
    <div className="benefits wrap">
      <span>
        <Truck />
        <div>
          <strong>Entrega para seu CEP</strong>
          <small>Consulte opções na compra</small>
        </div>
      </span>
      <span>
        <ShieldCheck />
        <div>
          <strong>Condições transparentes</strong>
          <small>Preço e frete antes de finalizar</small>
        </div>
      </span>
      <span>
        <PackageCheck />
        <div>
          <strong>Sua coleção em boas mãos</strong>
          <small>Conheça cada detalhe do produto</small>
        </div>
      </span>
    </div>
  );
}
