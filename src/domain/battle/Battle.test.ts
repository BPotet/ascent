// Moteur du combat (#31) : chaque règle par un scénario daté à la ms, puis un balayage de graines.
import type { AttackKind } from './attacks';
import {
  advance,
  dismissDefenseHint,
  heroAction,
  nextDeadline,
  pressDefense,
  startTrialBattle,
  type Battle,
  type BattleUpdate,
} from './Battle';
import type { BattleEvent, DefenseButton } from './BattleEvent';
import { ATTACKS } from './attacks';
import { ENEMIES } from './combatants';
import { drawIntent, type Intent } from './intents';
import { seedRandom } from './SeededRandom';
import { DEFAULT_TRIAL_TUNING, type TrialTuning } from './TrialTuning';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

/** Une intention fixée pour un test : la préparation de base, la fausse amorce à 50 %. */
function fixedIntent(
  enemy: number,
  attack: AttackKind,
  overrides: Partial<Intent> = {},
): (battle: Battle) => Battle {
  return (battle) => {
    const kind = battle.enemies[enemy]!.kind;
    const move = ENEMIES[kind].moves.find((candidate) => candidate.attack === attack);
    const intent: Intent = {
      attack,
      damage: move?.damage ?? 5,
      windUpMs: ATTACKS[attack].windUpMs,
      feintFraction: 0.5,
      ...overrides,
    };
    return {
      ...battle,
      enemies: battle.enemies.map((current, index) =>
        index === enemy ? { ...current, intent } : current,
      ),
    };
  };
}

class BattlePlay {
  battle: Battle;
  readonly events: BattleEvent[] = [];
  /** Les événements produits par la dernière commande. */
  last: readonly BattleEvent[] = [];

  constructor(update: BattleUpdate) {
    this.battle = update.battle;
    this.record(update.events);
  }

  static start({
    seed = 7,
    tuning = DEFAULT_TRIAL_TUNING,
    defenseHint = false,
    at = 0,
    inputOffset = 0,
  }: {
    readonly seed?: number;
    readonly tuning?: TrialTuning;
    readonly defenseHint?: boolean;
    readonly at?: number;
    readonly inputOffset?: number;
  } = {}): BattlePlay {
    return new BattlePlay(startTrialBattle({ seed, tuning, defenseHint, at, inputOffset }));
  }

  private record(events: readonly BattleEvent[]): this {
    this.last = events;
    this.events.push(...events);
    return this;
  }

  private apply(update: BattleUpdate): this {
    this.battle = update.battle;
    return this.record(update.events);
  }

  /** Change l'état sans événement (intentions fixées par le test). */
  with(...changes: readonly ((battle: Battle) => Battle)[]): this {
    this.battle = changes.reduce((battle, change) => change(battle), this.battle);
    return this;
  }

  advance(until: number): this {
    return this.apply(advance(this.battle, until));
  }

  press(button: DefenseButton, at: number): this {
    return this.apply(pressDefense(this.battle, { button, at }));
  }

  attack(releasedAt: number, touchStartedAt = releasedAt - 50): this {
    return this.apply(
      heroAction(this.battle, { action: { kind: 'attack' }, touchStartedAt, releasedAt }),
    );
  }

  target(enemy: number, releasedAt: number, touchStartedAt = releasedAt - 50): this {
    return this.apply(
      heroAction(this.battle, { action: { kind: 'target', enemy }, touchStartedAt, releasedAt }),
    );
  }

  dismissHint(at: number): this {
    return this.apply(dismissDefenseHint(this.battle, at));
  }

  all<Type extends BattleEvent['type']>(type: Type): EventOf<Type>[] {
    return this.events.filter((event): event is EventOf<Type> => event.type === type);
  }

  lastOf<Type extends BattleEvent['type']>(type: Type): EventOf<Type> | undefined {
    return this.all(type).at(-1);
  }

  /** Les types des événements de la dernière commande. */
  lastTypes(): string[] {
    return this.last.map((event) => event.type);
  }
}

// Chronologie de référence (réglages par défaut, combat commencé à 0) : « Attaquer » relâché à
// 1 000 ms, attaque résolue à 1 500 ms, transition de phase jusqu'à 2 300 ms, avancée de la Goule
// jusqu'à 2 700 ms, puis sa préparation.
const ATTACK_AT = 1_000;
const HERO_ACTION_END = 1_500;
const ENEMY_PHASE_AT = 2_300;
const GHOUL_WIND_UP_AT = 2_700;

/** Le combat jusqu'à la préparation de la Goule, ses intentions et celles du Spectre fixées. */
function toGhoulWindUp(
  ghoul: AttackKind = 'basic',
  specter: AttackKind = 'delayed',
  options: Parameters<typeof BattlePlay.start>[0] = {},
): BattlePlay {
  return BattlePlay.start(options)
    .with(fixedIntent(0, ghoul), fixedIntent(1, specter))
    .attack(ATTACK_AT)
    .advance(GHOUL_WIND_UP_AT);
}

/** L'instant du premier impact d'un coup simple de la Goule, à préparation de base. */
const GHOUL_IMPACT = GHOUL_WIND_UP_AT + 1_100;
/** Le 1er impact de la double frappe de la Goule (préparation de base 1 000 ms). */
const DOUBLE_IMPACT = GHOUL_WIND_UP_AT + 1_000;

describe('startTrialBattle', () => {
  it('opposes the Sentinel to a Ghoul and a Specter, in the hero phase of round 1', () => {
    const play = BattlePlay.start({ at: 250 });

    expect(play.battle.hero).toEqual({ hp: 80, maxHp: 80 });
    expect(play.battle.enemies.map(({ kind, hp, maxHp }) => ({ kind, hp, maxHp }))).toEqual([
      { kind: 'ghoul', hp: 20, maxHp: 20 },
      { kind: 'specter', hp: 14, maxHp: 14 },
    ]);
    expect(play.battle.round).toBe(1);
    expect(play.battle.phase).toEqual({ kind: 'hero', since: 250 });
    expect(play.battle.now).toBe(250);
    expect(play.battle.offBalanceUntil).toBeNull();
    expect(play.battle.hitStop).toBeNull();
    expect(play.battle.inputOffset).toBe(0);
    expect(play.events).toEqual([
      { type: 'roundStarted', at: 250, round: 1 },
      { type: 'heroPhaseStarted', at: 250 },
    ]);
  });

  it('draws the intents of every enemy, from the seed', () => {
    const play = BattlePlay.start({ seed: 31 });
    const ghoul = drawIntent('ghoul', seedRandom(31));
    const specter = drawIntent('specter', ghoul.random);

    expect(play.battle.enemies.map((enemy) => enemy.intent)).toEqual([
      ghoul.intent,
      specter.intent,
    ]);
    expect(play.battle.random).toBe(specter.random);
  });

  it('keeps the input offset and the tuning it is given', () => {
    const tuning = { phaseTransitionMs: 1_000, stepInMs: 200 };
    const play = BattlePlay.start({ inputOffset: -20, tuning });

    expect(play.battle.inputOffset).toBe(-20);
    expect(play.battle.tuning).toBe(tuning);
  });

  it('waits for the player in the hero phase: no deadline', () => {
    expect(nextDeadline(BattlePlay.start().battle)).toBeNull();
    expect(BattlePlay.start().advance(60_000).last).toEqual([]);
  });
});

