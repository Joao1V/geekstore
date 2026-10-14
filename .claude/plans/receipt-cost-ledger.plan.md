# Plano: livro-razão com saldo, custo com histórico e desprocessar nota

**Origem**: comparação com o DDL do amigo (`.temp/estrutura`), itens 1–5 e 7.
**Fase / requisitos**: F1 (M03 Estoque, M14) com impacto em RF-EST-02, RF-EST-07, RF-EST-10, RF-PRE-06.
**Complexidade**: Média-Alta (8 pontos escrevem em `stock_movement`; custo e estorno têm regra delicada).

## Resumo
Hoje `stock_movement` guarda só o delta, o custo médio é recalculado e sobrescrito em `sku.cost_cents` (inteiro, arredonda a cada nota), a nota ignora frete/IPI/ST/desconto do XML, só aceita quantidade inteira em `qCom` e não dá para desfazer um lançamento. O plano adiciona: saldo e custo em cada movimento, tabela de histórico de custo, custo com encargos rateados, desprocessar nota com motivo e fator de conversão no item.

## Decisões a confirmar (mudam o que será feito)
1. **Precisão do custo**: não trocar `sku.cost_cents`. O histórico (`sku_cost_entry`) guarda custo em **1/10.000 de real (`_e4`, inteiro)** e a média é calculada sempre a partir da última entrada válida, nunca do valor já arredondado. `sku.cost_cents` passa a ser `round(e4 / 100)`, só para exibição. Isso é uma exceção localizada à regra "dinheiro em centavos" (só dentro do cálculo de custo); registrar no CLAUDE.md.
2. **Desprocessar**: a nota volta a `draft` (editável e relançável), com evento. Não criamos status `reverted`. A chave de acesso continua única.
3. **Saldo no movimento**: duas colunas, `on_hand_after` e `reserved_after` (nosso movimento também mexe em `reserved`; uma coluna só `balance_after` ficaria ambígua).
4. **Rateio**: só base `value` e `quantity` agora (peso fica para depois: nem todo SKU tem peso).
5. **Desconto**: hoje o custo usa `vProd` (bruto). Passa a abater o desconto (`vDesc`) por padrão. Muda o custo das notas novas; as já lançadas não mudam.

## Padrões a seguir
| Categoria | Fonte | Padrão |
|---|---|---|
| Primitivas de saldo | `apps/api/src/modules/stock/stock-ledger.ts` | UPDATE condicional em SQL cru, `asUuid`/`asInt`, erros `ConflictError` |
| Lançamento de nota | `apps/api/src/modules/purchasing/receipt.service.ts:postReceipt` | `updateMany` condicional para reivindicar o status, `FOR UPDATE` no SKU, auditoria na mesma transação |
| Parser | `apps/api/src/modules/purchasing/nfe-parser.ts` | tudo como texto, `NfeParseError` em pt-BR, valores em centavos |
| Contratos | `packages/shared/src/purchasing.ts`, `stock.ts` | schemas Zod snake_case, tipo inferido |
| Testes | `receipt.integration.test.ts`, `stock.service.integration.test.ts`, `nfe-parser.test.ts` | integração com banco real; unitário para funções puras |
| Banco | skill `db-conventions` | PK `{tabela}_id` UUID v7, `@@map` singular, migração nova (nunca editar aplicada) |

## Arquivos
| Arquivo | Ação | Motivo |
|---|---|---|
| `packages/db/prisma/schema.prisma` + migração nova | UPDATE/CREATE | colunas e tabelas abaixo |
| `apps/api/src/modules/stock/stock-ledger.ts` | UPDATE | primitivas passam a devolver o saldo resultante (`RETURNING`) |
| `apps/api/src/modules/stock/movement-writer.ts` | CREATE | único ponto que grava `stock_movement` com `on_hand_after`/`reserved_after` |
| `stock.service.ts`, `orders/order-flow.ts` (3), `catalog/duplicates.service.ts`, `catalog/sku-initial.ts`, `migration/normalize/load-catalog.ts` | UPDATE | passam a usar o `movement-writer` (são os 8 pontos de escrita) |
| `apps/api/src/modules/purchasing/receipt-cost.ts` (+ `.test.ts`) | CREATE | funções puras: rateio, custo médio, replay da cadeia |
| `purchasing/nfe-parser.ts` | UPDATE | ler `vFrete`, `vSeg`, `vOutro`, `vDesc`, `vIPI`, `vST` (cabeçalho e item), `uCom/qCom` e `uTrib/qTrib` |
| `purchasing/receipt.service.ts` | UPDATE | fator, encargos, `postReceipt` com custo/histórico, novo `revertReceipt` (arquivo ficar <800 linhas: extrair `receipt-post.ts` e `receipt-revert.ts`) |
| `purchasing/receipt.routes.ts`, `receipt.controller.ts` | UPDATE | `POST /receipts/:receipt_id/revert` e `GET /receipts/:receipt_id/events` |
| `packages/shared/src/purchasing.ts`, `stock.ts` | UPDATE | novos campos e bodies |
| `docs/api/*` | REGENERAR | comando `/openapi-docs` (não editar à mão) |
| `apps/web/modules/admin/receipts`, `stock` + services | UPDATE | só depois da API: ver Fase 6 |
| `CLAUDE.md` | UPDATE | exceção `_e4` do custo |

