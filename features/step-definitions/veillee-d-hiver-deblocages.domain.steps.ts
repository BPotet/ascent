/**
 * Les règles du domaine de « Veillée d'hiver et contenus à débloquer dans la tour » (#195), sans
 * écran : les bienfaits de base, l'effet de Veillée d'hiver, le palier 1 inchangé, les objets
 * débloqués dans le butin et le tirage de Cœur de braise après une Élite. « Le tirage est sous
 * 20 % » : un état du flux du butin (`lootRandom`) qui donne ce tirage.
 */
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { BOON_NAMES } from '../../src/adapters/ui/format/boonText';
import {
  endFloorBattle,
  startAscent,
  type Ascent,
  type AscentLaunch,
} from '../../src/domain/ascent/Ascent';
import {
  BASE_BOON_KINDS,
  boonModifiers,
  boonWeights,
  drawBoonOffer,
  type BoonKind,
} from '../../src/domain/ascent/boons';
import { ITEMS, drawLoot, itemModifiers, type ItemKind } from '../../src/domain/ascent/items';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import { startBattle } from '../../src/domain/battle/Battle';
import { MAX_DAMAGE_REDUCTION_PERCENT } from '../../src/domain/battle/combatants';
import { NO_MODIFIERS, combineModifiers } from '../../src/domain/battle/heroModifiers';
import { nextRandom, type RandomState } from '../../src/domain/battle/SeededRandom';

const VICTORY = { outcome: 'victory', heroHp: 40 } as const;
const STATES = 300;

interface World {
  launch: AscentLaunch;
  boons: readonly BoonKind[];
  equipment: Ascent['equipment'];
  emberHeartOffered: boolean;
  /** Les ascensions avant la fin du combat, et après. */
  before: readonly Ascent[];
  after: readonly Ascent[];
  momentum: { readonly with: number; readonly without: number };
  walks: readonly string[];
}

let world: World;

/** L'ascension devant un combat `kind` de l'étage 3, le flux du butin à `lootRandom`. */
function at(kind: 'combat' | 'elite', lootRandom: RandomState, gauge: -2 | 0 | 2 = 0): Ascent {
  const ascent = startAscent(3, { ...world.launch, gauge });
  return {
    ...ascent,
    floor: 3,
    hero: { ...ascent.hero, boons: world.boons },
    equipment: world.equipment,
    emberHeartOffered: world.emberHeartOffered,
    lootRandom,
    encounter: {
      kind,
      enemies: kind === 'elite' ? ['twins'] : ['ghoul', 'ghoul', 'ghoul'],
      battleSeed: 1,
    },
  };
}

/** Les `count` premiers états du flux pour lesquels `test` est vrai. */
function statesWhere(test: (state: RandomState) => boolean, count = STATES): RandomState[] {
  const found: RandomState[] = [];
  for (let state = 0; found.length < count; state += 1) if (test(state)) found.push(state);
  return found;
}
const rarityPercent = (state: RandomState) => nextRandom(state).value * 100;

/** Le tirage de Cœur de braise, × 100, après le butin et l'offre d'aujourd'hui. */
function emberHeartPercent(ascent: Ascent): number {
  const loot = drawLoot(ascent.encounter!, ascent.gauge, ascent.equipment, ascent.lootRandom);
  return nextRandom(drawBoonOffer(ascent.hero.boons, loot.random).random).value * 100;
}
/** Le flux du butin après le butin et l'offre d'aujourd'hui : sans tirage de Cœur de braise. */
function todayStream(ascent: Ascent): RandomState {
  const loot = drawLoot(ascent.encounter!, ascent.gauge, ascent.equipment, ascent.lootRandom);
  return drawBoonOffer(ascent.hero.boons, loot.random).random;
}

