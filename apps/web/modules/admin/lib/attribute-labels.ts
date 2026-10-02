import type { Attribute } from '@geekstore/shared';

/** `{ cor: 'preto', tamanho: 'gg' }` -> "Preto · GG", na ordem dos atributos cadastrados. */
export function describeAttributes(
  attributes: Record<string, string>,
  definitions: Attribute[] | undefined
): string {
  if (!definitions) return '';
  return definitions
    .flatMap((definition) => {
      const code = attributes[definition.code];
      if (!code) return [];
      return [definition.values.find((value) => value.code === code)?.label ?? code];
    })
    .join(' · ');
}
