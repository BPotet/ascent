/**
 * Le moteur du combat (#31, règles C1, C4, C7 à C12, complété par #32 : C0, C2, C3, C5, C6) : un
 * moteur déterministe, piloté par les échéances. Il reçoit des instants (en ms, sur une base
 * monotone) et une graine du combat, et renvoie un nouvel état et les événements de combat datés
 * de leur instant nominal. Aucune horloge ni aucun hasard caché : le temps et le hasard passent
 * par la session (ports `BattleClock` et `SeedSource`).
 *
 * La manche suit l'ordre d'action (`actionOrder`) par un curseur. Une transition de phase n'a lieu
 * qu'entre deux actions jouées de camps différents (`lastPlayed`) : une action perdue et un
 * retour en garde n'en déclenchent pas.
 */
import { actionOrder, initiativeOrder, type Actor } from './actionOrder';
import { ATTACKS, type AttackKind } from './attacks';
import type {
  BattleEvent,
  BattleOutcome,
  BlowOutcome,
  DefenseButton,
  IgnoredReason,
  PhaseDirection,
  PlayerButton,
  WhiffReason,
} from './BattleEvent';
import {
  ENEMIES,
  ENEMY_INITIATIVE,
  GOOD_PARRY_PERCENT,
  HEROES,
  MAX_DAMAGE_REDUCTION_PERCENT,
  TRIAL_BATTLE_ENEMIES,
  startingInitiative,
  type EnemyKind,
  type HeroKind,
  type HeroProfile,
} from './combatants';
import {
  GUARD_RESTORE_MS,
  LOST_ACTION_MS,
  blowOnEnemy,
  isRestoreDue,
  restoreGuard,
  type Stunned,
} from './guard';
import { NO_MODIFIERS, combineModifiers, type HeroModifiers } from './heroModifiers';
import { heroInitiative } from './initiative';
import { drawIntent, raisedHp, type GuardIntent, type Intent, type RaiseIntent } from './intents';
import {
  BULWARK_DAMAGE_PERCENT,
  MOMENTUM_MAX,
  MOMENTUM_START,
  POWERS,
  gainMomentum,
  missingMomentum,
  type PowerKind,
} from './momentum';
import {
  COUNTER_MS,
  HERO_ACTION_MS,
  HIT_STOP_MS,
  OFF_BALANCE_MS,
  SUPPORT_ACTION_MS,
  judgePress,
  missDeadline,
  pressDelta,
  scaleDamage,
  type PressJudgement,
} from './rules';
import { seedRandom, type BattleSeed, type RandomState } from './SeededRandom';
import {
  STRIKE_RECOVERY_MS,
  STRIKE_WIND_UP_MS,
  counterBlow,
  strikeBlow,
  strikeMultiplier,
  type EnemyBlow,
} from './strike';
import type { TrialTuning } from './TrialTuning';
import { bleedsOn, mergeBleed, tickBleed, type Bleed } from './bleed';

export interface HeroState {
  readonly hp: number;
  readonly maxHp: number;
  /** L'Élan (`Momentum`), de 0 à 5. */
  readonly momentum: number;
  /** Le Rempart est actif : le prochain coup subi fait 50 % de dégâts en moins. */
  readonly bulwark: boolean;
  /** Pas de l'ombre est actif (l'Errante, prototype #90, P11) ; absent s'il ne l'a jamais été. */
  readonly shadowStep?: boolean;
  /** Le Saignement en cours (prototype #107) ; absent, le héros ne saigne pas. */
  readonly bleed?: Bleed;
}

export interface EnemyState {
  readonly kind: EnemyKind;
  readonly hp: number;
  readonly maxHp: number;
  /** La garde (`Guard`), de 0 à sa garde max. */
  readonly guard: number;
  readonly maxGuard: number;
  /** L'intention tirée au début de la manche ; `null` quand son action de la manche est prise. */
  readonly intent: Intent | null;
  /** `null` s'il n'est pas étourdi. */
  readonly stun: Stunned | null;
  /** Il a déjà été relevé une fois par l'intention Relever. */
  readonly raised: boolean;
  /** La manche où il a été relevé : il n'y agit pas. */
  readonly raisedRound: number | null;
  /** Le dernier retour en garde, pour l'animation du relèvement. */
  readonly guardRestore: { readonly since: number; readonly until: number } | null;
  /** Un boss passé en phase 2 (`BossPhaseShift`, P6). */
  readonly phase2?: boolean;
}

export interface ImpactState {
  readonly at: number;
  /** L'instant de l'impact est passé. */
  readonly landed: boolean;
  /** L'impact est tombé pendant le déséquilibre : aucun appui ne peut plus le parer. */
  readonly lost: boolean;
  /** `null` tant que l'impact n'est pas jugé. */
  readonly outcome: BlowOutcome | null;
}

export interface CounterState {
  readonly at: number;
  readonly until: number;
  readonly done: boolean;
}

/** L'avancée (`StepIn`) d'un ennemi, avant sa préparation ou l'effet de son intention. */
export interface StepInStep {
  readonly kind: 'stepIn';
  readonly enemy: number;
  readonly since: number;
  readonly until: number;
}

/** L'attaque d'un ennemi : sa préparation, ses impacts et sa résolution. */
export interface AttackStep {
  readonly kind: 'attack';
  readonly enemy: number;
  readonly attack: AttackKind;
  readonly damage: number;
  readonly startedAt: number;
  readonly feintAt: number | null;
  readonly feintShown: boolean;
  readonly impacts: readonly ImpactState[];
  /** L'instant nominal où le dernier impact est résolu (impact + 160 ms + max(0, −décalage)). */
  readonly resolvedAt: number;
  readonly counter: CounterState | null;
  /** Le Saignement du coup (prototype #107). */
  readonly bleed?: Bleed;
}

/** L'effet d'une intention Garde ou Relever, après l'avancée. */
export interface SupportStep {
  readonly kind: 'support';
  readonly enemy: number;
  readonly intent: GuardIntent | RaiseIntent;
  readonly since: number;
  readonly until: number;
}

/** L'action perdue (`LostAction`) ou le retour en garde (`GuardRestore`) d'un ennemi étourdi. */
export interface StunStep {
  readonly kind: 'lostAction' | 'guardRestore';
  readonly enemy: number;
  readonly since: number;
  readonly until: number;
}

export type EnemyStep = StepInStep | AttackStep | SupportStep | StunStep;

/** Le premier appui sur « Frapper », jugé comme une parade (C6.2). */
export interface StrikePress {
  readonly at: number;
  readonly delta: number;
  readonly judgement: PressJudgement;
}

export type BattlePhase =
  | {
      readonly kind: 'hero';
      readonly since: number;
      /** Elle commence sans transition de phase, par l'annonce « À toi ». */
      readonly announced: boolean;
    }
  | {
      /** La frappe en rythme (`TimedStrike`) : sa préparation, son impact, sa récupération. */
      readonly kind: 'heroStrike';
      readonly enemy: number;
      readonly since: number;
      readonly impactAt: number;
      readonly press: StrikePress | null;
      readonly resolved: boolean;
      /** La fin de l'action : fin de la fenêtre de l'impact, puis la récupération. */
      readonly until: number;
      /** Le rang du coup, pour un héros qui frappe plusieurs fois (prototype #90). */
      readonly hit?: number;
    }
  | {
      readonly kind: 'heroPower';
      readonly power: PowerKind;
      readonly since: number;
      readonly until: number;
    }
  | { readonly kind: 'defenseHint'; readonly since: number }
  | {
      readonly kind: 'transition';
      readonly to: PhaseDirection;
      readonly since: number;
      readonly until: number;
    }
  | { readonly kind: 'enemy'; readonly step: EnemyStep }
  | { readonly kind: 'over'; readonly outcome: BattleOutcome; readonly at: number };

