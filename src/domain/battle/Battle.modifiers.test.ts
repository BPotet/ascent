// Prototype #93 : les modificateurs du héros (objets, bénédictions de départ) et ses PV max dans le
// moteur du combat. Sans eux (`NO_MODIFIERS`), rien ne change.
import {
  advance,
  heroAction,
  pressDefense,
  pressStrike,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleOptions,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { NO_MODIFIERS, combineModifiers, type HeroModifiers } from './heroModifiers';

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

function start(modifiers?: Partial<HeroModifiers>, options: Partial<BattleOptions> = {}) {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: ['ghoul', 'specter', 'necromancer'],
    ...(modifiers && { modifiers: combineModifiers(modifiers) }),
    ...options,
  });
}

function eventsOf<Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] {
  return events.filter((event): event is EventOf<Type> => event.type === type);
}

/** Frappe la Goule ; `perfect` : appui à l'impact. */
function strike(battle: Battle, perfect: boolean) {
  const attacked = heroAction(battle, {
    action: { kind: 'attack' },
    touchStartedAt: 950,
    releasedAt: 1_000,
  });
  const pressed = perfect ? pressStrike(attacked.battle, { at: 1_700 }) : attacked;
  const done = advance(pressed.battle, 3_000);
  return eventsOf([...pressed.events, ...done.events], 'strikeResolved')[0]!;
}

function underAttack(battle: Battle, damage = 10): Battle {
  const step: AttackStep = {
    kind: 'attack',
    enemy: 0,
    attack: 'basic',
    damage,
    startedAt: 1_000,
    feintAt: null,
    feintShown: false,
    impacts: [{ at: 2_000, landed: false, lost: false, outcome: null }],
    resolvedAt: 2_160,
    counter: null,
  };
  return { ...battle, now: 1_900, lastPlayed: 'enemy', phase: { kind: 'enemy', step } };
}

describe('the battle without modifiers', () => {
  it('is the same battle with NO_MODIFIERS', () => {
    const plain = start();
    const neutral = start(undefined, { modifiers: NO_MODIFIERS });
    expect({ ...neutral.battle, modifiers: undefined }).toEqual({
      ...plain.battle,
      modifiers: undefined,
    });
    expect(neutral.events).toEqual(plain.events);
    expect(strike(neutral.battle, false)).toEqual(strike(plain.battle, false));
  });
});

