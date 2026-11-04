/**
 * « Le journal raconte mes combats, appui par appui » (#197) à l'écran : une vraie session
 * d'ascension avec son journal, mise en pause en plein combat, puis le vrai Pied de la tour ; le
 * Menu de partage est simulé et garde le fichier.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import type { DefensePressRecord } from '../../src/domain/ascentLog/BattleLog';
import { LOG_DAY, logStory, type LogStory } from '../support/ascentLogStory';
import {
  ascentFacing,
  exportedBattle,
  exportedLog,
  facing,
  fight,
  pressesOf,
} from '../support/battleLogStory';
import { settleStore } from '../support/tiersStory';

const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
afterAll(() => {
  process.env.EXPO_PUBLIC_ASCENT_CHANNEL = initialChannel;
});

let story: LogStory;
let saved: DefensePressRecord;

const steps: StepDefinitions = ({ given, when, then }) => {
  given(/^l'app installée depuis le build de preview$/u, () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    story = logStory();
  });

  given(/^une ascension en pause pendant un combat$/u, async () => {
    await facing(story, ascentFacing(['ghoul'], { hp: 400 }));
    const battleSession = story.session.battleSession();
    await battleSession.start();
    await fight(story, battleSession, {
      defend: () => [['parry', -40]],
      until: (_, events) => events.some((event) => event.type === 'blowResolved'),
    });
    story.session.pause();
    battleSession.dispose();
    await story.recorder.settled();
    saved = pressesOf(story.recorder.currentBattle()!).find(
      (press): press is DefensePressRecord => press.kind === 'defense',
    )!;
    await renderScreen(
      <TowerFootScreen session={story.session} onEnter={jest.fn()} logExport={story.logExport} />,
      {
        clock: settableClock(LOG_DAY),
        unitOfWork: new InMemoryUnitOfWork(),
        keyValueStore: story.store,
        haptics: silentHaptics(),
      },
    );
    expect(await screen.findByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
  });

  when(/^je touche « Exporter le journal » en bas du Pied de la tour$/u, async () => {
    const button = await screen.findByRole('button', { name: 'Exporter le journal' });
    await waitFor(() => expect(button).toBeEnabled());
    await fireEvent.press(button);
    await waitFor(() => expect(story.share.share).toHaveBeenCalledTimes(1));
    await settleStore();
  });

  then(
    /^le combat en cours figure dans le fichier jusqu'à la dernière sauvegarde, marqué « en cours »$/u,
    () => {
      expect(exportedLog(story)).toMatchObject({ status: 'inProgress', battles: [{ floor: 3 }] });
      const battle = exportedBattle(story);
      expect(battle.status).toBe('inProgress');
      expect(pressesOf(battle)).toContainEqual(saved);
      expect(battle.segment).toBeNull();
    },
  );
};

const feature = loadFeature('features/journal-des-combats.feature');
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
