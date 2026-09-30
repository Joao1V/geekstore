'use client';

const SIZES = {
  md: 'text-3xl max-tablet:text-2xl',
  lg: 'text-5xl max-md:text-4xl',
};

export function Price({ value, size = 'md' }: { value: number; size?: keyof typeof SIZES }) {
  const [whole, cents] = value.toFixed(2).split('.');
  return (
    <span
      className={`${SIZES[size]} leading-[1.2] font-extrabold tracking-[-0.045em] whitespace-nowrap`}
    >
      <span className="sr-only">{`R$ ${whole},${cents}`}</span>
      <span aria-hidden="true">
        <small className="text-[0.52em] font-semibold tracking-normal">R$</small>{' '}
        {Number(whole).toLocaleString('pt-BR')}
        <sup className="relative top-[0.18em] ml-0.5 align-top text-[0.47em] font-normal tracking-normal">
          {cents}
        </sup>
      </span>
    </span>
  );
}
