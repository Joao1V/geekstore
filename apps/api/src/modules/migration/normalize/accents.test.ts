import { describe, expect, it } from 'vitest';

import { restoreAccents } from './accents';
import { cleanProductName } from './normalize';

describe('restoreAccents', () => {
  it('restores known words and keeps the capitalization', () => {
    expect(restoreAccents('Caneca Mundo Magico Harry Potter Pocao')).toBe(
      'Caneca Mundo Mágico Harry Potter Poção'
    );
    expect(restoreAccents('Jogo Expansao 55 Pecas Em Ingles')).toBe(
      'Jogo Expansão 55 Peças Em Inglês'
    );
    expect(restoreAccents('LEGO 600 PECAS')).toBe('LEGO 600 PEÇAS');
  });

  it('does not trip on words that are also object properties', () => {
    expect(restoreAccents('Constructor toString valueOf Hasownproperty')).toBe(
      'Constructor toString valueOf Hasownproperty'
    );
  });

  it('leaves unknown words and already accented words alone', () => {
    expect(restoreAccents('Boneco Funko Pop Hulk')).toBe('Boneco Funko Pop Hulk');
    expect(restoreAccents('Peças Mágicas')).toBe('Peças Mágicas');
  });
});

describe('cleanProductName', () => {
  it('drops the ERP e-commerce marker and restores accents', () => {
    expect(cleanProductName('Caneca Mundo Magico 350ML e-Commerce')).toBe(
      'Caneca Mundo Mágico 350ML'
    );
    expect(cleanProductName('Caneca Tina - e-Commerce')).toBe('Caneca Tina');
  });
});
