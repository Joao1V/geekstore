import { ToggleButton, ToggleButtonGroup } from '@heroui/react';

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
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      isDetached
      size="sm"
      selectedKeys={[active]}
      onSelectionChange={(keys) => {
        const [next] = [...keys];
        if (next !== undefined) onSelect(String(next));
      }}
      className="mb-4 flex-wrap"
    >
      {chips.map((chip) => {
        const isActive = chip.id === active;
        return (
          <ToggleButton
            key={chip.id}
            id={chip.id}
            className="gap-2 font-extrabold data-[selected=true]:bg-geek-yellow data-[selected=true]:text-ink"
          >
            {chip.attention && Boolean(chip.count) && (
              <span aria-hidden="true" className={`size-2 rounded-full ${DOT[chip.attention]}`} />
            )}
            {chip.label}
            {chip.count !== undefined && (
              <span
                className={`rounded px-2 py-0.5 text-2xs tabular-nums ${
                  isActive ? 'bg-ink/15' : 'bg-surface-secondary text-muted'
                }`}
              >
                {formatInteger(chip.count)}
              </span>
            )}
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}
