/**
 * Règles chiffrées du combat (#31, règles de jeu C7, C8, C9 et C12). Toutes les durées sont en ms.
 * Les fenêtres et les durées de la transition de phase et de l'avancée sont validées par le
 * propriétaire : elles ne se changent pas sans lui.
 */

/** Fenêtre parfaite (`PerfectWindow`) : |écart| ≤ 60 ms (C7). */
export const PERFECT_WINDOW_MS = 60;
/** Fenêtre de parade (`ParryWindow`) : |écart| ≤ 160 ms (C7). */
export const PARRY_WINDOW_MS = 160;
/** Déséquilibre (`OffBalance`) après un appui raté, relancé par chaque appui (C9). */
export const OFF_BALANCE_MS = 450;
/** Arrêt sur image (`HitStop`) d'une parade parfaite : le temps du combat s'arrête. */
export const HIT_STOP_MS = 90;
/** Durée de l'action du héros (`HeroActionDuration`) d'un pouvoir, animation comprise. */
export const HERO_ACTION_MS = 500;
/** L'effet d'une intention Garde ou Relever, après l'avancée (durée interne). */
export const SUPPORT_ACTION_MS = 400;
/** Durée de la contre-attaque, animation comprise. */
export const COUNTER_MS = 400;

/** Le jugement d'un appui (C7). */
export type PressJudgement = 'perfect' | 'good' | 'miss';

/** L'écart (`PressDelta`) : instant de l'appui + décalage − instant de l'impact. */
export function pressDelta(pressedAt: number, inputOffset: number, impactAt: number): number {
  return pressedAt + inputOffset - impactAt;
}

/** Parfait si |écart| ≤ 60 ms, bon si ≤ 160 ms, raté sinon (C7). */
export function judgePress(delta: number): PressJudgement {
  const distance = Math.abs(delta);
  if (distance <= PERFECT_WINDOW_MS) return 'perfect';
  if (distance <= PARRY_WINDOW_MS) return 'good';
  return 'miss';
}

/** L'instant où un impact sans appui valide est subi : impact + 160 ms + max(0, −décalage) (C7, C12). */
export function missDeadline(impactAt: number, inputOffset: number): number {
  return impactAt + PARRY_WINDOW_MS + Math.max(0, -inputOffset);
}

/**
 * Des dégâts multipliés par des pourcentages entiers (C8) : arrondis à l'entier inférieur, avec
 * un minimum de 1, sauf si un facteur est nul. Le calcul reste en entiers : 5 × 25 % × 90 % = 1.
 */
export function scaleDamage(base: number, ...percents: readonly number[]): number {
  if (base <= 0 || percents.some((percent) => percent <= 0)) return 0;
  const scaled = percents.reduce((product, percent) => product * percent, base);
  return Math.max(1, Math.floor(scaled / 100 ** percents.length));
}