describe('the order of a round (C1, C12)', () => {
  it('resolves the hero attack, then the transition, then each enemy from left to right', () => {
    const play = toGhoulWindUp('basic', 'delayed').advance(20_000);

    const timeline = play.events.map((event) => `${event.type}@${event.at}`);
    expect(timeline).toEqual([
      'roundStarted@0',
      'heroPhaseStarted@0',
      'heroAttacked@1000',
      'phaseTransitionStarted@1500',
      'stepInStarted@2300',
      'windUpStarted@2700',
      'impactLanded@3800',
      'blowResolved@3960',
      // Entre deux ennemis : seulement l'avancée.
      'stepInStarted@3960',
      'windUpStarted@4360',
      'impactLanded@6060',
      'blowResolved@6220',
      'phaseTransitionStarted@6220',
      'roundStarted@6220',
      'heroPhaseStarted@7020',
    ]);
    expect(play.battle.round).toBe(2);
    expect(play.battle.phase).toEqual({ kind: 'hero', since: 7_020 });
  });

  it('announces each transition with its direction and its end', () => {
    const play = toGhoulWindUp().advance(20_000);

    expect(play.all('phaseTransitionStarted')).toEqual([
      { type: 'phaseTransitionStarted', at: 1_500, to: 'enemy', until: 2_300 },
      { type: 'phaseTransitionStarted', at: 6_220, to: 'hero', until: 7_020 },
    ]);
    expect(play.all('stepInStarted')).toEqual([
      { type: 'stepInStarted', at: 2_300, enemy: 0, until: 2_700 },
      { type: 'stepInStarted', at: 3_960, enemy: 1, until: 4_360 },
    ]);
  });

  it('starts the wind-up after the step-in, with its impacts and no feint for a basic attack', () => {
    const play = toGhoulWindUp('basic');

    expect(play.lastOf('windUpStarted')).toEqual({
      type: 'windUpStarted',
      at: 2_700,
      enemy: 0,
      attack: 'basic',
      impacts: [3_800],
      feintAt: null,
    });
    expect(play.battle.phase).toMatchObject({
      kind: 'enemy',
      waiting: [1],
      step: { kind: 'attack', enemy: 0, attack: 'basic', damage: 5, startedAt: 2_700 },
    });
  });

  it('draws new intents for the standing enemies at the start of the next round', () => {
    const play = toGhoulWindUp().advance(20_000);
    const ghoul = drawIntent('ghoul', BattlePlay.start().battle.random);
    const specter = drawIntent('specter', ghoul.random);

    expect(play.battle.enemies.map((enemy) => enemy.intent)).toEqual([
      ghoul.intent,
      specter.intent,
    ]);
  });

  it('places the first impact 2,000 ms after the hero attack, with the shortest wind-up', () => {
    const play = BattlePlay.start()
      .with(fixedIntent(0, 'double', { windUpMs: 800 }))
      .attack(ATTACK_AT)
      .advance(GHOUL_WIND_UP_AT);

    expect(play.lastOf('windUpStarted')?.impacts).toEqual([
      HERO_ACTION_END + 2_000,
      HERO_ACTION_END + 2_420,
    ]);
  });

  it('applies the trial tuning of the transition and of the step-in', () => {
    const play = BattlePlay.start({ tuning: { phaseTransitionMs: 1_000, stepInMs: 250 } })
      .with(fixedIntent(0, 'basic'))
      .attack(ATTACK_AT)
      .advance(4_000);

    expect(play.lastOf('phaseTransitionStarted')).toMatchObject({ at: 1_500, until: 2_500 });
    expect(play.lastOf('stepInStarted')).toMatchObject({ at: 2_500, until: 2_750 });
    expect(play.lastOf('windUpStarted')).toMatchObject({ at: 2_750 });
  });

  it('skips the dead enemies in the enemy phase', () => {
    const play = BattlePlay.start()
      .with(fixedIntent(1, 'delayed'), (battle) => ({
        ...battle,
        enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, hp: 10 } : enemy)),
      }))
      .attack(ATTACK_AT)
      .advance(GHOUL_WIND_UP_AT);

    expect(play.lastOf('enemyDefeated')).toEqual({ type: 'enemyDefeated', at: 1_000, enemy: 0 });
    expect(play.lastOf('stepInStarted')).toEqual({
      type: 'stepInStarted',
      at: ENEMY_PHASE_AT,
      enemy: 1,
      until: GHOUL_WIND_UP_AT,
    });
  });
});

describe('targeting (C4)', () => {
  it('targets the leftmost enemy at the start', () => {
    expect(BattlePlay.start().battle.target).toBe(0);
  });

  it('changes the target with a touch on an enemy, then attacks it', () => {
    const play = BattlePlay.start().target(1, 400);

    expect(play.last).toEqual([{ type: 'targetChanged', at: 400, enemy: 1 }]);
    expect(play.battle.target).toBe(1);

    play.attack(ATTACK_AT);
    expect(play.lastOf('heroAttacked')).toEqual({
      type: 'heroAttacked',
      at: ATTACK_AT,
      enemy: 1,
      damage: 10,
      until: HERO_ACTION_END,
    });
    expect(play.battle.enemies[1]!.hp).toBe(4);
    expect(play.battle.enemies[0]!.hp).toBe(20);
    expect(play.battle.phase).toEqual({
      kind: 'heroAction',
      since: ATTACK_AT,
      until: HERO_ACTION_END,
    });
  });

  it('keeps the target from one round to the next', () => {
    const play = BattlePlay.start().with(fixedIntent(0, 'basic'), fixedIntent(1, 'delayed'));
    play.target(1, 400).attack(ATTACK_AT).advance(20_000);

    expect(play.battle.round).toBe(2);
    expect(play.battle.target).toBe(1);
  });

  it('announces nothing when the touched enemy is already the target', () => {
    expect(BattlePlay.start().target(0, 400).last).toEqual([]);
  });

  it.each([
    ['a dead enemy', 0],
    ['an enemy that does not exist', 5],
  ])('ignores a touch on %s', (_, enemy) => {
    const play = BattlePlay.start().with((battle) => ({
      ...battle,
      enemies: battle.enemies.map((current, index) =>
        index === 0 ? { ...current, hp: 0 } : current,
      ),
      target: 1,
    }));

    play.target(enemy, 400);

    expect(play.last).toEqual([
      { type: 'pressIgnored', at: 400, button: 'target', reason: 'notAvailable' },
    ]);
    expect(play.battle.target).toBe(1);
  });

  it('targets the next standing enemy when the target falls', () => {
    const play = BattlePlay.start().with((battle) => ({
      ...battle,
      enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, hp: 10 } : enemy)),
    }));

    play.attack(ATTACK_AT);

    expect(play.last).toEqual([
      { type: 'heroAttacked', at: ATTACK_AT, enemy: 0, damage: 10, until: HERO_ACTION_END },
      { type: 'enemyDefeated', at: ATTACK_AT, enemy: 0 },
      { type: 'targetChanged', at: ATTACK_AT, enemy: 1 },
    ]);
    expect(play.battle.target).toBe(1);
  });

  it('keeps the target when another enemy falls', () => {
    const play = BattlePlay.start()
      .with(fixedIntent(0, 'basic'), (battle) => ({
        ...battle,
        enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, hp: 6 } : enemy)),
      }))
      .target(1, 400)
      .attack(ATTACK_AT)
      .advance(GHOUL_WIND_UP_AT)
      .press('parry', GHOUL_IMPACT)
      .advance(GHOUL_IMPACT + 90);

    expect(play.lastOf('enemyDefeated')).toEqual({
      type: 'enemyDefeated',
      at: GHOUL_IMPACT + 90,
      enemy: 0,
    });
    expect(play.all('targetChanged')).toEqual([{ type: 'targetChanged', at: 400, enemy: 1 }]);
    expect(play.battle.target).toBe(1);
  });
});

