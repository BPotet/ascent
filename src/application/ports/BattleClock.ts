/**
 * Horloge de combat (`BattleClock`) — port qui donne l'instant présent, en ms, sur la base monotone
 * des instants de toucher (méthode de datation (a) de l'ADR 0005 : `performance.now()`, commune au
 * fil UI et au fil JS), et qui programme les échéances du combat. À distinguer de l'Horloge
 * (`Clock`), qui donne aujourd'hui.
 */
export interface BattleClock {
  /** L'instant présent, en ms. */
  now(): number;
  /**
   * Appelle `callback` une fois, à l'instant `at` ou juste après (aussitôt si `at` est passé).
   * Renvoie la fonction qui annule l'appel.
   */
  setTimer(at: number, callback: () => void): () => void;
}
