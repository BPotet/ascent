/**
 * « Le carnet de découvertes et son Bestiaire » (#282) à travers une vraie session d'ascension et
 * une vraie session du carnet, sur un Stockage clé-valeur en mémoire : la reprise d'un combat
 * sauvegardé avant la mise à jour, les portes, la victoire, la chute et l'abandon, une découverte
 * jamais perdue (« fermeture forcée » : de nouvelles sessions sur le même stockage), la ligne du
 * carnet, et le jeu inchangé.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ASCENT_KEY, SHARD_TOTAL_KEY } from '../../src/application/useCases/AscentSession';
import type { BattleSession } from '../../src/application/useCases/BattleSession';
import { DISCOVERY_BOOK_KEY } from '../../src/application/useCases/DiscoveryBookSession';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import type { BattleEvent } from '../../src/domain/battle/BattleEvent';
import type { EnemyKind } from '../../src/domain/battle/combatants';
import { withEnemyAt } from '../../src/domain/battle/testing/withEnemyAt';
import { BESTIARY_CATALOG, catalogKinds } from '../../src/domain/discoveryBook/bestiary';
import {
  EMPTY_DISCOVERY_BOOK,
  serializeDiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';
import {
  bookStore,
  openApp,
  playBattle,
  saveBattle,
  settle,
  storedBook,
  storedStates,
  toExits,
  type BookStore,
  type OpenApp,
} from '../support/discoveryBookStory';

interface World {
  store: BookStore;
  app: OpenApp;
  battleSession: BattleSession | null;
  /** Les noms de code entrés dans le dernier combat joué. */
  entered: EnemyKind[];
  runs: { ascents: string[]; others: [string, string][]; events: BattleEvent[] }[];
}

let world: World;

/** L'état de chaque entrée du carnet, tel que la session le tient (lu dans sa vue). */
function heldStates(app: OpenApp): Record<string, string> {
  const view = app.book.current();
  if (view.status !== 'ready') throw new Error(`The book is ${view.status}`);
  return Object.fromEntries(
    view.bestiary.tiers
      .flatMap(({ sections }) => sections)
      .flatMap(({ entries }) => entries)
      .filter(({ state }) => state !== 'unknown')
      .map(({ kind, state }) => [kind, state]),
  );
}

async function open(store: BookStore, seed = 5): Promise<void> {
  world = { store, app: await openApp(store, seed), battleSession: null, entered: [], runs: [] };
}

/** Commence (ou reprend) le combat de l'étage, en notant les ennemis qui y entrent. */
async function startBattle(): Promise<BattleSession> {
  const battleSession = world.app.session.battleSession();
  battleSession.subscribe(({ battle, events }) => {
    battle.enemies.forEach(({ kind }) => {
      if (!world.entered.includes(kind)) world.entered.push(kind);
    });
    events.forEach((event) => {
      if (event.type === 'reinforcementEntered' && !world.entered.includes(event.kind)) {
        world.entered.push(event.kind);
      }
    });
  });
  await battleSession.start();
  world.battleSession = battleSession;
  return battleSession;
}

const ghoulDown = (battle: { readonly enemies: readonly { kind: string; hp: number }[] }) =>
  battle.enemies.some(({ kind, hp }) => kind === 'ghoul' && hp === 0);

