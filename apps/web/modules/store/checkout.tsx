'use client';

import { Button } from '@heroui/react';
import { ArrowLeft, ArrowRight, Check, CreditCard, LockKeyhole, Trash2, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Action, FieldInput, FieldSelect, Quantity } from '@/components/ui';
import { money, pixPrice, products } from '@/lib/catalog';
import { getMascot } from '@/lib/mascot';
import { ShippingProgress } from './shell';
import { useCartStore } from './state/cart-store';

const CHECKOUT_STEPS = ['Contato', 'Entrega', 'Pagamento'];
const STANDARD_SHIPPING_PRICE = 19.9;
const EXPRESS_SHIPPING_PRICE = 29.9;
const FREE_SHIPPING_THRESHOLD = 299;
const COUPON_DISCOUNT_RATE = 0.1;
const VALID_COUPON = 'GEEK10';
const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

const CHECKOUT_TITLE = 'mb-2.5 text-xl font-black';
const FORM_GRID = 'my-[25px] grid grid-cols-2 gap-5 max-md:grid-cols-1 max-md:gap-[15px]';
const CHOICE_LIST = 'my-6 flex flex-col gap-3 border-0 p-0';
const CHOICE_LABEL =
  'flex cursor-pointer items-center gap-3 rounded-[10px] border border-border px-3.5 py-[17px] text-sm has-checked:border-geek-yellow has-checked:bg-[#ffbd080c]';
const CHOICE_HINT = 'mt-[3px] block text-xs text-muted';
const TOTAL_ROW = 'flex justify-between gap-[15px]';

type CheckoutContactFormValues = {
  name: string;
  email: string;
  phone?: string;
  cep: string;
  street: string;
  number: string;
  extra?: string;
  city: string;
  state: string;
};

type CouponFormValues = { coupon: string };

