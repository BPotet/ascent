// Le Balayage (`SweepAttack`, #266) : SW1 à SW7 des règles de jeu, sur un coup `sweep` de 10.
import { ATTACKS } from './attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  pressDefense,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleUpdate,
  type HeroState,
} from './Battle';
import type { BattleEvent, DefenseButton } from './BattleEvent';
import type { Bleed, HeroKind } from './combatants';
import { glintsOf } from './glints';
import { OFF_BALANCE_MS } from './rules';

/** Un ennemi qui tire un Balayage de 10, contre le héros qui attaque le premier. */
function toSweep(hero: HeroKind = 'sentinel', change: Partial<HeroState> = {}, bleed?: Bleed) {
  const { battle: started } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    hero,
    enemies: ['ghoul'],
  });
  let battle: Battle = {
    ...started,
    enemies: started.enemies.map((enemy) => ({
      ...enemy,
      guard: 999,
      maxGuard: 999,
      intent: {
        category: 'attack',
        attack: 'sweep',
        damage: 10,
        windUpMs: ATTACKS.sweep.windUpMs,
        feintFraction: 0.5,
        ...(bleed && { bleed }),
      },
    })),
  };
  for (let guard = 0; guard < 100; guard += 1) {
    if (battle.phase.kind === 'enemy' && battle.phase.step.kind === 'attack') {
      return { ...battle, hero: { ...battle.hero, ...change } };
    }
    let update: BattleUpdate;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else {
      update = advance(battle, nextDeadline(battle)!.at + 1);
    }
    battle = update.battle;
  }
  throw new Error('The Sweep never started');
}

const stepOf = (battle: Battle) => (battle.phase as { readonly step: AttackStep }).step;

function press(battle: Battle, button: DefenseButton, offset: number) {
  const impact = stepOf(battle).impacts[0]!.at;
  const update = pressDefense(battle, { button, at: impact + offset });
  return { ...update, blow: blowOf(update.events), impact };
}

const blowOf = (events: readonly BattleEvent[]) =>
  events.find(
    (event): event is Extract<BattleEvent, { type: 'blowResolved' }> =>
      event.type === 'blowResolved',
  );

const typesOf = (events: readonly BattleEvent[]) => events.map((event) => event.type);

describe('the Sweep attack (SW1)', () => {
  it('is a single impact after a wind-up of 1,300 ms, without a feint', () => {
    const step = stepOf(toSweep());

    expect(step.attack).toBe('sweep');
    expect(step.impacts).toHaveLength(1);
    expect(step.feintAt).toBeNull();
    expect(step.impacts[0]!.at - step.startedAt).toBe(1_300);
  });

  it('shows a Sweep glint before its impact, never a red one', () => {
    expect(glintsOf(stepOf(toSweep()))).toEqual([
      expect.objectContaining({ kind: 'sweep', impact: 0 }),
    ]);
  });
});

describe('a parry on a Sweep (SW2)', () => {
  it('is judged as on a basic attack: a perfect parry takes no damage, gains 1 Momentum and counters', () => {
    const before = toSweep();
    const { battle, blow, events } = press(before, 'parry', 0);

    expect(blow).toMatchObject({ outcome: 'perfectParry', damage: 0 });
    expect(battle.hero.momentum).toBe(before.hero.momentum + 1);
    expect(stepOf(battle).counter).not.toBeNull();
    expect(typesOf(events)).not.toContain('offBalanceStarted');
  });

  it('takes 25 % of the damage on a good parry: 2 (10 × 25 % × 90 %)', () => {
    const { blow, events } = press(toSweep(), 'parry', -100);

    expect(blow).toMatchObject({ outcome: 'parry', damage: 2 });
    expect(typesOf(events)).not.toContain('offBalanceStarted');
  });
});

