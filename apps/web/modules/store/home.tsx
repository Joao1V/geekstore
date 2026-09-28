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
      <div className="offer-strip">
        5% no Pix* <span /> Até 6x sem juros* <span /> Frete grátis a partir de R$ 299*{' '}
        <small>*Condições demonstrativas</small>
      </div>
      <CampaignSlider />
      <section className="wrap universe-section">
        <div className="universe-label">
          Escolha seu universo <ChevronRight size={18} />
        </div>
        <div className="universe-links">
          {UNIVERSES.map((c) => (
            <Link key={c.title} href={`/catalogo/?categoria=${encodeURIComponent(c.title)}`}>
              <c.icon size={24} />
              {c.title}
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      </section>
      <section className="wrap section home-products">
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
      <section className="feature-banner">
        <div className="wrap">
          <div>
            <p className="eyebrow">Tem presente que vira coleção.</p>
            <h2 className="section-title">
              Encontre o próximo
              <br />
              “era isso que eu queria!”
            </h2>
            <Link href="/catalogo/" className="action black">
              Escolher um presente <ArrowRight size={18} />
            </Link>
          </div>
          <Image {...getMascot('parcel')} width={340} height={350} loading="lazy" />
        </div>
      </section>
      <Benefits />
    </>
  );
}
