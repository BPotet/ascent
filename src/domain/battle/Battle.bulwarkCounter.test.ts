// La Riposte du Rempart (#128) : règles R1 à R6. Le Rempart s'use au premier impact qui fait des
// dégâts ; la Sentinelle riposte alors une fois, à la fin du coup, sur l'ennemi qui l'a frappée.
import { ATTACKS, type AttackKind } from './attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  pressDefense,
  resumeBattle,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleUpdate,
  type EnemyState,
  type HeroState,
} from './Battle';
import type { BattleEvent, DefenseButton } from './BattleEvent';
import type { EnemyKind, HeroKind } from './combatants';
import { NO_MODIFIERS, type HeroModifiers } from './heroModifiers';
import { COUNTER_MS, HIT_STOP_MS } from './rules';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const GHOUL = 0;
const MAD_VILLAGER = 1;

/** Cœur de braise (#92) : chaque garde brisée donne +1 Élan et rend 5 PV. */
const EMBER_HEART: HeroModifiers = { ...NO_MODIFIERS, onGuardBreak: { momentum: 1, heal: 5 } };

interface Setup {
  readonly enemies?: readonly EnemyKind[];
  readonly attack?: AttackKind;
  readonly damage?: number;
  readonly heroHp?: number;
  readonly hero?: HeroKind;
  readonly target?: number;
  readonly inputOffset?: number;
  readonly modifiers?: HeroModifiers;
  /** L'ennemi qui frappe, changé avant son coup (PV, garde…). */
  readonly attacker?: Partial<EnemyState>;
  /** Le héros, changé avant le coup (le Rempart forcé pour l'Errante). */
  readonly heroChange?: Partial<HeroState>;
}

class RiposteTest {
  battle: Battle;
  readonly events: BattleEvent[] = [];

  private constructor(battle: Battle) {
    this.battle = battle;
  }

  /**
   * La Sentinelle (51 PV par défaut) vise sa cible, active le Rempart, puis le 1er ennemi
   * prépare `attack` : le test commence à sa préparation.
   */
  static start({
    enemies = ['ghoul', 'madVillager'],
    attack = 'basic',
    damage = 5,
    heroHp = 51,
    hero = 'sentinel',
    target = GHOUL,
    inputOffset = 0,
    modifiers,
    attacker = {},
    heroChange = {},
  }: Setup = {}): RiposteTest {
    const { battle: started } = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      heroHp,
      hero,
      inputOffset,
      enemies,
      ...(modifiers && { modifiers }),
    });
    const intent = {
      category: 'attack' as const,
      attack,
      damage,
      windUpMs: ATTACKS[attack].windUpMs,
      feintFraction: 0.5,
    };
    const test = new RiposteTest({
      ...started,
      enemies: started.enemies.map((enemy, index) =>
        index === GHOUL ? { ...enemy, ...attacker, intent } : enemy,
      ),
    });
    if (target !== GHOUL) test.act({ kind: 'target', enemy: target }, 50);
    if (hero === 'sentinel') test.act({ kind: 'power', power: 'bulwark' }, 100);
    else test.act({ kind: 'attack' }, 100);
    test.battle = { ...test.battle, hero: { ...test.battle.hero, ...heroChange } };
    test.until(({ phase }) => phase.kind === 'enemy' && phase.step.kind === 'attack');
    test.events.length = 0;
    return test;
  }

  private act(action: Parameters<typeof heroAction>[1]['action'], releasedAt: number): void {
    this.apply(heroAction(this.battle, { action, touchStartedAt: releasedAt - 10, releasedAt }));
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

  advance(until: number): this {
    return this.apply(advance(this.battle, until));
  }

  /** Avance d'échéance en échéance jusqu'à `done` (ou la fin du combat). */
  until(done: (battle: Battle) => boolean): this {
    for (let guard = 0; guard < 100 && !done(this.battle); guard += 1) {
      const deadline = nextDeadline(this.battle);
      if (deadline === null) return this;
      this.advance(deadline.at + (deadline.awaitsPress ? 1 : 0));
    }
    return this;
  }

  /** Jusqu'à la fin du coup : le tour suivant a commencé, ou le combat est fini. */
  toEndOfBlow(): this {
    const { startedAt } = this.step;
    return this.until(
      ({ phase }) =>
        phase.kind !== 'enemy' ||
        phase.step.kind !== 'attack' ||
        phase.step.startedAt !== startedAt,
    );
  }

  all<Type extends BattleEvent['type']>(type: Type): EventOf<Type>[] {
    return this.events.filter((event): event is EventOf<Type> => event.type === type);
  }

  types(): string[] {
    return this.events.map((event) => event.type);
  }
}

