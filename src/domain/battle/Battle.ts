/**
 * Le moteur du combat (#31, règles C1, C4, C7 à C12) : un moteur déterministe, piloté par les
 * échéances. Il reçoit des instants (en ms, sur une base monotone) et une graine du combat, et
 * renvoie un nouvel état et les événements de combat datés de leur instant nominal. Aucune
 * horloge ni aucun hasard caché : le temps et le hasard passent par la session (ports
 * `BattleClock` et `SeedSource`).
 */
import { ATTACKS, type AttackKind } from './attacks';
import type {
  BattleEvent,
  BattleOutcome,
  BlowOutcome,
  DefenseButton,
  IgnoredReason,
  PhaseDirection,
  WhiffReason,
} from './BattleEvent';
import {
  COUNTER_BASE_PERCENT,
  ENEMIES,
  GOOD_PARRY_PERCENT,
  SENTINEL,
  TRIAL_BATTLE_ENEMIES,
  type EnemyKind,
} from './combatants';
import { drawIntent, type Intent } from './intents';
import {
  COUNTER_MS,
  HERO_ACTION_MS,
  HIT_STOP_MS,
  OFF_BALANCE_MS,
  judgePress,
  missDeadline,
  pressDelta,
  scaleDamage,
} from './rules';
import { seedRandom, type BattleSeed, type RandomState } from './SeededRandom';
import type { TrialTuning } from './TrialTuning';

export interface HeroState {
  readonly hp: number;
  readonly maxHp: number;
}

export interface EnemyState {
  readonly kind: EnemyKind;
  readonly hp: number;
  readonly maxHp: number;
  /** L'intention tirée au début de la manche. */
  readonly intent: Intent;
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

/** L'avancée (`StepIn`) d'un ennemi, avant sa préparation. */
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

export type BattlePhase =
  | { readonly kind: 'hero'; readonly since: number }
  | { readonly kind: 'heroAction'; readonly since: number; readonly until: number }
  | { readonly kind: 'defenseHint'; readonly since: number }
  | {
      readonly kind: 'transition';
      readonly to: PhaseDirection;
      readonly since: number;
      readonly until: number;
    }
  | {
      readonly kind: 'enemy';
      /** Les ennemis qui attaqueront ensuite, de gauche à droite. */
      readonly waiting: readonly number[];
      readonly step: StepInStep | AttackStep;
    }
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
  { readonly kind: 'attack' } | { readonly kind: 'target'; readonly enemy: number };

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

/** Le combat d'essai : la Sentinelle contre une Goule et un Spectre, en phase du héros (C1). */
export function startTrialBattle({
  seed,
  tuning,
  defenseHint,
  at,
  inputOffset = 0,
}: TrialBattleOptions): BattleUpdate {
  const events: Events = [];
  const enemies = TRIAL_BATTLE_ENEMIES.map((kind) => ({
    kind,
    hp: ENEMIES[kind].maxHp,
    maxHp: ENEMIES[kind].maxHp,
    // Remplacée par le premier tirage de la manche, ci-dessous.
    intent: { attack: 'basic', damage: 0, windUpMs: 0, feintFraction: 0 } as const,
  }));
  let battle: Battle = {
    now: at,
    random: seedRandom(seed),
    tuning,
    inputOffset,
    round: 0,
    hero: { hp: SENTINEL.maxHp, maxHp: SENTINEL.maxHp },
    enemies,
    target: 0,
    phase: { kind: 'hero', since: at },
    offBalanceUntil: null,
    hitStop: null,
    defenseHintPending: defenseHint,
  };
  battle = startRound(battle, events, at);
  events.push({ type: 'heroPhaseStarted', at });
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
    deadlines.push({
      at: Math.max(step.resolvedAt, step.counter?.until ?? step.resolvedAt),
      awaitsPress: false,
      apply: endAttack,
    });
  }
  return deadlines;
}