/** Le combat (`Battle`) : un état immuable. */
export interface Battle {
  /** L'instant jusqu'où le moteur a avancé. */
  readonly now: number;
  readonly random: RandomState;
  readonly tuning: TrialTuning;
  /** Le décalage (`InputOffset`), fixé à 0 ms dans #31. */
  readonly inputOffset: number;
  readonly round: number;
  /** Le héros joué (prototype #90). */
  readonly heroKind: HeroKind;
  /** L'ordre d'action par Initiative (prototype #90), sinon le héros d'abord. */
  readonly initiative: boolean;
  /** Les modificateurs du héros (prototype #93) ; absents, aucun. */
  readonly modifiers?: HeroModifiers;
  readonly hero: HeroState;
  /** La première ligne (`FrontLine`) : au plus 3 ennemis qui se battent en même temps (P3b). */
  readonly enemies: readonly EnemyState[];
  /** La réserve (`EnemyReserve`) : les ennemis du groupe qui attendent, dans l'ordre du tirage. */
  readonly reserve: readonly EnemyKind[];
  readonly target: number;
  readonly phase: BattlePhase;
  /** L'ordre d'action de la manche et la place de celui qui agit. */
  readonly turn: { readonly order: readonly Actor[]; readonly position: number };
  /** Le camp du dernier combattant qui a joué une action (C0), `null` avant la première. */
  readonly lastPlayed: 'hero' | 'enemy' | null;
  /** Le nombre d'actions du héros commencées : date l'événement (b) de C5.3. */
  readonly heroActions: number;
  /** La fin du déséquilibre en cours, `null` sans déséquilibre. */
  readonly offBalanceUntil: number | null;
  /** Le dernier arrêt sur image. */
  readonly hitStop: { readonly at: number; readonly until: number } | null;
  /** La bulle d'aide de la phase ennemie reste à montrer avant la première transition. */
  readonly defenseHintPending: boolean;
}

/** Un nouvel état et les événements produits, dans l'ordre. */
export interface BattleUpdate {
  readonly battle: Battle;
  readonly events: readonly BattleEvent[];
}

/** La prochaine échéance du moteur. `awaitsPress` : un impact sans appui, subi après l'instant. */
export interface BattleDeadline {
  readonly at: number;
  readonly awaitsPress: boolean;
}

export type HeroAction =
  | { readonly kind: 'attack' }
  | { readonly kind: 'target'; readonly enemy: number }
  | { readonly kind: 'power'; readonly power: PowerKind };

type Events = BattleEvent[];

interface Deadline extends BattleDeadline {
  readonly apply: (battle: Battle, events: Events) => Battle;
}

// ---------------------------------------------------------------------------------------------
// Création

export interface TrialBattleOptions {
  readonly seed: BattleSeed;
  readonly tuning: TrialTuning;
  /** Montrer la bulle d'aide de la phase ennemie avant la première transition. */
  readonly defenseHint: boolean;
  /** L'instant de départ, sur la base de l'horloge de combat. */
  readonly at: number;
  readonly inputOffset?: number;
  /** Le héros joué (prototype #90) ; la Sentinelle par défaut. */
  readonly hero?: HeroKind;
  /** L'ordre d'action par Initiative (prototype #90) ; par défaut, le héros d'abord. */
  readonly initiative?: boolean;
}

/** Un combat de l'ascension : le héros avec ses PV, contre un groupe d'ennemis (#91). */
export interface BattleOptions extends TrialBattleOptions {
  /** Les PV du héros au début du combat ; par défaut ses PV max. */
  readonly heroHp?: number;
  /** Les PV max du héros (prototype #93 : Vigueur, fatigue) ; par défaut ceux du héros. */
  readonly heroMaxHp?: number;
  /** Les modificateurs du héros (prototype #93) ; par défaut, aucun. */
  readonly modifiers?: HeroModifiers;
  /** Le groupe d'ennemis, de gauche à droite, dans l'ordre du tirage. */
  readonly enemies: readonly EnemyKind[];
}

/** Au plus 3 ennemis se battent en même temps (P3b). */
export const FRONT_LINE_SIZE = 3;

function freshEnemy(kind: EnemyKind): EnemyState {
  return {
    kind,
    hp: ENEMIES[kind].maxHp,
    maxHp: ENEMIES[kind].maxHp,
    guard: ENEMIES[kind].maxGuard,
    maxGuard: ENEMIES[kind].maxGuard,
    intent: null,
    stun: null,
    raised: false,
    raisedRound: null,
    guardRestore: null,
  };
}

/**
 * Le combat d'essai : la Sentinelle (ou l'Errante) contre la Goule, le Spectre et le
 * Nécromancien, en phase du héros (C1). Avec l'Initiative, le premier de l'ordre ouvre le combat.
 */
export function startTrialBattle(options: TrialBattleOptions): BattleUpdate {
  return startBattle({ ...options, enemies: TRIAL_BATTLE_ENEMIES });
}

/**
 * Un combat, en phase du héros (C1) : la première ligne (les 3 premiers ennemis) et la réserve
 * (les suivants), l'Élan à 1 (P8).
 */
export function startBattle({
  seed,
  tuning,
  defenseHint,
  at,
  inputOffset = 0,
  hero = 'sentinel',
  initiative = false,
  heroHp,
  heroMaxHp,
  modifiers,
  enemies: group,
}: BattleOptions): BattleUpdate {
  const maxHp = heroMaxHp ?? HEROES[hero].maxHp;
  const momentum = Math.min(MOMENTUM_MAX, MOMENTUM_START + (modifiers?.startingMomentum ?? 0));
  const events: Events = [];
  const enemies = group.slice(0, FRONT_LINE_SIZE).map(freshEnemy);
  const battle = startRound(
    {
      now: at,
      random: seedRandom(seed),
      tuning,
      inputOffset,
      round: 0,
      heroKind: hero,
      initiative,
      ...(modifiers && { modifiers }),
      hero: { hp: heroHp ?? maxHp, maxHp, momentum, bulwark: false },
      enemies,
      reserve: group.slice(FRONT_LINE_SIZE),
      target: 0,
      phase: { kind: 'hero', since: at, announced: false },
      turn: { order: [], position: 0 },
      lastPlayed: null,
      heroActions: 0,
      offBalanceUntil: null,
      hitStop: null,
      defenseHintPending: defenseHint,
    },
    events,
    at,
  );
  if (battle.turn.order[0] !== 'hero') return { battle: playTurn(battle, events, at), events };
  events.push({ type: 'heroPhaseStarted', at, announced: false });
  return { battle, events };
}

// ---------------------------------------------------------------------------------------------
// Lecture

/** Le profil du héros joué. */
export function heroProfile(battle: Battle): HeroProfile {
  return HEROES[battle.heroKind];
}

/** Les modificateurs du héros dans ce combat (prototype #93). */
function heroModifiers(battle: Battle): HeroModifiers {
  // Un combat sauvegardé avant #92 n'a pas tous les champs : les absents sont neutres.
  return battle.modifiers === undefined ? NO_MODIFIERS : combineModifiers(battle.modifiers);
}

export function isStanding(enemy: EnemyState): boolean {
  return enemy.hp > 0;
}

