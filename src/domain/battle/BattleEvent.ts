import type { AttackKind } from './attacks';
import type { EnemyKind } from './combatants';
import type { PowerKind } from './momentum';
import type { PressJudgement } from './rules';

/** Les deux boutons de défense de la phase ennemie. */
export type DefenseButton = 'parry' | 'dodge';

/** Le sens d'une transition de phase : la phase qui arrive. */
export type PhaseDirection = 'enemy' | 'hero';

export type BattleOutcome = 'victory' | 'defeat';

/**
 * Le résultat d'un impact (C8) : parade parfaite, bonne parade, esquive, parade sur un coup
 * imparable (échec), ou coup subi (aucun appui valide, ou impact tombé pendant le déséquilibre).
 */
export type BlowOutcome = 'perfectParry' | 'parry' | 'dodge' | 'perilousParry' | 'suffered';

/** Pourquoi un appui est raté : trop tôt, trop tard, ou dans le vide (aucun impact à juger). */
export type WhiffReason = 'early' | 'late' | 'empty';

/** Un toucher du joueur : un bouton de défense, « Attaquer », une cible, « Frapper » ou un pouvoir. */
export type PlayerButton = DefenseButton | 'attack' | 'target' | 'strike' | 'power';

/** Ce qui brise la garde d'un ennemi : une frappe en rythme ou une contre-attaque (C5.1). */
export type GuardBreaker = 'strike' | 'counter';

/**
 * Pourquoi un toucher n'a aucun effet : pendant la transition de phase ou la bulle d'aide, pendant
 * le déséquilibre (qu'il relance), hors de la phase où le bouton sert, ou commencé avant la phase.
 */
export type IgnoredReason = 'phaseTransition' | 'offBalance' | 'notAvailable' | 'touchTooEarly';

/**
 * Événement de combat (`BattleEvent`) : ce que le moteur annonce, daté de son instant nominal en
 * ms. L'interface, les sons et les vibrations ne réagissent qu'à eux.
 */
export type BattleEvent =
  | { readonly type: 'roundStarted'; readonly at: number; readonly round: number }
  | {
      readonly type: 'heroPhaseStarted';
      readonly at: number;
      /** Sans transition de phase (aucun ennemi n'a joué d'action) : « À toi » est annoncé. */
      readonly announced: boolean;
    }
  | { readonly type: 'targetChanged'; readonly at: number; readonly enemy: number }
  | {
      readonly type: 'strikeStarted';
      readonly at: number;
      readonly enemy: number;
      readonly impactAt: number;
      readonly until: number;
      /** Le rang du coup (1, 2), pour un héros qui frappe plusieurs fois (prototype #90). */
      readonly hit?: number;
    }
  | {
      readonly type: 'strikeResolved';
      readonly at: number;
      readonly enemy: number;
      /** Le jugement du premier appui sur « Frapper », `null` sans appui. */
      readonly judgement: PressJudgement | null;
      readonly delta: number | null;
      readonly damage: number;
      readonly guardDamage: number;
      /** Le rang du coup (1, 2), pour un héros qui frappe plusieurs fois (prototype #90). */
      readonly hit?: number;
    }
  | {
      readonly type: 'powerUsed';
      readonly at: number;
      readonly power: PowerKind;
      readonly until: number;
    }
  | { readonly type: 'momentumChanged'; readonly at: number; readonly momentum: number }
  | {
      readonly type: 'guardBroken';
      readonly at: number;
      readonly enemy: number;
      readonly by: GuardBreaker;
    }
  | {
      readonly type: 'actionLost';
      readonly at: number;
      readonly enemy: number;
      readonly until: number;
    }
  | {
      readonly type: 'guardRestored';
      readonly at: number;
      readonly enemy: number;
      readonly until: number;
      /** Le retour en garde prend la place de l'action perdue (C5.5). */
      readonly inPlaceOfAction: boolean;
    }
  | {
      readonly type: 'guardRaised';
      readonly at: number;
      readonly enemy: number;
      readonly gain: number;
      /** La garde après le gain. */
      readonly guard: number;
    }
  | {
      readonly type: 'allyRaised';
      readonly at: number;
      readonly enemy: number;
      readonly ally: number;
      readonly hp: number;
    }
  | {
      readonly type: 'respite';
      readonly at: number;
      readonly gain: number;
      readonly heroHp: number;
    }
  | { readonly type: 'enemyDefeated'; readonly at: number; readonly enemy: number }
  | { readonly type: 'defenseHintShown'; readonly at: number }
  | {
      readonly type: 'phaseTransitionStarted';
      readonly at: number;
      readonly to: PhaseDirection;
      readonly until: number;
    }
  | {
      readonly type: 'stepInStarted';
      readonly at: number;
      readonly enemy: number;
      readonly until: number;
    }
  | {
      readonly type: 'windUpStarted';
      readonly at: number;
      readonly enemy: number;
      readonly attack: AttackKind;
      readonly impacts: readonly number[];
      readonly feintAt: number | null;
    }
  | { readonly type: 'feintStarted'; readonly at: number; readonly enemy: number }
  | {
      readonly type: 'impactLanded';
      readonly at: number;
      readonly enemy: number;
      readonly index: number;
      /** L'impact est tombé pendant le déséquilibre : il sera subi. */
      readonly lost: boolean;
    }
  | {
      readonly type: 'blowResolved';
      readonly at: number;
      readonly enemy: number;
      readonly index: number;
      readonly outcome: BlowOutcome;
      readonly button: DefenseButton | null;
      /** L'écart de l'appui jugé, `null` pour un coup subi. */
      readonly delta: number | null;
      readonly damage: number;
      readonly heroHp: number;
    }
  | {
      readonly type: 'whiffed';
      readonly at: number;
      readonly button: DefenseButton;
      readonly reason: WhiffReason;
    }
  | {
      readonly type: 'pressIgnored';
      readonly at: number;
      readonly button: PlayerButton;
      readonly reason: IgnoredReason;
    }
  | { readonly type: 'offBalanceStarted'; readonly at: number; readonly until: number }
  | { readonly type: 'offBalanceEnded'; readonly at: number }
  | { readonly type: 'hitStopStarted'; readonly at: number; readonly until: number }
  | {
      readonly type: 'counterAttacked';
      readonly at: number;
      readonly enemy: number;
      readonly damage: number;
      readonly guardDamage: number;
      readonly until: number;
    }
  | { readonly type: 'battleEnded'; readonly at: number; readonly outcome: BattleOutcome }
  /** Le renfort (`Reinforcement`) : l'ennemi `kind` de la réserve prend la place `enemy` (P3b). */
  | {
      readonly type: 'reinforcementEntered';
      readonly at: number;
      readonly enemy: number;
      readonly kind: EnemyKind;
    }
  /** Le changement de phase d'un boss (`BossPhaseShift`, P6). */
  | { readonly type: 'bossPhaseShifted'; readonly at: number; readonly enemy: number };
