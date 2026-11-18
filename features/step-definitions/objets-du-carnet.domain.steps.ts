/**
 * « Les Objets du carnet » (#284), règles du domaine : l'objet découvert par une transition de
 * l'ascension (`foundItemDiscovery`), enregistré dans le carnet (`recordItemDiscoveries`), comme le
 * fait la session d'ascension à chaque transition. Chaque transition est celle d'`Ascent.ts`.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import {
  chooseExit,
  endFloorBattle,
  startAscent,
  type Ascent,
  type Encounter,
} from '../../src/domain/ascent/Ascent';
import { bookItems } from '../../src/domain/discoveryBook/bookItems';
import {
  EMPTY_DISCOVERY_BOOK,
  recordItemDiscoveries,
  type DiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';
import { foundItemDiscovery } from '../../src/domain/discoveryBook/itemDiscoveries';

interface World {
  book: DiscoveryBook;
  /** Les transitions jouées, chacune avec l'ascension d'avant et d'après. */
  played: { before: Ascent; after: Ascent }[];
}

let world: World;

/** Une transition de l'ascension : le carnet enregistre l'objet qu'elle découvre, s'il y en a un. */
function play(before: Ascent, after: Ascent): Ascent {
  const item = foundItemDiscovery(before, after);
  if (item !== null) world.book = recordItemDiscoveries(world.book, [item]).book;
  world.played.push({ before, after });
  return after;
}

const won = (ascent: Ascent) =>
  play(ascent, endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp }));

/** L'ascension à l'étage `floor`, devant le combat `encounter`. */
const at = (encounter: Encounter | null, floor = 3): Ascent => ({
  ...startAscent(7, { gauge: 1 }),
  floor,
  encounter,
});

const BOSS: Encounter = { kind: 'boss', enemies: ['ossuaryWarden'], battleSeed: 1 };

const discovered = () => bookItems(world.book).discovered;

const steps: StepDefinitions = ({ given, then }) => {
  given(/^une victoire sur un boss, ou un Feu de camp$/u, () => {
    world = { book: EMPTY_DISCOVERY_BOOK, played: [] };
    const boss = won(at(BOSS, 6));
    expect(boss.foundItem).toBeNull();
    const campfire = {
      ...at(null),
      exits: [{ kind: 'campfire', groupSize: null }],
    } as Ascent;
    const rested = play(campfire, chooseExit(campfire, 0));
    expect(rested.floor).toBe(4);
    expect(rested.hero.hp).toBeGreaterThanOrEqual(campfire.hero.hp);
  });

  given(/^une porte Élite qui annonce un objet Rare garanti$/u, () => {
    world = { book: EMPTY_DISCOVERY_BOOK, played: [] };
    const door = { ...at(null), exits: [{ kind: 'elite', groupSize: null }] } as Ascent;
    const entered = play(door, chooseExit(door, 0));
    expect(entered.encounter?.kind).toBe('elite');
    expect(entered.foundItem).toBeNull();
  });

  then(/^aucun objet n'est découvert$/u, () => {
    expect(world.played.length).toBeGreaterThan(0);
    expect(world.book).toBe(EMPTY_DISCOVERY_BOOK);
    expect(discovered()).toBe(0);
  });

  then(/^aucun objet n'est découvert avant qu'il soit montré$/u, () => {
    expect(world.book).toBe(EMPTY_DISCOVERY_BOOK);
    // L'Élite gagnée montre son objet garanti : c'est alors seulement qu'il est découvert.
    const { after: entered } = world.played.at(-1)!;
    const ended = won(entered);
    expect(ended.foundItem).not.toBeNull();
    expect(world.book.items).toEqual({
      [ended.foundItem!]: { state: 'discovered', isNew: true },
    });
  });
};

// Les scénarios `@domain` seuls.
const feature = loadFeature('features/objets-du-carnet.feature');
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