function fight(before: readonly Ascent[]): void {
  world.before = before;
  world.after = before.map((ascent) => endFloorBattle(ascent, VICTORY));
}
const found = () => world.after.map((ascent) => ascent.foundItem);

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^les bienfaits de base : Écho parfait, Braise brisante, Peau de givre, Lame juste, Braise ardente, Givre persistant et Veillée d'hiver$/u,
    () => {
      expect(BASE_BOON_KINDS.map((kind) => BOON_NAMES[kind])).toEqual([
        'Écho parfait',
        'Braise brisante',
        'Peau de givre',
        'Lame juste',
        'Braise ardente',
        'Givre persistant',
        "Veillée d'hiver",
      ]);
      world = {
        launch: {},
        boons: [],
        equipment: startAscent(3).equipment,
        emberHeartOffered: false,
      } as unknown as World;
    },
  );

  // --- Veillée d'hiver ---

  given(/^une ascension sans aucun Déblocage$/u, () => {
    expect(startAscent(3).unlocks).toEqual([]);
  });

  when(/^le héros gagne un combat ordinaire et que l'offre de bienfaits s'affiche$/u, () => {
    fight(statesWhere(() => true).map((state) => at('combat', state)));
  });

  then(
    /^l'offre est tirée parmi les 7 bienfaits de base, au poids de leur rareté \(Commun 6, Rare 3, Épique 1\)$/u,
    () => {
      expect(boonWeights([])).toEqual([
        ['perfectEcho', 6],
        ['shatteringEmber', 6],
        ['frostSkin', 6],
        ['trueEdge', 3],
        ['blazingEmber', 3],
        ['lingeringFrost', 3],
        ['winterVigil', 1],
      ]);
      world.before.forEach((ascent, index) => {
        const loot = drawLoot(ascent.encounter!, 0, ascent.equipment, ascent.lootRandom);
        expect(world.after[index]!.boonOffer).toEqual(drawBoonOffer([], loot.random).value);
      });
    },
  );

  and(/^elle ne contient jamais Cœur de braise$/u, () => {
    world.after.forEach((ascent) => expect(ascent.boonOffer).not.toContain('emberHeart'));
  });

  given(/^un héros qui a choisi Veillée d'hiver$/u, () => {
    world.boons = ['winterVigil'];
  });

  when(/^un combat commence$/u, () => {
    const momentum = (boons: readonly BoonKind[]) =>
      startBattle({
        seed: 7,
        defenseHint: false,
        at: 0,
        enemies: ['ghoul'],
        modifiers: boonModifiers(boons),
      }).battle.hero.momentum;
    world.momentum = { with: momentum(world.boons), without: momentum([]) };
  });

  then(/^le héros a 1 Élan de plus au départ$/u, () => {
    expect(world.momentum.with).toBe(world.momentum.without + 1);
  });

  and(/^sa réduction des dégâts gagne 10 points, toujours plafonnée à 40 %$/u, () => {
    expect(boonModifiers(world.boons)).toEqual({
      ...NO_MODIFIERS,
      damageReductionPoints: 10,
      startingMomentum: 1,
    });
    // Avec Peau de givre et l'Armure de chevalier déchu : 40 points, le plafond du combat.
    const armor = itemModifiers({ ...world.equipment, armor: 'blackKnightArmor' });
    const build = combineModifiers(armor, boonModifiers([...world.boons, 'frostSkin']));
    expect(build.damageReductionPoints).toBe(40);
    expect(MAX_DAMAGE_REDUCTION_PERCENT).toBe(40);
  });

  given(/^une ascension sans aucun Déblocage, avec une graine donnée$/u, () => {
    expect(startAscent(1).unlocks).toEqual([]);
  });

  when(/^le héros gravit le palier 1$/u, () => {
    world.walks = TIER_ONE_WALKS.map((_, index) => walkTierOne(index + 1));
  });

  then(
    /^les groupes, les Élites, les boss, l'Or, le butin, les intentions et les offres de bienfaits sont ceux d'aujourd'hui$/u,
    () => {
      expect(world.walks).toEqual(TIER_ONE_WALKS);
    },
  );

  and(
    /^la seule différence est Veillée d'hiver à la place de Cœur de braise dans les offres$/u,
    () => {
      // Le tirage figé n'a changé que par le renommage `emberHeart` → `winterVigil` (#195).
      expect(world.walks.join(' ')).not.toContain('emberHeart');
      expect(world.walks.join(' ')).toContain('winterVigil');
    },
  );

  // --- Objets débloqués ---

  given(/^une ascension avec le Déblocage Épieu de chasse$/u, () => {
    world.launch = { unlocks: ['huntingSpear'] };
    world.equipment = { ...world.equipment, weapon: 'axe' };
  });

  when(/^un combat ordinaire donne un objet Commun$/u, () => {
    fight(statesWhere(() => true, 3_000).map((state) => at('combat', state, -2)));
    world.after = world.after.filter(
      (ascent) => ascent.foundItem !== null && ITEMS[ascent.foundItem].rarity === 'common',
    );
  });

  then(
    /^il est tiré à égalité parmi les objets Communs et l'Épieu de chasse, jamais un objet déjà porté$/u,
    () => {
      const items = found() as ItemKind[];
      expect(new Set(items)).toEqual(new Set(['leather', 'chainmail', 'huntingSpear']));
      for (const item of ['leather', 'chainmail', 'huntingSpear']) {
        const share = items.filter((one) => one === item).length / items.length;
        expect(share).toBeCloseTo(1 / 3, 1);
      }
    },
  );

  given(/^une ascension avec le Déblocage Flamberge(?:, que le héros ne porte pas)?$/u, () => {
    world.launch = { unlocks: ['flamberge'] };
  });

  given(/^un héros qui porte la Flamberge$/u, () => {
    world.launch = { unlocks: ['flamberge'] };
    world.equipment = { ...world.equipment, weapon: 'flamberge' };
  });

  when(
    /^(?:le héros|il) bat une Élite et que le tirage de rareté est (sous 20 %|à 20 % ou plus)$/u,
    (draw: string) => {
      const under = draw === 'sous 20 %';
      const states = statesWhere((state) => rarityPercent(state) < 20 === under);
      fight(states.map((state) => at('elite', state)));
    },
  );

  then(/^l'objet trouvé est la Flamberge, Épique$/u, () => {
    expect(new Set(found())).toEqual(new Set(['flamberge']));
    expect(ITEMS.flamberge.rarity).toBe('epic');
  });

  then(/^l'objet trouvé est un objet Rare, (?:comme aujourd'hui|jamais la Flamberge)$/u, () => {
    world.after.forEach((ascent, index) => {
      expect(ITEMS[ascent.foundItem!].rarity).toBe('rare');
      const before = world.before[index]!;
      const today = drawLoot(before.encounter!, 0, before.equipment, before.lootRandom);
      expect(ascent.foundItem).toBe(today.value);
    });
  });

  when(/^le héros gagne un combat ordinaire, quelle que soit la jauge$/u, () => {
    const states = statesWhere((state) => rarityPercent(state) < 20);
    fight(
      ([-2, 0, 2] as const).flatMap((gauge) => [
        ...states.map((state) => at('combat', state, gauge)),
        ...statesWhere(() => true).map((state) => at('combat', state, gauge)),
      ]),
    );
  });

  then(/^l'objet trouvé n'est jamais la Flamberge$/u, () => {
    expect(found()).not.toContain('flamberge');
    expect(found().some((item) => item !== null)).toBe(true);
  });

  // --- Cœur de braise ---

  given(
    /^une ascension avec le Déblocage Cœur de braise, jamais proposé dans cette ascension$/u,
    () => {
      world.launch = { unlocks: ['emberHeart'] };
    },
  );

  given(
    /^une ascension avec le Déblocage Cœur de braise et un héros qui possède 6 des 7 bienfaits de base$/u,
    () => {
      world.launch = { unlocks: ['emberHeart'] };
      world.boons = BASE_BOON_KINDS.slice(0, 6);
    },
  );

  when(/^le héros bat une Élite et que le tirage de Cœur de braise est sous 10 %$/u, () => {
    const states = statesWhere((state) => emberHeartPercent(at('elite', state)) < 10, 50);
    fight(states.map((state) => at('elite', state)));
  });

  then(/^Cœur de braise remplace le 3e bienfait de l'offre$/u, () => {
    world.before.forEach((before, index) => {
      const today = endFloorBattle({ ...before, unlocks: [] }, VICTORY).boonOffer!;
      const after = world.after[index]!;
      expect(after.boonOffer).toEqual([...today.slice(0, 2), 'emberHeart']);
      expect(after.emberHeartOffered).toBe(true);
    });
  });

  then(/^l'offre propose le bienfait de base restant et Cœur de braise$/u, () => {
    world.after.forEach((ascent) =>
      expect(ascent.boonOffer).toEqual(['winterVigil', 'emberHeart']),
    );
  });

  given(
    /^Cœur de braise a déjà été proposé dans cette ascension et le joueur ne l'a pas pris$/u,
    () => {
      world.launch = { unlocks: ['emberHeart'] };
      world.emberHeartOffered = true;
    },
  );

  when(/^le héros bat une autre Élite$/u, () => {
    // Des états où son tirage serait sous 10 % : il n'est pourtant pas fait.
    fight(
      statesWhere((state) => emberHeartPercent(at('elite', state)) < 10, 50).map((state) =>
        at('elite', state),
      ),
    );
  });

  then(
    /^aucun tirage de Cœur de braise n'est fait et l'offre ne le contient (?:pas|jamais)$/u,
    () => {
      world.after.forEach((ascent, index) => {
        expect(ascent.boonOffer).not.toContain('emberHeart');
        expect(ascent.lootRandom).toBe(todayStream(world.before[index]!));
      });
    },
  );

  given(/^une ascension sans le Déblocage Cœur de braise$/u, () => {
    world.launch = { unlocks: ['huntingSpear', 'watchBell', 'flamberge'] };
  });

  when(/^le héros bat une Élite ou gagne un combat ordinaire$/u, () => {
    const under = (kind: 'combat' | 'elite') =>
      statesWhere((state) => emberHeartPercent(at(kind, state)) < 10, 50).map((state) =>
        at(kind, state),
      );
    // Sans Déblocage de Cœur de braise ; puis avec, mais après un combat ordinaire.
    const withHeart = (ascent: Ascent): Ascent => ({ ...ascent, unlocks: ['emberHeart'] });
    fight([...under('elite'), ...under('combat'), ...under('combat').map(withHeart)]);
  });
};

// Les règles du domaine seules : `@session` passe par la session, `@ui` par l'écran.
const feature = loadFeature('features/veillee-d-hiver-deblocages.feature');
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
