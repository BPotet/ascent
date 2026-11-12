// La Phalène voleuse (`thievingMoth`, #267) et son Vol d'Élan (`MomentumTheft`, ADR 0028) dans le
// combat (la Sentinelle réduit les dégâts de 10 %) : ses valeurs du palier 2, le vol de chaque
// impact qui touche (VE1), ni parade parfaite ni esquive (VE2), après les dégâts, sous le Rempart
// (VE3), ni palier ni malédiction (VE4), et pas d'Élan volé à un héros mis à 0 PV.
import { encounterMultipliers } from '../ascent/tiers';
import { ATTACKS, type AttackKind } from './attacks';
import {
  advance,
  heroAction,
  nextDeadline,
  powerAvailability,
  pressDefense,
  startBattle,
  type AttackStep,
  type Battle,
  type BattleOptions,
  type HeroState,
} from './Battle';
import type { BattleEvent, DefenseButton } from './BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, enemySignature, type EnemyKind } from './combatants';

const STUN = { heroAction: 999, actionLost: false };

type EventOf<Type extends BattleEvent['type']> = Extract<BattleEvent, { type: Type }>;

const eventsOf = <Type extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: Type,
): EventOf<Type>[] => events.filter((event): event is EventOf<Type> => event.type === type);

type Defense = { readonly button: DefenseButton; readonly offset: number } | null;

const SUFFERED: Defense = null;
const GOOD_PARRY: Defense = { button: 'parry', offset: 100 };
const PERFECT_PARRY: Defense = { button: 'parry', offset: 0 };
const DODGE: Defense = { button: 'dodge', offset: 0 };
/** Un appui raté : trop tôt, l'impact est reçu. */
const MISSED: Defense = { button: 'parry', offset: -600 };

interface Played {
  readonly battle: Battle;
  readonly events: BattleEvent[];
}

/**
 * Un combat ordinaire du palier 2 contre la Phalène voleuse (indice 0), increvable, puis un ennemi
 * increvable et étourdi tout le combat. Sans `attack`, la Phalène garde l'intention tirée.
 */
function mothBattle({
  attack,
  others = ['ghoul'],
  ...options
}: Partial<BattleOptions> & {
  readonly attack?: AttackKind;
  readonly others?: readonly EnemyKind[];
} = {}): Battle {
  const enemies: readonly EnemyKind[] = ['thievingMoth', ...others];
  const { battle } = startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    heroHp: 60,
    enemies,
    ...encounterMultipliers(2, { kind: 'combat', enemies }),
    ...options,
  });
  const intent =
    attack === undefined
      ? {}
      : {
          intent: {
            category: 'attack' as const,
            attack,
            damage: 5,
            windUpMs: ATTACKS[attack].windUpMs,
            feintFraction: 0.5,
          },
        };
  return {
    ...battle,
    enemies: battle.enemies.map((enemy, index) =>
      index === 0
        ? { ...enemy, hp: 999, maxHp: 999, guard: 999, ...intent }
        : { ...enemy, hp: 999, maxHp: 999, guard: 999, stun: STUN },
    ),
  };
}

/** Le héros fait `action` (par défaut il attaque), puis le combat va jusqu'au coup de la Phalène. */
function toBlow(
  battle: Battle,
  hero: Partial<HeroState> = {},
  action: Parameters<typeof heroAction>[1]['action'] = { kind: 'attack' },
): Battle {
  let current = heroAction(battle, { action, touchStartedAt: 50, releasedAt: 100 }).battle;
  for (let step = 0; step < 100; step += 1) {
    const { phase } = current;
    if (phase.kind === 'enemy' && phase.step.kind === 'attack') {
      return { ...current, hero: { ...current.hero, ...hero } };
    }
    const deadline = nextDeadline(current)!;
    current = advance(current, deadline.at + (deadline.awaitsPress ? 1 : 0)).battle;
  }
  throw new Error('The Thieving moth never attacked');
}

const stepOf = (battle: Battle) => (battle.phase as { readonly step: AttackStep }).step;

/** Le coup de la Phalène jusqu'à sa fin (riposte comprise), chaque impact reçoit sa défense. */
function defend(initial: Battle, ...defenses: readonly Defense[]): Played {
  const events: BattleEvent[] = [];
  const pressed = new Set<number>();
  let battle = initial;
  const { startedAt } = stepOf(initial);
  for (let guard = 0; guard < 100; guard += 1) {
    const { phase } = battle;
    if (phase.kind !== 'enemy' || phase.step.kind !== 'attack') break;
    if (phase.step.startedAt !== startedAt) break;
    const index = phase.step.impacts.findIndex((impact) => impact.outcome === null);
    const defense = index < 0 ? null : (defenses[index] ?? null);
    const update =
      defense !== null && !pressed.has(index)
        ? pressDefense(battle, {
            button: defense.button,
            at: phase.step.impacts[index]!.at + defense.offset,
          })
        : advanceToDeadline(battle);
    if (defense !== null) pressed.add(index);
    if (update === null) break;
    battle = update.battle;
    events.push(...update.events);
  }
  return { battle, events };
}

