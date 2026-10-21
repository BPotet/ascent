/**
 * Test d'intégration de l'assemblage de la Vue Mois (story #10) : les vraies routes de `src/app`,
 * une vraie base SQLite (node:sqlite à la place d'expo-sqlite) et l'horloge du téléphone fixée par
 * de faux timers au mercredi 14 octobre 2026.
 */
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
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
const monthView = () => within(screen.getByTestId('month-view'));
const monthDay = (day: string) => monthView().getByTestId(`month-day-${day}`);

async function showTab(label: 'Journée' | 'Semaine' | 'Mois'): Promise<void> {
  await fireEvent.press(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: label }));
}

function selectedTab(): string | undefined {
  const tabs = within(screen.getByTestId('tab-bar')).getAllByRole('tab');
  return tabs.find((tab) => tab.props.accessibilityState?.selected === true)?.props
    .accessibilityLabel;
}

describe('app month view', () => {
  beforeEach(() => {
    openDatabase.mockReset();
    // renderRouter active ses propres faux timers en gardant l'heure système fixée ici.
    jest.useFakeTimers({ now: new Date(2026, 9, 14, 9, 0) });
  });

  it('shows in the counter of today a check-in confirmed in the day view', async () => {
    openDatabase.mockImplementation(databaseWithCooking);
    await renderRouter(appDirectory);
    await fireEvent.press(await screen.findByLabelText(`${COOKING_TODAY}, à faire`));
    expect(await dayView().findByLabelText(`${COOKING_TODAY}, fait`)).toBeOnTheScreen();

    await showTab('Mois');

    expect(await monthView().findByTestId('month-grid')).toBeOnTheScreen();
    expect(selectedTab()).toBe('Mois');
    expect(monthDay('2026-10-14')).toHaveAccessibleName(
      'mercredi 14 octobre, aujourd’hui, 1 habitude faite sur 1',
    );
    expect(within(monthDay('2026-10-14')).getByText('1/1')).toBeOnTheScreen();
  });

  it('corrects a past day from its detail, then the day view shows the same experience', async () => {
    openDatabase.mockImplementation(databaseWithCooking);
    await renderRouter(appDirectory);
    const reminder = await screen.findByTestId('yesterday-reminder');
    expect(within(reminder).getByText('0/1 faites')).toBeOnTheScreen();
    await showTab('Mois');
    await monthView().findByTestId('month-grid');

    await fireEvent.press(monthDay('2026-10-13'));
    const detail = within(screen.getByTestId('day-detail-2026-10-13'));
    await fireEvent.press(detail.getByRole('switch', { name: /^Cuisiner, mardi 13 octobre/u }));

    expect(
      await monthView().findByLabelText('mardi 13 octobre, 1 habitude faite sur 1, corrigé'),
    ).toBeOnTheScreen();
    expect(detail.getByText('corrigé')).toBeOnTheScreen();
    await waitFor(() => expect(monthView().getByTestId('xp-counter')).toHaveTextContent('10 XP'));

    await fireEvent.press(detail.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByTestId('day-detail-2026-10-13')).not.toBeOnTheScreen();
    await showTab('Journée');

    // Hier est maintenant entièrement fait : le rappel d'hier n'a plus rien à rappeler.
    await waitFor(() => expect(screen.queryByTestId('yesterday-reminder')).not.toBeOnTheScreen());
    expect(dayView().getByTestId('xp-counter')).toHaveTextContent('10 XP');
    expect(dayView().getByLabelText(`${COOKING_TODAY}, à faire`)).toBeOnTheScreen();
  });

  it('opens the new habit sheet in the day view from the empty state of the month view', async () => {
    openDatabase.mockImplementation(() => prepareAscentDatabase(openNodeSqliteDatabase()));
    await renderRouter(appDirectory);
    await screen.findByTestId('day-view-empty');
    await showTab('Mois');
    const empty = await screen.findByTestId('month-view-empty');

    await fireEvent.press(within(empty).getByRole('button', { name: 'Ajouter une habitude' }));

    expect(await screen.findByText('Nouvelle habitude')).toBeOnTheScreen();
    expect(selectedTab()).toBe('Journée');
    await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), 'Cuisiner');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
    expect(await dayView().findByLabelText(`${COOKING_TODAY}, à faire`)).toBeOnTheScreen();

    await showTab('Mois');

    expect(
      await monthView().findByLabelText('mercredi 14 octobre, aujourd’hui, 0 habitude faite sur 1'),
    ).toBeOnTheScreen();
  });
});
