/**
 * Les bienfaits (`Boon`, prototype #92, règles P16 à P18 de #88) : 1 parmi 3 après chaque combat
 * gagné, sauf le boss ; ils durent jusqu'à la fin de l'ascension et entrent dans le combat par les
 * modificateurs du héros. Aucun ne touche l'Initiative. Les offres sont tirées parmi les 7 bienfaits
 * de base (#195) et les bienfaits de palier des paliers atteints (#212) ; Cœur de braise, à
 * débloquer, n'entre que par son tirage après une Élite.
 */
import { nextRandom, type RandomState } from '../battle/SeededRandom';
import { combineModifiers, type HeroModifiers } from '../battle/heroModifiers';
import { drawWeighted, type Drawn, type Weighted } from './draw';
import type { Rarity } from './rarity';
import type { Tier } from './tiers';

export type BoonKind =
  | 'perfectEcho'
  | 'shatteringEmber'
  | 'frostSkin'
  | 'trueEdge'
  | 'blazingEmber'
  | 'lingeringFrost'
  | 'winterVigil'
  | 'emberHeart'
  | 'thornReturn'
  | 'hoarfrost'
  | 'ashenBlade'
  | 'heatedBronze'
  | 'trueHour'
  | 'belfryFrost';

/** La famille de bienfaits (`BoonFamily`) : Givre, Braise, Écho. */
export type BoonFamily = 'frost' | 'ember' | 'echo';

export interface Boon {
  readonly family: BoonFamily;
  readonly rarity: Rarity;
  readonly modifiers: Partial<HeroModifiers>;
}

export const BOONS: Readonly<Record<BoonKind, Boon>> = {
  perfectEcho: {
    family: 'echo',
    rarity: 'common',
    modifiers: { counterPercents: [150] },
  },
  shatteringEmber: {
    family: 'ember',
    rarity: 'common',
    modifiers: { guardDamagePercents: [130] },
  },
  frostSkin: {
    family: 'frost',
    rarity: 'common',
    modifiers: { damageReductionPoints: 10 },
  },
  trueEdge: {
    family: 'echo',
    rarity: 'rare',
    modifiers: { perfectStrikeBonusPercents: [50] },
  },
  blazingEmber: {
    family: 'ember',
    rarity: 'rare',
    modifiers: { stunnedBonusPercent: 50 },
  },
  lingeringFrost: {
    family: 'frost',
    rarity: 'rare',
    modifiers: { guardRestorePercent: 50 },
  },
  // Veillée d'hiver prend la place de Cœur de braise dans la liste de base (#195) : même position,
  // même poids, donc les mêmes tirages.
  winterVigil: {
    family: 'frost',
    rarity: 'epic',
    modifiers: { damageReductionPoints: 10, startingMomentum: 1 },
  },
  // Un nom de code de sauvegarde (ADR 0010) : Cœur de braise existe toujours, à débloquer (#195).
  emberHeart: {
    family: 'ember',
    rarity: 'epic',
    modifiers: { onGuardBreak: { momentum: 1, heal: 5 } },
  },
  // Les bienfaits de palier (#212), après Cœur de braise : les 7 bienfaits de base gardent leur
  // place, donc les tirages du palier 1.
  thornReturn: {
    family: 'echo',
    rarity: 'common',
    modifiers: { counterPercents: [130] },
  },
  hoarfrost: {
    family: 'frost',
    rarity: 'rare',
    modifiers: { healOnPerfectParry: 2 },
  },
  ashenBlade: {
    family: 'ember',
    rarity: 'epic',
    modifiers: { attackBonusPercent: 25 },
  },
  heatedBronze: {
    family: 'ember',
    rarity: 'common',
    modifiers: { attackBonusPercent: 10 },
  },
  trueHour: {
    family: 'echo',
    rarity: 'rare',
    modifiers: { perfectStrikeBonusPercents: [30] },
  },
  belfryFrost: {
    family: 'frost',
    rarity: 'epic',
    modifiers: { damageReductionPoints: 5, healOnPerfectParry: 2 },
  },
};

/** Les 14 bienfaits, pour les textes et les icônes. */
export const BOON_KINDS = Object.keys(BOONS) as readonly BoonKind[];

