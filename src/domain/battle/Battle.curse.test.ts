// L'ennemi maudit dans le moteur du combat (#209) : ses PV max, sa garde max et les dégâts de ses
// coups, sa relève, jamais un renfort ni un invoqué, et la reprise d'un combat sauvegardé.
import {
  advance,
  heroAction,
  nextDeadline,
  pressStrike,
  resumeBattle,
  startBattle,
  type Battle,
  type BattleOptions,
  type BattleUpdate,
  type EnemyState,
} from './Battle';
import type { BattleEvent } from './BattleEvent';
import { cursedValue } from './curse';
import type { EnemyKind } from './combatants';
import { drawIntent, type AttackIntent } from './intents';
import { seedRandom } from './SeededRandom';
import type { TierMultiplier } from './tierMultiplier';

const TIER_3: TierMultiplier = { hpPercent: 175, guardPercent: 150 };

function start(
  enemies: readonly EnemyKind[],
  options: Partial<Pick<BattleOptions, 'cursed' | 'tierMultiplier' | 'seed' | 'initiative'>> = {},
): Battle {
  return startBattle({ seed: 7, defenseHint: false, at: 0, enemies, ...options }).battle;
}

function withEnemy(battle: Battle, index: number, change: Partial<EnemyState>): Battle {
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, position) =>
      position === index ? { ...enemy, ...change } : enemy,
    ),
  };
}

/** Rejoue le combat, sans défense, le héros attaque sa cible à son tour, jusqu'à `done`. */
function playUntil(
  initial: Battle,
  done: (battle: Battle, events: readonly BattleEvent[]) => boolean,
): { readonly battle: Battle; readonly events: BattleEvent[] } {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 300; step += 1) {
    if (done(battle, events)) return { battle, events };
    let update: BattleUpdate;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else {
      const deadline = nextDeadline(battle);
      if (deadline === null) throw new Error('The battle is stuck');
      update = advance(battle, deadline.at + 40);
    }
    battle = update.battle;
    events.push(...update.events);
  }
  throw new Error('The battle never reached the expected state');
}

const has =
  (type: BattleEvent['type']) =>
  (_: Battle, events: readonly BattleEvent[]): boolean =>
    events.some((event) => event.type === type);

describe('a cursed enemy at the start of the battle (#209)', () => {
  it('curses only the enemy at the given index: the Ghoul at 60 HP and 36 guard', () => {
    const battle = start(['ghoul', 'specter', 'necromancer'], { cursed: 0 });

    expect(battle.enemies[0]).toMatchObject({
      kind: 'ghoul',
      hp: 60,
      maxHp: 60,
      guard: 36,
      maxGuard: 36,
      cursed: true,
    });
    expect(battle.enemies[1]).toMatchObject({ hp: 35, maxGuard: 20 });
    expect(battle.enemies.slice(1).every((enemy) => enemy.cursed === undefined)).toBe(true);
  });

  it('curses no enemy without the option', () => {
    const battle = start(['ghoul', 'specter']);
    expect(battle.enemies.some((enemy) => enemy.cursed !== undefined)).toBe(false);
    expect(battle.enemies[0]).toMatchObject({ maxHp: 50, maxGuard: 30 });
  });

  it('applies the 20 % to the tier value, after the tier multiplier', () => {
    const battle = start(['ghoul', 'specter'], { cursed: 0, tierMultiplier: TIER_3 });
    expect(battle.enemies[0]).toMatchObject({ maxHp: 104, maxGuard: 54 });
    expect(battle.enemies[1]).toMatchObject({ maxHp: 61, maxGuard: 30 });
  });

  it('gives the Fallen Knight, never multiplied, 240 HP and 54 guard', () => {
    expect(start(['fallenKnight'], { cursed: 0 }).enemies[0]).toMatchObject({
      maxHp: 240,
      maxGuard: 54,
      cursed: true,
    });
  });

  it('never curses an enemy of the reserve', () => {
    const battle = start(['ghoul', 'specter', 'ghoul', 'ghoul', 'necromancer'], { cursed: 3 });
    expect(battle.enemies.some((enemy) => enemy.cursed !== undefined)).toBe(false);
  });

  it('keeps its Initiative: the same round order as uncursed', () => {
    const group: EnemyKind[] = ['ghoul', 'specter', 'necromancer'];
    const plain = start(group, { initiative: true });
    const cursed = start(group, { initiative: true, cursed: 0 });
    expect(cursed.turn.order).toEqual(plain.turn.order);
  });
});

