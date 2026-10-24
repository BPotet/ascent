/**
 * Ciel du jour (`DaySky`), voir `docs/glossary.md` (#72) : le décor de l'en-tête du personnage, qui
 * s'éclaire avec les habitudes faites aujourd'hui. `light` va de 0 (nuit) à 1 (lever du soleil).
 */
export interface DaySky {
  readonly light: number;
}

/** Le ciel de nuit : aucune habitude active aujourd'hui. */
export const NIGHT: DaySky = { light: 0 };

/** Le lever du soleil : toutes les habitudes attendues sont faites, ou aucune n'est attendue. */
export const DAWN: DaySky = { light: 1 };

/**
 * Le ciel du jour d'aujourd'hui, à partir de ses compteurs : `doneCount` habitudes « fait » sur
 * `expectedCount` habitudes attendues, parmi `activeCount` habitudes actives.
 * - Aucune habitude active : nuit.
 * - Des habitudes actives mais aucune attendue (objectifs de la semaine atteints) : lever du soleil.
 * - Sinon, le rapport habitudes faites / habitudes attendues : chaque habitude faite éclaire le
 *   ciel d'un cran, et il vaut 1 quand toutes sont faites. Une habitude « fait » est toujours
 *   attendue : le rapport ne dépasse pas 1, et la règle le borne quand même.
 */
export function daySkyOf(doneCount: number, expectedCount: number, activeCount: number): DaySky {
  if (activeCount === 0) {
    return NIGHT;
  }
  if (expectedCount === 0) {
    return DAWN;
  }
  return { light: Math.min(1, doneCount / expectedCount) };
}
