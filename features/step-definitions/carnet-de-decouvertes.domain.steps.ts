/**
 * « Le carnet de découvertes et son Bestiaire » (#282), règles du domaine : les découvertes d'une
 * mise à jour du combat (`battleDiscoveries`), enregistrées dans le carnet (`recordDiscoveries`),
 * puis lues par le Bestiaire et son catalogue (`bestiary`, `BESTIARY_CATALOG`). Chaque mise à jour
 * est celle d'un vrai combat (`startBattle`), retouchée comme le moteur l'aurait faite.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import { ENEMIES, type EnemyKind } from '../../src/domain/battle/combatants';
import { withEnemyAt } from '../../src/domain/battle/testing/withEnemyAt';
import { battleDiscoveries } from '../../src/domain/discoveryBook/battleDiscoveries';
import {
  BESTIARY_CATALOG,
  bestiary,
  bookContents,
  catalogKinds,
  type BestiaryCatalog,
  type BestiaryEntry,
} from '../../src/domain/discoveryBook/bestiary';
import {
  EMPTY_DISCOVERY_BOOK,
  newEntryCount,
  recordDiscoveries,
  type DiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';

interface World {
  book: DiscoveryBook;
  battle: Battle;
  catalog: BestiaryCatalog;
}

let world: World;

const battleOf = (enemies: readonly EnemyKind[], cursed?: number): Battle =>
  startBattle({
    seed: 3,
    defenseHint: false,
    at: 0,
    enemies,
    ...(cursed !== undefined && { cursed }),
  }).battle;

/** Une mise à jour du combat : le carnet enregistre ses découvertes, le combat devient `after`. */
function update(after: Battle, events: readonly BattleEvent[] = []): void {
  world.book = recordDiscoveries(world.book, battleDiscoveries(world.battle, after, events)).book;
  world.battle = after;
}

/** Le début d'un combat devant `enemies` : la première ligne lue, sans combat d'avant. */
function begin(battle: Battle): void {
  world.battle = battle;
  world.book = recordDiscoveries(world.book, battleDiscoveries(null, battle, [])).book;
}

const fall = (index: number) => {
  update(withEnemyAt(world.battle, index, { hp: 0 }), [
    { type: 'enemyDefeated', at: 1, enemy: index },
  ]);
};

const heroFalls = () => {
  update({ ...world.battle, hero: { ...world.battle.hero, hp: 0 } }, [
    { type: 'battleEnded', at: 2, outcome: 'defeat' },
  ]);
};

const stateOf = (kind: EnemyKind) => world.book.enemies[kind]?.state ?? 'unknown';

const entryOf = (kind: EnemyKind, catalog = BESTIARY_CATALOG): BestiaryEntry | undefined =>
  bestiary(world.book, catalog)
    .tiers.flatMap(({ sections }) => sections)
    .flatMap(({ entries }) => entries)
    .find((entry) => entry.kind === kind);

