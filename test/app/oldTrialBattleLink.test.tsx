/**
 * Test d'intégration du retrait du combat d'essai (#121) : les vraies routes de `src/app`, une vraie
 * base SQLite (node:sqlite à la place d'expo-sqlite). Le canal du build est la variable que l'action
 * de build Android pose avant Metro (EXPO_PUBLIC_ASCENT_CHANNEL). L'ancienne adresse du combat
 * d'essai ramène à l'accueil, et plus aucun bouton « Combat d'essai » ne se place au-dessus de la
 * barre d'onglets. La scène Skia est simulée (Skia reste limité à son test de fumée).
 */
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import path from 'node:path';

import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));
// expo-audio n'a pas de module natif sous Jest (onglet Tour) : un lecteur simulé, qui ne joue rien.
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
const OLD_TRIAL_BATTLE_URL = '/trial-battle';

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
  expect(screen.queryByTestId('hero-choice')).not.toBeOnTheScreen();
  expect(screen.queryByTestId('battle-screen')).not.toBeOnTheScreen();
}

/** Le nombre d'éléments à côté de la barre d'onglets, dans son parent. */
function besideTheTabBar(): number {
  const parent = screen.getByTestId('tab-bar').parent;
  return (parent?.children.length ?? 0) - 1;
}

describe('old trial battle link (#121)', () => {
  const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

  beforeEach(() => {
    openDatabase.mockReset();
    openDatabase.mockImplementation(() => prepareAscentDatabase(openNodeSqliteDatabase()));
  });

  afterEach(() => {
    builtFor(initialChannel);
  });

  it.each([
    ['the preview build', 'preview'],
    ['the production build', 'production'],
    ['a build without channel', undefined],
  ])('leads to the day view on %s, without error', async (_, channel) => {
    builtFor(channel);

    await renderRouter(appDirectory, { initialUrl: OLD_TRIAL_BATTLE_URL });

    await dayViewIsShown();
    expect(screen.queryByText(/Unmatched Route|introuvable/iu)).not.toBeOnTheScreen();
  });

  it('shows no « Combat d’essai » button above the tab bar of the preview build, on any tab', async () => {
    builtFor('preview');
    await renderRouter(appDirectory);
    await dayViewIsShown();

    for (const tab of ['Semaine', 'Mois', 'Tour', 'Journée']) {
      expect(screen.queryByRole('button', { name: "Combat d'essai" })).not.toBeOnTheScreen();
      expect(screen.queryByText("Combat d'essai")).not.toBeOnTheScreen();
      await fireEvent.press(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: tab }));
    }
    expect(screen.queryByText("Combat d'essai")).not.toBeOnTheScreen();
  });

  it('places the tab bar of the preview build as on the production build, with nothing added beside it', async () => {
    builtFor('production');
    const production = await renderRouter(appDirectory);
    await dayViewIsShown();
    const besideInProduction = besideTheTabBar();
    await production.unmount();

    builtFor('preview');
    await renderRouter(appDirectory);
    await dayViewIsShown();

    expect(besideTheTabBar()).toBe(besideInProduction);
  });
});
