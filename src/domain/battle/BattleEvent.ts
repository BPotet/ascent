import type { AttackKind } from './attacks';
import type { EnemyKind } from './combatants';
import type { Intent } from './intents';
import type { PowerKind } from './powers';
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

/**
 * Ce qui brise la garde d'un ennemi : une frappe en rythme, une contre-attaque (C5.1) ou la Riposte
 * du Rempart (#128).
 */
export type GuardBreaker = 'strike' | 'counter' | 'bulwarkCounter';

/**
 * Pourquoi un toucher n'a aucun effet : pendant la transition de phase ou la bulle d'aide, pendant
 * le déséquilibre (qu'il relance), hors de la phase où le bouton sert, commencé avant la phase, ou
 * pendant le relèvement de la seconde chance (#206).
 */
export type IgnoredReason =
  'phaseTransition' | 'offBalance' | 'notAvailable' | 'touchTooEarly' | 'secondChance';

/**
 * Événement de combat (`BattleEvent`) : ce que le moteur annonce, daté de son instant nominal en
 * ms. L'interface, les sons et les vibrations ne réagissent qu'à eux.
 */
export type BattleEvent =
  | {
      readonly type: 'roundStarted';
      readonly at: number;
      readonly round: number;
      /** L'intention tirée par chaque place de la première ligne, `null` pour un ennemi tombé. */
      readonly intents: readonly (Intent | null)[];
    }
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
      /** Entaille (#235) : le coup retire 150 % de son Brise-garde. */
      readonly rend?: true;
      /** La frappe de pouvoir (#236) ; absente pour « Attaquer ». */
      readonly power?: PowerKind;
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
      /** Entaille (#235) : le coup retire 150 % de son Brise-garde. */
      readonly rend?: true;
      /** La frappe de pouvoir (#236) ; absente pour « Attaquer ». */
      readonly power?: PowerKind;
    }
  | {
      readonly type: 'powerUsed';
      readonly at: number;
      readonly power: PowerKind;
      /** La fin de l'action ; un pouvoir instantané n'en a pas : `at`. */
      readonly until: number;
      /** Un pouvoir instantané (#173) : la phase du héros continue. */
      readonly instant?: true;
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
      /** L'écart de l'appui trop tôt ou trop tard, tel que jugé ; absent dans le vide. */
      readonly delta?: number;
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
      /** Représailles (#235) : la contre-attaque à 200 % des PV et de la garde. */
      readonly retaliation?: true;
    }
  /** Brume s'use (#235), au même instant que le `blowResolved` de l'impact qui l'use. */
  | { readonly type: 'mistWorn'; readonly at: number; readonly enemy: number }
  /** Le soin d'un pouvoir (Tenir bon, #235) : `heal` PV rendus (0 à PV max), `heroHp` après. */
  | {
      readonly type: 'heroHealed';
      readonly at: number;
      readonly power: PowerKind;
      readonly heal: number;
      readonly heroHp: number;
    }
  /** Le Saignement du héros arrêté par un pouvoir (Tenir bon, #235). */
  | { readonly type: 'bleedStopped'; readonly at: number }
  /** Le Rempart s'use (#128, R1), au même instant que le `blowResolved` de l'impact qui l'use. */
  | { readonly type: 'bulwarkWorn'; readonly at: number; readonly enemy: number }
  /** La Riposte du Rempart (#128) sur l'ennemi `enemy`, qui a porté le coup. */
  | {
      readonly type: 'bulwarkCountered';
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
  | { readonly type: 'bossPhaseShifted'; readonly at: number; readonly enemy: number }
  /** Se relève seul (`SelfRevive`, #106) : l'ennemi tombé se relève avec `hp` PV. */
  | {
      readonly type: 'enemySelfRevived';
      readonly at: number;
      readonly enemy: number;
      readonly hp: number;
    }
  /** Le héros saigne (prototype #107) : la marque apparaît, ou celle en cours est mise à jour. */
  | {
      readonly type: 'heroBleeding';
      readonly at: number;
      readonly damage: number;
      readonly rounds: number;
    }
  /** La perte du Saignement au début d'une manche ; `roundsLeft` vaut 0 quand il prend fin. */
  | {
      readonly type: 'bleedTicked';
      readonly at: number;
      readonly loss: number;
      readonly heroHp: number;
      readonly roundsLeft: number;
    }
  /**
   * Le héros brûle (#171) : `added` charges allumées par un impact, 0 à 5 charges (le coup se voit
   * quand même) ; `stacks`, le total après la prise.
   */
  | {
      readonly type: 'heroBurning';
      readonly at: number;
      readonly added: number;
      readonly stacks: number;
    }
  /** La perte de la Brûlure au début d'une manche ; `stacks`, les charges avant l'extinction. */
  | {
      readonly type: 'burnTicked';
      readonly at: number;
      readonly loss: number;
      readonly heroHp: number;
      readonly stacks: number;
    }
  /**
   * Une charge de Brûlure s'éteint, par un impact paré parfaitement ou esquivé (`blow`) ou au début
   * d'une manche (`round`) ; `stacks`, les charges qui restent.
   */
  | {
      readonly type: 'burnExtinguished';
      readonly at: number;
      readonly stacks: number;
      readonly cause: 'blow' | 'round';
    }
  /** Toutes les charges s'éteignent ensemble à la fin du combat. */
  | { readonly type: 'burnCleared'; readonly at: number }
  /**
   * L'Invocation annoncée (#172), juste après le changement de phase du boss `enemy` : les ennemis
   * `kind` entreront aux places `slots` de la première ligne au début de la manche suivante.
   */
  | {
      readonly type: 'summonCalled';
      readonly at: number;
      readonly enemy: number;
      readonly kind: EnemyKind;
      readonly slots: readonly number[];
    }
  /** Un ennemi invoqué entre à la place `enemy`, au début de la manche, avant les tirages. */
  | {
      readonly type: 'summonEntered';
      readonly at: number;
      readonly enemy: number;
      readonly kind: EnemyKind;
    }
  /** Un ennemi invoqué encore debout tombe avec le boss qui l'a appelé, sans Or (#172, règle 4). */
  | { readonly type: 'summonedFell'; readonly at: number; readonly enemy: number }
  | {
      /**
       * Le héros tombé à 0 PV sous le coup de `enemy` se relève avec `hp` PV (#206) ; `cancelled`
       * impacts restants du coup sont annulés. Le combat est en temps mort jusqu'à `until`.
       */
      readonly type: 'secondChanceUsed';
      readonly at: number;
      readonly until: number;
      readonly enemy: number;
      readonly hp: number;
      readonly cancelled: number;
    };
