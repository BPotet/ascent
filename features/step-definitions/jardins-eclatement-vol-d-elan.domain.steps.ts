/**
 * Les règles du domaine de « Les Jardins de cendre, l'Éclatement et le Vol d'Élan » (#267), sans
 * écran : la Cosse de braise et la Phalène voleuse au palier 2, l'Éclatement à la chute de la Cosse
 * et le Vol d'Élan à chaque impact de la Phalène, joués par le moteur du combat ; le tirage des
 * groupes et des escortes des Jardins de cendre.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ESCORT_POOLS } from '../../src/domain/ascent/eliteEscort';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { WALKED_SEEDS, walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import { TIERS, encounterMultipliers } from '../../src/domain/ascent/tiers';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import {
  ENEMIES,
  ENEMY_INITIATIVE,
  GOOD_PARRY_PERCENT,
  SENTINEL,
  type EnemyKind,
} from '../../src/domain/battle/combatants';
import { scaleDamage } from '../../src/domain/battle/rules';
import {
  DODGE,
  GOOD_PARRY,
  PERFECT_PARRY,
  SUFFERED,
  blowOf,
  defend,
  eventsOf,
  gardensBattle,
  strike,
  toHeroPhase,
  type Played,
} from '../support/ashGardensStory';

interface World {
  kind: 'emberPod' | 'thievingMoth';
  battle: Battle;
  played: Played;
  cases: Played[];
  burnBefore: number;
}

let world = {} as World;

const NAMES: Readonly<Record<string, 'emberPod' | 'thievingMoth'>> = {
  'Cosse de braise': 'emberPod',
  'Phalène voleuse': 'thievingMoth',
};

/** Les coups tirés au combat, maudit ou non, pour 400 graines : « double 4 » → nombre de tirages. */
function drawnMoves(kind: EnemyKind, cursed: boolean): Map<string, number> {
  const enemies = [kind];
  const drawn = new Map<string, number>();
  for (let seed = 1; seed <= 400; seed += 1) {
    const { battle } = startBattle({
      seed,
      defenseHint: false,
      at: 0,
      enemies,
      ...(cursed && { cursed: 0 }),
      ...encounterMultipliers(2, { kind: 'combat', enemies }),
    });
    const { intent } = battle.enemies[0]!;
    if (intent?.category !== 'attack') throw new Error('It only attacks');
    const key = `${intent.attack} ${intent.damage}`;
    drawn.set(key, (drawn.get(key) ?? 0) + 1);
  }
  return drawn;
}

/** Un ennemi au combat du palier 2, maudit ou non. */
function fighting(kind: EnemyKind, cursed: boolean) {
  const enemies = [kind];
  return startBattle({
    seed: 1,
    defenseHint: false,
    at: 0,
    enemies,
    ...(cursed && { cursed: 0 }),
    ...encounterMultipliers(2, { kind: 'combat', enemies }),
  }).battle.enemies[0]!;
}

/** Le rapport des tirages des deux coups : ~1 pour « une chance sur deux », ~2 pour « 2 contre 1 ». */
const ratio = (drawn: Map<string, number>, first: string, second: string) =>
  drawn.get(first)! / drawn.get(second)!;

