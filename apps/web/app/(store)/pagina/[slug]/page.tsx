import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Markdown } from '@/components/markdown';
import { ApiError } from '@/lib/api';
import { getQueryClient } from '@/lib/get-query-client';
import { storePageQuery } from '@/modules/store/services/content/queries';

type Props = { params: Promise<{ slug: string }> };

async function loadPage(slug: string) {
  try {
    return await getQueryClient().fetchQuery(storePageQuery(slug));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return { title: 'Página não encontrada' };
  return {
    title: page.seo_title || page.title,
    ...(page.seo_description ? { description: page.seo_description } : {}),
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();
  return (
    <section className="wrap section max-w-[850px]">
      <h1 className="section-title">{page.title}</h1>
      <div className="surface my-7 p-[30px] text-muted max-md:p-[22px]">
        <Markdown text={page.body} />
      </div>
      <Link href="/catalogo/" className="action">
        Voltar ao catálogo
      </Link>
    </section>
  );
}
