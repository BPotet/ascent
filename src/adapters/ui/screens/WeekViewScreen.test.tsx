import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Text } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { getDayView } from '../../../application/useCases/getDayView';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { Day } from '../../../domain/day/Day';
import type { HabitId } from '../../../domain/habit/Habit';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { renderScreen } from '../testing/renderScreen';
import { useTrackingChanges } from '../state/TrackingRevision';
import { WeekViewScreen } from './WeekViewScreen';

const october = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
const wednesday = october(14);

let dependencies: {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
};
let cooking: HabitId;
let budget: HabitId;

beforeEach(() => {
  dependencies = {
    clock: settableClock(wednesday),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Crée une habitude le jour donné. */
async function habitCreatedOn(day: Day, name: string): Promise<HabitId> {
  dependencies.clock.setToday(day);
  const outcome = await createHabit(dependencies, name);
  dependencies.clock.setToday(wednesday);
  if (!outcome.ok) {
    throw new Error(`${name} not created`);
  }
  return outcome.habit.id;
}

/** Enregistre « fait » le jour même. */
async function doneOn(habit: HabitId, day: Day) {
  dependencies.clock.setToday(day);
  await toggleCheckIn(dependencies, habit, day);
  dependencies.clock.setToday(wednesday);
}

/** Le contexte de `features/week-view.feature`. */
async function givenTheBackground() {
  cooking = await habitCreatedOn(october(5), 'Cuisiner');
  budget = await habitCreatedOn(october(13), 'Budget du jour');
  await doneOn(cooking, october(8));
  await doneOn(cooking, october(12));
}

async function show(onAddHabit?: () => void) {
  await renderScreen(
    onAddHabit ? <WeekViewScreen onAddHabit={onAddHabit} /> : <WeekViewScreen />,
    dependencies,
  );
  await waitFor(() =>
    expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen(),
  );
}

const cell = (habit: HabitId, day: Day) => screen.getByTestId(`cell-${habit}-${day.toIsoString()}`);
const labelOf = (habit: HabitId, day: Day) => cell(habit, day).props.accessibilityLabel as string;
const previousButton = () => screen.getByRole('button', { name: 'Semaine précédente' });
const nextButton = () => screen.getByRole('button', { name: 'Semaine suivante' });
const shownWeek = () =>
  screen.getByLabelText(/^(Cette semaine|Semaine dernière|Semaine du)/u).props
    .accessibilityLabel as string;

describe('WeekViewScreen', () => {
  it('shows a loading state while the week is read', async () => {
    let read: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      read = resolve;
    });
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => reading.then(() => run(work)));

    await renderScreen(<WeekViewScreen />, dependencies);

    expect(screen.getByLabelText('Chargement de tes habitudes')).toBeBusy();
    const [slot] = screen.getAllByTestId('skeleton-cell', { includeHiddenElements: true });
    if (slot === undefined) {
      throw new Error('No skeleton cell');
    }
    await fireEvent(slot, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 35, height: 0 } },
    });
    expect(slot.children[0]).toHaveStyle({ width: '100%', height: 44 });
    await fireEvent(slot, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 50, height: 0 } },
    });
    expect(slot.children[0]).toHaveStyle({ width: '100%', height: 50 });
    await act(async () => read());
    expect(await screen.findByText('Ta semaine est vide')).toBeOnTheScreen();
  });

  it('opens on the current week, the habits in their order of creation, 7 cells each', async () => {
    await givenTheBackground();

    await show();

    expect(shownWeek()).toBe('Cette semaine, du lundi 12 octobre au dimanche 18 octobre');
    expect(screen.getByText('Cette semaine')).toBeOnTheScreen();
    expect(screen.getByText('12 – 18 oct.')).toBeOnTheScreen();
    const cards = screen.getAllByTestId(/^week-card-/u);
    expect(cards.map((card) => within(card).getAllByText(/.+/u)[0]?.props.children)).toEqual([
      'Cuisiner',
      'Budget du jour',
    ]);
    for (const card of cards) {
      expect(within(card).getAllByRole('switch')).toHaveLength(7);
    }
    expect(screen.getByTestId('weekday-2026-10-14', { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: '#7C9CFF',
    });
  });

  it('shows the five states of the check-ins, read in full', async () => {
    await givenTheBackground();

    await show();

    expect(labelOf(cooking, october(12))).toBe('Cuisiner, lundi 12 octobre, fait, indisponible');
    expect(labelOf(cooking, october(13))).toBe(
      'Cuisiner, mardi 13 octobre, pas fait, indisponible',
    );
    expect(labelOf(cooking, october(14))).toBe('Cuisiner, mercredi 14 octobre, à faire');
    expect(labelOf(cooking, october(15))).toBe('Cuisiner, jeudi 15 octobre, à venir, indisponible');
    expect(labelOf(budget, october(12))).toBe(
      'Budget du jour, lundi 12 octobre, hors habitude, indisponible',
    );
    expect(labelOf(budget, october(18))).toBe(
      'Budget du jour, dimanche 18 octobre, à venir, indisponible',
    );
    expect(screen.queryByRole('button', { name: 'Revenir à cette semaine' })).toBeNull();
  });

  it('confirms today from the week view, and the day view sees it', async () => {
    await givenTheBackground();
    await show();

    await fireEvent.press(cell(cooking, wednesday));

    await waitFor(() =>
      expect(labelOf(cooking, wednesday)).toBe('Cuisiner, mercredi 14 octobre, fait'),
    );
    expect(cell(cooking, wednesday)).toBeChecked();
    const day = await getDayView(dependencies);
    expect(day.habits.map(({ status }) => status)).toEqual(['done', 'pending']);
  });

  it('shows the other state at once, before the tap is saved, and says nothing when saved', async () => {
    await givenTheBackground();
    await show();
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => gate.then(() => run(work)));

    await fireEvent.press(cell(cooking, wednesday));

    expect(labelOf(cooking, wednesday)).toBe('Cuisiner, mercredi 14 octobre, fait');
    expect(labelOf(cooking, october(12))).toBe('Cuisiner, lundi 12 octobre, fait, indisponible');
    await act(async () => open());
    await waitFor(() => expect(cell(cooking, wednesday)).toBeChecked());
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('says nothing and shows the stored state when the tap is refused', async () => {
    await givenTheBackground();
    await show();
    jest.spyOn(dependencies.clock, 'today').mockReturnValue(october(13));

    await fireEvent.press(cell(cooking, wednesday));

    await waitFor(() =>
      expect(labelOf(cooking, wednesday)).toBe(
        'Cuisiner, mercredi 14 octobre, à venir, indisponible',
      ),
    );
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('comes back to « à faire » and offers « Réessayer » when the tap cannot be saved', async () => {
    await givenTheBackground();
    await show();
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(cell(cooking, wednesday));

    expect(await screen.findByText('Le suivi n’a pas été enregistré.')).toBeOnTheScreen();
    expect(labelOf(cooking, wednesday)).toBe('Cuisiner, mercredi 14 octobre, à faire');

    dependencies.unitOfWork.failWrites(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() =>
      expect(labelOf(cooking, wednesday)).toBe('Cuisiner, mercredi 14 octobre, fait'),
    );
  });

  it('records a tap just after midnight as a correction of the day shown', async () => {
    await givenTheBackground();
    await show();
    jest.spyOn(dependencies.clock, 'today').mockReturnValue(october(15));

    await fireEvent.press(cell(cooking, wednesday));

    expect(
      await screen.findByText(
        'Mercredi 14 octobre vient d’être clos : enregistré comme correction.',
      ),
    ).toBeOnTheScreen();
  });

  it.each([
    ['à venir', () => cell(cooking, october(15))],
    ['hors habitude', () => cell(budget, october(12))],
    ['pas fait (jour clos)', () => cell(cooking, october(13))],
  ])('does not react to a tap on a « %s » cell', async (_, target) => {
    await givenTheBackground();
    await show();
    const before = target().props.accessibilityLabel as string;
    const run = jest.spyOn(dependencies.unitOfWork, 'run');

    expect(target()).toBeDisabled();
    await fireEvent.press(target());

    expect(target().props.accessibilityLabel).toBe(before);
    expect(run).not.toHaveBeenCalled();
  });

  it('shows the previous week, then comes back to the current week', async () => {
    await givenTheBackground();
    await show();

    await fireEvent.press(previousButton());

    await waitFor(() =>
      expect(shownWeek()).toBe(
        'Semaine dernière, du lundi 5 octobre au dimanche 11 octobre, début de l’historique',
      ),
    );
    expect(screen.getByText('5 – 11 oct. · début de l’historique')).toBeOnTheScreen();
    expect(labelOf(cooking, october(8))).toBe('Cuisiner, jeudi 8 octobre, fait, indisponible');
    expect(labelOf(cooking, october(9))).toBe(
      'Cuisiner, vendredi 9 octobre, pas fait, indisponible',
    );
    for (const day of [5, 6, 7, 8, 9, 10, 11]) {
      expect(labelOf(budget, october(day))).toMatch(/, hors habitude, indisponible$/u);
    }
    expect(previousButton()).toBeDisabled();
    expect(nextButton()).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Revenir à cette semaine' }));

    await waitFor(() =>
      expect(shownWeek()).toBe('Cette semaine, du lundi 12 octobre au dimanche 18 octobre'),
    );
  });

  it('goes on to the next week until the current week', async () => {
    cooking = await habitCreatedOn(october(1), 'Cuisiner');
    await show();
    expect(nextButton()).toBeDisabled();
    expect(previousButton()).toBeEnabled();

    await fireEvent.press(previousButton());
    await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));
    await fireEvent.press(previousButton());
    await waitFor(() =>
      expect(shownWeek()).toBe(
        'Semaine du 28 sept., du lundi 28 septembre au dimanche 4 octobre, début de l’historique',
      ),
    );
    expect(screen.getByText('28 sept. – 4 oct. · début de l’historique')).toBeOnTheScreen();

    await fireEvent.press(nextButton());
    await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));
    await fireEvent.press(nextButton());
    await waitFor(() => expect(shownWeek()).toMatch(/^Cette semaine/u));
    expect(nextButton()).toBeDisabled();
  });

  it('keeps the actions disabled at the bounds of the history', async () => {
    await givenTheBackground();
    await show();
    expect(nextButton()).toBeDisabled();

    await fireEvent.press(nextButton());

    expect(shownWeek()).toMatch(/^Cette semaine/u);
  });

  it('shows the empty state of the current week only, without any habit', async () => {
    const onAddHabit = jest.fn();
    await show(onAddHabit);

    expect(shownWeek()).toBe('Cette semaine, du lundi 12 octobre au dimanche 18 octobre');
    expect(screen.getByTestId('week-view-empty')).toBeOnTheScreen();
    expect(screen.getByText('Elle se remplira dès ta première habitude.')).toBeOnTheScreen();
    expect(previousButton()).toBeDisabled();
    expect(nextButton()).toBeDisabled();
    expect(screen.queryByTestId(/^week-card-/u)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une habitude' }));
    expect(onAddHabit).toHaveBeenCalledTimes(1);
  });

  it('offers no add button in the empty state when the app gives no way to add', async () => {
    await show();

    expect(screen.queryByRole('button', { name: 'Ajouter une habitude' })).toBeNull();
  });

  it('follows the change of week at midnight on Sunday when it shows the current week', async () => {
    await givenTheBackground();
    dependencies.clock.setToday(october(18));
    await show();

    await act(async () => dependencies.clock.setToday(october(19)));

    await waitFor(() =>
      expect(shownWeek()).toBe('Cette semaine, du lundi 19 octobre au dimanche 25 octobre'),
    );
    expect(screen.queryByTestId('week-view-loading')).toBeNull();
  });

  it('keeps a week chosen in the past when today changes', async () => {
    await givenTheBackground();
    await show();
    await fireEvent.press(previousButton());
    await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));

    await act(async () => dependencies.clock.setToday(october(15)));

    await waitFor(() => expect(labelOf(cooking, october(8))).toMatch(/fait/u));
    expect(shownWeek()).toMatch(/du lundi 5 octobre/u);
  });

  it('shows a « fait » kept on a day that became upcoming (clock moved back), not changeable', async () => {
    await givenTheBackground();
    await doneOn(cooking, wednesday);
    dependencies.clock.setToday(october(13));

    await show();

    expect(labelOf(cooking, wednesday)).toBe('Cuisiner, mercredi 14 octobre, fait, indisponible');
    expect(cell(cooking, wednesday)).toBeDisabled();
    expect(cell(cooking, wednesday)).toHaveStyle({ opacity: 0.6 });
  });

  it('shows an error with « Réessayer », then can come back to the current week', async () => {
    await givenTheBackground();
    await show();
    dependencies.unitOfWork.failReads();

    await fireEvent.press(previousButton());

    expect(
      await screen.findByRole('alert', {
        name: 'Impossible de charger tes habitudes. Une erreur est survenue en lisant tes données sur ce téléphone.',
      }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('alert')).toBeOnTheScreen();

    dependencies.unitOfWork.failReads(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Revenir à cette semaine' }));

    await waitFor(() =>
      expect(shownWeek()).toBe('Cette semaine, du lundi 12 octobre au dimanche 18 octobre'),
    );
  });

  it('retries the same week after an error', async () => {
    await givenTheBackground();
    await show();
    dependencies.unitOfWork.failReads();
    await fireEvent.press(previousButton());
    await screen.findByRole('alert');

    dependencies.unitOfWork.failReads(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));
  });

  it('offers no way back when the current week itself cannot be read', async () => {
    await givenTheBackground();
    dependencies.unitOfWork.failReads();

    await show();

    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Revenir à cette semaine' })).toBeNull();
  });

  it('reloads after a change saved by another view', async () => {
    await givenTheBackground();
    let otherViewChanged: () => void = () => undefined;
    function OtherView() {
      otherViewChanged = useTrackingChanges(() => undefined);
      return <Text>Journée</Text>;
    }
    await renderScreen(
      <>
        <WeekViewScreen />
        <OtherView />
      </>,
      dependencies,
    );
    await waitFor(() =>
      expect(labelOf(cooking, wednesday)).toBe('Cuisiner, mercredi 14 octobre, à faire'),
    );

    await toggleCheckIn(dependencies, cooking, wednesday);
    await act(async () => otherViewChanged());

    await waitFor(() =>
      expect(labelOf(cooking, wednesday)).toBe('Cuisiner, mercredi 14 octobre, fait'),
    );
  });

  it('shows the legend of the five shapes', async () => {
    await givenTheBackground();
    await show();

    expect(screen.getByText('Hors habitude', { includeHiddenElements: true })).toBeTruthy();
  });
});