/** Le héros prend les 2 charges de l'Éclatement, et la Cosse n'est pas étouffée. */
function expectBurst({ battle, events }: Played, before: number) {
  expect(eventsOf(events, 'enemyDefeated')).toEqual([expect.objectContaining({ enemy: 0 })]);
  expect(eventsOf(events, 'heroBurning')).toEqual([
    expect.objectContaining({ cause: 'emberBurst', enemy: 0, added: 2, stacks: before + 2 }),
  ]);
  expect(eventsOf(events, 'emberBurstSmothered')).toEqual([]);
  expect(battle.hero.burn).toBe(before + 2);
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Les fiches ---

  given(/^un combat ordinaire au palier 2 avec une (Cosse de braise|Phalène voleuse)$/u, (name) => {
    world = { kind: NAMES[name]! } as World;
  });

  then(
    /^ses valeurs du Codex sont (\d+) PV, garde (\d+) et Initiative (\d+)$/u,
    (hp, guard, init) => {
      const { maxHp, maxGuard } = ENEMIES[world.kind];
      expect([maxHp, maxGuard, ENEMY_INITIATIVE[world.kind]]).toEqual(
        [hp, guard, init].map(Number),
      );
    },
  );

  and(
    /^au combat elle a (\d+) PV et une garde de (\d+)(?: \(multiplicateur de palier\))?$/u,
    (hp, guard) => {
      const enemy = fighting(world.kind, false);
      expect([enemy.maxHp, enemy.maxGuard]).toEqual([Number(hp), Number(guard)]);
    },
  );

  and(
    /^ses coups sont l'Éclat de coque \(coup simple de (\d+)\) et le Crachin de cendre \(double frappe de (\d+) \+ \2\), à une chance sur deux$/u,
    (shard, drizzle) => {
      const drawn = drawnMoves('emberPod', false);
      expect([...drawn.keys()].sort()).toEqual([`basic ${shard}`, `double ${drizzle}`]);
      expect(ratio(drawn, `basic ${shard}`, `double ${drizzle}`)).toBeGreaterThan(0.7);
      expect(ratio(drawn, `basic ${shard}`, `double ${drizzle}`)).toBeLessThan(1.4);
    },
  );

  and(
    /^maudite, elle a (\d+) PV, une garde de (\d+), un Éclat de coque de (\d+) et un Crachin de cendre de (\d+) \+ \4$/u,
    (hp, guard, shard, drizzle) => {
      const enemy = fighting('emberPod', true);
      expect([enemy.maxHp, enemy.maxGuard]).toEqual([Number(hp), Number(guard)]);
      expect([...drawnMoves('emberPod', true).keys()].sort()).toEqual([
        `basic ${shard}`,
        `double ${drizzle}`,
      ]);
    },
  );

  and(
    /^ses coups sont le Frôlement \(double frappe de (\d+) \+ \1\) et la Poudre d'ailes \(coup trompeur de (\d+)\), dans un rapport de 2 contre 1$/u,
    (brush, dust) => {
      const drawn = drawnMoves('thievingMoth', false);
      expect([...drawn.keys()].sort()).toEqual([`double ${brush}`, `feint ${dust}`]);
      expect(ratio(drawn, `double ${brush}`, `feint ${dust}`)).toBeGreaterThan(1.5);
      expect(ratio(drawn, `double ${brush}`, `feint ${dust}`)).toBeLessThan(2.6);
    },
  );

  and(
    /^maudite, elle a (\d+) PV, une garde de (\d+), un Frôlement de (\d+) \+ \3 et une Poudre d'ailes de (\d+)$/u,
    (hp, guard, brush, dust) => {
      const enemy = fighting('thievingMoth', true);
      expect([enemy.maxHp, enemy.maxGuard]).toEqual([Number(hp), Number(guard)]);
      expect([...drawnMoves('thievingMoth', true).keys()].sort()).toEqual([
        `double ${brush}`,
        `feint ${dust}`,
      ]);
    },
  );

  // --- L'Éclatement ---

  given(/^une Cosse de braise non étourdie$/u, () => {
    world = { burnBefore: 0 } as World;
    world.battle = gardensBattle({ first: 'emberPod' });
    expect(world.battle.enemies[0]!.stun).toBeNull();
  });

  when(/^une même frappe brise sa garde et la fait tomber$/u, () => {
    world.battle = {
      ...world.battle,
      enemies: world.battle.enemies.map((enemy, index) =>
        index === 0 ? { ...enemy, guard: 1 } : enemy,
      ),
    };
    world.cases = [strike(world.battle)];
    // Le coup qui brise et fait tomber est une chute, pas une cassure.
    expect(eventsOf(world.cases[0]!.events, 'guardBroken')).toEqual([]);
  });

  when(
    /^une frappe, une frappe de pouvoir, une contre-attaque ou la Riposte du Rempart la fait tomber$/u,
    () => {
      const struck = strike(world.battle);
      const powered = strike(
        gardensBattle({
          first: 'emberPod',
          powers: ['bulwark', 'shieldBash'],
          heroState: { momentum: 5 },
        }),
        { kind: 'power', power: 'shieldBash' },
      );
      const countered = defend(blowOf(world.battle), PERFECT_PARRY);
      const riposted = defend(
        blowOf(gardensBattle({ first: 'emberPod', heroState: { momentum: 5 } }), {
          action: { kind: 'power', power: 'bulwark' },
        }),
        SUFFERED,
      );
      expect(eventsOf(struck.events, 'strikeResolved')).toHaveLength(1);
      expect(eventsOf(powered.events, 'strikeResolved')).toEqual([
        expect.objectContaining({ power: 'shieldBash' }),
      ]);
      expect(eventsOf(countered.events, 'counterAttacked')).toHaveLength(1);
      expect(eventsOf(riposted.events, 'bulwarkCountered')).toHaveLength(1);
      world.cases = [struck, powered, countered, riposted];
    },
  );

  then(/^elle éclate et le héros prend 2 charges de Brûlure$/u, () => {
    for (const played of world.cases) expectBurst(played, world.burnBefore);
  });

  given(/^le héros avec de la réduction des dégâts, un Rempart actif et la Brume$/u, () => {
    world = { burnBefore: 0 } as World;
    expect(SENTINEL.damageReductionPercent).toBeGreaterThan(0);
  });

  and(/^une Cosse de braise maudite non étourdie$/u, () => {
    world.battle = gardensBattle({
      first: 'emberPod',
      cursed: 0,
      heroState: { bulwark: true, mist: true },
    });
    expect(world.battle.enemies[0]).toMatchObject({ cursed: true, stun: null });
  });

  when(/^elle tombe$/u, () => {
    world.played = strike(world.battle);
  });

  then(/^le héros prend exactement 2 charges de Brûlure$/u, () => {
    expectBurst(world.played, 0);
    expect(world.played.battle.hero.hp).toBe(world.battle.hero.hp);
  });

  and(/^ni le Rempart ni la Brume ne sont usés$/u, () => {
    expect(eventsOf(world.played.events, 'bulwarkWorn')).toEqual([]);
    expect(eventsOf(world.played.events, 'mistWorn')).toEqual([]);
    expect(world.played.battle.hero).toMatchObject({ bulwark: true, mist: true });
  });

  given(/^une Cosse de braise relevée par la Glaneuse de cendre$/u, () => {
    world = { burnBefore: 0 } as World;
    const start = gardensBattle({ first: 'emberPod', others: ['ashGleaner', 'ghoul'] });
    const first = strike({
      ...start,
      enemies: start.enemies.map((enemy, index) =>
        index === 1
          ? { ...enemy, stun: null, intent: { category: 'raise' as const, ally: 0 } }
          : enemy,
      ),
    });
    expectBurst(first, 0);
    const raised = toHeroPhase(first);
    expect(eventsOf(raised.events, 'allyRaised')).toEqual([
      expect.objectContaining({ enemy: 1, ally: 0 }),
    ]);
    world.burnBefore = raised.battle.hero.burn ?? 0;
    world.battle = raised.battle;
  });

  when(/^elle tombe une 2ᵉ fois sans être étourdie$/u, () => {
    world.played = strike({
      ...world.battle,
      target: 0,
      enemies: world.battle.enemies.map((enemy, index) =>
        index === 0
          ? { ...enemy, hp: 1, stun: null }
          : { ...enemy, stun: { heroAction: 999, actionLost: false } },
      ),
    });
  });

  then(/^elle éclate de nouveau et le héros prend 2 charges de Brûlure$/u, () => {
    expectBurst(world.played, world.burnBefore);
  });

  // --- Le Vol d'Élan ---

  given(/^le héros avec 3 Élan$/u, () => {
    world = {} as World;
    world.battle = gardensBattle({ first: 'thievingMoth' });
  });

  when(/^il fait une bonne parade sur un impact de la Phalène voleuse$/u, () => {
    world.played = defend(blowOf(world.battle, { hero: { momentum: 3 } }), GOOD_PARRY);
  });

  then(/^il subit 25 % des dégâts et perd 1 Élan$/u, () => {
    const [blow] = eventsOf(world.played.events, 'blowResolved');
    expect(blow).toMatchObject({
      outcome: 'parry',
      damage: scaleDamage(5, GOOD_PARRY_PERCENT, 100 - SENTINEL.damageReductionPercent),
    });
    expect(eventsOf(world.played.events, 'momentumStolen')).toEqual([
      expect.objectContaining({ enemy: 0, stolen: 1, momentum: 2 }),
    ]);
    expect(world.played.battle.hero.momentum).toBe(2);
  });

  when(/^les 2 impacts d'un Frôlement le touchent$/u, () => {
    world.played = defend(
      blowOf(world.battle, { attack: 'double', hero: { momentum: 3 } }),
      SUFFERED,
      SUFFERED,
    );
  });

  then(/^il perd 2 Élan et passe à 1 Élan$/u, () => {
    expect(eventsOf(world.played.events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'suffered' }),
      expect.objectContaining({ outcome: 'suffered' }),
    ]);
    expect(eventsOf(world.played.events, 'momentumStolen').map(({ stolen }) => stolen)).toEqual([
      1, 1,
    ]);
    expect(world.played.battle.hero.momentum).toBe(1);
  });

  when(/^il pare parfaitement un impact de la Phalène voleuse$/u, () => {
    world.played = defend(blowOf(world.battle, { hero: { momentum: 3 } }), PERFECT_PARRY);
  });

  then(/^rien n'est volé et il gagne son \+1 Élan habituel$/u, () => {
    expect(eventsOf(world.played.events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'perfectParry', damage: 0 }),
    ]);
    expect(eventsOf(world.played.events, 'momentumStolen')).toEqual([]);
    expect(eventsOf(world.played.events, 'momentumChanged')).toEqual([
      expect.objectContaining({ momentum: 4 }),
    ]);
    expect(world.played.battle.hero.momentum).toBe(4);
  });

  when(/^il esquive un impact dans la fenêtre$/u, () => {
    world.played = defend(blowOf(world.battle, { hero: { momentum: 3 } }), DODGE);
  });

  then(/^rien n'est volé$/u, () => {
    expect(eventsOf(world.played.events, 'blowResolved')).toEqual([
      expect.objectContaining({ outcome: 'dodge', damage: 0 }),
    ]);
    expect(eventsOf(world.played.events, 'momentumStolen')).toEqual([]);
    expect(world.played.battle.hero.momentum).toBe(3);
  });

  given(/^le héros sous un Rempart actif avec 3 Élan$/u, () => {
    world = {} as World;
    world.battle = blowOf(gardensBattle({ first: 'thievingMoth', heroState: { momentum: 4 } }), {
      action: { kind: 'power', power: 'bulwark' },
      hero: { momentum: 3 },
    });
    expect(world.battle.hero).toMatchObject({ bulwark: true, momentum: 3 });
  });

  when(/^un impact de la Phalène voleuse le touche$/u, () => {
    world.played = defend(world.battle, SUFFERED);
  });

  then(/^les dégâts sont réduits par le Rempart et la Riposte part$/u, () => {
    const [blow] = eventsOf(world.played.events, 'blowResolved');
    expect(blow!.outcome).toBe('suffered');
    expect(blow!.damage).toBeLessThan(scaleDamage(5, 100 - SENTINEL.damageReductionPercent));
    expect(eventsOf(world.played.events, 'bulwarkWorn')).toHaveLength(1);
    expect(eventsOf(world.played.events, 'bulwarkCountered')).toEqual([
      expect.objectContaining({ enemy: 0 }),
    ]);
  });

  and(/^il perd quand même 1 Élan$/u, () => {
    expect(eventsOf(world.played.events, 'momentumStolen')).toEqual([
      expect.objectContaining({ stolen: 1, momentum: 2 }),
    ]);
    expect(world.played.battle.hero.momentum).toBe(2);
  });

  given(/^une Phalène voleuse maudite au palier 2$/u, () => {
    world = {} as World;
    world.battle = gardensBattle({ first: 'thievingMoth', cursed: 0 });
    expect(world.battle.enemies[0]!.cursed).toBe(true);
  });

  when(/^un impact le touche$/u, () => {
    world.played = defend(
      blowOf(world.battle, { keepIntent: true, hero: { momentum: 5 } }),
      SUFFERED,
    );
  });

  then(/^le héros perd exactement 1 Élan$/u, () => {
    const [first] = eventsOf(world.played.events, 'momentumStolen');
    expect(first).toMatchObject({ enemy: 0, stolen: 1, momentum: 4 });
    const blows = eventsOf(world.played.events, 'blowResolved').length;
    expect(eventsOf(world.played.events, 'momentumStolen')).toHaveLength(blows);
    expect(world.played.battle.hero.momentum).toBe(5 - blows);
  });

  // --- Le tirage ---

  given(/^le palier 2$/u, () => {
    world = {} as World;
  });

  then(
    /^un groupe d'ennemis est tiré parmi le Pèlerin enronce, la Ronce de cendre, la Glaneuse de cendre, l'Embrasé, la Phalénide, la Cosse de braise et la Phalène voleuse, dans cet ordre$/u,
    () => {
      expect(TIERS[2].enemies.map(({ kind }) => kind)).toEqual([
        'thornPilgrim',
        'ashBramble',
        'ashGleaner',
        'burningHusk',
        'mothkin',
        'emberPod',
        'thievingMoth',
      ]);
    },
  );

  and(
    /^la Cosse de braise et la Phalène voleuse ont chacune un poids de tirage de 2 et au plus 1 par groupe$/u,
    () => {
      expect(TIERS[2].enemies.slice(-2)).toEqual([
        { kind: 'emberPod', weight: 2, cap: 1 },
        { kind: 'thievingMoth', weight: 2, cap: 1 },
      ]);
    },
  );

  and(
    /^l'escorte d'une Élite des Jardins de cendre peut les tirer, au multiplicateur de palier$/u,
    () => {
      const pool = ESCORT_POOLS[2].map(({ kind }) => kind);
      expect(pool).toEqual(expect.arrayContaining(['emberPod', 'thievingMoth']));
      const enemies: EnemyKind[] = ['scarecrow', 'emberPod', 'thievingMoth'];
      const escorted = startBattle({
        seed: 3,
        defenseHint: false,
        at: 0,
        enemies,
        ...encounterMultipliers(2, { kind: 'elite', enemies }),
      }).battle;
      expect(escorted.enemies.slice(1)).toEqual([
        expect.objectContaining({ kind: 'emberPod', maxHp: 45, maxGuard: 22, escort: true }),
        expect.objectContaining({ kind: 'thievingMoth', maxHp: 35, maxGuard: 15, escort: true }),
      ]);
    },
  );

  and(/^elles ne sont tirées dans aucun autre palier$/u, () => {
    for (const tier of [1, 3] as const) {
      const kinds = [...TIERS[tier].enemies, ...ESCORT_POOLS[tier]].map(({ kind }) => kind);
      expect(kinds).not.toContain('emberPod');
      expect(kinds).not.toContain('thievingMoth');
    }
  });

  given(/^une ascension aux Catacombes ou au Beffroi$/u, () => {
    world = {} as World;
  });

  then(
    /^ses groupes d'ennemis, ses escortes et ses marches figées du palier 1 sont identiques à ceux d'avant cette story$/u,
    () => {
      expect(TIERS[1].enemies.map(({ kind }) => kind)).toEqual([
        'ghoul',
        'specter',
        'necromancer',
        'skeleton',
        'madVillager',
      ]);
      expect(TIERS[3].enemies.map(({ kind }) => kind)).toEqual([
        'bronzeWarden',
        'gargoyle',
        'bellFounder',
        'bellNovice',
        'matinsRinger',
        'clockJack',
        'bronzeRam',
        'bellClapper',
      ]);
      expect(ESCORT_POOLS[1].map(({ kind }) => kind)).toEqual([
        'ghoul',
        'specter',
        'skeleton',
        'madVillager',
      ]);
      expect(ESCORT_POOLS[3].map(({ kind }) => kind)).toEqual([
        'bronzeWarden',
        'gargoyle',
        'bellFounder',
        'bellNovice',
        'clockJack',
        'bronzeRam',
        'bellClapper',
      ]);
      expect(Array.from({ length: WALKED_SEEDS }, (_, index) => walkTierOne(index + 1))).toEqual(
        TIER_ONE_WALKS,
      );
    },
  );
};

// Les règles du domaine seules : `@ui` passe par l'écran, `@session` par la session.
const feature = loadFeature('features/jardins-eclatement-vol-d-elan.feature');
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
