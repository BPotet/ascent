/**
 * Les règles du domaine de « Coffre scellé, clés et Fortune » (#226), sans écran : les clés de la
 * faveur et de Fortune, l'offre à 6 familles, le contenu du coffre scellé et ses tirages à part,
 * la fin de l'ascension. Les noms des familles et des objets sont ceux de l'interface.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { blessingCard, itemName } from '../../src/adapters/ui/format/ascentText';
import {
  abandonAscent,
  chooseBlessing,
  chooseBoon,
  chooseExit,
  endFloorBattle,
  equipItem,
  leaveItem,
  leaveSealedChest,
  openSealedChest,
  startAscent,
  type Ascent,
  type Encounter,
} from '../../src/domain/ascent/Ascent';
import {
  BLESSING_FAMILIES,
  blessingModifiers,
  drawBlessingOffer,
  vigorPercent,
  type BlessingFamily,
} from '../../src/domain/ascent/blessings';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';
import {
  EPIC_ITEM_CHANCE,
  ITEMS,
  STARTING_EQUIPMENT,
  drawItem,
  drawSealedChestItem,
  dropChance,
  type ItemKind,
} from '../../src/domain/ascent/items';
import type { Rarity } from '../../src/domain/ascent/rarity';
import { shardAwards } from '../../src/domain/ascent/shards';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import { unlockedItems } from '../../src/domain/ascent/unlocks';
import { nextRandom, seedRandom, type RandomState } from '../../src/domain/battle/SeededRandom';

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

const ELITE: Encounter = { kind: 'elite', enemies: ['twins'], battleSeed: 1 };
const SEEDS = [3, 9, 21, 40, 77];
const RARITY_OF: Readonly<Record<string, Rarity>> = {
  Commune: 'common',
  Rare: 'rare',
  Épique: 'epic',
};

/** Le nom de la famille, tel que l'interface l'écrit. */
const familyName = (family: BlessingFamily) => blessingCard({ family, rarity: 'common' }).name;

/** L'ascension lancée à la jauge `gauge`, une bénédiction `rarity` à choisir, Fortune offerte. */
const offeringFortune = (gauge: FateGauge, rarity: Rarity): Ascent => ({
  ...startAscent(5, { gauge, blessings: [rarity] }),
  blessingOffer: ['fortune', 'vigor', 'edge'],
});

/** L'ascension devant une Élite à l'étage 3, avec `keys` clés. */
const atElite = (seed: number, keys = 1): Ascent => ({
  ...startAscent(seed, { gauge: 1 }),
  floor: 3,
  encounter: ELITE,
  keys,
});

/** Un état du flux dont le prochain tirage, × 100, est dans [`from`, `to`). */
function statesWith(from: number, to: number, count = 60): RandomState[] {
  const states: RandomState[] = [];
  for (let state = 0; states.length < count; state += 1) {
    const percent = nextRandom(state).value * 100;
    if (percent >= from && percent < to) states.push(state);
  }
  return states;
}

/** Les tirages des étages qui suivent : la 1re carte et la 1re porte prises, jusqu'au boss. */
function walk(first: Ascent): unknown[] {
  const draws: unknown[] = [];
  let ascent = chooseExit(chooseBoon(first, 0), 0);
  while (ascent.floor < 6 && ascent.outcome === null) {
    if (ascent.encounter !== null) ascent = leaveSealedChest(leaveItem(won(ascent)));
    draws.push([ascent.exits, ascent.gold, ascent.foundItem, ascent.boonOffer]);
    ascent = chooseExit(ascent.boonOffer === null ? ascent : chooseBoon(ascent, 0), 0);
    draws.push(ascent.encounter);
  }
  return draws;
}

interface World {
  gauge: FateGauge;
  ascent: Ascent;
  chosen: Ascent;
  offers: readonly BlessingFamily[][];
  epics: readonly ItemKind[];
  rares: readonly ItemKind[];
  wornAndElite: readonly ItemKind[];
  twins: readonly [Ascent, Ascent];
  revealed: readonly ItemKind[];
  ended: readonly Ascent[];
}