function advanceToDeadline(battle: Battle) {
  const deadline = nextDeadline(battle);
  return deadline === null ? null : advance(battle, deadline.at + (deadline.awaitsPress ? 1 : 0));
}

describe('the Thieving moth, an ordinary enemy of the Ash gardens (#267)', () => {
  it('has the values of codex/thievingMoth v1: 26 HP, guard 12, Initiative 9, its theft of 1', () => {
    expect(ENEMIES.thievingMoth).toEqual({
      maxHp: 26,
      maxGuard: 12,
      moves: [
        { attack: 'double', damage: 3, weight: 2 },
        { attack: 'feint', damage: 6 },
      ],
      supports: false,
      momentumTheft: { amount: 1 },
    });
    expect(ENEMY_INITIATIVE.thievingMoth).toBe(9);
  });

  it('has the signature of its theft, and the Mothkin none', () => {
    expect(enemySignature('thievingMoth')).toBe('momentumTheft');
    expect(enemySignature('mothkin')).toBeNull();
  });

  it.each([
    [false, 35, 15, ['double 4', 'feint 8']],
    [true, 42, 18, ['double 5', 'feint 9']],
  ])(
    'fights at tier 2, cursed %s, with %i HP and guard %i, its Brush and its Wing dust two to one',
    (cursed, hp, guard, moves) => {
      const enemies: EnemyKind[] = ['thievingMoth'];
      const struck = new Map<string, number>();
      for (let seed = 1; seed <= 300; seed += 1) {
        const { battle } = startBattle({
          seed,
          defenseHint: false,
          at: 0,
          enemies,
          ...(cursed && { cursed: 0 }),
          ...encounterMultipliers(2, { kind: 'combat', enemies }),
        });
        const [moth] = battle.enemies;
        expect([moth!.maxHp, moth!.maxGuard]).toEqual([hp, guard]);
        const { intent } = moth!;
        if (intent?.category !== 'attack') throw new Error('The Thieving moth only attacks');
        const key = `${intent.attack} ${intent.damage}`;
        struck.set(key, (struck.get(key) ?? 0) + 1);
      }

      expect([...struck.keys()].sort()).toEqual(moves);
      const [brush, dust] = moves.map((move) => struck.get(move)!);
      expect(brush! / (brush! + dust!)).toBeGreaterThan(0.55);
      expect(brush! / (brush! + dust!)).toBeLessThan(0.78);
    },
  );
});

describe('an impact that touches the hero steals 1 momentum (#267, VE1, VE3)', () => {
  it('steals 1 of 3 after the damage of a suffered blow', () => {
    const { battle, events } = defend(
      toBlow(mothBattle({ attack: 'basic' }), { momentum: 3 }),
      SUFFERED,
    );
    const [blow] = eventsOf(events, 'blowResolved');
    const after = events.slice(events.indexOf(blow!) + 1);

    expect(blow).toMatchObject({ outcome: 'suffered', damage: 4, heroHp: 56 });
    expect(after.filter(({ type }) => type.startsWith('momentum'))).toEqual([
      { type: 'momentumStolen', at: blow!.at, enemy: 0, stolen: 1, momentum: 2 },
      { type: 'momentumChanged', at: blow!.at, momentum: 2 },
    ]);
    expect(battle.hero.momentum).toBe(2);
  });

  it('steals 1 on a good parry, which lets 25 % of the damage through', () => {
    const { battle, events } = defend(
      toBlow(mothBattle({ attack: 'basic' }), { momentum: 3 }),
      GOOD_PARRY,
    );
    const [blow] = eventsOf(events, 'blowResolved');

    expect(blow!.outcome).toBe('parry');
    expect(blow!.damage).toBeGreaterThan(0);
    expect(blow!.damage).toBeLessThan(5);
    expect(eventsOf(events, 'momentumStolen')).toEqual([
      expect.objectContaining({ stolen: 1, momentum: 2 }),
    ]);
    expect(battle.hero.momentum).toBe(2);
  });

  it('steals 1 when a missed press lets the blow land', () => {
    const { battle, events } = defend(
      toBlow(mothBattle({ attack: 'basic' }), { momentum: 3 }),
      MISSED,
    );

    expect(eventsOf(events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'suffered' }),
    ]);
    expect(battle.hero.momentum).toBe(2);
  });

  it('steals 2 from a Brush suffered in full: 3 becomes 1', () => {
    const { battle, events } = defend(
      toBlow(mothBattle({ attack: 'double' }), { momentum: 3 }),
      SUFFERED,
      SUFFERED,
    );

    expect(eventsOf(events, 'blowResolved')).toHaveLength(2);
    expect(eventsOf(events, 'momentumStolen')).toEqual([
      expect.objectContaining({ enemy: 0, stolen: 1, momentum: 2 }),
      expect.objectContaining({ enemy: 0, stolen: 1, momentum: 1 }),
    ]);
    expect(battle.hero.momentum).toBe(1);
  });

  it('reduces the damage under the Bulwark, ripostes, and still steals 1', () => {
    const blow = toBlow(
      mothBattle({ attack: 'basic' }),
      { momentum: 3 },
      { kind: 'power', power: 'bulwark' },
    );
    expect(blow.hero.bulwark).toBe(true);
    const { battle, events } = defend(blow, SUFFERED);
    const [resolved] = eventsOf(events, 'blowResolved');

    expect(resolved!.damage).toBeLessThan(5);
    expect(eventsOf(events, 'bulwarkWorn')).toHaveLength(1);
    expect(eventsOf(events, 'bulwarkCountered')).toHaveLength(1);
    expect(eventsOf(events, 'momentumStolen')).toEqual([
      expect.objectContaining({ stolen: 1, momentum: 2 }),
    ]);
    expect(battle.hero.momentum).toBe(2);
  });
});

