/**
 * L'ascension (`Ascent`, #91, prototype) : gravir les 6 étages des Catacombes, du combat imposé
 * de l'étage 1 au boss de l'étage 6, en choisissant ses sorties. Un état immuable et sérialisable ;
 * tous les tirages viennent de la graine de l'ascension (P9), et un tirage révélé est gardé.
 */
import { HEROES, type EnemyKind, type HeroKind } from '../battle/combatants';
import { nextRandom, seedRandom, type BattleSeed, type RandomState } from '../battle/SeededRandom';
import { drawBoonOffer, type BoonKind } from './boons';
import type { Drawn } from './draw';
import { drawGroup, drawGroupSize } from './enemyGroup';
import { drawExitKinds, type Exit } from './exits';
import { BOSS_GOLD, ELITE_GOLD, campfireHeal, drawBoss, drawCombatGold } from './rewards';

/** La graine de l'ascension (`AscentSeed`). */
export type AscentSeed = number;

/** Le dernier étage : le boss (P1). */
export const TOP_FLOOR = 6;
/** Le dernier étage à sorties : après lui, la seule porte mène au boss. */
const LAST_EXIT_FLOOR = TOP_FLOOR - 1;

/** Le combat d'un étage : son type, ses ennemis (de gauche à droite) et sa graine du combat. */
export interface Encounter {
  readonly kind: 'combat' | 'elite' | 'boss';
  readonly enemies: readonly EnemyKind[];
  readonly battleSeed: BattleSeed;
}

export interface Ascent {
  readonly seed: AscentSeed;
  readonly random: RandomState;
  /** L'étage (`Floor`), de 1 à 6. */
  readonly floor: number;
  /** Le héros choisi au pied de la tour (#92), ses PV et ses bienfaits. */
  readonly hero: {
    readonly kind: HeroKind;
    readonly hp: number;
    readonly maxHp: number;
    readonly boons: readonly BoonKind[];
  };
  /** L'offre de bienfaits en attente (#92), `null` sans offre. */
  readonly boonOffer: readonly BoonKind[] | null;
  /** L'Or (`Gold`) gagné pendant l'ascension, perdu à la fin. */
  readonly gold: number;
  /** L'Or du dernier étage franchi (0 après un Feu de camp). */
  readonly lastGold: number;
  /** Les sorties proposées après l'étage ; vides pendant un combat et à la fin. */
  readonly exits: readonly Exit[];
  /** Le combat de l'étage, `null` entre deux étages. */
  readonly encounter: Encounter | null;
  /** Un groupe de 5 a déjà été affronté. */
  readonly fiveFaced: boolean;
  /** L'étage 2 a proposé un Feu de camp (sinon l'étage 3 en propose un). */
  readonly campfireOffered: boolean;
  /** `null` tant que l'ascension est en cours ; la chute vaut aussi pour l'abandon. */
  readonly outcome: 'victory' | 'fall' | null;
}

/** L'issue d'un combat d'étage. */
export interface FloorBattleResult {
  readonly outcome: 'victory' | 'defeat';
  readonly heroHp: number;
}

function drawBattleSeed(random: RandomState): Drawn<BattleSeed> {
  const drawn = nextRandom(random);
  return { value: Math.floor(drawn.value * 4_294_967_296), random: drawn.state };
}

function encounter(
  kind: Encounter['kind'],
  enemies: readonly EnemyKind[],
  random: RandomState,
): Drawn<Encounter> {
  const seed = drawBattleSeed(random);
  return { value: { kind, enemies, battleSeed: seed.value }, random: seed.random };
}

function combat(size: number, random: RandomState): Drawn<Encounter> {
  const group = drawGroup(size, random);
  return encounter('combat', group.value, group.random);
}

/**
 * L'ascension commence : le héros choisi (la Sentinelle par défaut) à PV max, sans bienfait,
 * l'étage 1, un combat dont la taille est tirée.
 */
export function startAscent(seed: AscentSeed, heroKind: HeroKind = 'sentinel'): Ascent {
  const { maxHp } = HEROES[heroKind];
  const size = drawGroupSize(1, seedRandom(seed), false);
  const first = combat(size.value, size.random);
  return {
    seed,
    random: first.random,
    floor: 1,
    hero: { kind: heroKind, hp: maxHp, maxHp, boons: [] },
    boonOffer: null,
    gold: 0,
    lastGold: 0,
    exits: [],
    encounter: first.value,
    fiveFaced: false,
    campfireOffered: false,
    outcome: null,
  };
}

