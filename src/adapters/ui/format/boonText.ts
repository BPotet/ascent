import { BOONS, type BoonFamily, type BoonKind } from '../../../domain/ascent/boons';
import type { Rarity } from '../../../domain/ascent/rarity';

/** Les textes des bienfaits (prototype #92), tirés du glossaire et de la maquette de #88. */
export const BOON_NAMES: Readonly<Record<BoonKind, string>> = {
  perfectEcho: 'Écho parfait',
  shatteringEmber: 'Braise brisante',
  frostSkin: 'Peau de givre',
  trueEdge: 'Lame juste',
  blazingEmber: 'Braise ardente',
  lingeringFrost: 'Givre persistant',
  emberHeart: 'Cœur de braise',
};

const BOON_EFFECTS: Readonly<Record<BoonKind, string>> = {
  perfectEcho: 'Ta contre-attaque fait 50 % de dégâts en plus (6 → 9 PV).',
  shatteringEmber: 'Brise-garde ×1,3 : tes coups entament plus vite la garde.',
  frostSkin: 'Réduction des dégâts +10 points (40 % au plus).',
  trueEdge: 'Ta frappe parfaite multiplie les dégâts par 2 au lieu de 1,5.',
  blazingEmber: 'Un ennemi étourdi subit ×2 au lieu de ×1,5.',
  lingeringFrost: 'Un ennemi étourdi se relève avec la moitié de sa garde seulement.',
  emberHeart: 'Chaque garde que tu brises : +1 Élan et 5 PV rendus.',
};

const FAMILY_NAMES: Readonly<Record<BoonFamily, string>> = {
  frost: 'Givre',
  ember: 'Braise',
  echo: 'Écho',
};

/** La rareté d'un bienfait, au masculin. */
const RARITY_NAMES: Readonly<Record<Rarity, string>> = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
};

/** Les losanges de la rareté : 1, 2 ou 3. */
const RARITY_MARKS: Readonly<Record<Rarity, string>> = { common: '◆', rare: '◆◆', epic: '◆◆◆' };

/** La carte d'un bienfait : nom, famille et rareté (en mot et en losanges), effet. */
export interface BoonCard {
  readonly name: string;
  readonly tag: string;
  readonly effect: string;
  readonly rarity: Rarity;
  readonly label: string;
}

export function boonCard(kind: BoonKind): BoonCard {
  const { family, rarity } = BOONS[kind];
  const name = BOON_NAMES[kind];
  const effect = BOON_EFFECTS[kind];
  return {
    name,
    tag: `${RARITY_MARKS[rarity]} ${FAMILY_NAMES[family]} · ${RARITY_NAMES[rarity]}`,
    effect,
    rarity,
    label: `${name}, ${FAMILY_NAMES[family]}, ${RARITY_NAMES[rarity]}. ${effect}`,
  };
}

/** Les bienfaits possédés, sous le héros : « Bienfaits : Écho parfait, Givre persistant ». */
export function ownedBoonsLine(boons: readonly BoonKind[]): string {
  return boons.length === 0
    ? 'Aucun bienfait'
    : `Bienfaits : ${boons.map((kind) => BOON_NAMES[kind]).join(', ')}`;
}
