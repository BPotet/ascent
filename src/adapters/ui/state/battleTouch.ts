/**
 * Le seul point de conversion d'un instant de toucher, daté sur le fil UI dans le worklet
 * `onBegin` d'un geste, vers l'horloge de combat (fil JS).
 *
 * Méthode de datation (a), retenue par la sonde de toucher (ADR 0005) : les deux horloges ont la
 * même base (`performance.now()`), l'instant passe tel quel. Si le téléphone du propriétaire donne
 * la méthode (b), seule cette fonction change : `touchedAt − calibration.offset`, avec le décalage
 * calibré au montage de l'écran (`calibrateClocks`).
 */
export function toBattleInstant(touchedAt: number): number {
  return touchedAt;
}