describe('judging a defense press (C7, C8)', () => {
  it('perfect parry: no damage, a hit-stop, then a counter of 6 to the Ghoul', () => {
    const play = toGhoulWindUp('basic').press('parry', GHOUL_IMPACT - 50);

    expect(play.last).toEqual([
      {
        type: 'blowResolved',
        at: GHOUL_IMPACT - 50,
        enemy: 0,
        index: 0,
        outcome: 'perfectParry',
        button: 'parry',
        delta: -50,
        damage: 0,
        heroHp: 80,
      },
      { type: 'hitStopStarted', at: GHOUL_IMPACT - 50, until: GHOUL_IMPACT + 40 },
    ]);

    play.advance(20_000);
    expect(play.lastOf('counterAttacked')).toEqual({
      type: 'counterAttacked',
      at: GHOUL_IMPACT + 40,
      enemy: 0,
      damage: 6,
      until: GHOUL_IMPACT + 440,
    });
    // 20 PV, − 10 (attaque de la Sentinelle), − 6 (contre-attaque).
    expect(play.battle.enemies[0]!.hp).toBe(4);
  });

  it('shifts every later deadline of the attack by the hit-stop', () => {
    const play = toGhoulWindUp('basic').press('parry', GHOUL_IMPACT - 50);

    expect(play.battle.hitStop).toEqual({ at: GHOUL_IMPACT - 50, until: GHOUL_IMPACT + 40 });
    expect(play.battle.phase).toMatchObject({
      step: { impacts: [{ at: GHOUL_IMPACT + 90 }], resolvedAt: GHOUL_IMPACT + 250 },
    });
    play.advance(20_000);
    expect(play.all('impactLanded')[0]).toMatchObject({ at: GHOUL_IMPACT + 90, enemy: 0 });
    // L'ennemi suivant s'avance après la contre-attaque, plus longue que la résolution décalée.
    expect(play.all('stepInStarted')[1]).toMatchObject({ at: GHOUL_IMPACT + 440 });
  });

  it('dates a press during the hit-stop at its start', () => {
    const play = toGhoulWindUp('double').press('parry', GHOUL_IMPACT - 50);

    play.press('dodge', GHOUL_IMPACT + 10);

    // Le 2e impact (420 ms plus tard, décalé de 90 ms) est loin : appui raté, daté du début de l'arrêt.
    expect(play.last).toEqual([
      { type: 'whiffed', at: GHOUL_IMPACT - 50, button: 'dodge', reason: 'early' },
      { type: 'offBalanceStarted', at: GHOUL_IMPACT - 50, until: GHOUL_IMPACT + 400 },
    ]);
  });

  it('good parry: 1 damage instead of 5, no counter', () => {
    const play = toGhoulWindUp('basic')
      .press('parry', GHOUL_IMPACT + 120)
      .advance(20_000);

    expect(play.all('blowResolved')[0]).toMatchObject({
      outcome: 'parry',
      delta: 120,
      damage: 1,
      heroHp: 79,
    });
    expect(play.all('counterAttacked')).toEqual([]);
    expect(play.all('hitStopStarted')).toEqual([]);
    // Seule l'attaque de la Sentinelle l'a touchée.
    expect(play.battle.enemies[0]!.hp).toBe(10);
  });

  it('dodge: no damage and no counter, even far from the perfect window', () => {
    const play = toGhoulWindUp('basic')
      .press('dodge', GHOUL_IMPACT - 150)
      .advance(20_000);

    expect(play.all('blowResolved')[0]).toMatchObject({
      outcome: 'dodge',
      button: 'dodge',
      delta: -150,
      damage: 0,
      heroHp: 80,
    });
    expect(play.all('counterAttacked')).toEqual([]);
    expect(play.all('hitStopStarted')).toEqual([]);
  });

  it('a perfect dodge is still a dodge: no hit-stop, no counter', () => {
    const play = toGhoulWindUp('basic').press('dodge', GHOUL_IMPACT).advance(20_000);

    expect(play.all('blowResolved')[0]).toMatchObject({ outcome: 'dodge', damage: 0 });
    expect(play.all('hitStopStarted')).toEqual([]);
    expect(play.all('counterAttacked')).toEqual([]);
  });

  it('no press: 4 damage, 160 ms after the impact', () => {
    const play = toGhoulWindUp('basic').advance(GHOUL_IMPACT + 160);

    // À l'instant même de l'échéance, un appui serait encore jugé.
    expect(play.all('blowResolved')).toEqual([]);
    expect(nextDeadline(play.battle)).toEqual({ at: GHOUL_IMPACT + 160, awaitsPress: true });

    play.advance(GHOUL_IMPACT + 161);
    expect(play.all('blowResolved')).toEqual([
      {
        type: 'blowResolved',
        at: GHOUL_IMPACT + 160,
        enemy: 0,
        index: 0,
        outcome: 'suffered',
        button: null,
        delta: null,
        damage: 4,
        heroHp: 76,
      },
    ]);
  });

  it('judges a press made exactly at the end of the parry window', () => {
    const play = toGhoulWindUp('basic').press('parry', GHOUL_IMPACT + 160);

    expect(play.lastOf('blowResolved')).toMatchObject({ outcome: 'parry', delta: 160 });
  });

  it('whiffs a press just outside the window, too early or too late', () => {
    const early = toGhoulWindUp('basic').press('parry', GHOUL_IMPACT - 161);
    expect(early.last).toEqual([
      { type: 'whiffed', at: GHOUL_IMPACT - 161, button: 'parry', reason: 'early' },
      { type: 'offBalanceStarted', at: GHOUL_IMPACT - 161, until: GHOUL_IMPACT + 289 },
    ]);

    const late = toGhoulWindUp('basic', 'delayed', { inputOffset: 30 }).press(
      'parry',
      GHOUL_IMPACT + 140,
    );
    expect(late.lastOf('whiffed')).toEqual({
      type: 'whiffed',
      at: GHOUL_IMPACT + 140,
      button: 'parry',
      reason: 'late',
    });
  });

  it('judges with the input offset, and waits longer with a negative one', () => {
    const play = toGhoulWindUp('basic', 'delayed', { inputOffset: -40 });

    play.advance(GHOUL_IMPACT + 161);
    expect(play.all('blowResolved')).toEqual([]);

    play.press('parry', GHOUL_IMPACT + 190);
    expect(play.lastOf('blowResolved')).toMatchObject({ outcome: 'parry', delta: 150 });
  });

  it('resolves the blow at the nominal instant, whatever the advance', () => {
    const play = toGhoulWindUp('basic').advance(GHOUL_IMPACT + 1_000);

    expect(play.lastOf('blowResolved')?.at).toBe(GHOUL_IMPACT + 160);
    expect(play.battle.now).toBe(GHOUL_IMPACT + 1_000);
  });
});

