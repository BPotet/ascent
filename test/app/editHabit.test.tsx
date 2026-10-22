/**
 * Test d'intégration de l'assemblage de « Modifier l'habitude » (story #6) : les vraies routes de
 * `src/app` (onglets Journée et Semaine), une vraie base SQLite (node:sqlite à la place
 * d'expo-sqlite) et l'horloge du téléphone fixée par de faux timers au mercredi 14 octobre 2026.
 * Aucune route ni prop nouvelle : la Vue Journée et la Vue Semaine portent la modification (nom et
 * difficulté, #23) et la suppression ; ce test vérifie qu'elles restent cohérentes entre elles et
 * après une relance.
 */
import { cleanup, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import path from 'node:path';

import { FixedClock } from '../../src/adapters/device/clock/FixedClock';
import { openAscentDatabase } from '../../src/adapters/persistence/sqlite/openAscentDatabase';
import { prepareAscentDatabase } from '../../src/adapters/persistence/sqlite/prepareAscentDatabase';
import type { SqlDatabase } from '../../src/adapters/persistence/sqlite/SqlDatabase';
import { SqliteUnitOfWork } from '../../src/adapters/persistence/sqlite/SqliteUnitOfWork';
import { openNodeSqliteDatabase } from '../../src/adapters/persistence/testing/nodeSqliteDatabase';
import { createHabit } from '../../src/application/useCases/createHabit';
import { toggleCheckIn } from '../../src/application/useCases/toggleCheckIn';
import { Day } from '../../src/domain/day/Day';

jest.mock('../../src/adapters/persistence/sqlite/openAscentDatabase', () => ({
  openAscentDatabase: jest.fn(),
}));

const openDatabase = jest.mocked(openAscentDatabase);
// Chemin absolu : sous StrykerJS, les routes doivent être chargées depuis son bac à sable.
const appDirectory = path.resolve(__dirname, '../../src/app');
const TODAY = 'mercredi 14 octobre';
const OTHER_HABITS = ['Lire', 'Marcher', 'Méditer', 'Courir', 'Dormir', 'Ranger', 'Écrire'];

/**
 * Une base avec « Cuisiner », créée le lundi 12 octobre, « fait » aujourd’hui et, par une correction, lundi (20 XP),
 * et, si `full`, neuf autres habitudes : la limite de 10 est atteinte.
 */
async function databaseWithCooking({ full }: { full: boolean }): Promise<SqlDatabase> {
  const db = await prepareAscentDatabase(openNodeSqliteDatabase());
  const monday = Day.of(2026, 10, 12);
  const unitOfWork = new SqliteUnitOfWork(db);
  const created = await createHabit({ clock: new FixedClock(monday), unitOfWork }, 'Cuisiner');
  if (!created.ok) {
    throw new Error('« Cuisiner » n’a pas pu être créée');
  }
  const today = new FixedClock(Day.of(2026, 10, 14));
  await toggleCheckIn({ clock: today, unitOfWork }, created.habit.id, monday);
  await toggleCheckIn({ clock: today, unitOfWork }, created.habit.id, Day.of(2026, 10, 14));
  if (full) {
    for (const name of [...OTHER_HABITS, 'Jardiner', 'Coder']) {
      await createHabit({ clock: today, unitOfWork }, name);
    }
  }
  return db;
}

const dayView = () => within(screen.getByTestId('day-view'));
const weekView = () => within(screen.getByTestId('week-view'));
const xpShown = () => screen.getByTestId('xp-counter').props.children as string;

async function showTab(label: 'Journée' | 'Semaine'): Promise<void> {
  await fireEvent.press(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: label }));
}

async function openEditing(name: string): Promise<void> {
  await fireEvent.press(await dayView().findByLabelText(`Modifier l’habitude ${name}`));
  expect(await screen.findByTestId('edit-habit-sheet')).toBeOnTheScreen();
}

async function deleteFromDayView(name: string): Promise<void> {
  await openEditing(name);
  await fireEvent.press(screen.getByTestId('delete-habit'));
  const dialog = await screen.findByTestId('delete-habit-dialog');
  expect(within(dialog).getByText(/\(−10 XP\)\.$/u)).toBeOnTheScreen();
  await fireEvent.press(within(dialog).getByTestId('confirm-delete-habit'));
}

