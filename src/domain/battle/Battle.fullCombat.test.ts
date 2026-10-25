// Moteur du combat complet (#32) : frappe en rythme (C6), garde et étourdissement (C5), Élan et
// Rempart (C3), intentions Garde et Relever (C2), répit (C11) et transitions (C12), datés à la ms.
import type { AttackKind } from './attacks';
import {
  advance,
  dismissDefenseHint,
  heroAction,
  nextDeadline,
  pressDefense,
  pressStrike,
  startTrialBattle,
  type Battle,
  type BattleUpdate,
  type EnemyState,
} from './Battle';
import type { BattleEvent, DefenseButton } from './BattleEvent';
import { ATTACKS } from './attacks';
import { ENEMIES } from './combatants';
import type { Intent } from './intents';
import { shownIntent } from './shownIntent';
import { DEFAULT_TRIAL_TUNING } from './TrialTuning';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const GHOUL = 0;
const SPECTER = 1;
const NECROMANCER = 2;

function changeEnemy(enemy: number, change: Partial<EnemyState>): (battle: Battle) => Battle {
  return (battle) => ({
    ...battle,
    enemies: battle.enemies.map((current, index) =>
      index === enemy ? { ...current, ...change } : current,
    ),
  });
}

function attackIntent(enemy: number, attack: AttackKind): (battle: Battle) => Battle {
  return (battle) => {
    const move = ENEMIES[battle.enemies[enemy]!.kind].moves.find(
      (candidate) => candidate.attack === attack,
    );
    const intent: Intent = {
      category: 'attack',
      attack,
      damage: move?.damage ?? 5,
      windUpMs: ATTACKS[attack].windUpMs,
      feintFraction: 0.5,
    };
    return changeEnemy(enemy, { intent })(battle);
  };
}

/** Les trois ennemis au coup simple (le Spectre au coup retardé). */
const calmIntents = [
  attackIntent(GHOUL, 'basic'),
  attackIntent(SPECTER, 'delayed'),
  attackIntent(NECROMANCER, 'basic'),
];

/** Un ennemi étourdi : `heroAction` est l'action du héros pendant laquelle sa garde est tombée. */
function stunned(enemy: number, heroAction: number, actionLost = false) {
  return changeEnemy(enemy, { guard: 0, stun: { actionLost, heroAction } });
}

const withTarget =
  (target: number) =>
  (battle: Battle): Battle => ({ ...battle, target });

const withHero =
  (change: Partial<Battle['hero']>) =>
  (battle: Battle): Battle => ({ ...battle, hero: { ...battle.hero, ...change } });

class BattlePlay {
  battle: Battle;
  readonly events: BattleEvent[] = [];
  last: readonly BattleEvent[] = [];

  constructor(update: BattleUpdate) {
    this.battle = update.battle;
    this.record(update.events);
  }

  static start(seed = 7, defenseHint = false): BattlePlay {
    return new BattlePlay(
      startTrialBattle({ seed, tuning: DEFAULT_TRIAL_TUNING, defenseHint, at: 0 }),
    ).with(...calmIntents);
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

  strike(at: number): this {
    return this.apply(pressStrike(this.battle, { at }));
  }

  attack(releasedAt: number): this {
    return this.apply(
      heroAction(this.battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      }),
    );
  }

