/**
 * Test d'intégration de l'assemblage des vues : les vraies routes de `src/app` (onglets Journée,
 * Semaine et Mois), une vraie base SQLite (node:sqlite à la place d'expo-sqlite) et l'horloge du téléphone
 * fixée par de faux timers au mercredi 14 octobre 2026.
 */
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
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

const openDatabase = jest.mocked(openAscentDatabase);
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');
const COOKING_TODAY = 'Cuisiner, mercredi 14 octobre';

/** Une base avec l'habitude « Cuisiner », créée la veille. */
async function databaseWithCooking(): Promise<SqlDatabase> {
  const db = await prepareAscentDatabase(openNodeSqliteDatabase());
  const clock = new FixedClock(Day.of(2026, 10, 13));
  await createHabit({ clock, unitOfWork: new SqliteUnitOfWork(db) }, 'Cuisiner');
  return db;
}

const dayView = () => within(screen.getByTestId('day-view'));
const weekView = () => within(screen.getByTestId('week-view'));

async function showTab(label: 'Journée' | 'Semaine' | 'Mois'): Promise<void> {
  await fireEvent.press(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: label }));
}

function selectedTab(): string | undefined {
  const tabs = within(screen.getByTestId('tab-bar')).getAllByRole('tab');
  const selected = tabs.filter((tab) => tab.props.accessibilityState?.selected === true);
  expect(selected).toHaveLength(1);
  return selected[0]?.props.accessibilityLabel;
}

