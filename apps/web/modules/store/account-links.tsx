'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useLogout } from './services/customer/mutations';
import { useCustomerStore } from './state/customer-store';

type Variant = 'header' | 'menu' | 'footer';

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Os links da conta no cabeçalho, no menu do celular e no rodapé: mudam quando a pessoa está logada. */
export function AccountLinks({
  variant,
  linkClassName,
}: {
  variant: Variant;
  linkClassName?: string;
}) {
  const router = useRouter();
  const customer = useCustomerStore((state) => state.customer);
  const logout = useLogout();

  const leave = async () => {
    await logout.mutateAsync().catch(() => undefined);
    router.push('/');
  };

  if (!customer) {
    return (
      <>
        <Link href="/entrar/" className={linkClassName}>
          Entrar
        </Link>
        <Link href="/cadastro/" className={linkClassName}>
          {variant === 'menu' ? 'Criar conta' : 'Cadastre-se'}
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href="/conta/" className={linkClassName}>
        {variant === 'footer' ? 'Minha conta' : `Olá, ${firstName(customer.name)}`}
      </Link>
      {variant !== 'header' && (
        <Link href="/conta/pedidos/" className={linkClassName}>
          Meus pedidos
        </Link>
      )}
      <button type="button" onClick={leave} className={`${linkClassName ?? ''} text-left`}>
        Sair
      </button>
    </>
  );
}
