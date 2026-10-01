import { Header, ListBox } from '@heroui/react';
import type { ReactNode } from 'react';

/**
 * `group` agrupa opções sob um cabeçalho; opções sem `group` ficam soltas, no topo da lista.
 * `textValue` é o texto usado para filtrar e mostrado no campo depois de escolher (Autocomplete);
 * por padrão é o `label`.
 */
export type FieldSelectOption = {
  value: string;
  label: string;
  group?: string;
  textValue?: string;
};

type Section = { title: string | null; options: FieldSelectOption[] };

/** Agrupa mantendo a ordem de primeira aparição de cada grupo. */
function toSections(options: FieldSelectOption[]): Section[] {
  return options.reduce<Section[]>((sections, option) => {
    const title = option.group ?? null;
    const index = sections.findIndex((section) => section.title === title);
    if (index === -1) return [...sections, { title, options: [option] }];
    return sections.map((section, i) =>
      i === index ? { ...section, options: [...section.options, option] } : section
    );
  }, []);
}

/**
 * É função (não componente) de propósito: o ListBox do React Aria monta a coleção a partir dos
 * elementos filhos diretos.
 */
function renderItem(option: FieldSelectOption): ReactNode {
  return (
    <ListBox.Item
      key={option.value}
      id={option.value}
      textValue={option.textValue ?? option.label}
      className="rounded-sm"
    >
      {option.label}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  );
}

/** Filhos do `ListBox` para o Select e o Autocomplete: lista plana ou seções com cabeçalho. */
export function renderFieldOptions(options: FieldSelectOption[]): ReactNode {
  const sections = toSections(options);
  if (sections.length === 1 && sections[0]?.title === null) {
    return sections[0].options.map((option) => renderItem(option));
  }
  // O divisor é uma borda da própria seção (não um <Separator/> solto): ao filtrar, seções sem
  // resultado somem e levam a borda junto; separadores soltos ficariam empilhados na lista.
  return sections.map((section) => (
    <ListBox.Section
      key={section.title ?? 'ungrouped'}
      className="border-border border-t pt-1 first:border-t-0 first:pt-0"
    >
      {section.title && <Header>{section.title}</Header>}
      {section.options.map((option) => renderItem(option))}
    </ListBox.Section>
  ));
}
