export type MascotPose = 'hero' | 'welcome' | 'parcel' | 'search';
type MascotAsset = { src: string; alt: string };
type MascotOutfit = { hero: MascotAsset } & Partial<Record<MascotPose, MascotAsset>>;

export const mascotOutfits = {
  suit: {
    hero: { src: '/mascot/suit/hero.png', alt: 'Raposa GeekStore de terno dando joinha' },
    welcome: { src: '/mascot/suit/welcome.png', alt: 'Raposa GeekStore de terno acenando' },
    parcel: {
      src: '/mascot/suit/parcel.png',
      alt: 'Raposa GeekStore de terno segurando uma encomenda',
    },
    search: { src: '/mascot/suit/search.png', alt: 'Raposa GeekStore de terno com uma lupa' },
  },
  geekstore: {
    hero: {
      src: '/mascot/geekstore/hero.png',
      alt: 'Raposa GeekStore com jaqueta preta e amarela, óculos e tênis, dando joinha',
    },
    welcome: {
      src: '/mascot/geekstore/welcome.png',
      alt: 'Raposa GeekStore com jaqueta preta e amarela acenando',
    },
    parcel: {
      src: '/mascot/geekstore/parcel.png',
      alt: 'Raposa GeekStore com jaqueta preta e amarela segurando uma encomenda',
    },
    search: {
      src: '/mascot/geekstore/search.png',
      alt: 'Raposa GeekStore com jaqueta preta e amarela procurando com uma lupa',
    },
  },
} satisfies Record<string, MascotOutfit>;

// Change this single value to switch the outfit throughout the store.
export const activeMascotOutfit: keyof typeof mascotOutfits = 'geekstore';

// An outfit can launch with one pose; missing poses reuse its own hero.
export function getMascot(pose: MascotPose): MascotAsset {
  const outfit: MascotOutfit = mascotOutfits[activeMascotOutfit];
  return outfit[pose] ?? outfit.hero;
}
