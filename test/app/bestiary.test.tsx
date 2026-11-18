/**
 * Test d'intégration de la route de la page d'un ennemi (#283, D12) : les vraies routes de
 * `src/app`, une vraie base SQLite (node:sqlite). Ouverte sans le carnet dessous, ou pour une entrée
 * qu'elle ne peut pas montrer, elle revient au carnet ; hors du build de preview, elle ramène à
 * l'accueil. La session du carnet de l'app est partagée par les tests du fichier : le premier
 * ouvre la page avant toute lecture du carnet.
 */
import { renderRouter, screen } from 'expo-router/testing-library';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { SqliteKeyValueStore } from '../../src/adapters/persistence/sqlite/SqliteKeyValueStore';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { DISCOVERY_BOOK_KEY } from '../../src/application/useCases/DiscoveryBookSession';
import {
  EMPTY_DISCOVERY_BOOK,
  serializeDiscoveryBook,
} from '../../src/domain/discoveryBook/DiscoveryBook';

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

describe('the route of an enemy page (#283)', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

  beforeEach(() => {
    openDatabase.mockReset();
    openDatabase.mockImplementation(async () => {
      const database = await prepareAscentDatabase(openNodeSqliteDatabase());
      await new SqliteKeyValueStore(database).set(
        DISCOVERY_BOOK_KEY,
        serializeDiscoveryBook({
          ...EMPTY_DISCOVERY_BOOK,
          lastTier: 2,
          enemies: { burningHusk: { state: 'defeated' } },
        }),
      );
      return database;
    });
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = initialChannel;
  });

  it('leads to the day view outside the preview build', async () => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'production';

    await renderRouter(appDirectory, { initialUrl: '/bestiary/burningHusk' });

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Embrasé' })).not.toBeOnTheScreen();
  });

  it.each([
    ['opened without the book under it', 'burningHusk'],
    ['for an entry never seen', 'ghoul'],
    ['for a code name out of the game', 'retired'],
  ])('comes back to the book when %s', async (_, kind) => {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = 'preview';

    await renderRouter(appDirectory, { initialUrl: `/bestiary/${kind}` });

    expect(await screen.findByRole('header', { name: 'Le carnet' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Retour au Bestiaire' })).not.toBeOnTheScreen();
  });
});