/** Les indices des ennemis debout, de gauche à droite. */
export function standingEnemies(battle: Battle): number[] {
  return battle.enemies.flatMap((enemy, index) => (isStanding(enemy) ? [index] : []));
}

/** Le déséquilibre est en cours à l'instant `at`. */
export function isOffBalanceAt(battle: Battle, at: number): boolean {
  return battle.offBalanceUntil !== null && at < battle.offBalanceUntil;
}

// ---------------------------------------------------------------------------------------------
// Échéances

function compareDeadlines(left: Deadline, right: Deadline): number {
  if (left.at !== right.at) return left.at - right.at;
  // À instant égal, l'échéance d'un appui absent passe après les autres.
  return Number(left.awaitsPress) - Number(right.awaitsPress);
}

function attackDeadlines(battle: Battle, step: AttackStep): Deadline[] {
  const deadlines: Deadline[] = [];
  if (step.feintAt !== null && !step.feintShown) {
    deadlines.push({ at: step.feintAt, awaitsPress: false, apply: showFeint });
  }
  step.impacts.forEach((impact, index) => {
    if (!impact.landed) {
      deadlines.push({
        at: impact.at,
        awaitsPress: false,
        apply: (current, events) => landImpact(current, events, index),
      });
    }
    if (impact.outcome === null) {
      deadlines.push({
        at: missDeadline(impact.at, battle.inputOffset),
        awaitsPress: true,
        apply: (current, events) => sufferImpact(current, events, index),
      });
    }
  });
  if (step.counter !== null && !step.counter.done) {
    deadlines.push({ at: step.counter.at, awaitsPress: false, apply: counterAttack });
  }
  const resolved = step.impacts.every((impact) => impact.outcome !== null);
  if (resolved && (step.counter === null || step.counter.done)) {
    deadlines.push({ at: attackEnd(step), awaitsPress: false, apply: endEnemyStep });
  }
  return deadlines;
}

function strikeDeadline(battle: Battle, phase: StrikePhase): Deadline {
  if (phase.resolved) return { at: phase.until, awaitsPress: false, apply: endHeroAction };
  // Un appui avant l'impact est jugé à l'impact ; sans appui, la frappe part à la fin de la fenêtre.
  return phase.press === null
    ? {
        at: missDeadline(phase.impactAt, battle.inputOffset),
        awaitsPress: true,
        apply: (current, events) =>
          resolveStrike(current, events, missDeadline(phase.impactAt, current.inputOffset)),
      }
    : {
        at: phase.impactAt,
        awaitsPress: false,
        apply: (current, events) => resolveStrike(current, events, phase.impactAt),
      };
}

function phaseDeadlines(battle: Battle): Deadline[] {
  const { phase } = battle;
  switch (phase.kind) {
    case 'heroStrike':
      return [strikeDeadline(battle, phase)];
    case 'heroPower':
      return [{ at: phase.until, awaitsPress: false, apply: endHeroAction }];
    case 'transition':
      return [{ at: phase.until, awaitsPress: false, apply: endTransition }];
    case 'enemy': {
      const { step } = phase;
      if (step.kind === 'attack') return attackDeadlines(battle, step);
      const apply = step.kind === 'stepIn' ? startEnemyAction : endEnemyStep;
      return [{ at: step.until, awaitsPress: false, apply }];
    }
    default:
      return [];
  }
}

function deadlinesOf(battle: Battle): Deadline[] {
  const deadlines = phaseDeadlines(battle);
  if (battle.offBalanceUntil !== null) {
    deadlines.push({ at: battle.offBalanceUntil, awaitsPress: false, apply: endOffBalance });
  }
  return deadlines.sort(compareDeadlines);
}

function isDue(deadline: BattleDeadline, until: number): boolean {
  // Un impact sans appui n'est subi qu'après son échéance : un appui à l'instant même est jugé.
  return deadline.awaitsPress ? deadline.at < until : deadline.at <= until;
}

/** La prochaine échéance, ou `null` quand le combat attend le joueur (ou est fini). */
export function nextDeadline(battle: Battle): BattleDeadline | null {
  const [first] = deadlinesOf(battle);
  return first === undefined ? null : { at: first.at, awaitsPress: first.awaitsPress };
}

/** Fait avancer le combat jusqu'à `until` : toutes les échéances atteintes, dans l'ordre. */
export function advance(battle: Battle, until: number): BattleUpdate {
  const events: Events = [];
  let current = battle;
  for (;;) {
    const due = deadlinesOf(current).find((deadline) => isDue(deadline, until));
    if (due === undefined) break;
    current = due.apply(current, events);
  }
  return { battle: { ...current, now: Math.max(current.now, until) }, events };
}

// ---------------------------------------------------------------------------------------------
// Manche et ordre d'action

type StrikePhase = Extract<BattlePhase, { kind: 'heroStrike' }>;

/** Le premier allié tombé jamais relevé de `enemy`, `null` s'il n'y en a pas. */
function fallenAlly(battle: Battle, enemy: number): number | null {
  const ally = battle.enemies.findIndex(
    (other, index) => index !== enemy && !isStanding(other) && !other.raised,
  );
  return ally < 0 ? null : ally;
}

/**
 * Le renfort (P3b) : s'il ne reste qu'un ennemi debout ou aucun, le 1er de la réserve prend la
 * place du tombé le plus à gauche, qui ne peut plus être relevé ; un seul par manche.
 */
function reinforce(battle: Battle, events: Events, at: number): Battle {
  const [kind, ...reserve] = battle.reserve;
  if (kind === undefined || standingEnemies(battle).length > 1) return battle;
  const slot = battle.enemies.findIndex((enemy) => !isStanding(enemy));
  events.push({ type: 'reinforcementEntered', at, enemy: slot, kind });
  const reinforced = { ...withEnemy(battle, slot, freshEnemy(kind)), reserve };
  if (isStanding(reinforced.enemies[reinforced.target]!)) return reinforced;
  events.push({ type: 'targetChanged', at, enemy: slot });
  return { ...reinforced, target: slot };
}

/** La perte du Saignement (B2), avant le renfort et les tirages ; ni réduction ni Rempart (B3). */
function bleedHero(battle: Battle, events: Events, at: number): Battle {
  const { hero } = battle;
  if (hero.bleed === undefined) return battle;
  const { loss, bleed } = tickBleed(hero.hp, hero.bleed);
  const { bleed: _, ...rest } = hero;
  const heroHp = hero.hp - loss;
  events.push({ type: 'bleedTicked', at, loss, heroHp, roundsLeft: bleed?.rounds ?? 0 });
  return { ...battle, hero: { ...rest, hp: heroHp, ...(bleed && { bleed }) } };
}

function startRound(previous: Battle, events: Events, at: number): Battle {
  // Le renfort entre avant les tirages : l'ordre de la manche est calculé après (P3b).
  const battle = reinforce(bleedHero(previous, events, at), events, at);
  let random = battle.random;
  // Tous les tirages au début de la manche, ennemis debout de gauche à droite (C2.1).
  const enemies = battle.enemies.map((enemy, index) => {
    if (!isStanding(enemy)) return enemy;
    const drawn = drawIntent(enemy.kind, random, {
      fallenAlly: fallenAlly(battle, index),
      stunned: enemy.stun !== null,
      guardDamaged: enemy.guard < enemy.maxGuard,
      phase2: enemy.phase2 === true,
    });
    random = drawn.random;
    return { ...enemy, intent: drawn.intent };
  });
  const round = battle.round + 1;
  events.push({ type: 'roundStarted', at, round });
  return {
    ...battle,
    enemies,
    random,
    round,
    turn: { order: roundOrder(battle, enemies), position: 0 },
  };
}

