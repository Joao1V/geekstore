import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { getMascot, type MascotPose } from '@/lib/mascot';
import { GeekPattern } from './geek-pattern';

type Props = {
  /** O formulário (lado esquerdo). */
  children: ReactNode;
  /** Linha pequena acima do título do painel. */
  kicker: string;
  /** Título grande do painel (use `<br />` para quebrar). */
  headline: ReactNode;
  pose?: MascotPose;
  backHref?: string;
  backLabel?: string;
  /** `store`: painel amarelo à direita. `admin`: painel preto à esquerda, para parecer outra área. */
  variant?: 'store' | 'admin';
};

/**
 * Tela de entrar em dois lados: formulário limpo e painel da marca com brilho pulsando e o mascote
 * parado. Loja: painel amarelo à direita. Admin: painel preto à esquerda e formulário à direita.
 * O painel some no tablet/celular (só o formulário).
 * Compartilhada pela loja e pelo admin, por isso mora em `components/ui`.
 */
export function AuthSplit({
  children,
  kicker,
  headline,
  pose = 'welcome',
  backHref = '/',
  backLabel = 'Voltar para a loja',
  variant = 'store',
}: Props) {
  const isAdmin = variant === 'admin';
  return (
    <div
      className={`grid min-h-dvh bg-surface max-tablet:grid-cols-1 ${
        isAdmin
          ? 'grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]'
          : 'grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]'
      }`}
    >
      <div className="flex flex-col px-10 py-7 max-md:px-5 max-md:py-5">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="GeekStore, início"
            className="font-display text-4xl tracking-wide"
          >
            <span className="text-geek-yellow">Geek</span>
            <span className="text-foreground">Store</span>
          </Link>
          <Link href={backHref} className="back-link">
            <ArrowLeft size={17} /> {backLabel}
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          {children}
        </div>
      </div>
      <aside
        className={`relative flex flex-col justify-between overflow-hidden p-12 max-tablet:hidden ${
          isAdmin ? 'order-first bg-night text-night-fg' : 'bg-geek-yellow text-ink'
        }`}
      >
        <GeekPattern tone={isAdmin ? 'text-night-fg' : 'text-ink'} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={`absolute right-[-12%] bottom-[-18%] size-[85%] animate-glow rounded-full blur-3xl motion-reduce:animate-none ${
              isAdmin ? 'bg-geek-yellow/25' : 'bg-white/60'
            }`}
          />
        </div>
        <div className="relative z-1">
          <p className={`eyebrow ${isAdmin ? 'orange' : ''}`}>{kicker}</p>
          <h2
            className={`font-display my-5 text-8xl leading-[0.98] ${isAdmin ? 'text-geek-yellow' : ''}`}
          >
            {headline}
          </h2>
        </div>
        <Image
          {...getMascot(pose)}
          width={400}
          height={475}
          priority
          className="relative z-1 -mb-12 ml-auto h-[52vh] max-h-[560px] w-auto object-contain object-bottom"
        />
      </aside>
    </div>
  );
}
