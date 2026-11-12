/**
 * Les règles du domaine de « Ennemis maudits » (#209), sans écran : le tirage de l'ennemi maudit
 * dans l'ascension, ses valeurs, sa relève, la graine et les Éclats. L'étiquette accordée vient du
 * texte de l'interface (`cursedTag`).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { cursedTag } from '../../src/adapters/ui/format/battleText';
import {
  chooseExit,
  endFloorBattle,
  startAscent,
  type Ascent,
  type Encounter,
} from '../../src/domain/ascent/Ascent';
import type { Exit } from '../../src/domain/ascent/exits';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';
import { TIERS, encounterMultiplier } from '../../src/domain/ascent/tiers';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import {
  FRONT_LINE_SIZE,
  advance,
  enemyInitiative,
  heroAction,
  nextDeadline,
  startBattle,
  type Battle,
  type BattleUpdate,
} from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from '../../src/domain/battle/combatants';
import { cursedValue } from '../../src/domain/battle/curse';
import { drawIntent } from '../../src/domain/battle/intents';
import { seedRandom } from '../../src/domain/battle/SeededRandom';
import { scaleByPercent } from '../../src/domain/battle/tierMultiplier';

// 50 000 graines : avec le Porte-cierge et le Rat de crypte (#268), le groupe Goule, Spectre et
// Nécromancien est plus rare au 1er étage ; il en faut 200.
const SEEDS = Array.from({ length: 50_000 }, (_, index) => index);

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

/** L'ascension entre deux étages, la porte `exit` seule proposée, franchie. */
function through(ascent: Ascent, exit: Exit): Ascent {
  return chooseExit({ ...won(ascent), boonOffer: null, exits: [exit] }, 0);
}

/** Le combat de l'étage, commencé comme la session le commence. */
function battleOf(ascent: Ascent): Battle {
  const encounter = ascent.encounter!;
  return startBattle({
    seed: encounter.battleSeed,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies: encounter.enemies,
    // Le multiplicateur du combat, de palier ou d'Élite et de boss (#244).
    tierMultiplier: encounterMultiplier(ascent.tier, encounter.kind),
    ...(encounter.cursed !== undefined && { cursed: encounter.cursed }),
  }).battle;
}

/** Les dégâts de chaque coup de `kind` tirés par l'intention, maudit ou non. */
function strikes(kind: EnemyKind, cursed: boolean, damagePercent = 100): Record<string, number> {
  const damages: Record<string, number> = {};
  for (let seed = 1; seed < 60; seed += 1) {
    const { intent } = drawIntent(kind, seedRandom(seed), {
      fallenAlly: null,
      stunned: false,
      guardDamaged: false,
      damagePercent,
      cursed,
    });
    if (intent.category === 'attack') damages[intent.attack] = intent.damage;
  }
  return damages;
}

