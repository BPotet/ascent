/**
 * Les règles du domaine de « Le Beffroi, le Balayage et la Charge » (#266), sans écran : le
 * Battant de cloche et le Bélier de bronze au palier 3, le Balayage jugé par le moteur du combat,
 * la Charge et ce qui la brise, le tirage des groupes et des escortes du Beffroi.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ESCORT_POOLS } from '../../src/domain/ascent/eliteEscort';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { WALKED_SEEDS, walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import { TIERS } from '../../src/domain/ascent/tiers';
import { advance, pressDefense, startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { chargeMark } from '../../src/domain/battle/charge';
import { ENEMIES, ENEMY_INITIATIVE, type EnemyKind } from '../../src/domain/battle/combatants';
import { cursedValue } from '../../src/domain/battle/curse';
import { drawIntent } from '../../src/domain/battle/intents';
import { nextRandom, seedRandom } from '../../src/domain/battle/SeededRandom';
import { scaleByPercent } from '../../src/domain/battle/tierMultiplier';
import {
  BELFRY,
  blowOf,
  chargingRam,
  happened,
  playUntil,
  pressAt,
  ramBattle,
  roundStarted,
  stepOf,
  sweepWindUp,
  weakened,
  type Played,
} from '../support/belfryStory';

interface World {
  kind: EnemyKind;
  battle: Battle;
  played: Played;
  cases: Played[];
  before: Battle;
}

let world = {} as World;

const typesOf = (events: readonly BattleEvent[]) => events.map((event) => event.type);
const windUpsOf = (events: readonly BattleEvent[]) =>
  events.filter(
    (event): event is Extract<BattleEvent, { type: 'windUpStarted' }> =>
      event.type === 'windUpStarted' && event.enemy === 0,
  );

/** Les ennemis du palier 3, dans l'ordre de leur liste. */
const BELFRY_LIST: readonly EnemyKind[] = [
  'bronzeWarden',
  'gargoyle',
  'bellFounder',
  'bellNovice',
  'matinsRinger',
  'clockJack',
  'bronzeRam',
  'bellClapper',
];

function codexOf(kind: EnemyKind) {
  return { hp: ENEMIES[kind].maxHp, guard: ENEMIES[kind].maxGuard, init: ENEMY_INITIATIVE[kind] };
}

