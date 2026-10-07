import { Flame } from 'lucide-react';

/** Até quantas unidades o aviso de "corre que acaba" aparece. */
export const LOW_STOCK_THRESHOLD = 3;

/** Selo laranja com fogo (como nos marketplaces): urgência clara quando restam poucas unidades. */
export function ScarcityBadge({
  available,
  compact = false,
}: {
  available: number;
  compact?: boolean;
}) {
  if (available < 1 || available > LOW_STOCK_THRESHOLD) return null;
  const text = available === 1 ? 'Última unidade!' : `Últimas ${available} unidades!`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-brand-orange font-black text-white dark:text-ink ${compact ? 'px-2 py-1 text-2xs' : 'px-3 py-1.5 text-sm'}`}
    >
      <Flame size={compact ? 12 : 16} aria-hidden="true" fill="currentColor" />
      {text}
    </span>
  );
}
