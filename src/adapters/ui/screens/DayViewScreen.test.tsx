import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { useState } from 'react';
import { AccessibilityInfo, ScrollView } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { CHECK_IN_HINT_DISMISSED_KEY } from '../../../application/useCases/checkInHint';
import { createHabit } from '../../../application/useCases/createHabit';
import { deleteHabit } from '../../../application/useCases/deleteHabit';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { updateHabit } from '../../../application/useCases/updateHabit';
import { getDayView } from '../../../application/useCases/getDayView';
import { Day } from '../../../domain/day/Day';
import { Week } from '../../../domain/week/Week';
import { TOAST_DURATION_MS } from '../components/Toast';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { DayViewScreen, HIGHLIGHT_DURATION_MS } from './DayViewScreen';

const nbsp = ' ';
const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);

const thursday = Day.of(2026, 10, 15);

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

async function given(...names: string[]) {
  for (const name of names) {
    await createHabit(dependencies, name);
  }
}

async function show() {
  await renderScreen(<DayViewScreen />, dependencies);
}

const rowNames = () =>
  screen
    .getAllByTestId(/^habit-row-/)
    .map((row) => within(row).getAllByText(/.+/)[0]?.props.children);

const addButton = () => screen.getByRole('button', { name: 'Ajouter une habitude' });

async function openSheetAndType(name: string) {
  await fireEvent.press(addButton());
  await fireEvent.changeText(screen.getByLabelText('Nom de l’habitude'), name);
}

async function names(): Promise<string[]> {
  const view = await getDayView(dependencies);
  return view.habits.map(({ habit }) => habit.name.value);
}

