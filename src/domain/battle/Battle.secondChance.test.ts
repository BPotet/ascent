// La seconde chance (#206) : donnée par la faveur pleine, elle relève une fois le héros qu'un coup
// ennemi fait tomber à 0 PV, avec 50 % de ses PV max. Seuls les impacts restants du coup sont
// annulés ; la Brûlure s'éteint, le Saignement s'arrête, l'Élan et le pouvoir actif restent.
import { ATTACKS, type AttackKind } from './attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  pressDefense,
  pressStrike,
  resumeBattle,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleUpdate,
  type HeroState,
} from './Battle';
import type { BattleEvent, DefenseButton } from './BattleEvent';
import type { EnemyKind, HeroKind } from './combatants';
import type { AttackIntent, Intent } from './intents';
import { COUNTER_MS, OFF_BALANCE_MS } from './rules';
import { SECOND_CHANCE_MS } from './secondChance';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const GHOUL = 0;
const VILLAGER = 1;

function attackIntent(
  attack: AttackKind = 'basic',
  damage = 5,
  extra: Partial<AttackIntent> = {},
): AttackIntent {
  return {
    category: 'attack',
    attack,
    damage,
    windUpMs: ATTACKS[attack].windUpMs,
    feintFraction: 0.5,
    ...extra,
  };
}

interface Setup {
  readonly hero?: HeroKind;
  /** Les PV au moment du coup (après l'action du héros). */
  readonly heroHp?: number;
  readonly heroMaxHp?: number;
  readonly secondChance?: boolean;
  readonly enemies?: readonly EnemyKind[];
  /** Les intentions forcées des ennemis, de gauche à droite. */
  readonly intents?: readonly Intent[];
  readonly inputOffset?: number;
  /** La Sentinelle active son Rempart ; sinon le héros attaque. */
  readonly bulwark?: boolean;
  readonly heroChange?: Partial<HeroState>;
  readonly seed?: number;
  /** Attendre la préparation du 1er ennemi ; sinon, le test commence après l'action du héros. */
  readonly toAttack?: boolean;
}

class SecondChanceTest {
  battle: Battle;
  readonly events: BattleEvent[] = [];

  private constructor(battle: Battle) {
    this.battle = battle;
  }

  /**
   * Le héros (80 PV max) agit, puis prend `heroHp` PV et `heroChange` ; les ennemis reçoivent
   * leurs intentions, sans étourdissement : le test commence à la préparation du 1er ennemi.
   */
  static start({
    hero = 'sentinel',
    heroHp = 3,
    heroMaxHp = 80,
    secondChance = true,
    enemies = ['ghoul', 'madVillager'],
    intents = [attackIntent(), attackIntent()],
    inputOffset = 0,
    bulwark = false,
    heroChange = {},
    seed = 7,
    toAttack = true,
  }: Setup = {}): SecondChanceTest {
    const { battle } = startBattle({
      seed,
      defenseHint: false,
      at: 0,
      hero,
      heroMaxHp,
      inputOffset,
      enemies,
      ...(secondChance && { secondChance }),
    });
    const test = new SecondChanceTest(battle);
    test.act(bulwark ? { kind: 'power', power: 'bulwark' } : { kind: 'attack' }, 100);
    test.until(({ phase }) => phase.kind !== 'hero' && phase.kind !== 'heroStrike');
    test.battle = {
      ...test.battle,
      hero: { ...test.battle.hero, hp: heroHp, ...heroChange },
      enemies: test.battle.enemies.map((enemy, index) => ({
        ...enemy,
        guard: enemy.maxGuard,
        stun: null,
        intent: intents[index] ?? enemy.intent,
      })),
    };
    if (toAttack) {
      test.until(({ phase }) => phase.kind === 'enemy' && phase.step.kind === 'attack');
    }
    test.events.length = 0;
    return test;
  }

  act(action: Parameters<typeof heroAction>[1]['action'], releasedAt: number): this {
    return this.apply(
      heroAction(this.battle, { action, touchStartedAt: releasedAt - 10, releasedAt }),
    );
  }

  private apply(update: BattleUpdate): this {
    this.battle = update.battle;
    this.events.push(...update.events);
    return this;
  }

