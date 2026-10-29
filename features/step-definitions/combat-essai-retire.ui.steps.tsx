/**
 * Scénarios d'interface (`@ui`) du retrait du combat d'essai (#121), exécutés à travers les vraies
 * routes de `src/app` et une vraie base SQLite (node:sqlite à la place d'expo-sqlite). Le canal du
 * build est la variable que l'action de build Android pose avant Metro
 * (EXPO_PUBLIC_ASCENT_CHANNEL). La scène Skia est simulée (Skia reste limité à son test de fumée).
 *
 * « À la même place que dans le build de production » : la barre d'onglets est rendue seule, avec
 * à côté d'elle, dans son parent, autant d'éléments qu'en production ; rien ne s'intercale entre
 * la liste de la Vue Journée et la barre. La place au pixel se compare sur la capture e2e.
 */
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
import { autoBindSteps, loadFeature, type StepDefinitions } from 'jest-cucumber';
import path from 'node:path';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import type { SqlDatabase } from '../../src/adapters/persistence/sqlite/SqlDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { createHabit } from '../../src/application/useCases/createHabit';
import { Day } from '../../src/domain/day/Day';

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
const SCHEME = 'ascent://';
const OLD_TRIAL_BATTLE_LINK = `${SCHEME}trial-battle`;
const TOUCH_PROBE_LINK = `${SCHEME}preview/touch-probe`;
const TRIAL_BATTLE_LABEL = "Combat d'essai";
const initialChannel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;

interface World {
  /** L'app rendue, démontée avant d'en rendre une autre dans le même scénario. */
  app: { readonly unmount: () => void | Promise<void> } | null;
  channels: readonly string[];
  /** Par canal : l'accueil s'est affiché à l'ouverture. */
  landed: Record<string, boolean>;
}

let world: World;

function builtFor(channel: string | undefined): void {
  if (channel === undefined) {
    delete process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
  } else {
    process.env.EXPO_PUBLIC_ASCENT_CHANNEL = channel;
  }
}

/** Une base avec l'habitude « Cuisiner » : la Vue Journée montre sa liste. */
async function databaseWithAHabit(): Promise<SqlDatabase> {
  const db = await prepareAscentDatabase(openNodeSqliteDatabase());
  await createHabit(
    { clock: new FixedClock(Day.of(2026, 10, 27)), unitOfWork: new SqliteUnitOfWork(db) },
    'Cuisiner',
  );
  return db;
}

/** Ouvre l'app par un lien profond (`ascent://…`), reçu pendant le démarrage. */
async function openLink(link: string): Promise<void> {
  expect(link.startsWith(SCHEME)).toBe(true);
  world.app = await renderRouter(appDirectory, { initialUrl: `/${link.slice(SCHEME.length)}` });
}

/** Le nombre d'éléments à côté de la barre d'onglets, dans son parent. */
function besideTheTabBar(): number {
  const parent = screen.getByTestId('tab-bar').parent;
  return (parent?.children.length ?? 0) - 1;
}

/** Ce qui entoure la barre d'onglets sur le build de production, avec la même base. */
async function besideTheTabBarInProduction(database: () => Promise<SqlDatabase>): Promise<number> {
  const channel = process.env.EXPO_PUBLIC_ASCENT_CHANNEL;
  builtFor('production');
  openDatabase.mockImplementation(database);
  const production = await renderRouter(appDirectory);
  await screen.findByTestId('tab-bar');
  const beside = besideTheTabBar();
  await production.unmount();
  builtFor(channel);
  return beside;
}

function noTrialBattleButton(): void {
  expect(screen.queryByRole('button', { name: TRIAL_BATTLE_LABEL })).not.toBeOnTheScreen();
  expect(screen.queryByText(TRIAL_BATTLE_LABEL)).not.toBeOnTheScreen();
}

beforeEach(() => {
  world = { app: null, channels: [], landed: {} };
  openDatabase.mockReset();
  openDatabase.mockImplementation(() => prepareAscentDatabase(openNodeSqliteDatabase()));
});

afterEach(() => {
  builtFor(initialChannel);
});

