// Controle de indexação por buscadores. Lido em RUNTIME (process.env), não no build: a mesma imagem
// serve o ambiente de teste e, depois, o lançamento, mudando só a variável no Dokploy.
//
// O padrão é SEGURO: sem a variável, nada é indexado. Para liberar a indexação no lançamento da
// loja, defina `NOINDEX=false`. O painel `/admin` nunca é indexado, com qualquer valor.

const NOINDEX_HEADER = 'noindex, nofollow, noarchive, nosnippet, noimageindex';
const ADMIN_PREFIX = '/admin';

/** `true` salvo quando `NOINDEX=false` foi definido de propósito. */
export function isSiteNoindex(): boolean {
  return process.env.NOINDEX !== 'false';
}

/** Valor do cabeçalho `X-Robots-Tag` para o caminho, ou `null` quando a página pode ser indexada. */
export function robotsHeaderFor(pathname: string): string | null {
  const isAdmin = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
  return isAdmin || isSiteNoindex() ? NOINDEX_HEADER : null;
}
