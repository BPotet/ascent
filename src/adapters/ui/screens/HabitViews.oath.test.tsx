// Une habitude qui tient un Serment (#237, maquette 232 : S13) : la Vue Journée porte
// « Serment · Représailles » sous son nom, et la fenêtre de suppression, ouverte de la Vue Journée
// comme de la Vue Semaine, dit que le Serment sera rompu, sans bloquer.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { CAMP_KEY } from '../../../application/useCases/CampSession';
import { createHabit } from '../../../application/useCases/createHabit';
import { OATHS_KEY } from '../../../application/useCases/oaths';
import { Day } from '../../../domain/day/Day';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { reduceMotionInEachTest } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { DayViewScreen } from './DayViewScreen';
import { WeekViewScreen } from './WeekViewScreen';

reduceMotionInEachTest();

const DELETE_LINE =
  'Elle tient le Serment de Représailles : il sera rompu, et Représailles coûtera 2 Élan.';

let dependencies: {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  haptics: { success: jest.Mock };
};

/** « Courir » liée à Représailles, débloqué, et « Lire » sans Serment. */
beforeEach(async () => {
  dependencies = {
    clock: settableClock(Day.of(2026, 10, 14)),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    haptics: { success: jest.fn() },
  };
  await createHabit(dependencies, 'Courir');
  await createHabit(dependencies, 'Lire');
  dependencies.keyValueStore.values.set(
    CAMP_KEY,
    JSON.stringify({ version: 1, unlocks: [], powers: [{ power: 'retaliation', price: 30 }] }),
  );
  dependencies.keyValueStore.values.set(
    OATHS_KEY,
    JSON.stringify({
      version: 1,
      oaths: [{ power: 'retaliation', habit: 1, since: '2026-10-01' }],
    }),
  );
});

async function askDeletion(name: string) {
  await fireEvent.press(screen.getByRole('button', { name: `Modifier l’habitude ${name}` }));
  await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));
  await screen.findByTestId('delete-habit-dialog');
}

describe('the Day View and a habit that holds an Oath (#237)', () => {
  it('shows « Serment · Représailles » on the line of the habit only', async () => {
    await renderScreen(<DayViewScreen />, dependencies);

    expect(await screen.findByTestId('habit-oath-1')).toHaveTextContent('Serment · Représailles');
    expect(screen.queryByTestId('habit-oath-2')).not.toBeOnTheScreen();
  });

  it('warns that the Oath will be broken, then deletes the habit and its line', async () => {
    await renderScreen(<DayViewScreen />, dependencies);
    await screen.findByTestId('habit-oath-1');

    await askDeletion('Courir');
    expect(screen.getByText(DELETE_LINE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(screen.queryByText('Courir')).not.toBeOnTheScreen());
    expect(dependencies.keyValueStore.values.get(OATHS_KEY)).toContain('"habit":1');
  });

  it('says nothing of an Oath for a habit without one', async () => {
    await renderScreen(<DayViewScreen />, dependencies);
    await screen.findByTestId('habit-oath-1');

    await askDeletion('Lire');
    expect(screen.queryByText(DELETE_LINE)).not.toBeOnTheScreen();
  });

  it('shows no Oath when the Oaths cannot be read', async () => {
    dependencies.keyValueStore.values.set(OATHS_KEY, '{oops');
    await renderScreen(<DayViewScreen />, dependencies);
    await screen.findByText('Courir');
    await act(async () => undefined);

    expect(screen.queryByTestId('habit-oath-1')).not.toBeOnTheScreen();
  });
});

describe('the Week View and a habit that holds an Oath (#237)', () => {
  it('warns as well that the Oath will be broken', async () => {
    await renderScreen(<WeekViewScreen />, dependencies);
    await screen.findAllByText('Courir');
    await act(async () => undefined);

    await askDeletion('Courir');
    expect(await screen.findByText(DELETE_LINE)).toBeOnTheScreen();
  });
});