let world: World;

beforeEach(() => {
  world = {} as World;
});

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Les clés de la faveur (K1) et de Fortune (K2) ---

  given(/^une jauge de ([+−-]?\d)$/u, (value: string) => {
    world.gauge = Number(value.replace('−', '-').replace('+', '')) as FateGauge;
  });

  when(/^le joueur commence une ascension sans bénédiction Fortune$/u, () => {
    world.ascent = startAscent(9, { gauge: world.gauge });
  });

  then(/^le héros a (\d) clés?(?: \(1 de la faveur \+ 3 de Fortune\))?$/u, (count: string) => {
    expect((world.chosen ?? world.ascent).keys).toBe(Number(count));
  });

  and(/^avec une jauge de \+2, il a 1 clé$/u, () => {
    expect(startAscent(9, { gauge: 2 }).keys).toBe(1);
  });

  and(/^avec une jauge de 0, −1 ou −2, il n'a aucune clé$/u, () => {
    for (const gauge of [0, -1, -2] as const) expect(startAscent(9, { gauge }).keys).toBe(0);
  });

  given(/^le joueur a fait une habitude hier$/u, () => {
    world.ascent = startAscent(9, { blessings: ['common'] });
  });

  when(/^il choisit sa bénédiction de départ$/u, () => {
    world.offers = Array.from(
      { length: 200 },
      (_, seed) => drawBlessingOffer([], seedRandom(seed)).value,
    );
    expect(world.ascent.blessingOffer).toHaveLength(3);
  });

  then(
    /^les 3 familles proposées sont distinctes, tirées parmi (.+), (.+), (.+), (.+), (.+) et (.+)$/u,
    (...names: string[]) => {
      expect(BLESSING_FAMILIES.map(familyName)).toEqual(names);
      for (const offer of world.offers) expect(new Set(offer).size).toBe(3);
      expect(new Set(world.offers.flat())).toEqual(new Set(BLESSING_FAMILIES));
    },
  );

  and(/^Bourse n'est jamais proposée$/u, () => {
    expect(world.offers.flat().map(familyName)).not.toContain('Bourse');
    expect(BLESSING_FAMILIES as readonly string[]).not.toContain('purse');
  });

  when(
    /^le joueur choisit une bénédiction Fortune (Commune|Rare|Épique)(?: au début de l'ascension)?$/u,
    (rarity: string) => {
      world.ascent = offeringFortune(world.gauge, RARITY_OF[rarity]!);
      world.chosen = chooseBlessing(world.ascent, 0);
    },
  );

  and(/^une Fortune Commune en aurait ajouté 1, une Fortune Rare 2$/u, () => {
    const base = world.ascent.keys;
    expect(chooseBlessing(offeringFortune(world.gauge, 'common'), 0).keys).toBe(base + 1);
    expect(chooseBlessing(offeringFortune(world.gauge, 'rare'), 0).keys).toBe(base + 2);
  });

  and(
    /^la chance d'objet, la rareté des objets, les Éclats, les déblocages et le camp ne changent pas$/u,
    () => {
      const { ascent, chosen } = world;
      const fortune = chosen.blessings;
      expect(blessingModifiers(fortune, { firstBattle: true })).toEqual(
        blessingModifiers([], { firstBattle: true }),
      );
      expect(vigorPercent(fortune)).toBe(0);
      expect(chosen.hero.maxHp).toBe(ascent.hero.maxHp);
      // La chance d'objet et la rareté ne lisent que la jauge, pas les bénédictions.
      expect(dropChance(3, chosen.gauge)).toBe(dropChance(3, ascent.gauge));
      expect(chosen.unlocks).toEqual(ascent.unlocks);
      expect(chosen.shardAwards).toEqual(ascent.shardAwards);
      expect(shardAwards(chosen.seed, 1, 6, 'boss')).toEqual(
        shardAwards(ascent.seed, 1, 6, 'boss'),
      );
      expect(chosen.lootRandom).toBe(ascent.lootRandom);
    },
  );

  // --- Le contenu du coffre scellé (CH6, CH7) ---

  given(/^un objet Épique débloqué que le héros ne porte pas$/u, () => {
    world.ascent = { ...startAscent(5, { unlocks: ['flamberge'] }) };
    expect(ITEMS.flamberge.rarity).toBe('epic');
  });

  when(/^un coffre scellé est ouvert et que son tirage de rareté est sous 20 %$/u, () => {
    const draw = (random: RandomState) =>
      drawSealedChestItem(STARTING_EQUIPMENT, 'hammer', random, ['flamberge']).value;
    world.epics = statesWith(0, EPIC_ITEM_CHANCE).map(draw);
    world.rares = statesWith(EPIC_ITEM_CHANCE, 100).map(draw);
  });

  then(/^il contient un objet Épique$/u, () => {
    expect(new Set(world.epics.map((item) => ITEMS[item].rarity))).toEqual(new Set(['epic']));
  });

  and(/^sinon, il contient un objet Rare$/u, () => {
    expect(new Set(world.rares.map((item) => ITEMS[item].rarity))).toEqual(new Set(['rare']));
  });

  and(/^une jauge de \+2 ou de −2 ne change jamais ces 20 %$/u, () => {
    // La jauge n'entre pas dans le tirage du coffre : elle est celle de l'Élite, sans décalage.
    for (const random of statesWith(0, 100)) {
      expect(drawItem(2, true, STARTING_EQUIPMENT, random, ['flamberge'], ['hammer'])).toEqual(
        drawItem(-2, true, STARTING_EQUIPMENT, random, ['flamberge'], ['hammer']),
      );
    }
  });

  given(/^le héros porte, ou vient de recevoir de cette Élite, tous les objets Rares$/u, () => {
    world.wornAndElite = (Object.keys(ITEMS) as ItemKind[]).filter(
      (item) => ITEMS[item].rarity === 'rare',
    );
  });

  and(/^aucun objet Épique n'est libre$/u, () => {
    world.ascent = startAscent(5);
    expect(unlockedItems(world.ascent.unlocks)).not.toContain('flamberge');
  });

  when(/^le coffre scellé est ouvert$/u, () => {
    // Inatteignable en jeu aujourd'hui : testé sur le tirage, avec la liste des exclus (décision
    // de l'orchestrateur du 06/11/2026).
    world.revealed = statesWith(0, 100).map(
      (random) =>
        drawItem(0, true, STARTING_EQUIPMENT, random, ['watchBell'], world.wornAndElite).value,
    );
  });

  then(/^il contient un objet Commun$/u, () => {
    expect(new Set(world.revealed.map((item) => ITEMS[item].rarity))).toEqual(new Set(['common']));
  });

  given(/^l'Élite vient de donner le (.+)$/u, (name: string) => {
    world.ascent = { ...atElite(5), equipment: { ...STARTING_EQUIPMENT, armor: 'watchmanShield' } };
    expect(itemName('hammer')).toBe(name);
  });

  when(/^le coffre scellé de cette Élite est ouvert$/u, () => {
    const ended = {
      ...leaveItem(won(world.ascent)),
      sealedChest: { eliteItem: 'hammer' as const, opened: false },
    };
    world.revealed = statesWith(0, 100).map(
      (random) => openSealedChest({ ...ended, sealedChestRandom: random }).foundItem!,
    );
  });

  then(/^il ne contient ni le Marteau, ni un objet que le héros porte$/u, () => {
    expect(world.revealed).not.toContain('hammer');
    expect(world.revealed).not.toContain('watchmanShield');
    expect(new Set(world.revealed).size).toBeGreaterThan(1);
  });

  // --- Jamais ailleurs qu'après une Élite (CH2) ---

  when(/^le héros gagne un combat ordinaire, bat le boss ou passe au Feu de camp$/u, () => {
    const at = (kind: 'combat' | 'boss'): Ascent => ({
      ...atElite(5),
      encounter: {
        kind,
        enemies: kind === 'boss' ? ['ossuaryWarden'] : ['ghoul', 'ghoul', 'ghoul'],
        battleSeed: 1,
      },
    });
    const campfire: Ascent = {
      ...atElite(5),
      encounter: null,
      exits: [{ kind: 'campfire', groupSize: null }],
    };
    world.ended = [won(at('combat')), won(at('boss')), chooseExit(campfire, 0)];
  });

  then(/^aucun coffre scellé n'apparaît$/u, () => {
    for (const ascent of world.ended) expect(ascent.sealedChest).toBeNull();
  });

  // --- Les tirages (CH9) ---

  given(
    /^deux ascensions de même graine, aux mêmes choix, sauf au coffre scellé d'une Élite$/u,
    () => {
      world.ended = SEEDS.map((seed) => leaveItem(won(atElite(seed))));
    },
  );

  when(/^le joueur l'ouvre dans l'une et le laisse dans l'autre$/u, () => {
    world.twins = [leaveItem(openSealedChest(world.ended[0]!)), leaveSealedChest(world.ended[0]!)];
  });

  then(
    /^les portes, l'Or, les objets trouvés et les offres de bienfaits qui suivent sont les mêmes$/u,
    () => {
      for (const ascent of world.ended) {
        const opened = leaveItem(openSealedChest(ascent));
        expect(opened.keys).toBe(ascent.keys - 1);
        expect(walk(opened)).toEqual(walk(leaveSealedChest(ascent)));
      }
      expect(walk(world.twins[0])).toEqual(walk(world.twins[1]));
    },
  );

  given(/^deux ascensions de même graine, aux mêmes choix$/u, () => {
    world.twins = [leaveItem(won(atElite(21))), leaveItem(won(atElite(21)))];
  });

  when(/^le joueur ouvre le même coffre scellé dans chacune$/u, () => {
    world.revealed = world.twins.map((ascent) => openSealedChest(ascent).foundItem!);
  });

  then(/^il contient le même objet$/u, () => {
    expect(world.revealed[0]).toBe(world.revealed[1]);
  });

  given(/^une jauge de 0, sans bénédiction de départ$/u, () => {
    world.ascent = startAscent(1);
    expect(world.ascent.keys).toBe(0);
    expect(world.ascent.blessingOffer).toBeNull();
  });

  when(/^le joueur gravit la tour avec une graine donnée$/u, () => {
    world.revealed = [];
  });

  then(
    /^les portes, l'Or, les objets trouvés et les offres de bienfaits sont ceux de la v0\.4\.0 pour cette graine$/u,
    () => {
      for (let seed = 1; seed <= 20; seed += 1)
        expect(walkTierOne(seed)).toBe(TIER_ONE_WALKS[seed - 1]);
    },
  );

  // --- La fin de l'ascension (K4) ---

  given(/^le héros a encore 3 clés$/u, () => {
    world.ascent = { ...startAscent(5, { gauge: 2 }), keys: 3 };
  });

  when(/^l'ascension se termine, par une chute, un abandon ou le Sommet$/u, () => {
    world.ended = [
      endFloorBattle(world.ascent, { outcome: 'defeat', heroHp: 0 }),
      abandonAscent(world.ascent),
      { ...world.ascent, outcome: 'victory' },
    ];
  });

  then(
    /^la prochaine ascension n'en reçoit que selon sa propre jauge et sa bénédiction Fortune$/u,
    () => {
      for (const ended of world.ended) expect(ended.outcome).not.toBeNull();
      expect(startAscent(6, { gauge: -1 }).keys).toBe(0);
      expect(startAscent(6, { gauge: 1 }).keys).toBe(1);
      expect(chooseBlessing(offeringFortune(0, 'epic'), 0).keys).toBe(3);
      // L'équipement porté n'en donne pas non plus.
      expect(equipItem(startAscent(6)).keys).toBe(0);
    },
  );
};

// Les règles du domaine seules : `@session` et `@ui` passent par la session et les écrans.
const feature = loadFeature('features/coffre-scelle-cles-fortune.feature');
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