/** Une ascension devant le boss `boss` du palier 1, à l'étage 6. */
const beforeBoss = (boss: EnemyKind): Ascent => ({
  ...startAscent(7),
  floor: 6,
  encounter: { kind: 'boss', enemies: [boss], battleSeed: 3 },
});

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^un combat en cours à la mise à jour, une Goule à 0 PV et un Spectre debout en première ligne, un Nécromancien en réserve$/u,
    async () => {
      const store = bookStore();
      saveBattle(store, ['ghoul', 'specter'], (battle) =>
        withEnemyAt({ ...battle, reserve: ['necromancer'] }, 0, { hp: 0 }),
      );
      expect(store.values.has(DISCOVERY_BOOK_KEY)).toBe(false);
      await open(store);
      expect(heldStates(world.app)).toEqual({});
    },
  );

  when(/^le combat reprend$/u, async () => {
    expect(world.app.session.resuming()).toBe(true);
    await startBattle();
  });

  then(
    /^la Goule est vaincue, le Spectre est rencontré et le Nécromancien reste « \?\?\? »$/u,
    () => {
      expect(heldStates(world.app)).toEqual({ ghoul: 'defeated', specter: 'encountered' });
      expect(world.battleSession!.current()!.battle.reserve).toEqual(['necromancer']);
    },
  );

  given(/^une porte Combat ou Élite proposée$/u, async () => {
    await open(bookStore());
    world.app.session.begin({ hero: 'sentinel' });
    await playBattle(await startBattle(), world.app.clock);
    toExits(world.app.session);
    const { exits } = world.app.session.current()!;
    expect(exits.map(({ kind }) => kind)).toContain('combat');
  });

  then(/^aucun ennemi n'est rencontré avant le début de son combat$/u, async () => {
    const before = heldStates(world.app);
    expect(before).toEqual({ madVillager: 'defeated', ghoul: 'defeated' });
    world.app.session.chooseExit(0);
    const next = world.app.session.current()!.encounter!.enemies.slice(0, 3);
    expect(next.some((kind) => before[kind] === undefined)).toBe(true);
    await settle();
    expect(heldStates(world.app)).toEqual(before);
    expect(storedStates(world.store)).toEqual(before);
    await startBattle();
    next.forEach((kind) => expect(heldStates(world.app)[kind]).toBeDefined());
  });

  given(/^un boss en phase 2$/u, () => {
    world = { store: bookStore(), entered: [], runs: [] } as unknown as World;
  });

  when(/^le héros tombe, ou que le joueur abandonne l'ascension$/u, async () => {
    // Le combat du boss, rencontré à son début, sauvegardé en phase 2, le héros à 1 PV.
    const phaseTwo = () => {
      const store = bookStore({
        [DISCOVERY_BOOK_KEY]: serializeDiscoveryBook({
          ...EMPTY_DISCOVERY_BOOK,
          enemies: { ossuaryWarden: { state: 'encountered', isNew: true } },
        }),
      });
      saveBattle(
        store,
        ['ossuaryWarden'],
        (battle) => ({
          ...withEnemyAt(battle, 0, { hp: Math.floor(battle.enemies[0]!.maxHp / 3), phase2: true }),
          hero: { ...battle.hero, hp: 1 },
        }),
        beforeBoss('ossuaryWarden'),
      );
      return store;
    };
    const states: Record<string, string>[] = [];
    // Le héros tombe.
    await open(phaseTwo());
    await playBattle(await startBattle(), world.app.clock);
    expect(world.app.session.current()!.outcome).toBe('fall');
    await settle();
    states.push(storedStates(world.store));
    // Le joueur abandonne l'ascension pendant le combat repris.
    await open(phaseTwo());
    await startBattle();
    world.app.session.pause();
    world.app.session.abandon();
    await settle();
    states.push(storedStates(world.store));
    // Le joueur abandonne l'ascension au pied de la tour, sans reprendre le combat.
    await open(phaseTwo());
    world.app.session.abandon();
    await settle();
    states.push(storedStates(world.store));
    world.runs = states.map((state) => ({
      ascents: [JSON.stringify(state)],
      others: [],
      events: [],
    }));
  });

  then(/^le boss est rencontré, pas vaincu$/u, () => {
    expect(world.runs.map(({ ascents }) => JSON.parse(ascents[0]!))).toEqual([
      { ossuaryWarden: 'encountered' },
      { ossuaryWarden: 'encountered' },
      { ossuaryWarden: 'encountered' },
    ]);
  });

  given(/^un combat ordinaire gagné$/u, async () => {
    await open(bookStore());
    world.app.session.begin({ hero: 'sentinel' });
    expect(world.app.session.current()!.encounter!.kind).toBe('combat');
    await playBattle(await startBattle(), world.app.clock);
    expect(world.app.session.current()!.encounter).toBeNull();
    expect(world.app.session.current()!.outcome).toBeNull();
  });

  then(
    /^chaque ennemi entré dans ce combat est vaincu et aucun n'est seulement rencontré$/u,
    () => {
      const states = storedStates(world.store);
      expect(world.entered.length).toBeGreaterThan(0);
      world.entered.forEach((kind) => expect(states[kind]).toBe('defeated'));
      expect(Object.values(states)).not.toContain('encountered');
    },
  );

  // --- Règles générales ---

  given(/^une Goule vaincue pendant un combat$/u, async () => {
    await open(bookStore(), 3);
    world.app.session.begin({ hero: 'sentinel' });
    await playBattle(await startBattle(), world.app.clock, ghoulDown);
    expect(world.battleSession!.current()!.battle.phase.kind).not.toBe('over');
  });

  when(/^l'app est fermée de force avant la fin du combat, puis rouverte$/u, async () => {
    await open(world.store, 3);
  });

  then(/^la Goule est vaincue$/u, () => {
    expect(heldStates(world.app).ghoul).toBe('defeated');
  });

  and(/^une chute, un abandon ou une mise à jour de l'app ne l'efface pas non plus$/u, async () => {
    // La chute : le combat repris est joué jusqu'à la défaite du héros.
    await playBattle(await startBattle(), world.app.clock);
    expect(world.app.session.current()!.outcome).toBe('fall');
    world.app.session.leave();
    await settle();
    expect(world.store.values.has(ASCENT_KEY)).toBe(false);
    expect(storedStates(world.store).ghoul).toBe('defeated');
    // L'abandon d'une nouvelle ascension.
    world.app.session.begin({ hero: 'sentinel' });
    await startBattle();
    world.app.session.pause();
    world.app.session.abandon();
    await settle();
    expect(storedStates(world.store).ghoul).toBe('defeated');
    // Une mise à jour de l'app : de nouvelles sessions sur le même stockage.
    await open(world.store, 3);
    expect(heldStates(world.app).ghoul).toBe('defeated');
  });

  given(/^une Goule vaincue dans un combat mis en pause$/u, async () => {
    await open(bookStore(), 3);
    world.app.session.begin({ hero: 'sentinel' });
    await playBattle(await startBattle(), world.app.clock, ghoulDown);
    world.app.session.pause();
    await settle();
    expect(storedBook(world.store).enemies.ghoul).toEqual({ state: 'defeated', isNew: true });
  });

  when(/^le combat reprend et que la Goule est relue à 0 PV$/u, async () => {
    await open(world.store, 3);
    await startBattle();
    expect(ghoulDown(world.battleSession!.current()!.battle)).toBe(true);
    world.app.session.pause();
    await settle();
  });

  then(/^la Goule a un seul état et une seule marque « nouveau »$/u, () => {
    const book = storedBook(world.store);
    expect(book.enemies.ghoul).toEqual({ state: 'defeated', isNew: true });
    expect(world.app.book.newEntryCount()).toBe(Object.keys(book.enemies).length);
    expect(world.app.session.newPages()).toEqual([]);
  });

  given(
    /^deux ascensions jouées avec la même graine, l'une avec un carnet vide, l'autre avec un carnet plein$/u,
    async () => {
      const full = serializeDiscoveryBook({
        ...EMPTY_DISCOVERY_BOOK,
        lastTier: 3,
        enemies: Object.fromEntries(
          catalogKinds(BESTIARY_CATALOG).map((kind) => [kind, { state: 'defeated' }]),
        ),
      });
      const runs: World['runs'] = [];
      for (const initial of [{}, { [DISCOVERY_BOOK_KEY]: full }]) {
        const store = bookStore(initial);
        const app = await openApp(store, 1);
        const events: BattleEvent[] = [];
        app.session.begin({ hero: 'sentinel' });
        for (let floor = 0; floor < 2; floor += 1) {
          const battleSession = app.session.battleSession();
          battleSession.subscribe((update) => events.push(...update.events));
          await battleSession.start();
          await playBattle(battleSession, app.clock);
          if (app.session.current()!.outcome !== null) break;
          toExits(app.session);
          app.session.chooseExit(0);
        }
        await settle();
        runs.push({
          ascents: store.writes.filter(([key]) => key === ASCENT_KEY).map(([, value]) => value),
          others: store.writes.filter(([key]) => key !== ASCENT_KEY && key !== DISCOVERY_BOOK_KEY),
          events,
        });
      }
      world = { store: bookStore(), runs } as unknown as World;
    },
  );

  then(/^les tirages, les combats et le butin sont identiques$/u, () => {
    const [empty, full] = world.runs;
    expect(empty!.ascents.length).toBeGreaterThan(3);
    expect(empty!.events.length).toBeGreaterThan(10);
    expect(full!.ascents).toEqual(empty!.ascents);
    expect(full!.events).toEqual(empty!.events);
  });

  and(/^aucune découverte ne rapporte d'Éclat, d'Or, d'Xp ou de déblocage$/u, () => {
    const [empty, full] = world.runs;
    // Ni Total d'Éclats, ni Camp, ni autre clé écrite autrement : l'Or est celui de l'ascension.
    expect(full!.others).toEqual(empty!.others);
    expect(full!.others.map(([key]) => key)).not.toContain(SHARD_TOTAL_KEY);
  });

  given(
    /^un Spectre rencontré dans un combat perdu, puis vaincu dans l'ascension suivante$/u,
    async () => {
      const store = bookStore();
      saveBattle(store, ['specter', 'ghoul'], (battle) => ({
        ...battle,
        hero: { ...battle.hero, hp: 1 },
      }));
      await open(store, 2);
      await playBattle(await startBattle(), world.app.clock);
      expect(world.app.session.current()!.outcome).toBe('fall');
      expect(heldStates(world.app).specter).toBe('encountered');
      world.app.session.leave();
      // L'ascension suivante : le Spectre tombe au premier combat.
      world.app.session.begin({ hero: 'sentinel' });
      await playBattle(await startBattle(), world.app.clock);
      await settle();
      expect(heldStates(world.app).specter).toBe('defeated');
    },
  );

  when(/^le joueur ouvre le carnet$/u, async () => {
    await world.app.book.load();
  });

  then(/^le Spectre porte une seule marque « nouveau » et compte 1 au compteur$/u, () => {
    const view = world.app.book.current();
    if (view.status !== 'ready') throw new Error('The book is not read');
    const entries = view.bestiary.tiers
      .flatMap(({ sections }) => sections)
      .flatMap(({ entries: all }) => all);
    expect(entries.filter(({ kind }) => kind === 'specter')).toEqual([
      expect.objectContaining({ state: 'defeated', isNew: true }),
    ]);
    expect(view.newEntries).toBe(entries.filter(({ isNew }) => isNew).length);
    expect(storedBook(world.store).enemies.specter).toEqual({ state: 'defeated', isNew: true });
  });

  given(/^une Goule déjà vaincue$/u, async () => {
    await open(
      bookStore({
        [DISCOVERY_BOOK_KEY]: serializeDiscoveryBook({
          ...EMPTY_DISCOVERY_BOOK,
          enemies: { ghoul: { state: 'defeated' } },
        }),
      }),
      7,
    );
  });

  when(/^le joueur gagne un combat où seules des Goules tombent$/u, async () => {
    world.app.session.begin({ hero: 'sentinel' });
    expect(world.app.session.current()!.encounter!.enemies).toEqual(['ghoul']);
    await playBattle(await startBattle(), world.app.clock);
    expect(world.app.session.current()!.encounter).toBeNull();
    expect(world.app.session.current()!.outcome).toBeNull();
  });

  then(/^aucune ligne du carnet ne s'affiche$/u, () => {
    expect(world.app.session.newPages()).toEqual([]);
    expect(storedBook(world.store).enemies.ghoul).toEqual({ state: 'defeated' });
  });
};

// Les scénarios `@session` seuls.
const feature = loadFeature('features/carnet-de-decouvertes.feature');
const ofSession = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@session');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofSession),
      scenarioOutlines: feature.scenarioOutlines.filter(ofSession),
    },
  ],
  [steps],
);
