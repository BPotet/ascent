/**
 * La jauge (`FateGauge`, prototype #93) : la faveur (+1, +2) ou la malédiction (−1, −2) du jour,
 * d'après les habitudes d'hier ; 0 est Neutre (P22, P23). Elle donne la fatigue (P26) et la
 * faveur sur le butin (P27).
 */
export type FateGauge = -2 | -1 | 0 | 1 | 2;

/**
 * La jauge pour `done` habitudes faites hier sur `expected` attendues (une habitude faite est
 * toujours attendue) : +2 si tout est fait, +1 à 75 %, 0 à 50 %, −1 à 25 %, −2 en dessous ; Neutre
 * sans rien d'attendu. Le calcul reste en entiers.
 */
export function fateGauge(done: number, expected: number): FateGauge {
  if (expected === 0) return 0;
  if (done >= expected) return 2;
  if (done * 4 >= expected * 3) return 1;
  if (done * 2 >= expected) return 0;
  if (done * 4 >= expected) return -1;
  return -2;
}

/** La fatigue (`Fatigue`), en % des PV max : 10 à −1, 20 à −2 (le plafond). */
export function fatiguePercent(gauge: FateGauge): number {
  return Math.max(0, -gauge) * 10;
}

/** Le bonus de faveur sur la chance d'objet, en points : 15 à +1, 30 à +2. */
export function favorDropBonus(gauge: FateGauge): number {
  return Math.max(0, gauge) * 15;
}

/** Le décalage de rareté (`RarityShift`) de la chance de Rare, en points : 5 par cran. */
export function rarityShift(gauge: FateGauge): number {
  return gauge * 5;
}