describe('app editing of a habit', () => {
  let db: SqlDatabase;

  beforeEach(() => {
    openDatabase.mockReset();
    // renderRouter active ses propres faux timers en gardant l'heure système fixée ici.
    jest.useFakeTimers({ now: new Date(2026, 9, 14, 9, 0) });
  });

  it('renames a habit from the day view, in the day and the week views, keeping its experience', async () => {
    db = await databaseWithCooking({ full: false });
    openDatabase.mockResolvedValue(db);
    await renderRouter(appDirectory);
    await dayView().findByLabelText(
      `Cuisiner, ${TODAY}, fait, 2 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
    );
    expect(xpShown()).toBe('20 XP');

    await openEditing('Cuisiner');
    const field = screen.getByTestId('edit-habit-name');
    await fireEvent.changeText(field, 'Cuisiner le soir');
    await fireEvent.press(screen.getByTestId('save-habit'));

    expect(
      await dayView().findByLabelText(
        `Cuisiner le soir, ${TODAY}, fait, 2 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).toBeOnTheScreen();
    expect(
      dayView().queryByLabelText(
        `Cuisiner, ${TODAY}, fait, 2 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).not.toBeOnTheScreen();
    expect(xpShown()).toBe('20 XP');

    await showTab('Semaine');

    expect(await weekView().findByLabelText(`Cuisiner le soir, ${TODAY}, fait`)).toBeOnTheScreen();
    expect(
      weekView().getByLabelText('Cuisiner le soir, lundi 12 octobre, fait, corrigé'),
    ).toBeOnTheScreen();
    expect(weekView().getByLabelText('Modifier l’habitude Cuisiner le soir')).toBeOnTheScreen();
    expect(xpShown()).toBe('20 XP');
  });

  it('changes the difficulty from the day view: the week is re-evaluated in both views, after a restart too', async () => {
    db = await databaseWithCooking({ full: false });
    openDatabase.mockResolvedValue(db);
    await renderRouter(appDirectory);
    await dayView().findByLabelText(
      `Cuisiner, ${TODAY}, fait, 2 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
    );
    expect(xpShown()).toBe('20 XP');

    await openEditing('Cuisiner');
    await fireEvent.press(screen.getByTestId('difficulty-option-hard'));
    expect(screen.getByTestId('difficulty-change-info')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('save-habit'));

    expect(
      await dayView().findByLabelText(
        `Cuisiner, ${TODAY}, fait, 2 sur 7 cette semaine, Difficile, 20 XP par suivi`,
      ),
    ).toBeOnTheScreen();
    // Le compteur de l'en-tête monte image par image : on lit l'expérience enregistrée affichée.
    expect(screen.getByLabelText('Expérience du personnage : 40 XP')).toBeOnTheScreen();
    expect(screen.getByTestId('toast')).toHaveTextContent('Habitude modifiée · +20 XP');

    await showTab('Semaine');
    expect(await weekView().findByTestId('week-difficulty-1')).toHaveTextContent('Difficile');
    expect(screen.getByLabelText('Expérience du personnage : 40 XP')).toBeOnTheScreen();

    await cleanup();
    openDatabase.mockResolvedValue(db);
    await renderRouter(appDirectory);
    expect(
      await dayView().findByLabelText(
        `Cuisiner, ${TODAY}, fait, 2 sur 7 cette semaine, Difficile, 20 XP par suivi`,
      ),
    ).toBeOnTheScreen();
    expect(xpShown()).toBe('40 XP');
  });

  it('deletes a habit done today from both views, removes today’s experience and frees the limit', async () => {
    db = await databaseWithCooking({ full: true });
    openDatabase.mockResolvedValue(db);
    await renderRouter(appDirectory);
    await dayView().findByLabelText(
      `Cuisiner, ${TODAY}, fait, 2 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
    );
    expect(dayView().getByText('10/10')).toBeOnTheScreen();
    expect(screen.getByTestId('add-habit')).toBeDisabled();
    expect(xpShown()).toBe('20 XP');

    await deleteFromDayView('Cuisiner');

    expect(await dayView().findByText('9/10')).toBeOnTheScreen();
    expect(
      dayView().queryByLabelText(
        `Cuisiner, ${TODAY}, fait, 2 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
      ),
    ).not.toBeOnTheScreen();
    expect(screen.queryByTestId('delete-habit-dialog')).not.toBeOnTheScreen();
    expect(screen.getByTestId('add-habit')).toBeEnabled();
    expect(screen.getByLabelText('Expérience du personnage : 10 XP')).toBeOnTheScreen();

    await showTab('Semaine');

    expect(await weekView().findByLabelText(`Lire, ${TODAY}, à faire`)).toBeOnTheScreen();
    expect(weekView().queryByLabelText(/^Cuisiner, /u)).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Expérience du personnage : 10 XP')).toBeOnTheScreen();
  });

  it('shows the empty day view once the last habit is deleted, and remembers it after a restart', async () => {
    db = await databaseWithCooking({ full: false });
    openDatabase.mockResolvedValue(db);
    await renderRouter(appDirectory);
    await dayView().findByLabelText(
      `Cuisiner, ${TODAY}, fait, 2 sur 7 cette semaine, Moyenne, 10 XP par suivi`,
    );

    await deleteFromDayView('Cuisiner');

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(screen.getByLabelText('Expérience du personnage : 10 XP')).toBeOnTheScreen();
    await cleanup();

    await renderRouter(appDirectory);

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(screen.getByLabelText('Expérience du personnage : 10 XP')).toBeOnTheScreen();
    await showTab('Semaine');
    expect(await screen.findByTestId('week-view-empty')).toBeOnTheScreen();
  });
});