describe('double attack (C8, C10)', () => {
  it('judges each impact: perfect on the first, nothing on the second, no counter', () => {
    const play = toGhoulWindUp('double');
    expect(play.lastOf('windUpStarted')?.impacts).toEqual([DOUBLE_IMPACT, DOUBLE_IMPACT + 420]);

    play.press('parry', DOUBLE_IMPACT - 10).advance(20_000);

    const blows = play.all('blowResolved').filter((blow) => blow.enemy === 0);
    expect(blows.map(({ index, outcome, damage }) => ({ index, outcome, damage }))).toEqual([
      { index: 0, outcome: 'perfectParry', damage: 0 },
      { index: 1, outcome: 'suffered', damage: 2 },
    ]);
    // Le 2e impact est décalé par l'arrêt sur image de la 1re parade.
    expect(blows[1]!.at).toBe(DOUBLE_IMPACT + 420 + 90 + 160);
    expect(play.all('counterAttacked')).toEqual([]);
    expect(blows[1]!.heroHp).toBe(78);
  });

  it('counters only when both impacts are parried perfectly', () => {
    const play = toGhoulWindUp('double')
      .press('parry', DOUBLE_IMPACT)
      .press('parry', DOUBLE_IMPACT + 420 + 90 + 20)
      .advance(20_000);

    expect(play.all('hitStopStarted')).toHaveLength(2);
    expect(play.lastOf('counterAttacked')).toEqual({
      type: 'counterAttacked',
      at: DOUBLE_IMPACT + 530 + 90,
      enemy: 0,
      damage: 6,
      until: DOUBLE_IMPACT + 530 + 90 + 400,
    });
  });

  it('does not counter after a dodge and a perfect parry', () => {
    const play = toGhoulWindUp('double')
      .press('dodge', DOUBLE_IMPACT)
      .press('parry', DOUBLE_IMPACT + 420)
      .advance(20_000);

    expect(
      play
        .all('blowResolved')
        .slice(0, 2)
        .map((blow) => blow.outcome),
    ).toEqual(['dodge', 'perfectParry']);
    expect(play.all('counterAttacked')).toEqual([]);
  });
});

describe('perilous attack (C8)', () => {
  /** Le Spectre attaque seul (la Goule est tombée), avec son coup imparable. */
  function toPerilousWindUp(): { play: BattlePlay; impact: number } {
    const play = BattlePlay.start()
      .with(fixedIntent(1, 'perilous'), (battle) => ({
        ...battle,
        target: 1,
        enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, hp: 0 } : enemy)),
      }))
      .attack(ATTACK_AT)
      .advance(GHOUL_WIND_UP_AT);
    return { play, impact: GHOUL_WIND_UP_AT + 1_300 };
  }

  it('fails a parry in the perfect window: 8 damage and off-balance', () => {
    const { play, impact } = toPerilousWindUp();
    expect(play.lastOf('windUpStarted')).toMatchObject({ enemy: 1, attack: 'perilous' });

    play.press('parry', impact - 20);

    expect(play.last).toEqual([
      {
        type: 'blowResolved',
        at: impact - 20,
        enemy: 1,
        index: 0,
        outcome: 'perilousParry',
        button: 'parry',
        delta: -20,
        damage: 8,
        heroHp: 72,
      },
      { type: 'offBalanceStarted', at: impact - 20, until: impact + 430 },
    ]);
    expect(play.battle.offBalanceUntil).toBe(impact + 430);
  });

  it('lets a dodge 100 ms before the impact through, without damage', () => {
    const { play, impact } = toPerilousWindUp();

    play.press('dodge', impact - 100);

    expect(play.lastOf('blowResolved')).toMatchObject({ outcome: 'dodge', damage: 0, heroHp: 80 });
    expect(play.battle.offBalanceUntil).toBeNull();
  });
});

describe('off-balance (C9)', () => {
  it('whiffs a press 400 ms early, ignores and extends on the next one, then the impact is suffered', () => {
    const play = toGhoulWindUp('basic').press('parry', GHOUL_IMPACT - 400);

    expect(play.last).toEqual([
      { type: 'whiffed', at: GHOUL_IMPACT - 400, button: 'parry', reason: 'early' },
      { type: 'offBalanceStarted', at: GHOUL_IMPACT - 400, until: GHOUL_IMPACT + 50 },
    ]);

    play.press('parry', GHOUL_IMPACT - 200);
    expect(play.last).toEqual([
      { type: 'pressIgnored', at: GHOUL_IMPACT - 200, button: 'parry', reason: 'offBalance' },
      { type: 'offBalanceStarted', at: GHOUL_IMPACT - 200, until: GHOUL_IMPACT + 250 },
    ]);

    play.advance(GHOUL_IMPACT);
    expect(play.lastOf('impactLanded')).toEqual({
      type: 'impactLanded',
      at: GHOUL_IMPACT,
      enemy: 0,
      index: 0,
      lost: true,
    });

    play.advance(GHOUL_IMPACT + 300);
    expect(play.lastOf('offBalanceEnded')).toEqual({
      type: 'offBalanceEnded',
      at: GHOUL_IMPACT + 250,
    });
    expect(play.lastOf('blowResolved')).toMatchObject({ outcome: 'suffered', damage: 4 });
  });

  it('cannot parry an impact that fell during off-balance, even after it ends', () => {
    const play = toGhoulWindUp('basic')
      .press('parry', GHOUL_IMPACT - 400)
      .press('parry', GHOUL_IMPACT + 100);

    // Le déséquilibre a fini à impact + 50 ; l'impact, tombé pendant, ne se pare plus.
    expect(play.last).toEqual([
      { type: 'impactLanded', at: GHOUL_IMPACT, enemy: 0, index: 0, lost: true },
      { type: 'offBalanceEnded', at: GHOUL_IMPACT + 50 },
      { type: 'whiffed', at: GHOUL_IMPACT + 100, button: 'parry', reason: 'empty' },
      { type: 'offBalanceStarted', at: GHOUL_IMPACT + 100, until: GHOUL_IMPACT + 550 },
    ]);
  });

  it('lets an impact land normally at the very instant the off-balance ends', () => {
    const play = toGhoulWindUp('basic')
      .press('parry', GHOUL_IMPACT - 450)
      .advance(GHOUL_IMPACT);

    expect(play.lastOf('impactLanded')).toMatchObject({ lost: false });
    play.press('parry', GHOUL_IMPACT + 10);
    expect(play.lastOf('blowResolved')).toMatchObject({ outcome: 'perfectParry' });
  });

  it('whiffs a press after the impact is judged: in the void', () => {
    const play = toGhoulWindUp('basic')
      .press('dodge', GHOUL_IMPACT)
      .press('parry', GHOUL_IMPACT + 100);

    expect(play.lastOf('whiffed')).toEqual({
      type: 'whiffed',
      at: GHOUL_IMPACT + 100,
      button: 'parry',
      reason: 'empty',
    });
  });

  it('stops at the start of the transition to the hero phase', () => {
    // Le Spectre est tombé : la Goule est le dernier ennemi debout.
    const play = BattlePlay.start()
      .with(fixedIntent(0, 'basic'), (battle) => ({
        ...battle,
        enemies: battle.enemies.map((enemy, index) => (index === 1 ? { ...enemy, hp: 0 } : enemy)),
      }))
      .attack(ATTACK_AT)
      .advance(GHOUL_WIND_UP_AT)
      .press('dodge', GHOUL_IMPACT)
      .press('parry', GHOUL_IMPACT + 60);
    expect(play.battle.offBalanceUntil).toBe(GHOUL_IMPACT + 510);

    play.advance(GHOUL_IMPACT + 161);

    expect(play.last).toEqual([
      { type: 'offBalanceEnded', at: GHOUL_IMPACT + 160 },
      {
        type: 'phaseTransitionStarted',
        at: GHOUL_IMPACT + 160,
        to: 'hero',
        until: GHOUL_IMPACT + 960,
      },
      { type: 'roundStarted', at: GHOUL_IMPACT + 160, round: 2 },
    ]);
    expect(play.battle.offBalanceUntil).toBeNull();
  });
});

