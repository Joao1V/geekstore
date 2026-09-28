'use client';

import { Button } from '@heroui/react';
import { ArrowLeft, ArrowRight, Check, CreditCard, LockKeyhole, Trash2, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Action, Field, Quantity } from '@/components/ui';
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

export function Checkout() {
  const store = useCartStore();
  const [step, setStep] = useState(0);
  const [coupon, setCoupon] = useState('');
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

  const submitStep = (event: React.FormEvent) => {
    event.preventDefault();
    if (step < 2) setStep(step + 1);
    else setComplete(true);
  };

  const submitCoupon = (event: React.FormEvent) => {
    event.preventDefault();
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
      <div className="checkout-grid">
        <div>
          <div className="steps">
            {CHECKOUT_STEPS.map((title, i) => (
              <button
                key={title}
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                className={step === i ? 'active' : ''}
              >
                <span>{i < step ? <Check size={16} /> : i + 1}</span>
                {title}
              </button>
            ))}
          </div>
          <form className="checkout-form surface" onSubmit={submitStep}>
            <fieldset hidden={step !== 0} disabled={step !== 0}>
              <h2>Como podemos falar com você?</h2>
              <p className="muted">Continue como visitante. Não é necessário criar uma conta.</p>
              <div className="form-grid">
                <Field label="Nome de exemplo" name="name" autoComplete="off" />
                <Field label="E-mail de exemplo" name="email" type="email" autoComplete="off" />
                <Field
                  label="Telefone (opcional)"
                  name="phone"
                  type="tel"
                  required={false}
                  autoComplete="off"
                />
              </div>
            </fieldset>
            <fieldset hidden={step !== 1} disabled={step !== 1}>
              <h2>Onde sua coleção vai chegar?</h2>
              <div className="form-grid">
                <Field label="CEP (00000-000)" name="cep" pattern="[0-9]{5}-?[0-9]{3}" />
                <Field label="Rua" name="street" />
                <Field label="Número" name="number" />
                <Field label="Complemento" name="extra" required={false} />
                <Field label="Cidade" name="city" />
                <Field label="Estado (UF)" name="state" pattern="[A-Za-z]{2}" />
              </div>
              <fieldset className="choice-list">
                <legend>Entrega simulada</legend>
                <label>
                  <input
                    type="radio"
                    name="shipping"
                    checked={shipping === 'standard'}
                    onChange={() => setShipping('standard')}
                  />
                  <Truck size={22} />
                  <span>
                    <strong>Padrão · 5–8 dias úteis</strong>
                    <small>Estimativa de demonstração</small>
                  </span>
                  <strong>
                    {subtotal >= FREE_SHIPPING_THRESHOLD
                      ? 'Grátis'
                      : money(STANDARD_SHIPPING_PRICE)}
                  </strong>
                </label>
                <label>
                  <input
                    type="radio"
                    name="shipping"
                    checked={shipping === 'express'}
                    onChange={() => setShipping('express')}
                  />
                  <Truck size={22} />
                  <span>
                    <strong>Expressa · 2–4 dias úteis</strong>
                    <small>Estimativa de demonstração</small>
                  </span>
                  <strong>{money(EXPRESS_SHIPPING_PRICE)}</strong>
                </label>
              </fieldset>
            </fieldset>
            <fieldset hidden={step !== 2} disabled={step !== 2}>
              <h2>Como prefere pagar?</h2>
              <fieldset className="choice-list">
                <legend className="sr-only">Forma de pagamento</legend>
                <label>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'pix'}
                    onChange={() => setPayment('pix')}
                  />
                  <span>
                    <strong>Pix</strong>
                    <small>5% de desconto no exemplo</small>
                  </span>
                  <strong>{money(total)}</strong>
                </label>
                <label>
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === 'card'}
                    onChange={() => setPayment('card')}
                  />
                  <CreditCard size={22} />
                  <span>
                    <strong>Cartão de crédito</strong>
                    <small>Até 6x sem juros no exemplo</small>
                  </span>
                </label>
              </fieldset>
              <p className="notice">
                Não solicitamos número de cartão nem geramos código Pix. O pagamento real será
                habilitado após a integração com o gateway.
              </p>
            </fieldset>
            <div className="checkout-actions">
              {step > 0 && <Button onPress={() => setStep(step - 1)}>Voltar</Button>}
              <Action type="submit">
                {step === 2 ? 'Concluir simulação' : 'Continuar'} <ArrowRight size={18} />
              </Action>
            </div>
          </form>
        </div>
        <aside className="order-summary surface">
          <h2>Resumo do carrinho</h2>
          <ShippingProgress total={subtotal} />
          {store.lines.map((line, i) => {
            const product = products.find((p) => p.id === line.id);
            if (!product) return null;
            const reservedElsewhere = store.lines
              .filter((l, j) => l.id === line.id && i !== j)
              .reduce((sum, l) => sum + l.qty, 0);
            return (
              <div className="summary-line" key={`${line.id}-${line.size}`}>
                <Image src={product.image} alt={product.name} width={54} height={67} />
                <div>
                  <strong>{product.name}</strong>
                  {line.size && <small>Tamanho {line.size}</small>}
                  <span>{money(product.price * line.qty)}</span>
                  <Quantity
                    value={line.qty}
                    max={product.stock - reservedElsewhere}
                    onChange={(qty) => store.quantity(i, qty)}
                  />
                </div>
                <Button
                  isIconOnly
                  aria-label={`Remover ${product.name}`}
                  onPress={() => store.quantity(i, 0)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            );
          })}
          <form className="coupon" onSubmit={submitCoupon}>
            <input
              aria-label="Cupom de desconto"
              placeholder="Cupom: GEEK10"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
            />
            <Button type="submit">Aplicar</Button>
          </form>
          {couponMessage && (
            <p role="status" className="muted text-sm">
              {couponMessage}
            </p>
          )}
          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div>
                <dt>Cupom</dt>
                <dd>−{money(discount)}</dd>
              </div>
            )}
            <div>
              <dt>Frete simulado</dt>
              <dd>{freight ? money(freight) : 'Grátis'}</dd>
            </div>
            {pixDiscount > 0 && (
              <div>
                <dt>Desconto Pix</dt>
                <dd>−{money(pixDiscount)}</dd>
              </div>
            )}
            <div className="total">
              <dt>Total</dt>
              <dd>{money(total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
