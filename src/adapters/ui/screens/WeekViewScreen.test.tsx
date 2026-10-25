import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { deleteHabit } from '../../../application/useCases/deleteHabit';
import { getDayView } from '../../../application/useCases/getDayView';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { updateHabit } from '../../../application/useCases/updateHabit';
import { Day } from '../../../domain/day/Day';
import type { HabitId } from '../../../domain/habit/Habit';
import { Week } from '../../../domain/week/Week';
import { artPalette } from '../pixelArt/artPalette';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { useTrackingChanges } from '../state/TrackingRevision';
import { DayViewScreen } from './DayViewScreen';
import { WeekViewScreen } from './WeekViewScreen';

const october = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
const wednesday = october(14);

let dependencies: {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  haptics: { success: jest.Mock };
};

reduceMotionInEachTest();
let cooking: HabitId;
let budget: HabitId;

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
  const rendered = await renderScreen(
    onAddHabit ? <WeekViewScreen onAddHabit={onAddHabit} /> : <WeekViewScreen />,
    dependencies,
  );
  await waitFor(() =>
    expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen(),
  );
  return rendered;
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
    const slots = screen.getAllByTestId('skeleton-cell', { includeHiddenElements: true });
    expect(slots).toHaveLength(4 * 7);
    // Les cases du squelette prennent la place des vraies : colonnes de 48 dp, cases de 40 dp.
    expect(slots[0]).toHaveStyle({ width: 48, minHeight: 48 });
    expect(slots[0]?.children[0]).toHaveStyle({ width: 40, height: 40 });
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
      backgroundColor: artPalette.roles.gold,
    });
  });

  it('shows the five states of the check-ins, read in full', async () => {
    await givenTheBackground();

    await show();

    expect(labelOf(cooking, october(12))).toBe('Cuisiner, lundi 12 octobre, fait');
    expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, pas fait');
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
    expect(labelOf(cooking, october(12))).toBe('Cuisiner, lundi 12 octobre, fait');
    await act(async () => open());
    await waitFor(() => expect(cell(cooking, wednesday)).toBeChecked());
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('shows « à faire », not « pas fait », at once when today « fait » is touched', async () => {
    await givenTheBackground();
    await doneOn(cooking, wednesday);
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

    expect(labelOf(cooking, wednesday)).toBe('Cuisiner, mercredi 14 octobre, à faire');
    await act(async () => open());
    await waitFor(() =>
      expect(labelOf(cooking, wednesday)).toBe('Cuisiner, mercredi 14 octobre, à faire'),
    );
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
    ['à venir', () => cell(cooking, october(15)), null],
    [
      'hors habitude',
      () => cell(budget, october(12)),
      '« Budget du jour » commence le mardi 13 octobre.',
    ],
  ])('does not change a « %s » cell when touched (R12)', async (_, target, message) => {
    await givenTheBackground();
    await show();
    const before = target().props.accessibilityLabel as string;
    const run = jest.spyOn(dependencies.unitOfWork, 'run');

    expect(target()).toBeDisabled();
    await fireEvent.press(target());

    expect(target().props.accessibilityLabel).toBe(before);
    expect(run).not.toHaveBeenCalled();
    if (message === null) {
      expect(screen.queryByTestId('toast')).toBeNull();
    } else {
      expect(screen.getByText(message)).toBeOnTheScreen();
    }
  });

  describe('correction of a closed day (R10, R13)', () => {
    const storedCheckIn = (habit: HabitId, day: Day) =>
      dependencies.unitOfWork.run(({ checkIns }) => checkIns.find(habit, day));

    it('corrects « pas fait » into « fait », with the mark « corrigé »', async () => {
      await givenTheBackground();
      await show();

      await fireEvent.press(cell(cooking, october(13)));

      await waitFor(() =>
        expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, fait, corrigé'),
      );
      expect(cell(cooking, october(13))).toBeChecked();
      expect(
        within(cell(cooking, october(13))).getByTestId('corrected-mark', {
          includeHiddenElements: true,
        }),
      ).toBeTruthy();
      expect(screen.getByText('Correction enregistrée · mardi 13 octobre')).toBeOnTheScreen();
      await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('30 XP'));
      await expect(storedCheckIn(cooking, october(13))).resolves.toMatchObject({
        done: true,
        corrected: true,
      });
    });

    it('corrects « fait » into « pas fait », showing « pas fait » at once', async () => {
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

      await fireEvent.press(cell(cooking, october(12)));

      expect(labelOf(cooking, october(12))).toBe('Cuisiner, lundi 12 octobre, pas fait');
      await act(async () => open());
      await waitFor(() =>
        expect(labelOf(cooking, october(12))).toBe('Cuisiner, lundi 12 octobre, pas fait, corrigé'),
      );
      expect(screen.getByText('Correction enregistrée · lundi 12 octobre')).toBeOnTheScreen();
      await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('10 XP'));
    });

    it('takes the mark « corrigé » off when the cell comes back to its state at the closing', async () => {
      await givenTheBackground();
      await show();
      await fireEvent.press(cell(cooking, october(13)));
      await waitFor(() => expect(labelOf(cooking, october(13))).toMatch(/corrigé$/u));

      await fireEvent.press(cell(cooking, october(13)));

      await waitFor(() =>
        expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, pas fait'),
      );
      expect(
        within(cell(cooking, october(13))).queryByTestId('corrected-mark', {
          includeHiddenElements: true,
        }),
      ).toBeNull();
      expect(
        screen.getByText('Mardi 13 octobre revient à son état de la clôture.'),
      ).toBeOnTheScreen();
    });

    it('corrects a day of a previous week, without time limit', async () => {
      await givenTheBackground();
      await show();
      await fireEvent.press(previousButton());
      await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));

      await fireEvent.press(cell(cooking, october(9)));

      await waitFor(() =>
        expect(labelOf(cooking, october(9))).toBe('Cuisiner, vendredi 9 octobre, fait, corrigé'),
      );
      expect(shownWeek()).toMatch(/^Semaine dernière/u);
    });

    it('corrects the first day of the habit', async () => {
      await givenTheBackground();
      await show();

      await fireEvent.press(cell(budget, october(13)));

      await waitFor(() =>
        expect(labelOf(budget, october(13))).toBe(
          'Budget du jour, mardi 13 octobre, fait, corrigé',
        ),
      );
    });

    it('keeps « pas fait » without the mark and offers « Réessayer » when the correction cannot be saved', async () => {
      await givenTheBackground();
      await show();
      dependencies.unitOfWork.failWrites();

      await fireEvent.press(cell(cooking, october(13)));

      expect(await screen.findByText('La correction n’a pas été enregistrée.')).toBeOnTheScreen();
      expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, pas fait');
      await expect(storedCheckIn(cooking, october(13))).resolves.toBeNull();

      dependencies.unitOfWork.failWrites(false);
      await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

      await waitFor(() =>
        expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, fait, corrigé'),
      );
    });

    it('keeps « fait » with its mark « corrigé » when undoing a correction cannot be saved', async () => {
      await givenTheBackground();
      await show();
      await fireEvent.press(cell(cooking, october(13)));
      await waitFor(() =>
        expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, fait, corrigé'),
      );
      dependencies.unitOfWork.failWrites();

      await fireEvent.press(cell(cooking, october(13)));

      expect(await screen.findByText('La correction n’a pas été enregistrée.')).toBeOnTheScreen();
      expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, fait, corrigé');
      await expect(storedCheckIn(cooking, october(13))).resolves.toMatchObject({
        done: true,
        corrected: true,
      });
    });

    it('keeps « fait » without mark when correcting a day « fait » at its closing cannot be saved', async () => {
      await givenTheBackground();
      await show();
      dependencies.unitOfWork.failWrites();

      await fireEvent.press(cell(cooking, october(12)));

      expect(await screen.findByText('La correction n’a pas été enregistrée.')).toBeOnTheScreen();
      expect(labelOf(cooking, october(12))).toBe('Cuisiner, lundi 12 octobre, fait');
      await expect(storedCheckIn(cooking, october(12))).resolves.toMatchObject({
        done: true,
        corrected: false,
      });
    });

    it('follows two quick taps on a closed day back to its state at the closing, without mark', async () => {
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

      await fireEvent.press(cell(cooking, october(13)));
      expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, fait');
      await fireEvent.press(cell(cooking, october(13)));
      expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, pas fait');
      await act(async () => open());

      await waitFor(() =>
        expect(
          screen.getByText('Mardi 13 octobre revient à son état de la clôture.'),
        ).toBeOnTheScreen(),
      );
      expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, pas fait');
      await expect(storedCheckIn(cooking, october(13))).resolves.toBeNull();
    });

    it('explains under the legend that a past day can be corrected', async () => {
      await givenTheBackground();
      await show();

      expect(
        screen.getByText('Tape une case d’un jour passé pour corriger un oubli.'),
      ).toBeOnTheScreen();
    });
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
    expect(labelOf(cooking, october(8))).toBe('Cuisiner, jeudi 8 octobre, fait');
    expect(labelOf(cooking, october(9))).toBe('Cuisiner, vendredi 9 octobre, pas fait');
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

  describe('week requested by another view (« Corriger » of the yesterday reminder)', () => {
    const lastWeek = Week.containing(october(7));

    it('shows the week requested, and again at each new request', async () => {
      await givenTheBackground();
      const { rerender } = await renderScreen(
        <WeekViewScreen weekRequest={{ week: lastWeek, id: 1 }} />,
        dependencies,
      );
      await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));

      await fireEvent.press(screen.getByRole('button', { name: 'Revenir à cette semaine' }));
      await waitFor(() => expect(shownWeek()).toMatch(/^Cette semaine/u));
      await rerender(<WeekViewScreen weekRequest={{ week: lastWeek, id: 1 }} />);
      expect(shownWeek()).toMatch(/^Cette semaine/u);

      await rerender(<WeekViewScreen weekRequest={{ week: lastWeek, id: 2 }} />);
      await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));
    });

    it('follows the change of week when the week requested is the current week', async () => {
      await givenTheBackground();
      dependencies.clock.setToday(october(18));
      const { rerender } = await show();
      await fireEvent.press(previousButton());
      await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));

      await rerender(
        <WeekViewScreen weekRequest={{ week: Week.containing(october(18)), id: 1 }} />,
      );
      await waitFor(() => expect(shownWeek()).toMatch(/^Cette semaine/u));
      await act(async () => dependencies.clock.setToday(october(19)));

      await waitFor(() =>
        expect(shownWeek()).toBe('Cette semaine, du lundi 19 octobre au dimanche 25 octobre'),
      );
    });
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

