'use client';

export function Price({ value }: { value: number }) {
  const [whole, cents] = value.toFixed(2).split('.');
  return (
    <span className="price">
      <span className="sr-only">{`R$ ${whole},${cents}`}</span>
      <span aria-hidden="true">
        <small>R$</small> {Number(whole).toLocaleString('pt-BR')}
        <sup>{cents}</sup>
      </span>
    </span>
  );
}