describe('phase transition (C12)', () => {
  it('ignores presses at 0, 300 and 799 ms, without off-balance or memory', () => {
    const play = BattlePlay.start().with(fixedIntent(0, 'basic')).attack(ATTACK_AT);
    play.advance(HERO_ACTION_END);
    expect(play.battle.phase).toMatchObject({ kind: 'transition', to: 'enemy' });

    for (const after of [0, 300, 799]) {
      play.press('parry', HERO_ACTION_END + after);
      expect(play.last).toEqual([
        {
          type: 'pressIgnored',
          at: HERO_ACTION_END + after,
          button: 'parry',
          reason: 'phaseTransition',
        },
      ]);
    }
    expect(play.battle.offBalanceUntil).toBeNull();

    play.advance(20_000);
    expect(play.all('blowResolved')[0]).toMatchObject({ outcome: 'suffered' });
    expect(play.all('whiffed')).toEqual([]);
  });

  it('judges a new touch that starts after the transition: in the step-in, it is in the void', () => {
    const play = BattlePlay.start().with(fixedIntent(0, 'basic')).attack(ATTACK_AT);

    play.press('parry', HERO_ACTION_END + 1_000);

    expect(play.last.slice(-2)).toEqual([
      { type: 'whiffed', at: HERO_ACTION_END + 1_000, button: 'parry', reason: 'empty' },
      { type: 'offBalanceStarted', at: HERO_ACTION_END + 1_000, until: HERO_ACTION_END + 1_450 },
    ]);
  });

  it('judges a new touch 1,600 ms after the start of the transition', () => {
    const play = BattlePlay.start().with(fixedIntent(0, 'basic')).attack(ATTACK_AT);

    play.press('parry', HERO_ACTION_END + 600).press('parry', HERO_ACTION_END + 1_600);

    expect(play.all('pressIgnored')).toHaveLength(1);
    expect(play.lastOf('whiffed')).toMatchObject({ at: HERO_ACTION_END + 1_600, reason: 'early' });
  });

  it('ignores « Attaquer » during the transition to the hero phase, and a touch begun in it', () => {
    const play = toGhoulWindUp('basic', 'delayed').advance(6_221);
    expect(play.battle.phase).toEqual({
      kind: 'transition',
      to: 'hero',
      since: 6_220,
      until: 7_020,
    });

    play.attack(6_420, 6_400);
    expect(play.last).toEqual([
      { type: 'pressIgnored', at: 6_420, button: 'attack', reason: 'phaseTransition' },
    ]);

    // Doigt posé pendant la transition, relâché après : jamais pris en compte.
    play.attack(7_100, 7_000);
    expect(play.last).toEqual([
      { type: 'heroPhaseStarted', at: 7_020 },
      { type: 'pressIgnored', at: 7_100, button: 'attack', reason: 'touchTooEarly' },
    ]);
    // Seule l'attaque de la première manche l'a touchée.
    expect(play.battle.enemies[0]!.hp).toBe(10);

    play.attack(7_300, 7_200);
    expect(play.lastOf('heroAttacked')).toMatchObject({ at: 7_300, enemy: 0 });
  });

  it('accepts a touch that starts at the very start of the hero phase', () => {
    const play = toGhoulWindUp('basic', 'delayed').advance(7_020).attack(7_100, 7_020);

    expect(play.lastOf('heroAttacked')).toMatchObject({ at: 7_100 });
  });

  it('ignores a target touch during a transition, and a defense press in the hero phase', () => {
    const play = BattlePlay.start().with(fixedIntent(0, 'basic')).attack(ATTACK_AT);

    play.target(1, HERO_ACTION_END + 100, HERO_ACTION_END + 50);
    expect(play.last.slice(-1)).toEqual([
      {
        type: 'pressIgnored',
        at: HERO_ACTION_END + 100,
        button: 'target',
        reason: 'phaseTransition',
      },
    ]);

    const hero = BattlePlay.start().press('parry', 300);
    expect(hero.last).toEqual([
      { type: 'pressIgnored', at: 300, button: 'parry', reason: 'notAvailable' },
    ]);
  });

  it('ignores the hero actions during the hero action and the enemy phase', () => {
    const play = BattlePlay.start().with(fixedIntent(0, 'basic')).attack(ATTACK_AT);

    play.attack(ATTACK_AT + 200, ATTACK_AT + 100);
    expect(play.last).toEqual([
      { type: 'pressIgnored', at: ATTACK_AT + 200, button: 'attack', reason: 'notAvailable' },
    ]);
    play.advance(GHOUL_WIND_UP_AT).target(1, GHOUL_WIND_UP_AT + 100);
    expect(play.lastOf('pressIgnored')).toMatchObject({ button: 'target', reason: 'notAvailable' });
  });
});

