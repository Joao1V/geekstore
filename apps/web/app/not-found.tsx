import Image from 'next/image';
import Link from 'next/link';
import { getMascot } from '@/lib/mascot';

export default function NotFound() {
  return (
    <section className="wrap section empty">
      <Image {...getMascot('search')} width={210} height={240} />
      <h1 className="section-title">Esse portal não existe.</h1>
      <p>Vamos encontrar outra história?</p>
      <Link href="/catalogo/" className="action">
        Voltar para a coleção
      </Link>
    </section>
  );
}