/** L'Initiative d'un ennemi : celle de sa phase 2 pour un boss qui a changé de phase (P13). */
function enemyInitiative(enemy: EnemyState): number {
  const phase2 = enemy.phase2 === true ? ENEMIES[enemy.kind].phase2Initiative : undefined;
  return phase2 ?? ENEMY_INITIATIVE[enemy.kind];
}

/** L'ordre d'action de la manche, figé jusqu'à la suivante (P14). */
function roundOrder(battle: Battle, enemies: readonly EnemyState[]): Actor[] {
  if (!battle.initiative) return actionOrder(enemies);
  return initiativeOrder(
    heroInitiative(startingInitiative(battle.heroKind), heroModifiers(battle).initiative),
    enemies.map((enemy) => ({ hp: enemy.hp, initiative: enemyInitiative(enemy) })),
  );
}

/** L'ordre de la manche suivante sur l'état courant : l'aperçu de la frise d'action (#90). */
export function nextRoundOrder(battle: Battle): Actor[] {
  return roundOrder(battle, battle.enemies);
}

/** Celui qui agit à la place courante de l'ordre d'action, à l'instant `at`. */
function playTurn(battle: Battle, events: Events, at: number): Battle {
  const actor = battle.turn.order[battle.turn.position];
  if (actor === undefined) return playTurn(startRound(battle, events, at), events, at);
  if (actor === 'hero') return heroTurn(battle, events, at);
  if (!isStanding(battle.enemies[actor]!)) return nextTurn(battle, events, at);
  return enemyTurn(battle, events, actor, at);
}

/** Le combattant suivant de l'ordre d'action (ou la manche suivante). */
function nextTurn(battle: Battle, events: Events, at: number): Battle {
  const turn = { ...battle.turn, position: battle.turn.position + 1 };
  return playTurn({ ...battle, turn }, events, at);
}

function heroTurn(battle: Battle, events: Events, at: number): Battle {
  if (battle.lastPlayed === 'enemy') return startTransition(battle, events, 'hero', at);
  // Aucun ennemi n'a joué d'action depuis le héros : ni transition ni « Phase ennemie » (C5.4).
  events.push({ type: 'heroPhaseStarted', at, announced: true });
  return { ...battle, phase: { kind: 'hero', since: at, announced: true } };
}

function enemyTurn(battle: Battle, events: Events, enemy: number, at: number): Battle {
  const { stun } = battle.enemies[enemy]!;
  if (stun !== null) return stunTurn(battle, events, enemy, stun, at);
  if (battle.lastPlayed === 'enemy') return startStepIn(battle, events, enemy, at);
  if (battle.defenseHintPending) {
    events.push({ type: 'defenseHintShown', at });
    return { ...battle, phase: { kind: 'defenseHint', since: at } };
  }
  return startTransition(battle, events, 'enemy', at);
}

function withEnemy(battle: Battle, index: number, enemy: EnemyState): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((current, position) => (position === index ? enemy : current)),
  };
}

/**
 * Le tour d'un ennemi étourdi (C5.4, C5.5) : son action perdue (250 ms), ou, si l'action du héros
 * qui suit la cassure est déjà passée, son retour en garde à sa place (400 ms). Ni l'un ni l'autre
 * n'est une action : pas de transition, et le camp du dernier acteur ne change pas.
 */
function stunTurn(
  battle: Battle,
  events: Events,
  enemy: number,
  stun: Stunned,
  at: number,
): Battle {
  const state = battle.enemies[enemy]!;
  if (isRestoreDue(stun, battle.heroActions)) {
    const until = at + GUARD_RESTORE_MS;
    events.push({ type: 'guardRestored', at, enemy, until, inPlaceOfAction: true });
    const restored = {
      ...restoreGuard(state, heroModifiers(battle).guardRestorePercent ?? 100),
      intent: null,
      guardRestore: { since: at, until },
    };
    return {
      ...withEnemy(battle, enemy, restored),
      phase: { kind: 'enemy', step: { kind: 'guardRestore', enemy, since: at, until } },
    };
  }
  const until = at + LOST_ACTION_MS;
  events.push({ type: 'actionLost', at, enemy, until });
  return {
    ...withEnemy(battle, enemy, { ...state, stun: { ...stun, actionLost: true } }),
    phase: { kind: 'enemy', step: { kind: 'lostAction', enemy, since: at, until } },
  };
}

// ---------------------------------------------------------------------------------------------
// Déroulé

function endOffBalance(battle: Battle, events: Events): Battle {
  events.push({ type: 'offBalanceEnded', at: battle.offBalanceUntil! });
  return { ...battle, offBalanceUntil: null };
}

/** Le déséquilibre s'arrête (début d'une transition, fin du combat). */
function clearOffBalance(battle: Battle, events: Events, at: number): Battle {
  if (battle.offBalanceUntil === null) return battle;
  events.push({ type: 'offBalanceEnded', at });
  return { ...battle, offBalanceUntil: null };
}

/** La victoire : aucun ennemi debout et la réserve vide (P3b). */
function isWon(battle: Battle): boolean {
  return standingEnemies(battle).length === 0 && battle.reserve.length === 0;
}

/** Le répit (C11) : +10 % des PV max à la victoire, sans dépasser le maximum. */
export const RESPITE_PERCENT = 10;

function finish(battle: Battle, events: Events, outcome: BattleOutcome, at: number): Battle {
  // Le Saignement s'arrête à la fin du combat (B6).
  const { bleed: _, ...hero } = battle.hero;
  let settled = clearOffBalance({ ...battle, hero }, events, at);
  if (outcome === 'victory') {
    const { hero } = settled;
    const heroHp = Math.min(hero.maxHp, hero.hp + Math.floor((hero.maxHp * RESPITE_PERCENT) / 100));
    events.push({ type: 'respite', at, gain: heroHp - hero.hp, heroHp });
    settled = { ...settled, hero: { ...hero, hp: heroHp } };
  }
  events.push({ type: 'battleEnded', at, outcome });
  return { ...settled, phase: { kind: 'over', outcome, at } };
}

function startTransition(battle: Battle, events: Events, to: PhaseDirection, at: number): Battle {
  const settled = clearOffBalance(battle, events, at);
  const until = at + battle.tuning.phaseTransitionMs;
  events.push({ type: 'phaseTransitionStarted', at, to, until });
  return { ...settled, phase: { kind: 'transition', to, since: at, until } };
}

/**
 * La fin de l'action du héros (C5.5, C12) : chaque ennemi étourdi qui a déjà perdu son action se
 * relève (le retour en garde se joue pendant ce qui suit), puis la victoire ou l'acteur suivant.
 */
function endHeroAction(battle: Battle, events: Events): Battle {
  const at = (battle.phase as { readonly until: number }).until;
  const enemies = battle.enemies.map((enemy, index) => {
    const { stun } = enemy;
    if (stun === null || !stun.actionLost || !isRestoreDue(stun, battle.heroActions)) return enemy;
    const until = at + GUARD_RESTORE_MS;
    events.push({ type: 'guardRestored', at, enemy: index, until, inPlaceOfAction: false });
    return {
      ...restoreGuard(enemy, heroModifiers(battle).guardRestorePercent ?? 100),
      guardRestore: { since: at, until },
    };
  });
  const restored = { ...battle, enemies };
  if (isWon(restored)) return finish(restored, events, 'victory', at);
  return nextTurn(restored, events, at);
}