function deadlinesOf(battle: Battle): Deadline[] {
  const deadlines: Deadline[] = [];
  if (battle.offBalanceUntil !== null) {
    deadlines.push({ at: battle.offBalanceUntil, awaitsPress: false, apply: endOffBalance });
  }
  const { phase } = battle;
  if (phase.kind === 'heroAction') {
    deadlines.push({ at: phase.until, awaitsPress: false, apply: endHeroAction });
  } else if (phase.kind === 'transition') {
    deadlines.push({ at: phase.until, awaitsPress: false, apply: endTransition });
  } else if (phase.kind === 'enemy') {
    const { step } = phase;
    deadlines.push(
      ...(step.kind === 'stepIn'
        ? [{ at: step.until, awaitsPress: false, apply: startAttack }]
        : attackDeadlines(battle, step)),
    );
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
// Déroulé

function startRound(battle: Battle, events: Events, at: number): Battle {
  let random = battle.random;
  // Tous les tirages au début de la manche, ennemis debout de gauche à droite (C10).
  const enemies = battle.enemies.map((enemy) => {
    if (!isStanding(enemy)) return enemy;
    const drawn = drawIntent(enemy.kind, random);
    random = drawn.random;
    return { ...enemy, intent: drawn.intent };
  });
  const round = battle.round + 1;
  events.push({ type: 'roundStarted', at, round });
  return { ...battle, enemies, random, round };
}

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

function finish(battle: Battle, events: Events, outcome: BattleOutcome, at: number): Battle {
  const settled = clearOffBalance(battle, events, at);
  events.push({ type: 'battleEnded', at, outcome });
  return { ...settled, phase: { kind: 'over', outcome, at } };
}

function startTransition(battle: Battle, events: Events, to: PhaseDirection, at: number): Battle {
  const settled = clearOffBalance(battle, events, at);
  const until = at + battle.tuning.phaseTransitionMs;
  events.push({ type: 'phaseTransitionStarted', at, to, until });
  const transition: Battle = { ...settled, phase: { kind: 'transition', to, since: at, until } };
  // Vers la phase du héros, une nouvelle manche commence : ses intentions s'affichent.
  return to === 'hero' ? startRound(transition, events, at) : transition;
}

function endHeroAction(battle: Battle, events: Events): Battle {
  const at = (battle.phase as { readonly until: number }).until;
  if (standingEnemies(battle).length === 0) return finish(battle, events, 'victory', at);
  if (battle.defenseHintPending) {
    events.push({ type: 'defenseHintShown', at });
    return { ...battle, phase: { kind: 'defenseHint', since: at } };
  }
  return startTransition(battle, events, 'enemy', at);
}

function startStepIn(
  battle: Battle,
  events: Events,
  attackers: readonly number[],
  at: number,
): Battle {
  const [enemy, ...waiting] = attackers as [number, ...number[]];
  const until = at + battle.tuning.stepInMs;
  events.push({ type: 'stepInStarted', at, enemy, until });
  return {
    ...battle,
    phase: { kind: 'enemy', waiting, step: { kind: 'stepIn', enemy, since: at, until } },
  };
}

function endTransition(battle: Battle, events: Events): Battle {
  const phase = battle.phase as Extract<BattlePhase, { kind: 'transition' }>;
  if (phase.to === 'hero') {
    events.push({ type: 'heroPhaseStarted', at: phase.until });
    return { ...battle, phase: { kind: 'hero', since: phase.until } };
  }
  // Les ennemis debout attaquent un par un, de gauche à droite (C1).
  return startStepIn(battle, events, standingEnemies(battle), phase.until);
}

function enemyPhase(battle: Battle): Extract<BattlePhase, { kind: 'enemy' }> {
  return battle.phase as Extract<BattlePhase, { kind: 'enemy' }>;
}

function withStep(battle: Battle, step: AttackStep): Battle {
  return { ...battle, phase: { ...enemyPhase(battle), step } };
}

function currentAttack(battle: Battle): AttackStep {
  return enemyPhase(battle).step as AttackStep;
}

function startAttack(battle: Battle, events: Events): Battle {
  const phase = enemyPhase(battle);
  const { enemy, until: at } = phase.step as StepInStep;
  const { intent } = battle.enemies[enemy]!;
  const profile = ATTACKS[intent.attack];
  const impacts = profile.hitOffsetsMs.map((offset) => at + intent.windUpMs + offset);
  const feintAt = profile.feint ? at + Math.round(intent.windUpMs * intent.feintFraction) : null;
  events.push({
    type: 'windUpStarted',
    at,
    enemy,
    attack: intent.attack,
    impacts,
    feintAt,
  });
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

/** Le résultat d'un impact : dégâts au héros, puis défaite s'il tombe. */
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
  const resolved = withStep(
    { ...battle, hero: { ...battle.hero, hp: heroHp } },
    withImpact(step, blow.index, { outcome: blow.outcome }),
  );
  return heroHp === 0 ? finish(resolved, events, 'defeat', blow.at) : resolved;
}

function reducedDamage(damage: number, ...percents: readonly number[]): number {
  return scaleDamage(damage, ...percents, 100 - SENTINEL.damageReductionPercent);
}

function sufferImpact(battle: Battle, events: Events, index: number): Battle {
  const step = currentAttack(battle);
  return resolveBlow(battle, events, {
    index,
    outcome: 'suffered',
    button: null,
    delta: null,
    damage: reducedDamage(step.damage),
    at: missDeadline(step.impacts[index]!.at, battle.inputOffset),
  });
}

/** Des dégâts à un ennemi ; à 0 PV il tombe, et la cible passe au premier ennemi debout (C4). */
function damageEnemy(
  battle: Battle,
  events: Events,
  index: number,
  damage: number,
  at: number,
): Battle {
  const enemies = battle.enemies.map((enemy, position) =>
    position === index ? { ...enemy, hp: Math.max(0, enemy.hp - damage) } : enemy,
  );
  const damaged = { ...battle, enemies };
  if (isStanding(enemies[index]!)) return damaged;
  events.push({ type: 'enemyDefeated', at, enemy: index });
  const [next] = standingEnemies(damaged);
  if (battle.target !== index || next === undefined) return damaged;
  events.push({ type: 'targetChanged', at, enemy: next });
  return { ...damaged, target: next };
}

function counterAttack(battle: Battle, events: Events): Battle {
  const step = currentAttack(battle);
  const counter = step.counter!;
  const damage = scaleDamage(SENTINEL.attackPower, COUNTER_BASE_PERCENT, SENTINEL.counterPercent);
  events.push({
    type: 'counterAttacked',
    at: counter.at,
    enemy: step.enemy,
    damage,
    until: counter.until,
  });
  const countered = withStep(battle, { ...step, counter: { ...counter, done: true } });
  return damageEnemy(countered, events, step.enemy, damage, counter.at);
}

function endAttack(battle: Battle, events: Events): Battle {
  const step = currentAttack(battle);
  const at = Math.max(step.resolvedAt, step.counter?.until ?? step.resolvedAt);
  if (standingEnemies(battle).length === 0) return finish(battle, events, 'victory', at);
  const attackers = enemyPhase(battle).waiting.filter((enemy) =>
    isStanding(battle.enemies[enemy]!),
  );
  // Entre deux ennemis, seulement l'avancée ; après le dernier, la transition vers le héros (C12).
  return attackers.length > 0
    ? startStepIn(battle, events, attackers, at)
    : startTransition(battle, events, 'hero', at);
}

// ---------------------------------------------------------------------------------------------
// Commandes du joueur

function ignored(
  update: BattleUpdate,
  at: number,
  button: DefenseButton | 'attack' | 'target',
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

/** L'arrêt sur image : le temps du combat s'arrête, toutes les échéances qui suivent sont décalées. */
function startHitStop(battle: Battle, events: Events, at: number): Battle {
  const until = at + HIT_STOP_MS;
  events.push({ type: 'hitStopStarted', at, until });
  const step = currentAttack(battle);
  const later = (instant: number) => (instant >= at ? instant + HIT_STOP_MS : instant);
  return withStep(
    { ...battle, hitStop: { at, until } },
    {
      ...step,
      feintAt: step.feintAt === null ? null : later(step.feintAt),
      impacts: step.impacts.map((impact) => ({ ...impact, at: later(impact.at) })),
      resolvedAt: later(step.resolvedAt),
    },
  );
}

function judgeDefense(battle: Battle, events: Events, button: DefenseButton, at: number): Battle {
  const step = enemyPhase(battle).step;
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
      damage: reducedDamage(step.damage),
    });
    return hurt.phase.kind === 'over' ? hurt : startOffBalance(hurt, events, at);
  }
  if (judgement === 'good') {
    return resolveBlow(battle, events, {
      ...blow,
      outcome: 'parry',
      damage: reducedDamage(step.damage, GOOD_PARRY_PERCENT),
    });
  }
  const parried = startHitStop(
    resolveBlow(battle, events, { ...blow, outcome: 'perfectParry', damage: 0 }),
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
  const { phase } = advanced.battle;
  if (phase.kind === 'transition' || phase.kind === 'defenseHint') {
    return ignored(advanced, pressedAt, button, 'phaseTransition');
  }
  if (phase.kind !== 'enemy') return ignored(advanced, pressedAt, button, 'notAvailable');
  const events = [...advanced.events];
  if (isOffBalanceAt(advanced.battle, pressedAt)) {
    // Marteler prolonge : l'appui est ignoré et le déséquilibre repart de lui (C9).
    events.push({ type: 'pressIgnored', at: pressedAt, button, reason: 'offBalance' });
    return { battle: startOffBalance(advanced.battle, events, pressedAt), events };
  }
  return { battle: judgeDefense(advanced.battle, events, button, pressedAt), events };
}

/**
 * Une action de la phase du héros (C4) : viser un ennemi ou « Attaquer ». Elle se valide au
 * relâcher (`releasedAt`), seulement si le toucher a commencé dans la phase du héros (C12).
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
  if (phase.kind === 'transition' || phase.kind === 'defenseHint') {
    return ignored(advanced, at, action.kind, 'phaseTransition');
  }
  if (phase.kind !== 'hero') return ignored(advanced, at, action.kind, 'notAvailable');
  if (touchStartedAt < phase.since) return ignored(advanced, at, action.kind, 'touchTooEarly');

  const events = [...advanced.events];
  const current = advanced.battle;
  if (action.kind === 'target') {
    const enemy = current.enemies[action.enemy];
    if (enemy === undefined || !isStanding(enemy)) {
      return ignored(advanced, at, 'target', 'notAvailable');
    }
    if (action.enemy !== current.target) {
      events.push({ type: 'targetChanged', at, enemy: action.enemy });
    }
    return { battle: { ...current, target: action.enemy }, events };
  }

  const damage = scaleDamage(SENTINEL.attackPower, 100);
  const until = at + HERO_ACTION_MS;
  events.push({ type: 'heroAttacked', at, enemy: current.target, damage, until });
  const attacked = damageEnemy(current, events, current.target, damage, at);
  return { battle: { ...attacked, phase: { kind: 'heroAction', since: at, until } }, events };
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