describe('DayViewScreen', () => {
  it('shows a loading state while the habits are read', async () => {
    let read: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      read = resolve;
    });
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => reading.then(() => run(work)));

    await show();

    expect(screen.getByLabelText('Chargement de tes habitudes')).toBeBusy();
    await act(async () => read());
    expect(await screen.findByText('Aucune habitude pour l’instant')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen();
  });

  it('shows the difficulty of each habit this week on its row (E1)', async () => {
    await createHabit(dependencies, 'Courir 5 km', 'hard');
    await createHabit(dependencies, 'Lire', 'easy');

    await show();

    expect(await screen.findByTestId('habit-difficulty-1')).toHaveTextContent('Difficile');
    expect(screen.getByTestId('habit-difficulty-2')).toHaveTextContent('Facile');
    expect(
      within(screen.getByTestId('habit-difficulty-1')).getAllByTestId('difficulty-peak', {
        includeHiddenElements: true,
      }),
    ).toHaveLength(3);
    expect(
      screen.getByRole('switch', {
        name: 'Courir 5 km, mercredi 14 octobre, à faire, Difficile, 20 XP par suivi',
      }),
    ).toBeOnTheScreen();
  });

  it('creates a habit with the difficulty chosen in the sheet', async () => {
    await show();
    await screen.findByTestId('day-view-empty');

    await openSheetAndType('Courir 5 km');
    await fireEvent.press(screen.getByRole('radio', { name: /^Difficile,/u }));
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));

    expect(await screen.findByTestId('habit-difficulty-1')).toHaveTextContent('Difficile');
    const [running] = (await getDayView(dependencies)).habits;
    expect(running?.weekSettings).toEqual({ difficulty: 'hard' });
  });

  it('invites to create a first habit when there is none', async () => {
    await show();

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(screen.getByText('Aucune habitude pour l’instant')).toBeOnTheScreen();
    expect(
      screen.getByRole('header', {
        name: 'Aucune habitude pour l’instant Crée ta première habitude et commence à gagner de l’expérience.',
      }),
    ).toHaveProp('accessibilityLiveRegion', 'none');
    expect(
      screen.getByText('Crée ta première habitude et commence à gagner de l’expérience.'),
    ).toBeOnTheScreen();
    expect(addButton()).toBeEnabled();
  });

  it('shows today and the habits of the day, in their order of creation, to do', async () => {
    await given('Cuisiner', 'Budget du jour');

    await show();

    expect(await screen.findByRole('header', { name: 'Aujourd’hui' })).toBeOnTheScreen();
    expect(screen.getByText('Mercredi 14 octobre')).toBeOnTheScreen();
    expect(rowNames()).toEqual(['Cuisiner', 'Budget du jour']);
    expect(
      screen.getByLabelText('Cuisiner, mercredi 14 octobre, à faire, Moyenne, 10 XP par suivi'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Budget du jour, mercredi 14 octobre, à faire, Moyenne, 10 XP par suivi',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('0 habitude faite sur 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('2 habitudes sur 10')).toHaveTextContent('2/10');
    expect(addButton()).toBeEnabled();
  });

  it('shows an error with « Réessayer » when the habits cannot be read, and erases nothing', async () => {
    await given('Cuisiner');
    dependencies.unitOfWork.failReads();

    await show();

    expect(
      await screen.findByRole('alert', {
        name: 'Impossible de charger tes habitudes. Une erreur est survenue en lisant tes données sur ce téléphone.',
      }),
    ).toHaveProp('accessibilityLiveRegion', 'assertive');
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('alert')).toBeOnTheScreen();

    dependencies.unitOfWork.failReads(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(
      await screen.findByLabelText(
        'Cuisiner, mercredi 14 octobre, à faire, Moyenne, 10 XP par suivi',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('opens the « Nouvelle habitude » sheet each time it is asked to', async () => {
    let ask: (request: string) => void = () => undefined;
    function Host() {
      const [request, setRequest] = useState<string | undefined>(undefined);
      ask = setRequest;
      return <DayViewScreen newHabitRequest={request} />;
    }
    await renderScreen(<Host />, dependencies);
    await screen.findByTestId('day-view-empty');
    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();

    await act(async () => ask('1'));
    expect(await screen.findByTestId('new-habit-sheet')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();

    await act(async () => ask('2'));
    expect(await screen.findByTestId('new-habit-sheet')).toBeOnTheScreen();
  });

  it('creates a first habit: the sheet closes and the new habit is highlighted', async () => {
    await show();
    await screen.findByTestId('day-view-empty');

    await openSheetAndType('Cuisiner');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));

    expect(
      await screen.findByLabelText(
        'Cuisiner, mercredi 14 octobre, à faire, Moyenne, 10 XP par suivi',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();
    expect(screen.getByTestId('toast')).toHaveTextContent('Habitude créée');
    expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderColor: '#7C9CFF' });
    expect(await names()).toEqual(['Cuisiner']);
  });

  it('adds the new habit at the bottom of the list', async () => {
    await given('Cuisiner');
    await show();
    await screen.findByText('Cuisiner');

    await openSheetAndType('  Lire   20  minutes  ');
    await fireEvent(screen.getByLabelText('Nom de l’habitude'), 'submitEditing');

    await waitFor(() => expect(rowNames()).toEqual(['Cuisiner', 'Lire 20 minutes']));
    expect(screen.getByTestId('habit-card-2')).toHaveStyle({ borderColor: '#7C9CFF' });
    expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderColor: 'transparent' });
  });

  it('scrolls to the new habit, and only to a new habit', async () => {
    const scrollToEnd = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
    await given('Cuisiner');
    await show();
    await screen.findByText('Cuisiner');
    await fireEvent(screen.getByTestId('day-view-list'), 'contentSizeChange', 390, 900);
    expect(scrollToEnd).not.toHaveBeenCalled();

    await openSheetAndType('Méditer');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
    await screen.findByText('Méditer');
    await fireEvent(screen.getByTestId('day-view-list'), 'contentSizeChange', 390, 1000);

    expect(scrollToEnd).toHaveBeenCalled();
  });

  it('stops highlighting the new habit and hides the message after a moment', async () => {
    jest.useFakeTimers();
    try {
      await show();
      await screen.findByTestId('day-view-empty');
      await openSheetAndType('Cuisiner');
      await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));
      await screen.findByText('Cuisiner');

      await act(() => jest.advanceTimersByTime(HIGHLIGHT_DURATION_MS));
      expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderColor: 'transparent' });
      await act(() => jest.advanceTimersByTime(TOAST_DURATION_MS - HIGHLIGHT_DURATION_MS));
      expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the sheet open with the name typed when it is a duplicate', async () => {
    await given('Cuisiner');
    await show();
    await screen.findByText('Cuisiner');

    await openSheetAndType('cuisiner  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));

    expect(
      await screen.findByRole('alert', {
        name: `Tu as déjà une habitude «${nbsp}Cuisiner${nbsp}».`,
      }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue('cuisiner  ');
    expect(await names()).toEqual(['Cuisiner']);
  });

  it('keeps the sheet open with the name typed when the habit cannot be saved', async () => {
    await show();
    await screen.findByTestId('day-view-empty');
    dependencies.unitOfWork.failWrites();

    await openSheetAndType('Méditer');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));

    expect(
      await screen.findByRole('alert', { name: 'L’habitude n’a pas pu être créée. Réessaie.' }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue('Méditer');
    expect(screen.queryByText('Habitude créée')).not.toBeOnTheScreen();
    dependencies.unitOfWork.failWrites(false);
    expect(await names()).toEqual([]);
  });

  it('closes the sheet without creating anything', async () => {
    await show();
    await screen.findByTestId('day-view-empty');

    await openSheetAndType('Méditer');
    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();
    expect(await names()).toEqual([]);
    await fireEvent.press(addButton());
    expect(screen.getByLabelText('Nom de l’habitude')).toHaveDisplayValue('');
  });

  it('counts every existing habit, even one not active yet after the clock went back', async () => {
    dependencies.clock.setToday(Day.of(2026, 10, 15));
    await given('Méditer');
    dependencies.clock.setToday(wednesday);
    await given('Cuisiner');

    await show();

    expect(await screen.findByLabelText('2 habitudes sur 10')).toHaveTextContent('2/10');
    expect(rowNames()).toEqual(['Cuisiner']);
    expect(screen.getByLabelText('0 habitude faite sur 1')).toBeOnTheScreen();
  });

  it('shows the day, not the empty state, when no existing habit is active yet', async () => {
    dependencies.clock.setToday(Day.of(2026, 10, 15));
    await given('Méditer');
    dependencies.clock.setToday(wednesday);

    await show();

    expect(await screen.findByLabelText('1 habitude sur 10')).toHaveTextContent('1/10');
    expect(screen.queryByTestId('day-view-empty')).not.toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Aujourd’hui' })).toBeOnTheScreen();
    expect(screen.queryAllByTestId(/^habit-row-/)).toEqual([]);
    expect(screen.queryByTestId('all-done')).not.toBeOnTheScreen();
  });

  it('disables adding a habit at 10 habits and explains why', async () => {
    await given(...Array.from({ length: 10 }, (_, index) => `Habitude ${index + 1}`));

    await show();

    expect(await screen.findByText('Limite atteinte · 10/10')).toBeOnTheScreen();
    expect(addButton()).toBeDisabled();
    expect(screen.getByLabelText('10 habitudes sur 10')).toHaveTextContent('10/10');
    await fireEvent.press(screen.getByText('Limite atteinte · 10/10'));
    expect(screen.getByTestId('toast')).toHaveTextContent(
      '10 habitudes au plus. Supprime une habitude pour en ajouter une.',
    );
    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();
  });

  describe('check-ins', () => {
    const HINT =
      'Tape ton habitude quand c’est fait : ton personnage gagne de l’XP selon sa difficulté.';
    const ALL_DONE = 'Toutes tes habitudes du jour sont faites. Belle ascension !';
    const SAVE_FAILED = 'Le suivi n’a pas été enregistré.';
    const cooking = (status: string, day = 'mercredi 14 octobre') =>
      screen.getByRole('switch', { name: `Cuisiner, ${day}, ${status}, Moyenne, 10 XP par suivi` });

    async function storedStatuses(): Promise<string[]> {
      const view = await getDayView(dependencies);
      return view.habits.map(({ habit, status }) => `${habit.name.value}: ${status}`);
    }

    async function showWith(...habitNames: string[]) {
      await given(...habitNames);
      await show();
      await screen.findByText(habitNames[0] ?? '');
    }

    it('confirms a habit with a tap on its row, and a second tap undoes it', async () => {
      await showWith('Cuisiner', 'Budget du jour');

      await fireEvent.press(cooking('à faire'));

      expect(await screen.findByRole('switch', { checked: true })).toHaveAccessibleName(
        'Cuisiner, mercredi 14 octobre, fait, Moyenne, 10 XP par suivi',
      );
      expect(screen.getByText('Fait')).toBeOnTheScreen();
      expect(screen.getByLabelText('1 habitude faite sur 2')).toHaveTextContent('1/2 faites');
      expect(screen.getByTestId('day-progress')).toHaveStyle({ width: '50%' });
      expect(await storedStatuses()).toEqual(['Cuisiner: done', 'Budget du jour: pending']);
      expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();

      await fireEvent.press(cooking('fait'));

      expect(await screen.findByLabelText('0 habitude faite sur 2')).toBeOnTheScreen();
      expect(cooking('à faire')).not.toBeChecked();
      expect(await storedStatuses()).toEqual(['Cuisiner: pending', 'Budget du jour: pending']);
    });

    it('shows « à faire » at once when a habit « fait » is touched, before it is saved', async () => {
      await given('Cuisiner');
      await toggleCheckIn(dependencies, 1, wednesday);
      await show();
      await screen.findByText('Cuisiner');
      let open: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        open = resolve;
      });
      const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
      jest
        .spyOn(dependencies.unitOfWork, 'run')
        .mockImplementation((work) => gate.then(() => run(work)));

      await fireEvent.press(cooking('fait'));

      expect(cooking('à faire')).not.toBeChecked();
      await act(async () => open());
      expect(await storedStatuses()).toEqual(['Cuisiner: pending']);
    });

    it('shows the habits already done today', async () => {
      await given('Cuisiner');
      await toggleCheckIn(dependencies, 1, wednesday);

      await show();

      expect(
        await screen.findByLabelText(
          'Cuisiner, mercredi 14 octobre, fait, Moyenne, 10 XP par suivi',
        ),
      ).toBeChecked();
    });

    it('encourages the player when every habit of the day is done', async () => {
      await showWith('Cuisiner', 'Lire');
      expect(screen.queryByText(ALL_DONE)).not.toBeOnTheScreen();

      await fireEvent.press(cooking('à faire'));
      await screen.findByLabelText('1 habitude faite sur 2');
      expect(screen.queryByText(ALL_DONE)).not.toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('switch', { name: /^Lire/u }));

      expect(await screen.findByText(ALL_DONE)).toBeOnTheScreen();
      expect(screen.getByLabelText('2 habitudes faites sur 2')).toBeOnTheScreen();
    });

    it('comes back to « à faire » and says so when the check-in cannot be saved', async () => {
      await showWith('Cuisiner');
      dependencies.unitOfWork.failWrites();

      await fireEvent.press(cooking('à faire'));

      expect(await screen.findByTestId('toast')).toHaveTextContent(`${SAVE_FAILED}Réessayer`);
      expect(cooking('à faire')).not.toBeChecked();
      expect(screen.getByLabelText('0 habitude faite sur 1')).toBeOnTheScreen();
      dependencies.unitOfWork.failWrites(false);
      expect(await storedStatuses()).toEqual(['Cuisiner: pending']);
    });

    it('tries the same check-in again with « Réessayer »', async () => {
      await showWith('Cuisiner');
      dependencies.unitOfWork.failWrites();
      await fireEvent.press(cooking('à faire'));
      await screen.findByText(SAVE_FAILED);
      dependencies.unitOfWork.failWrites(false);

      await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

      expect(await screen.findByRole('switch', { checked: true })).toHaveAccessibleName(
        'Cuisiner, mercredi 14 octobre, fait, Moyenne, 10 XP par suivi',
      );
      expect(screen.queryByText(SAVE_FAILED)).not.toBeOnTheScreen();
      expect(await storedStatuses()).toEqual(['Cuisiner: done']);
    });

    it('explains the tap once, until the first habit is done', async () => {
      await showWith('Cuisiner');
      expect(await screen.findByText(HINT)).toBeOnTheScreen();

      await fireEvent.press(cooking('à faire'));

      await waitFor(() => expect(screen.queryByText(HINT)).not.toBeOnTheScreen());
      expect(dependencies.keyValueStore.values.get(CHECK_IN_HINT_DISMISSED_KEY)).toBe('true');
      await screen.unmount();
      await show();
      await screen.findByText('Cuisiner');
      expect(screen.queryByText(HINT)).not.toBeOnTheScreen();
    });

    it('explains the tap without promising a fixed amount: true for every difficulty', async () => {
      await createHabit(dependencies, 'Courir 5 km', 'hard');
      await show();
      expect(await screen.findByText(HINT)).toBeOnTheScreen();
      expect(screen.queryByText(/10 XP/u)).not.toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('switch', { name: /^Courir 5 km, /u }));

      await waitFor(() =>
        expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
          '+20 XP',
        ),
      );
      await waitFor(() => expect(screen.queryByText(HINT)).not.toBeOnTheScreen());
    });

    it('keeps the hint when the check-in cannot be saved', async () => {
      await showWith('Cuisiner');
      await screen.findByText(HINT);
      dependencies.unitOfWork.failWrites();

      await fireEvent.press(cooking('à faire'));
      await screen.findByText(SAVE_FAILED);

      expect(screen.getByText(HINT)).toBeOnTheScreen();
    });

    it('keeps the hint when a habit goes back to « à faire »', async () => {
      await given('Cuisiner');
      await toggleCheckIn(dependencies, 1, wednesday);
      await show();
      await screen.findByText(HINT);

      await fireEvent.press(cooking('fait'));
      await waitFor(async () => expect(await storedStatuses()).toEqual(['Cuisiner: pending']));
      await act(async () => undefined);

      expect(screen.getByText(HINT)).toBeOnTheScreen();
      expect(dependencies.keyValueStore.values.size).toBe(0);
    });

    it('moves to the new day by itself, and announces it', async () => {
      await given('Cuisiner');
      await toggleCheckIn(dependencies, 1, wednesday);
      await show();
      await screen.findByLabelText('1 habitude faite sur 1');

      await act(() => dependencies.clock.setToday(thursday));

      expect(await screen.findByText('Jeudi 15 octobre')).toBeOnTheScreen();
      expect(cooking('à faire', 'jeudi 15 octobre')).not.toBeChecked();
      expect(screen.getByLabelText('0 habitude faite sur 1')).toBeOnTheScreen();
      expect(screen.getByTestId('toast')).toHaveTextContent('Nouvelle journée : jeudi 15 octobre.');
    });

    it('saves a tap on the day just closed as a correction, then shows the new day', async () => {
      await showWith('Cuisiner');
      const changes = jest.spyOn(dependencies.clock, 'today');
      changes.mockReturnValue(thursday);

      await fireEvent.press(cooking('à faire'));

      expect(await screen.findByText('Jeudi 15 octobre')).toBeOnTheScreen();
      expect(cooking('à faire', 'jeudi 15 octobre')).toBeOnTheScreen();
      expect(screen.getByTestId('toast')).toHaveTextContent(
        'Mercredi 14 octobre vient d’être clos : enregistré comme correction.',
      );
      // Le suivi « fait » du mercredi est enregistré : un nouveau tap ce jour-là le retire.
      await expect(toggleCheckIn(dependencies, 1, wednesday)).resolves.toMatchObject({
        isCorrection: true,
        habitDay: { status: 'missed' },
      });
      changes.mockRestore();
    });

    it('does nothing, and says nothing, on a tap refused because the day became « à venir »', async () => {
      await showWith('Cuisiner');
      // L'horloge recule avant que l'écran ne l'apprenne : le mercredi affiché est « à venir » (R7).
      const changes = jest.spyOn(dependencies.clock, 'today');
      changes.mockReturnValue(tuesday);

      await fireEvent.press(cooking('à faire'));

      expect(await screen.findByText('Mardi 13 octobre')).toBeOnTheScreen();
      expect(screen.queryByText('Cuisiner')).not.toBeOnTheScreen();
      expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();
      expect(dependencies.keyValueStore.values.size).toBe(0);
      changes.mockRestore();
      expect(await storedStatuses()).toEqual(['Cuisiner: pending']);
    });
  });

  describe('yesterday reminder', () => {
    const tuesday = Day.of(2026, 10, 13);

    async function givenHabitsSinceTuesday() {
      dependencies.clock.setToday(tuesday);
      await given('Cuisiner', 'Lire');
      const [cooking] = (await getDayView(dependencies)).habits;
      await toggleCheckIn(dependencies, cooking?.habit.id ?? 0, tuesday);
      dependencies.clock.setToday(wednesday);
    }

    it('reminds the habits done yesterday at the top, and leads to their week', async () => {
      await givenHabitsSinceTuesday();
      const onCorrectYesterday = jest.fn();
      await renderScreen(<DayViewScreen onCorrectYesterday={onCorrectYesterday} />, dependencies);

      expect(
        await screen.findByLabelText('Hier : 1 habitude faite sur 2. Un oubli ?'),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Corriger' }));

      expect(onCorrectYesterday).toHaveBeenCalledWith(Week.containing(tuesday));
    });

    it('closes the reminder for the day', async () => {
      await givenHabitsSinceTuesday();
      await show();
      await screen.findByTestId('yesterday-reminder');

      await fireEvent.press(screen.getByRole('button', { name: 'Fermer le rappel d’hier' }));

      expect(screen.queryByTestId('yesterday-reminder')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Corriger' })).toBeNull();
    });

    it('shows no reminder when every habit was done yesterday', async () => {
      await given('Cuisiner');
      await show();
      await screen.findByText('Cuisiner');

      expect(screen.queryByTestId('yesterday-reminder')).toBeNull();
    });
  });
});

