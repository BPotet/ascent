import type { EnemyKind } from '../../../domain/battle/combatants';

/** La pose du héros dans la scène (maquette : repos, frappe, touché, déséquilibré…). */
export type HeroPose = 'idle' | 'lean' | 'hit' | 'off' | 'counter' | 'dodge' | 'fallen';

/** Un ennemi tel que la scène le dessine. */
export interface SceneEnemy {
  readonly kind: EnemyKind;
  readonly standing: boolean;
  readonly target: boolean;
  /** Un autre ennemi agit : celui-ci s'efface. */
  readonly dimmed: boolean;
  /** L'ennemi actif, au premier plan. */
  readonly active: boolean;
  /** Étourdi : à terre, avec ses étoiles. */
  readonly down: boolean;
}

/**
 * Les instants de l'avancée et de la préparation de l'ennemi qui attaque, sur la base de
 * l'horloge de combat : la scène en tire sa pose à chaque image.
 */
export interface SceneTimeline {
  readonly enemy: number;
  readonly stepInAt: number;
  readonly windUpAt: number;
  readonly windUpMs: number;
  readonly impacts: readonly number[];
  readonly feintAt: number | null;
  readonly hitStopAt: number;
  readonly hitStopUntil: number;
}

/** Une valeur partagée avec le fil UI (Reanimated), lue et écrite par `get` et `set`. */
export interface SharedNumber {
  get(): number;
  set(value: number): void;
}

/** Le compte des images pendant les préparations et l'éclat (panneau Mesures). */
export interface FrameMeter {
  readonly frames: SharedNumber;
  readonly dropped: SharedNumber;
  readonly worstGap: SharedNumber;
}

/** La largeur d'une colonne d'ennemi : 160 au plus, moins pour que trois tiennent sur l'écran. */
export function columnWidth(sceneWidth: number, count: number): number {
  return Math.min(160, Math.floor((sceneWidth - 8) / Math.max(1, count)));
}
