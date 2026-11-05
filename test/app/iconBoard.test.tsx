/**
 * Test d'intégration de l'assemblage de la planche des icônes (outil du build de preview, #157) :
 * les vraies routes de `src/app`, une vraie base SQLite (node:sqlite à la place d'expo-sqlite) et
 * le lien profond `ascent://preview/icon-board`. Le canal du build est la variable que l'action de
 * build Android pose avant Metro (EXPO_PUBLIC_ASCENT_CHANNEL), lue par le vrai `buildChannel`.
 */
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { ASCENT_KEY } from '../../src/application/useCases/AscentSession';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));
// expo-audio n'a pas de module natif sous Jest : un lecteur simulé, qui ne joue rien. La planche
// ouvre ses ascensions avec les sons du combat (#159).
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
const sourceDirectory = path.resolve(__dirname, '../../src');
const appDirectory = path.join(sourceDirectory, 'app');
const ICON_BOARD_URL = '/preview/icon-board';

function builtFor(channel: string | undefined): void {
  if (channel === undefined) {
    delete process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
  } else {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = channel;
  }
}

async function iconBoardIsShown(): Promise<void> {
  expect(await screen.findByRole('header', { name: 'Planche des icônes' })).toBeOnTheScreen();
  expect(screen.queryByTestId('day-view-empty')).not.toBeOnTheScreen();
}

async function dayViewIsShown(): Promise<void> {
  expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
  expect(screen.queryByTestId('icon-board')).not.toBeOnTheScreen();
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.tsx?$/u.test(entry.name) ? [file] : [];
  });
}

describe('icon board route (#157)', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

  /** La base de l'app, telle que la route l'a ouverte. */
  let appDatabase: Awaited<ReturnType<typeof prepareAscentDatabase>> | null = null;

  beforeEach(() => {
    appDatabase = null;
    openDatabase.mockReset();
    openDatabase.mockImplementation(async () => {
      appDatabase = await prepareAscentDatabase(openNodeSqliteDatabase());
      return appDatabase;
    });
  });

  afterEach(() => {
    builtFor(initialChannel);
  });

  describe('on the preview build', () => {
    beforeEach(() => {
      builtFor('preview');
    });

    it('opens the icon board from its deep link, and goes back to the day view when closed', async () => {
      await renderRouter(appDirectory, { initialUrl: ICON_BOARD_URL });
      await iconBoardIsShown();

      await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

      await dayViewIsShown();
      expect(router.canGoBack()).toBe(false);
    });

    it('goes back to the previous screen when the icon board is closed', async () => {
      await renderRouter(appDirectory);
      await dayViewIsShown();
      await act(() => router.push(ICON_BOARD_URL));
      await iconBoardIsShown();

      await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));

      await dayViewIsShown();
    });
  });

  describe('with the loadout entries (#159)', () => {
    beforeEach(() => {
      builtFor('preview');
    });

    it('opens the real ascent on a fixed ascent in memory, without touching the ascent of the player', async () => {
      await renderRouter(appDirectory, { initialUrl: ICON_BOARD_URL });
      await iconBoardIsShown();

      await fireEvent.press(screen.getByRole('button', { name: 'Équipement · 8 · sorties' }));
      expect(await screen.findByRole('header', { name: 'Dernière porte' })).toBeOnTheScreen();
      expect(screen.getByTestId('ascent-loadout')).toHaveAccessibleName(
        'Équipement : 3 bénédictions de départ, 5 bienfaits. Ouvre la liste',
      );
      // « Pause » sauvegarde l'ascension de la planche, dans sa mémoire à elle.
      await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));

      await iconBoardIsShown();
      expect(await new SqliteKeyValueStore(appDatabase!).get(ASCENT_KEY)).toBeNull();
    });
  });

  it.each([
    ['the production build', 'production'],
    ['a build without channel', undefined],
  ])('redirects the deep link to the day view on %s', async (_, channel) => {
    builtFor(channel);

    await renderRouter(appDirectory, { initialUrl: ICON_BOARD_URL });

    await dayViewIsShown();
  });

  it('offers no entry point to the icon board outside its route', () => {
    const route = path.join(appDirectory, 'preview', 'icon-board.tsx');
    const linking = sourceFiles(sourceDirectory).filter(
      (file) => file !== route && readFileSync(file, 'utf8').includes('preview/icon-board'),
    );

    expect(linking).toEqual([]);
  });
});
