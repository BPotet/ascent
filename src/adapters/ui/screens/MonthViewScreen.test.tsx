import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { deleteHabit } from '../../../application/useCases/deleteHabit';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { Character } from '../../../domain/character/Character';
import { Day } from '../../../domain/day/Day';
import type { HabitId } from '../../../domain/habit/Habit';
import { useTrackingChanges } from '../state/TrackingRevision';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { reduceMotionInEachTest } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { BACK_TO_CURRENT_MONTH, MONTH_HINT, MonthViewScreen } from './MonthViewScreen';

const october = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
const wednesday = october(14);

let dependencies: {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  haptics: { success: jest.Mock };
};

reduceMotionInEachTest();

beforeEach(() => {
  dependencies = {
    clock: settableClock(wednesday),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    haptics: { success: jest.fn() },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function habitCreatedOn(day: Day, name: string): Promise<HabitId> {
  dependencies.clock.setToday(day);
  const outcome = await createHabit(dependencies, name);
  dependencies.clock.setToday(wednesday);
  if (!outcome.ok) {
    throw new Error(`${name} not created`);
  }
  return outcome.habit.id;
}

async function doneOn(habit: HabitId, day: Day) {
  dependencies.clock.setToday(day);
  await toggleCheckIn(dependencies, habit, day);
  dependencies.clock.setToday(wednesday);
}

/** Le contexte de `features/month-view.feature`. */
async function givenTheBackground() {
  const cooking = await habitCreatedOn(october(5), 'Cuisiner');
  const budget = await habitCreatedOn(october(13), 'Budget du jour');
  await doneOn(cooking, october(12));
  await doneOn(cooking, october(13));
  await doneOn(budget, october(13));
  return { cooking, budget };
}

/** Une autre vue, qui enregistre un changement et le signale. */
function OtherView({ change }: { readonly change: () => Promise<unknown> }) {
  const changed = useTrackingChanges(() => undefined);
  return (
    <Pressable onPress={() => void change().then(changed)}>
      <Text>Changer ailleurs</Text>
    </Pressable>
  );
}

async function show(onAddHabit?: () => void) {
  await renderScreen(
    onAddHabit ? <MonthViewScreen onAddHabit={onAddHabit} /> : <MonthViewScreen />,
    dependencies,
  );
  await waitFor(() =>
    expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen(),
  );
}

const dayCell = (day: Day) => screen.getByTestId(`month-day-${day.toIsoString()}`);
const labelOf = (day: Day) => dayCell(day).props.accessibilityLabel as string;
const previousButton = () => screen.getByRole('button', { name: 'Mois précédent' });
const nextButton = () => screen.getByRole('button', { name: 'Mois suivant' });
const shownMonth = () =>
  screen.getByLabelText(/^[A-ZÉ][a-zéû]+ \d{4}/u).props.accessibilityLabel as string;

describe('MonthViewScreen', () => {
  it('shows a loading state while the month is read', async () => {
    let read: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      read = resolve;
    });
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => reading.then(() => run(work)));

    await renderScreen(<MonthViewScreen />, dependencies);

    expect(screen.getByLabelText('Chargement de tes habitudes')).toBeBusy();
    await act(async () => read());
    expect(await screen.findByText('Ton mois est vide')).toBeOnTheScreen();
  });

  it('opens on the current month, its weeks from Monday to Sunday, today framed', async () => {
    await givenTheBackground();

    await show();

    expect(shownMonth()).toBe('Octobre 2026, ce mois-ci');
    expect(screen.getByText('Octobre 2026')).toBeOnTheScreen();
    expect(screen.getByText('Ce mois-ci')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^month-day-/u)).toHaveLength(31);
    expect(labelOf(wednesday)).toBe('mercredi 14 octobre, aujourd’hui, 0 habitude faite sur 2');
    expect(dayCell(wednesday)).toHaveStyle({ borderColor: '#7C9CFF' });
    expect(screen.getByText(MONTH_HINT)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: BACK_TO_CURRENT_MONTH })).toBeNull();
  });

  it('shows the counter of each day, the neutral days and the days to come', async () => {
    await givenTheBackground();

    await show();

    expect(labelOf(october(12))).toBe('lundi 12 octobre, 1 habitude faite sur 1');
    expect(labelOf(october(13))).toBe('mardi 13 octobre, 2 habitudes faites sur 2');
    expect(within(dayCell(october(13))).getByText('2/2')).toBeOnTheScreen();
    for (const dayOfMonth of [1, 2, 3, 4]) {
      expect(labelOf(october(dayOfMonth))).toMatch(/, aucune habitude active$/u);
    }
    for (let dayOfMonth = 15; dayOfMonth <= 31; dayOfMonth += 1) {
      expect(labelOf(october(dayOfMonth))).toMatch(/, à venir$/u);
    }
    expect(screen.queryByRole('button', { name: /à venir/u })).toBeNull();
  });

  it('opens a day and corrects it: the month shows the counter and the mark « corrigé »', async () => {
    await givenTheBackground();
    await dependencies.unitOfWork.run(({ character }) => character.save(new Character(30)));
    await show();
    await waitFor(() => expect(screen.getByText('30 XP')).toBeOnTheScreen());

    await fireEvent.press(dayCell(october(8)));
    expect(screen.getByRole('header', { name: 'Jeudi 8 octobre' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: /^Cuisiner, jeudi 8 octobre/u }));

    await waitFor(() =>
      expect(labelOf(october(8))).toBe('jeudi 8 octobre, 1 habitude faite sur 1, corrigé'),
    );
    expect(screen.getByText('40 XP')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('header', { name: 'Jeudi 8 octobre' })).toBeNull();
  });

  it('goes back to the start of the history, then to the current month', async () => {
    await givenTheBackground();
    await habitCreatedOn(Day.of(2026, 9, 21), 'Lire');
    await show();
    expect(nextButton()).toBeDisabled();

    await fireEvent.press(previousButton());

    await waitFor(() => expect(shownMonth()).toBe('Septembre 2026, début de l’historique'));
    expect(screen.getByText('Début de l’historique')).toBeOnTheScreen();
    expect(previousButton()).toBeDisabled();
    expect(nextButton()).toBeEnabled();
    expect(labelOf(Day.of(2026, 9, 20))).toBe('dimanche 20 septembre, aucune habitude active');
    expect(labelOf(Day.of(2026, 9, 21))).toBe('lundi 21 septembre, 0 habitude faite sur 1');

    await fireEvent.press(screen.getByRole('button', { name: BACK_TO_CURRENT_MONTH }));

    await waitFor(() => expect(shownMonth()).toBe('Octobre 2026, ce mois-ci'));
  });

  it('shows a month in the middle of the history without subtitle', async () => {
    await givenTheBackground();
    await habitCreatedOn(Day.of(2026, 8, 3), 'Lire');
    await show();

    await fireEvent.press(previousButton());

    await waitFor(() => expect(shownMonth()).toBe('Septembre 2026'));
    expect(previousButton()).toBeEnabled();
    await fireEvent.press(nextButton());
    await waitFor(() => expect(shownMonth()).toBe('Octobre 2026, ce mois-ci'));
  });

  it('shows the experience of the character on a past month (R24)', async () => {
    await givenTheBackground();
    await habitCreatedOn(Day.of(2026, 9, 21), 'Lire');
    await dependencies.unitOfWork.run(({ character }) => character.save(new Character(40)));
    await show();

    await fireEvent.press(previousButton());

    await waitFor(() => expect(shownMonth()).toMatch(/^Septembre 2026/u));
    expect(screen.getByLabelText('Expérience du personnage : 40 XP')).toBeOnTheScreen();
  });

  it('recomputes the history when a habit is deleted in another view', async () => {
    await givenTheBackground();
    const reading = await habitCreatedOn(Day.of(2026, 9, 21), 'Lire');
    await renderScreen(
      <>
        <OtherView change={() => deleteHabit(dependencies, reading)} />
        <MonthViewScreen />
      </>,
      dependencies,
    );
    await waitFor(() => expect(previousButton()).toBeEnabled());

    await fireEvent.press(screen.getByText('Changer ailleurs'));

    await waitFor(() => expect(previousButton()).toBeDisabled());
    expect(labelOf(october(12))).toBe('lundi 12 octobre, 1 habitude faite sur 1');
  });

  it('shows an empty month, without navigation, when there is no habit', async () => {
    const onAddHabit = jest.fn();

    await show(onAddHabit);

    expect(screen.getByText('Ton mois est vide')).toBeOnTheScreen();
    expect(shownMonth()).toBe('Octobre 2026, ce mois-ci');
    expect(previousButton()).toBeDisabled();
    expect(nextButton()).toBeDisabled();
    expect(screen.queryByTestId('month-grid')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une habitude' }));
    expect(onAddHabit).toHaveBeenCalled();
  });

  it('offers no creation in the empty month without a way to create', async () => {
    await show();

    expect(screen.getByText('Ton mois est vide')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ajouter une habitude' })).toBeNull();
  });

  it('shows the grid as soon as there is a habit, even created later in the month', async () => {
    await habitCreatedOn(wednesday, 'Cuisiner');

    await show();

    expect(screen.queryByText('Ton mois est vide')).toBeNull();
    expect(labelOf(october(1))).toBe('jeudi 1 octobre, aucune habitude active');
  });

  it('shows the grid of a past month where as many habits are active as created later', async () => {
    await habitCreatedOn(Day.of(2026, 8, 3), 'Lire');
    await habitCreatedOn(october(5), 'Cuisiner');
    await show();

    await fireEvent.press(previousButton());

    await waitFor(() => expect(shownMonth()).toBe('Septembre 2026'));
    expect(screen.queryByText('Ton mois est vide')).toBeNull();
    expect(labelOf(Day.of(2026, 9, 15))).toBe('mardi 15 septembre, 0 habitude faite sur 1');
  });

  it('shows the error state, and reads the month again with « Réessayer »', async () => {
    await givenTheBackground();
    dependencies.unitOfWork.failReads();

    await show();

    expect(
      screen.getByRole('alert', {
        name: 'Impossible de charger tes habitudes. Une erreur est survenue en lisant tes données sur ce téléphone.',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: BACK_TO_CURRENT_MONTH })).toBeNull();

    dependencies.unitOfWork.failReads(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(shownMonth()).toBe('Octobre 2026, ce mois-ci'));
    expect(labelOf(october(13))).toBe('mardi 13 octobre, 2 habitudes faites sur 2');
    expect(screen.getByText('30 XP')).toBeOnTheScreen();
  });

  it('offers to go back to the current month when a past month cannot be read', async () => {
    await givenTheBackground();
    await habitCreatedOn(Day.of(2026, 9, 21), 'Lire');
    await show();
    dependencies.unitOfWork.failReads();

    await fireEvent.press(previousButton());
    await waitFor(() => expect(screen.getByTestId('month-view-error')).toBeOnTheScreen());
    dependencies.unitOfWork.failReads(false);
    await fireEvent.press(screen.getByRole('button', { name: BACK_TO_CURRENT_MONTH }));

    await waitFor(() => expect(shownMonth()).toBe('Octobre 2026, ce mois-ci'));
  });
});