function startStepIn(battle: Battle, events: Events, enemy: number, at: number): Battle {
  const until = at + battle.tuning.stepInMs;
  events.push({ type: 'stepInStarted', at, enemy, until });
  return {
    ...battle,
    lastPlayed: 'enemy',
    phase: { kind: 'enemy', step: { kind: 'stepIn', enemy, since: at, until } },
  };
}

function endTransition(battle: Battle, events: Events): Battle {
  const phase = battle.phase as Extract<BattlePhase, { kind: 'transition' }>;
  if (phase.to === 'hero') {
    events.push({ type: 'heroPhaseStarted', at: phase.until, announced: false });
    return { ...battle, phase: { kind: 'hero', since: phase.until, announced: false } };
  }
  // L'ennemi dont c'est le tour s'avance (C12).
  return startStepIn(
    battle,
    events,
    battle.turn.order[battle.turn.position] as number,
    phase.until,
  );
}

function enemyStep(battle: Battle): EnemyStep {
  return (battle.phase as Extract<BattlePhase, { kind: 'enemy' }>).step;
}

function withStep(battle: Battle, step: EnemyStep): Battle {
  return { ...battle, phase: { kind: 'enemy', step } };
}

function currentAttack(battle: Battle): AttackStep {
  return enemyStep(battle) as AttackStep;
}

/** Après l'avancée : l'attaque, ou l'effet de l'intention Garde ou Relever. */
function startEnemyAction(battle: Battle, events: Events): Battle {
  const { enemy, until: at } = enemyStep(battle) as StepInStep;
  const intent = battle.enemies[enemy]!.intent!;
  return intent.category === 'attack'
    ? startAttack(battle, events, enemy, intent, at)
    : startSupport(battle, events, enemy, intent, at);
}

function startAttack(
  battle: Battle,
  events: Events,
  enemy: number,
  intent: Extract<Intent, { category: 'attack' }>,
  at: number,
): Battle {
  const profile = ATTACKS[intent.attack];
  const impacts = profile.hitOffsetsMs.map((offset) => at + intent.windUpMs + offset);
  const feintAt = profile.feint ? at + Math.round(intent.windUpMs * intent.feintFraction) : null;
  events.push({ type: 'windUpStarted', at, enemy, attack: intent.attack, impacts, feintAt });
  return withStep(battle, {
    kind: 'attack',
    enemy,
    attack: intent.attack,
    damage: intent.damage,
    startedAt: at,
    feintAt,
    feintShown: false,
    impacts: impacts.map((impactAt) => ({
      at: impactAt,
      landed: false,
      lost: false,
      outcome: null,
    })),
    resolvedAt: missDeadline(impacts.at(-1)!, battle.inputOffset),
    counter: null,
    ...(intent.bleed && { bleed: intent.bleed }),
  });
}

/** L'intention Garde (la garde remonte, sans dépasser son maximum) ou Relever (C2, C5.9). */
function startSupport(
  battle: Battle,
  events: Events,
  enemy: number,
  intent: GuardIntent | RaiseIntent,
  at: number,
): Battle {
  let supported: Battle;
  if (intent.category === 'guard') {
    const state = battle.enemies[enemy]!;
    const guard = Math.min(state.maxGuard, state.guard + intent.gain);
    events.push({ type: 'guardRaised', at, enemy, gain: intent.gain, guard });
    supported = withEnemy(battle, enemy, { ...state, guard });
  } else {
    const ally = battle.enemies[intent.ally]!;
    const hp = raisedHp(ally.maxHp);
    events.push({ type: 'allyRaised', at, enemy, ally: intent.ally, hp });
    supported = withEnemy(battle, intent.ally, {
      ...restoreGuard(ally),
      hp,
      intent: null,
      raised: true,
      raisedRound: battle.round,
    });
  }
  return withStep(supported, {
    kind: 'support',
    enemy,
    intent,
    since: at,
    until: at + SUPPORT_ACTION_MS,
  });
}

function showFeint(battle: Battle, events: Events): Battle {
  const step = currentAttack(battle);
  events.push({ type: 'feintStarted', at: step.feintAt!, enemy: step.enemy });
  return withStep(battle, { ...step, feintShown: true });
}

function withImpact(step: AttackStep, index: number, impact: Partial<ImpactState>): AttackStep {
  return {
    ...step,
    impacts: step.impacts.map((current, position) =>
      position === index ? { ...current, ...impact } : current,
    ),
  };
}

function landImpact(battle: Battle, events: Events, index: number): Battle {
  const step = currentAttack(battle);
  const { at } = step.impacts[index]!;
  // Un impact qui tombe pendant le déséquilibre compte comme un coup raté (C9).
  const lost = isOffBalanceAt(battle, at);
  events.push({ type: 'impactLanded', at, enemy: step.enemy, index, lost });
  return withStep(battle, withImpact(step, index, { landed: true, lost }));
}

/** Le résultat d'un impact : dégâts au héros (le Rempart s'use), puis défaite s'il tombe. */
function resolveBlow(
  battle: Battle,
  events: Events,
  blow: {
    readonly index: number;
    readonly outcome: BlowOutcome;
    readonly button: DefenseButton | null;
    readonly delta: number | null;
    readonly damage: number;
    readonly at: number;
  },
): Battle {
  const step = currentAttack(battle);
  const heroHp = Math.max(0, battle.hero.hp - blow.damage);
  events.push({
    type: 'blowResolved',
    at: blow.at,
    enemy: step.enemy,
    index: blow.index,
    outcome: blow.outcome,
    button: blow.button,
    delta: blow.delta,
    damage: blow.damage,
    heroHp,
  });
  const bulwark = battle.hero.bulwark && blow.damage === 0;
  const hero = { ...battle.hero, hp: heroHp, bulwark };
  const resolved = withStep(
    { ...battle, hero: bleedOn(hero, step, blow.outcome, events, blow.at) },
    withImpact(step, blow.index, { outcome: blow.outcome }),
  );
  return heroHp === 0 ? finish(resolved, events, 'defeat', blow.at) : resolved;
}

/** Un coup qui saigne fait saigner le héros encore debout, selon l'issue de l'impact (B1, B4). */
function bleedOn(
  hero: HeroState,
  step: AttackStep,
  outcome: BlowOutcome,
  events: Events,
  at: number,
): HeroState {
  if (step.bleed === undefined || hero.hp === 0 || !bleedsOn(outcome)) return hero;
  const bleed = mergeBleed(hero.bleed, step.bleed);
  events.push({ type: 'heroBleeding', at, ...bleed });
  return { ...hero, bleed };
}

/**
 * Les dégâts subis par le héros : réduction des dégâts (plafonnée à 40 %), puis le Rempart s'il
 * est actif ; un seul arrondi.
 */
function heroDamage(battle: Battle, damage: number, ...percents: readonly number[]): number {
  const reduction =
    100 -
    Math.min(
      heroProfile(battle).damageReductionPercent + heroModifiers(battle).damageReductionPoints,
      MAX_DAMAGE_REDUCTION_PERCENT,
    );
  const bulwark = battle.hero.bulwark ? [BULWARK_DAMAGE_PERCENT] : [];
  return scaleDamage(damage, ...percents, reduction, ...bulwark);
}

function sufferImpact(battle: Battle, events: Events, index: number): Battle {
  const step = currentAttack(battle);
  return resolveBlow(battle, events, {
    index,
    outcome: 'suffered',
    button: null,
    delta: null,
    damage: heroDamage(battle, step.damage),
    at: missDeadline(step.impacts[index]!.at, battle.inputOffset),
  });
}

