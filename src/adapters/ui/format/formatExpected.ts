/**
 * Le compteur « habitudes faites / habitudes attendues » pour le lecteur d'écran (#25) : « 1 habitude
 * faite sur 2 attendues », « 2 habitudes faites sur 2 attendues ». Vue Journée, Rappel d'hier et
 * Jour du mois le lisent de la même façon.
 */
export function doneOutOfExpected(doneCount: number, expectedCount: number): string {
  const done = doneCount > 1 ? 'habitudes faites' : 'habitude faite';
  const expected = expectedCount > 1 ? 'attendues' : 'attendue';
  return `${doneCount} ${done} sur ${expectedCount} ${expected}`;
}

/**
 * Ce qui remplace le compteur quand aucune habitude n'est attendue (maquettes E1 et E6, #25) : le
 * message de la Vue Journée, la ligne du Détail du jour et le libellé lu du Jour du mois.
 */
export const GOALS_REACHED = 'Objectifs de la semaine atteints';