describe('WeekViewScreen and the experience', () => {
  const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
  const xpBar = () => screen.getByTestId('character-bar');
  const xpChange = () => screen.queryByTestId('xp-change', { includeHiddenElements: true });
  const hasXp = (xp: string) =>
    waitFor(() => expect(xpBar()).toHaveAccessibleName(`Expérience du personnage : ${xp}`));

  beforeEach(() => announce.mockClear());

  it('shows the experience of the character in the header (R24)', async () => {
    await givenTheBackground();

    await show();

    await hasXp('20 XP');
    expect(screen.getByTestId('xp-counter')).toHaveTextContent('20 XP');
  });

  it('shows 0 XP above an empty week', async () => {
    await show();

    expect(screen.getByTestId('week-view-empty')).toBeOnTheScreen();
    await hasXp('0 XP');
  });

  it('shows the shape of the header while loading', async () => {
    jest.spyOn(dependencies.unitOfWork, 'run').mockReturnValue(new Promise(() => undefined));

    await renderScreen(<WeekViewScreen />, dependencies);

    expect(
      within(screen.getByTestId('week-view-loading')).getByTestId('character-bar-loading', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });

  it('earns 10 XP for a correction, as for a tap of today (R11)', async () => {
    await givenTheBackground();
    await show();
    await hasXp('20 XP');

    await fireEvent.press(cell(cooking, october(13)));

    await hasXp('30 XP');
    expect(xpChange()).toHaveTextContent('+10 XP');
    expect(dependencies.haptics.success).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      'Correction enregistrée, +10 points d’expérience. Total : 30 XP.',
    );
  });

  it('loses 10 XP when a correction comes back to the state at the closing', async () => {
    await givenTheBackground();
    await show();
    await fireEvent.press(cell(cooking, october(13)));
    await hasXp('30 XP');
    announce.mockClear();

    await fireEvent.press(cell(cooking, october(13)));

    await hasXp('20 XP');
    expect(xpChange()).toHaveTextContent('−10 XP');
    expect(dependencies.haptics.success).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('−10 points d’expérience. Total : 20 XP.');
  });

  it('changes no experience when the correction cannot be saved', async () => {
    await givenTheBackground();
    await show();
    await hasXp('20 XP');
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(cell(cooking, october(13)));

    await screen.findByText('La correction n’a pas été enregistrée.');
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP');
    expect(xpChange()).not.toBeOnTheScreen();
    expect(dependencies.haptics.success).not.toHaveBeenCalled();
  });

  it('lets « +10 XP » fly up from the corrected case', async () => {
    withMotion();
    await givenTheBackground();
    await show();
    await hasXp('20 XP');

    await fireEvent.press(cell(cooking, october(13)));

    await waitFor(() =>
      expect(
        within(cell(cooking, october(13))).getByTestId('xp-float', { includeHiddenElements: true }),
      ).toHaveTextContent('+10 XP'),
    );
    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('30 XP'));
  });

  it('shows the same experience in the day view after a tap in the week view', async () => {
    await givenTheBackground();
    await renderScreen(
      <>
        <DayViewScreen />
        <WeekViewScreen />
      </>,
      dependencies,
    );
    await waitFor(() => expect(screen.getAllByTestId('character-bar')).toHaveLength(2));

    await fireEvent.press(cell(cooking, wednesday));

    await waitFor(() =>
      expect(
        screen.getAllByTestId('character-bar').map((bar) => bar.props.accessibilityLabel),
      ).toEqual(['Expérience du personnage : 30 XP', 'Expérience du personnage : 30 XP']),
    );
    // L'en-tête du personnage en pixel art, plus bas dans la Vue Semaine (#72).
    expect(screen.getAllByTestId('character-bar').map((bar) => bar.props.style)).toEqual([
      expect.arrayContaining([{ minHeight: 132 }]),
      expect.arrayContaining([{ minHeight: 92 }]),
    ]);
  });

  it('reads the experience again with « Réessayer »', async () => {
    await givenTheBackground();
    dependencies.unitOfWork.failReads();
    await renderScreen(<WeekViewScreen />, dependencies);
    await screen.findByTestId('week-view-error');
    dependencies.unitOfWork.failReads(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await hasXp('20 XP');
  });
});

describe('WeekViewScreen and editing a habit', () => {
  const nbsp = ' ';
  const editName = (name: string) =>
    screen.getByRole('button', { name: `Modifier l’habitude ${name}` });
  const nameField = () => screen.getByLabelText('Nom de l’habitude');

  async function askDeletion(name = 'Cuisiner') {
    await fireEvent.press(editName(name));
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));
    await screen.findByTestId('delete-habit-dialog');
  }

  describe('and its difficulty', () => {
    const option = (name: string) =>
      screen.getByRole('radio', { name: new RegExp(`^${name},`, 'u') });

    /** Le fond, puis « Cuisiner » passée en Difficile aujourd'hui (mercredi 14). */
    async function givenCookingHardThisWeek() {
      await givenTheBackground();
      await updateHabit(dependencies, cooking, { name: 'Cuisiner', difficulty: 'hard' });
    }

    it('shows on each card the difficulty of the week shown (E4)', async () => {
      await givenCookingHardThisWeek();
      await show();

      expect(screen.getByTestId(`week-difficulty-${cooking}`)).toHaveTextContent('Difficile');
      expect(screen.getByTestId(`week-difficulty-${budget}`)).toHaveTextContent('Moyenne');

      await fireEvent.press(previousButton());

      await waitFor(() =>
        expect(screen.getByTestId(`week-difficulty-${cooking}`)).toHaveTextContent('Moyenne'),
      );
    });

    it('re-evaluates the current week from « Modifier l’habitude »', async () => {
      await givenTheBackground();
      await show();
      await fireEvent.press(editName('Cuisiner'));

      expect(option('Moyenne')).toBeChecked();
      await fireEvent.press(option('Difficile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() =>
        expect(screen.getByTestId('toast')).toHaveTextContent('Habitude modifiée · +10 XP'),
      );
      expect(screen.getByTestId(`week-difficulty-${cooking}`)).toHaveTextContent('Difficile');
      expect(screen.getByTestId(`week-card-highlight-${cooking}`)).toBeOnTheScreen();
      expect(screen.getByTestId('character-bar')).toHaveAccessibleName(
        'Expérience du personnage : 30 XP',
      );
    });

    it('opens with the settings of the current week shown, without reading them again', async () => {
      await givenCookingHardThisWeek();
      await show();
      dependencies.unitOfWork.failReads();

      await fireEvent.press(editName('Cuisiner'));

      expect(await screen.findByTestId('edit-habit-sheet')).toBeOnTheScreen();
      expect(option('Difficile')).toBeChecked();
    });

    it('prefills the difficulty of the habit opened, not of another one', async () => {
      await givenCookingHardThisWeek();
      await show();

      await fireEvent.press(editName('Budget du jour'));

      expect(await screen.findByTestId('edit-habit-sheet')).toBeOnTheScreen();
      expect(option('Moyenne')).toBeChecked();
    });

    it('prefills the difficulty of the current week when another week is shown', async () => {
      await givenCookingHardThisWeek();
      await show();
      await fireEvent.press(previousButton());
      await waitFor(() =>
        expect(screen.getByTestId(`week-difficulty-${cooking}`)).toHaveTextContent('Moyenne'),
      );

      await fireEvent.press(editName('Cuisiner'));

      expect(await screen.findByRole('header', { name: 'Modifier l’habitude' })).toBeOnTheScreen();
      expect(option('Difficile')).toBeChecked();
      expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    });

    it('says the habit could not be opened when its settings cannot be read', async () => {
      await givenCookingHardThisWeek();
      await show();
      await fireEvent.press(previousButton());
      await screen.findByText('Semaine dernière');
      dependencies.unitOfWork.failReads();

      await fireEvent.press(editName('Cuisiner'));

      await waitFor(() =>
        expect(screen.getByTestId('toast')).toHaveTextContent(
          'L’habitude n’a pas pu être ouverte. Réessaie.',
        ),
      );
      expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    });

    it('reloads instead of opening a habit deleted in the meantime', async () => {
      await givenCookingHardThisWeek();
      await show();
      await fireEvent.press(previousButton());
      await screen.findByText('Semaine dernière');
      await deleteHabit(dependencies, budget);

      await fireEvent.press(editName('Budget du jour'));

      await waitFor(() => expect(screen.queryByText('Budget du jour')).not.toBeOnTheScreen());
      expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
      expect(screen.queryByText('L’habitude n’a pas pu être ouverte. Réessaie.')).toBeNull();
    });
  });

  it('opens « Modifier l’habitude » from the name of a habit', async () => {
    await givenTheBackground();
    await show();

    await fireEvent.press(editName('Cuisiner'));

    expect(screen.getByRole('header', { name: 'Modifier l’habitude' })).toBeOnTheScreen();
    expect(nameField()).toHaveDisplayValue('Cuisiner');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('renames a habit, highlights its card for a while, and keeps its check-ins', async () => {
    jest.useFakeTimers();
    try {
      await givenTheBackground();
      await show();
      await fireEvent.press(editName('Cuisiner'));

      await fireEvent.changeText(nameField(), 'Cuisiner maison');
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() =>
        expect(labelOf(cooking, october(12))).toBe('Cuisiner maison, lundi 12 octobre, fait'),
      );
      expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
      expect(screen.getByTestId(`week-card-highlight-${cooking}`)).toBeOnTheScreen();
      expect(screen.getByTestId('toast')).toHaveTextContent('Habitude renommée');

      await act(() => jest.advanceTimersByTime(1800));

      expect(screen.queryByTestId(`week-card-highlight-${cooking}`)).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('refuses the name of another habit', async () => {
    await givenTheBackground();
    await show();
    await fireEvent.press(editName('Cuisiner'));

    await fireEvent.changeText(nameField(), 'budget du jour');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByRole('alert', {
        name: `Tu as déjà une habitude «${nbsp}Budget du jour${nbsp}».`,
      }),
    ).toBeOnTheScreen();
  });

  it('deletes a habit: it disappears, and the history starts with the oldest one left', async () => {
    await givenTheBackground();
    await show();
    await fireEvent.press(previousButton());
    await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));
    await askDeletion();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() =>
      expect(shownWeek()).toBe('Cette semaine, du lundi 12 octobre au dimanche 18 octobre'),
    );
    expect(screen.queryByText('Cuisiner')).not.toBeOnTheScreen();
    expect(screen.getByText('Budget du jour')).toBeOnTheScreen();
    expect(previousButton()).toBeDisabled();
    expect(screen.getByTestId('toast')).toHaveTextContent('Habitude supprimée');
    expect(screen.getByTestId('toast')).not.toHaveTextContent('XP');
    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('20 XP'));
  });

  it('shows the empty week once the last habit is deleted', async () => {
    cooking = await habitCreatedOn(october(12), 'Cuisiner');
    await show();
    await askDeletion();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    expect(await screen.findByTestId('week-view-empty')).toBeOnTheScreen();
  });

  it('removes the habit from the day view too, with the experience of today', async () => {
    await givenTheBackground();
    await doneOn(cooking, wednesday);
    await renderScreen(
      <>
        <DayViewScreen />
        <WeekViewScreen />
      </>,
      dependencies,
    );
    await waitFor(() =>
      expect(
        screen.getAllByTestId('character-bar').map((bar) => bar.props.accessibilityLabel),
      ).toEqual(['Expérience du personnage : 30 XP', 'Expérience du personnage : 30 XP']),
    );
    // Le premier est « ⋯ » dans la Journée, le second le nom dans la Semaine.
    const [, weekEdit] = screen.getAllByRole('button', { name: 'Modifier l’habitude Cuisiner' });
    await fireEvent.press(weekEdit as NonNullable<typeof weekEdit>);
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));
    expect(await screen.findByText(/\(−10 XP\)\.$/u)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(screen.queryAllByText('Cuisiner')).toEqual([]));
    await waitFor(() =>
      expect(
        screen.getAllByTestId('character-bar').map((bar) => bar.props.accessibilityLabel),
      ).toEqual(['Expérience du personnage : 20 XP', 'Expérience du personnage : 20 XP']),
    );
    expect(screen.queryByRole('switch', { name: /^Cuisiner,/u })).not.toBeOnTheScreen();
  });

  it('closes « Modifier l’habitude » with « Annuler », changing nothing', async () => {
    await givenTheBackground();
    await show();
    await fireEvent.press(editName('Cuisiner'));

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(screen.getByText('Cuisiner')).toBeOnTheScreen();
  });

  it('reloads and closes everything when the habit was deleted meanwhile', async () => {
    await givenTheBackground();
    await show();
    await fireEvent.press(editName('Cuisiner'));
    await deleteHabit(dependencies, cooking);

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));

    await waitFor(() => expect(screen.queryByText('Cuisiner')).not.toBeOnTheScreen());
    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('delete-habit-dialog')).not.toBeOnTheScreen();
  });
});

