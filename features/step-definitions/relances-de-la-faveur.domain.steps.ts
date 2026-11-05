/**
 * Les règles du domaine de « Relances de la faveur » (#42), sans écran : le nombre de relances,
 * la nouvelle offre et son complément, Cœur de braise, la graine et la fin de l'ascension. Les noms
 * des bienfaits sont ceux de l'interface (`BOON_NAMES`).
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { BOON_NAMES } from '../../src/adapters/ui/format/boonText';
import {
  abandonAscent,
  canReroll,
  chooseBoon,
  endFloorBattle,
  rerollBoonOffer,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import {
  BOON_KINDS,
  boonPool,
  drawBoonOffer,
  type BoonKind,
  type OfferCard,
} from '../../src/domain/ascent/boons';
import { favorRerolls, type FateGauge } from '../../src/domain/ascent/fateGauge';
import { drawLoot } from '../../src/domain/ascent/items';
import { nextRandom, seedRandom, type RandomState } from '../../src/domain/battle/SeededRandom';

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

/** Le bienfait de ce nom. */
const kindNamed = (name: string): BoonKind => BOON_KINDS.find((kind) => BOON_NAMES[kind] === name)!;

/** L'ascension en faveur pleine après son premier combat, son offre en attente. */
const offered = (seed = 9) => won(startAscent(seed, { gauge: 2 }));

/** Les bienfaits du palier que le héros ne possède pas et que l'offre n'affiche pas. */
const others = (ascent: Ascent) =>
  boonPool(ascent.tier).filter(
    (kind) => !ascent.hero.boons.includes(kind) && !ascent.boonOffer!.includes(kind),
  );

const ELITE = { kind: 'elite', enemies: ['twins'], battleSeed: 1 } as const;

/** L'ascension devant une Élite, Cœur de braise débloqué, le flux du butin à `lootRandom`. */
function atElite(lootRandom: RandomState): Ascent {
  const ascent = startAscent(3, { gauge: 2, unlocks: ['emberHeart'] });
  return {
    ...ascent,
    floor: 3,
    lootRandom,
    encounter: ELITE,
  };
}

/** Le tirage de Cœur de braise, × 100, après le butin et l'offre de l'Élite. */
function heartPercent(ascent: Ascent): number {
  const loot = drawLoot(ascent.encounter!, ascent.gauge, ascent.equipment, ascent.lootRandom);
  return nextRandom(drawBoonOffer(ascent.hero.boons, loot.random, 1).random).value * 100;
}

/** Les `count` premiers états du flux du butin dont le tirage de Cœur de braise passe `test`. */
function elites(test: (percent: number) => boolean, count: number): Ascent[] {
  const found: Ascent[] = [];
  for (let state = 0; found.length < count; state += 1) {
    if (test(heartPercent(atElite(state)))) found.push(atElite(state));
  }
  return found;
}

interface World {
  gauge: FateGauge;
  base: Ascent;
  ascent: Ascent;
  rerolled: Ascent;
  twins: readonly [Ascent, Ascent];
  ended: readonly Ascent[];
  elites: readonly Ascent[];
}

let world: World;

beforeEach(() => {
  world = {} as World;
});

