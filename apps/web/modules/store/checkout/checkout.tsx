'use client';

import {
  type CheckoutBody,
  type CouponCheck,
  maskDocument,
  maskPhone,
  mockCardToken,
  onlyDigits,
  PIX_DISCOUNT_PERCENT,
  type ShippingAddress,
} from '@geekstore/shared';
import { Button } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Action } from '@/components/ui';
import { getMascot } from '@/lib/mascot';
import { PAYMENTS_ARE_REAL, type TokenizedCard, tokenizeCard } from '@/lib/mercado-pago';
import { useCartSync } from '../cart-sync';
import { getErrorMessage } from '../lib/errors';
import { installmentPlan } from '../lib/money';
import { useCheckCoupon, useCreateOrder } from '../services/checkout/mutations';
import { lookupZip, shippingQuoteQuery } from '../services/checkout/queries';
import { useCreateAddress } from '../services/customer/mutations';
import { addressesQuery } from '../services/customer/queries';
import { useCartStore } from '../state/cart-store';
import { useCustomerStore } from '../state/customer-store';
import { ContactStep } from './contact-step';
import { DeliveryStep } from './delivery-step';
import { PaymentStep } from './payment-step';
import {
  type CheckoutFormValues,
  checkoutFormSchema,
  emptyCheckoutValues,
  STEP_FIELDS,
} from './schema';
import { Summary, type Totals } from './summary';

const CHECKOUT_STEPS = ['Contato', 'Entrega', 'Pagamento'];
const ZIP_DIGITS = 8;

