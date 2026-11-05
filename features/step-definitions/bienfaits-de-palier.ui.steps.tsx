/**
 * « Bienfaits de palier et carte Second souffle » (#212) jusqu'à l'écran : l'offre tirée par le
 * domaine après un combat gagné, montrée dans le vrai panneau du choix d'un bienfait
 * (`BoonChoicePanel`) ; le choix du joueur passe par ce panneau, puis par `chooseBoon`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { BoonChoicePanel } from '../../src/adapters/ui/battle/BoonChoicePanel';
import {
  chooseBoon,
  endFloorBattle,
  startAscent,
  type Ascent,
  type AscentLaunch,
} from '../../src/domain/ascent/Ascent';
import { boonPool, drawBoonOffer, type BoonKind } from '../../src/domain/ascent/boons';
import { drawLoot } from '../../src/domain/ascent/items';
import type { Tier } from '../../src/domain/ascent/tiers';
import { unlockedItems } from '../../src/domain/ascent/unlocks';
import { nextRandom, type RandomState } from '../../src/domain/battle/SeededRandom';

interface World {
  before: Ascent;
  ascent: Ascent;
}

let world: World;

/** L'ascension devant un combat `kind` du palier `tier`, le héros avec `boons`. */
function at(
  tier: Tier,
  boons: readonly BoonKind[],
  kind: 'combat' | 'elite' = 'combat',
  launch: AscentLaunch = {},
): Ascent {
  const ascent = startAscent(7, launch);
  return {
    ...ascent,
    tier,
    floor: 3,
    hero: { ...ascent.hero, boons },
    encounter: {
      kind,
      enemies: kind === 'elite' ? ['twins'] : ['ghoul', 'ghoul'],
      battleSeed: 1,
    },
  };
}

/** Le tirage de Cœur de braise, × 100, après le butin et l'offre de bienfaits. */
function emberHeartPercent(ascent: Ascent): number {
  const loot = drawLoot(
    ascent.encounter!,
    ascent.gauge,
    ascent.equipment,
    ascent.lootRandom,
    unlockedItems(ascent.unlocks),
  );
  return nextRandom(drawBoonOffer(ascent.hero.boons, loot.random, ascent.tier).random).value * 100;
}

/** Le premier état du flux du butin pour lequel Cœur de braise entre dans l'offre. */
function heartState(ascent: Ascent): RandomState {
  for (let state = 0; ; state += 1) {
    if (emberHeartPercent({ ...ascent, lootRandom: state }) < 10) return state;
  }
}

/** Le combat gagné, puis l'offre dans le panneau, le choix du joueur passant par `chooseBoon`. */
async function win(): Promise<void> {
  world.ascent = endFloorBattle(world.before, { outcome: 'victory', heroHp: world.before.hero.hp });
  const { hero, boonOffer } = world.ascent;
  await render(
    <BoonChoicePanel
      offer={boonOffer!}
      heroHp={hero.hp}
      heroMaxHp={hero.maxHp}
      onChoose={(index) => {
        world.ascent = chooseBoon(world.ascent, index);
      }}
    />,
  );
}

const radios = () => screen.getAllByRole('radio').map((card) => card.props.accessibilityLabel);

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^il ne reste qu'un bienfait non possédé au palier$/u, () => {
    world = {
      before: at(
        2,
        boonPool(2).filter((kind) => kind !== 'hoarfrost'),
      ),
    } as World;
  });

  when(/^le héros gagne un combat ordinaire$/u, win);

  then(/^l'offre montre ce bienfait et la carte « Second souffle »$/u, () => {
    expect(world.ascent.boonOffer).toEqual(['hoarfrost', 'secondBreath']);
    expect(radios()).toEqual([
      'Gelée blanche, Givre, Rare, palier 2. Chaque impact paré parfaitement te rend 2 PV.',
      // La Sentinelle a gagné à PV pleins : la carte le dit.
      "Second souffle : rend 0 PV, tes PV sont déjà pleins, 80 sur 80. Ce n'est pas un bienfait.",
    ]);
    expect(screen.getByRole('header', { name: 'Choisis un bienfait' })).toBeOnTheScreen();
  });

  given(/^le héros possède tous les bienfaits de son palier$/u, () => {
    world = { before: at(3, boonPool(3)) } as World;
  });

  and(/^Cœur de braise n'entre pas dans l'offre$/u, () => {
    expect(world.before.unlocks).not.toContain('emberHeart');
  });

  then(/^l'offre montre la carte « Second souffle » seule$/u, () => {
    expect(world.ascent.boonOffer).toEqual(['secondBreath']);
    expect(screen.getByRole('header', { name: 'Reprends ton souffle' })).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /^Second souffle :/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Prendre' })).toBeEnabled();
  });

  given(/^il ne reste aucun bienfait à tirer$/u, () => {
    world = { before: at(2, boonPool(2), 'elite', { unlocks: ['emberHeart'] }) } as World;
  });

  and(/^Cœur de braise entre dans l'offre après une Élite$/u, async () => {
    world.before = { ...world.before, lootRandom: heartState(world.before) };
    await win();
  });

  then(/^l'offre montre Cœur de braise et la carte « Second souffle »$/u, () => {
    expect(world.ascent.boonOffer).toEqual(['emberHeart', 'secondBreath']);
    expect(radios()).toEqual([
      expect.stringMatching(/^Cœur de braise, Braise, Épique\. /),
      expect.stringMatching(/^Second souffle :/),
    ]);
    expect(
      screen.getByText("Un seul des deux. Un bienfait dure jusqu'à la fin de l'ascension."),
    ).toBeOnTheScreen();
  });

  given(/^le héros a 40 PV sur 88$/u, async () => {
    const ascent = at(
      2,
      boonPool(2).filter((kind) => kind !== 'hoarfrost'),
    );
    world = { before: { ...ascent, hero: { ...ascent.hero, hp: 40, maxHp: 88 } } } as World;
    await win();
  });

  when(/^le joueur choisit « Second souffle »$/u, async () => {
    await fireEvent.press(screen.getByRole('radio', { name: /^Second souffle :/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre' }));
    expect(
      screen.getByLabelText('PV rendus : Second souffle, 8 PV. PV 48 sur 88.'),
    ).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    });
  });

  then(/^le héros a 48 PV$/u, () => {
    expect(world.ascent.hero.hp).toBe(48);
    expect(world.ascent.boonOffer).toBeNull();
  });

  and(/^il ne possède aucun bienfait de plus$/u, () => {
    expect(world.ascent.hero.boons).toEqual(world.before.hero.boons);
  });
};

// Les scénarios de l'écran : `@domain` éprouve les règles seules.
const feature = loadFeature('features/bienfaits-de-palier.feature');
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
