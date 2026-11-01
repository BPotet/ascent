/**
 * Les Éclats (`Shard`, #38, § 4 de la note du Game Designer) : 2 par Élite, 8, 12 et 18 pour le
 * boss de chaque palier, et 10 pour le Sommet, en même temps que le boss du palier 3. Ils ne
 * dépendent que de la victoire, jamais de la jauge, du héros ni des bénédictions.
 *
 * Le Total d'Éclats (`ShardTotal`, ADR 0012) : tous les Éclats gagnés par le joueur, gardés entre
 * les ascensions. Chaque gain a un identifiant déterministe ; un gain déjà crédité pour la graine
 * de l'ascension ne l'est jamais une deuxième fois.
 */
import type { Encounter } from './Ascent';
import { TIERS, TOP_TIER, type Tier } from './tiers';

/** Les Éclats d'une Élite, à tout palier. */
export const ELITE_SHARDS = 2;
/** Les Éclats du Sommet, en plus de ceux du boss du palier 3. */
export const SUMMIT_SHARDS = 10;

/** Un gain d'Éclats (`ShardAward`) : son identifiant et son montant. */
export interface ShardAward {
  /** `<graine>:<palier>:<étage>:elite|boss`, ou `<graine>:summit`. */
  readonly id: string;
  readonly amount: number;
}

/** Les gains d'Éclats d'un combat gagné : rien pour un combat ordinaire. */
export function shardAwards(
  seed: number,
  tier: Tier,
  floor: number,
  kind: Encounter['kind'],
): ShardAward[] {
  if (kind === 'combat') return [];
  const prefix = `${seed}:${tier}:${floor}`;
  if (kind === 'elite') return [{ id: `${prefix}:elite`, amount: ELITE_SHARDS }];
  const boss = { id: `${prefix}:boss`, amount: TIERS[tier].bossShards };
  return tier === TOP_TIER ? [boss, { id: `${seed}:summit`, amount: SUMMIT_SHARDS }] : [boss];
}

/** La somme des Éclats de `awards`. */
export function shardSum(awards: readonly ShardAward[]): number {
  return awards.reduce((sum, award) => sum + award.amount, 0);
}

/** Le Total d'Éclats (`ShardTotal`) et les gains déjà crédités pour la graine `seed`. */
export interface ShardTotal {
  readonly total: number;
  /** La graine de l'ascension des derniers crédits, `null` avant le premier. */
  readonly seed: number | null;
  readonly awarded: readonly string[];
}

export const EMPTY_SHARD_TOTAL: ShardTotal = { total: 0, seed: null, awarded: [] };

/**
 * Crédite les gains `awards` de l'ascension de graine `seed` : un gain déjà crédité ne l'est pas
 * une deuxième fois ; une autre graine oublie les gains de la précédente, jamais le total. Sans
 * rien à créditer, le Total d'Éclats est rendu tel quel.
 */
export function creditShards(
  current: ShardTotal,
  seed: number,
  awards: readonly ShardAward[],
): ShardTotal {
  const awarded = current.seed === seed ? current.awarded : [];
  const fresh = awards.filter((award) => !awarded.includes(award.id));
  if (fresh.length === 0) return current;
  return {
    total: current.total + shardSum(fresh),
    seed,
    awarded: [...awarded, ...fresh.map((award) => award.id)],
  };
}

const SHARD_TOTAL_VERSION = 1;

/** Le Total d'Éclats tel qu'il est stocké, en JSON. */
export function serializeShardTotal(total: ShardTotal): string {
  return JSON.stringify({ version: SHARD_TOTAL_VERSION, ...total });
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * Le Total d'Éclats stocké : rien de stocké vaut 0 ; une valeur illisible le dit, et repart de 0.
 */
export function parseShardTotal(raw: string | null): {
  readonly total: ShardTotal;
  readonly unreadable: boolean;
} {
  if (raw === null) return { total: EMPTY_SHARD_TOTAL, unreadable: false };
  try {
    const stored = JSON.parse(raw) as Partial<Record<keyof ShardTotal | 'version', unknown>> | null;
    const { version, total, seed, awarded } = stored ?? {};
    const readable =
      version === SHARD_TOTAL_VERSION &&
      isCount(total) &&
      (seed === null || typeof seed === 'number') &&
      Array.isArray(awarded) &&
      awarded.every((id) => typeof id === 'string');
    if (readable) return { total: { total, seed, awarded }, unreadable: false };
  } catch {
    // Illisible : le total repart de 0, la valeur est gardée à part par la session.
  }
  return { total: EMPTY_SHARD_TOTAL, unreadable: true };
}