describe('feint attack (C10)', () => {
  it('places its feint between 35 % and 60 % of the wind-up and announces it', () => {
    const play = BattlePlay.start()
      .with(fixedIntent(0, 'feint', { windUpMs: 1_600, feintFraction: 0.4 }))
      .attack(ATTACK_AT)
      .advance(GHOUL_WIND_UP_AT);

    expect(play.lastOf('windUpStarted')).toMatchObject({
      attack: 'feint',
      feintAt: GHOUL_WIND_UP_AT + 640,
      impacts: [GHOUL_WIND_UP_AT + 1_600],
    });

    play.advance(GHOUL_WIND_UP_AT + 639);
    expect(play.all('feintStarted')).toEqual([]);
    play.advance(GHOUL_WIND_UP_AT + 640);
    expect(play.last).toEqual([{ type: 'feintStarted', at: GHOUL_WIND_UP_AT + 640, enemy: 0 }]);
  });

  it('whiffs a parry on the feint', () => {
    const play = BattlePlay.start()
      .with(fixedIntent(0, 'feint', { windUpMs: 1_600, feintFraction: 0.5 }))
      .attack(ATTACK_AT)
      .press('parry', GHOUL_WIND_UP_AT + 800);

    expect(play.last.slice(-2)).toEqual([
      { type: 'whiffed', at: GHOUL_WIND_UP_AT + 800, button: 'parry', reason: 'early' },
      { type: 'offBalanceStarted', at: GHOUL_WIND_UP_AT + 800, until: GHOUL_WIND_UP_AT + 1_250 },
    ]);
  });

  it('shifts a feint that is still to come with a hit-stop', () => {
    // Une contre-attaque ne précède jamais une fausse amorce : l'arrêt sur image la décale.
    const play = toGhoulWindUp('double');
    play.with((battle) => {
      const phase = battle.phase as Extract<Battle['phase'], { kind: 'enemy' }>;
      return {
        ...battle,
        phase: {
          ...phase,
          step: {
            ...(phase.step as Extract<typeof phase.step, { kind: 'attack' }>),
            feintAt: DOUBLE_IMPACT + 200,
          },
        },
      };
    });

    play.press('parry', DOUBLE_IMPACT);

    expect(play.battle.phase).toMatchObject({ step: { feintAt: DOUBLE_IMPACT + 290 } });
  });
});

describe('end of the battle (C11)', () => {
  it('is won when the last enemy falls, at the end of the hero attack', () => {
    const play = BattlePlay.start().with((battle) => ({
      ...battle,
      enemies: battle.enemies.map((enemy) => ({ ...enemy, hp: enemy.kind === 'ghoul' ? 0 : 10 })),
      target: 1,
    }));

    play.attack(ATTACK_AT);
    expect(play.battle.phase.kind).toBe('heroAction');
    play.advance(HERO_ACTION_END);

    expect(play.last).toEqual([{ type: 'battleEnded', at: HERO_ACTION_END, outcome: 'victory' }]);
    expect(play.battle.phase).toEqual({ kind: 'over', outcome: 'victory', at: HERO_ACTION_END });
    expect(nextDeadline(play.battle)).toBeNull();
  });

  it('is won when a counter fells the last enemy, at the end of the counter', () => {
    const play = BattlePlay.start()
      .with(fixedIntent(0, 'basic'), (battle) => ({
        ...battle,
        enemies: battle.enemies.map((enemy) => ({ ...enemy, hp: enemy.kind === 'ghoul' ? 16 : 0 })),
      }))
      .attack(ATTACK_AT)
      .advance(GHOUL_WIND_UP_AT)
      .press('parry', GHOUL_IMPACT)
      .advance(20_000);

    expect(play.lastOf('enemyDefeated')).toEqual({
      type: 'enemyDefeated',
      at: GHOUL_IMPACT + 90,
      enemy: 0,
    });
    expect(play.lastOf('battleEnded')).toEqual({
      type: 'battleEnded',
      at: GHOUL_IMPACT + 490,
      outcome: 'victory',
    });
  });

  it('is lost when the Sentinel falls to 0 HP, at the blow', () => {
    const play = toGhoulWindUp('basic').with((battle) => ({
      ...battle,
      hero: { hp: 3, maxHp: 80 },
    }));

    play.advance(20_000);

    expect(play.last.slice(-2)).toEqual([
      expect.objectContaining({ type: 'blowResolved', damage: 4, heroHp: 0 }),
      { type: 'battleEnded', at: GHOUL_IMPACT + 160, outcome: 'defeat' },
    ]);
    expect(play.battle.phase).toEqual({ kind: 'over', outcome: 'defeat', at: GHOUL_IMPACT + 160 });
    expect(play.all('stepInStarted')).toHaveLength(1);
  });

  it('is lost on a failed parry of a perilous attack, and stops the off-balance', () => {
    const play = BattlePlay.start()
      .with(fixedIntent(1, 'perilous'), (battle) => ({
        ...battle,
        hero: { hp: 8, maxHp: 80 },
        target: 1,
        enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, hp: 0 } : enemy)),
      }))
      .attack(ATTACK_AT)
      .press('parry', GHOUL_WIND_UP_AT + 1_300);

    expect(play.lastOf('battleEnded')).toMatchObject({ outcome: 'defeat' });
    expect(play.battle.offBalanceUntil).toBeNull();
    expect(play.all('offBalanceStarted')).toEqual([]);
  });

  it('stops an off-balance at the end of the battle', () => {
    const play = toGhoulWindUp('basic')
      .with((battle) => ({ ...battle, hero: { hp: 2, maxHp: 80 } }))
      .press('parry', GHOUL_IMPACT - 200)
      .advance(20_000);

    expect(play.last.slice(-2)).toEqual([
      { type: 'offBalanceEnded', at: GHOUL_IMPACT + 160 },
      { type: 'battleEnded', at: GHOUL_IMPACT + 160, outcome: 'defeat' },
    ]);
  });

  it('ignores every press once the battle is over', () => {
    const play = BattlePlay.start().with((battle) => ({
      ...battle,
      phase: { kind: 'over', outcome: 'victory', at: 0 },
    }));

    play.press('parry', 100).attack(200);

    expect(play.all('pressIgnored').map((event) => event.reason)).toEqual([
      'notAvailable',
      'notAvailable',
    ]);
  });
});

describe('defense hint (C12)', () => {
  it('shows the hint before the first transition, which starts only when it is closed', () => {
    const play = BattlePlay.start({ defenseHint: true })
      .with(fixedIntent(0, 'basic'))
      .attack(ATTACK_AT);

    play.advance(HERO_ACTION_END);
    expect(play.last).toEqual([{ type: 'defenseHintShown', at: HERO_ACTION_END }]);
    expect(play.battle.phase).toEqual({ kind: 'defenseHint', since: HERO_ACTION_END });
    expect(nextDeadline(play.battle)).toBeNull();

    play.press('parry', 5_000);
    expect(play.last).toEqual([
      { type: 'pressIgnored', at: 5_000, button: 'parry', reason: 'phaseTransition' },
    ]);

    play.dismissHint(6_000);
    expect(play.last).toEqual([
      { type: 'phaseTransitionStarted', at: 6_000, to: 'enemy', until: 6_800 },
    ]);
    expect(play.battle.defenseHintPending).toBe(false);
  });

  it('shows the hint only once in a battle', () => {
    const play = BattlePlay.start({ defenseHint: true })
      .with(fixedIntent(0, 'basic'), fixedIntent(1, 'delayed'))
      .attack(ATTACK_AT)
      .dismissHint(HERO_ACTION_END)
      .advance(20_000);
    play.attack(20_100, 20_050).advance(20_600);

    expect(play.all('defenseHintShown')).toHaveLength(1);
    expect(play.lastOf('phaseTransitionStarted')).toMatchObject({ at: 20_600, to: 'enemy' });
  });

  it('does nothing when no hint is shown', () => {
    const play = BattlePlay.start().dismissHint(300);

    expect(play.last).toEqual([]);
    expect(play.battle.phase).toEqual({ kind: 'hero', since: 0 });
  });

  it('starts the transition at the engine state when the dismissal is dated earlier', () => {
    const play = BattlePlay.start({ defenseHint: true })
      .attack(ATTACK_AT)
      .advance(3_000)
      .dismissHint(2_000);

    expect(play.lastOf('phaseTransitionStarted')).toMatchObject({ at: 3_000 });
  });
});