describe('WeekViewScreen and the weekly target (E4)', () => {
  const chip = (habit: HabitId) => screen.queryByTestId(`week-progress-${habit}`);
  const targetLine = (habit: HabitId) => screen.getByTestId(`week-target-${habit}`);

  it('keeps room for the chip and the line of settings while loading', async () => {
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation(() => new Promise(() => undefined));

    await renderScreen(<WeekViewScreen />, dependencies);

    expect(screen.getAllByTestId('week-view-loading-chip')).toHaveLength(4);
    expect(screen.getAllByTestId('week-view-loading-settings')).toHaveLength(4);
  });

  it('shows on each card its progress of the week and its weekly target', async () => {
    await givenTheBackground();

    await show();

    expect(chip(cooking)).toHaveTextContent('1/7');
    expect(chip(cooking)).toHaveAccessibleName('1 sur 7');
    expect(targetLine(cooking)).toHaveTextContent('· tous les jours');
    expect(chip(budget)).toHaveTextContent('0/6');
    expect(targetLine(budget)).toHaveTextContent(
      '· tous les jours · 6 cette semaine (créée mardi)',
    );
  });

  it('follows a tap of today in the chip', async () => {
    await givenTheBackground();
    await show();

    await fireEvent.press(cell(cooking, wednesday));

    await waitFor(() => expect(chip(cooking)).toHaveTextContent('2/7'));
  });

  it('turns the chip gold once the target is reached, with a dark gold border', async () => {
    dependencies.clock.setToday(october(12));
    const created = await createHabit(dependencies, 'Courir 5 km', 'hard', 1);
    dependencies.clock.setToday(wednesday);
    const running = created.ok ? created.habit.id : 0;
    await show();
    expect(chip(running)).toHaveTextContent('0/1');

    await fireEvent.press(cell(running, wednesday));

    await waitFor(() => expect(chip(running)).toHaveTextContent('1/1 · Objectif atteint'));
    expect(chip(running)).toHaveAccessibleName('1 sur 1, objectif atteint');
    expect(screen.getByTestId(`week-card-reached-${running}`)).toBeOnTheScreen();
    expect(targetLine(running)).toHaveTextContent('· 1 fois par semaine');
  });

  it('greys the chip of a past week not reached', async () => {
    await givenTheBackground();
    await show();

    await fireEvent.press(previousButton());

    await waitFor(() => expect(chip(cooking)).toHaveTextContent('1/7'));
    expect(screen.getByText('1/7')).toHaveStyle({ color: artPalette.roles.muted });
    expect(chip(budget)).not.toBeOnTheScreen();
  });

  it('announces on the card a target changed for next Monday', async () => {
    await givenTheBackground();
    await updateHabit(dependencies, cooking, { name: 'Cuisiner', weeklyTarget: 4 });

    await show();

    expect(chip(cooking)).toHaveTextContent('1/7');
    expect(targetLine(cooking)).toHaveTextContent(
      '· tous les jours · 4 fois par semaine dès lundi',
    );
  });

  describe('in « Modifier l’habitude »', () => {
    const target = (value: number) => screen.getByTestId(`weekly-target-option-${value}`);
    const editName = (name: string) =>
      screen.getByRole('button', { name: `Modifier l’habitude ${name}` });

    it('prefills the target of next week and says the current week keeps its own', async () => {
      await givenTheBackground();
      await updateHabit(dependencies, cooking, { name: 'Cuisiner', weeklyTarget: 4 });
      await show();
      dependencies.unitOfWork.failReads();

      await fireEvent.press(editName('Cuisiner'));
      expect(await screen.findByTestId('edit-habit-sheet')).toBeOnTheScreen();
      expect(target(4)).toBeChecked();
      await fireEvent.press(target(5));

      expect(screen.getByTestId('weekly-target-change-info')).toHaveAccessibleName(
        'Nouvel objectif à partir de lundi prochain (19 octobre). Cette semaine reste à 7.',
      );
    });

    it('applies the target at once for a habit created today', async () => {
      await givenTheBackground();
      const created = await createHabit(dependencies, 'Lire');
      await show();

      await fireEvent.press(editName('Lire'));
      await fireEvent.press(target(3));

      expect(screen.getByTestId('weekly-target-change-info')).toHaveAccessibleName(
        'Habitude créée aujourd’hui : le nouvel objectif s’applique dès cette semaine.',
      );
      expect(created.ok).toBe(true);
    });

    it('reads the target of next week when another week is shown', async () => {
      await givenTheBackground();
      await updateHabit(dependencies, cooking, { name: 'Cuisiner', weeklyTarget: 4 });
      await show();
      await fireEvent.press(previousButton());
      await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));

      await fireEvent.press(editName('Cuisiner'));

      expect(await screen.findByTestId('edit-habit-sheet')).toBeOnTheScreen();
      expect(target(4)).toBeChecked();
    });
  });
});

