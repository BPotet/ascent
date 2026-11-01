import { battleColors } from '../../theme/battleColors';

/** Pas de l'ombre actif dans la scène (#173) : l'instant du lancer, `null` s'il n'est pas connu. */
export interface ShadowStepScene {
  readonly castAt: number | null;
}

/** L'ombre de l'Errante à un instant : son écart derrière elle, en dp, et son opacité. */
export interface ShadowStepGhost {
  readonly dx: number;
  readonly opacity: number;
}

// Stryker disable all: valeurs de la maquette (`.ghost`), mutées seulement avec `mutation:ui`.
/** L'ombre glisse de 12 dp derrière l'Errante, en 500 ms et 5 pas, de 90 % à 75 % d'opacité. */
const GHOST_DP = 12;
const GHOST_MS = 500;
const GHOST_STEPS = 5;
const GHOST_FROM = 0.9;
const GHOST_TO = 0.75;
// Stryker restore all

/** Une couleur `#RRGGBB` en ses trois canaux, de 0 à 1. */
function channels(hex: string): readonly [number, number, number] {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return [r / 255, g / 255, b / 255];
}

const [RED, GREEN, BLUE] = channels(battleColors.shadowStep);

/**
 * La matrice de couleur de l'ombre : chaque pixel de l'Errante devient le violet de Pas de l'ombre
 * (#6B5A7A), son alpha gardé.
 */
export const SHADOW_STEP_MATRIX: readonly number[] = [
  0,
  0,
  0,
  0,
  RED,
  0,
  0,
  0,
  0,
  GREEN,
  0,
  0,
  0,
  0,
  BLUE,
  0,
  0,
  0,
  1,
  0,
];

/**
 * L'ombre violette de Pas de l'ombre (#173, maquette E2) tant qu'il est actif : elle glisse de
 * 12 dp derrière l'Errante en 500 ms, puis y reste. En mouvement réduit, ou sans instant de lancer
 * connu (un combat repris), elle est posée sans glisser. `null` : pas d'ombre.
 */
export function shadowStepGhost(
  shadowStep: ShadowStepScene | null,
  now: number,
  reducedMotion: boolean,
): ShadowStepGhost | null {
  'worklet';
  if (shadowStep === null) return null;
  const { castAt } = shadowStep;
  const elapsed = reducedMotion || castAt === null ? GHOST_MS : now - castAt;
  const step = Math.min(GHOST_STEPS, Math.max(0, Math.floor((elapsed * GHOST_STEPS) / GHOST_MS)));
  const part = step / GHOST_STEPS;
  return {
    dx: 0 - Math.round((GHOST_DP * part) / 2) * 2,
    opacity: GHOST_FROM + (GHOST_TO - GHOST_FROM) * part,
  };
}
