# Plano: entrada da base oficial (catálogo, estoque, clientes, pedidos)

**Estado em 14/10/2026:** a produção (gk-loja / gk-admin) está carregada com uma base de brinquedo: o export do ERP de teste (22.472 produtos, 25.673 SKUs) normalizado por nós. Serve para o preview. A base oficial vem depois e passa por este plano antes de ir para o ar.

## O que a base de teste nos ensinou
| Achado | Consequência para a base oficial |
|---|---|
| O ERP guarda **uma foto por SKU**; cor × tamanho gera várias fotos com o mesmo conteúdo e URLs diferentes (ex.: pijama Starlit, 14 fotos para 2 imagens). ~660 produtos têm várias fotos por SKU | Deduplicar por **conteúdo** (hash) na importação, não por URL |
| Nomes com acento perdido, caixa e unidade misturadas, famílias de variação espalhadas em produtos soltos | Manter o pipeline `normalize:*`, mas com **revisão do cliente** antes de gravar |
| Categorias do ERP não batem com a árvore da loja | Classificador próprio + revisão por amostra (a IA ajudou, o cliente aprova) |
| Importação é repetível por `legacy_code` | Rodar de novo na base oficial sem duplicar |
| Logos de marca são subidos à mão no admin | Subir de novo no bucket de produção |

## Fases
### 1. Receber e conferir (sem tocar em nada)
- Pedir o export completo do ERP (produtos, estoque por local, custo, preço, EAN/NCM, peso e medidas, fotos) e, se existir, clientes e pedidos.
- Relatório de qualidade: SKUs sem código, EAN duplicado, sem preço, sem peso/medidas (o frete real precisa disso), sem foto, nomes suspeitos.
- **Decisões do cliente por escrito:** convenção de SKU (`TIPO-NNNNN-VAR`), o que é produto com variação e o que é item solto, política para item sem estoque ou sem foto (publica ou não).

### 2. Normalizar e revisar
- Rodar `normalize:catalog` com as regras atuais; gerar `revisao.csv`, `consolidacao-revisao.csv` e `familias-*.csv` só com as **dúvidas**.
- Cliente aprova (RF-MIG-02) antes de gravar. Tudo o que for decisão fica em arquivo versionado fora do `.temp`.
- Novo passo: **deduplicação de fotos por hash** e preenchimento de peso/medidas por categoria quando faltar (com marca "estimado").

### 3. Ensaiar em staging
- Subir um segundo ambiente (banco e Redis próprios, domínio de staging) e importar lá primeiro.
- Conferir: contagens por categoria, amostra de 100 produtos lado a lado com o ERP, SKUs únicos, saldo de estoque batendo com o livro-razão (conferência RF-EST-10 sem divergência), busca e página de produto.
- Medir o tempo da importação (a de teste levou ~10 min pelo link).

### 4. Colocar em produção
- **Antes:** backup do banco (já há destino R2 configurado) e congelar edições no admin.
- **Limpar a base de teste** (produtos, SKUs, preços, estoque, mídia, coleções e movimentos; manter usuários, papéis, canais e locais) com um script versionado e conferido por contagem.
- Importar a base oficial. Rodar a importação **dentro do ambiente do Dokploy** (job com a imagem da API), sem abrir a porta do Postgres como fizemos para o teste.
- Estoque inicial vem como "carga inicial" no livro-razão; custo inicial vira entrada de abertura.
- Conferir de novo (mesmos relatórios da fase 3) e só então liberar.

### 5. Clientes, pedidos e redirects
- Clientes sem senha (RF-MIG-05) e pedidos históricos; ligar o fluxo de "criar senha" por e-mail para quem vem da Tray.
- Levantar as URLs indexadas (Search Console e sitemap da Tray) e rodar o crawl de comparação para o mapa de 301 (RF-MIG-03).

### 6. Depois da carga
- Backup agendado com restauração testada, rastreio de erros e alertas, plano de virada e de volta.
- Nota fiscal do dia 1 definida pelo cliente (RF-FIS-03).

## Riscos
| Risco | Mitigação |
|---|---|
| Apagar a base de teste levar usuários ou configurações | Script só toca nas tabelas do catálogo; conferência por contagem antes e depois |
| SKU duplicado ou ausente no export oficial | Relatório da fase 1 e aprovação do cliente antes de gravar (R3) |
| Foto duplicada por conteúdo | Hash na importação; relatório do que foi unido |
| Importação interrompida no meio | Repetível por `legacy_code`; rodar de novo completa o que falta |
| Fotos hospedadas em terceiros (mercofotos) saírem do ar | Copiar para o bucket próprio durante a importação |
| Peso e medidas ausentes quebram a cotação de frete | Valor mínimo por categoria marcado como estimado, e relatório do que falta preencher |

## O que preciso do cliente
1. O export oficial e quem responde por ele (dúvidas de campo).
2. Aprovar as regras de nome, categoria, família e SKU.
3. Dizer o que fazer com item sem estoque, sem foto ou sem preço.
4. Lista de URLs antigas e acesso ao Search Console.

## Aceite
- [ ] Relatório de qualidade da base oficial aprovado pelo cliente
- [ ] Importação em staging sem divergência de estoque e com contagens batendo
- [ ] Fotos sem duplicatas por conteúdo
- [ ] Produção carregada, backup anterior guardado e base de teste removida
- [ ] Clientes, pedidos e redirects conferidos
