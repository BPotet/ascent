/**
 * Test d'intégration de la route du menu des pouvoirs (#270) : les vraies routes de `src/app`, une
 * vraie base SQLite (node:sqlite), les vrais adaptateurs du téléphone. La carte « Pouvoirs équipés »
 * du pied de la tour ouvre le menu ; son retour, comme un « Valider » enregistré, ramène au pied de
 * la tour ; le bandeau de l'arbre l'ouvre sur l'onglet du héros ; hors du build de preview, la route
 * mène à la Vue Journée. La scène Skia est simulée.
 */
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { SHARD_TOTAL_KEY } from '../../src/application/useCases/AscentSession';
import { CAMP_KEY, EQUIPPED_POWERS_KEY } from '../../src/application/useCases/CampSession';

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
let store: SqliteKeyValueStore;

const selected = (hero: string) =>
  screen.getByTestId(`powers-menu-tab-${hero}`).props.accessibilityState?.selected as boolean;

describe('the powers menu in the app (#270)', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

  beforeEach(() => {
    openDatabase.mockReset();
    openDatabase.mockImplementation(async () => {
      const database = await prepareAscentDatabase(openNodeSqliteDatabase());
      store = new SqliteKeyValueStore(database);
      await store.set(
        SHARD_TOTAL_KEY,
        JSON.stringify({ version: 1, total: 200, seed: null, awarded: [] }),
      );
      // L'Errante a Entaille et Brume : ses 3 places sont prises.
      await store.set(
        CAMP_KEY,
        JSON.stringify({
          version: 1,
          unlocks: [],
          powers: [
            { power: 'rend', price: 30 },
            { power: 'mist', price: 30 },
          ],
        }),
      );
      await store.set(
        EQUIPPED_POWERS_KEY,
        JSON.stringify({ version: 1, heroes: { wanderer: ['shadowStep', 'rend', 'mist'] } }),
      );
      return database;
    });
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = initialChannel;
  });

  it('leads to the day view outside the preview build', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'production';

    await renderRouter(appDirectory, { initialUrl: '/powers-menu?hero=wanderer' });

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('powers-menu')).not.toBeOnTheScreen();
  });

  it('opens from the card of the tower foot, and goes back to it', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    await renderRouter(appDirectory, { initialUrl: '/tower' });

    await fireEvent.press(await screen.findByTestId('equipped-powers-card'));

    expect(await screen.findByRole('header', { name: 'Pouvoirs équipés' })).toBeOnTheScreen();
    expect(selected('sentinel')).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    expect(await screen.findByTestId('equipped-powers-card')).toBeOnTheScreen();
    expect(screen.queryByTestId('powers-menu')).not.toBeOnTheScreen();
  });

  it('opens on the tab of the hero, and goes back to the tower foot without history', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    await renderRouter(appDirectory, { initialUrl: '/powers-menu?hero=wanderer' });

    expect(await screen.findByTestId('powers-menu-row-shadowStep')).toBeOnTheScreen();
    expect(selected('wanderer')).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    expect(await screen.findByTestId('equipped-powers-card')).toBeOnTheScreen();
  });

  it('opens from the band of the tree, saves with « Valider », and goes back to the tower foot (D1)', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    await renderRouter(appDirectory, { initialUrl: '/tower' });
    await screen.findByTestId('equipped-powers-card');
    await fireEvent.press(screen.getByRole('button', { name: 'Le camp' }));
    await fireEvent.press(await screen.findByTestId('camp-tree-wanderer'));
    await fireEvent.press(await screen.findByTestId('power-node-flurry'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Débloquer pour 60 Éclats' }));

    await fireEvent.press(
      await screen.findByRole('button', {
        name: "Choisir mes pouvoirs : ouvre le menu des pouvoirs de l'Errante",
      }),
    );

    expect(await screen.findByTestId('powers-menu-row-flurry')).toBeOnTheScreen();
    expect(selected('wanderer')).toBe(true);
    await fireEvent.press(screen.getByTestId('powers-menu-row-shadowStep'));
    await fireEvent.press(screen.getByTestId('powers-menu-row-flurry'));
    await act(async () => {
      await fireEvent.press(screen.getByTestId('powers-menu-validate'));
    });

    expect(await screen.findByTestId('powers-card-cell-flurry')).toBeOnTheScreen();
    expect(screen.queryByTestId('powers-menu')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('powers-card-cell-shadowStep')).not.toBeOnTheScreen();
    expect(screen.getByTestId('powers-card-cell-rend')).toBeOnTheScreen();
  });
});