## Modelo de dados (migração única, tudo anulável ou com default)
- `stock_movement`: `on_hand_after Int?`, `reserved_after Int?`, `unit_cost_e4 Int?`. Backfill na própria migração com `SUM(quantity) OVER (PARTITION BY sku_id, location_id ORDER BY created_at, stock_movement_id)` (UUID v7 é ordenável). Teste confere que o último saldo de cada par bate com `stock_level`; onde não bater, deixar NULL e listar.
- `sku_cost_entry` (novo): `sku_cost_entry_id`, `sku_id`, `purchase_receipt_item_id` (único), `occurred_on`, `quantity_in`, `unit_cost_e4`, `landed_unit_cost_e4`, `quantity_before`, `average_cost_before_e4?`, `average_landed_cost_before_e4?` (médias de antes, ponto de partida do replay), `average_cost_after_e4`, `average_landed_cost_after_e4`, `reverted_at?`, `created_at`. Índice `(sku_id, occurred_on, created_at)`.
- `sku`: `landed_cost_cents Int?` (custo médio com encargos). `cost_cents` continua sendo o médio sem encargos.
- `purchase_receipt`: `freight_cents`, `insurance_cents`, `other_cents`, `discount_cents`, `ipi_cents`, `icms_st_cents` (default 0), `include_ipi`, `include_icms_st` (default true), `apportion_basis` (`value`|`quantity`, default `value`), `reverted_at?`.
- `purchase_receipt_item`: `xml_quantity Int`, `unit_factor Int default 1` (`quantity = xml_quantity * unit_factor`), `ipi_cents`, `icms_st_cents`, `discount_cents`, `landed_unit_cost_e4 Int?` (preenchido ao lançar).
- `supplier_sku`: `unit_factor Int default 1` (memória do fator, como a do código).
- `purchase_receipt_event` (novo): `purchase_receipt_event_id`, `purchase_receipt_id`, `type` (`posted`|`reverted`), `reason?`, `user_id`, `created_at`.

## Fases e tarefas

### Fase 1: saldo e custo no livro-razão (itens 1)
1. Migração com as 3 colunas e backfill. **Validar**: query de conferência saldo × último movimento zera divergências.
2. `stock-ledger.ts`: cada primitiva usa `UPDATE … RETURNING on_hand, reserved` e devolve o snapshot; `lockLevel` já devolve.
3. `movement-writer.ts` com `recordMovement(tx, slot, type, quantity, …)` que aplica a primitiva certa e grava o movimento com o snapshot. Trocar os 8 pontos de escrita. Regra: ninguém mais chama `tx.stockMovement.create`. Adicionar um teste que falha se aparecer `stockMovement.create` fora do writer (grep no teste).
4. Expor `on_hand_after`/`reserved_after` em `stock.mappers.ts` e no schema compartilhado.
5. Teste de concorrência existente deve continuar passando; novo teste: para qualquer sequência, `on_hand_after` do último movimento == `stock_level.on_hand`.

### Fase 2: parser e item da nota (itens 4 e 7, entrada)
1. Parser lê encargos do cabeçalho e do item, `qCom` decimal rejeitado só se a conversão para unidade nossa não for inteira, e `uCom`/`uTrib`.
2. Item guarda `xml_quantity`; `unit_factor` vem de `supplier_sku` se já aprendido, senão 1.
3. `PATCH /receipts/:id/items/:item_id` aceita `unit_factor`; recalcula `quantity` e `unit_cost`. Ao ligar o SKU, grava o fator em `supplier_sku`.
4. Importação manual (`ReceiptManualBody`) aceita os encargos do cabeçalho.
5. Testes: `nfe-parser.test.ts` com XML com frete/IPI/ST/desconto e caixa com 12; `receipt.integration.test.ts` para o fator.

### Fase 3: cálculo de custo (itens 2, 3 e 4)
`receipt-cost.ts`, funções puras e testadas antes de ligar ao serviço:
- `apportion(total, weights[])`: rateio por maior resto, a soma bate exatamente.
- `landedUnitCost(item, charges, flags)`: custo do item + rateio de frete/seguro/outras (+ IPI e ST se `include_*`) − desconto, dividido pela quantidade, em `_e4`.
- `nextAverage(prev, qtyBefore, qtyIn, unitCostE4)`: média ponderada pelo saldo total do SKU.
- `replayChain(entries, revertedQty)`: reexecuta a cadeia pelas entradas não revertidas.
Testes: rateio com sobra de centavo, base por quantidade, desconto, IPI incluído/excluído, saldo zero (média = custo da entrada), cadeia com reversão no meio.