describe('app navigation between the views', () => {
  beforeEach(() => {
    openDatabase.mockReset();
    // renderRouter active ses propres faux timers en gardant l'heure système fixée ici.
    jest.useFakeTimers({ now: new Date(2026, 9, 14, 9, 0) });
  });

  it('opens on the day view, with a tab bar offering the day, week and month views', async () => {
    openDatabase.mockImplementation(databaseWithCooking);

    await renderRouter(appDirectory);

    expect(await screen.findByTestId('day-view')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-day')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-week')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-month')).toBeOnTheScreen();
    expect(within(screen.getByTestId('tab-bar')).getAllByRole('tab')).toHaveLength(3);
    expect(selectedTab()).toBe('Journée');
  });

  it('switches from the day view to the week view and back', async () => {
    openDatabase.mockImplementation(databaseWithCooking);
    await renderRouter(appDirectory);
    await screen.findByTestId('day-view');

    await showTab('Semaine');

    expect(await screen.findByTestId('week-card-1')).toBeOnTheScreen();
    expect(selectedTab()).toBe('Semaine');
    expect(weekView().getByLabelText(`${COOKING_TODAY}, à faire`)).toBeOnTheScreen();

    await showTab('Journée');

    expect(selectedTab()).toBe('Journée');
    expect(
      dayView().getByLabelText(
        `${COOKING_TODAY}, à faire, 0 sur 6 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).toBeOnTheScreen();

    // La Vue Semaine déjà ouverte est restée montée : elle s'affiche sans se recharger.
    await showTab('Semaine');

    expect(screen.queryByTestId('week-view-loading')).not.toBeOnTheScreen();
    expect(weekView().getByTestId('week-card-1')).toBeOnTheScreen();
  });

  it('shows in the week view a check-in confirmed in the day view, and the other way round', async () => {
    openDatabase.mockImplementation(databaseWithCooking);
    await renderRouter(appDirectory);
    await fireEvent.press(
      await screen.findByLabelText(
        `${COOKING_TODAY}, à faire, 0 sur 6 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    );
    expect(
      await dayView().findByLabelText(
        `${COOKING_TODAY}, fait, 1 sur 6 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).toBeOnTheScreen();

    await showTab('Semaine');

    expect(await weekView().findByLabelText(`${COOKING_TODAY}, fait`)).toBeOnTheScreen();

    await fireEvent.press(weekView().getByTestId('cell-1-2026-10-14'));
    expect(await weekView().findByLabelText(`${COOKING_TODAY}, à faire`)).toBeOnTheScreen();

    await showTab('Journée');

    expect(
      await dayView().findByLabelText(
        `${COOKING_TODAY}, à faire, 0 sur 6 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).toBeOnTheScreen();
  });

  it('opens the new habit sheet in the day view from the empty state of the week view', async () => {
    openDatabase.mockImplementation(() => prepareAscentDatabase(openNodeSqliteDatabase()));
    await renderRouter(appDirectory);
    await screen.findByTestId('day-view-empty');
    await showTab('Semaine');
    const empty = await screen.findByTestId('week-view-empty');

    await fireEvent.press(within(empty).getByRole('button', { name: 'Ajouter une habitude' }));

    expect(await screen.findByText('Nouvelle habitude')).toBeOnTheScreen();
    expect(selectedTab()).toBe('Journée');
    await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), 'Cuisiner');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
    expect(
      await dayView().findByLabelText(
        `${COOKING_TODAY}, à faire, 0 sur 5 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).toBeOnTheScreen();

    await showTab('Semaine');

    expect(await weekView().findByLabelText(`${COOKING_TODAY}, à faire`)).toBeOnTheScreen();
  });

  it('opens the new habit sheet again each time the empty week view asks for it', async () => {
    openDatabase.mockImplementation(() => prepareAscentDatabase(openNodeSqliteDatabase()));
    await renderRouter(appDirectory);
    await screen.findByTestId('day-view-empty');
    await showTab('Semaine');
    await fireEvent.press(
      within(await screen.findByTestId('week-view-empty')).getByRole('button', {
        name: 'Ajouter une habitude',
      }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Nouvelle habitude')).not.toBeOnTheScreen();

    await showTab('Semaine');
    jest.advanceTimersByTime(1000);
    await fireEvent.press(
      within(screen.getByTestId('week-view-empty')).getByRole('button', {
        name: 'Ajouter une habitude',
      }),
    );

    expect(await screen.findByText('Nouvelle habitude')).toBeOnTheScreen();
  });

  it('opens the week view on the week of a row of the targets by week of the month view', async () => {
    openDatabase.mockImplementation(async () => {
      const db = await prepareAscentDatabase(openNodeSqliteDatabase());
      const clock = new FixedClock(Day.of(2026, 10, 5));
      await createHabit({ clock, unitOfWork: new SqliteUnitOfWork(db) }, 'Cuisiner');
      return db;
    });
    await renderRouter(appDirectory);
    await screen.findByTestId('day-view');
    await showTab('Mois');
    const section = within(await screen.findByTestId('targets-by-week'));

    await fireEvent.press(
      section.getByRole('button', {
        name: 'Semaine du 5 octobre, 0 objectif atteint sur 1, ouvrir la semaine',
      }),
    );

    expect(await screen.findByTestId('week-view')).toBeOnTheScreen();
    expect(selectedTab()).toBe('Semaine');
    expect(
      await weekView().findByLabelText('Cuisiner, lundi 5 octobre, pas fait'),
    ).toBeOnTheScreen();
    expect(weekView().getByTestId('cell-1-2026-10-11')).toBeOnTheScreen();
    expect(weekView().queryByTestId('cell-1-2026-10-12')).not.toBeOnTheScreen();

    // Une autre ligne mène à sa propre semaine : la semaine en cours.
    await showTab('Mois');
    jest.advanceTimersByTime(1000);
    await fireEvent.press(
      within(screen.getByTestId('targets-by-week')).getByRole('button', {
        name: /^Cette semaine, /u,
      }),
    );

    expect(await weekView().findByTestId('cell-1-2026-10-14')).toBeOnTheScreen();
  });

  it('keeps the tab bar usable while the target feedback is shown (F1, D5)', async () => {
    openDatabase.mockImplementation(async () => {
      const db = await prepareAscentDatabase(openNodeSqliteDatabase());
      const clock = new FixedClock(Day.of(2026, 10, 14));
      await createHabit({ clock, unitOfWork: new SqliteUnitOfWork(db) }, 'Lire', 'medium', 1);
      return db;
    });
    await renderRouter(appDirectory);
    await screen.findByTestId('day-view');

    await fireEvent.press(dayView().getByRole('switch', { name: /^Lire, /u }));
    expect(await dayView().findByTestId('toast')).toHaveTextContent(
      /^Objectif de la semaine atteint/u,
    );
    expect(dayView().getByTestId('toast')).toHaveProp('pointerEvents', 'none');
    expect(
      within(screen.getByTestId('tab-bar')).getByRole('tab', { name: 'Semaine' }),
    ).toBeOnTheScreen();

    await showTab('Semaine');

    expect(await screen.findByTestId('week-card-1')).toBeOnTheScreen();
    expect(selectedTab()).toBe('Semaine');
  });
});