/**
 * Les bienfaits de palier (`TierBoon`, #212) : un par famille aux paliers 2 et 3, qui n'entrent
 * dans l'offre qu'à partir de leur palier.
 */
export const TIER_BOONS: Readonly<Record<2 | 3, readonly BoonKind[]>> = {
  2: ['thornReturn', 'hoarfrost', 'ashenBlade'],
  3: ['heatedBronze', 'trueHour', 'belfryFrost'],
};

/** Le palier d'un bienfait de palier, `null` pour un autre bienfait. */
export function boonTier(kind: BoonKind): 2 | 3 | null {
  if (TIER_BOONS[2].includes(kind)) return 2;
  return TIER_BOONS[3].includes(kind) ? 3 : null;
}

/**
 * Les 7 bienfaits de base (`BaseBoon`, #195), tirés dans chaque offre : tous sauf Cœur de braise et
 * les bienfaits de palier.
 */
export const BASE_BOON_KINDS: readonly BoonKind[] = BOON_KINDS.filter(
  (kind) => kind !== 'emberHeart' && boonTier(kind) === null,
);

/**
 * La réserve de tirage du palier `tier` (#212) : les 7 bienfaits de base, puis les bienfaits de
 * palier des paliers atteints, dans cet ordre fixe (7, 10 puis 13). Au palier 1, la liste
 * d'avant : les mêmes tirages.
 */
export function boonPool(tier: Tier): readonly BoonKind[] {
  return [
    ...BASE_BOON_KINDS,
    ...(tier >= 2 ? TIER_BOONS[2] : []),
    ...(tier >= 3 ? TIER_BOONS[3] : []),
  ];
}

/** Le poids d'un bienfait dans une offre, selon sa rareté (P17). */
export const RARITY_WEIGHTS: Readonly<Record<Rarity, number>> = { common: 6, rare: 3, epic: 1 };

/**
 * Les bienfaits de la réserve du palier qui peuvent être offerts, avec leur poids : jamais un
 * bienfait déjà possédé.
 */
export function boonWeights(owned: readonly BoonKind[], tier: Tier): Weighted<BoonKind> {
  return boonPool(tier)
    .filter((kind) => !owned.includes(kind))
    .map((kind) => [kind, RARITY_WEIGHTS[BOONS[kind].rarity]]);
}

/** Le nombre de bienfaits d'une offre (P17). */
const OFFER_SIZE = 3;

/**
 * L'offre de bienfaits (P17) au palier `tier` (#212) : 3 tirages pondérés sans remise, sans
 * relance ; s'il en reste moins de 3 (#38), ceux qui restent, et aucun s'il n'en reste pas.
 */
export function drawBoonOffer(
  owned: readonly BoonKind[],
  random: RandomState,
  tier: Tier,
): Drawn<readonly BoonKind[]> {
  const offer: BoonKind[] = [];
  let state = random;
  const size = Math.min(OFFER_SIZE, boonWeights(owned, tier).length);
  for (let count = 0; count < size; count += 1) {
    const drawn = drawWeighted(boonWeights([...owned, ...offer], tier), state);
    offer.push(drawn.value);
    state = drawn.random;
  }
  return { value: offer, random: state };
}

/** La chance, en %, que Cœur de braise entre dans l'offre d'une Élite (#195). */
export const EMBER_HEART_CHANCE = 10;

/**
 * Le tirage de Cœur de braise (#195), un seul tirage : sous 10 %, il remplace le 3e bienfait de
 * l'offre, ou s'y ajoute si elle en a moins de 3 (une offre vide devient une offre de lui seul).
 */
export function offerEmberHeart(
  offer: readonly BoonKind[],
  random: RandomState,
): Drawn<{ readonly offer: readonly BoonKind[]; readonly offered: boolean }> {
  const drawn = nextRandom(random);
  if (drawn.value * 100 >= EMBER_HEART_CHANCE) {
    return { value: { offer, offered: false }, random: drawn.state };
  }
  return {
    value: { offer: [...offer.slice(0, OFFER_SIZE - 1), 'emberHeart'], offered: true },
    random: drawn.state,
  };
}

/** Les modificateurs du héros donnés par ses bienfaits. */
export function boonModifiers(boons: readonly BoonKind[]): HeroModifiers {
  return combineModifiers(...boons.map((kind) => BOONS[kind].modifiers));
}
