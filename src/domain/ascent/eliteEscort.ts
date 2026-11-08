/**
 * L'escorte de l'Élite (`EliteEscort`, #257, EE2) : aux paliers 2 et 3, les ennemis ordinaires du
 * palier qui accompagnent l'Élite, tirés avec la graine de l'ascension.
 */
import { ENEMIES, type EnemyKind } from '../battle/combatants';
import type { RandomState } from '../battle/SeededRandom';
import type { Drawn } from './draw';
import { drawFromPool } from './enemyGroup';
import { TIERS, type EnemyDraw, type Tier } from './tiers';

/** L'escorte d'une Élite, de gauche à droite, dans l'ordre du tirage. */
export type EliteEscort = readonly EnemyKind[];

const escortPool = (tier: Tier) =>
  TIERS[tier].enemies.filter(({ kind }) => !ENEMIES[kind].supports);

/**
 * Les ennemis que peut tirer l'escorte d'un palier : ceux du palier, dans leur ordre, avec leurs
 * poids et leurs plafonds, sans les soutiens (Nécromancien, Glaneuse de cendre, Sonneuse de matines).
 */
export const ESCORT_POOLS: Readonly<Record<Tier, readonly EnemyDraw[]>> = {
  1: escortPool(1),
  2: escortPool(2),
  3: escortPool(3),
};

/**
 * L'escorte de `size` ennemis d'une Élite du palier `tier`, tirée de gauche à droite parmi
 * `ESCORT_POOLS[tier]`, les plafonds comptés dans l'escorte seule : un tirage par ennemi, aucun
 * pour une escorte vide.
 */
export function drawEliteEscort(size: number, random: RandomState, tier: Tier): Drawn<EliteEscort> {
  return drawFromPool(ESCORT_POOLS[tier], size, random);
}
