import { HALO_MS, haloLook } from './secondChanceRise';
import { riposteBurst } from './sceneEffects';

/**
 * Les pouvoirs de #235 sur la scène (maquette 232, notes UX), dessinés en code, sans pose
 * nouvelle : le halo d'or de Tenir bon (K12), le voile de Brume, la marque d'Entaille sur la cible
 * et l'éclat d'or de Représailles sur la contre-attaque existante.
 */
export interface ScenePowers {
  /** L'instant du dernier soin de Tenir bon : le halo d'or ; `null` sans soin. */
  readonly healedAt: number | null;
  /** Brume est active : le voile pâle autour de l'Errante. */
  readonly mist: boolean;
  /** L'ennemi marqué par Entaille, la cible de la frappe qui la consomme ; `null` sinon. */
  readonly rendTarget: number | null;
  /** La dernière contre-attaque renforcée par Représailles : l'éclat d'or sur son ennemi. */
  readonly retaliation: { readonly at: number; readonly enemy: number } | null;
}

export const NO_SCENE_POWERS: ScenePowers = {
  healedAt: null,
  mist: false,
  rendTarget: null,
  retaliation: null,
};

// Stryker disable all: valeurs de la maquette (`.halo`, voile), mutées seulement avec `mutation:ui`.
/** Le halo de Tenir bon dure le temps de son animation (`.play .halo`, 900 ms). */
export const HOLD_FAST_HALO_MS = HALO_MS;
/** Le voile pâle de Brume autour de l'Errante. */
export const MIST_VEIL_OPACITY = 0.35;
// Stryker restore all

const NO_HALO = { halo: 0, haloScale: 1 } as const;

/** Le halo d'or de Tenir bon (K12), comme celui de la seconde chance ; rien hors de ses 900 ms. */
export function holdFastHalo(
  healedAt: number | null,
  now: number,
  reducedMotion: boolean,
): { readonly halo: number; readonly haloScale: number } {
  'worklet';
  if (healedAt === null) return NO_HALO;
  const elapsed = now - healedAt;
  if (elapsed < 0 || elapsed >= HOLD_FAST_HALO_MS) return NO_HALO;
  return haloLook(elapsed, reducedMotion);
}

/** L'opacité du voile de Brume : visible tant qu'elle est active. */
export function mistVeilOpacity(mist: boolean): number {
  'worklet';
  return mist ? MIST_VEIL_OPACITY : 0;
}

/**
 * L'éclat d'or de Représailles sur l'ennemi de la contre-attaque : les places de l'éclat de la
 * Riposte du Rempart (#128), sur le même rythme.
 */
export function retaliationBurst(
  retaliation: { readonly at: number } | null,
  now: number,
  reducedMotion: boolean,
): (readonly [number, number])[] {
  'worklet';
  return riposteBurst(retaliation, now, reducedMotion);
}
