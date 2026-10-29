import type { AttackKind } from '../../../domain/battle/attacks';
import type { EnemyKind } from '../../../domain/battle/combatants';
import type { Glint } from '../../../domain/battle/glints';

/**
 * La pose du héros dans la scène (maquette, `pxHeroFrame`) : repos, arme levée pour la frappe en
 * rythme, frappe, parade, parade parfaite, touché, déséquilibré, esquive, tombé.
 */
export type HeroPose =
  'idle' | 'raise' | 'strike' | 'parry' | 'counter' | 'hit' | 'off' | 'dodge' | 'fallen';

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
  /** Il perd son action : ses étoiles sautent. */
  readonly losingAction: boolean;
  /** Son relèvement (retour en garde) : à terre, à genoux, debout. */
  readonly rising: { readonly since: number; readonly until: number } | null;
  /** L'instant de sa chute (cassure de garde), `null` s'il est inconnu. */
  readonly downSince: number | null;
}

/**
 * L'action de l'ennemi actif, sur la base de l'horloge de combat : la scène en tire sa pose, ses
 * reflets et l'éclair d'impact à chaque image. `attack` reste `null` pendant l'avancée :
 * rien ne distingue alors un coup d'un autre (C2.8).
 */
export interface SceneTimeline {
  readonly enemy: number;
  readonly kind: 'stepIn' | 'attack' | 'support';
  readonly attack: AttackKind | null;
  readonly stepInAt: number;
  readonly windUpAt: number;
  readonly windUpMs: number;
  /** La fin de l'avancée, de l'attaque (résolution) ou de la Garde et du Relever. */
  readonly until: number;
  readonly impacts: readonly number[];
  readonly feintAt: number | null;
  /** Les reflets de l'attaque (C2.10), calculés par le domaine sur l'instantané. */
  readonly glints: readonly Glint[];
  readonly hitStopAt: number;
  readonly hitStopUntil: number;
}

/** L'étincelle d'une parade : dorée à rayons (parfaite), bleu acier (bonne). */
export interface SceneSpark {
  readonly kind: 'gold' | 'steel';
  readonly at: number;
}
