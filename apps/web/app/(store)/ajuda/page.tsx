import Link from 'next/link';

const HELP_TEXT = 'leading-[1.8] text-muted';
const HELP_TITLE = 'mt-[22px] mb-2.5 text-xl font-black';

export const metadata = { title: 'Atendimento e informações' };

export default function Page() {
  return (
    <section className="wrap section max-w-[850px]">
      <p className={`eyebrow ${HELP_TEXT}`}>Sem surpresas</p>
      <h1 className="section-title">Estamos construindo sua loja.</h1>
      <p className={HELP_TEXT}>
        Esta GeekStore é uma demonstração navegável. Não há pedidos, cobranças ou entregas reais
        nesta versão.
      </p>
      <div className="surface my-7 p-[30px] max-md:p-[22px]">
        <h2 className={HELP_TITLE}>Entrega, trocas e atendimento</h2>
        <p className={HELP_TEXT}>
          Os canais de contato, identificação da empresa, endereço e políticas definitivas serão
          preenchidos com os dados reais da operação antes do lançamento. Os valores e prazos
          exibidos hoje são apenas exemplos.
        </p>
        <h2 className={HELP_TITLE}>Dados e privacidade nesta demonstração</h2>
        <p className={HELP_TEXT}>
          Preferência de tema, carrinho e favoritos são salvos somente neste navegador. Formulários
          de conta e checkout não enviam informações a um backend. Não insira dados pessoais reais.
        </p>
        <h2 className={HELP_TITLE}>Autenticidade dos produtos</h2>
        <p className={HELP_TEXT}>
          As fotos e descrições do catálogo são ilustrativas. A loja deverá cadastrar fotografias
          reais, origem, medidas e condições verificadas antes de disponibilizar produtos à venda.
        </p>
      </div>
      <Link href="/catalogo/" className="action">
        Voltar ao catálogo
      </Link>
    </section>
  );
}
