// Le multiplicateur d'Élite et de boss (`EliteBossMultiplier`, #244, R1) : les Élites et les boss
// commencent leur combat avec les PV max, la garde max et les dégâts de leur palier, jamais le
// Saignement, la Brûlure ni l'Initiative ; l'Élite maudite part de la valeur du palier. #257 : la
// colonne PV et dégâts des Élites à 80 / 80 / 88 % (décision du 08/11/2026).
import {
  advance,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
  type BattleUpdate,
} from '../battle/Battle';
import type { BattleEvent } from '../battle/BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from '../battle/combatants';
import type { TierMultiplier } from '../battle/tierMultiplier';
import { drawnAttacks, strikesText } from './testing/eliteBossStrikes';
import { TIERS, encounterMultiplier, type Tier } from './tiers';

function start(kind: EnemyKind, multiplier: TierMultiplier, cursed?: number): Battle {
  return startBattle({
    seed: 7,
    defenseHint: false,
    at: 0,
    enemies: [kind],
    tierMultiplier: multiplier,
    ...(cursed !== undefined && { cursed }),
  }).battle;
}

const roleOf = (tier: Tier, kind: EnemyKind) =>
  TIERS[tier].elites.includes(kind) ? 'elite' : 'boss';

/** Les dégâts de chaque coup d'une Élite ou d'un boss à son palier, phase 2 comprise. */
const strikesAt = (tier: Tier, kind: EnemyKind) =>
  strikesText(kind, encounterMultiplier(tier, roleOf(tier, kind)).hpPercent);

describe('the Elite and boss multiplier (#244, R1)', () => {
  it.each([
    [1, 'twins', 160, 37, '4 + 4, 8, 4'],
    [1, 'fallenKnight', 160, 56, '6, 6, 9'],
    [1, 'ossuaryWarden', 300, 75, '9, 10 ; phase 2 : 6 + 6, 15'],
    [1, 'facelessPrior', 300, 75, '8, 5 + 5 ; phase 2 : 10, 14'],
    [2, 'scarecrow', 152, 70, '8, 8, 12'],
    [2, 'brambleBurner', 168, 77, '8, 4 + 4, 12'],
    [2, 'ashGardener', 420, 97, '12, 13 ; phase 2 : 7 + 7, 18'],
    [2, 'mothQueen', 400, 87, null],
    [3, 'firstPilgrim', 237, 82, '7 + 7, 12, 12, 18'],
    [3, 'stoneSaint', 220, 120, '11, 14, 19'],
    [3, 'hourRinger', 650, 130, '9 + 9, 18 ; phase 2 : 16, 27'],
    [3, 'wishGranter', 650, 121, '16, 16 ; phase 2 : 10 + 10, 28'],
  ] as const)(
    'gives at tier %i the %s %i max HP, %i max guard and its strikes',
    (tier, kind, maxHp, maxGuard, strikes) => {
      const battle = start(kind, encounterMultiplier(tier, roleOf(tier, kind)));

      expect(battle.enemies[0]).toMatchObject({ maxHp, hp: maxHp, maxGuard, guard: maxGuard });
      if (strikes !== null) expect(strikesAt(tier, kind)).toBe(strikes);
    },
  );

  it('keeps the HP and the strikes of the bosses of tiers 1 and 2 (#257: not the Elites)', () => {
    for (const kind of [...TIERS[1].bosses, ...TIERS[2].bosses]) {
      const tier = TIERS[1].bosses.includes(kind) ? 1 : 2;
      expect(start(kind, encounterMultiplier(tier, roleOf(tier, kind))).enemies[0]!.maxHp).toBe(
        ENEMIES[kind].maxHp,
      );
      expect(strikesAt(tier, kind)).toBe(strikesText(kind, 100));
    }
  });

  it('never multiplies the Burn, the Bleed nor the Initiative of the Bramble burner', () => {
    const { hpPercent } = encounterMultiplier(2, 'elite');
    const drawn = drawnAttacks('brambleBurner', hpPercent);

    expect(drawn.get('basic')).toMatchObject({ damage: 8, burn: 2 });
    expect(drawn.get('double')).toMatchObject({ damage: 4, bleed: { damage: 2, rounds: 3 } });
    expect(ENEMY_INITIATIVE.brambleBurner).toBe(6);
  });

  it('starts a cursed First pilgrim at tier 3 from the value of the tier: 284 HP, 98 guard', () => {
    const battle = start('firstPilgrim', encounterMultiplier(3, 'elite'), 0);

    expect(battle.enemies[0]).toMatchObject({ maxHp: 284, maxGuard: 98, cursed: true });
  });
});

/** Rejoue le combat, sans défense, le héros attaque à son tour, jusqu'à sa première frappe jugée. */
function struckOnce(initial: Battle): Battle {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let guard = 0; guard < 300; guard += 1) {
    if (events.some((event) => event.type === 'strikeResolved')) return battle;
    let update: BattleUpdate;
    if (battle.phase.kind === 'hero') {
      const releasedAt = battle.now + 100;
      update = heroAction(battle, {
        action: { kind: 'attack' },
        touchStartedAt: releasedAt - 50,
        releasedAt,
      });
    } else {
      update = advance(battle, nextDeadline(battle)!.at + 40);
    }
    battle = update.battle;
    events.push(...update.events);
  }
  throw new Error('The hero never struck');
}

describe('what follows from the Elite and boss multiplier (#244)', () => {
  const ringer = (hp: number) => {
    const battle = start('hourRinger', encounterMultiplier(3, 'boss'));
    return struckOnce({
      ...battle,
      enemies: battle.enemies.map((enemy) => ({ ...enemy, hp, guard: 40 })),
    }).enemies[0]!;
  };

  it('shifts the Hour ringer of tier 3 at 325 HP or less, its guard back to 130', () => {
    // Une frappe sans appui de la Sentinelle : 10 PV.
    expect(ringer(335)).toMatchObject({ hp: 325, phase2: true, guard: 130 });
    expect(ringer(336).phase2).toBeUndefined();
  });

  it('summons the Mothkin of the Moth queen with the tier multiplier, as before', () => {
    const battle = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      enemies: ['mothQueen'],
      tierMultiplier: encounterMultiplier(2, 'boss'),
      summonMultiplier: TIERS[2].multiplier,
    }).battle;

    expect(battle.summonMultiplier).toBe(TIERS[2].multiplier);
    expect(battle.tierMultiplier).toEqual({ hpPercent: 100, guardPercent: 125 });
  });
});
