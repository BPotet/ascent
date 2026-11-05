/**
 * « Veillée d'hiver et contenus à débloquer dans la tour » (#195) jusqu'à l'écran : une ascension
 * sauvegardée avant la mise à jour avec Cœur de braise, reprise par une vraie session sur un
 * Stockage clé-valeur en mémoire, puis son Équipement dans la feuille (`LoadoutSheet`).
 */
import { render, screen, within } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { LoadoutSheet } from '../../src/adapters/ui/components/LoadoutSheet';
import { artPalette } from '../../src/adapters/ui/pixelArt/artPalette';
import { wellOf } from '../../src/adapters/ui/testing/iconWell';
import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import { BASE_BOON_KINDS, boonModifiers } from '../../src/domain/ascent/boons';
import { loadoutOf } from '../../src/domain/ascent/loadout';
import { storySession, storyStore, type StoryStore } from '../support/tiersStory';

interface World {
  store: StoryStore;
  resumed: Ascent | null;
}

let world: World;

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(
    /^les bienfaits de base : Écho parfait, Braise brisante, Peau de givre, Lame juste, Braise ardente, Givre persistant et Veillée d'hiver$/u,
    () => {
      expect(BASE_BOON_KINDS).not.toContain('emberHeart');
      world = { store: storyStore(), resumed: null };
    },
  );

  given(
    /^une ascension sauvegardée avant la mise à jour, dont le héros possède Écho parfait et Cœur de braise$/u,
    () => {
      const ascent = startAscent(3);
      const { unlocks: _unlocks, emberHeartOffered: _offered, ...old } = ascent;
      world.store.values.set(
        ASCENT_KEY,
        JSON.stringify({
          version: 1,
          ascent: { ...old, hero: { ...old.hero, boons: ['perfectEcho', 'emberHeart'] } },
          battle: null,
        }),
      );
    },
  );

  when(/^le joueur la reprend après la mise à jour$/u, async () => {
    world.resumed = await storySession(world.store).session.load();
  });

  then(/^l'Équipement montre toujours Écho parfait et Cœur de braise$/u, async () => {
    await render(
      <LoadoutSheet
        loadout={loadoutOf(world.resumed!)}
        combat={false}
        visible
        onClose={jest.fn()}
      />,
    );
    const rows = screen.getAllByTestId('loadout-row');
    expect(rows.map((row) => wellOf(row).sprite)).toEqual([
      'boon-icon:perfectEcho',
      'boon-icon:emberHeart',
    ]);
    expect(within(rows[1]!).getByText('Cœur de braise')).toBeOnTheScreen();
    expect(wellOf(rows[1]!).style.borderColor).toBe(artPalette.roles.rarityEpic);
  });

  and(/^chaque garde brisée donne toujours \+1 Élan et rend 5 PV$/u, () => {
    expect(boonModifiers(world.resumed!.hero.boons).onGuardBreak).toEqual({ momentum: 1, heal: 5 });
  });

  and(/^l'ascension n'a aucun Déblocage$/u, () => {
    expect(world.resumed?.unlocks).toEqual([]);
    expect(world.resumed?.emberHeartOffered).toBe(false);
  });
};

// Le scénario `@ui` seul.
const feature = loadFeature('features/veillee-d-hiver-deblocages.feature');
const onScreen = ({ tags }: { readonly tags: readonly string[] }) => tags.includes('@ui');
autoBindSteps(
  [
    {
      ...feature,
      scenarios: feature.scenarios.filter(onScreen),
      scenarioOutlines: feature.scenarioOutlines.filter(onScreen),
    },
  ],
  [steps],
);