/**
 * Un coup du héros à un ennemi (frappe ou contre-attaque), pendant son action `heroActions` : il
 * perd ses PV et sa garde ; à 0 PV il tombe, et la cible passe au premier ennemi debout (C4) ; à
 * 0 de garde, c'est la cassure, avec l'arrêt sur image (C5.1).
 */
function hitEnemy(
  battle: Battle,
  events: Events,
  index: number,
  blow: EnemyBlow,
  context: { readonly at: number; readonly by: 'strike' | 'counter' },
): { readonly battle: Battle; readonly broken: boolean } {
  const hit = blowOnEnemy(battle.enemies[index]!, blow, battle.heroActions);
  const damaged = withEnemy(battle, index, shiftPhase(hit.enemy, events, index, context.at));
  if (hit.broken) {
    events.push({ type: 'guardBroken', at: context.at, enemy: index, by: context.by });
    return { battle: onGuardBreak(damaged, events, context.at), broken: true };
  }
  if (!hit.fallen) return { battle: damaged, broken: false };
  events.push({ type: 'enemyDefeated', at: context.at, enemy: index });
  const [next] = standingEnemies(damaged);
  if (battle.target !== index || next === undefined) return { battle: damaged, broken: false };
  events.push({ type: 'targetChanged', at: context.at, enemy: next });
  return { battle: { ...damaged, target: next }, broken: false };
}

/** Cœur de braise (prototype #92) : à chaque garde brisée, l'Élan gagné et les PV rendus. */
function onGuardBreak(battle: Battle, events: Events, at: number): Battle {
  const { momentum, heal } = heroModifiers(battle).onGuardBreak;
  let gained = battle;
  for (let point = 0; point < momentum; point += 1) gained = gainMomentumAt(gained, events, at);
  const { hero } = gained;
  return { ...gained, hero: { ...hero, hp: Math.min(hero.maxHp, hero.hp + heal) } };
}

/**
 * Le changement de phase d'un boss (P6) : à 150 PV ou moins, une fois ; sa garde revient à son
 * maximum s'il n'est pas étourdi (sinon à son retour en garde). L'ordre de la manche ne change pas.
 */
function shiftPhase(enemy: EnemyState, events: Events, index: number, at: number): EnemyState {
  const { phaseShiftHp } = ENEMIES[enemy.kind];
  if (phaseShiftHp === undefined || enemy.phase2 || enemy.hp === 0 || enemy.hp > phaseShiftHp) {
    return enemy;
  }
  events.push({ type: 'bossPhaseShifted', at, enemy: index });
  return { ...enemy, phase2: true, guard: enemy.stun === null ? enemy.maxGuard : enemy.guard };
}

function counterAttack(battle: Battle, events: Events): Battle {
  const step = currentAttack(battle);
  const counter = step.counter!;
  const hero = heroProfile(battle);
  const modifiers = heroModifiers(battle);
  const blow = counterBlow({
    attackPower: hero.attackPower + modifiers.attackFlat,
    guardDamage: hero.guardDamage,
    counterPercent: hero.counterPercent,
    stunned: battle.enemies[step.enemy]!.stun !== null,
    attackPercents: modifiers.attackPercents,
    guardPercents: modifiers.guardDamagePercents,
    counterPercents: modifiers.counterPercents,
    stunnedBonusPercent: modifiers.stunnedBonusPercent,
  });
  events.push({
    type: 'counterAttacked',
    at: counter.at,
    enemy: step.enemy,
    damage: blow.hp,
    guardDamage: blow.guard,
    until: counter.until,
  });
  const countered = withStep(battle, { ...step, counter: { ...counter, done: true } });
  const hit = hitEnemy(countered, events, step.enemy, blow, { at: counter.at, by: 'counter' });
  return hit.broken ? startHitStop(hit.battle, events, counter.at) : hit.battle;
}

function attackEnd(step: AttackStep): number {
  return Math.max(step.resolvedAt, step.counter?.until ?? step.resolvedAt);
}

/** La fin du tour d'un ennemi : la victoire (une contre-attaque a fait tomber le dernier), ou la suite. */
function endEnemyStep(battle: Battle, events: Events): Battle {
  const step = enemyStep(battle);
  const at = step.kind === 'attack' ? attackEnd(step) : (step as { readonly until: number }).until;
  if (isWon(battle)) return finish(battle, events, 'victory', at);
  return nextTurn(battle, events, at);
}

// ---------------------------------------------------------------------------------------------
// Commandes du joueur

function ignored(
  update: BattleUpdate,
  at: number,
  button: PlayerButton,
  reason: IgnoredReason,
): BattleUpdate {
  return {
    battle: update.battle,
    events: [...update.events, { type: 'pressIgnored', at, button, reason }],
  };
}

function startOffBalance(battle: Battle, events: Events, at: number): Battle {
  const until = at + OFF_BALANCE_MS;
  events.push({ type: 'offBalanceStarted', at, until });
  return { ...battle, offBalanceUntil: until };
}

function whiff(
  battle: Battle,
  events: Events,
  button: DefenseButton,
  reason: WhiffReason,
  at: number,
): Battle {
  events.push({ type: 'whiffed', at, button, reason });
  return startOffBalance(battle, events, at);
}

/**
 * L'arrêt sur image (parade parfaite, frappe parfaite, cassure) : le temps du combat s'arrête,
 * toutes les échéances qui suivent sont décalées. Une seule fois par instant : chaque cas ne
 * l'appelle qu'une fois (une frappe parfaite qui brise la garde n'en lance qu'un).
 */
function startHitStop(battle: Battle, events: Events, at: number): Battle {
  const until = at + HIT_STOP_MS;
  events.push({ type: 'hitStopStarted', at, until });
  const later = (instant: number) => (instant >= at ? instant + HIT_STOP_MS : instant);
  const stopped = { ...battle, hitStop: { at, until } };
  const { phase } = battle;
  if (phase.kind === 'heroStrike') {
    return {
      ...stopped,
      phase: { ...phase, impactAt: later(phase.impactAt), until: later(phase.until) },
    };
  }
  const step = currentAttack(battle);
  return withStep(stopped, {
    ...step,
    feintAt: step.feintAt === null ? null : later(step.feintAt),
    impacts: step.impacts.map((impact) => ({ ...impact, at: later(impact.at) })),
    resolvedAt: later(step.resolvedAt),
    counter:
      step.counter === null
        ? null
        : { ...step.counter, at: later(step.counter.at), until: later(step.counter.until) },
  });
}

function gainMomentumAt(battle: Battle, events: Events, at: number): Battle {
  const momentum = gainMomentum(battle.hero.momentum);
  if (momentum === battle.hero.momentum) return battle;
  events.push({ type: 'momentumChanged', at, momentum });
  return { ...battle, hero: { ...battle.hero, momentum } };
}

