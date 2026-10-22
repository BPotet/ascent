import type { EnemyKind } from '../../../domain/battle/combatants';

/** La pose du héros dans la scène (maquette : repos, frappe, touché, déséquilibré…). */
export type HeroPose = 'idle' | 'lean' | 'hit' | 'off' | 'counter' | 'dodge' | 'fallen';

/** Un ennemi tel que la scène le dessine. */
export interface SceneEnemy {
  readonly kind: EnemyKind;
  readonly standing: boolean;
  readonly target: boolean;
  /** Un autre ennemi attaque : celui-ci s'efface. */
  readonly dimmed: boolean;
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
