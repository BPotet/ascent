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
import { actionOrder, type Actor } from './actionOrder';
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
  GOOD_PARRY_PERCENT,
  MAX_DAMAGE_REDUCTION_PERCENT,
  SENTINEL,
  TRIAL_BATTLE_ENEMIES,
  type EnemyKind,
} from './combatants';
import {
  GUARD_RESTORE_MS,
  LOST_ACTION_MS,
  blowOnEnemy,
  isRestoreDue,
  restoreGuard,
  type Stunned,
} from './guard';
import { drawIntent, raisedHp, type GuardIntent, type Intent, type RaiseIntent } from './intents';
import {
  BULWARK_DAMAGE_PERCENT,
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

export interface HeroState {
  readonly hp: number;
  readonly maxHp: number;
  /** L'Élan (`Momentum`), de 0 à 5. */
  readonly momentum: number;
  /** Le Rempart est actif : le prochain coup subi fait 50 % de dégâts en moins. */
  readonly bulwark: boolean;
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
  readonly hero: HeroState;
  readonly enemies: readonly EnemyState[];
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
}

/**
 * Le combat d'essai : la Sentinelle contre la Goule, le Spectre et le Nécromancien, en phase du
 * héros (C1).
 */
export function startTrialBattle({
  seed,
  tuning,
  defenseHint,
  at,
  inputOffset = 0,
}: TrialBattleOptions): BattleUpdate {
  const events: Events = [];
  const enemies = TRIAL_BATTLE_ENEMIES.map((kind): EnemyState => ({
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
  }));
  const battle = startRound(
    {
      now: at,
      random: seedRandom(seed),
      tuning,
      inputOffset,
      round: 0,
      hero: { hp: SENTINEL.maxHp, maxHp: SENTINEL.maxHp, momentum: MOMENTUM_START, bulwark: false },
      enemies,
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
  events.push({ type: 'heroPhaseStarted', at, announced: false });
  return { battle, events };
}

// ---------------------------------------------------------------------------------------------
// Lecture

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

function startRound(battle: Battle, events: Events, at: number): Battle {
  let random = battle.random;
  // Tous les tirages au début de la manche, ennemis debout de gauche à droite (C2.1).
  const enemies = battle.enemies.map((enemy, index) => {
    if (!isStanding(enemy)) return enemy;
    const drawn = drawIntent(enemy.kind, random, {
      fallenAlly: fallenAlly(battle, index),
      stunned: enemy.stun !== null,
      guardDamaged: enemy.guard < enemy.maxGuard,
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
    turn: { order: actionOrder(enemies), position: 0 },
  };
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
    const restored = { ...restoreGuard(state), intent: null, guardRestore: { since: at, until } };
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

/** Le répit (C11) : +10 % des PV max à la victoire, sans dépasser le maximum. */
export const RESPITE_PERCENT = 10;

function finish(battle: Battle, events: Events, outcome: BattleOutcome, at: number): Battle {
  let settled = clearOffBalance(battle, events, at);
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
    return { ...restoreGuard(enemy), guardRestore: { since: at, until } };
  });
  const restored = { ...battle, enemies };
  if (standingEnemies(restored).length === 0) return finish(restored, events, 'victory', at);
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
  const resolved = withStep(
    { ...battle, hero: { ...battle.hero, hp: heroHp, bulwark } },
    withImpact(step, blow.index, { outcome: blow.outcome }),
  );
  return heroHp === 0 ? finish(resolved, events, 'defeat', blow.at) : resolved;
}

/**
 * Les dégâts subis par le héros : réduction des dégâts (plafonnée à 40 %), puis le Rempart s'il
 * est actif ; un seul arrondi.
 */
function heroDamage(battle: Battle, damage: number, ...percents: readonly number[]): number {
  const reduction = 100 - Math.min(SENTINEL.damageReductionPercent, MAX_DAMAGE_REDUCTION_PERCENT);
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
  const damaged = withEnemy(battle, index, hit.enemy);
  if (hit.broken)
    events.push({ type: 'guardBroken', at: context.at, enemy: index, by: context.by });
  if (!hit.fallen) return { battle: damaged, broken: hit.broken };
  events.push({ type: 'enemyDefeated', at: context.at, enemy: index });
  const [next] = standingEnemies(damaged);
  if (battle.target !== index || next === undefined) return { battle: damaged, broken: false };
  events.push({ type: 'targetChanged', at: context.at, enemy: next });
  return { battle: { ...damaged, target: next }, broken: false };
}

function counterAttack(battle: Battle, events: Events): Battle {
  const step = currentAttack(battle);
  const counter = step.counter!;
  const blow = counterBlow({
    attackPower: SENTINEL.attackPower,
    guardDamage: SENTINEL.guardDamage,
    counterPercent: SENTINEL.counterPercent,
    stunned: battle.enemies[step.enemy]!.stun !== null,
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
  if (standingEnemies(battle).length === 0) return finish(battle, events, 'victory', at);
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
  if (button === 'dodge')
    return resolveBlow(battle, events, { ...blow, outcome: 'dodge', damage: 0 });
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
      resolveBlow(battle, events, { ...blow, outcome: 'perfectParry', damage: 0 }),
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
  const judgement = phase.press?.judgement ?? null;
  const blow = strikeBlow({
    attackPower: SENTINEL.attackPower,
    guardDamage: SENTINEL.guardDamage,
    multiplier: strikeMultiplier(judgement),
    stunned: battle.enemies[phase.enemy]!.stun !== null,
  });
  events.push({
    type: 'strikeResolved',
    at,
    enemy: phase.enemy,
    judgement,
    delta: phase.press?.delta ?? null,
    damage: blow.hp,
    guardDamage: blow.guard,
  });
  const hit = hitEnemy(
    { ...battle, phase: { ...phase, resolved: true } },
    events,
    phase.enemy,
    blow,
    { at, by: 'strike' },
  );
  return judgement === 'perfect' || hit.broken ? startHitStop(hit.battle, events, at) : hit.battle;
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
  const impactAt = at + STRIKE_WIND_UP_MS;
  const until = missDeadline(impactAt, battle.inputOffset) + STRIKE_RECOVERY_MS;
  events.push({ type: 'strikeStarted', at, enemy: battle.target, impactAt, until });
  const striking = startHeroAction(battle, {
    kind: 'heroStrike',
    enemy: battle.target,
    since: at,
    impactAt,
    press: null,
    resolved: false,
    until,
  });
  return gainMomentumAt(striking, events, at);
}

function activatePower(battle: Battle, events: Events, power: PowerKind, at: number): Battle {
  const until = at + HERO_ACTION_MS;
  const momentum = battle.hero.momentum - POWERS[power].cost;
  events.push({ type: 'powerUsed', at, power, until });
  events.push({ type: 'momentumChanged', at, momentum });
  return startHeroAction(
    { ...battle, hero: { ...battle.hero, momentum, bulwark: true } },
    { kind: 'heroPower', power, since: at, until },
  );
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
      if (missingMomentum(current.hero.momentum, action.power) > 0) {
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
