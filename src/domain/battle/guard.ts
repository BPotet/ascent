/**
 * Garde et étourdissement (#32, règles C5) : la garde d'un ennemi, sa cassure, l'état étourdi et
 * le retour en garde. Les moments où l'étourdi perd son action ou se relève sont menés par le
 * moteur (`Battle.ts`).
 */

/** Les dégâts subis par un ennemi étourdi, en % (C5.2). */
export const STUNNED_DAMAGE_PERCENT = 150;
/** L'action perdue (`LostAction`) d'un ennemi étourdi (C5.4). */
export const LOST_ACTION_MS = 250;
/** Le retour en garde (`GuardRestore`) d'un ennemi étourdi (C5.5). */
export const GUARD_RESTORE_MS = 400;

/**
 * Un ennemi étourdi (`Stunned`) : son action perdue est-elle passée (a), et l'action du héros
 * pendant laquelle sa garde est tombée (elle ne compte pas pour (b), C5.3).
 */
export interface Stunned {
  readonly actionLost: boolean;
  readonly heroAction: number;
}

/** Ce que la garde connaît d'un ennemi. */
export interface GuardedEnemy {
  readonly hp: number;
  readonly guard: number;
  readonly maxGuard: number;
  readonly stun: Stunned | null;
}

/** Le multiplicateur d'étourdi, en % : 150 sur un étourdi, 100 sinon. */
export function stunnedPercent(stun: Stunned | null): number {
  return stun === null ? 100 : STUNNED_DAMAGE_PERCENT;
}

/**
 * Un coup reçu par un ennemi, pendant l'action `heroAction` du héros : il perd ses PV ; à 0 PV il
 * tombe et son étourdissement s'arrête (C5.9). Sinon il perd ses points de garde, sauf s'il est
 * étourdi (C5.8) ; quand sa garde tombe à 0, c'est la cassure de garde (C5.1).
 */
export function blowOnEnemy<Enemy extends GuardedEnemy>(
  enemy: Enemy,
  blow: { readonly hp: number; readonly guard: number },
  heroAction: number,
): { readonly enemy: Enemy; readonly broken: boolean; readonly fallen: boolean } {
  const hp = Math.max(0, enemy.hp - blow.hp);
  const guard = enemy.stun === null ? Math.max(0, enemy.guard - blow.guard) : enemy.guard;
  if (hp === 0) return { enemy: { ...enemy, hp, guard, stun: null }, broken: false, fallen: true };
  const broken = enemy.stun === null && guard === 0;
  const stun = broken ? { actionLost: false, heroAction } : enemy.stun;
  return { enemy: { ...enemy, hp, guard, stun }, broken, fallen: false };
}

/** (b) de C5.3 : une action du héros a eu lieu depuis celle de la cassure. */
export function isRestoreDue(stun: Stunned, heroActions: number): boolean {
  return heroActions > stun.heroAction;
}

/**
 * Le retour en garde (C5.5) : la garde revient à son maximum (ou à `percent` % de son maximum,
 * arrondi à l'entier inférieur, au moins 1 : Givre persistant, #92), l'étourdissement s'arrête.
 */
export function restoreGuard<Enemy extends GuardedEnemy>(enemy: Enemy, percent = 100): Enemy {
  return {
    ...enemy,
    guard: Math.max(1, Math.floor((enemy.maxGuard * percent) / 100)),
    stun: null,
  };
}