describe('the strikes of a cursed enemy (#209)', () => {
  const context = { fallenAlly: null, stunned: false, guardDamaged: false };

  it('hits for 6 with its basic strike and 4 per impact with its double strike, the Ghoul', () => {
    const damages = new Map<string, number>();
    for (let seed = 1; seed < 40; seed += 1) {
      const { intent } = drawIntent('ghoul', seedRandom(seed), { ...context, cursed: true });
      if (intent.category === 'attack') damages.set(intent.attack, intent.damage);
    }
    expect(Object.fromEntries(damages)).toEqual({ basic: 6, double: 4 });
  });

  it('adds the curse to the tier damage, and draws exactly as uncursed', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const options = { ...context, damagePercent: 175 };
      const plain = drawIntent('madVillager', seedRandom(seed), options);
      const cursed = drawIntent('madVillager', seedRandom(seed), { ...options, cursed: true });
      const { damage, ...rest } = plain.intent as AttackIntent;
      expect(cursed.random).toEqual(plain.random);
      // Le Saignement ne change pas : ce n'est pas un coup.
      expect(cursed.intent).toEqual({ ...rest, damage: cursedValue(damage) });
    }
  });

  it('draws its intents in battle with the cursed damage', () => {
    const plain = start(['ghoul', 'specter'], { seed: 11 });
    const cursed = start(['ghoul', 'specter'], { seed: 11, cursed: 0 });
    const intent = plain.enemies[0]!.intent as AttackIntent;
    expect(cursed.enemies[0]!.intent).toEqual({ ...intent, damage: cursedValue(intent.damage) });
    expect(cursed.enemies[1]!.intent).toEqual(plain.enemies[1]!.intent);
  });
});

describe('a cursed enemy that falls and comes back (#209)', () => {
  it('stays cursed when the Necromancer raises it, at 50 % of its cursed max HP', () => {
    const initial = start(['ghoul', 'necromancer'], { cursed: 0 });
    const fallen = { ...withEnemy(initial, 0, { hp: 0 }), target: 1 };

    const { battle } = playUntil(fallen, has('allyRaised'));

    expect(battle.enemies[0]).toMatchObject({ hp: 30, maxHp: 60, cursed: true, raised: true });
  });

  it('stays cursed when the Skeleton revives itself, from its cursed max HP', () => {
    const initial = start(['skeleton', 'ghoul'], { cursed: 0 });
    expect(initial.enemies[0]).toMatchObject({ maxHp: 42, maxGuard: 24 });
    const battle = withEnemy(initial, 0, { hp: 1, guard: 1 });

    const attacked = heroAction(battle, {
      action: { kind: 'attack' },
      touchStartedAt: 950,
      releasedAt: 1_000,
    });
    const struck = pressStrike(attacked.battle, { at: 1_700 }).battle;

    expect(struck.enemies[0]).toMatchObject({ hp: 21, guard: 24, cursed: true, selfRevives: 1 });
  });
});

describe('enemies that enter during the battle are never cursed (#209)', () => {
  it('brings a reinforcement uncursed', () => {
    const initial = start(['ghoul', 'specter', 'ghoul', 'ghoul'], { cursed: 0 });
    const twoDown = { ...withEnemy(withEnemy(initial, 0, { hp: 0 }), 1, { hp: 0 }), target: 2 };

    const { battle } = playUntil(twoDown, has('reinforcementEntered'));

    expect(battle.enemies[0]).toMatchObject({ kind: 'ghoul', maxHp: 50, maxGuard: 30 });
    expect(battle.enemies.some((enemy) => enemy.cursed !== undefined)).toBe(false);
  });

  it('brings the summoned Mothkin uncursed', () => {
    const initial = withEnemy(start(['mothQueen'], { cursed: 0, initiative: true }), 0, {
      hp: 205,
      guard: 70,
    });

    const { battle } = playUntil(initial, has('summonEntered'));

    const summoned = battle.enemies.filter((enemy) => enemy.summoned);
    expect(summoned.length).toBeGreaterThan(0);
    expect(summoned.every((enemy) => enemy.cursed === undefined)).toBe(true);
  });
});

describe('a saved battle with a cursed enemy (#209)', () => {
  it('keeps the curse on resume', () => {
    const battle = start(['ghoul', 'specter'], { cursed: 1 });
    const saved = JSON.parse(JSON.stringify(battle)) as Battle;

    expect(resumeBattle(saved, 5_000).enemies[1]).toMatchObject({ maxHp: 42, cursed: true });
  });
});
