import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { ScrollView } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { CHECK_IN_HINT_DISMISSED_KEY } from '../../../application/useCases/checkInHint';
import { createHabit } from '../../../application/useCases/createHabit';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { getDayView } from '../../../application/useCases/getDayView';
import { Day } from '../../../domain/day/Day';
import { TOAST_DURATION_MS } from '../components/Toast';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
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
};

beforeEach(() => {
  dependencies = {
    clock: settableClock(wednesday),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
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
    expect(screen.getByLabelText('Cuisiner, mercredi 14 octobre, à faire')).toBeOnTheScreen();
    expect(screen.getByLabelText('Budget du jour, mercredi 14 octobre, à faire')).toBeOnTheScreen();
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
      await screen.findByLabelText('Cuisiner, mercredi 14 octobre, à faire'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('creates a first habit: the sheet closes and the new habit is highlighted', async () => {
    await show();
    await screen.findByTestId('day-view-empty');

    await openSheetAndType('Cuisiner');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer l’habitude' }));

    expect(
      await screen.findByLabelText('Cuisiner, mercredi 14 octobre, à faire'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('new-habit-sheet')).not.toBeOnTheScreen();
    expect(screen.getByTestId('toast')).toHaveTextContent('Habitude créée');
    expect(screen.getByTestId('habit-row-1')).toHaveStyle({ borderColor: '#7C9CFF' });
    expect(await names()).toEqual(['Cuisiner']);
  });

  it('adds the new habit at the bottom of the list', async () => {
    await given('Cuisiner');
    await show();
    await screen.findByText('Cuisiner');

    await openSheetAndType('  Lire   20  minutes  ');
    await fireEvent(screen.getByLabelText('Nom de l’habitude'), 'submitEditing');

    await waitFor(() => expect(rowNames()).toEqual(['Cuisiner', 'Lire 20 minutes']));
    expect(screen.getByTestId('habit-row-2')).toHaveStyle({ borderColor: '#7C9CFF' });
    expect(screen.getByTestId('habit-row-1')).toHaveStyle({ borderColor: 'transparent' });
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
      expect(screen.getByTestId('habit-row-1')).toHaveStyle({ borderColor: 'transparent' });
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
    const HINT = 'Tape ton habitude quand c’est fait : +10 XP pour ton personnage.';
    const ALL_DONE = 'Toutes tes habitudes du jour sont faites. Belle ascension !';
    const SAVE_FAILED = 'Le suivi n’a pas été enregistré.';
    const cooking = (status: string, day = 'mercredi 14 octobre') =>
      screen.getByRole('switch', { name: `Cuisiner, ${day}, ${status}` });

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
        'Cuisiner, mercredi 14 octobre, fait',
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

    it('shows the habits already done today', async () => {
      await given('Cuisiner');
      await toggleCheckIn(dependencies, 1, wednesday);

      await show();

      expect(await screen.findByLabelText('Cuisiner, mercredi 14 octobre, fait')).toBeChecked();
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
        'Cuisiner, mercredi 14 octobre, fait',
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
});
