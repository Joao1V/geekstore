import { formatInteger } from '../lib/format';

export type FilterChip = {
  id: string;
  label: string;
  /** `undefined` enquanto carrega: o atalho aparece, o número não. */
  count?: number;
  /** Marca o atalho que mostra problemas (ex.: sem estoque): um ponto colorido quando há itens. */
  attention?: 'warning' | 'error';
};

const DOT = { warning: 'bg-status-warning', error: 'bg-status-error' };

/** Atalhos de filtro com contagem: mostra de relance onde está o trabalho a fazer. */
export function FilterChips({
  label,
  chips,
  active,
  onSelect,
}: {
  label: string;
  chips: FilterChip[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset className="m-0 mb-4 flex min-w-0 flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">{label}</legend>
      {chips.map((chip) => {
        const isActive = chip.id === active;
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(chip.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-extrabold transition-colors ${
              isActive
                ? 'border-geek-yellow bg-geek-yellow text-ink'
                : 'border-border bg-surface hover:border-ink'
            }`}
          >
            {chip.attention && Boolean(chip.count) && (
              <span aria-hidden="true" className={`size-2 rounded-full ${DOT[chip.attention]}`} />
            )}
            {chip.label}
            {chip.count !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-2xs tabular-nums ${
                  isActive ? 'bg-ink/15' : 'bg-surface-secondary text-muted'
                }`}
              >
                {formatInteger(chip.count)}
              </span>
            )}
          </button>
        );
      })}
    </fieldset>
  );
}
