/**
 * La sortie de terre du Squelette exhumé (#258, maquette 245, F2, F3, ADR 0024) : à l'action du
 * Fossoyeur, le tas d'os sur la place (sa pose `down`, à 70 %), puis le Squelette qui monte de 16 dp
 * debout (`idle0`), découpé au sol ; en mouvement réduit, 4 dp et surtout un fondu. La poussière de
 * l'Invocation (#172), en couleur d'os, s'élève dessous. Aucun nouvel asset. Fonctions pures, lues
 * sur le fil UI.
 */

// Stryker disable all: durées de la maquette (barrière 10 bis), mutées avec `mutation:ui`.
/** Le tas d'os : l'action du Fossoyeur, 400 ms. */
export const EXHUME_PILE_MS = 400;
/** La montée du Squelette : 600 ms. */
export const EXHUME_RISE_MS = 600;
/** La montée, en dp : 16, ou 4 en mouvement réduit. */
const RISE_DP = 16;
const REDUCED_RISE_DP = 4;
/** Le tas d'os, à 70 % (`.pile canvas`). */
const PILE_OPACITY = 0.7;
/** La poussière : 2 images de 200 ms sur le tas, puis 2 à la montée. */
const DUST_FRAME_MS = 200;
// Stryker restore all

/**
 * Ce que montre le Squelette exhumé à `now` : sa pose, son opacité et son enfoncement sous le sol en
 * dp ; `null` hors de sa sortie de terre (la scène le dessine comme d'habitude).
 */
export function exhumeLook(
  exhumedAt: number | null | undefined,
  now: number,
  reducedMotion: boolean,
): { readonly frame: 'down' | 'idle0'; readonly opacity: number; readonly sink: number } | null {
  'worklet';
  if (exhumedAt === null || exhumedAt === undefined || now < exhumedAt) return null;
  const elapsed = now - exhumedAt;
  if (elapsed < EXHUME_PILE_MS) return { frame: 'down', opacity: PILE_OPACITY, sink: 0 };
  const q = (elapsed - EXHUME_PILE_MS) / EXHUME_RISE_MS;
  if (q >= 1) return null;
  const sink = (reducedMotion ? REDUCED_RISE_DP : RISE_DP) * (1 - q);
  return { frame: 'idle0', opacity: reducedMotion ? q : 1, sink };
}

/** L'image de la poussière d'os (0 à 3) à `now`, `null` sans poussière. */
export function exhumeDustFrame(
  exhumedAt: number | null | undefined,
  now: number,
  reducedMotion: boolean,
): number | null {
  'worklet';
  if (exhumedAt === null || exhumedAt === undefined || now < exhumedAt) return null;
  const elapsed = now - exhumedAt;
  if (reducedMotion) return elapsed < EXHUME_PILE_MS ? 1 : null;
  const step = Math.floor(elapsed / DUST_FRAME_MS);
  return step < 4 ? step : null;
}
