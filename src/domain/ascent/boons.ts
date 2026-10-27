/**
 * Les bienfaits (`Boon`, prototype #92, règles P16 à P18 de #88) : 1 parmi 3 après chaque combat
 * gagné, sauf le boss ; ils durent jusqu'à la fin de l'ascension et entrent dans le combat par les
 * modificateurs du héros. Aucun ne touche l'Initiative.
 */
import type { RandomState } from '../battle/SeededRandom';
import { NO_MODIFIERS, combineModifiers, type HeroModifiers } from '../battle/heroModifiers';
import { drawWeighted, type Drawn, type Weighted } from './draw';
import type { Rarity } from './rarity';

export type BoonKind =
  | 'perfectEcho'
  | 'shatteringEmber'
  | 'frostSkin'
  | 'trueEdge'
  | 'blazingEmber'
  | 'lingeringFrost'
  | 'emberHeart';

/** La famille de bienfaits (`BoonFamily`) : Givre, Braise, Écho. */
export type BoonFamily = 'frost' | 'ember' | 'echo';

export interface Boon {
  readonly family: BoonFamily;
  readonly rarity: Rarity;
  readonly modifiers: HeroModifiers;
}

export const BOONS: Readonly<Record<BoonKind, Boon>> = {
  perfectEcho: {
    family: 'echo',
    rarity: 'common',
    modifiers: { ...NO_MODIFIERS, counterPercents: [150] },
  },
  shatteringEmber: {
    family: 'ember',
    rarity: 'common',
    modifiers: { ...NO_MODIFIERS, guardDamagePercents: [130] },
  },
  frostSkin: {
    family: 'frost',
    rarity: 'common',
    modifiers: { ...NO_MODIFIERS, damageReductionPoints: 10 },
  },
  trueEdge: {
    family: 'echo',
    rarity: 'rare',
    modifiers: { ...NO_MODIFIERS, perfectStrikeBonusPercents: [50] },
  },
  blazingEmber: {
    family: 'ember',
    rarity: 'rare',
    modifiers: { ...NO_MODIFIERS, stunnedBonusPercent: 50 },
  },
  lingeringFrost: {
    family: 'frost',
    rarity: 'rare',
    modifiers: { ...NO_MODIFIERS, guardRestorePercent: 50 },
  },
  emberHeart: {
    family: 'ember',
    rarity: 'epic',
    modifiers: { ...NO_MODIFIERS, onGuardBreak: { momentum: 1, heal: 5 } },
  },
};

export const BOON_KINDS = Object.keys(BOONS) as readonly BoonKind[];

/** Le poids d'un bienfait dans une offre, selon sa rareté (P17). */
export const RARITY_WEIGHTS: Readonly<Record<Rarity, number>> = { common: 6, rare: 3, epic: 1 };

/** Les bienfaits qui peuvent être offerts, avec leur poids : jamais un bienfait déjà possédé. */
export function boonWeights(owned: readonly BoonKind[]): Weighted<BoonKind> {
  return BOON_KINDS.filter((kind) => !owned.includes(kind)).map((kind) => [
    kind,
    RARITY_WEIGHTS[BOONS[kind].rarity],
  ]);
}

/** L'offre de bienfaits (P17) : 3 tirages pondérés sans remise, sans relance. */
export function drawBoonOffer(
  owned: readonly BoonKind[],
  random: RandomState,
): Drawn<readonly BoonKind[]> {
  const offer: BoonKind[] = [];
  let state = random;
  for (let count = 0; count < 3; count += 1) {
    const drawn = drawWeighted(boonWeights([...owned, ...offer]), state);
    offer.push(drawn.value);
    state = drawn.random;
  }
  return { value: offer, random: state };
}

/** Les modificateurs du héros donnés par ses bienfaits. */
export function boonModifiers(boons: readonly BoonKind[]): HeroModifiers {
  return boons.reduce(
    (modifiers, kind) => combineModifiers(modifiers, BOONS[kind].modifiers),
    NO_MODIFIERS,
  );
}
