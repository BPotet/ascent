import type { AttackKind } from './attacks';

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
  | { readonly type: 'heroPhaseStarted'; readonly at: number }
  | { readonly type: 'targetChanged'; readonly at: number; readonly enemy: number }
  | {
      readonly type: 'heroAttacked';
      readonly at: number;
      readonly enemy: number;
      readonly damage: number;
      readonly until: number;
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
      readonly button: DefenseButton | 'attack' | 'target';
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
      readonly until: number;
    }
  | { readonly type: 'battleEnded'; readonly at: number; readonly outcome: BattleOutcome };
