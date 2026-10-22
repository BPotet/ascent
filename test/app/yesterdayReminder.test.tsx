/**
 * Test d'intégration de l'assemblage du rappel d'hier (story #9) : les vraies routes de `src/app`,
 * une vraie base SQLite (node:sqlite à la place d'expo-sqlite) et l'horloge du téléphone fixée par
 * de faux timers au lundi 19 octobre 2026 : hier, dimanche 18, est dans la semaine précédente.
 */
import { act, cleanup, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
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
const COOKING_YESTERDAY = 'Cuisiner, dimanche 18 octobre';

/** Une base avec les habitudes « Cuisiner » et « Lire », créées le jeudi 15 octobre. */
async function databaseWithTwoHabits(): Promise<SqlDatabase> {
  const db = await prepareAscentDatabase(openNodeSqliteDatabase());
  const clock = new FixedClock(Day.of(2026, 10, 15));
  const unitOfWork = new SqliteUnitOfWork(db);
  await createHabit({ clock, unitOfWork }, 'Cuisiner');
  await createHabit({ clock, unitOfWork }, 'Lire');
  return db;
}

const weekView = () => within(screen.getByTestId('week-view'));

async function showTab(label: 'Journée' | 'Semaine'): Promise<void> {
  await fireEvent.press(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: label }));
}

function selectedTab(): string | undefined {
  const tabs = within(screen.getByTestId('tab-bar')).getAllByRole('tab');
  return tabs.find((tab) => tab.props.accessibilityState?.selected === true)?.props
    .accessibilityLabel;
}

async function correctYesterday(): Promise<void> {
  const reminder = await screen.findByTestId('yesterday-reminder');
  await fireEvent.press(within(reminder).getByRole('button', { name: 'Corriger' }));
}

describe('app reminder of yesterday', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    openDatabase.mockReset();
    // renderRouter active ses propres faux timers en gardant l'heure système fixée ici.
    jest.useFakeTimers({ now: new Date(2026, 9, 19, 9, 0) });
    db = await databaseWithTwoHabits();
    openDatabase.mockResolvedValue(db);
  });

  it('leads from the reminder to the week of yesterday, where yesterday is corrected', async () => {
    await renderRouter(appDirectory);
    const reminder = await screen.findByTestId('yesterday-reminder');
    expect(within(reminder).getByText('0/2 faites')).toBeOnTheScreen();

    await correctYesterday();

    expect(await screen.findByTestId('week-view')).toBeOnTheScreen();
    expect(selectedTab()).toBe('Semaine');
    const cell = await weekView().findByLabelText(`${COOKING_YESTERDAY}, pas fait`);
    expect(weekView().queryByTestId('cell-1-2026-10-19')).not.toBeOnTheScreen();

    await fireEvent.press(cell);

    expect(
      await weekView().findByLabelText(`${COOKING_YESTERDAY}, fait, corrigé`),
    ).toBeOnTheScreen();
    expect(
      within(weekView().getByTestId('cell-1-2026-10-18')).getByTestId('corrected-mark', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();

    await showTab('Journée');

    expect(
      await within(screen.getByTestId('yesterday-reminder')).findByText('1/2 faites'),
    ).toBeOnTheScreen();
  });

  it('opens the week of yesterday again each time « Corriger » is pressed', async () => {
    await renderRouter(appDirectory);
    await correctYesterday();
    await screen.findByTestId('week-view');
    await weekView().findByLabelText(`${COOKING_YESTERDAY}, pas fait`);
    await fireEvent.press(weekView().getByRole('button', { name: 'Revenir à cette semaine' }));
    expect(await weekView().findByTestId('cell-1-2026-10-19')).toBeOnTheScreen();

    await showTab('Journée');
    jest.advanceTimersByTime(1000);
    await correctYesterday();

    expect(await weekView().findByLabelText(`${COOKING_YESTERDAY}, pas fait`)).toBeOnTheScreen();
  });

  it('remembers after a restart that the reminder was closed', async () => {
    await renderRouter(appDirectory);
    const reminder = await screen.findByTestId('yesterday-reminder');
    await fireEvent.press(
      within(reminder).getByRole('button', { name: 'Fermer le rappel d’hier' }),
    );
    expect(screen.queryByTestId('yesterday-reminder')).not.toBeOnTheScreen();
    await cleanup();

    await renderRouter(appDirectory);

    expect(await screen.findByTestId('day-view')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Cuisiner, lundi 19 octobre, à faire, Moyenne, 10 XP par suivi'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('yesterday-reminder')).not.toBeOnTheScreen();
  });

  it('reminds the new yesterday at midnight, even after the reminder of the day before was closed', async () => {
    jest.setSystemTime(new Date(2026, 9, 19, 23, 59));
    await renderRouter(appDirectory);
    const reminder = await screen.findByTestId('yesterday-reminder');
    await fireEvent.press(
      within(reminder).getByRole('button', { name: 'Fermer le rappel d’hier' }),
    );
    await fireEvent.press(
      await screen.findByLabelText('Cuisiner, lundi 19 octobre, à faire, Moyenne, 10 XP par suivi'),
    );
    expect(
      await screen.findByLabelText('Cuisiner, lundi 19 octobre, fait, Moyenne, 10 XP par suivi'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('yesterday-reminder')).not.toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(
      await screen.findByLabelText('Cuisiner, mardi 20 octobre, à faire, Moyenne, 10 XP par suivi'),
    ).toBeOnTheScreen();
    expect(
      await within(screen.getByTestId('yesterday-reminder')).findByText('1/2 faites'),
    ).toBeOnTheScreen();
  });

  it('opens the week view on the week of the day it is given', async () => {
    await renderRouter(appDirectory, { initialUrl: '/week?week=2026-10-18' });
    await screen.findByTestId('week-view');

    expect(await weekView().findByLabelText(`${COOKING_YESTERDAY}, pas fait`)).toBeOnTheScreen();
  });

  it('shows the current week when the week view is opened with no valid week', async () => {
    await renderRouter(appDirectory, { initialUrl: '/week?week=not-a-day&request=1' });
    await screen.findByTestId('week-view');

    expect(await weekView().findByTestId('cell-1-2026-10-19')).toBeOnTheScreen();
  });
});
