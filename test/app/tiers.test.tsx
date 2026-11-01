/**
 * Test d'intégration de l'assemblage des paliers et des Éclats (#38) : les vraies routes de
 * `src/app`, une vraie base SQLite (node:sqlite), les vrais adaptateurs du téléphone. Du boss du
 * palier 1 vaincu au palier 2, puis le Total d'Éclats au pied de la tour, lu par la session
 * partagée. La scène Skia est simulée.
 */
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { ASCENT_KEY, SHARD_TOTAL_KEY } from '../../src/application/useCases/AscentSession';
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
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');

/** Le boss du palier 1 vaincu, ses 8 Éclats crédités : l'ascension sauvegardée sur l'écran X3. */
const BEATEN: Ascent = {
  ...startAscent(7),
  floor: 6,
  encounter: null,
  lastGold: 40,
  gold: 90,
  shardAwards: [{ id: '7:1:6:boss', amount: 8 }],
  passage: { to: 2, step: 'bossDefeated' },
};

describe('the tiers and the Shards in the app (#38)', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
  let store: SqliteKeyValueStore | null = null;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';
    openDatabase.mockReset();
    openDatabase.mockImplementation(async () => {
      const database = await prepareAscentDatabase(openNodeSqliteDatabase());
      store = new SqliteKeyValueStore(database);
      await store.set(ASCENT_KEY, JSON.stringify({ version: 1, ascent: BEATEN, battle: null }));
      return database;
    });
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = initialChannel;
  });

  it('resumes on the defeated boss screen, then enters floor 1 of tier 2, the Shards kept', async () => {
    await renderRouter(appDirectory, { initialUrl: '/tower' });

    expect(await screen.findByTestId('tower-foot-shards')).toHaveTextContent('8 Éclats');
    expect(screen.getByText('Palier 1 · les Catacombes · 6 étages')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: "Reprendre l'ascension" }));
    expect(await screen.findByTestId('ascent-boss-defeated')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuer vers le palier 2' }));
    expect(await screen.findByRole('header', { name: 'Les Jardins de cendre' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Entrer' }));

    expect(await screen.findByTestId('ascent-status')).toHaveTextContent(
      /^Palier 2 · Étage 1 sur 6/,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(JSON.parse((await store!.get(SHARD_TOTAL_KEY))!)).toMatchObject({ total: 8 });
  });
});
