/** Sem acento, maiúsculas, só letras/números/espaços: "Pokémon: Ônix!" -> "POKEMON ONIX". */
export const plainUpper = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9#]+/g, ' ')
    .trim();
