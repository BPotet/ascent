import type { AttackKind } from '../../../domain/battle/attacks';
import type { EnemyKind } from '../../../domain/battle/combatants';
import type { Glint } from '../../../domain/battle/glints';

/**
 * La pose du héros dans la scène (maquette, `pxHeroFrame`) : repos, arme levée pour la frappe en
 * rythme, frappe, parade, parade parfaite, touché, déséquilibré, esquive, tombé, le coup de
 * bouclier de la Riposte du Rempart (#128) et le lancer d'un pouvoir instantané (#173).
 */
export type HeroPose =
  | 'idle'
  | 'raise'
  | 'strike'
  | 'parry'
  | 'counter'
  | 'hit'
  | 'off'
  | 'dodge'
  | 'fallen'
  | 'bash'
  | 'cast';

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
  /**
   * Son relèvement (retour en garde) : à terre, à genoux, debout ; `selfRevive` pour une relève de
   * Se relève seul (#38), qui joue `rise0` et `rise1` quand l'entité les a.
   */
  readonly rising: {
    readonly since: number;
    readonly until: number;
    readonly selfRevive?: boolean;
  } | null;
  /** Un boss passé en phase 2 : il prend son aspect de phase 2, s'il en a un (#38). */
  readonly phase2?: boolean;
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
  /** L'intention d'une action de soutien (#38) : sa pose `guard` ou `raiseAlly`. */
  readonly support?: 'guard' | 'raise' | null;
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

/**
 * La Brûlure sur le héros (#171) : ses charges, la dernière prise et la dernière extinction. La
 * scène dessine une flamme par charge ; à une prise, l'éclat de braise à `lit.at` et les flammes
 * `lit.from` et suivantes, allumées une à une ; au crépitement d'un début de manche (`ticked`), les
 * flammes grandissent ; à une extinction, les flammes `out.slots` partent en fumée à `out.at`. Un
 * combat repris n'a ni prise ni extinction : ses flammes sont là.
 */
export interface SceneBurn {
  readonly stacks: number;
  readonly lit: { readonly at: number; readonly from: number } | null;
  readonly ticked: number | null;
  readonly out: { readonly at: number; readonly slots: readonly number[] } | null;
}
