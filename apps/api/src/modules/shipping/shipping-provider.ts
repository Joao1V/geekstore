/** Um item do carrinho como o frete o enxerga (medidas em mm e peso em g; `null` = não cadastrado). */
export type ShippingItem = {
  quantity: number;
  unitPriceCents: number;
  weightG: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
};

export type ProviderQuoteInput = {
  fromZip: string;
  toZip: string;
  items: readonly ShippingItem[];
};

/** Uma opção devolvida pelo provedor, antes de a loja aplicar frete grátis e retirada. */
export type ProviderOption = {
  /** Único e estável por serviço (`me:1`): o pedido volta a pedir a cotação e escolhe por ele. */
  code: string;
  carrier: string;
  service: string;
  priceCents: number;
  daysMin: number;
  daysMax: number;
};

// Todo cálculo de frete real entra por esta interface, como o pagamento entra por `PaymentProvider`.
export type ShippingProvider = {
  readonly name: string;
  quote(input: ProviderQuoteInput): Promise<ProviderOption[]>;
};