function judgeDefense(battle: Battle, events: Events, button: DefenseButton, at: number): Battle {
  const step = enemyStep(battle);
  const index =
    step.kind === 'attack'
      ? step.impacts.findIndex((impact) => impact.outcome === null && !impact.lost)
      : -1;
  if (step.kind !== 'attack' || index < 0) return whiff(battle, events, button, 'empty', at);

  const delta = pressDelta(at, battle.inputOffset, step.impacts[index]!.at);
  const judgement = judgePress(delta);
  if (judgement === 'miss') return whiff(battle, events, button, delta < 0 ? 'early' : 'late', at);

  const blow = { index, button, delta, at };
  if (button === 'dodge') {
    return afterDodge(
      resolveBlow(battle, events, { ...blow, outcome: 'dodge', damage: 0 }),
      events,
      at,
    );
  }
  if (ATTACKS[step.attack].perilous) {
    // Une parade sur un coup imparable échoue : dégâts entiers et déséquilibre (C8).
    const hurt = resolveBlow(battle, events, {
      ...blow,
      outcome: 'perilousParry',
      damage: heroDamage(battle, step.damage),
    });
    return hurt.phase.kind === 'over' ? hurt : startOffBalance(hurt, events, at);
  }
  if (judgement === 'good') {
    return resolveBlow(battle, events, {
      ...blow,
      outcome: 'parry',
      damage: heroDamage(battle, step.damage, GOOD_PARRY_PERCENT),
    });
  }
  const parried = startHitStop(
    gainMomentumAt(
      healOnPerfectParry(
        resolveBlow(battle, events, { ...blow, outcome: 'perfectParry', damage: 0 }),
      ),
      events,
      at,
    ),
    events,
    at,
  );
  const attack = currentAttack(parried);
  if (!attack.impacts.every((impact) => impact.outcome === 'perfectParry')) return parried;
  // Tous les impacts parés parfaitement : contre-attaque, à la fin de l'arrêt sur image (C8).
  const counterAt = at + HIT_STOP_MS;
  return withStep(parried, {
    ...attack,
    counter: { at: counterAt, until: counterAt + COUNTER_MS, done: false },
  });
}

/** Le Bouclier du veilleur (prototype #93) : des PV rendus, sans dépasser les PV max. */
function healOnPerfectParry(battle: Battle): Battle {
  const { hero } = battle;
  const hp = Math.min(hero.maxHp, hero.hp + heroModifiers(battle).healOnPerfectParry);
  return hp === hero.hp ? battle : { ...battle, hero: { ...hero, hp } };
}

/**
 * Après une esquive (prototype #90) : le trait de l'Errante (+1 Élan), puis Pas de l'ombre, qui
 * contre-attaque quand tous les impacts du coup sont esquivés (P11) et prend fin.
 */
function afterDodge(battle: Battle, events: Events, at: number): Battle {
  const dodged = heroProfile(battle).dodgeMomentum ? gainMomentumAt(battle, events, at) : battle;
  const attack = currentAttack(dodged);
  if (dodged.hero.shadowStep !== true) return dodged;
  if (!attack.impacts.every((impact) => impact.outcome === 'dodge')) return dodged;
  return withStep(
    { ...dodged, hero: { ...dodged.hero, shadowStep: false } },
    { ...attack, counter: { at, until: at + COUNTER_MS, done: false } },
  );
}

/** L'instant d'un appui : jamais avant l'état du moteur ; pendant un arrêt sur image, son début. */
function datePress(battle: Battle, at: number): number {
  if (battle.hitStop !== null && at < battle.hitStop.until && at >= battle.hitStop.at) {
    return battle.hitStop.at;
  }
  return Math.max(at, battle.now);
}

/** Pendant une transition de phase ou la bulle d'aide, un toucher est ignoré sans effet (C12). */
function isDeadTime(battle: Battle): boolean {
  return battle.phase.kind === 'transition' || battle.phase.kind === 'defenseHint';
}

/**
 * Un appui sur « Parade » ou « Esquive », daté à l'instant du toucher (C7, C9, C12). Il est
 * ignoré pendant une transition de phase, sans déséquilibre ni mémoire, et relance le déséquilibre
 * en cours. Hors d'une fenêtre de parade, c'est un appui raté.
 */
export function pressDefense(
  battle: Battle,
  { button, at }: { readonly button: DefenseButton; readonly at: number },
): BattleUpdate {
  const pressedAt = datePress(battle, at);
  const advanced = advance(battle, pressedAt);
  if (isDeadTime(advanced.battle)) return ignored(advanced, pressedAt, button, 'phaseTransition');
  if (advanced.battle.phase.kind !== 'enemy') {
    return ignored(advanced, pressedAt, button, 'notAvailable');
  }
  const events = [...advanced.events];
  if (isOffBalanceAt(advanced.battle, pressedAt)) {
    // Marteler prolonge : l'appui est ignoré et le déséquilibre repart de lui (C9).
    events.push({ type: 'pressIgnored', at: pressedAt, button, reason: 'offBalance' });
    return { battle: startOffBalance(advanced.battle, events, pressedAt), events };
  }
  return { battle: judgeDefense(advanced.battle, events, button, pressedAt), events };
}

/**
 * La frappe en rythme résolue à l'instant `at` (C6) : PV et garde retirés selon le multiplicateur
 * de frappe et l'étourdissement ; arrêt sur image pour une frappe parfaite ou une cassure.
 */
function resolveStrike(battle: Battle, events: Events, at: number): Battle {
  const phase = battle.phase as StrikePhase;
  const hero = heroProfile(battle);
  const hit = phase.hit ?? 1;
  const judgement = phase.press?.judgement ?? null;
  const modifiers = heroModifiers(battle);
  const blow = strikeBlow({
    attackPower: hero.attackPower + modifiers.attackFlat,
    guardDamage: hero.guardDamage,
    multiplier: strikeMultiplier(judgement, modifiers.perfectStrikeBonusPercents),
    stunned: battle.enemies[phase.enemy]!.stun !== null,
    attackPercents: modifiers.attackPercents,
    guardPercents: modifiers.guardDamagePercents,
    stunnedBonusPercent: modifiers.stunnedBonusPercent,
  });
  events.push({
    type: 'strikeResolved',
    at,
    enemy: phase.enemy,
    judgement,
    delta: phase.press?.delta ?? null,
    damage: blow.hp,
    guardDamage: blow.guard,
    ...(hero.hits > 1 && { hit }),
  });
  const struck = hitEnemy(
    { ...battle, phase: { ...phase, resolved: true } },
    events,
    phase.enemy,
    blow,
    { at, by: 'strike' },
  );
  const stopped = judgement === 'perfect' || struck.broken;
  const resolved = stopped ? startHitStop(struck.battle, events, at) : struck.battle;
  if (hit >= hero.hits || !isStanding(resolved.enemies[phase.enemy]!)) return resolved;
  // Le coup suivant (les Dagues jumelles), décalé par l'arrêt sur image ; perdu si la cible tombe.
  const impactAt = phase.impactAt + hero.hitIntervalMs + (stopped ? HIT_STOP_MS : 0);
  return startStrike(resolved, events, { enemy: phase.enemy, at, impactAt, hit: hit + 1 });
}

/** Un coup de la frappe en rythme commence : son impact, et sa récupération après la fenêtre. */
function startStrike(
  battle: Battle,
  events: Events,
  {
    enemy,
    at,
    impactAt,
    hit,
  }: {
    readonly enemy: number;
    readonly at: number;
    readonly impactAt: number;
    readonly hit: number;
  },
): Battle {
  const until = missDeadline(impactAt, battle.inputOffset) + STRIKE_RECOVERY_MS;
  const multiple = heroProfile(battle).hits > 1;
  events.push({ type: 'strikeStarted', at, enemy, impactAt, until, ...(multiple && { hit }) });
  return {
    ...battle,
    phase: {
      kind: 'heroStrike',
      enemy,
      since: at,
      impactAt,
      press: null,
      resolved: false,
      until,
      ...(multiple && { hit }),
    },
  };
}

