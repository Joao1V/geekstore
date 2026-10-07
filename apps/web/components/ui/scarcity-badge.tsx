import { Flame } from 'lucide-react';

/** Selo laranja com fogo (como nos marketplaces) para a ÚLTIMA unidade: urgência clara na página do produto. */
export function ScarcityBadge({ available }: { available: number }) {
  if (available !== 1) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-brand-orange px-3 py-1.5 text-sm font-black text-white dark:text-ink">
      <Flame size={16} aria-hidden="true" fill="currentColor" />
      Última unidade!
    </span>
  );
}