describe('dating of the presses', () => {
  it('dates a press received after the engine state at the engine state', () => {
    const play = toGhoulWindUp('basic').advance(GHOUL_IMPACT + 100);

    play.press('parry', GHOUL_IMPACT - 300);

    expect(play.lastOf('blowResolved')).toMatchObject({ at: GHOUL_IMPACT + 100, delta: 100 });
  });

  it('dates a hero action released before the engine state at the engine state', () => {
    const play = BattlePlay.start().advance(800).attack(500, 400);

    expect(play.lastOf('heroAttacked')).toMatchObject({ at: 800, until: 1_300 });
  });

  it('never moves the engine state backwards', () => {
    const play = BattlePlay.start().advance(800).advance(300);

    expect(play.battle.now).toBe(800);
  });
});

describe('nextDeadline', () => {
  it('gives the end of the hero attack, then the transition, then the step-in', () => {
    const play = BattlePlay.start().with(fixedIntent(0, 'basic')).attack(ATTACK_AT);

    expect(nextDeadline(play.battle)).toEqual({ at: HERO_ACTION_END, awaitsPress: false });
    play.advance(HERO_ACTION_END);
    expect(nextDeadline(play.battle)).toEqual({ at: ENEMY_PHASE_AT, awaitsPress: false });
    play.advance(ENEMY_PHASE_AT);
    expect(nextDeadline(play.battle)).toEqual({ at: GHOUL_WIND_UP_AT, awaitsPress: false });
    play.advance(GHOUL_WIND_UP_AT);
    expect(nextDeadline(play.battle)).toEqual({ at: GHOUL_IMPACT, awaitsPress: false });
  });

  it('gives the end of the off-balance before a later impact', () => {
    const play = toGhoulWindUp('basic').press('parry', GHOUL_IMPACT - 600);

    expect(nextDeadline(play.battle)).toEqual({ at: GHOUL_IMPACT - 150, awaitsPress: false });
  });

  it('gives the shifted impact and the counter, then the end of the attack', () => {
    const play = toGhoulWindUp('basic').press('parry', GHOUL_IMPACT);

    expect(nextDeadline(play.battle)).toEqual({ at: GHOUL_IMPACT + 90, awaitsPress: false });
    play.advance(GHOUL_IMPACT + 90);
    // L'impact, à l'instant même de l'appui, est déjà tombé : seule la contre-attaque reste.
    expect(play.lastTypes()).toEqual(['counterAttacked']);
    expect(nextDeadline(play.battle)).toEqual({ at: GHOUL_IMPACT + 490, awaitsPress: false });
  });

  it('puts an unanswered impact after an ordinary deadline of the same instant', () => {
    const play = toGhoulWindUp('basic').press('parry', GHOUL_IMPACT - 290);
    // Déséquilibre jusqu'à impact + 160 : même instant que l'échéance de l'impact (perdu).
    expect(play.battle.offBalanceUntil).toBe(GHOUL_IMPACT + 160);
    play.advance(GHOUL_IMPACT);

    expect(nextDeadline(play.battle)).toEqual({ at: GHOUL_IMPACT + 160, awaitsPress: false });
    play.advance(GHOUL_IMPACT + 160);
    expect(play.last).toEqual([{ type: 'offBalanceEnded', at: GHOUL_IMPACT + 160 }]);
    expect(nextDeadline(play.battle)).toEqual({ at: GHOUL_IMPACT + 160, awaitsPress: true });
  });
});

describe('edge cases of the engine', () => {
  /** La Goule à terre : le Spectre est la cible et attaque seul. */
  const ghoulDown = (battle: Battle): Battle => ({
    ...battle,
    target: 1,
    enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, hp: 0 } : enemy)),
  });

  it('draws no intent for a fallen enemy at the start of the next round (C10)', () => {
    const play = BattlePlay.start().with(ghoulDown, fixedIntent(1, 'delayed'));
    const random = play.battle.random;

    play.attack(ATTACK_AT).advance(20_000);

    const specter = drawIntent('specter', random);
    expect(play.battle.round).toBe(2);
    expect(play.battle.enemies[1]!.intent).toEqual(specter.intent);
    expect(play.battle.random).toBe(specter.random);
  });

  it('keeps the target when the counter-attack fells another enemy', () => {
    const play = BattlePlay.start()
      .with(fixedIntent(0, 'basic'), fixedIntent(1, 'delayed'), (battle) => ({
        ...battle,
        target: 1,
        enemies: battle.enemies.map((enemy, index) => (index === 0 ? { ...enemy, hp: 6 } : enemy)),
      }))
      .attack(ATTACK_AT)
      .advance(GHOUL_WIND_UP_AT)
      .press('parry', GHOUL_IMPACT)
      .advance(GHOUL_IMPACT + 90);

    expect(play.lastOf('enemyDefeated')).toEqual({
      type: 'enemyDefeated',
      at: GHOUL_IMPACT + 90,
      enemy: 0,
    });
    expect(play.all('targetChanged')).toEqual([]);
    expect(play.battle.target).toBe(1);
  });

  it('changes no target when the last enemy falls', () => {
    const play = BattlePlay.start()
      .with(ghoulDown, (battle) => ({
        ...battle,
        enemies: battle.enemies.map((enemy, index) => (index === 1 ? { ...enemy, hp: 1 } : enemy)),
      }))
      .attack(ATTACK_AT);

    expect(play.lastTypes()).toEqual(['heroAttacked', 'enemyDefeated']);
  });

  it('lands an impact before an unanswered impact of the same instant', () => {
    // Avec un décalage de −260 ms, l'échéance du 1er impact sans appui tombe 420 ms après lui,
    // à l'instant même du 2e impact de la double frappe.
    const play = toGhoulWindUp('double', 'delayed', { inputOffset: -260 }).advance(DOUBLE_IMPACT);

    expect(nextDeadline(play.battle)).toEqual({ at: DOUBLE_IMPACT + 420, awaitsPress: false });
    play.advance(DOUBLE_IMPACT + 420);
    expect(play.lastTypes()).toEqual(['impactLanded']);
    expect(nextDeadline(play.battle)).toEqual({ at: DOUBLE_IMPACT + 420, awaitsPress: true });
  });

  it('shifts with the hit-stop only the instants from the press onwards', () => {
    const late = toGhoulWindUp('double').press('parry', DOUBLE_IMPACT + 20);
    expect(late.battle.phase).toMatchObject({
      step: { impacts: [{ at: DOUBLE_IMPACT }, { at: DOUBLE_IMPACT + 420 + 90 }] },
    });

    const onTime = toGhoulWindUp('double').press('parry', DOUBLE_IMPACT);
    expect(onTime.battle.phase).toMatchObject({
      step: { impacts: [{ at: DOUBLE_IMPACT + 90 }, { at: DOUBLE_IMPACT + 420 + 90 }] },
    });
  });

  it('dates a press at the end of the hit-stop at its own instant', () => {
    const play = toGhoulWindUp('double')
      .press('parry', DOUBLE_IMPACT)
      .press('dodge', DOUBLE_IMPACT + 90);

    expect(play.lastOf('whiffed')).toEqual({
      type: 'whiffed',
      at: DOUBLE_IMPACT + 90,
      button: 'dodge',
      reason: 'early',
    });
  });

  it('dates a late press at the start of the hit-stop, or at the engine state before it', () => {
    const during = toGhoulWindUp('double')
      .press('parry', DOUBLE_IMPACT)
      .advance(DOUBLE_IMPACT + 50)
      .press('dodge', DOUBLE_IMPACT);
    expect(during.lastOf('whiffed')).toMatchObject({ at: DOUBLE_IMPACT });

    const before = toGhoulWindUp('double')
      .press('parry', DOUBLE_IMPACT)
      .advance(DOUBLE_IMPACT + 50)
      .press('dodge', DOUBLE_IMPACT - 5);
    expect(before.lastOf('whiffed')).toMatchObject({ at: DOUBLE_IMPACT + 50 });
  });

  it('ignores « Attaquer » while the defense hint is shown, as during a transition', () => {
    const play = BattlePlay.start({ defenseHint: true })
      .with(fixedIntent(0, 'basic'))
      .attack(ATTACK_AT)
      .advance(HERO_ACTION_END)
      .attack(3_000);

    expect(play.last).toEqual([
      { type: 'pressIgnored', at: 3_000, button: 'attack', reason: 'phaseTransition' },
    ]);
  });

  it('keeps the events of the enemy phase that ends just before « Attaquer »', () => {
    const play = toGhoulWindUp('basic').attack(20_000, 19_950);

    const types = play.lastTypes();
    expect(types).toContain('roundStarted');
    expect(types.indexOf('heroPhaseStarted')).toBeGreaterThanOrEqual(0);
    expect(types.indexOf('heroPhaseStarted')).toBeLessThan(types.indexOf('heroAttacked'));
  });
});

