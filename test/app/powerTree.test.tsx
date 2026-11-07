/**
 * Test d'intégration de la route de l'arbre de pouvoirs (#235) : les vraies routes de `src/app`,
 * une vraie base SQLite (node:sqlite), les vrais adaptateurs du téléphone. La carte d'un héros, au
 * camp, ouvre son arbre ; le retour mène au camp ; hors du build de preview, la route mène à la Vue
 * Journée. La scène Skia est simulée.
 */
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { SHARD_TOTAL_KEY } from '../../src/application/useCases/AscentSession';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));
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
const appDirectory = path.resolve(__dirname, '../../src/app');

const selected = (hero: string) =>
  screen.getByTestId(`power-tree-tab-${hero}`).props.accessibilityState?.selected as boolean;

describe('the power tree in the app (#235)', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

  beforeEach(() => {
    openDatabase.mockReset();
    openDatabase.mockImplementation(async () => {
      const database = await prepareAscentDatabase(openNodeSqliteDatabase());
      const store = new SqliteKeyValueStore(database);
      await store.set(
        SHARD_TOTAL_KEY,
        JSON.stringify({ version: 1, total: 50, seed: null, awarded: [] }),
      );
      return database;
    });
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = initialChannel;
  });

  it('leads to the day view outside the preview build', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'production';

    await renderRouter(appDirectory, { initialUrl: '/power-tree?hero=wanderer' });

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('power-tree-screen')).not.toBeOnTheScreen();
  });

  it('opens the tree of the hero of the card, then goes back to the camp', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    await renderRouter(appDirectory, { initialUrl: '/tower' });
    expect(await screen.findByTestId('tower-foot')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Le camp' }));
    expect(await screen.findByRole('header', { name: 'Le camp' })).toBeOnTheScreen();

    await fireEvent.press(await screen.findByTestId('camp-tree-wanderer'));

    expect(await screen.findByTestId('power-tree')).toBeOnTheScreen();
    expect(selected('wanderer')).toBe(true);
    expect(selected('sentinel')).toBe(false);
    expect(screen.getByTestId('power-node-shadowStep')).toBeOnTheScreen();
    expect(await screen.findByLabelText('50 Éclats disponibles')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Retour au camp' }));
    expect(await screen.findByRole('header', { name: 'Le camp' })).toBeOnTheScreen();
    expect(screen.queryByTestId('power-tree-screen')).not.toBeOnTheScreen();
  });

  it('opens the tree of the Sentinel by default, and goes back to the camp without history', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    await renderRouter(appDirectory, { initialUrl: '/power-tree' });

    expect(await screen.findByTestId('power-tree')).toBeOnTheScreen();
    expect(selected('sentinel')).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Retour au camp' }));
    expect(await screen.findByRole('header', { name: 'Le camp' })).toBeOnTheScreen();
  });

  it('goes to the day view to create a habit for an Oath, without any habit (#237, S3)', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    await renderRouter(appDirectory, { initialUrl: '/power-tree?hero=wanderer' });

    await fireEvent.press(await screen.findByTestId('power-node-shadowStep'));
    await fireEvent.press(await screen.findByRole('button', { name: /^Prêter serment/u }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Aller à la Journée' }));

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
  });
});
