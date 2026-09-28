# Mascot outfits

Each outfit lives in its own directory. Keep identifiers and filenames in English.

- `suit/`: original formal outfit with `hero.png`, `welcome.png`, `parcel.png`, and `search.png`.
- `geekstore/`: exclusive black/yellow jacket outfit with `hero.png`, `welcome.png`, `parcel.png`, and `search.png`.

Change `activeMascotOutfit` in `lib/mascot.ts` to switch the whole site. Register future outfits such as `ninja`, `gamer`, or `halloween` in `mascotOutfits`, then select the new key. Each outfit needs a hero asset; optional poses fall back to the same outfit's hero, never another costume. Register each pose's accurate alternative text alongside its path. Keep transparent PNGs with consistent character scale and clear margins.

The logo is a separate brand asset and is not switched with the outfit.