const fresh = (): World => ({
  book: EMPTY_DISCOVERY_BOOK,
  battle: battleOf(['ghoul']),
  catalog: BESTIARY_CATALOG,
});

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Rencontré ---

  given(
    /^un carnet vide et un groupe Goule, Goule, Spectre avec un Nécromancien en réserve$/u,
    () => {
      world = fresh();
      world.battle = battleOf(['ghoul', 'ghoul', 'specter', 'necromancer']);
      expect(world.battle.reserve).toEqual(['necromancer']);
    },
  );

  when(/^le combat commence$/u, () => begin(world.battle));

  then(/^la Goule et le Spectre sont rencontrés, en une seule entrée chacun$/u, () => {
    expect(world.book.enemies).toEqual({
      ghoul: { state: 'encountered', isNew: true },
      specter: { state: 'encountered', isNew: true },
    });
  });

  then(/^le Nécromancien reste « \?\?\? »$/u, () => {
    expect(world.book.enemies.necromancer).toBeUndefined();
    expect(entryOf('necromancer')?.state).toBe('unknown');
  });

  given(/^le combat précédent$/u, () => {
    world = fresh();
    begin(battleOf(['ghoul', 'ghoul', 'specter', 'necromancer']));
  });

  when(/^le héros tombe avant tout Renfort$/u, () => {
    heroFalls();
    expect(world.battle.reserve).toEqual(['necromancer']);
  });

  given(/^un combat en cours$/u, () => {
    world = fresh();
  });

  when(/^un ennemi entre par un Renfort, par une Invocation ou par une Exhumation$/u, () => {
    // Le Renfort du Villageois fou, jusque-là en réserve, à la place de la Goule tombée.
    begin(battleOf(['ghoul', 'specter', 'necromancer', 'madVillager']));
    expect(stateOf('madVillager')).toBe('unknown');
    fall(0);
    update(withEnemyAt(world.battle, 0, { kind: 'madVillager', hp: 20 }), [
      { type: 'reinforcementEntered', at: 2, enemy: 0, kind: 'madVillager' },
    ]);
    // L'Exhumation : le Fossoyeur pose un Squelette à la place de la Goule tombée.
    begin(battleOf(['gravedigger', 'ghoul']));
    expect(stateOf('skeleton')).toBe('unknown');
    fall(1);
    update(withEnemyAt(world.battle, 1, { kind: 'skeleton', hp: 20, exhumed: true }), [
      { type: 'enemyExhumed', at: 3, enemy: 0, slot: 1, kind: 'skeleton' },
    ]);
    // L'Invocation : une Phalénide de la Reine entre à la place de la Goule tombée.
    begin(battleOf(['mothQueen', 'ghoul']));
    expect(stateOf('mothkin')).toBe('unknown');
    fall(1);
    update(withEnemyAt(world.battle, 1, { kind: 'mothkin', hp: 20, summoned: true }), [
      { type: 'summonEntered', at: 4, enemy: 1, kind: 'mothkin' },
    ]);
  });

  then(/^il est rencontré$/u, () => {
    expect([stateOf('madVillager'), stateOf('mothkin'), stateOf('skeleton')]).toEqual([
      'encountered',
      'encountered',
      'encountered',
    ]);
  });

  and(
    /^un Squelette exhumé par le Fossoyeur compte au palier 1, une Phalénide invoquée au palier 2$/u,
    () => {
      expect(entryOf('skeleton')).toMatchObject({ tier: 1, state: 'encountered' });
      expect(entryOf('mothkin')).toMatchObject({ tier: 2, state: 'encountered' });
    },
  );

  given(/^la Reine des phalènes en phase 2, son Invocation annoncée$/u, () => {
    world = fresh();
    const queen = battleOf(['mothQueen']);
    begin(queen);
    update(
      {
        ...withEnemyAt(queen, 0, { phase2: true }),
        summon: { summoner: 0, kind: 'mothkin', slots: [1, 2] },
      },
      [
        { type: 'bossPhaseShifted', at: 1, enemy: 0 },
        { type: 'summonCalled', at: 1, enemy: 0, kind: 'mothkin', slots: [1, 2] },
      ],
    );
  });

  when(/^la Reine tombe avant l'entrée des Phalénides$/u, () => {
    const { summon: _, ...withoutSummon } = world.battle;
    update(withEnemyAt(withoutSummon, 0, { hp: 0 }), [
      { type: 'enemyDefeated', at: 2, enemy: 0 },
      { type: 'battleEnded', at: 2, outcome: 'victory' },
    ]);
  });

  then(/^la Reine est vaincue et la Phalénide ne change pas d'état$/u, () => {
    expect(stateOf('mothQueen')).toBe('defeated');
    expect(stateOf('mothkin')).toBe('unknown');
  });

  // --- Vaincu ---

  given(/^un combat avec deux Goules et un Spectre$/u, () => {
    world = fresh();
    begin(battleOf(['ghoul', 'ghoul', 'specter']));
  });

  when(/^une Goule tombe, puis le héros tombe$/u, () => {
    fall(0);
    heroFalls();
  });

  then(/^la Goule est vaincue et le Spectre est rencontré$/u, () => {
    expect(stateOf('ghoul')).toBe('defeated');
    expect(stateOf('specter')).toBe('encountered');
  });

  given(/^un Squelette en première ligne$/u, () => {
    world = fresh();
    begin(battleOf(['skeleton', 'ghoul']));
  });

  when(/^il tombe et se relève seul$/u, () => {
    update(withEnemyAt(world.battle, 0, { hp: 6, selfRevives: 1 }), [
      { type: 'enemySelfRevived', at: 1, enemy: 0, hp: 6 },
    ]);
  });

  then(/^il est rencontré, pas vaincu$/u, () => {
    expect(stateOf('skeleton')).toBe('encountered');
  });

  when(/^il retombe pour de bon$/u, () => fall(0));

  then(/^il est vaincu$/u, () => {
    expect(stateOf('skeleton')).toBe('defeated');
  });

  given(/^une Goule tombée puis relevée par le Nécromancien$/u, () => {
    world = fresh();
    begin(battleOf(['ghoul', 'necromancer']));
    fall(0);
    update(withEnemyAt(world.battle, 0, { hp: 12, raised: true }), [
      { type: 'allyRaised', at: 2, enemy: 1, ally: 0, hp: 12 },
    ]);
  });

  when(/^le héros tombe$/u, () => heroFalls());

  then(/^la Goule est vaincue$/u, () => {
    expect(world.battle.enemies[0]).toMatchObject({ hp: 12, raised: true });
    expect(stateOf('ghoul')).toBe('defeated');
  });

  given(/^deux Phalénides invoquées, entrées en première ligne$/u, () => {
    world = fresh();
    const queen = battleOf(['mothQueen', 'mothkin', 'mothkin']);
    begin({
      ...queen,
      enemies: queen.enemies.map((enemy, index) =>
        index === 0 ? enemy : { ...enemy, summoned: true as const },
      ),
    });
  });

  when(/^la Reine des phalènes tombe et qu'elles tombent avec elle$/u, () => {
    const after = world.battle.enemies.reduce(
      (battle, _, index) => withEnemyAt(battle, index, { hp: 0 }),
      world.battle,
    );
    update(after, [
      { type: 'enemyDefeated', at: 1, enemy: 0 },
      { type: 'summonedFell', at: 1, enemy: 1 },
      { type: 'summonedFell', at: 1, enemy: 2 },
    ]);
  });

  then(/^la Reine et la Phalénide sont vaincues$/u, () => {
    expect(stateOf('mothQueen')).toBe('defeated');
    expect(stateOf('mothkin')).toBe('defeated');
  });

  given(/^une Élite escortée au palier 2, l'Épouvantail et un Embrasé$/u, () => {
    world = fresh();
    const escorted = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      enemies: ['scarecrow', 'burningHusk'],
      escortMultiplier: { hpPercent: 135, guardPercent: 125 },
    }).battle;
    expect(escorted.enemies[1]?.escort).toBe(true);
    begin(escorted);
  });

  when(/^l'Épouvantail tombe pour de bon, puis le héros tombe$/u, () => {
    fall(0);
    heroFalls();
  });

  then(/^l'Épouvantail est vaincu et l'Embrasé est rencontré$/u, () => {
    expect(stateOf('scarecrow')).toBe('defeated');
    expect(stateOf('burningHusk')).toBe('encountered');
  });

  given(/^un Embrasé maudit$/u, () => {
    world = fresh();
    begin(battleOf(['burningHusk'], 0));
    expect(world.battle.enemies[0]?.cursed).toBe(true);
  });

  when(/^il tombe pour de bon$/u, () => fall(0));

  then(/^l'entrée de l'Embrasé est vaincue, sans entrée « maudit » à part$/u, () => {
    expect(world.book.enemies).toEqual({ burningHusk: { state: 'defeated', isNew: true } });
  });

  // --- Règles générales ---

  given(/^une Goule vaincue$/u, () => {
    world = fresh();
    world.book = { ...EMPTY_DISCOVERY_BOOK, enemies: { ghoul: { state: 'defeated' } } };
  });

  when(/^une Goule est rencontrée dans un autre combat, puis le héros tombe$/u, () => {
    begin(battleOf(['ghoul', 'specter']));
    heroFalls();
  });

  then(/^la Goule reste vaincue, sans marque « nouveau »$/u, () => {
    expect(world.book.enemies.ghoul).toEqual({ state: 'defeated' });
  });

  // --- Bestiaire et compteurs ---

  given(/^(\d+) ennemis du palier 1 vaincus et (\d+) rencontrés, sur 12 entrées$/u, (n, m) => {
    world = fresh();
    const tierOne = catalogKinds({ ...BESTIARY_CATALOG, 2: EMPTY_TIER, 3: EMPTY_TIER });
    expect(tierOne).toHaveLength(12);
    const defeated = tierOne.slice(0, Number(n));
    const met = tierOne.slice(Number(n), Number(n) + Number(m));
    world.book = {
      ...EMPTY_DISCOVERY_BOOK,
      enemies: {
        ...Object.fromEntries(defeated.map((kind) => [kind, { state: 'defeated' }])),
        ...Object.fromEntries(met.map((kind) => [kind, { state: 'encountered' }])),
        // Une page remplie d'un autre palier, pour le total.
        burningHusk: { state: 'defeated' },
      },
    };
  });

  then(/^le palier 1 compte (\d+) pages remplies$/u, (n) => {
    expect(bestiary(world.book).tiers[0]).toMatchObject({ filled: Number(n), total: 12 });
  });

  and(/^les (\d+) rencontrés ne comptent pas dans le compte$/u, (m) => {
    const tierOne = bestiary(world.book).tiers[0]!;
    expect(tierOne.encountered).toBe(Number(m));
    expect(tierOne.sections.reduce((sum, { filled }) => sum + filled, 0)).toBe(tierOne.filled);
  });

  and(/^le total du Bestiaire compte les ennemis vaincus de tous les paliers$/u, () => {
    const view = bestiary(world.book);
    expect(view.filled).toBe(10);
    expect(view.tiers.map(({ filled }) => filled)).toEqual([9, 1, 0]);
  });

  given(/^la version installée, avec les 6 ennemis de #246$/u, () => {
    world = fresh();
    for (const kind of [
      'candleBearer',
      'cryptRat',
      'emberPod',
      'thievingMoth',
      'bronzeRam',
      'bellClapper',
    ] as const) {
      expect(catalogKinds(BESTIARY_CATALOG)).toContain(kind);
    }
  });

  then(/^le Bestiaire compte 37 entrées : 12 au palier 1, 12 au palier 2, 13 au palier 3$/u, () => {
    const view = bestiary(EMPTY_DISCOVERY_BOOK);
    expect(view.total).toBe(37);
    expect(view.tiers.map(({ total }) => total)).toEqual([12, 12, 13]);
  });

  and(/^chaque ennemi du jeu y est une seule fois : 22 ennemis, 9 Élites, 6 boss$/u, () => {
    const kinds = catalogKinds(BESTIARY_CATALOG);
    expect([...kinds].sort()).toEqual(Object.keys(ENEMIES).sort());
    const sections = bestiary(EMPTY_DISCOVERY_BOOK).tiers.flatMap(({ sections: all }) => all);
    const total = (category: string) =>
      sections
        .filter((section) => section.category === category)
        .reduce((sum, section) => sum + section.total, 0);
    expect([total('enemy'), total('elite'), total('boss')]).toEqual([22, 9, 6]);
  });

  given(/^un catalogue du Bestiaire fictif dont le palier 2 compte 10 entrées$/u, () => {
    world = fresh();
    const tierTwo = BESTIARY_CATALOG[2];
    world.catalog = {
      ...BESTIARY_CATALOG,
      2: {
        ...tierTwo,
        enemies: tierTwo.enemies.filter((kind) => kind !== 'emberPod' && kind !== 'thievingMoth'),
      },
    };
    expect(bestiary(EMPTY_DISCOVERY_BOOK, world.catalog).tiers[1]?.total).toBe(10);
  });

  and(/^un carnet dont les 10 entrées du palier 2 sont vaincues$/u, () => {
    const tierTwo = catalogKinds({ ...world.catalog, 1: EMPTY_TIER, 3: EMPTY_TIER });
    world.book = {
      ...EMPTY_DISCOVERY_BOOK,
      enemies: Object.fromEntries(tierTwo.map((kind) => [kind, { state: 'defeated' }])),
    };
    expect(bestiary(world.book, world.catalog).tiers[1]).toMatchObject({
      filled: 10,
      complete: true,
    });
  });

  when(/^une mise à jour ajoute deux ennemis au palier 2 de ce catalogue$/u, () => {
    world.catalog = BESTIARY_CATALOG;
  });

  then(/^ils sont « \?\?\? », sans marque « nouveau »$/u, () => {
    for (const kind of ['emberPod', 'thievingMoth'] as const) {
      expect(entryOf(kind, world.catalog)).toMatchObject({ state: 'unknown', isNew: false });
    }
    expect(newEntryCount(world.book, bookContents(world.catalog))).toBe(0);
  });

  and(/^le palier 2 n'est plus complet : 10\/12$/u, () => {
    expect(bestiary(world.book, world.catalog).tiers[1]).toMatchObject({
      filled: 10,
      total: 12,
      complete: false,
    });
  });

  given(/^un ennemi vaincu qui est retiré du jeu par une mise à jour$/u, () => {
    world = fresh();
    world.book = {
      ...EMPTY_DISCOVERY_BOOK,
      enemies: { cryptRat: { state: 'defeated', isNew: true } },
    };
    world.catalog = {
      ...BESTIARY_CATALOG,
      1: {
        ...BESTIARY_CATALOG[1],
        enemies: BESTIARY_CATALOG[1].enemies.filter((kind) => kind !== 'cryptRat'),
      },
    };
  });

  then(/^son entrée n'est plus montrée ni comptée$/u, () => {
    const view = bestiary(world.book, world.catalog);
    expect(entryOf('cryptRat', world.catalog)).toBeUndefined();
    expect(view.filled).toBe(0);
    expect(view.tiers[0]?.total).toBe(11);
    expect(newEntryCount(world.book, bookContents(world.catalog))).toBe(0);
    expect(world.book.enemies.cryptRat).toEqual({ state: 'defeated', isNew: true });
  });

  and(/^s'il revient dans le jeu, il est de nouveau vaincu$/u, () => {
    expect(entryOf('cryptRat')).toMatchObject({ state: 'defeated' });
    expect(bestiary(world.book).filled).toBe(1);
  });
};

const EMPTY_TIER = { enemies: [], elites: [], bosses: [] };

// Les scénarios `@domain` seuls.
const feature = loadFeature('features/carnet-de-decouvertes.feature');
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
