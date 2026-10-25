/**
 * Test d'intégration de l'assemblage du combat d'essai (#31) : les vraies routes de `src/app`, une
 * vraie base SQLite (node:sqlite à la place d'expo-sqlite), les vrais adaptateurs du téléphone. Le
 * canal du build est la variable que l'action de build Android pose avant Metro
 * (EXPO_PUBLIC_ASCENT_CHANNEL). La scène Skia est simulée (Skia reste limité à son test de fumée).
 */
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { createAudioPlayer } from 'expo-audio';
import path from 'node:path';

import { BATTLE_SOUND_CUES } from '../../src/application/ports/BattleSound';
import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));
// expo-audio n'a pas de module natif sous Jest : un lecteur simulé, qui ne joue rien.
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    addListener: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    play: jest.fn(),
    remove: jest.fn(),
  })),
  setAudioModeAsync: jest.fn(async () => undefined),
}));
jest.mock('../../src/adapters/ui/battle/BattleCanvas', () =>
  jest.requireActual('../../src/adapters/ui/battle/testing/fakeBattleCanvas'),
);

const openDatabase = jest.mocked(openAscentDatabase);
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');
const TRIAL_BATTLE_URL = '/trial-battle';

function builtFor(channel: string | undefined): void {
  if (channel === undefined) {
    delete process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
  } else {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = channel;
  }
}

/** L'accueil : la Vue Journée, vide sur une base neuve. */
async function dayViewIsShown(): Promise<void> {
  expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
  expect(screen.queryByTestId('trial-battle')).not.toBeOnTheScreen();
}

/** Le combat d'essai, en phase du héros. */
async function trialBattleIsShown(): Promise<void> {
  expect(await screen.findByRole('header', { name: "Combat d'essai" })).toBeOnTheScreen();
  expect(await screen.findByRole('button', { name: 'Attaquer, cible : Goule' })).toBeOnTheScreen();
  expect(screen.queryByTestId('day-view-empty')).not.toBeOnTheScreen();
}

describe('trial battle route', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

  beforeEach(() => {
    jest.mocked(createAudioPlayer).mockClear();
    openDatabase.mockReset();
    openDatabase.mockImplementation(() => prepareAscentDatabase(openNodeSqliteDatabase()));
  });

  afterEach(() => {
    builtFor(initialChannel);
  });

  describe('on the preview build', () => {
    beforeEach(() => {
      builtFor('preview');
    });

    it('offers the trial battle above the tab bar, without hiding the day view', async () => {
      await renderRouter(appDirectory);

      await dayViewIsShown();
      expect(screen.getByRole('button', { name: "Combat d'essai" })).toBeOnTheScreen();
      expect(screen.getByText('Journée')).toBeOnTheScreen();
    });

    it('opens the trial battle from its entry point, and goes back to the day view', async () => {
      await renderRouter(appDirectory);
      await dayViewIsShown();

      await fireEvent.press(screen.getByRole('button', { name: "Combat d'essai" }));

      await trialBattleIsShown();
      expect(screen.getByTestId('battle-scene', { includeHiddenElements: true })).toBeOnTheScreen();
      await act(() => router.back());
      await dayViewIsShown();
    });

    it('opens the trial battle from its route, with its sounds preloaded', async () => {
      await renderRouter(appDirectory, { initialUrl: TRIAL_BATTLE_URL });

      await trialBattleIsShown();
      expect(jest.mocked(createAudioPlayer)).toHaveBeenCalledTimes(BATTLE_SOUND_CUES.length);
    });
  });

  it.each([
    ['the production build', 'production'],
    ['a build without channel', undefined],
    ['a build with an unknown channel', 'staging'],
  ])('offers no trial battle on %s, and its route leads to the day view', async (_, channel) => {
    builtFor(channel);

    await renderRouter(appDirectory, { initialUrl: TRIAL_BATTLE_URL });

    await dayViewIsShown();
    expect(screen.queryByRole('button', { name: "Combat d'essai" })).not.toBeOnTheScreen();
  });
});
