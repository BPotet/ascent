/**
 * L'arbre de pouvoirs (`PowerTree`, #235), un par héros, au Camp : en Y, la racine est le pouvoir
 * de base (`BasePower`), puis deux voies (`PowerPath`) de deux rangs (`PowerRank`) ; le rang 2
 * exige le rang 1 de sa voie. Les pouvoirs se débloquent avec les Éclats, comme les Déblocages :
 * une fois, tout ou rien, prix figé (30 Éclats au rang 1, 60 au rang 2), jamais perdus. La jauge
 * ne touche jamais les prix. Les frappes de pouvoir s'y débloquent comme les autres (#236).
 */
import type { HeroKind } from '../battle/combatants';
import { basePower, powerOrder, type PowerKind } from '../battle/powers';
import type { Ascent } from './Ascent';
import { availableShards, campPowers, type Camp, type CampPurchase } from './camp';

/** Les voies : Bouclier et Veille (Sentinelle), Lames et Ombre (Errante). */
export type PowerPath = 'shield' | 'watch' | 'blades' | 'shadow';
/** Le rang d'un nœud : 0 pour le pouvoir de base, puis 1 et 2. */
export type PowerRank = 0 | 1 | 2;

export interface PowerPathNodes {
  readonly path: PowerPath;
  readonly ranks: readonly [PowerKind, PowerKind];
}

export interface PowerTree {
  readonly hero: HeroKind;
  readonly base: PowerKind;
  /** Les deux voies, dans l'ordre de l'arbre (et des touches). */
  readonly paths: readonly [PowerPathNodes, PowerPathNodes];
}

/** Les arbres, selon les fiches du Codex (`hero`, `path`, `rank`, `order`). */
export const POWER_TREES: Readonly<Record<HeroKind, PowerTree>> = {
  sentinel: {
    hero: 'sentinel',
    base: 'bulwark',
    paths: [
      { path: 'shield', ranks: ['shieldBash', 'crushingBlow'] },
      { path: 'watch', ranks: ['retaliation', 'holdFast'] },
    ],
  },
  wanderer: {
    hero: 'wanderer',
    base: 'shadowStep',
    paths: [
      { path: 'blades', ranks: ['rend', 'flurry'] },
      { path: 'shadow', ranks: ['mist', 'ambush'] },
    ],
  },
};

/** Les prix des pouvoirs : ni la jauge, ni le héros, ni une bénédiction n'y entrent. */
export const POWER_PRICES: Readonly<Record<1 | 2, number>> = { 1: 30, 2: 60 };

interface NodePlace {
  readonly hero: HeroKind;
  readonly path: PowerPath | null;
  readonly rank: PowerRank;
}

function placeOf(code: PowerKind): NodePlace {
  for (const tree of Object.values(POWER_TREES)) {
    if (tree.base === code) return { hero: tree.hero, path: null, rank: 0 };
    for (const { path, ranks } of tree.paths) {
      const index = ranks.indexOf(code);
      if (index >= 0) return { hero: tree.hero, path, rank: (index + 1) as 1 | 2 };
    }
  }
  throw new Error(`Unknown power: ${code}`);
}

export function powerPath(code: PowerKind): PowerPath | null {
  return placeOf(code).path;
}

export function powerRank(code: PowerKind): PowerRank {
  return placeOf(code).rank;
}

/** Le prix d'un nœud : 30 ou 60 Éclats ; 0 pour le pouvoir de base, jamais vendu. */
export function powerPrice(code: PowerKind): number {
  const { rank } = placeOf(code);
  return rank === 0 ? 0 : POWER_PRICES[rank];
}

/** Le rang 1 de la voie d'un rang 2, `null` pour un autre rang. */
function rankOneOf(code: PowerKind): PowerKind | null {
  const { hero, path, rank } = placeOf(code);
  if (rank !== 2) return null;
  return POWER_TREES[hero].paths.find((nodes) => nodes.path === path)!.ranks[0];
}

/**
 * L'état d'un nœud de l'arbre : pouvoir de base, débloqué, dès la prochaine ascension (débloqué pendant une ascension en cours qui ne l'a pas), verrouillé après
 * le rang 1 de sa voie, achetable, ou les Éclats qui manquent.
 */
export type PowerNodeState =
  | { readonly kind: 'base' }
  | { readonly kind: 'unlocked' }
  | { readonly kind: 'nextAscent' }
  | { readonly kind: 'locked'; readonly after: PowerKind }
  | { readonly kind: 'affordable' }
  | { readonly kind: 'missing'; readonly missing: number };

export function powerNodeState(
  camp: Camp,
  shardTotal: number,
  ascent: Ascent | null,
  code: PowerKind,
): PowerNodeState {
  if (powerRank(code) === 0) return { kind: 'base' };
  const owned = campPowers(camp);
  if (owned.includes(code)) {
    const running = ascent !== null && ascent.outcome === null;
    return running && !ascent.powers.includes(code) ? { kind: 'nextAscent' } : { kind: 'unlocked' };
  }
  const after = rankOneOf(code);
  if (after !== null && !owned.includes(after)) return { kind: 'locked', after };
  const missing = powerPrice(code) - availableShards(shardTotal, camp);
  return missing > 0 ? { kind: 'missing', missing } : { kind: 'affordable' };
}

/** Débloque `code` au Camp, au prix d'aujourd'hui, figé avec le pouvoir : tout ou rien. */
export function unlockPowerAtCamp(camp: Camp, shardTotal: number, code: PowerKind): CampPurchase {
  const state = powerNodeState(camp, shardTotal, null, code);
  switch (state.kind) {
    case 'base':
      return { kind: 'notForSale' };
    case 'unlocked':
    case 'nextAscent':
      return { kind: 'alreadyUnlocked' };
    case 'locked':
      return state;
    case 'missing':
      return { kind: 'notEnoughShards', missing: state.missing };
    case 'affordable': {
      const price = powerPrice(code);
      return {
        kind: 'unlocked',
        camp: { ...camp, powers: [...camp.powers, { power: code, price }] },
      };
    }
  }
}

/** Les emplacements de pouvoirs équipés : 3 dès le départ. */
export const EQUIPPED_POWER_SLOTS = 3;

/**
 * Les pouvoirs équipés (`EquippedPower`) d'office d'une nouvelle ascension avec `hero` : le pouvoir
 * de base puis ses pouvoirs débloqués, dans l'ordre de l'arbre, 3 au plus. Sans mémoire valide, c'est
 * la présélection du Choix du héros (#236, `preselectedPowers`).
 */
export function equippedPowers(camp: Camp, hero: HeroKind): readonly PowerKind[] {
  return powerOrder(hero, [basePower(hero), ...campPowers(camp)]).slice(0, EQUIPPED_POWER_SLOTS);
}
