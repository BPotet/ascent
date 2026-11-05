import { BOONS, type BoonFamily, type BoonKind } from '../../../domain/ascent/boons';
import type { Rarity } from '../../../domain/ascent/rarity';
import { loadoutChipText, rarityMarks, rarityName, type LoadoutChipText } from './rarityText';

/** Les textes des bienfaits (prototype #92), tirés du glossaire et de la maquette de #88. */
export const BOON_NAMES: Readonly<Record<BoonKind, string>> = {
  perfectEcho: 'Écho parfait',
  shatteringEmber: 'Braise brisante',
  frostSkin: 'Peau de givre',
  trueEdge: 'Lame juste',
  blazingEmber: 'Braise ardente',
  lingeringFrost: 'Givre persistant',
  winterVigil: "Veillée d'hiver",
  emberHeart: 'Cœur de braise',
  thornReturn: 'Ronce rendue',
  hoarfrost: 'Gelée blanche',
  ashenBlade: 'Lame de cendre',
  heatedBronze: 'Bronze chauffé',
  trueHour: 'Heure juste',
  belfryFrost: 'Givre du clocher',
};

const BOON_EFFECTS: Readonly<Record<BoonKind, string>> = {
  perfectEcho: 'Ta contre-attaque fait 50 % de dégâts en plus (6 → 9 PV).',
  shatteringEmber: 'Brise-garde ×1,3 : tes coups entament plus vite la garde.',
  frostSkin: 'Réduction des dégâts +10 points (40 % au plus).',
  trueEdge: 'Ta frappe parfaite multiplie les dégâts par 2 au lieu de 1,5.',
  blazingEmber: 'Un ennemi étourdi subit ×2 au lieu de ×1,5.',
  lingeringFrost: 'Un ennemi étourdi se relève avec la moitié de sa garde seulement.',
  winterVigil:
    'Réduction des dégâts +10 points (40 % au plus) et +1 Élan au début de chaque combat.',
  emberHeart: 'Chaque garde que tu brises : +1 Élan et 5 PV rendus.',
  // Les bienfaits de palier (#212), textes de la maquette 210.
  thornReturn: 'Ta contre-attaque fait 30 % de dégâts en plus.',
  hoarfrost: 'Chaque impact paré parfaitement te rend 2 PV.',
  ashenBlade: 'Attaque +25 % : tous tes coups frappent plus fort.',
  heatedBronze: 'Attaque +10 % : tous tes coups frappent plus fort.',
  trueHour: 'Ta frappe parfaite multiplie les dégâts par 1,8 au lieu de 1,5.',
  belfryFrost:
    'Réduction des dégâts +5 points (40 % au plus) et 2 PV rendus par impact paré parfaitement.',
};

const FAMILY_NAMES: Readonly<Record<BoonFamily, string>> = {
  frost: 'Givre',
  ember: 'Braise',
  echo: 'Écho',
};

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
    tag: `${rarityMarks(rarity)} ${FAMILY_NAMES[family]} · ${rarityName(rarity)}`,
    effect,
    rarity,
    label: `${name}, ${FAMILY_NAMES[family]}, ${rarityName(rarity)}. ${effect}`,
  };
}

/** Ce que le lecteur d'écran annonce sur « Bienfait obtenu. » : le bienfait, puis son effet. */
export function boonObtainedLabel(kind: BoonKind): string {
  return `Bienfait obtenu : ${boonCard(kind).label}`;
}

/** La pastille d'équipement d'un bienfait : « Givre persistant », « ◆◆ Rare » (#157). */
export function boonChip(kind: BoonKind): LoadoutChipText {
  return loadoutChipText(BOON_NAMES[kind], BOONS[kind].rarity);
}

/**
 * La section « Bienfaits » des sorties, lue d'un trait, dans l'ordre où les bienfaits ont été
 * gagnés : « Bienfaits : Écho parfait, Commun ; Givre persistant, Rare ».
 */
export function ownedBoonsLabel(boons: readonly BoonKind[]): string {
  return `Bienfaits : ${boons.map((kind) => boonChip(kind).label).join(' ; ')}`;
}
