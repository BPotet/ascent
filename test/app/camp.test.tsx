/**
 * Test d'intégration de l'assemblage du camp (#40) : les vraies routes de `src/app`, une vraie base
 * SQLite (node:sqlite), les vrais adaptateurs du téléphone. Le bilan de fin mène au camp, et le camp
 * ramène toujours au pied de la tour, jamais au bilan ; le pied de la tour ouvre le camp et y revient.
 * La scène Skia est simulée.
 */
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { ASCENT_KEY, SHARD_TOTAL_KEY } from '../../src/application/useCases/AscentSession';
import { CAMP_KEY } from '../../src/application/useCases/CampSession';
import { startAscent, type Ascent } from '../../src/domain/ascent/Ascent';

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

/** Une chute au palier 1, étage 3 : l'ascension sauvegardée sur le bilan de fin. */
const FALLEN: Ascent = { ...startAscent(7), floor: 3, encounter: null, outcome: 'fall' };

describe('the camp in the app (#40)', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

  beforeEach(() => {
    openDatabase.mockReset();
    openDatabase.mockImplementation(async () => {
      const database = await prepareAscentDatabase(openNodeSqliteDatabase());
      const store = new SqliteKeyValueStore(database);
      await store.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: FALLEN, battle: null }));
      await store.set(
        SHARD_TOTAL_KEY,
        JSON.stringify({ version: 1, total: 82, seed: null, awarded: [] }),
      );
      await store.set(
        CAMP_KEY,
        JSON.stringify({ version: 1, unlocks: [{ unlock: 'huntingSpear', price: 20 }] }),
      );
      return database;
    });
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = initialChannel;
  });

  it('leads to the day view outside the preview build', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'production';

    await renderRouter(appDirectory, { initialUrl: '/camp' });

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Le camp' })).not.toBeOnTheScreen();
  });

  it('goes from the end of the ascent to the camp, back to the tower foot, and to the camp again', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    // Le pied de la tour charge la session d'ascension, puis l'écran de l'ascension montre le bilan.
    await renderRouter(appDirectory, { initialUrl: '/tower' });
    expect(await screen.findByLabelText('62 Éclats')).toBeOnTheScreen();
    await act(async () => {
      router.push('/ascent');
    });

    // Le bilan garde le Total d'Éclats ; « Aller au camp » ouvre le camp, sans ascension en cours.
    expect(await screen.findByTestId('ascent-end')).toBeOnTheScreen();
    expect(screen.getByText('Total : 82 Éclats')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Aller au camp' }));
    expect(await screen.findByRole('header', { name: 'Le camp' })).toBeOnTheScreen();
    expect(await screen.findByLabelText('62 Éclats disponibles')).toBeOnTheScreen();
    expect(screen.queryByText(/^Ascension en cours/)).not.toBeOnTheScreen();

    // Le retour mène au pied de la tour, jamais au bilan.
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    expect(await screen.findByTestId('tower-foot')).toBeOnTheScreen();
    expect(screen.queryByTestId('ascent-end')).not.toBeOnTheScreen();
    expect(await screen.findByLabelText('62 Éclats')).toBeOnTheScreen();

    // Le pied de la tour ouvre le camp, et le camp y ramène.
    await fireEvent.press(screen.getByRole('button', { name: 'Le camp' }));
    expect(await screen.findByRole('header', { name: 'Le camp' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retour au pied de la tour' }));
    expect(await screen.findByTestId('tower-foot')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Le camp' })).not.toBeOnTheScreen();
  });
});