### Fase 4: lançar nota com histórico (itens 2, 3, 4)
Em `postReceipt`, por item e dentro da transação já existente:
1. Trava o SKU (já faz), lê o saldo total, calcula custo, `nextAverage` a partir da **última entrada não revertida** (não de `sku.cost_cents`).
2. Grava `sku_cost_entry`, atualiza `sku.cost_cents` e `sku.landed_cost_cents`, grava o movimento com `unit_cost_e4` (custo com encargos), congela `landed_unit_cost_e4` no item.
3. Grava `purchase_receipt_event` (`posted`).
Testes: as 3 asserções atuais de `averageCost` continuam (função mantida/adaptada); dois lançamentos do mesmo SKU em paralelo produzem média igual à sequencial.

### Fase 5: desprocessar (item 5)
`revertReceipt(actorId, receiptId, reason)`:
1. `reason` obrigatório (mín. 5 caracteres, Zod).
2. `updateMany` condicional `posted → draft` (idempotência, como o lançamento).
3. Para cada item: `subtractOnHand` no local da nota. Sem saldo disponível, `ConflictError` com o SKU e a falta, e **tudo é revertido** (transação).
4. Movimento `outbound` com `reference_type = 'purchase_receipt_reversal'`.
5. Marca as `sku_cost_entry` da nota como `reverted_at`, reexecuta a cadeia das posteriores (`quantity_before` menos a quantidade revertida) e regrava `average_*_after`; atualiza `sku.cost_cents` e `landed_cost_cents` com a última entrada válida.
6. Evento `reverted` com o motivo, auditoria, permissão própria (`stock` ou dono; conferir RBAC existente).
Testes: reverter a última nota; reverter nota com outra posterior no mesmo SKU (média recalculada); bloqueio por saldo vendido; duas reversões simultâneas (só uma vence); relançar depois de reverter.

### Fase 6: admin (depois da API estável)
Ver a tela de nota em `apps/web/modules/admin/receipts` e o extrato em `stock`: coluna de saldo após o movimento; campo de fator e de encargos na nota; botão "Desprocessar" com motivo; linha do tempo de eventos. Services em `modules/admin/services/purchasing|stock` (skill `scaffolding-api-service`), formulários pelo padrão `form-fields`, Tailwind com tokens. **Não faço esta fase sem você confirmar o desenho das telas.**

## Validação
```bash
pnpm --filter @geekstore/db generate
pnpm --filter @geekstore/db exec prisma migrate dev
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @geekstore/api test:integration
```
Depois: regenerar `docs/api` com `/openapi-docs` e rodar `/code-review` (toca em estoque e custo, gatilho de revisão do projeto).

## Riscos
| Risco | Prob. | Mitigação |
|---|---|---|
| Backfill de `on_hand_after` não bater com `stock_level` (carga inicial sem movimento) | Média | colunas anuláveis, relatório de divergência na migração, não bloquear |
| Deadlock ao reverter nota com vários SKUs | Média | travar SKUs em ordem estável (como `sortedBySlot`) |
| Custo médio mudar em notas já lançadas | Baixa | só notas novas usam o novo cálculo; as antigas não têm entrada de histórico, a primeira nova parte do `cost_cents` atual × saldo (entrada "de abertura") |
| Desconto abatido muda o custo esperado pelo cliente | Média | decisão 5, confirmar |
| `receipt.service.ts` passar de 800 linhas | Alta | extrair `receipt-post.ts` e `receipt-revert.ts` |
| Reverter com SKU já mesclado (`merged_into`) | Baixa | tratar: reverter no SKU que recebeu o estoque, ou bloquear com mensagem |

## Fora deste plano
Kit, devolução, baixa por perda (fases F3/F4); lote e validade; financeiro; multi-tenant; `unit_cost` no `OrderItem` (item 6, entra com o checkout na F3).

## Aceite
- [ ] Todo movimento novo tem `on_hand_after` e `reserved_after`; nada grava `stock_movement` fora do writer
- [ ] Média de custo sem deriva de arredondamento e reproduzível a partir do histórico
- [ ] Custo com encargos bate com a soma da nota (rateio exato)
- [ ] Desprocessar recalcula a cadeia e recusa quando falta saldo
- [ ] Fator de conversão aprendido por fornecedor
- [ ] Testes unitários e de integração passando; `/code-review` sem CRITICAL/HIGH