describe('DayViewScreen and the experience', () => {
  const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
  const xpBar = () => screen.getByTestId('character-bar');
  const xpChange = () => screen.queryByTestId('xp-change', { includeHiddenElements: true });
  const row = (status: string) =>
    screen.getByRole('switch', {
      name: `Cuisiner, mercredi 14 octobre, ${status}, Moyenne, 10 XP par suivi`,
    });

  beforeEach(() => announce.mockClear());
  afterEach(() => jest.restoreAllMocks());

  async function showCooking() {
    await given('Cuisiner');
    await show();
    await screen.findByText('Cuisiner');
    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 0 XP'));
  }

  it('shows the experience of the character in the header (R24)', async () => {
    await given('Cuisiner', 'Lire');
    await toggleCheckIn(dependencies, 1, wednesday);
    await toggleCheckIn(dependencies, 2, wednesday);

    await show();

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
    expect(screen.getByText('Expérience du personnage')).toBeOnTheScreen();
    expect(screen.getByTestId('xp-counter')).toHaveTextContent('20 XP');
  });

  it('shows 0 XP to a new player, above the empty state', async () => {
    await show();

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('0 XP'));
  });

  it('shows the shape of the header while loading', async () => {
    jest.spyOn(dependencies.unitOfWork, 'run').mockReturnValue(new Promise(() => undefined));

    await show();

    expect(
      within(screen.getByTestId('day-view-loading')).getByTestId('character-bar-loading', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });

  it('earns 10 XP for a habit done, with a light vibration and an announcement', async () => {
    await showCooking();

    await fireEvent.press(row('à faire'));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP'));
    expect(screen.getByTestId('xp-counter')).toHaveTextContent('10 XP');
    expect(xpChange()).toHaveTextContent('+10 XP');
    expect(dependencies.haptics.success).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('+10 points d’expérience. Total : 10 XP.');
  });

  it('loses 10 XP, discreetly and without vibration, when a habit goes back to « à faire »', async () => {
    await given('Cuisiner');
    await toggleCheckIn(dependencies, 1, wednesday);
    await show();
    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP'));

    await fireEvent.press(row('fait'));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 0 XP'));
    expect(xpChange()).toHaveTextContent('−10 XP');
    expect(dependencies.haptics.success).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith('−10 points d’expérience. Total : 0 XP.');
  });

  it('changes no experience when the check-in cannot be saved', async () => {
    await showCooking();
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(row('à faire'));

    await screen.findByText('Le suivi n’a pas été enregistré.');
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 0 XP');
    expect(xpChange()).not.toBeOnTheScreen();
    expect(dependencies.haptics.success).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalledWith(expect.stringContaining('expérience'));
  });

  it('announces a tap on the day just closed as a correction', async () => {
    await showCooking();
    jest.spyOn(dependencies.clock, 'today').mockReturnValue(thursday);

    await fireEvent.press(row('à faire'));

    await screen.findByText('Jeudi 15 octobre');
    expect(announce).toHaveBeenCalledWith(
      'Correction enregistrée, +10 points d’expérience. Total : 10 XP.',
    );
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP');
  });

  it('lets « +10 XP » fly up from the row and counts up to the new experience', async () => {
    withMotion();
    await showCooking();

    await fireEvent.press(row('à faire'));

    await waitFor(() =>
      expect(
        within(row('fait')).getByTestId('xp-float', { includeHiddenElements: true }),
      ).toHaveTextContent('+10 XP'),
    );
    await waitFor(() => expect(screen.getByTestId('xp-counter')).toHaveTextContent('10 XP'));
  });

  it('lets nothing fly up when the player asked to reduce motion', async () => {
    await showCooking();

    await fireEvent.press(row('à faire'));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP'));
    expect(screen.queryByTestId('xp-float', { includeHiddenElements: true })).not.toBeOnTheScreen();
  });

  it('reads the experience again with « Réessayer »', async () => {
    await given('Cuisiner');
    await toggleCheckIn(dependencies, 1, wednesday);
    dependencies.unitOfWork.failReads();
    await show();
    await screen.findByTestId('day-view-error');
    dependencies.unitOfWork.failReads(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP'));
  });
});

describe('DayViewScreen and editing a habit', () => {
  const xpBar = () => screen.getByTestId('character-bar');
  const editButton = (name: string) =>
    screen.getByRole('button', { name: `Modifier l’habitude ${name}` });
  const nameField = () => screen.getByLabelText('Nom de l’habitude');
  const toast = () => screen.getByTestId('toast');

  /** « Cuisiner », créée mardi et « fait » mardi et mercredi, et « Budget du jour ». */
  async function showTwoHabits({ cookingDoneToday = true } = {}) {
    dependencies.clock.setToday(tuesday);
    await given('Cuisiner');
    await toggleCheckIn(dependencies, 1, tuesday);
    dependencies.clock.setToday(wednesday);
    await given('Budget du jour');
    if (cookingDoneToday) {
      await toggleCheckIn(dependencies, 1, wednesday);
    }
    await show();
    await screen.findByText('Cuisiner');
  }

  async function askDeletion(name = 'Cuisiner') {
    await fireEvent.press(editButton(name));
    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));
    await screen.findByTestId('delete-habit-dialog');
  }

  it('opens « Modifier l’habitude » from « ⋯ », without toggling the habit', async () => {
    await showTwoHabits({ cookingDoneToday: false });

    await fireEvent.press(editButton('Cuisiner'));

    expect(screen.getByRole('header', { name: 'Modifier l’habitude' })).toBeOnTheScreen();
    expect(nameField()).toHaveDisplayValue('Cuisiner');
    expect(nameField()).toHaveProp('autoFocus', false);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Supprimer l’habitude' })).toBeOnTheScreen();
    expect(
      screen.getByRole('switch', {
        name: 'Cuisiner, mercredi 14 octobre, à faire, Moyenne, 10 XP par suivi',
      }),
    ).not.toBeChecked();
  });

  it('closes « Modifier l’habitude » with « Annuler », changing nothing', async () => {
    await showTwoHabits();
    await fireEvent.press(editButton('Cuisiner'));

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('renames a habit, highlights it, and keeps its check-ins and the experience', async () => {
    await showTwoHabits();
    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
    await fireEvent.press(editButton('Cuisiner'));

    await fireEvent.changeText(nameField(), 'Cuisiner maison');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByRole('switch', {
        name: 'Cuisiner maison, mercredi 14 octobre, fait, Moyenne, 10 XP par suivi',
      }),
    ).toBeChecked();
    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderColor: '#7C9CFF' });
    expect(toast()).toHaveTextContent('Habitude renommée');
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP');
    expect(await names()).toEqual(['Cuisiner maison', 'Budget du jour']);
  });

  it('does not scroll to the end of the list for a renamed habit', async () => {
    await showTwoHabits();
    // Un espion déjà posé par un test précédent garde ses appels : on part de zéro.
    const scrollToEnd = jest.spyOn(ScrollView.prototype, 'scrollToEnd');
    scrollToEnd.mockClear();
    await fireEvent.press(editButton('Cuisiner'));
    await fireEvent.changeText(nameField(), 'Cuisiner maison');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByText('Cuisiner maison');

    await fireEvent(screen.getByTestId('day-view-list'), 'contentSizeChange', 390, 900);

    expect(scrollToEnd).not.toHaveBeenCalled();
    scrollToEnd.mockRestore();
  });

  it('refuses the name of another habit and keeps the habit as it is', async () => {
    await showTwoHabits();
    await fireEvent.press(editButton('Cuisiner'));

    await fireEvent.changeText(nameField(), 'budget du jour');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByRole('alert', {
        name: `Tu as déjà une habitude «${nbsp}Budget du jour${nbsp}».`,
      }),
    ).toBeOnTheScreen();
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('says the name could not be saved, and keeps the habit as it is', async () => {
    await showTwoHabits();
    await fireEvent.press(editButton('Cuisiner'));
    dependencies.unitOfWork.failWrites();

    await fireEvent.changeText(nameField(), 'Cuisiner maison');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByRole('alert', {
        name: 'Les modifications n’ont pas pu être enregistrées. Réessaie.',
      }),
    ).toBeOnTheScreen();
    dependencies.unitOfWork.failWrites(false);
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  describe('and its difficulty', () => {
    const option = (name: string) =>
      screen.getByRole('radio', { name: new RegExp(`^${name},`, 'u') });

    it('prefills the difficulty of the current week, without message', async () => {
      await showTwoHabits();

      await fireEvent.press(editButton('Cuisiner'));

      expect(option('Moyenne')).toBeChecked();
      expect(screen.queryByTestId('difficulty-change-info')).not.toBeOnTheScreen();
    });

    it('opens with the settings already shown, without reading them again', async () => {
      await showTwoHabits();
      dependencies.unitOfWork.failReads();

      await fireEvent.press(editButton('Cuisiner'));

      expect(await screen.findByTestId('edit-habit-sheet')).toBeOnTheScreen();
      expect(option('Moyenne')).toBeChecked();
      expect(screen.queryByText('L’habitude n’a pas pu être ouverte. Réessaie.')).toBeNull();
    });

    it('prefills the difficulty of the habit opened, not of another one', async () => {
      await showTwoHabits();
      await updateHabit(dependencies, 1, { name: 'Cuisiner', difficulty: 'hard' });
      await screen.unmount();
      await show();
      expect(await screen.findByTestId('habit-difficulty-1')).toHaveTextContent('Difficile');

      await fireEvent.press(editButton('Budget du jour'));

      expect(option('Moyenne')).toBeChecked();
    });

    it('re-evaluates the week at a higher difficulty: +20 XP, with a vibration', async () => {
      await showTwoHabits();
      await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
      await fireEvent.press(editButton('Cuisiner'));

      await fireEvent.press(option('Difficile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(
        await screen.findByRole('switch', {
          name: 'Cuisiner, mercredi 14 octobre, fait, Difficile, 20 XP par suivi',
        }),
      ).toBeChecked();
      expect(screen.getByTestId('habit-difficulty-1')).toHaveTextContent('Difficile');
      expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
      expect(toast()).toHaveTextContent(`Habitude modifiée · +20 XP`);
      expect(screen.getByTestId('habit-card-1')).toHaveStyle({ borderColor: '#7C9CFF' });
      expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 40 XP');
      expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
        '+20 XP',
      );
      expect(dependencies.haptics.success).toHaveBeenCalledTimes(1);
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        '+20 points d’expérience. Total : 40 XP.',
      );
    });

    it('takes back the difference at a lower difficulty, never with a vibration', async () => {
      await showTwoHabits();
      await fireEvent.press(editButton('Cuisiner'));

      await fireEvent.press(option('Facile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => expect(toast()).toHaveTextContent('Habitude modifiée · −10 XP'));
      expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP');
      expect(dependencies.haptics.success).not.toHaveBeenCalled();
    });

    it('then gives a check-in at the new rate', async () => {
      await showTwoHabits({ cookingDoneToday: false });
      await fireEvent.press(editButton('Cuisiner'));
      await fireEvent.press(option('Difficile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
      await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));

      await fireEvent.press(
        await screen.findByRole('switch', {
          name: 'Cuisiner, mercredi 14 octobre, à faire, Difficile, 20 XP par suivi',
        }),
      );

      await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 40 XP'));
    });

    it('says « Habitude modifiée » when the name and the difficulty change together', async () => {
      await showTwoHabits({ cookingDoneToday: false });
      await fireEvent.press(editButton('Cuisiner'));

      await fireEvent.changeText(nameField(), 'Cuisiner maison');
      await fireEvent.press(option('Difficile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => expect(toast()).toHaveTextContent('Habitude modifiée · +10 XP'));
      expect(await names()).toEqual(['Cuisiner maison', 'Budget du jour']);
    });

    it('changes nothing when the change cannot be saved, and keeps the choice', async () => {
      await showTwoHabits();
      await fireEvent.press(editButton('Cuisiner'));
      dependencies.unitOfWork.failWrites();

      await fireEvent.press(option('Difficile'));
      await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(
        await screen.findByRole('alert', {
          name: 'Les modifications n’ont pas pu être enregistrées. Réessaie.',
        }),
      ).toBeOnTheScreen();
      expect(option('Difficile')).toBeChecked();
      dependencies.unitOfWork.failWrites(false);
      const [cooking] = (await getDayView(dependencies)).habits;
      expect(cooking?.weekSettings).toEqual({ difficulty: 'medium' });
      expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP');
    });

    it('keeps the difficulty chosen after a failed preparation of the deletion', async () => {
      await showTwoHabits();
      await fireEvent.press(editButton('Cuisiner'));
      await fireEvent.press(option('Difficile'));
      dependencies.unitOfWork.failReads();

      await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));

      expect(await screen.findByRole('alert')).toBeOnTheScreen();
      expect(option('Difficile')).toBeChecked();
      expect(screen.getByTestId('difficulty-change-info')).toBeOnTheScreen();
    });
  });

  it('asks to confirm a deletion, announcing the experience removed today', async () => {
    await showTwoHabits();

    await askDeletion();

    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: `Supprimer «${nbsp}Cuisiner${nbsp}»${nbsp}?` }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/seule celle d’aujourd’hui est retirée \(−10 XP\)\.$/u)).toBeTruthy();
  });

  it('announces no experience removed when the habit is not done today', async () => {
    await showTwoHabits({ cookingDoneToday: false });

    await askDeletion();

    expect(
      screen.getByText(
        'Ses suivis seront effacés. L’expérience gagnée les jours passés reste acquise.',
      ),
    ).toBeOnTheScreen();
  });

  it('deletes the habit once confirmed, and shows the experience removed', async () => {
    await showTwoHabits();
    await waitFor(() => expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP'));
    await askDeletion();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(screen.queryByText('Cuisiner')).not.toBeOnTheScreen());
    expect(screen.queryByTestId('delete-habit-dialog')).not.toBeOnTheScreen();
    expect(toast()).toHaveTextContent('Habitude supprimée · −10 XP');
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP');
    expect(screen.getByTestId('xp-change', { includeHiddenElements: true })).toHaveTextContent(
      '−10 XP',
    );
    expect(screen.getByLabelText('1 habitude sur 10')).toBeOnTheScreen();
    expect(await names()).toEqual(['Budget du jour']);
  });

  it('says « Habitude supprimée » alone when no experience is removed', async () => {
    await showTwoHabits({ cookingDoneToday: false });
    await askDeletion();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(toast()).toHaveTextContent('Habitude supprimée'));
    expect(toast()).not.toHaveTextContent('XP');
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 10 XP');
  });

  it('keeps the habit and the experience when the deletion is cancelled', async () => {
    await showTwoHabits();
    await askDeletion();

    await fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByTestId('delete-habit-dialog')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(
      screen.getByRole('switch', {
        name: 'Cuisiner, mercredi 14 octobre, fait, Moyenne, 10 XP par suivi',
      }),
    ).toBeChecked();
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP');
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
  });

  it('keeps the habit, its check-ins and the experience when the deletion fails', async () => {
    await showTwoHabits();
    await askDeletion();
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    expect(
      await screen.findByRole('alert', { name: 'La suppression a échoué. Réessaie.' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    dependencies.unitOfWork.failWrites(false);
    expect(xpBar()).toHaveAccessibleName('Expérience du personnage : 20 XP');
    expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
    expect((await getDayView(dependencies)).habits[0]?.status).toBe('done');
  });

  it('explains a deletion that could not be prepared, in the sheet', async () => {
    await showTwoHabits();
    await fireEvent.press(editButton('Cuisiner'));
    dependencies.unitOfWork.failReads();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer l’habitude' }));

    expect(
      await screen.findByRole('alert', { name: 'La suppression a échoué. Réessaie.' }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('edit-habit-sheet')).toBeOnTheScreen();
    expect(screen.queryByTestId('delete-habit-dialog')).not.toBeOnTheScreen();
    dependencies.unitOfWork.failReads(false);
  });

  it('shows the empty state once the last habit is deleted', async () => {
    await given('Cuisiner');
    await show();
    await screen.findByText('Cuisiner');
    await askDeletion();

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(toast()).toHaveTextContent('Habitude supprimée');
  });

  it('lets the player add a habit again once one of 10 habits is deleted', async () => {
    await given(...Array.from({ length: 10 }, (_, index) => `Habitude ${index + 1}`));
    await show();
    expect(await screen.findByText('Limite atteinte · 10/10')).toBeOnTheScreen();
    await askDeletion('Habitude 3');

    await fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(addButton()).toBeEnabled());
    expect(screen.queryByText('Limite atteinte · 10/10')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('9 habitudes sur 10')).toBeOnTheScreen();
  });

  it('reloads and closes everything when the habit no longer exists', async () => {
    await showTwoHabits();
    await fireEvent.press(editButton('Cuisiner'));
    await deleteHabit(dependencies, 1);

    await fireEvent.changeText(nameField(), 'Cuisiner maison');
    await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(screen.queryByText('Cuisiner')).not.toBeOnTheScreen());
    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('toast')).not.toBeOnTheScreen();
  });
});
