// Le coup retardé imparable des Jumeaux (#108, prototype) : D1 à D7 des règles de #102.
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
import { ENEMIES, ENEMY_INITIATIVE, type HeroKind } from './combatants';
import { glintsOf } from './glints';

/** Les Jumeaux, qui tirent l'Onde de choc de 10, contre le héros qui attaque le premier. */
function toShockwave(hero: HeroKind, change: Partial<HeroState> = {}): Battle {
  const { battle: started } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    hero,
    enemies: ['twins'],
  });
  let battle: Battle = {
    ...started,
    enemies: started.enemies.map((enemy) => ({
      ...enemy,
      intent: {
        category: 'attack',
        attack: 'delayedPerilous',
        damage: 10,
        windUpMs: ATTACKS.delayedPerilous.windUpMs,
        feintFraction: 0.5,
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
  throw new Error('The Twins never attacked');
}

const stepOf = (battle: Battle) => (battle.phase as { readonly step: AttackStep }).step;

function press(battle: Battle, button: DefenseButton, offset: number) {
  const impact = stepOf(battle).impacts[0]!.at;
  const update = pressDefense(battle, { button, at: impact + offset });
  const blow = update.events.find(
    (event): event is Extract<BattleEvent, { type: 'blowResolved' }> =>
      event.type === 'blowResolved',
  );
  return { ...update, blow, impact };
}

describe('Les Jumeaux (#108)', () => {
  it('have 200 HP, guard 30 and Initiative 7, and the moves of the Codex with their weights', () => {
    expect(ENEMIES.twins).toEqual({
      maxHp: 200,
      maxGuard: 30,
      moves: [
        { attack: 'double', damage: 6, weight: 2 },
        { attack: 'delayedPerilous', damage: 10 },
        { attack: 'basic', damage: 5 },
      ],
      supports: false,
    });
    expect(ENEMY_INITIATIVE.twins).toBe(7);
  });
});

describe('delayed perilous attack (D1 to D7)', () => {
  it('is a single impact after the wind-up of the delayed attack, with its hesitation', () => {
    const battle = toShockwave('sentinel');
    const step = stepOf(battle);

    expect(step.attack).toBe('delayedPerilous');
    expect(step.impacts).toHaveLength(1);
    expect(step.feintAt).toBeNull();
    expect(step.impacts[0]!.at - step.startedAt).toBe(1_700);
  });

  it('shows a red glint before its impact (D2)', () => {
    expect(glintsOf(stepOf(toShockwave('sentinel')))).toEqual([
      expect.objectContaining({ kind: 'red', impact: 0 }),
    ]);
  });

  it.each([
    ['perfect', 0],
    ['good', -100],
  ])(
    'fails a %s parry: 10 damage after the damage reduction, off-balance, no counter (D3, D6)',
    (_, offset) => {
      const { battle, blow, events } = press(toShockwave('sentinel'), 'parry', offset);

      expect(blow).toMatchObject({ outcome: 'perilousParry', damage: 9 });
      expect(battle.hero.hp).toBe(71);
      expect(events.some((event) => event.type === 'offBalanceStarted')).toBe(true);
      expect(stepOf(battle).counter).toBeNull();
    },
  );

  it('halves the damage of a failed parry under the Bulwark (D3)', () => {
    const { blow } = press(toShockwave('sentinel', { bulwark: true }), 'parry', 0);

    expect(blow).toMatchObject({ outcome: 'perilousParry', damage: 4 });
  });

  it('is avoided by a dodge in the parry window: no damage, +1 Momentum for the Wanderer (D4)', () => {
    const battle = toShockwave('wanderer');
    const { battle: after, blow } = press(battle, 'dodge', -100);

    expect(blow).toMatchObject({ outcome: 'dodge', damage: 0 });
    expect(after.hero.hp).toBe(battle.hero.hp);
    expect(after.hero.momentum).toBe(battle.hero.momentum + 1);
  });

  it('lets the Shadow Step counter after a dodge (D4)', () => {
    const { battle } = press(toShockwave('wanderer', { shadowStep: true }), 'dodge', 0);

    expect(stepOf(battle).counter).not.toBeNull();
    expect(battle.hero.shadowStep).toBe(false);
  });
});
