/** Les bénédictions de départ (`StartingBlessing`, prototype #93, P25) et la fatigue (P26). */
import type { Day } from '../day/Day';
import type { Difficulty } from '../habit/Difficulty';
import type { HeroModifiers } from '../battle/heroModifiers';
import type { RandomState } from '../battle/SeededRandom';
import { drawInt, type Drawn } from './draw';
import type { Rarity } from './rarity';

/** Les familles de bénédiction (`BlessingFamily`) : Vigueur, Élan, Tranchant, Protection, Hâte. */
export type BlessingFamily = 'vigor' | 'momentum' | 'edge' | 'protection' | 'haste';
export const BLESSING_FAMILIES: readonly BlessingFamily[] = [
  'vigor',
  'momentum',
  'edge',
  'protection',
  'haste',
];

export interface StartingBlessing {
  readonly family: BlessingFamily;
  readonly rarity: Rarity;
}

/**
 * L'effet de chaque famille, selon la rareté : Vigueur (PV max, %), Élan (Élan de départ ; la
 * Commune au 1er combat seulement), Tranchant (Attaque, %), Protection (points de réduction), Hâte
 * (Initiative).
 */
export const BLESSING_EFFECTS: Readonly<Record<BlessingFamily, Readonly<Record<Rarity, number>>>> =
  {
    vigor: { common: 6, rare: 10, epic: 15 },
    momentum: { common: 1, rare: 1, epic: 2 },
    edge: { common: 10, rare: 20, epic: 30 },
    protection: { common: 5, rare: 10, epic: 15 },
    haste: { common: 1, rare: 2, epic: 3 },
  };

/** Une habitude faite hier : son nom, sa difficulté d'hier et son jour de création. */
export interface DoneHabit {
  readonly name: string;
  readonly difficulty: Difficulty;
  readonly createdOn: Day;
}

const RARITY_OF: Readonly<Record<Difficulty, Rarity>> = {
  easy: 'common',
  medium: 'rare',
  hard: 'epic',
};
const DIFFICULTY_RANK: Readonly<Record<Difficulty, number>> = { easy: 0, medium: 1, hard: 2 };

/** Au plus 3 bénédictions de départ. */
export const MAX_BLESSINGS = 3;

/**
 * Les raretés des bénédictions : une par habitude faite hier, 3 au plus, les plus difficiles
 * d'abord ; à égalité, la plus ancienne, puis l'ordre alphabétique.
 */
export function blessingRarities(done: readonly DoneHabit[]): Rarity[] {
  return [...done]
    .sort(
      (a, b) =>
        DIFFICULTY_RANK[b.difficulty] - DIFFICULTY_RANK[a.difficulty] ||
        a.createdOn.compareTo(b.createdOn) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, MAX_BLESSINGS)
    .map((habit) => RARITY_OF[habit.difficulty]);
}

/** Une offre : 3 familles distinctes, tirées parmi celles qui ne sont pas encore prises. */
export function drawBlessingOffer(
  taken: readonly BlessingFamily[],
  random: RandomState,
): Drawn<BlessingFamily[]> {
  const left = BLESSING_FAMILIES.filter((family) => !taken.includes(family));
  const offer: BlessingFamily[] = [];
  let state = random;
  while (offer.length < 3 && left.length > 0) {
    const drawn = drawInt(0, left.length - 1, state);
    offer.push(...left.splice(drawn.value, 1));
    state = drawn.random;
  }
  return { value: offer, random: state };
}

/** Les PV max : base × (1 + Vigueur) × (1 − fatigue), arrondis une fois à l'entier inférieur. */
export function heroMaxHp(base: number, vigor: number, fatigue: number): number {
  return Math.floor((base * (100 + vigor) * (100 - fatigue)) / 10_000);
}

function effectOf(blessings: readonly StartingBlessing[], family: BlessingFamily): number {
  const blessing = blessings.find((each) => each.family === family);
  return blessing === undefined ? 0 : BLESSING_EFFECTS[family][blessing.rarity];
}

/** La Vigueur des bénédictions, en % des PV max. */
export function vigorPercent(blessings: readonly StartingBlessing[]): number {
  return effectOf(blessings, 'vigor');
}

/**
 * Ce que les bénédictions changent au héros dans un combat. Tranchant donne un bonus d'Attaque en %,
 * additionné à celui des objets avant l'arrondi (`heroAttack`, #152).
 */
export function blessingModifiers(
  blessings: readonly StartingBlessing[],
  { firstBattle }: { readonly firstBattle: boolean },
): Partial<HeroModifiers> {
  const momentum = blessings.find((each) => each.family === 'momentum');
  const everyBattle = momentum !== undefined && (momentum.rarity !== 'common' || firstBattle);
  return {
    attackBonusPercent: effectOf(blessings, 'edge'),
    damageReductionPoints: effectOf(blessings, 'protection'),
    initiative: effectOf(blessings, 'haste'),
    startingMomentum: everyBattle ? effectOf(blessings, 'momentum') : 0,
  };
}
