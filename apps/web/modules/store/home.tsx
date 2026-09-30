'use client';

import { ArrowRight, ChevronRight, Gamepad2, Package, Shirt, Swords } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getMascot } from '@/lib/mascot';
import { CampaignSlider } from './campaign-slider';
import { ProductGrid } from './catalog';
import { Reveal } from './reveal';
import { Benefits } from './shell';

const UNIVERSES = [
  { title: 'Colecionáveis', icon: Package },
  { title: 'Games', icon: Gamepad2 },
  { title: 'Vestuário', icon: Shirt },
  { title: 'RPG', icon: Swords },
];

export function Home() {
  return (
    <>
      <div className="flex items-center justify-center gap-6 bg-geek-yellow px-5 py-[9px] text-xs font-black text-[#161616] max-tablet:gap-[15px] max-md:flex-wrap max-md:gap-2.5 max-md:px-[5px] max-md:py-2 max-md:text-2xs">
        5% no Pix* <span className="size-[3px] rounded-[10px] bg-[#111]" /> Até 6x sem juros*{' '}
        <span className="size-[3px] rounded-[10px] bg-[#111]" /> Frete grátis a partir de R$ 299*{' '}
        <small className="text-2xs font-medium max-md:hidden">*Condições demonstrativas</small>
      </div>
      <CampaignSlider />
      <section className="wrap flex items-center gap-[25px] py-7 max-md:py-[22px]">
        <div className="flex items-center gap-3 whitespace-nowrap text-sm font-black max-tablet:hidden">
          Escolha seu universo <ChevronRight size={18} />
        </div>
        <div className="flex flex-1 gap-3.5 max-md:gap-2.5 max-md:overflow-auto max-md:pt-0.5 max-md:pr-[5px] max-md:pb-[9px]">
          {UNIVERSES.map((c) => (
            <Link
              key={c.title}
              href={`/catalogo/?categoria=${encodeURIComponent(c.title)}`}
              className="flex flex-1 items-center justify-between gap-2.5 rounded-xl border-2 border-foreground bg-surface px-[15px] py-[17px] text-sm font-black transition-transform duration-200 [box-shadow:3px_3px_var(--ink-shadow)] hover:-translate-y-[3px] hover:bg-geek-yellow hover:text-[#111] max-md:min-w-[145px] max-md:px-3 max-md:py-[13px] max-md:text-xs max-md:[&>svg:first-child]:w-5 max-md:[&>svg:last-child]:hidden"
            >
              <c.icon size={24} />
              {c.title}
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      </section>
      <section className="wrap pt-[18px] pb-[72px] max-md:pt-1 max-md:pb-[45px]">
        <div className="section-heading">
          <div>
            <p className="eyebrow orange">Escolhidos para a sua próxima fase</p>
            <h2 className="section-title">Novos drops</h2>
          </div>
          <Link href="/catalogo/">
            Ver coleção completa <ArrowRight size={18} />
          </Link>
        </div>
        <Reveal>
          <ProductGrid />
        </Reveal>
      </section>
      <section className="overflow-hidden bg-geek-yellow text-[#111]">
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