  get step(): AttackStep {
    return (this.battle.phase as { readonly step: AttackStep }).step;
  }

  impact(index: number): number {
    return this.step.impacts[index]!.at;
  }

  press(button: DefenseButton, at: number): this {
    return this.apply(pressDefense(this.battle, { button, at }));
  }

  strike(at: number): this {
    return this.apply(pressStrike(this.battle, { at }));
  }

  advance(until: number): this {
    return this.apply(advance(this.battle, until));
  }

  /** Avance d'échéance en échéance jusqu'à `done` (ou la fin du combat). */
  until(done: (battle: Battle) => boolean): this {
    for (let guard = 0; guard < 200 && !done(this.battle); guard += 1) {
      const deadline = nextDeadline(this.battle);
      if (deadline === null) return this;
      this.advance(deadline.at + (deadline.awaitsPress ? 1 : 0));
    }
    return this;
  }

  all<Type extends BattleEvent['type']>(type: Type): EventOf<Type>[] {
    return this.events.filter((event): event is EventOf<Type> => event.type === type);
  }

  rise(): EventOf<'secondChanceUsed'> {
    const [used] = this.all('secondChanceUsed');
    if (used === undefined) throw new Error('the hero did not rise');
    return used;
  }
}

describe('the second chance in battle (#206)', () => {
  describe('given at the start of the battle', () => {
    const options = { seed: 3, defenseHint: false, at: 0, enemies: ['ghoul'] as const };

    it('is absent without the option: the hero is the same as before', () => {
      const { battle } = startBattle(options);

      expect(battle.hero).not.toHaveProperty('secondChance');
      expect(JSON.stringify(startBattle({ ...options, secondChance: false }))).toEqual(
        JSON.stringify(startBattle(options)),
      );
    });

    it('is ready with the option', () => {
      expect(startBattle({ ...options, secondChance: true }).battle.hero.secondChance).toBe(
        'ready',
      );
    });
  });

  describe('rising once', () => {
    it('raises the hero of 80 max HP with 40 HP, and the battle goes on', () => {
      const test = SecondChanceTest.start();
      const { resolvedAt } = test.step;

      test.advance(resolvedAt + 1);

      expect(test.events).toEqual([
        { type: 'impactLanded', at: test.impact(0), enemy: GHOUL, index: 0, lost: false },
        expect.objectContaining({ type: 'blowResolved', at: resolvedAt, damage: 4, heroHp: 0 }),
        {
          type: 'secondChanceUsed',
          at: resolvedAt,
          until: resolvedAt + SECOND_CHANCE_MS,
          enemy: GHOUL,
          hp: 40,
          cancelled: 0,
        },
      ]);
      expect(test.battle.hero).toMatchObject({ hp: 40, secondChance: 'used' });
      expect(test.battle.phase).toMatchObject({ kind: 'enemy', step: { kind: 'attack' } });
      expect(test.step).toMatchObject({
        resolvedAt: resolvedAt + SECOND_CHANCE_MS,
        secondChance: { since: resolvedAt, until: resolvedAt + SECOND_CHANCE_MS },
      });
    });

    it('waits for the end of the rise before the next enemy steps in', () => {
      const test = SecondChanceTest.start();
      const { resolvedAt } = test.step;
      const until = resolvedAt + SECOND_CHANCE_MS;

      test.advance(until - 1);
      expect(test.all('stepInStarted')).toEqual([]);

      test.advance(until);
      expect(test.all('stepInStarted')).toEqual([
        expect.objectContaining({ at: until, enemy: VILLAGER }),
      ]);
    });

    it.each([
      ['an 88 max HP Sentinel (Rare Vigor)', 88, 44],
      ['a tired Sentinel of 72 max HP', 72, 36],
    ])('raises %s with 50 % of her max HP', (_, heroMaxHp, hp) => {
      const test = SecondChanceTest.start({ heroMaxHp });

      test.advance(test.step.resolvedAt + 1);

      expect(test.rise().hp).toBe(hp);
      expect(test.battle.hero.hp).toBe(hp);
    });

    it('also raises the hero after a perilous parry, then keeps the off-balance (C8)', () => {
      const test = SecondChanceTest.start({
        intents: [attackIntent('perilous', 9), attackIntent()],
      });
      const at = test.impact(0);

      test.press('parry', at);

      expect(test.all('blowResolved')).toEqual([
        expect.objectContaining({ outcome: 'perilousParry', heroHp: 0 }),
      ]);
      expect(test.rise()).toMatchObject({ at, hp: 40, cancelled: 0 });
      expect(test.all('offBalanceStarted')).toEqual([
        { type: 'offBalanceStarted', at, until: at + OFF_BALANCE_MS },
      ]);
      expect(test.all('battleEnded')).toEqual([]);
    });

    it('is a defeat, as before, once the second chance was used', () => {
      const test = SecondChanceTest.start({ heroChange: { secondChance: 'used' } });

      test.advance(test.step.resolvedAt + 1);

      expect(test.all('secondChanceUsed')).toEqual([]);
      expect(test.all('battleEnded')).toEqual([expect.objectContaining({ outcome: 'defeat' })]);
      expect(test.battle.hero).toMatchObject({ hp: 0, secondChance: 'used' });
    });

    it('is a defeat, as before, without a second chance', () => {
      const test = SecondChanceTest.start({ secondChance: false });

      test.advance(test.step.resolvedAt + 1);

      expect(test.all('battleEnded')).toEqual([expect.objectContaining({ outcome: 'defeat' })]);
      expect(test.battle.hero).not.toHaveProperty('secondChance');
    });

    it('is a defeat at the next fall in the same battle', () => {
      const test = SecondChanceTest.start({
        intents: [attackIntent(), attackIntent('basic', 60)],
      });

      test.until(({ phase }) => phase.kind === 'over');

      expect(test.all('secondChanceUsed')).toHaveLength(1);
      expect(test.all('battleEnded')).toEqual([expect.objectContaining({ outcome: 'defeat' })]);
    });
  });

  describe('the blow in progress, only it', () => {
    it('cancels the second impact of a double strike, then the second enemy acts as planned', () => {
      const test = SecondChanceTest.start({
        intents: [attackIntent('double'), attackIntent('basic', 2)],
      });
      const first = test.impact(0);

      test.advance(first + 5_000);

      const rise = test.rise();
      expect(rise).toMatchObject({ enemy: GHOUL, hp: 40, cancelled: 1 });
      expect(test.all('impactLanded').filter((each) => each.enemy === GHOUL)).toHaveLength(1);
      expect(test.all('blowResolved').filter((each) => each.enemy === GHOUL)).toHaveLength(1);
      expect(test.all('stepInStarted')).toEqual([
        expect.objectContaining({ at: rise.until, enemy: VILLAGER }),
      ]);
      expect(test.all('blowResolved').filter((each) => each.enemy === VILLAGER)).toEqual([
        expect.objectContaining({ heroHp: 39 }),
      ]);
      test.until(({ phase }) => phase.kind === 'hero');
      expect(test.all('phaseTransitionStarted').at(-1)).toMatchObject({ to: 'hero' });
      expect(test.all('battleEnded')).toEqual([]);
    });

    it('cancels nothing when the hero falls on the last impact', () => {
      const test = SecondChanceTest.start({
        heroHp: 6,
        intents: [attackIntent('double'), attackIntent()],
      });

      test.advance(test.impact(1) + 1_000);

      expect(test.all('blowResolved').filter((each) => each.enemy === GHOUL)).toHaveLength(2);
      expect(test.rise()).toMatchObject({ cancelled: 0 });
    });

    it('withdraws a second impact that already landed, with an input offset below −260 ms', () => {
      const test = SecondChanceTest.start({
        inputOffset: -300,
        intents: [attackIntent('double'), attackIntent()],
      });
      const [first, second] = [test.impact(0), test.impact(1)];

      test.advance(first + 461);

      expect(test.all('impactLanded')).toEqual([
        expect.objectContaining({ at: first, index: 0 }),
        expect.objectContaining({ at: second, index: 1 }),
      ]);
      expect(test.rise()).toMatchObject({ at: first + 460, cancelled: 1 });
      expect(test.step.impacts).toHaveLength(1);

      test.advance(first + 5_000);
      expect(test.all('blowResolved').filter((each) => each.enemy === GHOUL)).toHaveLength(1);
    });
  });

  describe('Burn and Bleed', () => {
    it('never trigger it: at 2 HP, 3 Burn stacks and a Bleed, the round leaves the hero at 1 HP', () => {
      const guard = { category: 'guard', gain: 1 } as const;
      const test = SecondChanceTest.start({
        heroHp: 2,
        intents: [guard, guard],
        heroChange: { burn: 3, bleed: { damage: 2, rounds: 2 } },
        toAttack: false,
      });

      test.until(({ round }) => round === 2);

      expect(test.all('bleedTicked')).toHaveLength(1);
      expect(test.all('burnTicked')).toHaveLength(1);
      expect(test.battle.hero).toMatchObject({ hp: 1, secondChance: 'ready' });
      expect(test.all('secondChanceUsed')).toEqual([]);
    });

    it('are put out by the rise, and the falling blow adds neither stacks nor Bleed', () => {
      const test = SecondChanceTest.start({
        intents: [attackIntent('basic', 5, { burn: 2, bleed: { damage: 3, rounds: 3 } })],
        heroChange: { burn: 4, bleed: { damage: 2, rounds: 2 } },
      });
      const { resolvedAt } = test.step;

      test.advance(resolvedAt + 1);

      expect(test.all('burnCleared')).toEqual([{ type: 'burnCleared', at: resolvedAt }]);
      expect(test.all('heroBurning')).toEqual([]);
      expect(test.all('heroBleeding')).toEqual([]);
      expect(test.battle.hero).not.toHaveProperty('burn');
      expect(test.battle.hero).not.toHaveProperty('bleed');
      expect(test.battle.hero.hp).toBe(40);
    });

    it('sends no burnCleared when the hero does not burn', () => {
      const test = SecondChanceTest.start();

      test.advance(test.step.resolvedAt + 1);

      expect(test.all('burnCleared')).toEqual([]);
    });
  });

  describe('Momentum and the active power', () => {
    it("keep the Wanderer's 3 Momentum and her Shadow step", () => {
      const test = SecondChanceTest.start({
        hero: 'wanderer',
        heroChange: { momentum: 3, shadowStep: true },
      });

      test.advance(test.step.resolvedAt + 1);

      expect(test.rise().hp).toBe(40);
      expect(test.battle.hero).toMatchObject({ momentum: 3, shadowStep: true });
    });

    it('wears the Bulwark on the falling blow, as before', () => {
      const test = SecondChanceTest.start({ bulwark: true, heroHp: 2 });

      test.advance(test.step.resolvedAt + 1);

      expect(test.all('bulwarkWorn')).toHaveLength(1);
      expect(test.battle.hero).toMatchObject({ hp: 40, bulwark: false });
    });
  });

  describe('the Bulwark riposte (#128)', () => {
    it('leaves at the end of the rise when the falling blow wears the Bulwark', () => {
      const test = SecondChanceTest.start({ bulwark: true, heroHp: 2 });
      const { resolvedAt } = test.step;
      const until = resolvedAt + SECOND_CHANCE_MS;

      test.advance(until - 1);
      expect(test.all('bulwarkCountered')).toEqual([]);
      expect(test.step.counter).toEqual({
        at: until,
        until: until + COUNTER_MS,
        done: false,
        by: 'bulwark',
      });

      test.advance(until);
      expect(test.all('bulwarkCountered')).toEqual([
        expect.objectContaining({ at: until, enemy: GHOUL, until: until + COUNTER_MS }),
      ]);
      test.advance(until + COUNTER_MS);
      expect(test.all('stepInStarted')).toEqual([
        expect.objectContaining({ at: until + COUNTER_MS, enemy: VILLAGER }),
      ]);
    });

    it('also leaves at the end of the rise when the first impact wore the Bulwark', () => {
      const test = SecondChanceTest.start({
        bulwark: true,
        intents: [attackIntent('double', 3), attackIntent()],
      });

      test.advance(test.impact(1) + 1_000);

      const rise = test.rise();
      expect(rise.cancelled).toBe(0);
      expect(test.all('bulwarkCountered')).toEqual([]);
      expect(test.step.counter).toMatchObject({ at: rise.until, until: rise.until + COUNTER_MS });
    });

    it('can win the battle after the rise, the respite added to the 40 HP', () => {
      const test = SecondChanceTest.start({ bulwark: true, heroHp: 2, enemies: ['ghoul'] });
      test.battle = {
        ...test.battle,
        enemies: test.battle.enemies.map((enemy) => ({ ...enemy, hp: 1 })),
      };

      test.until(({ phase }) => phase.kind === 'over');

      expect(test.all('battleEnded')).toEqual([expect.objectContaining({ outcome: 'victory' })]);
      expect(test.all('respite')).toEqual([expect.objectContaining({ gain: 8, heroHp: 48 })]);
      expect(test.battle.hero).toMatchObject({ hp: 48, secondChance: 'used' });
    });
  });

  describe('the presses during the rise', () => {
    it.each<[string, (test: SecondChanceTest, at: number) => unknown, string]>([
      ['Parry', (test, at) => test.press('parry', at), 'parry'],
      ['Dodge', (test, at) => test.press('dodge', at), 'dodge'],
      ['Strike', (test, at) => test.strike(at), 'strike'],
      ['Attack', (test, at) => test.act({ kind: 'attack' }, at), 'attack'],
      ['the power', (test, at) => test.act({ kind: 'power', power: 'bulwark' }, at), 'power'],
    ])('ignores %s without off-balance, until the end of the rise', (_, press, button) => {
      const test = SecondChanceTest.start();
      const since = test.step.resolvedAt;
      const until = since + SECOND_CHANCE_MS;
      const presses = [since + 1, since + 100, since + 400, until - 1];
      test.advance(since + 1);

      for (const at of presses) press(test, at);

      expect(test.all('pressIgnored')).toEqual(
        presses.map((at) => ({
          type: 'pressIgnored',
          at,
          button,
          reason: 'secondChance',
        })),
      );
      expect(test.all('offBalanceStarted')).toEqual([]);
      expect(test.all('whiffed')).toEqual([]);
    });

    it('ignores a press in the late tolerance of the falling impact (#207)', () => {
      const test = SecondChanceTest.start();
      const late = test.impact(0) + 250;

      test.press('parry', late);

      expect(test.rise().at).toBeLessThan(late);
      expect(test.all('pressIgnored')).toEqual([
        { type: 'pressIgnored', at: late, button: 'parry', reason: 'secondChance' },
      ]);
      expect(test.all('whiffed')).toEqual([]);
    });

    it('judges the presses as usual from the end of the rise', () => {
      const test = SecondChanceTest.start();
      const until = test.step.resolvedAt + SECOND_CHANCE_MS;

      test.press('parry', until);

      expect(test.all('pressIgnored')).toEqual([]);
      expect(test.all('whiffed')).toEqual([expect.objectContaining({ at: until })]);
    });
  });

  describe('a resume during the rise (P32)', () => {
    it('keeps the 40 HP and the second chance used, without a second rise', () => {
      const test = SecondChanceTest.start();
      const { resolvedAt, startedAt } = test.step;
      test.advance(resolvedAt + 500);

      test.battle = resumeBattle(test.battle, 50_000);

      const shift = 50_000 - startedAt;
      expect(test.battle.hero).toMatchObject({ hp: 40, secondChance: 'used' });
      expect(test.step.secondChance).toEqual({
        since: resolvedAt + shift,
        until: resolvedAt + SECOND_CHANCE_MS + shift,
      });
      test.advance(60_000);
      expect(test.all('secondChanceUsed')).toHaveLength(1);
      expect(test.all('stepInStarted')).toEqual([
        expect.objectContaining({ at: resolvedAt + SECOND_CHANCE_MS + shift, enemy: VILLAGER }),
      ]);
    });
  });

  it('gives the same events for the same seed and the same presses: no draw', () => {
    const run = () => {
      const test = SecondChanceTest.start({ intents: [attackIntent('double'), attackIntent()] });
      test.press('parry', test.impact(0) + 300).advance(30_000);
      return test.events;
    };

    expect(run()).toEqual(run());
    expect(run().some((event) => event.type === 'secondChanceUsed')).toBe(true);
  });
});
