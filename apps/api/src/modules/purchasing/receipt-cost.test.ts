import { describe, expect, it } from 'vitest';

import {
  apportion,
  type CostCharges,
  type CostEntry,
  type CostItem,
  centsToE4,
  computeItemCosts,
  e4ToCents,
  nextAverage,
  replayChain,
} from './receipt-cost';

const NO_CHARGES: CostCharges = {
  freightCents: 0,
  insuranceCents: 0,
  otherCents: 0,
  discountCents: 0,
  ipiCents: 0,
  icmsStCents: 0,
  includeIpi: true,
  includeIcmsSt: true,
  basis: 'value',
};

const item = (over: Partial<CostItem> = {}): CostItem => ({
  quantity: 1,
  grossCents: 10000,
  discountCents: 0,
  ipiCents: 0,
  icmsStCents: 0,
  ...over,
});

const total = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

describe('apportion', () => {
  it('never loses a cent: the shares always add up to the total', () => {
    expect(apportion(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(apportion(1, [5, 5, 5])).toEqual([1, 0, 0]);
    const shares = apportion(123456, [7, 13, 29, 51]);
    expect(total(shares)).toBe(123456);
  });

  it('is proportional to the weights, and the biggest remainder gets the leftover cent', () => {
    expect(apportion(1000, [1, 3])).toEqual([250, 750]);
    // 10 / 3 = 3,33..: sobra 1 centavo, vai para o maior resto (o segundo, 2/3 de 10 = 6,66..).
    expect(apportion(10, [1, 2])).toEqual([3, 7]);
  });

  it('splits evenly when every weight is zero, and handles zero and empty', () => {
    expect(apportion(10, [0, 0])).toEqual([5, 5]);
    expect(apportion(0, [3, 4])).toEqual([0, 0]);
    expect(apportion(500, [])).toEqual([]);
  });

  it('stays exact on big values (beyond 2^53 when multiplied)', () => {
    const shares = apportion(900_000_000, [900_000_000, 100_000_000]);
    expect(shares).toEqual([810_000_000, 90_000_000]);
  });

  it('rejects negative or fractional input', () => {
    expect(() => apportion(-1, [1])).toThrow(RangeError);
    expect(() => apportion(10, [1.5])).toThrow(RangeError);
  });
});

describe('computeItemCosts', () => {
  it('without charges the landed cost equals the acquisition cost', () => {
    const [cost] = computeItemCosts([item({ quantity: 4, grossCents: 4000 })], NO_CHARGES);
    expect(cost).toEqual({
      netCents: 4000,
      landedCents: 4000,
      unitCostE4: centsToE4(1000),
      landedUnitCostE4: centsToE4(1000),
    });
  });

  it('spreads freight, insurance and other expenses by value', () => {
    const costs = computeItemCosts(
      [item({ quantity: 2, grossCents: 10000 }), item({ quantity: 1, grossCents: 30000 })],
      { ...NO_CHARGES, freightCents: 800, insuranceCents: 100, otherCents: 100 }
    );
    // 1000 de encargos, 25% / 75%.
    expect(costs.map((cost) => cost.landedCents)).toEqual([10250, 30750]);
    expect(costs[0]?.unitCostE4).toBe(centsToE4(5000));
    expect(costs[0]?.landedUnitCostE4).toBe(centsToE4(5125));
  });

  it('spreads by quantity when asked', () => {
    const costs = computeItemCosts(
      [item({ quantity: 1, grossCents: 10000 }), item({ quantity: 3, grossCents: 10000 })],
      { ...NO_CHARGES, freightCents: 800, basis: 'quantity' }
    );
    expect(costs.map((cost) => cost.landedCents)).toEqual([10200, 10600]);
  });

  it('keeps the exact cent when the spread leaves a remainder', () => {
    const costs = computeItemCosts([item(), item(), item()], { ...NO_CHARGES, freightCents: 100 });
    expect(total(costs.map((cost) => cost.landedCents))).toBe(30100);
    expect(costs.map((cost) => cost.landedCents)).toEqual([10034, 10033, 10033]);
  });

  it('takes the item discount off the cost', () => {
    const [cost] = computeItemCosts(
      [item({ quantity: 2, grossCents: 10000, discountCents: 1000 })],
      NO_CHARGES
    );
    expect(cost?.netCents).toBe(9000);
    expect(cost?.unitCostE4).toBe(centsToE4(4500));
  });

  it('spreads only the part of the header discount that the items do not already carry', () => {
    const items = [item({ discountCents: 500 }), item({ discountCents: 500 })];
    // O cabeçalho repete a soma dos itens: nada a mais para ratear.
    const same = computeItemCosts(items, { ...NO_CHARGES, discountCents: 1000 });
    expect(same.map((cost) => cost.netCents)).toEqual([9500, 9500]);
    // 600 a mais no cabeçalho: 300 para cada.
    const extra = computeItemCosts(items, { ...NO_CHARGES, discountCents: 1600 });
    expect(extra.map((cost) => cost.netCents)).toEqual([9200, 9200]);
  });

  it('includes or leaves out IPI and ICMS-ST, from the item or from the header', () => {
    const items = [item({ ipiCents: 300, icmsStCents: 200 })];
    expect(computeItemCosts(items, NO_CHARGES)[0]?.landedCents).toBe(10500);
    expect(computeItemCosts(items, { ...NO_CHARGES, includeIpi: false })[0]?.landedCents).toBe(
      10200
    );
    expect(
      computeItemCosts(items, { ...NO_CHARGES, includeIpi: false, includeIcmsSt: false })[0]
        ?.landedCents
    ).toBe(10000);
    // Nota manual: só o cabeçalho informa o IPI.
    expect(
      computeItemCosts([item(), item()], { ...NO_CHARGES, ipiCents: 100 }).map(
        (cost) => cost.landedCents
      )
    ).toEqual([10050, 10050]);
  });

  it('never returns a negative cost, even with a discount bigger than the goods', () => {
    const [cost] = computeItemCosts([item({ grossCents: 1000, discountCents: 5000 })], NO_CHARGES);
    expect(cost?.netCents).toBe(0);
    expect(cost?.landedUnitCostE4).toBe(0);
  });

  it('refuses a non-positive quantity and returns [] for no items', () => {
    expect(() => computeItemCosts([item({ quantity: 0 })], NO_CHARGES)).toThrow(RangeError);
    expect(computeItemCosts([], NO_CHARGES)).toEqual([]);
  });

  it('keeps fractions of a cent in the unit cost (1/10.000 de real)', () => {
    // R$ 10,00 por 3 unidades: R$ 3,3333 cada, não R$ 3,33.
    const [cost] = computeItemCosts([item({ quantity: 3, grossCents: 1000 })], NO_CHARGES);
    expect(cost?.unitCostE4).toBe(33333);
    expect(e4ToCents(33333)).toBe(333);
  });
});

describe('nextAverage', () => {
  it('uses the entry cost when there is no previous average or no stock', () => {
    expect(
      nextAverage({ previousAverageE4: null, quantityBefore: 5, quantityIn: 5, unitCostE4: 1000 })
    ).toBe(1000);
    expect(
      nextAverage({ previousAverageE4: 500, quantityBefore: 0, quantityIn: 5, unitCostE4: 2000 })
    ).toBe(2000);
  });

  it('weights by the stock on hand', () => {
    expect(
      nextAverage({
        previousAverageE4: 100000,
        quantityBefore: 10,
        quantityIn: 10,
        unitCostE4: 200000,
      })
    ).toBe(150000);
    expect(
      nextAverage({
        previousAverageE4: 100000,
        quantityBefore: 30,
        quantityIn: 10,
        unitCostE4: 200000,
      })
    ).toBe(125000);
  });

  it('does not drift: the average comes from e4 values, not from rounded cents', () => {
    // 3 entradas de 1 unidade a R$ 3,3333: a média continua 33333, não vira 333 x 100.
    const first = nextAverage({
      previousAverageE4: null,
      quantityBefore: 0,
      quantityIn: 1,
      unitCostE4: 33333,
    });
    const second = nextAverage({
      previousAverageE4: first,
      quantityBefore: 1,
      quantityIn: 1,
      unitCostE4: 33333,
    });
    const third = nextAverage({
      previousAverageE4: second,
      quantityBefore: 2,
      quantityIn: 1,
      unitCostE4: 33333,
    });
    expect(third).toBe(33333);
  });
});

const entry = (over: Partial<CostEntry> & { id: string }): CostEntry => ({
  quantityBefore: 0,
  quantityIn: 10,
  unitCostE4: 100000,
  landedUnitCostE4: 110000,
  averageBeforeE4: null,
  landedAverageBeforeE4: null,
  reverted: false,
  ...over,
});

describe('replayChain', () => {
  const chain = (): CostEntry[] => [
    entry({
      id: 'e1',
      quantityBefore: 0,
      quantityIn: 10,
      unitCostE4: 100000,
      landedUnitCostE4: 110000,
    }),
    entry({
      id: 'e2',
      quantityBefore: 10,
      quantityIn: 10,
      unitCostE4: 200000,
      landedUnitCostE4: 220000,
    }),
    entry({
      id: 'e3',
      quantityBefore: 20,
      quantityIn: 10,
      unitCostE4: 330000,
      landedUnitCostE4: 330000,
    }),
  ];

  it('rebuilds the same averages when nothing is reverted', () => {
    const result = replayChain(chain());
    expect(result.entries.map((row) => row.averageAfterE4)).toEqual([100000, 150000, 210000]);
    expect(result.entries.map((row) => row.landedAverageAfterE4)).toEqual([110000, 165000, 220000]);
    expect(result.averageE4).toBe(210000);
  });

  it('reverting the middle entry removes its quantity from the later ones', () => {
    const entries = chain().map((row) => (row.id === 'e2' ? { ...row, reverted: true } : row));
    const result = replayChain(entries);

    expect(result.entries.map((row) => row.id)).toEqual(['e1', 'e3']);
    // e3 passa a ter 10 (20 - 10) de saldo antes: (100000x10 + 330000x10) / 20.
    expect(result.entries[1]).toMatchObject({ quantityBefore: 10, averageAfterE4: 215000 });
    expect(result.averageE4).toBe(215000);
    expect(result.landedAverageE4).toBe(Math.round((110000 * 10 + 330000 * 10) / 20));
  });

  it('reverting the first entry makes the next one start from its own cost', () => {
    const entries = chain().map((row) => (row.id === 'e1' ? { ...row, reverted: true } : row));
    const result = replayChain(entries);
    expect(result.entries[0]).toMatchObject({
      id: 'e2',
      quantityBefore: 0,
      averageAfterE4: 200000,
    });
  });

  it('falls back to the starting average when every entry is reverted', () => {
    const entries = [
      entry({ id: 'e1', averageBeforeE4: 90000, landedAverageBeforeE4: 95000, reverted: true }),
      entry({ id: 'e2', quantityBefore: 10, reverted: true }),
    ];
    expect(replayChain(entries)).toEqual({ entries: [], averageE4: 90000, landedAverageE4: 95000 });
  });

  it('starts from the average the SKU already had (stock that predates the history)', () => {
    const result = replayChain([
      entry({
        id: 'e1',
        quantityBefore: 10,
        quantityIn: 10,
        unitCostE4: 200000,
        averageBeforeE4: 100000,
        landedAverageBeforeE4: 100000,
      }),
    ]);
    expect(result.averageE4).toBe(150000);
  });

  it('never lets the saldo before go negative and never mutates its input', () => {
    const entries = chain().map((row) =>
      row.id === 'e1' ? { ...row, reverted: true, quantityIn: 50 } : row
    );
    const snapshot = JSON.stringify(entries);
    const result = replayChain(entries);
    expect(result.entries.every((row) => row.quantityBefore >= 0)).toBe(true);
    expect(JSON.stringify(entries)).toBe(snapshot);
  });

  it('returns nulls for an empty history', () => {
    expect(replayChain([])).toEqual({ entries: [], averageE4: null, landedAverageE4: null });
  });
});