describe('a perfect parry or a dodge keeps the momentum (#267, VE2)', () => {
  it('steals nothing on a perfect parry, which gives its usual +1', () => {
    const { battle, events } = defend(
      toBlow(mothBattle({ attack: 'basic' }), { momentum: 3 }),
      PERFECT_PARRY,
    );

    expect(eventsOf(events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'perfectParry' }),
    ]);
    expect(eventsOf(events, 'momentumStolen')).toEqual([]);
    expect(eventsOf(events, 'momentumChanged')).toEqual([expect.objectContaining({ momentum: 4 })]);
    expect(battle.hero.momentum).toBe(4);
  });

  it('steals nothing on a dodge in the window', () => {
    const { battle, events } = defend(
      toBlow(mothBattle({ attack: 'basic' }), { momentum: 3 }),
      DODGE,
    );

    expect(eventsOf(events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'dodge' }),
    ]);
    expect(eventsOf(events, 'momentumStolen')).toEqual([]);
    expect(battle.hero.momentum).toBe(3);
  });
});

describe('nothing to steal (#267, VE1)', () => {
  it('steals nothing and says nothing from a hero at 0 momentum', () => {
    const { battle, events } = defend(
      toBlow(mothBattle({ attack: 'basic' }), { momentum: 0 }),
      SUFFERED,
    );

    expect(eventsOf(events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'suffered', damage: 4, heroHp: 56 }),
    ]);
    expect(eventsOf(events, 'momentumStolen')).toEqual([]);
    expect(eventsOf(events, 'momentumChanged')).toEqual([]);
    expect(battle.hero.momentum).toBe(0);
  });

  it('steals nothing from an impact that puts the hero at 0 HP: his second chance keeps it', () => {
    const { battle, events } = defend(
      toBlow(mothBattle({ attack: 'basic', secondChance: true }), { momentum: 3, hp: 1 }),
      SUFFERED,
    );

    expect(eventsOf(events, 'secondChanceUsed')).toHaveLength(1);
    expect(eventsOf(events, 'momentumStolen')).toEqual([]);
    expect(battle.hero.momentum).toBe(3);
  });

  it('steals nothing from the impact that defeats the hero', () => {
    const { events } = defend(
      toBlow(mothBattle({ attack: 'basic' }), { momentum: 3, hp: 1 }),
      SUFFERED,
    );

    expect(eventsOf(events, 'battleEnded')).toEqual([
      expect.objectContaining({ outcome: 'defeat' }),
    ]);
    expect(eventsOf(events, 'momentumStolen')).toEqual([]);
  });

  it('steals nothing for an enemy without a theft', () => {
    const plain = mothBattle({ attack: 'basic' });
    const ghoul: Battle = {
      ...plain,
      enemies: plain.enemies.map((enemy, index) =>
        index === 0 ? { ...enemy, kind: 'mothkin' as const } : enemy,
      ),
    };
    const { events } = defend(toBlow(ghoul, { momentum: 3 }), SUFFERED);

    expect(eventsOf(events, 'blowResolved')).toHaveLength(1);
    expect(eventsOf(events, 'momentumStolen')).toEqual([]);
  });
});

describe('neither the tier nor the curse change the theft (#267, VE4)', () => {
  it('steals exactly 1 per impact for a cursed moth at tier 2', () => {
    const blow = toBlow(mothBattle({ cursed: 0 }), { momentum: 5 });
    expect(blow.enemies[0]!.cursed).toBe(true);
    const impacts = stepOf(blow).impacts.length;
    const { battle, events } = defend(blow, SUFFERED, SUFFERED);

    expect(eventsOf(events, 'momentumStolen')).toHaveLength(impacts);
    for (const stolen of eventsOf(events, 'momentumStolen')) expect(stolen.stolen).toBe(1);
    expect(battle.hero.momentum).toBe(5 - impacts);
  });
});

describe('the theft is felt in the hero phase (#267)', () => {
  it('leaves the Bulwark short of 1 momentum when the moth stole the only one', () => {
    const { battle } = defend(toBlow(mothBattle({ attack: 'basic' }), { momentum: 1 }), SUFFERED);

    expect(battle.hero.momentum).toBe(0);
    expect(powerAvailability(battle, 'bulwark')).toEqual({ kind: 'missing', missing: 1 });
  });
});