describe('Bulwark riposte (#128)', () => {
  describe('a suffered blow wears the Bulwark and triggers the riposte (R1, R4)', () => {
    it('halves the blow, wears the Bulwark, then ripostes on the Ghoul at the end of the blow: 3 HP, 3 guard', () => {
      const test = RiposteTest.start();
      const { resolvedAt } = test.step;

      test.advance(resolvedAt + 1);

      // 5 × 90 % × 50 % = 2,25 ; la riposte part à l'instant où le coup est résolu.
      expect(test.events).toEqual([
        { type: 'impactLanded', at: test.impact(0), enemy: GHOUL, index: 0, lost: false },
        {
          type: 'blowResolved',
          at: resolvedAt,
          enemy: GHOUL,
          index: 0,
          outcome: 'suffered',
          button: null,
          delta: null,
          damage: 2,
          heroHp: 49,
        },
        { type: 'bulwarkWorn', at: resolvedAt, enemy: GHOUL },
        {
          type: 'bulwarkCountered',
          at: resolvedAt,
          enemy: GHOUL,
          damage: 3,
          guardDamage: 3,
          until: resolvedAt + COUNTER_MS,
        },
      ]);
      expect(test.battle.hero).toMatchObject({ hp: 49, bulwark: false, momentum: 0 });
      expect(test.battle.enemies[GHOUL]).toMatchObject({ hp: 47, guard: 12, stun: null });
      expect(test.step.counter).toEqual({
        at: resolvedAt,
        until: resolvedAt + COUNTER_MS,
        done: true,
        by: 'bulwark',
      });
    });

    it('ends the blow after the riposte, without any momentum and without a counter', () => {
      const test = RiposteTest.start();
      const { resolvedAt } = test.step;

      test.advance(resolvedAt + COUNTER_MS - 1);
      expect(test.battle.phase).toMatchObject({ kind: 'enemy', step: { kind: 'attack' } });

      test.toEndOfBlow();

      expect(test.all('momentumChanged')).toEqual([]);
      expect(test.all('counterAttacked')).toEqual([]);
      expect(test.all('hitStopStarted')).toEqual([]);
      expect(test.all('bulwarkCountered')).toHaveLength(1);
      expect(test.battle.hero.momentum).toBe(0);
      expect(test.events.find((event) => event.at > resolvedAt)?.at).toBe(resolvedAt + COUNTER_MS);
    });

    it('also ripostes after a good parry, only at the end of the blow', () => {
      const test = RiposteTest.start();
      const parriedAt = test.impact(0) - 100;
      const { resolvedAt } = test.step;

      test.press('parry', parriedAt);

      // 5 × 25 % × 90 % × 50 % = 0,56 : 1 PV au moins.
      expect(test.all('blowResolved')).toEqual([
        expect.objectContaining({ outcome: 'parry', damage: 1, heroHp: 50 }),
      ]);
      expect(test.all('bulwarkWorn')).toEqual([
        { type: 'bulwarkWorn', at: parriedAt, enemy: GHOUL },
      ]);

      test.advance(resolvedAt - 1);
      expect(test.all('bulwarkCountered')).toEqual([]);

      test.advance(resolvedAt);
      expect(test.all('bulwarkCountered')).toEqual([
        expect.objectContaining({ at: resolvedAt, enemy: GHOUL, damage: 3, guardDamage: 3 }),
      ]);
    });

    it.each([
      ['parried', (test: RiposteTest) => test.press('parry', test.impact(0))],
      ['suffered', (test: RiposteTest) => test],
    ])(
      'ripostes on the Specter after its perilous blow, %s and halved after the damage reduction',
      (_, defend) => {
        const test = RiposteTest.start({
          enemies: ['specter', 'ghoul'],
          attack: 'perilous',
          damage: 9,
        });

        defend(test).toEndOfBlow();

        // 9 × 90 % × 50 % = 4,05.
        expect(test.all('blowResolved')).toEqual([expect.objectContaining({ damage: 4 })]);
        expect(test.all('bulwarkWorn')).toHaveLength(1);
        expect(test.all('bulwarkCountered')).toEqual([
          expect.objectContaining({ enemy: 0, damage: 3, guardDamage: 3 }),
        ]);
        expect(test.battle.enemies[0]).toMatchObject({ hp: 32, guard: 7 });
        expect(test.battle.hero.momentum).toBe(0);
      },
    );
  });

  describe('no damage, no wear and no riposte (R2, R3)', () => {
    it('counters normally after a perfect parry of every impact, and keeps the Bulwark', () => {
      const test = RiposteTest.start();

      test.press('parry', test.impact(0)).toEndOfBlow();

      expect(test.all('counterAttacked')).toEqual([
        expect.objectContaining({ enemy: GHOUL, damage: 6, guardDamage: 12 }),
      ]);
      expect(test.all('bulwarkWorn')).toEqual([]);
      expect(test.all('bulwarkCountered')).toEqual([]);
      expect(test.battle.hero.bulwark).toBe(true);
    });

    it('gives nothing after a dodge, and keeps the Bulwark', () => {
      const test = RiposteTest.start({ enemies: ['specter', 'ghoul'], attack: 'perilous' });

      test.press('dodge', test.impact(0)).toEndOfBlow();

      expect(test.all('bulwarkWorn')).toEqual([]);
      expect(test.all('bulwarkCountered')).toEqual([]);
      expect(test.all('counterAttacked')).toEqual([]);
      expect(test.battle.hero.bulwark).toBe(true);
    });
  });

  describe('a double blow gives a single riposte, at the end of the blow (R3, R6)', () => {
    it.each([0, 50, -50])(
      'halves only the first impact and ripostes once, after the second impact (input offset %i ms)',
      (inputOffset) => {
        const test = RiposteTest.start({ attack: 'double', damage: 3, inputOffset });
        const { resolvedAt } = test.step;

        test.toEndOfBlow();

        // 3 × 90 % × 50 % = 1,35, puis 3 × 90 % = 2,7.
        expect(test.all('blowResolved').map((blow) => blow.damage)).toEqual([1, 2]);
        expect(test.all('bulwarkWorn')).toEqual([
          { type: 'bulwarkWorn', at: test.all('blowResolved')[0]!.at, enemy: GHOUL },
        ]);
        expect(test.all('bulwarkCountered')).toEqual([
          expect.objectContaining({ at: resolvedAt, damage: 3, guardDamage: 3 }),
        ]);
        const types = test.types();
        expect(types.lastIndexOf('blowResolved')).toBeLessThan(types.indexOf('bulwarkCountered'));
        expect(types.indexOf('bulwarkWorn')).toBe(types.indexOf('blowResolved') + 1);
      },
    );

    it('ripostes once, after a hit stop, when the second impact is parried perfectly', () => {
      const test = RiposteTest.start({ attack: 'double', damage: 3 });
      const { resolvedAt } = test.step;

      test
        .press('parry', test.impact(0) - 100)
        .press('parry', test.impact(1))
        .toEndOfBlow();

      expect(test.all('blowResolved').map((blow) => blow.outcome)).toEqual([
        'parry',
        'perfectParry',
      ]);
      expect(test.all('counterAttacked')).toEqual([]);
      expect(test.all('bulwarkCountered')).toEqual([
        expect.objectContaining({
          at: resolvedAt + HIT_STOP_MS,
          until: resolvedAt + HIT_STOP_MS + COUNTER_MS,
        }),
      ]);
    });

    it('wears the Bulwark at the second impact after a perfect parry, then ripostes without a counter', () => {
      const test = RiposteTest.start({ attack: 'double', damage: 3 });

      test.press('parry', test.impact(0));
      expect(test.battle.hero).toMatchObject({ bulwark: true, momentum: 1 });

      const secondAt = test.impact(1) - 100;
      test.press('parry', secondAt).toEndOfBlow();

      expect(test.all('bulwarkWorn')).toEqual([
        { type: 'bulwarkWorn', at: secondAt, enemy: GHOUL },
      ]);
      expect(test.all('bulwarkCountered')).toHaveLength(1);
      expect(test.all('counterAttacked')).toEqual([]);
      expect(test.battle.hero).toMatchObject({ bulwark: false, momentum: 1 });
    });
  });

  it('ripostes on the enemy who struck, not on the chosen target', () => {
    const test = RiposteTest.start({ target: MAD_VILLAGER });

    test.toEndOfBlow();

    expect(test.all('bulwarkCountered')).toEqual([expect.objectContaining({ enemy: GHOUL })]);
    expect(test.battle.enemies[GHOUL]!.hp).toBe(47);
    expect(test.battle.enemies[MAD_VILLAGER]!.hp).toBe(35);
    expect(test.battle.target).toBe(MAD_VILLAGER);
  });

  describe('what the riposte does to the enemy (R5, R6)', () => {
    it('breaks the guard like any blow: stun, hit stop, and Ember Heart gives 1 momentum and 5 HP', () => {
      const test = RiposteTest.start({ attacker: { guard: 3 }, modifiers: EMBER_HEART });
      const { resolvedAt } = test.step;

      test.advance(resolvedAt + 1);

      const fromRiposte = test.events.slice(test.types().indexOf('bulwarkCountered'));
      expect(fromRiposte).toEqual([
        expect.objectContaining({ type: 'bulwarkCountered', damage: 3, guardDamage: 3 }),
        { type: 'guardBroken', at: resolvedAt, enemy: GHOUL, by: 'bulwarkCounter' },
        { type: 'momentumChanged', at: resolvedAt, momentum: 1 },
        { type: 'hitStopStarted', at: resolvedAt, until: resolvedAt + HIT_STOP_MS },
      ]);
      expect(test.battle.enemies[GHOUL]!.stun).not.toBeNull();
      expect(test.battle.hero).toMatchObject({ momentum: 1, hp: 49 + 5 });
      expect(test.step.counter).toMatchObject({
        until: resolvedAt + HIT_STOP_MS + COUNTER_MS,
        done: true,
      });
    });

    it('makes the enemy fall like a strike, and the target moves on', () => {
      const test = RiposteTest.start({ attacker: { hp: 3 } });

      test.toEndOfBlow();

      expect(test.all('enemyDefeated')).toEqual([
        expect.objectContaining({ enemy: GHOUL, at: test.all('bulwarkCountered')[0]!.at }),
      ]);
      expect(test.all('targetChanged')).toEqual([expect.objectContaining({ enemy: MAD_VILLAGER })]);
    });

    it('wins the battle when it makes the last enemy fall', () => {
      const test = RiposteTest.start({ enemies: ['ghoul'], attacker: { hp: 3 } });
      const { resolvedAt } = test.step;

      test.toEndOfBlow();

      expect(test.all('battleEnded')).toEqual([
        { type: 'battleEnded', at: resolvedAt + COUNTER_MS, outcome: 'victory' },
      ]);
    });
  });

  describe('no riposte when the Sentinel falls (R6)', () => {
    it('loses the battle at the blow that wears the Bulwark', () => {
      const test = RiposteTest.start({ heroHp: 2 });

      test.toEndOfBlow();

      expect(test.all('bulwarkWorn')).toHaveLength(1);
      expect(test.all('bulwarkCountered')).toEqual([]);
      expect(test.all('battleEnded')).toEqual([expect.objectContaining({ outcome: 'defeat' })]);
      expect(test.battle.enemies[GHOUL]!.hp).toBe(50);
    });

    it('loses the battle at the second impact, after the first one wore the Bulwark', () => {
      const test = RiposteTest.start({ heroHp: 3, attack: 'double', damage: 3 });

      test.toEndOfBlow().advance(test.battle.now + 10_000);

      expect(test.all('bulwarkWorn')).toHaveLength(1);
      expect(test.all('bulwarkCountered')).toEqual([]);
      expect(test.all('battleEnded')).toEqual([expect.objectContaining({ outcome: 'defeat' })]);
      expect(test.battle.enemies[GHOUL]!.hp).toBe(50);
    });
  });

  it('keeps the Bleed of the blow, which does not change the riposte', () => {
    const test = RiposteTest.start({ enemies: ['madVillager', 'ghoul'] });
    test.battle = {
      ...test.battle,
      phase: { kind: 'enemy', step: { ...test.step, bleed: { damage: 2, rounds: 3 } } },
    };

    test.toEndOfBlow();

    expect(test.types().filter((type) => type !== 'impactLanded')).toEqual(
      expect.arrayContaining(['blowResolved', 'bulwarkWorn', 'heroBleeding', 'bulwarkCountered']),
    );
    expect(test.battle.hero.bleed).toEqual({ damage: 2, rounds: 3 });
  });

  it('only wears the Bulwark of a hero without a riposte', () => {
    const test = RiposteTest.start({ hero: 'wanderer', heroChange: { bulwark: true } });

    test.toEndOfBlow();

    expect(test.all('bulwarkWorn')).toHaveLength(1);
    expect(test.all('bulwarkCountered')).toEqual([]);
    expect(test.all('counterAttacked')).toEqual([]);
    expect(test.battle.hero.bulwark).toBe(false);
  });

  it('does not keep an active Bulwark for the next battle', () => {
    const test = RiposteTest.start();
    expect(test.battle.hero.bulwark).toBe(true);

    const { battle: next } = startBattle({
      seed: 8,
      defenseHint: false,
      at: 0,
      heroHp: test.battle.hero.hp,
      enemies: ['ghoul'],
    });

    expect(next.hero.bulwark).toBe(false);
  });

  describe('a saved battle (P32)', () => {
    it('resumes a scheduled riposte, which still goes off at the end of the blow', () => {
      const test = RiposteTest.start({ attack: 'double', damage: 3 });
      test.advance(test.impact(0) + 200);
      expect(test.step.counter).toMatchObject({ by: 'bulwark', done: false });

      const resumedAt = 50_000;
      test.battle = resumeBattle(test.battle, resumedAt);
      const { resolvedAt } = test.step;
      expect(test.step.counter).toEqual({
        at: resolvedAt,
        until: resolvedAt + COUNTER_MS,
        done: false,
        by: 'bulwark',
      });

      test.toEndOfBlow();
      expect(test.all('bulwarkCountered')).toEqual([
        expect.objectContaining({ at: resolvedAt, damage: 3 }),
      ]);
    });

    it('reads a counter saved without its kind as a counter', () => {
      const test = RiposteTest.start({ attack: 'double', damage: 3 });
      test.advance(test.impact(0) + 200);
      const { resolvedAt } = test.step;
      test.battle = {
        ...test.battle,
        phase: {
          kind: 'enemy',
          step: {
            ...test.step,
            counter: { at: resolvedAt, until: resolvedAt + COUNTER_MS, done: false },
          },
        },
      };

      test.toEndOfBlow();

      expect(test.all('counterAttacked')).toEqual([
        expect.objectContaining({ enemy: GHOUL, damage: 6, guardDamage: 12 }),
      ]);
      expect(test.all('bulwarkCountered')).toEqual([]);
      expect(test.all('guardBroken')).toEqual([]);
    });
  });
});
