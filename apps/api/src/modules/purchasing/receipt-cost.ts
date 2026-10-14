/**
 * Cálculo de custo da nota de entrada: funções puras, sem banco. A Fase 4 liga isto ao
 * `postReceipt` e a Fase 5 ao desprocessar.
 *
 * Unidades: valores da nota em centavos; custo unitário em `e4` (1/10.000 de real, inteiro). Os dois
 * custos que o SKU carrega seguem a mesma conta, só muda a série:
 *  - custo de aquisição: o que o fornecedor cobrou pelo item, já sem desconto;
 *  - custo com encargos (`landed`): o de aquisição mais frete, seguro, outras despesas, IPI e
 *    ICMS-ST rateados, conforme a política da nota.
 */

export type ApportionBasis = 'value' | 'quantity';

/** Centavos -> e4. */
export const centsToE4 = (cents: number): number => cents * 100;

/** e4 -> centavos (o que `sku.cost_cents` mostra). */
export const e4ToCents = (e4: number): number => Math.round(e4 / 100);

function assertNonNegativeInteger(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${what} deve ser um inteiro maior ou igual a zero (veio ${value}).`);
  }
}

/**
 * Divide `totalCents` entre os pesos, proporcionalmente, sem perder centavo: a soma do resultado é
 * sempre o total. A sobra vai para os maiores restos (empate: o primeiro). Peso total zero divide
 * em partes iguais.
 */
export function apportion(totalCents: number, weights: readonly number[]): number[] {
  assertNonNegativeInteger(totalCents, 'O total a ratear');
  if (weights.length === 0) return [];
  for (const weight of weights) assertNonNegativeInteger(weight, 'O peso do rateio');

  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const effective = weightSum > 0 ? weights : weights.map(() => 1);
  const divisor = BigInt(weightSum > 0 ? weightSum : weights.length);
  const total = BigInt(totalCents);

  // BigInt: total x peso passa de 2^53 em notas grandes.
  const shares = effective.map((weight) => {
    const product = total * BigInt(weight);
    return { floor: product / divisor, remainder: product % divisor };
  });
  const distributed = shares.reduce((sum, share) => sum + share.floor, 0n);
  const leftover = Number(total - distributed);

  const byRemainder = shares
    .map((share, index) => ({ index, remainder: share.remainder }))
    .sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1
    );
  const extra = new Set(byRemainder.slice(0, leftover).map((entry) => entry.index));

  return shares.map((share, index) => Number(share.floor) + (extra.has(index) ? 1 : 0));
}

export type CostItem = {
  /** Em unidades nossas (já com o fator de conversão). */
  quantity: number;
  /** Valor bruto da linha (`vProd`). */
  grossCents: number;
  discountCents: number;
  ipiCents: number;
  icmsStCents: number;
};

export type CostCharges = {
  freightCents: number;
  insuranceCents: number;
  otherCents: number;
  /** Total de desconto do cabeçalho; só a parte que os itens não trazem é rateada. */
  discountCents: number;
  /** Totais de IPI e ICMS-ST do cabeçalho; só a parte que os itens não trazem é rateada. */
  ipiCents: number;
  icmsStCents: number;
  includeIpi: boolean;
  includeIcmsSt: boolean;
  basis: ApportionBasis;
};

export type ItemCost = {
  /** Valor da linha sem desconto, em centavos. */
  netCents: number;
  /** Valor da linha com os encargos rateados, em centavos. */
  landedCents: number;
  unitCostE4: number;
  landedUnitCostE4: number;
};

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** Parte do total do cabeçalho que os itens não explicam (a NF-e traz os dois; nota manual só o cabeçalho). */
const headerRemainder = (headerCents: number, itemCents: readonly number[]): number =>
  Math.max(0, headerCents - sum(itemCents));

/**
 * Custo de cada item que entra no estoque (itens ignorados, como frete e brinde, ficam de fora do
 * rateio: quem chama passa só os que entram).
 */
export function computeItemCosts(items: readonly CostItem[], charges: CostCharges): ItemCost[] {
  if (items.length === 0) return [];
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new RangeError(
        `A quantidade do item deve ser um inteiro positivo (veio ${item.quantity}).`
      );
    }
  }

  const goods = items.map((item) => Math.max(0, item.grossCents - item.discountCents));
  const weights = charges.basis === 'quantity' ? items.map((item) => item.quantity) : goods;
  const spread = (totalCents: number) => apportion(totalCents, weights);

  const extraDiscount = spread(
    headerRemainder(
      charges.discountCents,
      items.map((item) => item.discountCents)
    )
  );
  const overhead = spread(charges.freightCents + charges.insuranceCents + charges.otherCents);
  const extraIpi = spread(
    headerRemainder(
      charges.ipiCents,
      items.map((item) => item.ipiCents)
    )
  );
  const extraIcmsSt = spread(
    headerRemainder(
      charges.icmsStCents,
      items.map((item) => item.icmsStCents)
    )
  );

  return items.map((item, index) => {
    const net = Math.max(0, (goods[index] ?? 0) - (extraDiscount[index] ?? 0));
    const ipi = charges.includeIpi ? item.ipiCents + (extraIpi[index] ?? 0) : 0;
    const icmsSt = charges.includeIcmsSt ? item.icmsStCents + (extraIcmsSt[index] ?? 0) : 0;
    const landed = net + (overhead[index] ?? 0) + ipi + icmsSt;
    return {
      netCents: net,
      landedCents: landed,
      unitCostE4: Math.round(centsToE4(net) / item.quantity),
      landedUnitCostE4: Math.round(centsToE4(landed) / item.quantity),
    };
  });
}

/**
 * Custo médio ponderado pelo saldo total do SKU. Sem custo anterior ou sem saldo, o custo da entrada
 * vira a média. Só entrada e reversão mexem na média: saída não.
 */
export function nextAverage(input: {
  previousAverageE4: number | null;
  quantityBefore: number;
  quantityIn: number;
  unitCostE4: number;
}): number {
  const { previousAverageE4, quantityBefore, quantityIn, unitCostE4 } = input;
  if (previousAverageE4 === null || quantityBefore <= 0) return unitCostE4;
  return Math.round(
    (previousAverageE4 * quantityBefore + unitCostE4 * quantityIn) / (quantityBefore + quantityIn)
  );
}

/** Uma entrada do histórico de custo do SKU, na ordem em que aconteceu. */
export type CostEntry = {
  id: string;
  /** Saldo total do SKU imediatamente antes da entrada. */
  quantityBefore: number;
  quantityIn: number;
  unitCostE4: number;
  landedUnitCostE4: number;
  /** Médias do SKU imediatamente antes da entrada. A da primeira entrada é o ponto de partida. */
  averageBeforeE4: number | null;
  landedAverageBeforeE4: number | null;
  reverted: boolean;
};

export type ReplayedEntry = {
  id: string;
  quantityBefore: number;
  averageAfterE4: number;
  landedAverageAfterE4: number;
};

export type ReplayResult = {
  /** Só as entradas que continuam valendo, com os valores refeitos. */
  entries: ReplayedEntry[];
  /** Médias do SKU depois da cadeia; as do ponto de partida se nenhuma entrada vale. */
  averageE4: number | null;
  landedAverageE4: number | null;
};

/**
 * Refaz a cadeia de médias sem as entradas revertidas. Cada entrada posterior a uma revertida perde,
 * do saldo de antes, a quantidade que aquela trouxe (o estoque dela saiu). Sem mutar a entrada.
 */
export function replayChain(entries: readonly CostEntry[]): ReplayResult {
  const first = entries[0];
  let average = first?.averageBeforeE4 ?? null;
  let landedAverage = first?.landedAverageBeforeE4 ?? null;
  let revertedQuantity = 0;
  const replayed: ReplayedEntry[] = [];

  for (const entry of entries) {
    if (entry.reverted) {
      revertedQuantity += entry.quantityIn;
      continue;
    }
    const quantityBefore = Math.max(0, entry.quantityBefore - revertedQuantity);
    average = nextAverage({
      previousAverageE4: average,
      quantityBefore,
      quantityIn: entry.quantityIn,
      unitCostE4: entry.unitCostE4,
    });
    landedAverage = nextAverage({
      previousAverageE4: landedAverage,
      quantityBefore,
      quantityIn: entry.quantityIn,
      unitCostE4: entry.landedUnitCostE4,
    });
    replayed.push({
      id: entry.id,
      quantityBefore,
      averageAfterE4: average,
      landedAverageAfterE4: landedAverage,
    });
  }
  return { entries: replayed, averageE4: average, landedAverageE4: landedAverage };
}
