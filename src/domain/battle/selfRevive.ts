/**
 * Se relève seul (`SelfRevive`, #106, règles S1, S6, S10) : un ennemi tombé qui a ce trait se
 * relève de lui-même, tant qu'il lui reste des relèves. Le moteur (`Battle.ts`) décide du reste.
 */
import type { EnemyProfile } from './combatants';
import type { GuardedEnemy } from './guard';

/** Les PV d'un ennemi qui se relève : PV max × `hpPercent` / 100, à l'entier inférieur, au moins 1. */
export function selfRevivedHp(maxHp: number, hpPercent: number): number {
  return Math.max(1, Math.floor((maxHp * hpPercent) / 100));
}

/** Ce que la règle connaît d'un ennemi tombé. */
interface RevivableEnemy extends GuardedEnemy {
  readonly maxHp: number;
  readonly intent: unknown;
  readonly raised: boolean;
  /** Le nombre de relèves faites dans ce combat ; absent, 0. */
  readonly selfRevives?: number;
}

/**
 * L'ennemi relevé, ou `null` s'il ne lui reste aucune relève : ses PV, sa garde entière, ni
 * étourdi ni intention, compté comme relevé pour le Nécromancien (S5), une relève de plus.
 */
export function selfRevive<Enemy extends RevivableEnemy>(
  enemy: Enemy,
  profile: EnemyProfile,
): Enemy | null {
  const revives = enemy.selfRevives ?? 0;
  if (profile.selfRevive === undefined || revives >= profile.selfRevive.times) return null;
  return {
    ...enemy,
    hp: selfRevivedHp(enemy.maxHp, profile.selfRevive.hpPercent),
    guard: enemy.maxGuard,
    stun: null,
    intent: null,
    raised: true,
    selfRevives: revives + 1,
  };
}
