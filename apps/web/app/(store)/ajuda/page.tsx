import Link from 'next/link';

export const metadata = { title: 'Atendimento e informações' };

export default function Page() {
  return (
    <section className="wrap section help">
      <p className="eyebrow orange">Sem surpresas</p>
      <h1 className="section-title">Estamos construindo sua loja.</h1>
      <p>
        Esta GeekStore é uma demonstração navegável. Não há pedidos, cobranças ou entregas reais
        nesta versão.
      </p>
      <div className="surface">
        <h2>Entrega, trocas e atendimento</h2>
        <p>
          Os canais de contato, identificação da empresa, endereço e políticas definitivas serão
          preenchidos com os dados reais da operação antes do lançamento. Os valores e prazos
          exibidos hoje são apenas exemplos.
        </p>
        <h2>Dados e privacidade nesta demonstração</h2>
        <p>
          Preferência de tema, carrinho e favoritos são salvos somente neste navegador. Formulários
          de conta e checkout não enviam informações a um backend. Não insira dados pessoais reais.
        </p>
        <h2>Autenticidade dos produtos</h2>
        <p>
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