  bulwark(releasedAt: number): this {
    return this.apply(
      heroAction(this.battle, {
        action: { kind: 'power', power: 'bulwark' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      }),
    );
  }

  dismissHint(at: number): this {
    return this.apply(dismissDefenseHint(this.battle, at));
  }

  /** Avance d'échéance en échéance jusqu'à ce que `reached` soit vrai. */
  until(reached: (battle: Battle) => boolean): this {
    for (let guard = 0; guard < 200 && !reached(this.battle); guard += 1) {
      const deadline = nextDeadline(this.battle);
      if (deadline === null) throw new Error(`Battle waits in phase ${this.battle.phase.kind}`);
      this.advance(deadline.at + 1);
    }
    expect(reached(this.battle)).toBe(true);
    return this;
  }

  /** Jusqu'à la phase du héros suivante. */
  toHeroPhase(): this {
    return this.until((battle) => battle.phase.kind === 'hero').advance(this.battle.now);
  }

  /** Jusqu'à la préparation de `enemy` ; renvoie ses impacts. */
  toWindUpOf(enemy: number): readonly number[] {
    this.until(
      ({ phase }) =>
        phase.kind === 'enemy' && phase.step.kind === 'attack' && phase.step.enemy === enemy,
    );
    const { phase } = this.battle;
    return phase.kind === 'enemy' && phase.step.kind === 'attack'
      ? phase.step.impacts.map((impact) => impact.at)
      : [];
  }

  all<Type extends BattleEvent['type']>(type: Type): EventOf<Type>[] {
    return this.events.filter((event): event is EventOf<Type> => event.type === type);
  }

  lastOf<Type extends BattleEvent['type']>(type: Type): EventOf<Type> | undefined {
    return this.all(type).at(-1);
  }
}

// « Attaquer » relâché à 1 000 ms : l'impact de la frappe tombe à 1 700 ms (préparation de
// 700 ms), sa fenêtre se ferme à 1 860 ms, l'action du héros finit à 2 180 ms (récupération de
// 320 ms) sans arrêt sur image.
const ATTACK_AT = 1_000;
const STRIKE_IMPACT = 1_700;
const STRIKE_WINDOW_END = 1_860;
const HERO_ACTION_END = 2_180;

describe('timed strike (C6)', () => {
  /** La Goule, cible, avec une garde qu'aucune frappe ne brise. */
  const sturdy = changeEnemy(GHOUL, { guard: 99 });

  it('perfect strike 40 ms after the impact: 15 HP, 18 guard points, a hit-stop', () => {
    const play = BattlePlay.start()
      .with(sturdy)
      .attack(ATTACK_AT)
      .strike(STRIKE_IMPACT + 40);

    expect(play.last).toEqual([
      {
        type: 'strikeResolved',
        at: STRIKE_IMPACT + 40,
        enemy: GHOUL,
        judgement: 'perfect',
        delta: 40,
        damage: 15,
        guardDamage: 18,
      },
      { type: 'hitStopStarted', at: STRIKE_IMPACT + 40, until: STRIKE_IMPACT + 130 },
    ]);
    expect(play.battle.enemies[GHOUL]).toMatchObject({ hp: 35, guard: 81, stun: null });
    // La fin de l'action est décalée par l'arrêt sur image.
    expect(play.battle.phase).toMatchObject({
      kind: 'heroStrike',
      resolved: true,
      until: HERO_ACTION_END + 90,
    });
  });

  it('a perfect strike that breaks the guard stops the time only once', () => {
    const play = BattlePlay.start()
      .attack(ATTACK_AT)
      .strike(STRIKE_IMPACT + 40);

    expect(play.last.map((event) => event.type)).toEqual([
      'strikeResolved',
      'guardBroken',
      'hitStopStarted',
    ]);
    expect(play.lastOf('guardBroken')).toEqual({
      type: 'guardBroken',
      at: STRIKE_IMPACT + 40,
      enemy: GHOUL,
      by: 'strike',
    });
    expect(play.battle.phase).toMatchObject({ until: HERO_ACTION_END + 90 });
  });

  it('good strike 120 ms before the impact: 12 HP and 14 guard points, judged at the impact', () => {
    const play = BattlePlay.start()
      .attack(ATTACK_AT)
      .strike(STRIKE_IMPACT - 120);

    expect(play.last).toEqual([]);
    expect(play.battle.phase).toMatchObject({
      press: { at: STRIKE_IMPACT - 120, delta: -120, judgement: 'good' },
    });
    expect(nextDeadline(play.battle)).toEqual({ at: STRIKE_IMPACT, awaitsPress: false });

    play.advance(STRIKE_IMPACT);
    expect(play.last).toEqual([
      {
        type: 'strikeResolved',
        at: STRIKE_IMPACT,
        enemy: GHOUL,
        judgement: 'good',
        delta: -120,
        damage: 12,
        guardDamage: 14,
      },
    ]);
    expect(play.battle.enemies[GHOUL]).toMatchObject({ hp: 38, guard: 1 });
  });

  it('without a press: 10 HP and 12 guard points, at the end of the window, never off-balance', () => {
    const play = BattlePlay.start().attack(ATTACK_AT).advance(STRIKE_WINDOW_END);

    expect(play.all('strikeResolved')).toEqual([]);
    play.advance(STRIKE_WINDOW_END + 1);
    expect(play.lastOf('strikeResolved')).toEqual({
      type: 'strikeResolved',
      at: STRIKE_WINDOW_END,
      enemy: GHOUL,
      judgement: null,
      delta: null,
      damage: 10,
      guardDamage: 12,
    });
    expect(play.battle.offBalanceUntil).toBeNull();
    expect(play.all('offBalanceStarted')).toEqual([]);
  });

  it('judges only the first press: 300 ms early, then at the impact, gives no bonus', () => {
    const play = BattlePlay.start()
      .attack(ATTACK_AT)
      .strike(STRIKE_IMPACT - 300);
    play.strike(STRIKE_IMPACT);

    expect(play.last).toEqual([
      expect.objectContaining({
        type: 'strikeResolved',
        at: STRIKE_IMPACT,
        judgement: 'miss',
        delta: -300,
        damage: 10,
      }),
      { type: 'pressIgnored', at: STRIKE_IMPACT, button: 'strike', reason: 'notAvailable' },
    ]);
    expect(play.battle.offBalanceUntil).toBeNull();
  });

  it('has no random critical: the same delta gives the same damage whatever the seed (C6.3)', () => {
    const damages = [3, 7, 11, 19, 42].map(
      (seed) =>
        BattlePlay.start(seed)
          .with(sturdy)
          .attack(ATTACK_AT)
          .strike(STRIKE_IMPACT + 40)
          .lastOf('strikeResolved')!.damage,
    );

    expect(damages).toEqual([15, 15, 15, 15, 15]);
  });

  it('judges a press 150 ms after the impact as good, and ends the action after the window and its animation', () => {
    const play = BattlePlay.start()
      .attack(ATTACK_AT)
      .strike(STRIKE_IMPACT + 150);

    expect(play.lastOf('strikeResolved')).toMatchObject({ judgement: 'good', delta: 150 });
    play.advance(HERO_ACTION_END - 1);
    expect(play.battle.phase.kind).toBe('heroStrike');
    play.advance(HERO_ACTION_END);
    expect(play.lastOf('phaseTransitionStarted')).toEqual({
      type: 'phaseTransitionStarted',
      at: HERO_ACTION_END,
      to: 'enemy',
      until: HERO_ACTION_END + 800,
    });
  });

  it('judges a press made exactly at the end of the window', () => {
    const play = BattlePlay.start().attack(ATTACK_AT).strike(STRIKE_WINDOW_END);

    expect(play.lastOf('strikeResolved')).toMatchObject({ judgement: 'good', delta: 160 });
  });

  it('ignores « Frapper » outside the strike and once the strike is resolved', () => {
    const hero = BattlePlay.start().strike(300);
    expect(hero.last).toEqual([
      { type: 'pressIgnored', at: 300, button: 'strike', reason: 'notAvailable' },
    ]);

    const resolved = BattlePlay.start().attack(ATTACK_AT).advance(1_900).strike(1_950);
    expect(resolved.last).toEqual([
      { type: 'pressIgnored', at: 1_950, button: 'strike', reason: 'notAvailable' },
    ]);

    const transition = BattlePlay.start()
      .attack(ATTACK_AT)
      .strike(HERO_ACTION_END + 100);
    expect(transition.lastOf('pressIgnored')).toEqual({
      type: 'pressIgnored',
      at: HERO_ACTION_END + 100,
      button: 'strike',
      reason: 'phaseTransition',
    });
  });

  it('dates a strike press during the hit-stop at its start', () => {
    const play = BattlePlay.start()
      .with(sturdy)
      .attack(ATTACK_AT)
      .strike(STRIKE_IMPACT)
      .strike(STRIKE_IMPACT + 30);

    expect(play.lastOf('pressIgnored')).toMatchObject({ at: STRIKE_IMPACT });
  });

  it('deals ×1.5 to a stunned enemy, and no guard damage (C5.2, C5.8)', () => {
    const plain = BattlePlay.start()
      .with(stunned(GHOUL, 0, true))
      .attack(ATTACK_AT);
    plain.advance(STRIKE_WINDOW_END + 1);
    expect(plain.lastOf('strikeResolved')).toMatchObject({ damage: 15, guardDamage: 0 });
    expect(plain.all('guardBroken')).toEqual([]);
    expect(plain.battle.enemies[GHOUL]).toMatchObject({ hp: 35, guard: 0 });

    const perfect = BattlePlay.start()
      .with(stunned(GHOUL, 0, true))
      .attack(ATTACK_AT)
      .strike(STRIKE_IMPACT);
    expect(perfect.lastOf('strikeResolved')).toMatchObject({ damage: 22, guardDamage: 0 });
  });
});

describe('momentum and the Bulwark (C3)', () => {
  it('starts at 1, gains 1 with an attack', () => {
    const play = BattlePlay.start();
    expect(play.battle.hero.momentum).toBe(1);

    play.attack(ATTACK_AT);
    expect(play.lastOf('momentumChanged')).toEqual({
      type: 'momentumChanged',
      at: ATTACK_AT,
      momentum: 2,
    });
    expect(play.battle.hero.momentum).toBe(2);
    expect(play.battle.heroActions).toBe(1);
    expect(play.battle.lastPlayed).toBe('hero');
  });

  it('uses the Bulwark for 1 momentum: 500 ms, then the transition to the enemy phase', () => {
    const play = BattlePlay.start().bulwark(ATTACK_AT);

    expect(play.last).toEqual([
      { type: 'powerUsed', at: ATTACK_AT, power: 'bulwark', until: ATTACK_AT + 500 },
      { type: 'momentumChanged', at: ATTACK_AT, momentum: 0 },
    ]);
    expect(play.battle.hero).toMatchObject({ momentum: 0, bulwark: true });
    expect(play.battle.phase).toEqual({
      kind: 'heroPower',
      power: 'bulwark',
      since: ATTACK_AT,
      until: ATTACK_AT + 500,
    });
    expect(play.battle.heroActions).toBe(1);

    play.advance(ATTACK_AT + 500);
    expect(play.lastOf('phaseTransitionStarted')).toEqual({
      type: 'phaseTransitionStarted',
      at: ATTACK_AT + 500,
      to: 'enemy',
      until: ATTACK_AT + 1_300,
    });
  });

  it('halves the next blow suffered, after the damage reduction, then wears off', () => {
    const play = BattlePlay.start().with(attackIntent(GHOUL, 'double')).bulwark(ATTACK_AT);
    play.toWindUpOf(GHOUL);
    play.until(({ phase }) => phase.kind === 'enemy' && phase.step.enemy === SPECTER);

    // 3 × 0,9 × 0,5 = 1,35 : 1 PV ; puis 3 × 0,9 = 2,7 : 2 PV.
    expect(play.all('blowResolved').map((blow) => blow.damage)).toEqual([1, 2]);
    expect(play.battle.hero.bulwark).toBe(false);
  });

  it('is not spent by a dodge or a perfect parry', () => {
    const play = BattlePlay.start().with(attackIntent(GHOUL, 'double')).bulwark(ATTACK_AT);
    const [first, second] = play.toWindUpOf(GHOUL);

    play.press('dodge', first!).press('parry', second!);

    expect(play.battle.hero.bulwark).toBe(true);
  });

  it('is visible but unavailable without enough momentum', () => {
    const play = BattlePlay.start()
      .with(withHero({ momentum: 0 }))
      .bulwark(ATTACK_AT);

    expect(play.last).toEqual([
      { type: 'pressIgnored', at: ATTACK_AT, button: 'power', reason: 'notAvailable' },
    ]);
    expect(play.battle.phase.kind).toBe('hero');
    expect(play.battle.hero.momentum).toBe(0);
  });

  it('gains 1 momentum by perfect parry, capped at 5', () => {
    const play = BattlePlay.start()
      .with(attackIntent(GHOUL, 'double'), changeEnemy(GHOUL, { guard: 99 }))
      .attack(ATTACK_AT);
    const [first] = play.toWindUpOf(GHOUL);
    play.press('parry', first!);
    expect(play.battle.hero.momentum).toBe(3);

    const capped = BattlePlay.start()
      .with(withHero({ momentum: 4 }), changeEnemy(GHOUL, { guard: 99 }))
      .attack(ATTACK_AT);
    const [impact] = capped.toWindUpOf(GHOUL);
    capped.press('parry', impact!);
    expect(capped.battle.hero.momentum).toBe(5);
    expect(capped.lastOf('momentumChanged')).toMatchObject({ momentum: 5, at: ATTACK_AT });
  });
});

describe('guard break and stun (C5)', () => {
  it('stuns the Specter when a strike brings its guard from 8 to 0 (C5.1)', () => {
    const play = BattlePlay.start()
      .with(changeEnemy(SPECTER, { guard: 8 }), withTarget(SPECTER))
      .attack(ATTACK_AT)
      .advance(STRIKE_WINDOW_END + 1);

    expect(play.last).toEqual([
      expect.objectContaining({ type: 'strikeResolved', enemy: SPECTER, guardDamage: 12 }),
      { type: 'guardBroken', at: STRIKE_WINDOW_END, enemy: SPECTER, by: 'strike' },
      { type: 'hitStopStarted', at: STRIKE_WINDOW_END, until: STRIKE_WINDOW_END + 90 },
    ]);
    expect(play.battle.enemies[SPECTER]).toMatchObject({
      guard: 0,
      stun: { actionLost: false, heroAction: 1 },
    });
    expect(shownIntent(play.battle, SPECTER)).toEqual({ category: 'skip', reason: 'stunned' });
  });

  it('break by the hero: lost action, then guard restore at the end of the next hero action', () => {
    const end = HERO_ACTION_END + 90;
    const play = BattlePlay.start()
      .with(changeEnemy(GHOUL, { guard: 8 }))
      .attack(ATTACK_AT)
      .advance(STRIKE_WINDOW_END + 1)
      .advance(end);

    // La Goule perd son action, 250 ms, sans transition ni avancée.
    expect(play.last).toEqual([{ type: 'actionLost', at: end, enemy: GHOUL, until: end + 250 }]);
    expect(play.battle.phase).toEqual({
      kind: 'enemy',
      step: { kind: 'lostAction', enemy: GHOUL, since: end, until: end + 250 },
    });
    expect(play.battle.lastPlayed).toBe('hero');
    expect(shownIntent(play.battle, GHOUL)).toBeNull();

    // Puis le Spectre agit, après la transition de phase.
    play.advance(end + 250);
    expect(play.last).toEqual([
      { type: 'phaseTransitionStarted', at: end + 250, to: 'enemy', until: end + 1_050 },
    ]);

    // Manche 2 : la Goule n'affiche aucune intention ; frappée sans appui, 15 PV et aucune garde.
    play.toHeroPhase();
    expect(play.battle.round).toBe(2);
    expect(shownIntent(play.battle, GHOUL)).toBeNull();
    const at = play.battle.now + 300;
    play.attack(at).advance(at + 860 + 1);
    expect(play.lastOf('strikeResolved')).toMatchObject({ damage: 15, guardDamage: 0 });
    expect(play.battle.enemies[GHOUL]!.guard).toBe(0);

    // À la fin de cette action, la Goule se relève en 400 ms, garde 15, intention affichée.
    play.advance(at + 1_180);
    expect(play.lastOf('guardRestored')).toEqual({
      type: 'guardRestored',
      at: at + 1_180,
      enemy: GHOUL,
      until: at + 1_580,
      inPlaceOfAction: false,
    });
    expect(play.battle.enemies[GHOUL]).toMatchObject({
      guard: 15,
      stun: null,
      guardRestore: { since: at + 1_180, until: at + 1_580 },
    });
    expect(shownIntent(play.battle, GHOUL)).not.toBeNull();

    // Elle agit normalement dans la phase ennemie de la manche 2.
    play.until(({ phase }) => phase.kind === 'enemy' && phase.step.kind === 'stepIn');
    expect(play.lastOf('stepInStarted')).toMatchObject({ enemy: GHOUL });
  });

  it('break by a counter: the guard restore takes the place of the lost action (C5.5, C5.6)', () => {
    const play = BattlePlay.start()
      .with(changeEnemy(GHOUL, { guard: 10 }), changeEnemy(SPECTER, { guard: 99 }))
      .with(withTarget(SPECTER))
      .attack(ATTACK_AT);
    const [impact] = play.toWindUpOf(GHOUL);

    play.press('parry', impact!).advance(impact! + 90);
    expect(play.last).toEqual([
      {
        type: 'counterAttacked',
        at: impact! + 90,
        enemy: GHOUL,
        damage: 6,
        guardDamage: 12,
        until: impact! + 490,
      },
      { type: 'guardBroken', at: impact! + 90, enemy: GHOUL, by: 'counter' },
      { type: 'hitStopStarted', at: impact! + 90, until: impact! + 180 },
    ]);
    // La contre-attaque est prolongée par l'arrêt sur image de la cassure.
    expect(play.battle.phase).toMatchObject({ step: { counter: { until: impact! + 580 } } });

    // Manche 2 : cercle barré ; la Sentinelle utilise Rempart.
    play.toHeroPhase();
    expect(shownIntent(play.battle, GHOUL)).toEqual({ category: 'skip', reason: 'stunned' });
    const at = play.battle.now + 300;
    play.bulwark(at).advance(at + 499);
    expect(play.battle.enemies[GHOUL]!.guard).toBe(0);
    play.advance(at + 500);

    // Son action est son retour en garde : 400 ms, sans avancée ni attaque ni transition.
    expect(play.last).toEqual([
      { type: 'guardRestored', at: at + 500, enemy: GHOUL, until: at + 900, inPlaceOfAction: true },
    ]);
    expect(play.battle.phase).toEqual({
      kind: 'enemy',
      step: { kind: 'guardRestore', enemy: GHOUL, since: at + 500, until: at + 900 },
    });
    expect(play.battle.enemies[GHOUL]).toMatchObject({ guard: 15, stun: null, intent: null });
    expect(shownIntent(play.battle, GHOUL)).toBeNull();
    play.advance(at + 900);
    expect(play.last).toEqual([
      { type: 'phaseTransitionStarted', at: at + 900, to: 'enemy', until: at + 1_700 },
    ]);

    // Manche 3 : la Goule agit.
    play.toHeroPhase();
    const third = play.battle.now + 300;
    play.attack(third);
    play.until(({ phase }) => phase.kind === 'enemy' && phase.step.kind === 'stepIn');
    expect(play.lastOf('stepInStarted')).toMatchObject({ enemy: GHOUL });
  });

  it('counts the hero action even when it targets another enemy (C5.3)', () => {
    const play = BattlePlay.start()
      .with(stunned(GHOUL, 0, true), changeEnemy(SPECTER, { guard: 99 }), withTarget(SPECTER))
      .attack(ATTACK_AT)
      .advance(STRIKE_WINDOW_END + 1)
      .advance(HERO_ACTION_END);

    expect(play.last[0]).toEqual({
      type: 'guardRestored',
      at: HERO_ACTION_END,
      enemy: GHOUL,
      until: HERO_ACTION_END + 400,
      inPlaceOfAction: false,
    });
  });

  it('chains the lost actions of three stunned enemies, then announces « À toi » without transition (C5.4)', () => {
    const play = BattlePlay.start()
      .with(stunned(GHOUL, 1), stunned(SPECTER, 1), stunned(NECROMANCER, 1))
      .attack(ATTACK_AT)
      .advance(HERO_ACTION_END + 750);

    expect(play.all('actionLost')).toEqual([
      { type: 'actionLost', at: HERO_ACTION_END, enemy: GHOUL, until: HERO_ACTION_END + 250 },
      {
        type: 'actionLost',
        at: HERO_ACTION_END + 250,
        enemy: SPECTER,
        until: HERO_ACTION_END + 500,
      },
      {
        type: 'actionLost',
        at: HERO_ACTION_END + 500,
        enemy: NECROMANCER,
        until: HERO_ACTION_END + 750,
      },
    ]);
    expect(play.all('phaseTransitionStarted')).toEqual([]);
    expect(play.lastOf('heroPhaseStarted')).toEqual({
      type: 'heroPhaseStarted',
      at: HERO_ACTION_END + 750,
      announced: true,
    });
    expect(play.battle.phase).toEqual({
      kind: 'hero',
      since: HERO_ACTION_END + 750,
      announced: true,
    });
    expect(play.battle.round).toBe(2);
  });

  it('shows the defense hint before the first transition, after a lost action', () => {
    const play = BattlePlay.start(7, true)
      .with(stunned(GHOUL, 1))
      .attack(ATTACK_AT)
      .advance(HERO_ACTION_END + 250);

    expect(play.lastOf('defenseHintShown')).toEqual({
      type: 'defenseHintShown',
      at: HERO_ACTION_END + 250,
    });
    play.dismissHint(5_000).advance(5_800);
    expect(play.lastOf('stepInStarted')).toMatchObject({ at: 5_800, enemy: SPECTER });
  });

  it('fells a stunned enemy at 0 HP: no stars nor guard restore remain (C5.9)', () => {
    const play = BattlePlay.start()
      .with(stunned(GHOUL, 0, true), changeEnemy(GHOUL, { hp: 10 }))
      .attack(ATTACK_AT)
      .advance(HERO_ACTION_END);

    expect(play.all('enemyDefeated')).toEqual([
      { type: 'enemyDefeated', at: STRIKE_WINDOW_END, enemy: GHOUL },
    ]);
    expect(play.battle.enemies[GHOUL]).toMatchObject({ hp: 0, stun: null });
    expect(play.all('guardRestored')).toEqual([]);
  });

  it('draws the same values whether or not a guard breaks (C2.1)', () => {
    const broken = BattlePlay.start()
      .with(changeEnemy(GHOUL, { guard: 8 }))
      .attack(ATTACK_AT);
    const intact = BattlePlay.start().attack(ATTACK_AT);
    broken.toHeroPhase();
    intact.toHeroPhase();

    expect(broken.battle.random).toBe(intact.battle.random);
    expect(broken.battle.enemies[GHOUL]!.intent).toEqual(intact.battle.enemies[GHOUL]!.intent);
  });
});

describe('the Guard and Raise intents (C2)', () => {
  it('raises the guard of the Necromancer by 3 when it plays its Guard intent', () => {
    const play = BattlePlay.start()
      .with(
        changeEnemy(NECROMANCER, { guard: 4, intent: { category: 'guard', gain: 3 } }),
        changeEnemy(GHOUL, { guard: 99 }),
      )
      .attack(ATTACK_AT);
    play.until(({ phase }) => phase.kind === 'enemy' && phase.step.enemy === NECROMANCER);
    expect(play.battle.enemies[NECROMANCER]!.guard).toBe(4);

    play.until(({ phase }) => phase.kind === 'enemy' && phase.step.kind === 'support');
    const stepInEnd = play.lastOf('stepInStarted')!.until;
    expect(play.last).toEqual([
      { type: 'guardRaised', at: stepInEnd, enemy: NECROMANCER, gain: 3, guard: 7 },
    ]);
    expect(play.battle.phase).toEqual({
      kind: 'enemy',
      step: {
        kind: 'support',
        enemy: NECROMANCER,
        intent: { category: 'guard', gain: 3 },
        since: stepInEnd,
        until: stepInEnd + 400,
      },
    });
    play.advance(stepInEnd + 400);
    expect(play.lastOf('phaseTransitionStarted')).toMatchObject({
      at: stepInEnd + 400,
      to: 'hero',
    });
  });

  it('never raises the guard above its maximum', () => {
    const play = BattlePlay.start()
      .with(
        changeEnemy(NECROMANCER, { guard: 11, intent: { category: 'guard', gain: 3 } }),
        changeEnemy(GHOUL, { guard: 99 }),
      )
      .attack(ATTACK_AT);
    play.until(({ phase }) => phase.kind === 'enemy' && phase.step.kind === 'support');

    expect(play.lastOf('guardRaised')).toMatchObject({ gain: 3, guard: 12 });
  });

  it('raises a fallen ally at 50 % of its HP, full guard, acting from the next round', () => {
    const play = BattlePlay.start()
      .with(
        changeEnemy(GHOUL, { hp: 0 }),
        changeEnemy(SPECTER, { guard: 99 }),
        changeEnemy(NECROMANCER, { intent: { category: 'raise', ally: GHOUL } }),
        withTarget(SPECTER),
      )
      .attack(ATTACK_AT);
    play.until(({ phase }) => phase.kind === 'enemy' && phase.step.kind === 'support');

    expect(play.lastOf('allyRaised')).toMatchObject({ enemy: NECROMANCER, ally: GHOUL, hp: 25 });
    expect(play.battle.enemies[GHOUL]).toMatchObject({
      hp: 25,
      guard: 15,
      stun: null,
      intent: null,
      raised: true,
      raisedRound: 1,
    });
    expect(shownIntent(play.battle, GHOUL)).toEqual({ category: 'skip', reason: 'raised' });

    play.toHeroPhase();
    expect(play.battle.turn.order).toEqual(['hero', GHOUL, SPECTER, NECROMANCER]);
    expect(shownIntent(play.battle, GHOUL)).not.toBeNull();
    // Le Nécromancien ne relève jamais deux fois le même allié.
    expect(play.battle.enemies[NECROMANCER]!.intent?.category).not.toBe('raise');
  });

  it('never lets a fallen enemy act (C1)', () => {
    const play = BattlePlay.start()
      .with(changeEnemy(SPECTER, { hp: 0 }))
      .attack(ATTACK_AT)
      .toHeroPhase();

    expect(play.all('stepInStarted').map((event) => event.enemy)).toEqual([GHOUL, NECROMANCER]);
    expect(play.all('actionLost')).toEqual([]);
  });
});
