import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { ScrollView } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { getDayView } from '../../../application/useCases/getDayView';
import { Day } from '../../../domain/day/Day';
import { TOAST_DURATION_MS } from '../components/Toast';
import { renderScreen } from '../testing/renderScreen';
import { DayViewScreen, HIGHLIGHT_DURATION_MS } from './DayViewScreen';

const nbsp = ' ';
const wednesday = Day.of(2026, 10, 14);

let dependencies: { clock: ReturnType<typeof settableClock>; unitOfWork: InMemoryUnitOfWork };

beforeEach(() => {
  dependencies = { clock: settableClock(wednesday), unitOfWork: new InMemoryUnitOfWork() };
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

    expect(screen.getByLabelText('Chargement de tes habitudes')).toBeOnTheScreen();
    await act(async () => read());
    expect(await screen.findByText('Aucune habitude pour l’instant')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Chargement de tes habitudes')).not.toBeOnTheScreen();
  });

  it('invites to create a first habit when there is none', async () => {
    await show();

    expect(await screen.findByTestId('day-view-empty')).toBeOnTheScreen();
    expect(screen.getByText('Aucune habitude pour l’instant')).toBeOnTheScreen();
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
    ).toBeOnTheScreen();
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
});