describe('WeekViewScreen and the target bonus (#26)', () => {
  const hidden = { includeHiddenElements: true };
  const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
  const toast = () => screen.queryByTestId('toast');
  const xpBar = () => screen.getByTestId('character-bar');
  let running: HabitId;

  /** « Courir 5 km », Moyenne, objectif 3, créée le lundi 5 octobre, « fait » les `days`. */
  async function givenRunning(...days: Day[]) {
    dependencies.clock.setToday(october(5));
    const created = await createHabit(dependencies, 'Courir 5 km', 'medium', 3);
    running = created.ok ? created.habit.id : (undefined as never);
    for (const day of days) {
      await doneOn(running, day);
    }
  }

  it('plays F1 on the card when today reaches the target (E4)', async () => {
    await givenRunning(october(12), october(13));
    await show();

    await fireEvent.press(cell(running, wednesday));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 45 XP'));
    expect(screen.getByTestId(`week-progress-${running}`)).toHaveTextContent(
      '3/3 · Objectif atteint',
    );
    expect(screen.getByTestId(`week-card-reached-${running}`)).toBeOnTheScreen();
    expect(screen.getByTestId('xp-change-bonus', hidden)).toHaveTextContent('+15 XP prime');
    expect(toast()).toHaveTextContent(
      'Objectif de la semaine atteint\nCourir 5 km 3/3 · +15 XP prime',
    );
    expect(dependencies.haptics.success).toHaveBeenCalledTimes(2);
  });

  it('lights the chip of the card up when the motion is not reduced', async () => {
    withMotion();
    await givenRunning(october(12), october(13));
    await show();

    await fireEvent.press(cell(running, wednesday));

    await waitFor(() =>
      expect(
        within(screen.getByTestId(`week-card-${running}`)).getByTestId('target-burst', hidden),
      ).toBeOnTheScreen(),
    );
  });

  it('awards the bonus of a closed week by a correction, and names the week', async () => {
    await givenRunning(october(5), october(7));
    await show();
    await fireEvent.press(previousButton());
    await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));
    announce.mockClear();

    await fireEvent.press(cell(running, october(9)));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 45 XP'));
    expect(toast()).toHaveTextContent(
      'Objectif atteint · semaine du 5 octobre\nCourir 5 km 3/3 · +15 XP prime',
    );
    expect(screen.queryByText(/^Correction enregistrée/u)).not.toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(
      'Correction enregistrée, objectif de la semaine du 5 octobre atteint pour Courir 5 km, 3 sur 3. +15 points d’expérience de prime. Total : 45 XP.',
    );
  });

  it('takes the bonus of a closed week back by a correction, with a discreet message', async () => {
    await givenRunning(october(5), october(7), october(9));
    await show();
    await fireEvent.press(previousButton());
    await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));
    dependencies.haptics.success.mockClear();

    await fireEvent.press(cell(running, october(9)));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
    expect(toast()).toHaveTextContent(
      'Objectif de la semaine du 5 octobre plus atteint · Courir 5 km 2/3 · −15 XP prime',
    );
    expect(dependencies.haptics.success).not.toHaveBeenCalled();
  });

  it('keeps the message of a correction that does not cross the target', async () => {
    await givenRunning(october(5));
    await show();
    await fireEvent.press(previousButton());
    await waitFor(() => expect(shownWeek()).toMatch(/^Semaine dernière/u));

    await fireEvent.press(cell(running, october(9)));

    expect(
      await screen.findByText('Correction enregistrée · vendredi 9 octobre'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('xp-change-bonus', hidden)).not.toBeOnTheScreen();
  });
});

