/**
 * Ce que partagent les retours de jeu d'un changement d'expérience, quel que soit leur dessin
 * (en-tête du personnage, envol, badge « Objectif atteint ») : le changement à montrer et le rythme
 * du feedback « Objectif atteint » (F1, #26).
 */

/** Un changement d'expérience à montrer, « +20 XP » ou « −20 XP » ; `id` change à chaque fois. */
export interface ShownXpChange {
  readonly id: number;
  /** La variation totale, prime d'objectif comprise. */
  readonly amount: number;
  /** La part de `amount` qui vient de la prime d'objectif (#26), dans sa propre pastille. */
  readonly bonus?: number;
}

/**
 * Le décalage de la seconde pastille « +15 XP prime », de la seconde pulsation et de l'éclat du
 * badge après le « +X XP » du suivi (maquette F1, « L'objectif (≈ 0,4 s) »).
 */
export const TARGET_BONUS_DELAY_MS = 400;

/** Durée de l'éclat doré de ce qui marque un objectif atteint (maquette F1, `burst`). */
export const TARGET_BURST_DURATION_MS = 600;