/** Les dégâts au combat d'un coup du Codex, au palier 3, maudit ou non. */
const atBelfry = (damage: number, cursed = false) => {
  const scaled = scaleByPercent(damage, BELFRY.hpPercent);
  return cursed ? cursedValue(scaled) : scaled;
};

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Les fiches ---

  given(
    /^un combat ordinaire au palier 3 avec un (Battant de cloche|Bélier de bronze)$/u,
    (name) => {
      world = { kind: name === 'Battant de cloche' ? 'bellClapper' : 'bronzeRam' } as World;
      world.battle = startBattle({
        seed: 3,
        defenseHint: false,
        at: 0,
        enemies: [world.kind],
        tierMultiplier: BELFRY,
      }).battle;
    },
  );

  then(
    /^ses valeurs du Codex sont (\d+) PV, garde (\d+) et Initiative (\d+)$/u,
    (hp, guard, init) => {
      expect(codexOf(world.kind)).toEqual({
        hp: Number(hp),
        guard: Number(guard),
        init: Number(init),
      });
    },
  );

  and(
    /^au combat il a (\d+) PV et une garde de (\d+)(?: \(multiplicateur de palier\))?$/u,
    (hp, guard) => {
      expect(world.battle.enemies[0]).toMatchObject({ maxHp: Number(hp), maxGuard: Number(guard) });
    },
  );

  and(
    /^ses coups sont le Grand balayage \(Balayage de 10\) et le Coup de battant \(coup simple de 8\), dans un rapport de 2 contre 1$/u,
    () => {
      const [sweep, blow] = ENEMIES.bellClapper.moves;
      expect([sweep!.attack, atBelfry(sweep!.damage), sweep!.weight]).toEqual(['sweep', 10, 2]);
      expect([blow!.attack, atBelfry(blow!.damage), blow!.weight ?? 1]).toEqual(['basic', 8, 1]);
    },
  );

  and(
    /^ses coups sont le Coup de front \(coup simple de 10\) et le Coup de bélier \(coup retardé de 21 avec Charge\), dans un rapport de 2 contre 1$/u,
    () => {
      const [front, ram] = ENEMIES.bronzeRam.moves;
      expect([front!.attack, atBelfry(front!.damage), front!.weight]).toEqual(['basic', 10, 2]);
      expect([ram!.attack, atBelfry(ram!.damage), ram!.weight ?? 1, ram!.charge]).toEqual([
        'delayed',
        21,
        1,
        true,
      ]);
    },
  );

  and(
    /^maudit, il a (\d+) PV, une garde de (\d+), un .+ de (\d+) et un .+ de (\d+)$/u,
    (hp, guard, first, second) => {
      const cursed = startBattle({
        seed: 3,
        defenseHint: false,
        at: 0,
        enemies: [world.kind],
        tierMultiplier: BELFRY,
        cursed: 0,
      }).battle.enemies[0]!;
      expect(cursed).toMatchObject({ maxHp: Number(hp), maxGuard: Number(guard), cursed: true });
      expect(ENEMIES[world.kind].moves.map(({ damage }) => atBelfry(damage, true))).toEqual([
        Number(first),
        Number(second),
      ]);
    },
  );

  // --- Le Balayage ---

  given(
    /^la Sentinelle \(réduction des dégâts 10 %\) face au Grand balayage de 10 d'un Battant de cloche$/u,
    () => {
      world = { battle: sweepWindUp() } as World;
    },
  );

  given(/^la Sentinelle face au Grand balayage de 10 d'un Battant de cloche$/u, () => {
    world = { battle: sweepWindUp() } as World;
  });

  given(/^la Sentinelle face à un Balayage$/u, () => {
    world = { battle: sweepWindUp() } as World;
  });

  when(/^elle pare dans la fenêtre parfaite$/u, () => {
    world.played = pressAt(world.battle, 'parry', 0);
  });

  then(/^elle ne subit aucun dégât, gagne 1 Élan et contre-attaque$/u, () => {
    expect(blowOf(world.played.events)).toMatchObject({ outcome: 'perfectParry', damage: 0 });
    expect(world.played.battle.hero.momentum).toBe(world.battle.hero.momentum + 1);
    expect(stepOf(world.played.battle).counter).toMatchObject({ done: false });
  });

  when(/^elle fait une bonne parade sur un autre Balayage$/u, () => {
    world.played = pressAt(sweepWindUp(), 'parry', -100);
  });

  then(/^elle subit 2 dégâts$/u, () => {
    expect(blowOf(world.played.events)).toMatchObject({ outcome: 'parry', damage: 2 });
  });

  when(/^elle n'appuie pas$/u, () => {
    world.played = advance(world.battle, stepOf(world.battle).impacts[0]!.at + 1_000);
  });

  then(/^elle subit 9 dégâts, sans déséquilibre$/u, () => {
    expect(blowOf(world.played.events)).toMatchObject({ outcome: 'suffered', damage: 9 });
    expect(typesOf(world.played.events)).not.toContain('offBalanceStarted');
  });

  when(/^elle esquive trop tôt ou trop tard$/u, () => {
    world.cases = [pressAt(world.battle, 'dodge', -300), pressAt(world.battle, 'dodge', 300)];
  });

  then(/^c'est un appui raté, jugé comme aujourd'hui$/u, () => {
    const [early, late] = world.cases;
    expect(early!.events).toContainEqual(
      expect.objectContaining({ type: 'whiffed', reason: 'early' }),
    );
    expect(late!.events).toContainEqual(
      expect.objectContaining({ type: 'whiffed', reason: 'late' }),
    );
    for (const { events } of world.cases) {
      expect(blowOf(events)?.outcome).not.toBe('sweepDodge');
      expect(typesOf(events)).toContain('offBalanceStarted');
    }
  });

  given(/^le héros sous un Rempart actif face au Grand balayage de 10$/u, () => {
    world = { battle: sweepWindUp('sentinel', { bulwark: true }) } as World;
  });

  when(/^il esquive dans la fenêtre$/u, () => {
    world.played = pressAt(world.battle, 'dodge', 0);
  });

  then(/^il subit 4 dégâts, le Rempart est usé et sa Riposte part à la fin du coup$/u, () => {
    expect(blowOf(world.played.events)).toMatchObject({ outcome: 'sweepDodge', damage: 4 });
    expect(typesOf(world.played.events)).toContain('bulwarkWorn');
    const { events } = advance(world.played.battle, stepOf(world.played.battle).resolvedAt + 600);
    expect(typesOf(events)).toContain('bulwarkCountered');
  });

  given(/^le héros avec 2 charges de Brûlure$/u, () => {
    world = { battle: sweepWindUp('sentinel', { burn: 2 }) } as World;
  });

  when(/^il esquive un Balayage dans la fenêtre$/u, () => {
    world.played = pressAt(world.battle, 'dodge', 0);
  });

  then(/^aucune charge de Brûlure ne s'éteint$/u, () => {
    expect(typesOf(world.played.events)).not.toContain('burnExtinguished');
    expect(world.played.battle.hero.burn).toBe(2);
  });

  when(/^il pare parfaitement un Balayage$/u, () => {
    world.played = pressAt(world.battle, 'parry', 0);
  });

  then(/^une charge de Brûlure s'éteint$/u, () => {
    expect(world.played.events).toContainEqual(
      expect.objectContaining({ type: 'burnExtinguished', stacks: 1 }),
    );
  });

  given(/^l'Errante avec Pas de l'ombre actif face à un Balayage$/u, () => {
    world = { battle: sweepWindUp('wanderer', { shadowStep: true }) } as World;
  });

  when(/^elle esquive dans la fenêtre$/u, () => {
    world.played = pressAt(world.battle, 'dodge', 0);
  });

  then(/^elle ne gagne pas d'Élan et ne contre-attaque pas$/u, () => {
    expect(blowOf(world.played.events)?.outcome).toBe('sweepDodge');
    expect(world.played.battle.hero.momentum).toBe(world.battle.hero.momentum);
    expect(stepOf(world.played.battle).counter).toBeNull();
  });

  and(/^Pas de l'ombre reste actif$/u, () => {
    expect(world.played.battle.hero.shadowStep).toBe(true);
  });

  // --- La Charge ---

  given(/^un Bélier de bronze qui charge$/u, () => {
    world = { battle: chargingRam() } as World;
  });

  when(
    /^sa garde tombe à 0 sous une frappe, une frappe de pouvoir, une contre-attaque ou la Riposte du Rempart, avant la préparation du Coup de bélier$/u,
    () => {
      const strike = playUntil(weakened(world.battle), happened('guardBroken'));
      const powered = chargingRam({}, { powers: ['bulwark', 'shieldBash'] });
      const power = playUntil(
        { ...weakened(powered), hero: { ...powered.hero, momentum: 5 } },
        happened('guardBroken'),
        () => ({ kind: 'power', power: 'shieldBash' }),
      );
      // En jeu, la contre-attaque et la Riposte ne frappent le Bélier qu'après l'impact de son
      // Coup de bélier, trop tard (CH4) : la règle ne regarde pas l'auteur, ce que montre un
      // Bélier remis en Charge sous son coup.
      const ramming = playUntil(world.battle, happened('windUpStarted')).battle;
      const recharged: Battle = {
        ...ramming,
        enemies: ramming.enemies.map((enemy) => ({ ...enemy, guard: 1, charge: 'charging' })),
      };
      const impact = stepOf(recharged).impacts[0]!.at;
      const parried = pressDefense(recharged, { button: 'parry', at: impact });
      const counter = advance(parried.battle, impact + 1_000);
      const riposte = advance(
        { ...recharged, hero: { ...recharged.hero, bulwark: true } },
        impact + 2_000,
      );
      world.cases = [
        strike,
        power,
        { battle: counter.battle, events: [...parried.events, ...counter.events] },
        riposte,
      ];
    },
  );

  then(/^la Charge est brisée$/u, () => {
    const breakers = world.cases.map(({ events }) => {
      const broken = events.find(
        (event): event is Extract<BattleEvent, { type: 'guardBroken' }> =>
          event.type === 'guardBroken',
      );
      expect(typesOf(events)).toContain('chargeBroken');
      return broken!.by;
    });
    expect(breakers).toEqual(['strike', 'strike', 'counter', 'bulwarkCounter']);
    expect(world.cases[1]!.events).toContainEqual(
      expect.objectContaining({ type: 'powerUsed', power: 'shieldBash' }),
    );
  });

  given(/^un Bélier de bronze dont l'intention de la manche N est la Charge$/u, () => {
    world = { battle: ramBattle({ guard: 1 }) } as World;
  });

  when(/^sa garde tombe à 0 avant son action de la manche N$/u, () => {
    world.played = playUntil(world.battle, roundStarted(2));
  });

  then(/^la Charge est brisée et il ne charge pas$/u, () => {
    expect(typesOf(world.played.events)).toContain('chargeBroken');
    expect(typesOf(world.played.events)).not.toContain('chargeStarted');
    expect(typesOf(world.played.events)).toContain('actionLost');
  });

  and(/^il n'y a pas de Coup de bélier à la manche N\+1$/u, () => {
    const { events } = playUntil(world.played.battle, roundStarted(3));
    expect(windUpsOf(events).some((windUp) => windUp.charged === true)).toBe(false);
  });

  given(/^un Bélier de bronze dont la préparation du Coup de bélier a commencé$/u, () => {
    const ramming = playUntil(chargingRam(), happened('windUpStarted')).battle;
    world = { battle: weakened(ramming) } as World;
  });

  when(/^une contre-attaque ou la Riposte du Rempart brise sa garde après l'impact$/u, () => {
    const impact = stepOf(world.battle).impacts[0]!.at;
    const parried = pressDefense(world.battle, { button: 'parry', at: impact });
    const counter = advance(parried.battle, impact + 1_000);
    const riposte = advance(
      { ...world.battle, hero: { ...world.battle.hero, bulwark: true } },
      impact + 2_000,
    );
    world.cases = [
      { battle: counter.battle, events: [...parried.events, ...counter.events] },
      riposte,
    ];
  });

  then(/^le Coup de bélier a déjà été porté et rien n'est annulé$/u, () => {
    expect(stepOf(world.battle).charged).toBe(true);
    for (const { events } of world.cases) {
      expect(typesOf(events)).toContain('blowResolved');
      expect(typesOf(events)).toContain('guardBroken');
      expect(typesOf(events)).not.toContain('chargeBroken');
    }
  });

  given(/^un Bélier de bronze dont la Charge a été brisée$/u, () => {
    world = {
      battle: playUntil(ramBattle({ guard: 1 }), happened('chargeBroken')).battle,
    } as World;
  });

  when(/^il fait son retour en garde$/u, () => {
    world.played = playUntil(world.battle, happened('guardRestored'));
  });

  then(/^il tire de nouveau librement son coup$/u, () => {
    expect(world.battle.enemies[0]!.charge).toBe('broken');
    expect(world.played.battle.enemies[0]!.charge).toBeUndefined();
  });

  and(/^une nouvelle Charge recommence à « Charge 1\/2 »$/u, () => {
    const { battle } = world.played;
    const again: Battle = {
      ...battle,
      enemies: battle.enemies.map((enemy) => ({ ...enemy, intent: { category: 'charge' } })),
    };
    // « Charge 1/2 » est l'état `first` de la marque de la Charge.
    expect(chargeMark(again, 0)).toBe('first');
  });

  given(/^un Bélier de bronze étourdi au début de la manche$/u, () => {
    world = {} as World;
  });

  then(/^il n'agit pas de la manche et ne commence aucune Charge$/u, () => {
    let ramBlows = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      const { events } = playUntil(ramBattle({ guard: 1 }, { seed }), roundStarted(3));
      const from = events.findIndex((event) => event.type === 'roundStarted' && event.round === 2);
      const to = events.findIndex((event) => event.type === 'roundStarted' && event.round === 3);
      const round = events[from] as Extract<BattleEvent, { type: 'roundStarted' }>;
      const inRound = events.slice(from, to);
      // Étourdi au début de la manche 2 : sa garde revient pendant la manche, il n'agit pas.
      expect(inRound).toContainEqual(expect.objectContaining({ type: 'guardRestored', enemy: 0 }));
      expect(round.intents[0]!.category).not.toBe('charge');
      expect([seed, windUpsOf(inRound)]).toEqual([seed, []]);
      expect(typesOf(inRound)).not.toContain('chargeStarted');
      if (round.intents[0]!.category === 'attack' && round.intents[0]!.attack === 'delayed') {
        ramBlows += 1;
      }
    }
    // Au moins une graine tire le Coup de bélier, étourdi.
    expect(ramBlows).toBeGreaterThan(0);
  });

  and(/^ses 3 tirages sont quand même consommés$/u, () => {
    const random = seedRandom(11);
    const three = nextRandom(nextRandom(nextRandom(random).state).state).state;
    const context = { fallenAlly: null, stunned: true, guardDamaged: true };
    expect(drawIntent('bronzeRam', random, context).random).toBe(three);
  });

  when(/^ses PV tombent à 0$/u, () => {
    const dying: Battle = {
      ...world.battle,
      enemies: world.battle.enemies.map((enemy) => ({ ...enemy, hp: 1 })),
    };
    world.played = playUntil(dying, (_, battle) => battle.phase.kind === 'over');
  });

  then(/^il tombe et aucun Coup de bélier n'est porté$/u, () => {
    expect(typesOf(world.played.events)).toContain('enemyDefeated');
    expect(windUpsOf(world.played.events)).toEqual([]);
    expect(world.played.battle.enemies[0]!.charge).toBeUndefined();
  });

  // --- Tirage, escorte ---

  given(/^le palier 3$/u, () => {
    world = {} as World;
  });

  then(
    /^un groupe d'ennemis est tiré parmi le Veilleur d'airain, la Gargouille, le Fondeur de cloches, le Novice des cloches, la Sonneuse de matines, le Jaquemart, le Bélier de bronze et le Battant de cloche, dans cet ordre$/u,
    () => {
      expect(TIERS[3].enemies.map(({ kind }) => kind)).toEqual(BELFRY_LIST);
    },
  );

  and(
    /^le Bélier de bronze et le Battant de cloche ont chacun un poids de tirage de 2 et au plus 1 par groupe$/u,
    () => {
      expect(TIERS[3].enemies.slice(-2)).toEqual([
        { kind: 'bronzeRam', weight: 2, cap: 1 },
        { kind: 'bellClapper', weight: 2, cap: 1 },
      ]);
    },
  );

  and(/^l'escorte d'une Élite du Beffroi peut les tirer, au multiplicateur de palier$/u, () => {
    const pool = ESCORT_POOLS[3].map(({ kind }) => kind);
    expect(pool).toEqual(expect.arrayContaining(['bronzeRam', 'bellClapper']));
    const escorted = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      enemies: ['stoneSaint', 'bronzeRam', 'bellClapper'],
      escortMultiplier: BELFRY,
    }).battle;
    expect(escorted.enemies.slice(1)).toEqual([
      expect.objectContaining({ kind: 'bronzeRam', maxHp: 84, maxGuard: 39, escort: true }),
      expect.objectContaining({ kind: 'bellClapper', maxHp: 80, maxGuard: 45, escort: true }),
    ]);
  });

  and(/^ils ne sont tirés dans aucun autre palier$/u, () => {
    for (const tier of [1, 2] as const) {
      const kinds = [...TIERS[tier].enemies, ...ESCORT_POOLS[tier]].map(({ kind }) => kind);
      expect(kinds).not.toContain('bronzeRam');
      expect(kinds).not.toContain('bellClapper');
    }
  });

  given(/^une ascension aux Catacombes ou aux Jardins de cendre$/u, () => {
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
      expect(TIERS[2].enemies.map(({ kind }) => kind)).toEqual([
        'thornPilgrim',
        'ashBramble',
        'ashGleaner',
        'burningHusk',
        'mothkin',
      ]);
      expect(ESCORT_POOLS[2].map(({ kind }) => kind)).toEqual([
        'thornPilgrim',
        'ashBramble',
        'burningHusk',
        'mothkin',
      ]);
      expect(Array.from({ length: WALKED_SEEDS }, (_, index) => walkTierOne(index + 1))).toEqual(
        TIER_ONE_WALKS,
      );
    },
  );
};

// Les règles du domaine seules : `@ui` passe par l'écran, `@session` par la session.
const feature = loadFeature('features/beffroi-balayage-charge.feature');
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