describe('WeekViewScreen in pixel art (E4, #73)', () => {
  const hidden = { includeHiddenElements: true };
  const { roles } = artPalette;

  it('shows the view on the night of the pixel art', async () => {
    await givenTheBackground();
    await show();

    expect(screen.getByTestId('week-view')).toHaveStyle({ backgroundColor: roles.night });
  });

  it('shows the character and « Ajouter une habitude » in the empty week', async () => {
    await show(jest.fn());

    expect(
      within(screen.getByTestId('week-view-empty')).getByTestId('illustration-character', hidden),
    ).toBeTruthy();
    expect(screen.getByTestId('add-habit')).toHaveStyle({ backgroundColor: roles.gold });
  });

  it('shows the alert emblem, the message in the text font and « Réessayer » when the week cannot be read', async () => {
    await givenTheBackground();
    dependencies.unitOfWork.failReads();

    await show();

    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(screen.getByTestId('illustration-alert', hidden)).toBeTruthy();
    expect(
      screen.getByText('Une erreur est survenue en lisant tes données sur ce téléphone.'),
    ).toHaveStyle({ fontFamily: 'Inter_400Regular' });
    expect(screen.getByRole('button', { name: 'Réessayer' })).toHaveStyle({
      backgroundColor: roles.gold,
    });
  });

  it('keeps a still skeleton while loading when the motion is reduced', async () => {
    jest.spyOn(dependencies.unitOfWork, 'run').mockReturnValue(new Promise(() => undefined));

    await renderScreen(<WeekViewScreen />, dependencies);
    await act(async () => undefined);

    const [slot] = screen.getAllByTestId('skeleton-cell', hidden);
    expect(slot?.children[0]).toHaveStyle({ opacity: 1 });
  });

  it('bursts the corrected case and lets « +10 XP » fly up from it, as in the day view', async () => {
    withMotion();
    await givenTheBackground();
    await show();

    await fireEvent.press(cell(cooking, october(13)));

    await waitFor(() =>
      expect(within(cell(cooking, october(13))).getByTestId('habit-burst', hidden)).toBeTruthy(),
    );
    await waitFor(() =>
      expect(within(cell(cooking, october(13))).getByTestId('xp-float', hidden)).toHaveTextContent(
        '+10 XP',
      ),
    );
  });

  it('neither bursts nor flies when the motion is reduced, the vibration stays', async () => {
    await givenTheBackground();
    await show();

    await fireEvent.press(cell(cooking, october(13)));

    await waitFor(() =>
      expect(labelOf(cooking, october(13))).toBe('Cuisiner, mardi 13 octobre, fait, corrigé'),
    );
    expect(screen.queryByTestId('habit-burst', hidden)).toBeNull();
    expect(screen.queryByTestId('xp-float', hidden)).toBeNull();
    await waitFor(() => expect(dependencies.haptics.success).toHaveBeenCalled());
  });

  it('writes the hint and the link back in the text font', async () => {
    await givenTheBackground();
    await show();
    await fireEvent.press(previousButton());

    const back = await screen.findByRole('button', { name: 'Revenir à cette semaine' });
    expect(within(back).getByText('Revenir à cette semaine')).toHaveStyle({
      fontFamily: 'Inter_700Bold',
      color: roles.gold,
    });
    expect(screen.getByText('Tape une case d’un jour passé pour corriger un oubli.')).toHaveStyle({
      fontFamily: 'Inter_500Medium',
    });
  });
});