export function Checkout() {
  const router = useRouter();
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const lines = useCartStore((state) => state.lines);
  const clearCart = useCartStore((state) => state.clear);
  const status = useCustomerStore((state) => state.status);
  const customer = useCustomerStore((state) => state.customer);

  const { control, handleSubmit, trigger, setValue, getValues, setError } =
    useForm<CheckoutFormValues>({
      resolver: zodResolver(checkoutFormSchema),
      defaultValues: emptyCheckoutValues,
      mode: 'onTouched',
    });
  const [zip, service, method] = useWatch({ control, name: ['zip', 'shipping_service', 'method'] });

  const [step, setStep] = useState(0);
  const stepsRef = useRef<HTMLDivElement | null>(null);
  const firstRender = useRef(true);
  // Uma chave por tentativa de compra: clique repetido ou rede que cai devolve o MESMO pedido.
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const [coupon, setCoupon] = useState<CouponCheck | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [formError, setFormError] = useState('');

  useCartSync(true);
  const createOrder = useCreateOrder();
  const checkCoupon = useCheckCoupon();
  const saveAddress = useCreateAddress();

  // Ao mudar de etapa, volta ao topo do formulário (senão a pessoa cai no meio da próxima etapa).
  // biome-ignore lint/correctness/useExhaustiveDependencies: só a mudança de `step` dispara a rolagem.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    stepsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step]);

  // Quem está logado já tem nome, e-mail e endereço padrão: preenche uma vez, sem sobrescrever o que digitou.
  const { data: addresses } = useQuery({
    ...addressesQuery(),
    enabled: status === 'authenticated',
  });
  useEffect(() => {
    if (!customer) return;
    if (!getValues('name')) setValue('name', customer.name);
    if (!getValues('email')) setValue('email', customer.email);
    if (!getValues('phone') && customer.phone) setValue('phone', maskPhone(customer.phone));
    if (!getValues('document') && customer.document)
      setValue('document', maskDocument(customer.document));
  }, [customer, getValues, setValue]);
  useEffect(() => {
    const home = addresses?.find((address) => address.is_default) ?? addresses?.[0];
    if (!home || getValues('zip')) return;
    setValue('zip', home.zip);
    setValue('street', home.street);
    setValue('number', home.number);
    setValue('complement', home.complement ?? '');
    setValue('neighborhood', home.neighborhood);
    setValue('city', home.city);
    setValue('state', home.state);
  }, [addresses, getValues, setValue]);

  const zipDigits = onlyDigits(zip);
  const quoteItems = lines.map((line) => ({ sku_id: line.sku_id, quantity: line.qty }));
  const quote = useQuery({
    ...shippingQuoteQuery(zipDigits, quoteItems),
    enabled: zipDigits.length === ZIP_DIGITS && lines.length > 0,
  });
  const option = quote.data?.options.find((candidate) => candidate.code === service);
  const cheapestCode = quote.data?.options.find((candidate) => candidate.code !== 'pickup')?.code;

  // Os códigos vêm da transportadora e mudam com o CEP: se o escolhido não existe mais, vale o mais barato.
  useEffect(() => {
    if (!quote.data || service === 'pickup' || option) return;
    setValue('shipping_service', cheapestCode ?? 'pickup');
  }, [quote.data, service, option, cheapestCode, setValue]);

  const subtotalCents = lines.reduce((sum, line) => sum + line.price_cents * line.qty, 0);
  const couponCents = coupon?.discount_cents ?? 0;
  const shippingCents =
    service === 'pickup' ? 0 : coupon?.free_shipping ? 0 : option ? option.price_cents : null;
  const pixCents =
    method === 'pix' ? Math.round(((subtotalCents - couponCents) * PIX_DISCOUNT_PERCENT) / 100) : 0;
  const totals: Totals = {
    subtotalCents,
    shippingCents,
    couponCents,
    pixCents,
    totalCents: subtotalCents - couponCents - pixCents + (shippingCents ?? 0),
  };
  const maxInstallments = installmentPlan(totals.totalCents)?.count ?? 1;

  const fillFromZip = async () => {
    if (onlyDigits(getValues('zip')).length !== ZIP_DIGITS) return;
    try {
      const found = await lookupZip(onlyDigits(getValues('zip')));
      setValue('street', found.street || getValues('street'));
      setValue('neighborhood', found.neighborhood || getValues('neighborhood'));
      setValue('city', found.city);
      setValue('state', found.state);
    } catch {
      // CEP não encontrado ou serviço fora: a pessoa preenche à mão.
    }
  };

  const applyCoupon = async (code: string) => {
    setCouponMessage('');
    try {
      const result = await checkCoupon.mutateAsync({
        code,
        items: lines.map((line) => ({ sku_id: line.sku_id, quantity: line.qty })),
      });
      setCoupon(result);
      setCouponMessage('Cupom aplicado.');
    } catch (error) {
      setCoupon(null);
      setCouponMessage(getErrorMessage(error));
    }
  };

  const advance = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep(step + 1);
  };

  const place = async (values: CheckoutFormValues) => {
    setFormError('');
    let card: TokenizedCard | null = null;
    if (values.method === 'card') {
      const mock = mockCardToken(values.card_number);
      if (!mock) {
        setError('card_number', { message: 'Número de cartão inválido' });
        return;
      }
      try {
        // Com o Mercado Pago, o cartão é trocado por um token direto lá: o número não passa por nós.
        card = PAYMENTS_ARE_REAL
          ? await tokenizeCard({
              number: values.card_number,
              holder: values.card_holder,
              expiry: values.card_expiry,
              cvv: values.card_cvv,
              document: values.document,
            })
          : { token: mock };
      } catch {
        setFormError('Não consegui validar o cartão. Confira os dados e tente de novo.');
        return;
      }
    }
    const pickup = values.shipping_service === 'pickup';
    const body: CheckoutBody = {
      items: lines.map((line) => ({ sku_id: line.sku_id, quantity: line.qty })),
      contact: {
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        document: values.document || null,
      },
      shipping_service: values.shipping_service,
      shipping_address: pickup
        ? undefined
        : {
            recipient: values.name,
            zip: onlyDigits(values.zip),
            street: values.street,
            number: values.number,
            complement: values.complement || null,
            neighborhood: values.neighborhood,
            city: values.city,
            state: values.state as ShippingAddress['state'],
          },
      coupon_code: coupon?.code,
      payment: {
        method: values.method,
        installments: values.method === 'card' ? Number(values.installments) : 1,
        card_token: card?.token,
        card_payment_method_id: card?.paymentMethodId,
        card_issuer_id: card?.issuerId,
      },
    };
    try {
      const order = await createOrder.mutateAsync({ body, idempotencyKey: idempotencyKey.current });
      if (customer && values.save_address && body.shipping_address) {
        await saveAddress
          .mutateAsync({ ...body.shipping_address, is_default: false })
          .catch(() => undefined);
      }
      clearCart();
      router.push(`/pedido/${order.order_id}/`);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  if (!hasHydrated) return <p className="wrap section">Carregando seu carrinho…</p>;

  if (!lines.length) {
    return (
      <section className="wrap section empty">
        <Image {...getMascot('parcel')} width={210} height={240} />
        <h1 className="section-title">Seu carrinho está vazio</h1>
        <Link className="action" href="/catalogo/">
          Escolher produtos
        </Link>
      </section>
    );
  }

  return (
    <section className="wrap section">
      <Link className="back-link" href="/catalogo/">
        <ArrowLeft size={17} /> Continuar comprando
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow orange">
            {customer ? `Olá, ${customer.name.split(' ')[0]}` : 'Sem cadastro obrigatório'}
          </p>
          <h1 className="section-title">Quase na sua coleção.</h1>
        </div>
        <span className="muted flex gap-2">
          <LockKeyhole size={17} /> {PAYMENTS_ARE_REAL ? 'Pagamento seguro' : 'Pagamento simulado'}
        </span>
      </div>
      {!PAYMENTS_ARE_REAL && (
        <p className="notice">
          Ambiente de demonstração: o pagamento é simulado e nenhuma cobrança real acontece. O
          pedido, o estoque e o frete são de verdade no sistema.
        </p>
      )}
      <div className="mt-[30px] grid grid-cols-[1.35fr_1fr] items-start gap-9 max-tablet:gap-[22px] max-md:grid-cols-1">
        <div>
          <div ref={stepsRef} className="mb-6 flex gap-7 max-md:gap-[15px]">
            {CHECKOUT_STEPS.map((title, index) => (
              <button
                key={title}
                type="button"
                disabled={index > step}
                onClick={() => setStep(index)}
                className={`flex items-center gap-2 text-sm font-extrabold max-md:text-xs ${step === index ? 'text-foreground' : 'text-muted'}`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full border max-md:size-[25px] ${step === index ? 'border-geek-yellow bg-geek-yellow text-ink' : 'border-border'}`}
                >
                  {index < step ? <Check size={16} /> : index + 1}
                </span>
                {title}
              </button>
            ))}
          </div>
          <form
            className="surface p-[30px] max-tablet:p-[22px] max-md:px-[17px] max-md:py-[22px]"
            onSubmit={
              step < 2
                ? (event) => {
                    event.preventDefault();
                    advance();
                  }
                : handleSubmit(place)
            }
            noValidate
          >
            <fieldset hidden={step !== 0} disabled={step !== 0}>
              <ContactStep control={control} />
            </fieldset>
            <fieldset hidden={step !== 1} disabled={step !== 1}>
              <DeliveryStep
                control={control}
                options={quote.data?.options}
                zip={zip}
                quoting={quote.isFetching}
                quoteError={quote.isError}
                isPickup={service === 'pickup'}
                onZipBlur={fillFromZip}
              />
              {customer && service !== 'pickup' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    onChange={(event) => setValue('save_address', event.target.checked)}
                  />
                  Salvar este endereço na minha conta
                </label>
              )}
            </fieldset>
            <fieldset hidden={step !== 2} disabled={step !== 2}>
              <PaymentStep
                control={control}
                method={method}
                maxInstallments={maxInstallments}
                totalCents={totals.totalCents}
              />
            </fieldset>
            {formError && (
              <p role="alert" className="error mt-4">
                {formError}
              </p>
            )}
            <div className="mt-[30px] flex justify-end gap-3.5">
              {step > 0 && <Button onPress={() => setStep(step - 1)}>Voltar</Button>}
              <Action type="submit" className="max-md:flex-1" disabled={createOrder.isPending}>
                {step === 2
                  ? createOrder.isPending
                    ? 'Finalizando…'
                    : 'Finalizar pedido'
                  : 'Continuar'}{' '}
                <ArrowRight size={18} />
              </Action>
            </div>
          </form>
        </div>
        <Summary
          totals={totals}
          coupon={coupon}
          couponMessage={couponMessage}
          couponPending={checkCoupon.isPending}
          onApplyCoupon={applyCoupon}
          onRemoveCoupon={() => {
            setCoupon(null);
            setCouponMessage('');
          }}
        />
      </div>
    </section>
  );
}