const steps: StepDefinitions = ({ given, when, then, and }) => {
  given('le build de preview', () => builtFor('preview'));

  // --- Plus de bouton « Combat d'essai » ------------------------------------------------------

  when("le joueur ouvre l'app, sur n'importe quel onglet", async () => {
    world.app = await renderRouter(appDirectory);
    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
  });

  then("aucun bouton « Combat d'essai » n'apparaît au-dessus de la barre d'onglets", async () => {
    for (const tab of ['Semaine', 'Mois', 'Tour', 'Journée']) {
      noTrialBattleButton();
      await fireEvent.press(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: tab }));
    }
    noTrialBattleButton();
  });

  and("la barre d'onglets est à la même place que dans le build de production", async () => {
    const beside = besideTheTabBar();
    await world.app!.unmount();
    expect(beside).toBe(
      await besideTheTabBarInProduction(() => prepareAscentDatabase(openNodeSqliteDatabase())),
    );
  });

  // --- La Vue Journée retrouve sa hauteur ------------------------------------------------------

  when("la Vue Journée s'affiche", async () => {
    openDatabase.mockImplementation(databaseWithAHabit);
    world.app = await renderRouter(appDirectory);
    expect(await screen.findByTestId('day-view-list')).toBeOnTheScreen();
  });

  then('sa liste a la même hauteur que dans le build de production', async () => {
    noTrialBattleButton();
    const beside = besideTheTabBar();
    await world.app!.unmount();
    expect(beside).toBe(await besideTheTabBarInProduction(databaseWithAHabit));
  });

  // --- Les combats de l'ascension ne changent pas ----------------------------------------------

  given('une ascension en cours', async () => {
    builtFor('preview');
    await renderRouter(appDirectory);
    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
  });

  when(
    "le joueur commence l'ascension, choisit son héros et entre dans un combat, une Élite ou le boss",
    async () => {
      await fireEvent.press(screen.getByRole('tab', { name: 'Tour' }));
      await fireEvent.press(await screen.findByRole('button', { name: "Commencer l'ascension" }));
      expect(await screen.findByTestId('hero-choice')).toBeOnTheScreen();
      await fireEvent.press(
        await screen.findByRole('button', { name: 'Continuer avec la Sentinelle' }),
      );
    },
  );

  then(
    "le choix du héros, le combat, la bulle d'aide, le bienfait et l'objet trouvé sont ceux d'aujourd'hui",
    async () => {
      // Le combat du 1er étage, sur l'écran de combat partagé avec l'ascension.
      expect(await screen.findByRole('header', { name: 'Étage 1' })).toBeOnTheScreen();
      expect(await screen.findByTestId('battle-screen')).toBeOnTheScreen();
      expect(screen.getByTestId('battle-hero-bar')).toBeOnTheScreen();
      // Une base neuve : la bulle d'aide de la phase du héros, ou celle de la phase ennemie si
      // l'ennemi ouvre le combat par l'Initiative.
      await waitFor(() =>
        expect(
          screen.queryByTestId('battle-hint-hero') ?? screen.queryByTestId('battle-hint-defense'),
        ).toBeOnTheScreen(),
      );
      // Rien de l'écran de fin du combat d'essai, ni de ses outils.
      expect(screen.queryByRole('button', { name: 'Rejouer' })).not.toBeOnTheScreen();
      expect(screen.queryByText(/Réglages d'essai|Mesures/u)).not.toBeOnTheScreen();
    },
  );

  // --- Un ancien lien vers le combat d'essai ---------------------------------------------------

  given('le build de preview ou de production', () => {
    world.channels = ['preview', 'production'];
  });

  when("l'app est ouverte sur l'ancienne adresse du combat d'essai", async () => {
    for (const channel of world.channels) {
      builtFor(channel);
      await openLink(OLD_TRIAL_BATTLE_LINK);
      world.landed[channel] = (await screen.findByTestId('day-view-empty')) !== null;
      expect(screen.queryByTestId('hero-choice')).not.toBeOnTheScreen();
      expect(screen.queryByTestId('battle-screen')).not.toBeOnTheScreen();
      await world.app!.unmount();
    }
  });

  then("elle ramène à l'accueil, sans erreur", () => {
    expect(world.landed).toEqual({ preview: true, production: true });
  });

  // --- La sonde de toucher reste ---------------------------------------------------------------

  when('le lien de la sonde de toucher est ouvert', () => openLink(TOUCH_PROBE_LINK));

  then("la sonde s'ouvre comme aujourd'hui", async () => {
    expect(await screen.findByRole('header', { name: 'Sonde de toucher' })).toBeOnTheScreen();
    expect(screen.getByTestId('touch-probe')).toBeOnTheScreen();
  });
};

// Seuls les scénarios d'interface (`@ui`) : l'autre passe par la session d'ascension.
const feature = loadFeature('features/combat-essai-retire.feature');
autoBindSteps(
  [{ ...feature, scenarios: feature.scenarios.filter(({ tags }) => tags.includes('@ui')) }],
  [steps],
);
