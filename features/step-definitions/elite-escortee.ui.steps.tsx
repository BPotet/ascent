/**
 * Scénarios `@ui` de « Élite escortée » (#257) : la porte Élite sur l'écran « Choisis ta sortie »
 * (`ExitChoice`), puis le combat d'Élite tel que l'écran le montre (`battleView`) : l'Élite à
 * gauche, cible par défaut, son escorte à droite, et l'ennemi maudit.
 */
import { render, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { ExitChoice } from '../../src/adapters/ui/components/ExitChoice';
import { ENEMY_NAMES } from '../../src/adapters/ui/format/battleText';
import { battleView } from '../../src/adapters/ui/state/battleView';
import {
  chooseExit,
  endFloorBattle,
  startAscent,
  type Ascent,
} from '../../src/domain/ascent/Ascent';
import { drawElite, eliteCandidates } from '../../src/domain/ascent/elites';
import type { Exit } from '../../src/domain/ascent/exits';
import type { FateGauge } from '../../src/domain/ascent/fateGauge';
import { TIER_ONE_WALKS } from '../../src/domain/ascent/testing/tierOneDraws';
import { walkTierOne } from '../../src/domain/ascent/testing/tierOneWalk';
import { TIERS, encounterMultipliers, type Tier } from '../../src/domain/ascent/tiers';
import { startBattle, type Battle } from '../../src/domain/battle/Battle';
import { ENEMIES, type EnemyKind } from '../../src/domain/battle/combatants';
import { cursedValue } from '../../src/domain/battle/curse';
import { nextRandom } from '../../src/domain/battle/SeededRandom';
import { scaleByPercent } from '../../src/domain/battle/tierMultiplier';

const hidden = { includeHiddenElements: true } as const;
const DOORS: readonly Exit[] = [
  { kind: 'combat', groupSize: 3 },
  { kind: 'elite', groupSize: null },
];
const GAUGES: Readonly<Record<string, FateGauge>> = { '−1': -1, '−2': -2 };

const KIND_OF_NAME = Object.fromEntries(
  Object.entries(ENEMY_NAMES).map(([kind, name]) => [name, kind]),
) as Readonly<Record<string, EnemyKind>>;

const won = (ascent: Ascent) =>
  endFloorBattle(ascent, { outcome: 'victory', heroHp: ascent.hero.hp });

interface World {
  gauge: FateGauge;
  tier: Tier;
  door: Ascent;
  entered: Ascent;
  battle: Battle;
}

let world: World;

/** L'ascension au palier du monde, entre deux étages, la porte Élite seule proposée. */
function eliteDoor(seed = 5): Ascent {
  return {
    ...won(startAscent(seed, { gauge: world.gauge })),
    tier: world.tier,
    boonOffer: null,
    exits: [{ kind: 'elite', groupSize: null }],
  };
}

/** Le combat de l'étage, commencé comme la session le commence, en phase du héros. */
function battleOf(ascent: Ascent): Battle {
  const encounter = ascent.encounter!;
  const { battle } = startBattle({
    seed: encounter.battleSeed,
    defenseHint: false,
    at: 0,
    initiative: true,
    enemies: encounter.enemies,
    ...encounterMultipliers(ascent.tier, encounter),
    ...(encounter.cursed !== undefined && { cursed: encounter.cursed }),
  });
  return { ...battle, phase: { kind: 'hero', since: 0, announced: false } };
}

async function showDoors(): Promise<void> {
  await render(
    <ExitChoice
      boons={[]}
      exits={DOORS}
      gauge={world.gauge}
      tier={world.tier}
      onChoose={jest.fn()}
    />,
  );
}

const eliteDoorButton = () => screen.getByTestId('ascent-exit-1', hidden);

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^une ascension sans malédiction$/u, () => {
    world = { gauge: 0, tier: 1 } as World;
  });

  // --- Palier 1 ---

  given(/^le héros au palier 1 devant une porte Élite$/u, () => {
    world.tier = 1;
    world.door = eliteDoor();
  });

  when(/^il entre dans le combat d'Élite$/u, () => {
    world.entered = chooseExit(world.door, 0);
    world.battle = battleOf(world.entered);
  });

  then(/^la porte dit « Élite », sans annonce d'escorte$/u, async () => {
    await showDoors();
    expect(eliteDoorButton().props.accessibilityLabel).toBe(
      'Élite · objet Rare garanti · coffre scellé',
    );
    expect(screen.queryByText(/Escortée/u, hidden)).toBeNull();
  });

  and(/^l'Élite est le seul ennemi du combat$/u, () => {
    expect(world.battle.enemies).toHaveLength(1);
    expect(TIERS[1].elites).toContain(world.battle.enemies[0]!.kind);
    expect(battleView(world.battle)).toMatchObject({ leadLayout: false, columns: 1 });
  });

  and(/^les tirages de l'ascension sont les mêmes qu'avant cette story$/u, () => {
    // L'algorithme d'avant : l'Élite, puis la graine du combat.
    const elite = drawElite(
      eliteCandidates(TIERS[1].elites, world.door.lastElite),
      world.door.random,
    );
    const seed = nextRandom(elite.random);
    expect(world.entered.encounter).toEqual({
      kind: 'elite',
      enemies: [elite.value],
      battleSeed: Math.floor(seed.value * 4_294_967_296),
    });
    expect(world.entered.random).toEqual(seed.state);
    // Les 200 ascensions rejouées du palier 1 : seuls les PV et les dégâts des Élites ont changé.
    TIER_ONE_WALKS.forEach((walk, index) => expect(walkTierOne(index + 1)).toBe(walk));
  });

  // --- Palier 2 ---

  given(/^le héros au palier 2$/u, () => {
    world.tier = 2;
    world.door = eliteDoor();
  });

  when(/^les sorties de l'étage proposent une porte Élite$/u, showDoors);

  then(/^la porte Élite annonce « escortée » et la taille 1, jamais quel ennemi$/u, () => {
    expect(screen.getByText('Escortée · 1 ennemi', hidden)).toBeOnTheScreen();
    const label = eliteDoorButton().props.accessibilityLabel as string;
    expect(label).toBe('Élite. Escortée de 1 ennemi. Objet Rare garanti. Coffre scellé');
    for (const name of Object.values(ENEMY_NAMES)) expect(label).not.toContain(name);
  });

  then(/^l'Élite est à la place de gauche et elle est la cible par défaut$/u, () => {
    expect(TIERS[2].elites).toContain(world.battle.enemies[0]!.kind);
    expect(world.battle.target).toBe(0);
    const [elite] = battleView(world.battle).enemies;
    expect(elite).toMatchObject({ elite: true, target: true });
  });

  and(
    /^1 ennemi d'escorte, tiré parmi (.+), est en première ligne à sa droite$/u,
    (list: string) => {
      const kinds = list
        .split(/, | et /u)
        .map((name) => KIND_OF_NAME[name.replace(/^(le |la |l')/u, '')]!);
      expect(world.battle.enemies).toHaveLength(2);
      expect(world.battle.reserve).toEqual([]);
      expect(kinds).toContain(world.battle.enemies[1]!.kind);
      expect(world.battle.enemies[1]!.escort).toBe(true);
      expect(battleView(world.battle)).toMatchObject({ leadLayout: true, columns: 2 });
    },
  );

  // --- Malédiction ---

  given(/^une ascension à (−\d) de malédiction au palier (\d)$/u, (gauge: string, tier: string) => {
    world.gauge = GAUGES[gauge]!;
    world.tier = Number(tier) as Tier;
    world.door = eliteDoor();
  });

  when(/^le héros arrive aux sorties de l'étage$/u, showDoors);

  then(/^la porte Élite dit aussi « dont 1 maudit »$/u, () => {
    expect(screen.getByText('Escortée · 1 ennemi', hidden)).toBeOnTheScreen();
    expect(screen.getByText('dont 1 maudit', hidden)).toBeOnTheScreen();
    expect(eliteDoorButton().props.accessibilityLabel).toBe(
      'Élite. Escortée de 1 ennemi, dont 1 maudit. Objet Rare garanti. Coffre scellé',
    );
  });

  then(/^l'ennemi d'escorte est maudit et l'Élite ne l'est pas$/u, () => {
    expect(world.battle.enemies[0]).not.toHaveProperty('cursed');
    expect(world.battle.enemies[1]).toMatchObject({ escort: true, cursed: true });
    const [elite, escort] = battleView(world.battle).enemies;
    expect(elite!.curse).toBeUndefined();
    expect(escort!.curse).toMatch(/^Maudite?$/u);
  });

  and(/^une Phalénide d'escorte maudite a 39 PV, garde 18 et un Vol brisé de 6$/u, () => {
    const enemies: readonly EnemyKind[] = ['scarecrow', 'mothkin'];
    const { battle } = startBattle({
      seed: 3,
      defenseHint: false,
      at: 0,
      enemies,
      cursed: 1,
      ...encounterMultipliers(2, { kind: 'elite', enemies }),
    });
    expect(battle.enemies[1]).toMatchObject({ maxHp: 39, maxGuard: 18, cursed: true });
    const flight = ENEMIES.mothkin.moves.find(({ attack }) => attack === 'feint')!;
    expect(cursedValue(scaleByPercent(flight.damage, battle.escortMultiplier!.hpPercent))).toBe(6);
  });

  then(/^la porte Élite dit « Élite maudite »$/u, async () => {
    await showDoors();
    expect(eliteDoorButton().props.accessibilityLabel).toBe(
      'Élite maudite. Escortée de 2 ennemis. Objet Rare garanti. Coffre scellé',
    );
    expect(screen.queryByText('dont 1 maudit', hidden)).toBeNull();
  });

  and(/^dans le combat, l'Élite est maudite et aucun ennemi d'escorte ne l'est$/u, () => {
    const battle = battleOf(chooseExit(world.door, 0));
    expect(battle.enemies[0]).toMatchObject({ cursed: true });
    expect(battle.enemies.slice(1).some((enemy) => enemy.cursed)).toBe(false);
    expect(battleView(battle).enemies[0]).toMatchObject({ elite: true, curse: 'Maudit' });
  });
};

// La porte et le combat à l'écran : `@domain` et `@session` ont leurs propres étapes.
const feature = loadFeature('features/elite-escortee.feature');
const ofUi = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(ofUi),
      scenarioOutlines: feature.scenarioOutlines.filter(ofUi),
    },
  ],
  [steps],
);
