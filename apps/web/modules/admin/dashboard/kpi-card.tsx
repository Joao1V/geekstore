import type { LucideIcon } from 'lucide-react';

/** Cartão de número do painel: o valor grande, o que ele é e um complemento curto. */
export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="surface flex items-start gap-4 p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-geek-yellow text-ink">
        <Icon size={21} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="muted text-xs font-extrabold tracking-wide uppercase">{label}</p>
        <p className="font-display text-4xl leading-tight tracking-wide tabular-nums">{value}</p>
        {hint && <p className="muted text-xs">{hint}</p>}
      </div>
    </div>
  );
}
