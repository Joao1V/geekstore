import { describe, expect, it } from 'vitest';

import { ruleClean } from './rule-clean';

describe('ruleClean', () => {
  it('removes Hot Wheels and Matchbox codes from the end, keeping the collection numbers', () => {
    expect(ruleClean('Miniatura Hot Wheels HW Metro 4/10 Drone Duty 102/250 HKG93-M7C5')).toEqual({
      name: 'Miniatura Hot Wheels HW Metro 4/10 Drone Duty 102/250',
      removed: ['HKG93-M7C5'],
    });
    expect(
      ruleClean('Miniatura Matchbox Sky Busters 70 Years Cessna Citation X HHT34 / HLJ12')
    ).toEqual({
      name: 'Miniatura Matchbox Sky Busters 70 Years Cessna Citation X',
      removed: ['HHT34', 'HLJ12'],
    });
  });

  it('removes licensed codes, hash codes and the dash that came before them', () => {
    expect(ruleClean('Almofada Disney Mickey Mouse DBBL80P-MK1')?.name).toBe(
      'Almofada Disney Mickey Mouse'
    );
    expect(ruleClean('Pelucia Turma da Monica Dalila #MXT004L-Dl')?.name).toBe(
      'Pelucia Turma da Monica Dalila'
    );
    expect(ruleClean('Copo Acrílico DC Super Friends 600ML WES8809-DC2P')?.name).toBe(
      'Copo Acrílico DC Super Friends 600ML'
    );
    expect(ruleClean('Caneca Melhor Pai Imaginarium 300ML - CS2002')).toEqual({
      name: 'Caneca Melhor Pai Imaginarium 300ML',
      removed: ['CS2002'],
    });
    expect(ruleClean('Loz Mini Corner Bedroom 592 Peças #1902')?.name).toBe(
      'Loz Mini Corner Bedroom 592 Peças'
    );
  });

  it('removes Imaginarium references and the odd Hot Wheels spellings', () => {
    expect(ruleClean('Cooler com Alcas Fica Frio PI6283Y')?.name).toBe(
      'Cooler com Alcas Fica Frio'
    );
    expect(ruleClean('Almofada Linho Abstrata MI3750')?.name).toBe('Almofada Linho Abstrata');
    expect(ruleClean('Miniatura Hotwheels Honda CB750 Café HW Moto HKG49.M7C5')?.name).toBe(
      'Miniatura Hotwheels Honda CB750 Café HW Moto'
    );
  });

  it('keeps what is part of the product: LEGO sets, short numbers, model names', () => {
    expect(ruleClean('LEGO Marvel Spider-Man 466 Peças #76175')).toBeNull();
    expect(ruleClean('Miniatura Greenlight Indycar #5 James Hinchcliffe')).toBeNull();
    expect(ruleClean('Miniatura Ford Escort RS2000')).toBeNull();
    expect(ruleClean('Camiseta Naruto Preto GG')).toBeNull();
    expect(ruleClean('Boneco Funko Pop Pennywise 55')).toBeNull();
  });
});