describe('a dodge on a Sweep (SW3, SW6)', () => {
  it.each([
    ['perfect', 0],
    ['good', -100],
  ])('fails in the window (%s): the whole damage, 9, then off-balance for 450 ms', (_, offset) => {
    const before = toSweep();
    const { battle, blow, events } = press(before, 'dodge', offset);

    expect(blow).toMatchObject({ outcome: 'sweepDodge', button: 'dodge', damage: 9 });
    expect(battle.hero.hp).toBe(before.hero.hp - 9);
    expect(battle.offBalanceUntil).toBe(blow!.at + OFF_BALANCE_MS);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'offBalanceStarted', until: blow!.at + OFF_BALANCE_MS }),
    );
    expect(stepOf(battle).counter).toBeNull();
    expect(battle.hero.momentum).toBe(before.hero.momentum);
  });

  it('is a suffered blow of 9 without a press, without off-balance', () => {
    const battle = toSweep();
    const impact = stepOf(battle).impacts[0]!.at;
    const { events } = advance(battle, impact + 1_000);

    expect(blowOf(events)).toMatchObject({ outcome: 'suffered', damage: 9 });
    expect(typesOf(events)).not.toContain('offBalanceStarted');
  });

  it.each([
    ['too early', -300, 'early'],
    ['too late', 300, 'late'],
  ])('stays a whiffed press %s, judged as before', (_, offset, reason) => {
    const { blow, events } = press(toSweep(), 'dodge', offset);

    expect(blow?.outcome).not.toBe('sweepDodge');
    expect(events).toContainEqual(expect.objectContaining({ type: 'whiffed', reason }));
  });

  it('ends the battle without off-balance when it brings the hero to 0 HP', () => {
    const { battle, events } = press(toSweep('sentinel', { hp: 5 }), 'dodge', 0);

    expect(battle.phase.kind).toBe('over');
    expect(typesOf(events)).not.toContain('offBalanceStarted');
  });
});

describe('a dodge on a Sweep touches the hero (SW4)', () => {
  it('takes 4 under the Bulwark (10 × 90 % × 50 %), wears it, and the Riposte follows the blow', () => {
    const { battle, blow, events } = press(toSweep('sentinel', { bulwark: true }), 'dodge', 0);

    expect(blow).toMatchObject({ outcome: 'sweepDodge', damage: 4 });
    expect(typesOf(events)).toContain('bulwarkWorn');
    expect(battle.hero.bulwark).toBe(false);
    expect(stepOf(battle).counter).toMatchObject({ by: 'bulwark', done: false });
  });

  it('wears Mist too', () => {
    const { battle, events } = press(toSweep('sentinel', { mist: true }), 'dodge', 0);

    expect(typesOf(events)).toContain('mistWorn');
    expect(battle.hero.mist).toBeUndefined();
  });

  it('puts out no Burn stack; a perfect parry puts one out', () => {
    const dodged = press(toSweep('sentinel', { burn: 2 }), 'dodge', 0);
    expect(typesOf(dodged.events)).not.toContain('burnExtinguished');
    expect(dodged.battle.hero.burn).toBe(2);

    const parried = press(toSweep('sentinel', { burn: 2 }), 'parry', 0);
    expect(parried.events).toContainEqual(
      expect.objectContaining({ type: 'burnExtinguished', stacks: 1, cause: 'blow' }),
    );
  });

  it('makes the hero bleed on a Sweep that bleeds', () => {
    const { battle } = press(toSweep('sentinel', {}, { damage: 2, rounds: 3 }), 'dodge', 0);

    expect(battle.hero.bleed).toEqual({ damage: 2, rounds: 3 });
  });
});

describe('a dodge on a Sweep is no dodge for the Wanderer (SW5)', () => {
  it('gains no Momentum, does not counter, and Shadow step stays active', () => {
    const before = toSweep('wanderer', { shadowStep: true });
    const { battle, blow } = press(before, 'dodge', 0);

    expect(blow).toMatchObject({ outcome: 'sweepDodge', damage: 10 });
    expect(battle.hero.momentum).toBe(before.hero.momentum);
    expect(battle.hero.shadowStep).toBe(true);
    expect(stepOf(battle).counter).toBeNull();
  });
});