describe('the hero modifiers in battle (P15, P18, P21, P25, P26)', () => {
  it('starts with the given maximum HP, and at full HP', () => {
    expect(start(undefined, { heroMaxHp: 72 }).battle.hero).toMatchObject({ hp: 72, maxHp: 72 });
  });

  it('lets the Sentinel with Haste +2 and the Haste Amulet (9) act before the Specter (8)', () => {
    expect(start({}, { initiative: true }).battle.turn.order[0]).toBe(1);
    const hasty = start({ initiative: 4 }, { initiative: true }).battle;
    expect(hasty.turn.order[0]).toBe('hero');
  });

  it('applies the Hammer: Guard damage 19 and Attack 8', () => {
    const blow = strike(start({ guardDamagePercents: [160], attackPercents: [80] }).battle, false);
    expect(blow).toMatchObject({ damage: 8, guardDamage: 19 });
  });

  it('applies the Axe to the Guard damage and the Edge to the Attack', () => {
    expect(strike(start({ guardDamagePercents: [130] }).battle, false).guardDamage).toBe(15);
    expect(strike(start({ attackBonusPercent: 20 }).battle, false).damage).toBe(12);
  });

  it('finishes a battle saved before #152 with its flat Attack addition', () => {
    expect(strike(start({ attackFlat: 2 }).battle, false).damage).toBe(12);
  });

  it('adds the Leather bonus to the perfect strike multiplier', () => {
    expect(strike(start().battle, true).damage).toBe(15);
    expect(strike(start({ perfectStrikeBonusPercents: [20] }).battle, true).damage).toBe(17);
  });

  it('adds the damage reduction points, capped at 40 %', () => {
    const suffered = (modifiers: Partial<HeroModifiers>) =>
      eventsOf(advance(underAttack(start(modifiers).battle, 10), 2_200).events, 'blowResolved')[0]!
        .damage;
    expect(suffered({})).toBe(9);
    expect(suffered({ damageReductionPoints: 5 })).toBe(8);
    expect(suffered({ damageReductionPoints: 50 })).toBe(6);
    // Armure de chevalier déchu 20 + Protection Épique 15 + Peau de givre 10 : 45 points, 40 %.
    expect(suffered({ damageReductionPoints: 20 + 15 + 10 })).toBe(6);
  });

  it('heals 3 HP per perfectly parried impact with the Watchman shield, up to the maximum', () => {
    const hurt = (hp: number) => {
      const battle = underAttack(start({ healOnPerfectParry: 3 }).battle);
      return pressDefense(
        { ...battle, hero: { ...battle.hero, hp } },
        { button: 'parry', at: 2_000 },
      ).battle.hero.hp;
    };
    expect(hurt(50)).toBe(53);
    expect(hurt(79)).toBe(80);
  });

  describe('the perfect parry heal cap (#244, R4)', () => {
    /** Une parade parfaite de plus, sur l'état du combat `battle`, le héros à `hp` PV s'il est donné. */
    const parry = (battle: Battle, hp?: number) => {
      const attacked = underAttack(battle);
      return pressDefense(
        { ...attacked, hero: { ...attacked.hero, ...(hp !== undefined && { hp }) } },
        { button: 'parry', at: 2_000 },
      ).battle;
    };

    it('gives back 7, then 3, then 0 HP in the same battle, every source under one cap', () => {
      // Le Bouclier du veilleur (3), la Gelée blanche (2) et le Givre du clocher (2).
      const sources = start(undefined, {
        modifiers: combineModifiers(
          { healOnPerfectParry: 3 },
          { healOnPerfectParry: 2 },
          { healOnPerfectParry: 2 },
        ),
      }).battle;
      const first = parry(sources, 40);
      const second = parry(first);
      const third = parry(second);

      expect([first, second, third].map((battle) => battle.hero.hp)).toEqual([47, 50, 50]);
      expect(third.hero.parryHealed).toBe(10);
    });

    it('never counts a heal at full HP', () => {
      const full = parry(start({ healOnPerfectParry: 7 }).battle, 80);
      const hurt = parry(full, 50);

      expect(full.hero).toMatchObject({ hp: 80 });
      expect(full.hero).not.toHaveProperty('parryHealed');
      expect(hurt.hero).toMatchObject({ hp: 57, parryHealed: 7 });
    });

    it('starts again at 0 in the next battle', () => {
      const capped = parry(parry(start({ healOnPerfectParry: 7 }).battle, 40));
      expect(capped.hero.parryHealed).toBe(10);

      const next = start({ healOnPerfectParry: 7 }, { heroHp: capped.hero.hp }).battle;
      expect(next.hero).not.toHaveProperty('parryHealed');
      expect(parry(next).hero.hp).toBe(capped.hero.hp + 7);
    });

    it('leaves Coeur de braise out of the cap', () => {
      const battle = start({ onGuardBreak: { momentum: 1, heal: 5 } }).battle;
      const capped: Battle = {
        ...battle,
        hero: { ...battle.hero, hp: 50, parryHealed: 10 },
        enemies: battle.enemies.map((enemy, index) =>
          index === 0 ? { ...enemy, guard: 5 } : enemy,
        ),
      };
      const attacked = heroAction(capped, {
        action: { kind: 'attack' },
        touchStartedAt: 950,
        releasedAt: 1_000,
      });
      const struck = advance(attacked.battle, 3_000).battle;

      expect(struck.hero).toMatchObject({ hp: 55, parryHealed: 10 });
    });
  });

  it('applies the attack modifiers to the counter-attack', () => {
    const battle = underAttack(start({ attackPercents: [80], guardDamagePercents: [160] }).battle);
    const parried = pressDefense(battle, { button: 'parry', at: 2_000 });
    const countered = advance(parried.battle, 3_000);
    expect(eventsOf(countered.events, 'counterAttacked')).toEqual([
      expect.objectContaining({ damage: 5, guardDamage: 19 }),
    ]);
  });

  it('starts with more Momentum, up to the cap', () => {
    expect(start({ startingMomentum: 2 }).battle.hero.momentum).toBe(3);
    expect(start({ startingMomentum: 9 }).battle.hero.momentum).toBe(5);
  });
});