/** Rejoue le combat, sans défense, le héros attaque à son tour, jusqu'à `done`. */
function playUntil(initial: Battle, done: (events: readonly BattleEvent[]) => boolean): Battle {
  let battle = initial;
  const events: BattleEvent[] = [];
  for (let step = 0; step < 400; step += 1) {
    if (done(events)) return battle;
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

const has = (type: BattleEvent['type']) => (events: readonly BattleEvent[]) =>
  events.some((event) => event.type === type);

const cursedCount = (battle: Battle) => battle.enemies.filter((enemy) => enemy.cursed).length;

interface World {
  gauge: FateGauge;
  gauges: FateGauge[];
  encounters: Encounter[];
  ascent: Ascent;
  battle: Battle;
  plain: Ascent;
}

let world: World;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une ascension (?:au palier 1 )?lancée avec une jauge de −(\d)$/u, (level: string) => {
    world = { gauge: -Number(level) as FateGauge } as World;
  });

  // --- Un ennemi maudit par combat ordinaire ---

  when(
    /^le héros entre dans un combat ordinaire contre la Goule, le Spectre et le Nécromancien$/u,
    () => {
      world.encounters = SEEDS.map((seed) => startAscent(seed, { gauge: world.gauge }).encounter!)
        .filter(({ enemies }) => [...enemies].sort().join() === 'ghoul,necromancer,specter')
        .slice(0, 200);
      expect(world.encounters).toHaveLength(200);
    },
  );

  then(/^exactement un de ces ennemis est maudit, la Goule ou le Spectre, tiré à égalité$/u, () => {
    const cursed = world.encounters.map(({ enemies, cursed: index }) => enemies[index!]);
    const ghouls = cursed.filter((kind) => kind === 'ghoul').length;
    expect(new Set(cursed)).toEqual(new Set(['ghoul', 'specter']));
    expect(ghouls).toBeGreaterThan(70);
    expect(ghouls).toBeLessThan(130);
  });

  and(/^ce n'est jamais le Nécromancien, qui est un soutien$/u, () => {
    expect(ENEMIES.necromancer.supports).toBe(true);
    for (const { enemies, cursed } of world.encounters) {
      expect(enemies[cursed!]).not.toBe('necromancer');
    }
  });

  and(/^il porte l'étiquette « Maudit » \(« Maudite » pour la Goule\) sous son nom$/u, () => {
    expect(cursedTag({ kind: 'ghoul', cursed: true })).toBe('Maudite');
    expect(cursedTag({ kind: 'specter', cursed: true })).toBe('Maudit');
  });

  // --- Ce que gagne un ennemi maudit ---

  when(
    /^la Goule \(50 PV, garde 30, coup simple de 5, double frappe de 3 \+ 3, Initiative 4\) est maudite$/u,
    () => {
      expect(ENEMIES.ghoul).toMatchObject({ maxHp: 50, maxGuard: 30 });
      expect(strikes('ghoul', false)).toEqual({ basic: 5, double: 3 });
      expect(ENEMY_INITIATIVE.ghoul).toBe(4);
      world.battle = startBattle({
        seed: 1,
        defenseHint: false,
        at: 0,
        initiative: true,
        enemies: ['ghoul', 'specter'],
        tierMultiplier: TIERS[1].multiplier,
        cursed: 0,
      }).battle;
    },
  );

  then(
    /^elle a 60 PV max, une garde max de 36, un coup simple de 6 et une double frappe de 4 \+ 4$/u,
    () => {
      expect(world.battle.enemies[0]).toMatchObject({ maxHp: 60, maxGuard: 36, cursed: true });
      expect(strikes('ghoul', true)).toEqual({ basic: 6, double: 4 });
    },
  );

  and(/^son Initiative reste 4$/u, () => {
    expect(enemyInitiative(world.battle.enemies[0]!)).toBe(4);
  });

  // --- Sur la valeur du palier ---

  given(/^un ennemi ordinaire maudit à un palier dont le multiplicateur s'applique$/u, () => {
    world = {} as World;
  });

  when(/^le combat commence$/u, () => {
    // Chaque ennemi ordinaire des paliers 2 et 3, maudit, au multiplicateur de son palier.
  });

  then(
    /^ses PV max, sa garde max et les dégâts de chaque coup valent la valeur du palier plus 20 % de cette valeur, à l'entier inférieur, et au moins \+1$/u,
    () => {
      for (const tier of [2, 3] as const) {
        const multiplier = TIERS[tier].multiplier;
        for (const { kind } of TIERS[tier].enemies) {
          const { battle } = startBattle({
            seed: 1,
            defenseHint: false,
            at: 0,
            enemies: [kind],
            tierMultiplier: multiplier,
            cursed: 0,
          });
          const tierHp = scaleByPercent(ENEMIES[kind].maxHp, multiplier.hpPercent);
          const tierGuard = scaleByPercent(ENEMIES[kind].maxGuard, multiplier.guardPercent);
          expect(battle.enemies[0]).toMatchObject({
            maxHp: tierHp + Math.max(1, Math.floor(tierHp / 5)),
            maxGuard: tierGuard + Math.max(1, Math.floor(tierGuard / 5)),
          });
          for (let seed = 1; seed < 20; seed += 1) {
            const context = { fallenAlly: null, stunned: true, guardDamaged: false };
            const percent = { damagePercent: multiplier.hpPercent };
            const plain = drawIntent(kind, seedRandom(seed), { ...context, ...percent }).intent;
            const cursed = drawIntent(kind, seedRandom(seed), {
              ...context,
              ...percent,
              cursed: true,
            }).intent;
            if (plain.category === 'attack' && cursed.category === 'attack') {
              expect(cursed.damage).toBe(plain.damage + Math.max(1, Math.floor(plain.damage / 5)));
            }
          }
        }
      }
    },
  );

  // --- L'Élite ---

  when(/^le héros passe la porte Élite$/u, () => {
    world.ascent = through(startAscent(5, { gauge: world.gauge }), {
      kind: 'elite',
      groupSize: null,
    });
    world.battle = battleOf(world.ascent);
  });

  then(/^le Chevalier déchu n'est pas maudit$/u, () => {
    // #257 : le Chevalier déchu du palier 1 à 80 % (200 → 160).
    expect(world.battle.enemies[0]).toMatchObject({ kind: 'fallenKnight', maxHp: 160 });
    expect(world.ascent.encounter!.cursed).toBeUndefined();
    expect(cursedCount(world.battle)).toBe(0);
  });

  when(/^le héros entre dans un combat ordinaire$/u, () => {
    world.ascent = startAscent(5, { gauge: world.gauge });
    world.battle = battleOf(world.ascent);
  });

  then(/^exactement un ennemi du groupe est maudit, avec le même bonus qu'à −1$/u, () => {
    expect(cursedCount(world.battle)).toBe(1);
    const cursed = world.battle.enemies.find((enemy) => enemy.cursed)!;
    expect(cursed.maxHp).toBe(cursedValue(ENEMIES[cursed.kind].maxHp));
    expect(cursed.maxGuard).toBe(cursedValue(ENEMIES[cursed.kind].maxGuard));
  });

  when(/^il passe ensuite la porte Élite$/u, () => {
    world.ascent = through(world.ascent, { kind: 'elite', groupSize: null });
    world.battle = battleOf(world.ascent);
  });

  then(/^le Chevalier déchu est maudit$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({ kind: 'fallenKnight', cursed: true });
  });

  and(
    /^il a 192 PV max, une garde max de 67, des coups de 7, 7 et 10, et son Initiative reste 6$/u,
    () => {
      // #257 : 80 % au palier 1 (160 PV ; coups 6, 6 et 9), puis +20 % maudit.
      expect(world.battle.enemies[0]).toMatchObject({ maxHp: 192, maxGuard: 67 });
      const { hpPercent } = encounterMultiplier(1, 'elite');
      expect(
        ENEMIES.fallenKnight.moves.map(({ damage }) =>
          cursedValue(scaleByPercent(damage, hpPercent)),
        ),
      ).toEqual([7, 7, 10]);
      expect(strikes('fallenKnight', true, hpPercent)).toEqual({
        basic: 7,
        delayed: 7,
        perilous: 10,
      });
      expect(enemyInitiative(world.battle.enemies[0]!)).toBe(6);
    },
  );

  // --- Le boss ---

  when(/^le héros affronte le boss$/u, () => {
    world.ascent = through(startAscent(5, { gauge: world.gauge }), {
      kind: 'boss',
      groupSize: null,
    });
  });

  then(/^le boss n'est pas maudit$/u, () => {
    expect(world.ascent.encounter).toMatchObject({ kind: 'boss' });
    expect(world.ascent.encounter!.cursed).toBeUndefined();
    expect(cursedCount(battleOf(world.ascent))).toBe(0);
  });

  and(/^aucun ennemi de son invocation n'est maudit$/u, () => {
    // La Reine des phalènes, au palier 2, à 205 PV : le prochain coup l'amène à invoquer.
    const queen = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      initiative: true,
      enemies: ['mothQueen'],
      summonMultiplier: TIERS[2].multiplier,
    }).battle;
    const wounded = { ...queen, enemies: [{ ...queen.enemies[0]!, hp: 205, guard: 60 }] };
    const entered = playUntil(wounded, has('summonEntered'));
    expect(entered.enemies.some((enemy) => enemy.summoned)).toBe(true);
    expect(cursedCount(entered)).toBe(0);
  });

  // --- Groupe de 5 ---

  when(
    /^le héros entre dans un combat ordinaire contre un groupe de 5 ennemis, dont 2 en réserve$/u,
    () => {
      world.ascent = through(startAscent(5, { gauge: world.gauge }), {
        kind: 'combat',
        groupSize: 5,
      });
      world.battle = battleOf(world.ascent);
      expect(world.ascent.encounter!.enemies).toHaveLength(5);
      expect(world.battle.reserve).toHaveLength(2);
    },
  );

  then(/^un seul des 5 ennemis est maudit$/u, () => {
    expect(cursedCount(world.battle)).toBe(1);
  });

  and(/^c'est un ennemi de la première ligne, jamais un soutien$/u, () => {
    const index = world.ascent.encounter!.cursed!;
    expect(index).toBeLessThan(FRONT_LINE_SIZE);
    expect(ENEMIES[world.ascent.encounter!.enemies[index]!].supports).toBe(false);
  });

  and(/^aucun ennemi de la réserve n'est maudit, même quand il entre en renfort$/u, () => {
    const front = world.battle.enemies.map((enemy) => (enemy.cursed ? enemy : { ...enemy, hp: 0 }));
    const target = front.findIndex((enemy) => enemy.hp > 0);
    const reinforced = playUntil(
      { ...world.battle, enemies: front, target },
      has('reinforcementEntered'),
    );
    expect(cursedCount(reinforced)).toBe(1);
  });

  // --- Relève ---

  given(/^la Goule maudite \(60 PV max\) tombe$/u, () => {
    const battle = startBattle({
      seed: 7,
      defenseHint: false,
      at: 0,
      enemies: ['ghoul', 'necromancer'],
      cursed: 0,
    }).battle;
    expect(battle.enemies[0]).toMatchObject({ maxHp: 60, cursed: true });
    world = {} as World;
    world.battle = { ...battle, enemies: [{ ...battle.enemies[0]!, hp: 0 }, battle.enemies[1]!] };
  });

  when(/^le Nécromancien la relève$/u, () => {
    world.battle = playUntil({ ...world.battle, target: 1 }, has('allyRaised'));
  });

  then(/^elle est toujours maudite$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({ cursed: true, raised: true });
  });

  and(/^ses PV au relevé se calculent sur ses PV max maudits, 60 PV$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({ hp: 30, maxHp: 60 });
  });

  // --- Récompense ---

  given(/^un groupe avec un ennemi maudit$/u, () => {
    world = { ascent: startAscent(5, { gauge: -1 }) } as World;
    expect(world.ascent.encounter!.cursed).toBeDefined();
  });

  when(/^le héros gagne le combat$/u, () => {
    const { cursed: _cursed, ...uncursed } = world.ascent.encounter!;
    world.plain = won({ ...world.ascent, encounter: uncursed });
    world.ascent = won(world.ascent);
  });

  then(
    /^l'ennemi maudit ne rapporte ni Or, ni objet, ni bienfait de plus qu'un ennemi non maudit$/u,
    () => {
      expect(world.ascent).toEqual(world.plain);
    },
  );

  // --- Un ennemi seul ---

  when(/^le héros entre dans un combat ordinaire contre une seule Goule$/u, () => {
    world.ascent = SEEDS.map((seed) => startAscent(seed, { gauge: world.gauge })).find(
      ({ encounter }) => encounter!.enemies.join() === 'ghoul',
    )!;
  });

  then(/^la Goule est maudite$/u, () => {
    expect(world.ascent.encounter!.cursed).toBe(0);
    expect(battleOf(world.ascent).enemies[0]).toMatchObject({ maxHp: 60, cursed: true });
  });

  // --- Sans malédiction ---

  given(/^une ascension lancée avec une jauge de 0, \+1 ou \+2$/u, () => {
    world = { gauges: [0, 1, 2] } as World;
  });

  when(/^le héros entre dans n'importe quel combat$/u, () => {
    // Les 200 ascensions du palier 1, rejouées à chaque jauge, du combat imposé au boss.
  });

  then(/^aucun ennemi n'est maudit$/u, () => {
    for (const gauge of world.gauges) {
      for (let seed = 1; seed <= 50; seed += 1) {
        let ascent = startAscent(seed, { gauge });
        for (let floor = 1; floor <= 6 && ascent.encounter !== null; floor += 1) {
          expect(ascent.encounter.cursed).toBeUndefined();
          ascent = won(ascent);
          if (ascent.exits.length === 0) break;
          ascent = chooseExit({ ...ascent, boonOffer: null }, 0);
        }
      }
    }
  });

  and(
    /^aucun tirage n'est fait pour l'ennemi maudit : les tirages de l'ascension sont ceux d'aujourd'hui$/u,
    () => {
      TIER_ONE_WALKS.forEach((walk, index) => expect(walkTierOne(index + 1)).toBe(walk));
      for (const gauge of [1, 2] as const) {
        for (let seed = 1; seed <= 50; seed += 1) {
          expect(startAscent(seed, { gauge }).encounter).toEqual(startAscent(seed).encounter);
          expect(startAscent(seed, { gauge }).random).toBe(startAscent(seed).random);
        }
      }
    },
  );

  // --- La graine ---

  given(
    /^deux ascensions de même graine, lancées avec la même jauge de −1, aux mêmes choix$/u,
    () => {
      world = { gauge: -1 } as World;
    },
  );

  when(/^le héros entre dans le même combat ordinaire$/u, () => {
    const path = (seed: number) =>
      through(startAscent(seed, { gauge: world.gauge }), { kind: 'combat', groupSize: 3 })
        .encounter!;
    world.encounters = [path(77), path(77)];
  });

  then(/^le même ennemi est maudit dans les deux$/u, () => {
    const [first, second] = world.encounters;
    expect(first!.cursed).toBeDefined();
    expect(second).toEqual(first);
  });

  // --- Les Éclats ---

  given(/^un ennemi maudit a été vaincu pendant l'ascension$/u, () => {
    const ascent = startAscent(5, { gauge: -1 });
    expect(ascent.encounter!.cursed).toBeDefined();
    world = { ascent } as World;
  });

  when(/^le héros bat le boss du palier 1$/u, () => {
    world.ascent = won(through(world.ascent, { kind: 'boss', groupSize: null }));
    world.plain = won(through(startAscent(5), { kind: 'boss', groupSize: null }));
  });

  then(/^il gagne 8 Éclats, comme sans ennemi maudit$/u, () => {
    const shards = (ascent: Ascent) => ascent.shardAwards.map(({ amount }) => amount);
    expect(shards(world.ascent)).toEqual([8]);
    expect(shards(world.plain)).toEqual([8]);
  });
};

// Les règles du domaine seules : `@session` et `@ui` passent par la session et les écrans.
const feature = loadFeature('features/ennemis-maudits.feature');
const ofDomain = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@domain');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofDomain),
      scenarioOutlines: feature.scenarioOutlines.filter(ofDomain),
    },
  ],
  [steps],
);