/**
 * Un appui sur « Frapper », daté à l'instant du toucher (C6.1) : seul le premier appui de la
 * frappe compte. Avant l'impact, il est jugé à l'impact ; après, aussitôt. Il ne déséquilibre
 * jamais.
 */
export function pressStrike(battle: Battle, { at }: { readonly at: number }): BattleUpdate {
  const pressedAt = datePress(battle, at);
  const advanced = advance(battle, pressedAt);
  const { phase } = advanced.battle;
  if (isDeadTime(advanced.battle)) {
    return ignored(advanced, pressedAt, 'strike', 'phaseTransition');
  }
  if (phase.kind !== 'heroStrike' || phase.resolved || phase.press !== null) {
    return ignored(advanced, pressedAt, 'strike', 'notAvailable');
  }
  const delta = pressDelta(pressedAt, advanced.battle.inputOffset, phase.impactAt);
  const pressed = {
    ...advanced.battle,
    phase: { ...phase, press: { at: pressedAt, delta, judgement: judgePress(delta) } },
  };
  const events = [...advanced.events];
  if (pressedAt < phase.impactAt) return { battle: pressed, events };
  return { battle: resolveStrike(pressed, events, pressedAt), events };
}

/** L'action du héros commence : elle compte pour C5.3, et le héros est le dernier à jouer. */
function startHeroAction(battle: Battle, phase: BattlePhase): Battle {
  return { ...battle, phase, heroActions: battle.heroActions + 1, lastPlayed: 'hero' };
}

function attack(battle: Battle, events: Events, at: number): Battle {
  const struck = startStrike(battle, events, {
    enemy: battle.target,
    at,
    impactAt: at + STRIKE_WIND_UP_MS,
    hit: 1,
  });
  return gainMomentumAt(startHeroAction(struck, struck.phase), events, at);
}

function activatePower(battle: Battle, events: Events, power: PowerKind, at: number): Battle {
  const until = at + HERO_ACTION_MS;
  const momentum = battle.hero.momentum - POWERS[power].cost;
  events.push({ type: 'powerUsed', at, power, until });
  events.push({ type: 'momentumChanged', at, momentum });
  const hero =
    power === 'shadowStep'
      ? { ...battle.hero, momentum, shadowStep: true }
      : { ...battle.hero, momentum, bulwark: true };
  return startHeroAction({ ...battle, hero }, { kind: 'heroPower', power, since: at, until });
}

/**
 * Une action de la phase du héros (C3, C4) : viser un ennemi, « Attaquer » (la frappe en rythme
 * commence) ou un pouvoir, s'il reste assez d'Élan. Elle se valide au relâcher (`releasedAt`),
 * seulement si le toucher a commencé dans la phase du héros (C12).
 */
export function heroAction(
  battle: Battle,
  {
    action,
    touchStartedAt,
    releasedAt,
  }: { readonly action: HeroAction; readonly touchStartedAt: number; readonly releasedAt: number },
): BattleUpdate {
  const at = Math.max(releasedAt, battle.now);
  const advanced = advance(battle, at);
  const { phase } = advanced.battle;
  if (isDeadTime(advanced.battle)) return ignored(advanced, at, action.kind, 'phaseTransition');
  if (phase.kind !== 'hero') return ignored(advanced, at, action.kind, 'notAvailable');
  if (touchStartedAt < phase.since) return ignored(advanced, at, action.kind, 'touchTooEarly');

  const events = [...advanced.events];
  const current = advanced.battle;
  switch (action.kind) {
    case 'target': {
      const enemy = current.enemies[action.enemy];
      if (enemy === undefined || !isStanding(enemy)) {
        return ignored(advanced, at, 'target', 'notAvailable');
      }
      if (action.enemy !== current.target) {
        events.push({ type: 'targetChanged', at, enemy: action.enemy });
      }
      return { battle: { ...current, target: action.enemy }, events };
    }
    case 'power':
      // Seul le pouvoir du héros, avec assez d'Élan ; Pas de l'ombre est indisponible s'il est actif.
      if (
        action.power !== heroProfile(current).power ||
        missingMomentum(current.hero.momentum, action.power) > 0 ||
        (action.power === 'shadowStep' && current.hero.shadowStep === true)
      ) {
        return ignored(advanced, at, 'power', 'notAvailable');
      }
      return { battle: activatePower(current, events, action.power, at), events };
    case 'attack':
      return { battle: attack(current, events, at), events };
  }
}

/** La fermeture de la bulle d'aide de la phase ennemie : la transition de phase commence (C12). */
export function dismissDefenseHint(battle: Battle, at: number): BattleUpdate {
  const dismissedAt = Math.max(at, battle.now);
  const advanced = advance(battle, dismissedAt);
  if (advanced.battle.phase.kind !== 'defenseHint') return advanced;
  const events = [...advanced.events];
  const shown = { ...advanced.battle, defenseHintPending: false };
  return { battle: startTransition(shown, events, 'enemy', dismissedAt), events };
}

// ---------------------------------------------------------------------------------------------
// Reprise

/** Décale de `delta` ms les instants d'une étape ennemie. */
function shiftStep(step: EnemyStep, delta: number): EnemyStep {
  if (step.kind !== 'attack')
    return { ...step, since: step.since + delta, until: step.until + delta };
  return {
    ...step,
    startedAt: step.startedAt + delta,
    feintAt: step.feintAt === null ? null : step.feintAt + delta,
    feintShown: false,
    // Un impact déjà jugé garde son issue : il n'est pas rejugé.
    impacts: step.impacts.map((impact) => ({
      ...impact,
      at: impact.at + delta,
      landed: impact.outcome !== null,
      lost: impact.outcome === null ? false : impact.lost,
    })),
    resolvedAt: step.resolvedAt + delta,
    counter:
      step.counter === null
        ? null
        : { ...step.counter, at: step.counter.at + delta, until: step.counter.until + delta },
  };
}

function stepStart(step: EnemyStep): number {
  return step.kind === 'attack' ? step.startedAt : step.since;
}

function resumedPhase(phase: BattlePhase, at: number): BattlePhase {
  switch (phase.kind) {
    case 'hero':
    case 'defenseHint':
      return { ...phase, since: at };
    case 'heroStrike': {
      if (phase.resolved) return { ...phase, until: at };
      const delta = at - phase.since;
      return {
        ...phase,
        since: at,
        impactAt: phase.impactAt + delta,
        until: phase.until + delta,
        press: null,
      };
    }
    case 'heroPower':
    case 'transition':
      return { ...phase, since: at, until: at + phase.until - phase.since };
    case 'enemy':
      return { kind: 'enemy', step: shiftStep(phase.step, at - stepStart(phase.step)) };
    default:
      // Un combat fini reste fini.
      return phase;
  }
}

/**
 * La reprise d'un combat sauvegardé (P32), à l'instant `at` : l'action en cours repart du début
 * de sa préparation, avec le même tirage ; un impact déjà jugé reste acquis. Le déséquilibre,
 * l'arrêt sur image et l'animation du retour en garde sont effacés. Les instants sauvés ne valent
 * rien après un redémarrage (base monotone) : tout repart de `at`.
 */
export function resumeBattle(battle: Battle, at: number): Battle {
  return {
    ...battle,
    now: at,
    offBalanceUntil: null,
    hitStop: null,
    enemies: battle.enemies.map((enemy) => ({ ...enemy, guardRestore: null })),
    phase: resumedPhase(battle.phase, at),
  };
}