describe('over about 500 seeds', () => {
  /** Les écarts tentés tour à tour sur chaque impact ; `null` : aucun appui. */
  const DELTAS = [-400, -170, -120, -40, 0, 30, 90, 150, null] as const;

  /**
   * Un combat joué de façon reproductible : une attaque 300 ms après chaque début de phase du
   * héros, un appui pendant chaque transition (ignoré), puis, sur chaque impact, un écart et un
   * bouton choisis tour à tour.
   */
  function playSeed(seed: number): BattlePlay {
    const play = BattlePlay.start({ seed, defenseHint: seed % 2 === 0 });
    const tried = new Set<string>();
    let turn = seed;
    for (let guard = 0; guard < 2_000 && play.battle.phase.kind !== 'over'; guard += 1) {
      const { phase, now } = play.battle;
      turn += 1;
      if (phase.kind === 'defenseHint') {
        play.dismissHint(now + 300);
      } else if (phase.kind === 'hero') {
        play.attack(Math.max(now, phase.since) + 300, phase.since + 10);
      } else if (phase.kind === 'transition' && !tried.has(`transition@${phase.since}`)) {
        tried.add(`transition@${phase.since}`);
        play.press('parry', phase.since + (turn % 8) * 100);
      } else {
        const step = phase.kind === 'enemy' ? phase.step : null;
        const index =
          step?.kind === 'attack'
            ? step.impacts.findIndex((impact) => impact.outcome === null)
            : -1;
        const key = step?.kind === 'attack' ? `${step.startedAt}#${index}` : '';
        const delta = DELTAS[turn % DELTAS.length];
        if (step?.kind === 'attack' && index >= 0 && !tried.has(key) && delta !== null) {
          tried.add(key);
          const at = step.impacts[index]!.at + delta!;
          if (at >= now) play.press(turn % 3 === 0 ? 'dodge' : 'parry', at);
        } else {
          tried.add(key);
          play.advance(nextDeadline(play.battle)!.at + 1);
        }
      }
    }
    return play.advance(200_000);
  }

  const seeds = Array.from({ length: 500 }, (_, index) => index * 48_271 + 1);
  // Joués dans le premier test qui les demande, jamais au chargement du fichier (mutation).
  let played: BattlePlay[] | null = null;
  const allPlays = (): BattlePlay[] => (played ??= seeds.map(playSeed));

  it('always ends the battle', () => {
    for (const play of allPlays()) {
      expect(play.battle.phase.kind).toBe('over');
    }
  });

  it('gives exactly the same battle for the same seed and the same presses', () => {
    for (const seed of seeds.slice(0, 50)) {
      expect(playSeed(seed).events).toEqual(allPlays()[seeds.indexOf(seed)]!.events);
    }
  });

  it('never judges a press during a phase transition', () => {
    for (const play of allPlays()) {
      const transitions = play.all('phaseTransitionStarted');
      const judged = [
        ...play.all('whiffed'),
        ...play.all('blowResolved').filter((blow) => blow.button !== null),
      ];
      for (const press of judged) {
        expect(transitions.some(({ at, until }) => press.at >= at && press.at < until)).toBe(false);
      }
    }
  });

  it('never lands the first impact of an enemy phase sooner than 2,000 ms after the hero attack', () => {
    for (const play of allPlays()) {
      for (const transition of play
        .all('phaseTransitionStarted')
        .filter(({ to }) => to === 'enemy')) {
        const windUp = play.all('windUpStarted').find(({ at }) => at > transition.at)!;
        expect(windUp.impacts[0]! - transition.at).toBeGreaterThanOrEqual(2_000);
      }
    }
  });

  it('keeps every event in time order, and the hero HP within its bounds', () => {
    for (const play of allPlays()) {
      const instants = play.events.map((event) => event.at);
      expect(instants).toEqual([...instants].sort((left, right) => left - right));
      for (const blow of play.all('blowResolved')) {
        expect(blow.heroHp).toBeGreaterThanOrEqual(0);
        expect(blow.heroHp).toBeLessThanOrEqual(80);
      }
    }
  });

  it('exercises every attack and every outcome, and is won by the hero', () => {
    const events = allPlays().flatMap((play) => play.events);
    const attacks = new Set(
      events.flatMap((event) => (event.type === 'windUpStarted' ? [event.attack] : [])),
    );
    const outcomes = new Set(
      events.flatMap((event) => (event.type === 'blowResolved' ? [event.outcome] : [])),
    );
    const endings = new Set(
      events.flatMap((event) => (event.type === 'battleEnded' ? [event.outcome] : [])),
    );

    expect([...attacks].sort()).toEqual(['basic', 'delayed', 'double', 'feint', 'perilous']);
    expect([...outcomes].sort()).toEqual([
      'dodge',
      'parry',
      'perfectParry',
      'perilousParry',
      'suffered',
    ]);
    expect([...endings].sort()).toEqual(['victory']);
  });
});