/** Les sorties vers l'étage `floor` ; la taille du groupe est tirée avec la porte Combat. */
function withExits(ascent: Ascent, floor: number): Ascent {
  if (floor > LAST_EXIT_FLOOR) {
    return { ...ascent, encounter: null, exits: [{ kind: 'boss', groupSize: null }] };
  }
  const guaranteed = floor === 3 && !ascent.campfireOffered;
  const kinds = drawExitKinds(floor, ascent.random, guaranteed);
  let random = kinds.random;
  const exits = kinds.value.map((kind): Exit => {
    if (kind !== 'combat') return { kind, groupSize: null };
    const size = drawGroupSize(floor, random, ascent.fiveFaced);
    random = size.random;
    return { kind, groupSize: size.value };
  });
  return {
    ...ascent,
    random,
    encounter: null,
    exits,
    campfireOffered: ascent.campfireOffered || (floor === 2 && kinds.value.includes('campfire')),
  };
}

/** Le joueur franchit la porte `index` : le combat de l'étage suivant, ou le Feu de camp. */
export function chooseExit(ascent: Ascent, index: number): Ascent {
  const exit = ascent.exits[index];
  if (exit === undefined || ascent.outcome !== null || ascent.boonOffer !== null) return ascent;
  const floor = ascent.floor + 1;
  const entered = { ...ascent, floor, exits: [] };
  switch (exit.kind) {
    case 'campfire':
      return withExits(
        { ...entered, hero: { ...ascent.hero, hp: campfireHeal(ascent.hero) }, lastGold: 0 },
        floor + 1,
      );
    case 'combat': {
      const size = exit.groupSize!;
      const drawn = combat(size, ascent.random);
      return {
        ...entered,
        random: drawn.random,
        encounter: drawn.value,
        fiveFaced: ascent.fiveFaced || size === 5,
      };
    }
    case 'elite': {
      const drawn = encounter('elite', ['fallenKnight'], ascent.random);
      return { ...entered, random: drawn.random, encounter: drawn.value };
    }
    case 'boss': {
      const boss = drawBoss(ascent.random);
      const drawn = encounter('boss', [boss.value], boss.random);
      return { ...entered, random: drawn.random, encounter: drawn.value };
    }
  }
}

/**
 * La fin du combat de l'étage (P7, P8, P16) : la chute à 0 PV ; sinon l'Or du combat, puis la
 * victoire de l'ascension au boss, ou l'offre de bienfaits et les sorties vers l'étage suivant.
 */
export function endFloorBattle(ascent: Ascent, result: FloorBattleResult): Ascent {
  const { encounter: current } = ascent;
  if (current === null || ascent.outcome !== null) return ascent;
  const hero = { ...ascent.hero, hp: result.heroHp };
  if (result.outcome === 'defeat') {
    return { ...ascent, hero, encounter: null, outcome: 'fall' };
  }
  let random = ascent.random;
  let gold = current.kind === 'elite' ? ELITE_GOLD : BOSS_GOLD;
  if (current.kind === 'combat') {
    const drawn = drawCombatGold(current.enemies.length, random);
    gold = drawn.value;
    random = drawn.random;
  }
  const earned = { ...ascent, hero, random, gold: ascent.gold + gold, lastGold: gold };
  if (current.kind === 'boss') return { ...earned, encounter: null, outcome: 'victory' };
  const offer = drawBoonOffer(hero.boons, random);
  return withExits({ ...earned, random: offer.random, boonOffer: offer.value }, ascent.floor + 1);
}

/** Le joueur prend le bienfait `index` de l'offre (P16) ; il le garde jusqu'à la fin. */
export function chooseBoon(ascent: Ascent, index: number): Ascent {
  const boon = ascent.boonOffer?.[index];
  if (boon === undefined) return ascent;
  return {
    ...ascent,
    hero: { ...ascent.hero, boons: [...ascent.hero.boons, boon] },
    boonOffer: null,
  };
}

/** L'abandon (`Abandon`) : il a le même effet qu'une chute (P33). */
export function abandonAscent(ascent: Ascent): Ascent {
  return { ...ascent, encounter: null, exits: [], outcome: 'fall' };
}
