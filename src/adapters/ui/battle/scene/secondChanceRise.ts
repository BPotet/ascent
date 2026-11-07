import { SECOND_CHANCE_FREEZE_MS } from '../../../../domain/battle/secondChance';
import type { HeroPose } from '../sceneTypes';

/** Le relèvement de la seconde chance sur la scène (#206) : de `at` à la fin du bandeau, `until`. */
export interface SceneSecondChance {
  readonly at: number;
  readonly until: number;
}

/** Le relèvement à un instant : le héros gris, le voile sombre, le halo d'or et son échelle. */
export interface SecondChanceLook {
  readonly grey: number;
  readonly veil: number;
  readonly halo: number;
  readonly haloScale: number;
}

// Stryker disable all: valeurs de la maquette (`.deep`, `.halo`), mutées seulement avec `mutation:ui`.
/** Le voile sombre de la scène pendant le bandeau. */
export const RISE_VEIL_OPACITY = 0.55;
/** Le halo grandit en 900 ms et 6 pas, de la moitié à sa taille ; son éclat culmine à 60 %. */
export const HALO_MS = 900;
const HALO_STEPS = 6;
const HALO_PEAK = 0.6;
const HALO_REST = 0.8;
// Stryker restore all

const NONE: SecondChanceLook = { grey: 0, veil: 0, halo: 0, haloScale: 1 };

/**
 * Le halo d'or `elapsed` ms après son départ (maquette, `.halo`) : il grandit en 900 ms et 6 pas,
 * de la moitié à sa taille, et son éclat culmine à 60 % ; en mouvement réduit, il ne grandit pas.
 * Celui de la seconde chance (#206) et celui de Tenir bon (#235, K12).
 */
export function haloLook(
  elapsed: number,
  reducedMotion: boolean,
): { readonly halo: number; readonly haloScale: number } {
  'worklet';
  const step = Math.min(HALO_STEPS, Math.floor(elapsed / (HALO_MS / HALO_STEPS)));
  const progress = step / HALO_STEPS;
  const halo =
    progress <= HALO_PEAK
      ? progress / HALO_PEAK
      : 1 - ((1 - HALO_REST) * (progress - HALO_PEAK)) / (1 - HALO_PEAK);
  return { halo, haloScale: reducedMotion ? 1 : 0.5 + progress / 2 };
}

/**
 * La scène pendant le relèvement (S2, S3) : 400 ms de gel, le héros gris ; puis, jusqu'à la fin du
 * bandeau, le voile sombre et le halo d'or, qui ne grandit pas en mouvement réduit.
 */
export function secondChanceLook(
  rise: SceneSecondChance | null,
  now: number,
  reducedMotion: boolean,
): SecondChanceLook {
  'worklet';
  if (rise === null || now < rise.at || now >= rise.until) return NONE;
  const elapsed = now - rise.at - SECOND_CHANCE_FREEZE_MS;
  if (elapsed < 0) return { grey: 1, veil: 0, halo: 0, haloScale: 1 };
  return { grey: 0, veil: RISE_VEIL_OPACITY, ...haloLook(elapsed, reducedMotion) };
}

/**
 * Le héros tombé de ce relèvement se relève après le gel (pose « raise ») ; tombé plus tard (une
 * défaite), il reste à terre.
 */
export function risenPose(
  rise: SceneSecondChance | null,
  pose: HeroPose,
  since: number,
  now: number,
): boolean {
  'worklet';
  return (
    rise !== null &&
    pose === 'fallen' &&
    since === rise.at &&
    now >= rise.at + SECOND_CHANCE_FREEZE_MS
  );
}
