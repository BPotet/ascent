/**
 * « Exporter le journal du parcours de mes ascensions » (#196) à l'écran : une vraie session
 * d'ascension avec son journal, sur un Stockage clé-valeur en mémoire, puis le vrai écran de fin de
 * l'ascension ou le vrai Pied de la tour ; le Menu de partage est simulé et garde le fichier.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';

import { InMemoryUnitOfWork } from '../../src/application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../src/application/testing/settableClock';
import type { LogExport } from '../../src/application/useCases/exportAscentLog';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';
import { beginAscentLog } from '../../src/domain/ascentLog/AscentLog';
import { AscentScreen } from '../../src/adapters/ui/screens/AscentScreen';
import { TowerFootScreen } from '../../src/adapters/ui/screens/TowerFootScreen';
import type { Dependencies } from '../../src/adapters/ui/state/Dependencies';
import { renderScreen } from '../../src/adapters/ui/testing/renderScreen';
import { silentHaptics } from '../../src/adapters/ui/testing/silentHaptics';
import { ascentLogFeature } from '../../src/app/ascent';
import {
  LOG_DAY,
  climb,
  lastExport,
  logStory,
  savedWithLog,
  type LogStory,
} from '../support/ascentLogStory';
import { playToTheEnd, settleStore } from '../support/tiersStory';

// L'assemblage (`src/app/ascent`) charge les sons : expo-audio n'a pas de module natif sous Jest.
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(async () => undefined),
}));
jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
afterAll(() => {
  process.env.EXPO_PUBLIC_ASCENT_CHANNEL = initialChannel;
});

let story: LogStory;
let saved: Ascent;
let onEnter: jest.Mock;
let storedBefore: Map<string, string>;

function dependencies(): Dependencies {
  return {
    clock: settableClock(LOG_DAY),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: story.store,
    haptics: silentHaptics(),
  };
}

async function showEnd(logExport: LogExport | undefined): Promise<void> {
  await renderScreen(
    <AscentScreen
      session={story.session}
      visibility={{ onChange: () => () => {} }}
      onLeave={jest.fn()}
      logExport={logExport}
    />,
    dependencies(),
  );
}

async function showTowerFoot(logExport: LogExport | undefined): Promise<void> {
  onEnter = jest.fn();
  await renderScreen(
    <TowerFootScreen session={story.session} onEnter={onEnter} logExport={logExport} />,
    dependencies(),
  );
}

const exportButton = () => screen.findByRole('button', { name: 'Exporter le journal' });

async function pressExport(): Promise<void> {
  const calls = story.share.share.mock.calls.length;
  await fireEvent.press(await exportButton());
  await waitFor(() => expect(story.share.share.mock.calls.length).toBe(calls + 1));
  await settleStore();
}

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given(/^l'app installée depuis le build de preview$/u, () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    story = logStory();
  });

  // --- La chute (E1) ---

  given(/^une ascension avec la Sentinelle, sous une Jauge « Faveur »$/u, () => {
    saved = startAscent(3, { hero: 'sentinel', gauge: 1 });
  });

  and(/^le héros tombé au combat d'étage de l'étage 4 du palier 2$/u, async () => {
    saved = { ...saved, tier: 2, floor: 4, hero: { ...saved.hero, hp: 1 } };
    await savedWithLog(story, saved);
    await story.session.load();
    await playToTheEnd(story.session.battleSession(), story.battleClock);
    await settleStore();
    expect(story.session.current()?.outcome).toBe('fall');
    await showEnd(story.logExport);
  });

  when(/^je touche « Exporter le journal » sur l'écran de fin de l'ascension$/u, async () => {
    expect(screen.getByRole('header', { name: "Fin de l'ascension" })).toBeOnTheScreen();
    await pressExport();
  });

  then(/^le menu de partage d'Android s'ouvre avec un fichier JSON$/u, () => {
    expect(story.shared.at(-1)).toMatchObject({
      name: 'ascent-journal-2026-11-03.json',
      mimeType: 'application/json',
    });
  });

  and(/^le fichier porte la version du format et la version de l'app$/u, () => {
    expect(lastExport(story)).toMatchObject({ formatVersion: 1, appVersion: '0.3.0' });
  });

  and(
    /^le journal de cette ascension indique la fin « chute », l'étage 4, le palier 2 et le combat d'étage de la chute$/u,
    () => {
      expect(lastExport(story).ascents.at(-1)).toMatchObject({
        hero: 'sentinel',
        gauge: 'favor',
        status: 'ended',
        end: {
          kind: 'fall',
          tier: 2,
          floor: 4,
          encounter: { kind: 'combat', enemies: saved.encounter!.enemies },
        },
      });
    },
  );

  // --- Le Pied de la tour, ascension en cours (P1) ---

  given(/^une ascension en cours, en pause à l'étage 3 du palier 1$/u, async () => {
    story.session.begin();
    story = await climb(story, (ascent) => ascent.floor === 3);
    story.session.pause();
    await settleStore();
    saved = story.session.current()!;
    await showTowerFoot(story.logExport);
    expect(await screen.findByRole('button', { name: "Reprendre l'ascension" })).toBeOnTheScreen();
  });

  when(/^je touche « Exporter le journal » en bas du Pied de la tour$/u, async () => {
    await pressExport();
  });

  then(
    /^le fichier contient le journal de cette ascension jusqu'à sa dernière sauvegarde, marqué « en cours », sans fin$/u,
    () => {
      const log = lastExport(story).ascents.at(-1)!;
      expect(log).toMatchObject({ ascentSeed: 3, status: 'inProgress', end: null });
      expect(log.floors.map((floor) => floor.floor)).toEqual([1, 2, 3]);
    },
  );

  and(
    /^après l'export, « Reprendre l'ascension » reprend l'ascension là où elle en était$/u,
    async () => {
      await fireEvent.press(screen.getByRole('button', { name: "Reprendre l'ascension" }));
      expect(onEnter).toHaveBeenCalledTimes(1);
      expect(story.session.current()).toEqual(saved);
    },
  );

  and(/^le journal continue à s'écrire à la reprise$/u, async () => {
    await act(async () => story.session.abandon());
    await story.logExport.export();
    expect(lastExport(story).ascents.at(-1)).toMatchObject({
      status: 'ended',
      end: { kind: 'abandon', tier: 1, floor: 3 },
    });
  });

  // --- Journal vide (P3) ---

  given(/^je n'ai jamais commencé d'ascension$/u, () => {
    expect(story.store.values.has('ascent.log.index')).toBe(false);
  });

  when(/^j'arrive au Pied de la tour$/u, async () => {
    await showTowerFoot(story.logExport);
  });

  then(/^le bouton « Exporter le journal » est grisé et indisponible$/u, async () => {
    await waitFor(async () => expect(await exportButton()).toBeDisabled());
  });

  and(
    /^la ligne « Aucune ascension dans le journal pour l'instant\. » s'affiche sous le bouton$/u,
    async () => {
      expect(
        await screen.findByText("Aucune ascension dans le journal pour l'instant.", {
          includeHiddenElements: true,
        }),
      ).toBeOnTheScreen();
    },
  );

  and(/^le menu de partage ne peut pas s'ouvrir$/u, async () => {
    await fireEvent.press(await exportButton());
    await settleStore();
    expect(story.share.share).not.toHaveBeenCalled();
  });

  // --- Partage annulé ---

  let closeMenu: () => void = () => undefined;
  given(/^le menu de partage ouvert par « Exporter le journal »$/u, async () => {
    const ascent = startAscent(3);
    await savedWithLog(story, ascent, { ...beginAscentLog(ascent, LOG_DAY), status: 'ended' });
    story.store.values.delete('ascent.current');
    story.share.share.mockImplementationOnce(
      (file) =>
        new Promise<void>((resolve) => {
          story.shared.push(file);
          closeMenu = resolve;
        }),
    );
    await showTowerFoot(story.logExport);
    await pressExport();
    storedBefore = new Map(story.store.values);
  });

  when(/^je ferme le menu de partage sans choisir d'application$/u, async () => {
    await act(async () => closeMenu());
  });

  then(/^je reviens sur l'écran d'où je suis parti, sans message d'erreur$/u, async () => {
    expect(screen.getByTestId('tower-foot')).toBeOnTheScreen();
    await waitFor(async () => expect(await exportButton()).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  and(/^le journal est inchangé et peut être exporté de nouveau$/u, async () => {
    expect(new Map(story.store.values)).toEqual(storedBefore);
    await pressExport();
    expect(story.share.share).toHaveBeenCalledTimes(2);
  });

  // --- Journal illisible (P4) ---

  given(
    /^un journal d'ascension gardé avec une version du format que l'app ne connaît pas, ou abîmé$/u,
    async () => {
      const { id } = await story.logStore.start(beginAscentLog(startAscent(1), LOG_DAY), 20);
      story.store.values.set(`ascent.log.${id}`, JSON.stringify({ formatVersion: 2 }));
    },
  );

  when(/^je commence ou reprends une ascension$/u, () => {
    story.session.begin();
  });

  then(/^l'ascension se joue normalement$/u, async () => {
    expect(story.session.current()).toMatchObject({ floor: 1, outcome: null });
    expect(story.recorder.inProgress()).toBe(true);
    await showTowerFoot(story.logExport);
  });

  and(
    /^à l'export, ce journal est laissé de côté et le fichier signale le nombre de journaux ignorés$/u,
    async () => {
      await pressExport();
      expect(lastExport(story)).toMatchObject({ ascentCount: 1, ignoredLogs: 1 });
    },
  );

  and(
    /^la ligne dorée « 1 ascension illisible laissée de côté\. » s'affiche sous le bouton$/u,
    async () => {
      expect(await screen.findByText('1 ascension illisible laissée de côté.')).toBeOnTheScreen();
    },
  );

  // --- Le build de production ---

  given(/^l'app installée depuis le build de production$/u, () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'production';
    story = logStory();
  });

  when(/^j'arrive sur l'écran de fin de l'ascension ou au Pied de la tour$/u, async () => {
    const feature = ascentLogFeature(story.store, settableClock(LOG_DAY));
    expect(feature).toBeNull();
    const ended: Ascent = { ...startAscent(3), encounter: null, outcome: 'fall' };
    story.store.values.set(
      'ascent.current',
      JSON.stringify({ version: 1, ascent: ended, battle: null }),
    );
    await story.session.load();
    await showEnd(feature?.logExport);
    expect(screen.getByRole('header', { name: "Fin de l'ascension" })).toBeOnTheScreen();
  });

  then(/^aucun bouton « Exporter le journal » n'apparaît$/u, async () => {
    expect(screen.queryByText('Exporter le journal')).not.toBeOnTheScreen();
    await screen.unmount();
    await showTowerFoot(undefined);
    expect(await screen.findByRole('header', { name: 'La tour' })).toBeOnTheScreen();
    expect(screen.queryByText('Exporter le journal')).not.toBeOnTheScreen();
  });
};

const feature = loadFeature('features/journal-d-ascension.feature');
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