const steps: StepDefinitions = ({ given, when, then, and }) => {
  // --- Le nombre ---

  given(/^une jauge de \+2$/u, () => {
    world.gauge = 2;
  });

  when(/^le joueur commence une ascension$/u, () => {
    world.ascent = startAscent(9, { gauge: world.gauge });
  });

  then(/^le héros a 2 relances pour cette ascension$/u, () => {
    expect(world.ascent.rerolls).toBe(2);
  });

  and(/^avec une jauge de \+1, il en a 1$/u, () => {
    expect(startAscent(9, { gauge: 1 }).rerolls).toBe(1);
  });

  and(/^avec une jauge de 0, −1 ou −2, il n'en a aucune$/u, () => {
    for (const gauge of [0, -1, -2] as const) expect(startAscent(9, { gauge }).rerolls).toBe(0);
  });

  // --- La relance ---

  given(/^le héros a 2 relances et vient de gagner un combat$/u, () => {
    world.ascent = offered();
    expect(world.ascent.rerolls).toBe(2);
  });

  given(/^l'offre propose (.+), (.+) et (.+)$/u, (...names: string[]) => {
    const base = world.ascent ?? offered();
    world.ascent = { ...base, boonOffer: names.map(kindNamed) };
  });

  and(/^il reste au moins (\d) autres bienfaits que le héros ne possède pas$/u, (count: string) => {
    expect(others(world.ascent).length).toBeGreaterThanOrEqual(Number(count));
  });

  and(
    /^il ne reste que 2 autres bienfaits que le héros ne possède pas, (.+) et (.+)$/u,
    (first: string, second: string) => {
      const left = [kindNamed(first), kindNamed(second)];
      const boons = boonPool(1).filter(
        (kind) => !left.includes(kind) && !world.ascent.boonOffer!.includes(kind),
      );
      world.ascent = { ...world.ascent, hero: { ...world.ascent.hero, boons } };
      expect(others(world.ascent)).toEqual(left);
    },
  );

  when(/^le joueur touche « Relancer »$/u, () => {
    expect(canReroll(world.ascent)).toBe(true);
    world.rerolled = rerollBoonOffer(world.ascent);
  });

  then(/^une nouvelle offre de 3 bienfaits est tirée, selon les règles de l'offre$/u, () => {
    const { ascent } = world;
    const replaced = ascent.boonOffer as readonly BoonKind[];
    expect(world.rerolled.boonOffer).toEqual(
      drawBoonOffer([...ascent.hero.boons, ...replaced], ascent.rerollRandom, ascent.tier).value,
    );
    expect(new Set(world.rerolled.boonOffer).size).toBe(3);
  });

  and(/^elle ne propose ni (.+), ni (.+), ni (.+)$/u, (...names: string[]) => {
    for (const name of names) expect(world.rerolled.boonOffer).not.toContain(kindNamed(name));
  });

  and(/^il reste 1 relance au héros$/u, () => {
    expect(world.rerolled.rerolls).toBe(1);
  });

  then(
    /^la nouvelle offre propose (.+), (.+) et un bienfait tiré parmi ceux de l'offre relancée$/u,
    (first: string, second: string) => {
      const replaced = world.ascent.boonOffer!;
      expect(world.rerolled.boonOffer!.slice(0, 2)).toEqual([kindNamed(first), kindNamed(second)]);
      expect(replaced).toContain(world.rerolled.boonOffer![2]);
      // Tiré : sur d'autres graines, chacun des bienfaits relancés peut compléter l'offre.
      const completions = new Set(
        Array.from(
          { length: 60 },
          (_, seed) =>
            rerollBoonOffer({ ...world.ascent, rerollRandom: seedRandom(seed) }).boonOffer![2],
        ),
      );
      expect(completions).toEqual(new Set(replaced));
    },
  );

  // --- Cœur de braise ---

  given(
    /^Cœur de braise est débloqué, jamais proposé, et son tirage des 10 % n'est pas sorti après une Élite$/u,
    () => {
      world.elites = elites((percent) => percent >= 10, 20).map(won);
      for (const ascent of world.elites) {
        expect(ascent.boonOffer).not.toContain('emberHeart');
        expect(ascent.emberHeartOffered).toBe(false);
      }
    },
  );

  when(/^le joueur relance l'offre de cette Élite$/u, () => {
    world.elites = world.elites.map(rerollBoonOffer);
  });

  then(/^Cœur de braise n'entre pas dans la nouvelle offre$/u, () => {
    for (const ascent of world.elites) {
      expect(ascent.rerolls).toBe(1);
      expect(ascent.boonOffer).not.toContain('emberHeart');
    }
  });

  given(/^le héros a des relances et Cœur de braise est sorti après une Élite$/u, () => {
    world.ascent = won(elites((percent) => percent < 10, 1)[0]!);
    expect(world.ascent.rerolls).toBeGreaterThan(0);
    expect(world.ascent.boonOffer![2]).toBe('emberHeart');
  });

  then(/^Cœur de braise reste à sa place dans la nouvelle offre$/u, () => {
    expect(world.rerolled.boonOffer![2]).toBe('emberHeart');
  });

  and(/^les 2 autres cartes sont 2 nouveaux bienfaits, ni (.+) ni (.+)$/u, (...names: string[]) => {
    const cards = world.rerolled.boonOffer!.slice(0, 2) as readonly OfferCard[];
    expect(new Set(cards).size).toBe(2);
    for (const card of cards) {
      expect(boonPool(1)).toContain(card);
      expect(names.map(kindNamed)).not.toContain(card);
    }
  });

  and(/^Cœur de braise ne sera plus tiré pour le reste de l'ascension$/u, () => {
    expect(world.rerolled.emberHeartOffered).toBe(true);
    // Une autre Élite plus haut, même au tirage qui le donnait : plus de Cœur de braise.
    const later = {
      ...chooseBoon(world.rerolled, 0),
      encounter: ELITE,
      lootRandom: elites((percent) => percent < 10, 1)[0]!.lootRandom,
    };
    expect(won(later).boonOffer).not.toContain('emberHeart');
  });

  // --- La graine ---

  given(/^deux ascensions de même graine, aux mêmes choix$/u, () => {
    world.twins = [offered(21), offered(21)];
  });

  when(/^le joueur relance la même offre dans chacune$/u, () => {
    world.twins = [rerollBoonOffer(world.twins[0]), rerollBoonOffer(world.twins[1])];
  });

  then(/^la nouvelle offre est la même$/u, () => {
    expect(world.twins[0].boonOffer).toEqual(world.twins[1].boonOffer);
    expect(world.twins[0].rerollRandom).toEqual(world.twins[1].rerollRandom);
  });

  // --- Quand « Relancer » n'est pas proposé ---

  given(/^le héros n'a plus de relance$/u, () => {
    world.base = { ...startAscent(9, { gauge: 2 }), rerolls: 0 };
  });

  given(/^le héros a des relances$/u, () => {
    world.base = startAscent(9, { gauge: 2 });
  });

  and(/^chaque bienfait qu'il ne possède pas est déjà dans l'offre affichée$/u, () => {
    world.base = { ...world.base, hero: { ...world.base.hero, boons: boonPool(1).slice(0, 4) } };
  });

  when(/^une offre de bienfaits s'affiche$/u, () => {
    world.ascent = won(world.base);
    expect(world.ascent.boonOffer).toHaveLength(3);
  });

  then(/^« Relancer » n'est pas proposé$/u, () => {
    expect(canReroll(world.ascent)).toBe(false);
  });

  and(/^le joueur choisit un bienfait comme avant$/u, () => {
    const card = world.ascent.boonOffer![1]!;
    expect(chooseBoon(world.ascent, 1).hero.boons).toEqual([card]);
  });

  then(/^« Relancer » n'est pas proposé, et le héros garde ses relances$/u, () => {
    expect(others(world.ascent)).toEqual([]);
    expect(canReroll(world.ascent)).toBe(false);
    expect(rerollBoonOffer(world.ascent)).toBe(world.ascent);
    expect(world.ascent.rerolls).toBe(2);
  });

  // --- La fin ---

  given(/^le héros a encore 2 relances$/u, () => {
    world.ascent = offered();
    expect(world.ascent.rerolls).toBe(2);
  });

  when(/^l'ascension se termine, par une chute, un abandon ou le Sommet$/u, () => {
    const ascent = chooseBoon(world.ascent, 0);
    world.ended = [
      endFloorBattle({ ...ascent, encounter: ELITE }, { outcome: 'defeat', heroHp: 0 }),
      abandonAscent(ascent),
      { ...ascent, outcome: 'victory' },
    ];
    for (const ended of world.ended) expect(ended.outcome).not.toBeNull();
  });

  then(/^la prochaine ascension n'en reçoit que selon sa propre jauge$/u, () => {
    for (const gauge of [2, 1, 0, -1, -2] as const) {
      expect(startAscent(10, { gauge }).rerolls).toBe(favorRerolls(gauge));
    }
  });
};

// Les règles du domaine seules : `@session` et `@ui` passent par la session et les écrans.
const feature = loadFeature('features/relances-de-la-faveur.feature');
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