export function Checkout() {
  const store = useCartStore();
  const { control, handleSubmit } = useForm<CheckoutContactFormValues>();
  const { control: couponControl, handleSubmit: handleCouponSubmit } = useForm<CouponFormValues>({
    defaultValues: { coupon: '' },
  });
  const [step, setStep] = useState(0);
  const [applied, setApplied] = useState(false);
  const [couponMessage, setCouponMessage] = useState('');
  const [payment, setPayment] = useState('pix');
  const [shipping, setShipping] = useState('standard');
  const [complete, setComplete] = useState(false);

  const subtotal =
    Math.round(
      store.lines.reduce((sum, line) => {
        const product = products.find((p) => p.id === line.id);
        return sum + (product ? product.price * line.qty : 0);
      }, 0) * 100
    ) / 100;
  const discount = applied ? Math.round(subtotal * COUPON_DISCOUNT_RATE * 100) / 100 : 0;
  const freight =
    shipping === 'express'
      ? EXPRESS_SHIPPING_PRICE
      : subtotal >= FREE_SHIPPING_THRESHOLD
        ? 0
        : STANDARD_SHIPPING_PRICE;
  const pixDiscount =
    payment === 'pix'
      ? Math.round((subtotal - discount - pixPrice(subtotal - discount)) * 100) / 100
      : 0;
  const total = Math.round((subtotal - discount - pixDiscount + freight) * 100) / 100;

  if (!store.hasHydrated) return <p className="wrap section">Carregando seu carrinho…</p>;

  if (complete)
    return (
      <section className="wrap section empty">
        <Image {...getMascot('parcel')} width={210} height={240} />
        <p className="eyebrow orange">Tudo conferido!</p>
        <h1 className="section-title">Simulação concluída.</h1>
        <p>Você percorreu o checkout. Nenhum pedido foi enviado e nenhum valor foi cobrado.</p>
        <p className="muted">O carrinho continua salvo para seus testes.</p>
        <Link className="action" href="/catalogo/">
          Voltar à coleção <ArrowRight size={18} />
        </Link>
      </section>
    );

  if (!store.lines.length)
    return (
      <section className="wrap section empty">
        <Image {...getMascot('parcel')} width={210} height={240} />
        <h1 className="section-title">Seu carrinho está vazio</h1>
        <Link className="action" href="/catalogo/">
          Escolher produtos
        </Link>
      </section>
    );

  const submitStep = () => {
    if (step < 2) setStep(step + 1);
    else setComplete(true);
  };

  const submitCoupon = ({ coupon }: CouponFormValues) => {
    const valid = coupon.trim().toUpperCase() === VALID_COUPON;
    setApplied(valid);
    setCouponMessage(
      valid ? 'Cupom demonstrativo aplicado.' : 'Cupom não encontrado. Para testar: GEEK10.'
    );
  };

  return (
    <section className="wrap section">
      <Link className="back-link" href="/catalogo/">
        <ArrowLeft size={17} /> Continuar comprando
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow orange">Sem cadastro obrigatório</p>
          <h1 className="section-title">Quase na sua coleção.</h1>
        </div>
        <span className="muted flex gap-2">
          <LockKeyhole size={17} /> Checkout demonstrativo
        </span>
      </div>
      <p className="notice">
        Ambiente de demonstração. Use dados fictícios. Frete e pagamento são simulados; nenhum dado
        é enviado a uma loja ou gateway.
      </p>
      <div className="mt-[30px] grid grid-cols-[1.35fr_1fr] items-start gap-9 max-tablet:gap-[22px] max-md:grid-cols-1">
        <div>
          <div className="mb-6 flex gap-7 max-md:gap-[15px]">
            {CHECKOUT_STEPS.map((title, i) => (
              <button
                key={title}
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 text-sm font-extrabold max-md:text-xs ${step === i ? 'text-foreground' : 'text-muted'}`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full border max-md:size-[25px] ${step === i ? 'border-geek-yellow bg-geek-yellow text-[#111]' : 'border-border'}`}
                >
                  {i < step ? <Check size={16} /> : i + 1}
                </span>
                {title}
              </button>
            ))}
          </div>
          <form
            className="surface p-[30px] max-tablet:p-[22px] max-md:px-[17px] max-md:py-[22px]"
            onSubmit={handleSubmit(submitStep)}
          >
            <fieldset hidden={step !== 0} disabled={step !== 0}>
              <h2 className={CHECKOUT_TITLE}>Como podemos falar com você?</h2>
              <p className="muted text-sm">
                Continue como visitante. Não é necessário criar uma conta.
              </p>
              <div className={FORM_GRID}>
                <Controller
                  control={control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <FieldInput
                      field={field}
                      fieldState={fieldState}
                      label="Nome de exemplo"
                      autoComplete="off"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FieldInput
                      field={field}
                      fieldState={fieldState}
                      label="E-mail de exemplo"
                      type="email"
                      autoComplete="off"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="phone"
                  render={({ field, fieldState }) => (
                    <FieldInput
                      field={field}
                      fieldState={fieldState}
                      label="Telefone (opcional)"
                      type="tel"
                      required={false}
                      autoComplete="off"
                    />
                  )}
                />
              </div>
            </fieldset>
            <fieldset hidden={step !== 1} disabled={step !== 1}>
              <h2 className={CHECKOUT_TITLE}>Onde sua coleção vai chegar?</h2>
              <div className={FORM_GRID}>
                <Controller
                  control={control}
                  name="cep"
                  render={({ field, fieldState }) => (
                    <FieldInput
                      field={field}
                      fieldState={fieldState}
                      label="CEP (00000-000)"
                      pattern="[0-9]{5}-?[0-9]{3}"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="street"
                  render={({ field, fieldState }) => (
                    <FieldInput field={field} fieldState={fieldState} label="Rua" />
                  )}
                />
                <Controller
                  control={control}
                  name="number"
                  render={({ field, fieldState }) => (
                    <FieldInput field={field} fieldState={fieldState} label="Número" />
                  )}
                />
                <Controller
                  control={control}
                  name="extra"
                  render={({ field, fieldState }) => (
                    <FieldInput
                      field={field}
                      fieldState={fieldState}
                      label="Complemento"
                      required={false}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="city"
                  render={({ field, fieldState }) => (
                    <FieldInput field={field} fieldState={fieldState} label="Cidade" />
                  )}
                />
                <Controller
                  control={control}
                  name="state"
                  render={({ field, fieldState }) => (
                    <FieldSelect
                      field={field}
                      fieldState={fieldState}
                      label="Estado (UF)"
                      options={BRAZILIAN_STATES}
                    />
                  )}
                />
              </div>
              <fieldset className={CHOICE_LIST}>
                <legend className="mb-3 text-sm font-extrabold">Entrega simulada</legend>
                <label className={CHOICE_LABEL}>
                  <input
                    type="radio"
                    name="shipping"
                    checked={shipping === 'standard'}
                    onChange={() => setShipping('standard')}
                  />
                  <Truck size={22} />
                  <span className="flex-1">
                    <strong>Padrão · 5–8 dias úteis</strong>
                    <small className={CHOICE_HINT}>Estimativa de demonstração</small>
                  </span>
                  <strong>
                    {subtotal >= FREE_SHIPPING_THRESHOLD
                      ? 'Grátis'
                      : money(STANDARD_SHIPPING_PRICE)}
                  </strong>
                </label>
                <label className={CHOICE_LABEL}>
                  <input
                    type="radio"
                    name="shipping"
                    checked={shipping === 'express'}
                    onChange={() => setShipping('express')}
                  />
                  <Truck size={22} />
                  <span className="flex-1">
                    <strong>Expressa · 2–4 dias úteis</strong>
                    <small className={CHOICE_HINT}>Estimativa de demonstração</small>
                  </span>
                  <strong>{money(EXPRESS_SHIPPING_PRICE)}</strong>
                </label>
              </fieldset>
            </fieldset>
            <fieldset hidden={step !== 2} disabled={step !== 2}>
              <h2 className={CHECKOUT_TITLE}>Como prefere pagar?</h2>
              <fieldset className={CHOICE_LIST}>
                <legend className="sr-only">Forma de pagamento</legend>
                <label className={CHOICE_LABEL}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'pix'}
                    onChange={() => setPayment('pix')}
                  />
                  <span className="flex-1">
                    <strong>Pix</strong>
                    <small className={CHOICE_HINT}>5% de desconto no exemplo</small>
                  </span>
                  <strong>{money(total)}</strong>
                </label>
                <label className={CHOICE_LABEL}>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'card'}
                    onChange={() => setPayment('card')}
                  />
                  <CreditCard size={22} />
                  <span className="flex-1">
                    <strong>Cartão de crédito</strong>
                    <small className={CHOICE_HINT}>Até 6x sem juros no exemplo</small>
                  </span>
                </label>
              </fieldset>
              <p className="notice">
                Não solicitamos número de cartão nem geramos código Pix. O pagamento real será
                habilitado após a integração com o gateway.
              </p>
            </fieldset>
            <div className="mt-[30px] flex justify-end gap-3.5">
              {step > 0 && <Button onPress={() => setStep(step - 1)}>Voltar</Button>}
              <Action type="submit" className="max-md:flex-1">
                {step === 2 ? 'Concluir simulação' : 'Continuar'} <ArrowRight size={18} />
              </Action>
            </div>
          </form>
        </div>
        <aside className="surface sticky top-[140px] p-[25px] max-md:static max-md:order-2">
          <h2 className={CHECKOUT_TITLE}>Resumo do carrinho</h2>
          <ShippingProgress total={subtotal} />
          {store.lines.map((line, i) => {
            const product = products.find((p) => p.id === line.id);
            if (!product) return null;
            const reservedElsewhere = store.lines
              .filter((l, j) => l.id === line.id && i !== j)
              .reduce((sum, l) => sum + l.qty, 0);
            return (
              <div
                className="grid grid-cols-[54px_1fr_24px] gap-3 border-b border-border py-[18px]"
                key={`${line.id}-${line.size}`}
              >
                <Image
                  className="h-[67px] w-[54px] rounded-lg object-cover"
                  src={product.image}
                  alt={product.name}
                  width={54}
                  height={67}
                />
                <div>
                  <strong className="block text-sm leading-[1.35]">{product.name}</strong>
                  {line.size && (
                    <small className="block text-xs text-muted">Tamanho {line.size}</small>
                  )}
                  <span className="text-sm">{money(product.price * line.qty)}</span>
                  <Quantity
                    size="compact"
                    value={line.qty}
                    max={product.stock - reservedElsewhere}
                    onChange={(qty) => store.quantity(i, qty)}
                  />
                </div>
                <Button
                  isIconOnly
                  className="min-w-[22px] bg-transparent p-0 text-muted"
                  aria-label={`Remover ${product.name}`}
                  onPress={() => store.quantity(i, 0)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            );
          })}
          {/* "coupon" é marcador: o globals.css ainda estiliza o input/botão do cupom (junto com os campos de formulário). */}
          <form
            className="coupon mt-[23px] flex gap-1.5"
            onSubmit={handleCouponSubmit(submitCoupon)}
          >
            <Controller
              control={couponControl}
              name="coupon"
              render={({ field }) => (
                <input aria-label="Cupom de desconto" placeholder="Cupom: GEEK10" {...field} />
              )}
            />
            <Button type="submit">Aplicar</Button>
          </form>
          {couponMessage && (
            <p role="status" className="muted text-sm">
              {couponMessage}
            </p>
          )}
          <dl className="mt-[23px]">
            <div className={`${TOTAL_ROW} py-[7px] text-sm`}>
              <dt>Subtotal</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className={`${TOTAL_ROW} py-[7px] text-sm`}>
                <dt>Cupom</dt>
                <dd>−{money(discount)}</dd>
              </div>
            )}
            <div className={`${TOTAL_ROW} py-[7px] text-sm`}>
              <dt>Frete simulado</dt>
              <dd>{freight ? money(freight) : 'Grátis'}</dd>
            </div>
            {pixDiscount > 0 && (
              <div className={`${TOTAL_ROW} py-[7px] text-sm`}>
                <dt>Desconto Pix</dt>
                <dd>−{money(pixDiscount)}</dd>
              </div>
            )}
            <div
              className={`${TOTAL_ROW} mt-3 border-t border-border pt-[18px] pb-[7px] text-2xl font-black`}
            >
              <dt>Total</dt>
              <dd>{money(total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
