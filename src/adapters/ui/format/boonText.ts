import {
  BOONS,
  SECOND_BREATH,
  boonTier,
  secondBreathHp,
  type BoonFamily,
  type BoonKind,
  type OfferCard,
} from '../../../domain/ascent/boons';
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

/** La carte d'un bienfait dans l'offre (#212) : son repère de palier, lu à la fin de son nom. */
export interface OfferBoonCard extends BoonCard {
  /** « · Palier 2 » pour un bienfait de palier, `null` sinon. */
  readonly tierMark: string | null;
}

/**
 * La carte d'un bienfait dans l'offre (#212, maquette 210) : un bienfait de palier finit sa ligne
 * par « · Palier N ». Dans l'offre seulement : ni l'Équipement ni le camp ne le montrent.
 */
export function offerBoonCard(kind: BoonKind): OfferBoonCard {
  const card = boonCard(kind);
  const tier = boonTier(kind);
  if (tier === null) return { ...card, tierMark: null };
  const { family, rarity } = BOONS[kind];
  return {
    ...card,
    tierMark: `· Palier ${tier}`,
    label: `${card.name}, ${FAMILY_NAMES[family]}, ${rarityName(rarity)}, palier ${tier}. ${card.effect}`,
  };
}

const CARD_COUNTS: Readonly<Record<number, string>> = { 2: 'deux', 3: 'trois' };

/**
 * Le titre et le sous-titre de l'offre (#212) : ils comptent les cartes ; la carte Second souffle
 * seule s'annonce « Reprends ton souffle ».
 */
export function offerHeading(offer: readonly OfferCard[]): {
  readonly title: string;
  readonly sub: string;
} {
  if (offer.length === 1 && offer[0] === SECOND_BREATH) {
    return { title: 'Reprends ton souffle', sub: 'Tu as tous les bienfaits de ce palier.' };
  }
  return {
    title: 'Choisis un bienfait',
    sub: `Un seul des ${CARD_COUNTS[offer.length]}. Un bienfait dure jusqu'à la fin de l'ascension.`,
  };
}

/** La carte Second souffle (#212) : ce qu'elle rendra au héros à `hp` PV sur `maxHp`. */
export interface SecondBreathCard {
  readonly name: string;
  readonly gain: string;
  /** Les PV après le soin. */
  readonly healed: number;
  readonly tag: string;
  readonly effect: string;
  readonly hpLine: string;
  /** « Tes PV sont déjà pleins. » à PV pleins, `null` sinon. */
  readonly full: string | null;
  readonly label: string;
}

export function secondBreathCard(hp: number, maxHp: number): SecondBreathCard {
  const healed = secondBreathHp(hp, maxHp);
  const gain = healed - hp;
  return {
    name: 'Second souffle',
    gain: `+${gain} PV`,
    healed,
    tag: 'Soin',
    effect: 'Rend 10 % de tes PV max, tout de suite.',
    hpLine: gain > 0 ? `${hp} → ${healed} / ${maxHp} PV` : `${maxHp} / ${maxHp} PV`,
    full: gain > 0 ? null : 'Tes PV sont déjà pleins.',
    label:
      gain > 0
        ? `Second souffle : rend ${gain} PV, de ${hp} à ${healed} PV sur ${maxHp}. Ce n'est pas un bienfait.`
        : `Second souffle : rend 0 PV, tes PV sont déjà pleins, ${maxHp} sur ${maxHp}. Ce n'est pas un bienfait.`,
  };
}

/** L'écran après le choix de Second souffle (#212) : les PV rendus, et l'annonce polie. */
export function secondBreathObtained(
  hp: number,
  maxHp: number,
): {
  readonly gain: string;
  readonly healed: number;
  readonly hpLine: string;
  readonly line: string;
  readonly label: string;
} {
  const healed = secondBreathHp(hp, maxHp);
  const gain = healed - hp;
  return gain > 0
    ? {
        gain: `+${gain} PV`,
        healed,
        hpLine: `PV ${hp} → ${healed} / ${maxHp}`,
        line: 'PV rendus.',
        label: `PV rendus : Second souffle, ${gain} PV. PV ${healed} sur ${maxHp}.`,
      }
    : {
        gain: '+0 PV',
        healed,
        hpLine: `PV ${maxHp} / ${maxHp}`,
        line: 'Tes PV étaient déjà pleins.',
        label: `Second souffle : PV déjà pleins, ${maxHp} sur ${maxHp}.`,
      };
}
