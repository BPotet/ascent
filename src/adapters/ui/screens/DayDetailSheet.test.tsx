import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { deleteHabit } from '../../../application/useCases/deleteHabit';
import { getCharacter } from '../../../application/useCases/getCharacter';
import { getDayDetail } from '../../../application/useCases/getDayDetail';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { Character } from '../../../domain/character/Character';
import { Day } from '../../../domain/day/Day';
import type { HabitId } from '../../../domain/habit/Habit';
import { useTrackingChanges } from '../state/TrackingRevision';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { reduceMotionInEachTest, withMotion } from '../testing/motion';
import { renderScreen } from '../testing/renderScreen';
import { DayDetailSheet } from './DayDetailSheet';

const october = (dayOfMonth: number) => Day.of(2026, 10, dayOfMonth);
const wednesday = october(14);

let dependencies: {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  haptics: { success: jest.Mock };
};
let cooking: HabitId;

reduceMotionInEachTest();

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

/** Le contexte de `features/month-view.feature`, avec 30 Xp. */
beforeEach(async () => {
  dependencies = {
    clock: settableClock(wednesday),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    haptics: { success: jest.fn() },
  };
  cooking = await habitCreatedOn(october(5), 'Cuisiner');
  const budget = await habitCreatedOn(october(13), 'Budget du jour');
  await doneOn(cooking, october(12));
  await doneOn(cooking, october(13));
  await doneOn(budget, october(13));
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Compte les changements enregistrés que les autres vues reçoivent. */
function OtherView({ onChange }: { readonly onChange: () => void }) {
  useTrackingChanges(onChange);
  return <Text>Autre vue</Text>;
}

async function open(day: Day, onClose = jest.fn(), onOtherViewChange = jest.fn()) {
  const opened = await getDayDetail(dependencies, day);
  await renderScreen(
    <>
      <OtherView onChange={onOtherViewChange} />
      <DayDetailSheet opened={opened} onClose={onClose} />
    </>,
    dependencies,
  );
  return { onClose, onOtherViewChange };
}

const row = (name: RegExp) => screen.getByRole('switch', { name });

describe('DayDetailSheet', () => {
  it('shows a closed day: each active habit with its state, and the habits created later', async () => {
    await open(october(12));

    expect(screen.getByRole('header', { name: 'Lundi 12 octobre' })).toBeOnTheScreen();
    expect(
      screen.getByText('Jour clos · tu peux corriger un oubli · 1/1 faites'),
    ).toBeOnTheScreen();
    expect(row(/^Cuisiner, lundi 12 octobre, fait$/u)).toBeChecked();
    expect(screen.getByText('Fait')).toBeOnTheScreen();
    expect(screen.queryByRole('switch', { name: /^Budget du jour/u })).toBeNull();
    expect(
      screen.getByText('« Budget du jour » : créée plus tard, hors habitude ce jour-là.'),
    ).toBeOnTheScreen();
  });

  it('shows today, where a touch is the same as in the day view', async () => {
    await open(wednesday);

    expect(screen.getByRole('header', { name: 'Mercredi 14 octobre' })).toBeOnTheScreen();
    expect(screen.getByText('Aujourd’hui · 0/2 faites')).toBeOnTheScreen();
    expect(screen.getAllByText('À faire')).toHaveLength(2);
    expect(screen.queryByText(/hors habitude ce jour-là/u)).toBeNull();

    await fireEvent.press(row(/^Cuisiner, mercredi 14 octobre/u));

    await waitFor(() => expect(screen.getByText('Aujourd’hui · 1/2 faites')).toBeOnTheScreen());
    expect(row(/^Cuisiner, mercredi 14 octobre, fait$/u)).toBeChecked();
  });

  it('corrects a closed day: « fait » with the mark « corrigé », +10 Xp, other views told', async () => {
    await dependencies.unitOfWork.run(({ character }) => character.save(new Character(30)));
    const { onOtherViewChange } = await open(october(8));
    expect(
      screen.getByText('Jour clos · tu peux corriger un oubli · 0/1 faites'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Pas fait')).toBeOnTheScreen();

    await fireEvent.press(row(/^Cuisiner, jeudi 8 octobre/u));

    await waitFor(() => expect(row(/^Cuisiner, jeudi 8 octobre, fait, corrigé$/u)).toBeChecked());
    expect(screen.getByText('corrigé')).toBeOnTheScreen();
    expect(
      screen.getByText('Jour clos · tu peux corriger un oubli · 1/1 faites'),
    ).toBeOnTheScreen();
    expect((await getCharacter(dependencies)).xp).toBe(40);
    expect(onOtherViewChange).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says nothing was lost when the touched habit was deleted meanwhile', async () => {
    await open(october(8));
    await deleteHabit(dependencies, cooking);

    await fireEvent.press(row(/^Cuisiner, jeudi 8 octobre/u));

    await waitFor(() => expect(screen.queryByText('Cuisiner')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows « pas fait » at once on a closed day, and the closing state again after a second touch', async () => {
    await open(october(12));

    await fireEvent.press(row(/^Cuisiner, lundi 12 octobre/u));

    expect(row(/^Cuisiner, lundi 12 octobre, pas fait/u)).not.toBeChecked();
    await waitFor(() =>
      expect(row(/^Cuisiner, lundi 12 octobre, pas fait, corrigé$/u)).toBeOnTheScreen(),
    );

    await fireEvent.press(row(/^Cuisiner, lundi 12 octobre/u));

    await waitFor(() => expect(row(/^Cuisiner, lundi 12 octobre, fait$/u)).toBeChecked());
    expect(screen.queryByText('corrigé')).toBeNull();
  });

  it('makes « +10 XP » fly from the touched row', async () => {
    withMotion();
    await open(october(8));

    await fireEvent.press(row(/^Cuisiner, jeudi 8 octobre/u));

    expect(await screen.findByTestId('xp-float', { includeHiddenElements: true })).toBeTruthy();
  });

  it('puts a correction back when it is not saved, and offers to try again', async () => {
    const { onOtherViewChange } = await open(october(8));
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(row(/^Cuisiner, jeudi 8 octobre/u));

    expect(
      await screen.findByRole('alert', { name: 'La correction n’a pas été enregistrée.' }),
    ).toBeOnTheScreen();
    expect(row(/^Cuisiner, jeudi 8 octobre, pas fait$/u)).not.toBeChecked();
    expect(screen.queryByText('corrigé')).toBeNull();
    expect(
      screen.getByText('Jour clos · tu peux corriger un oubli · 0/1 faites'),
    ).toBeOnTheScreen();
    expect((await getCharacter(dependencies)).xp).toBe(30);
    expect(onOtherViewChange).not.toHaveBeenCalled();

    dependencies.unitOfWork.failWrites(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(row(/^Cuisiner, jeudi 8 octobre, fait, corrigé$/u)).toBeChecked());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says that the check-in of today was not saved', async () => {
    await open(wednesday);
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(row(/^Cuisiner, mercredi 14 octobre/u));

    expect(
      await screen.findByRole('alert', { name: 'Le suivi n’a pas été enregistré.' }),
    ).toBeOnTheScreen();
    expect(row(/^Cuisiner, mercredi 14 octobre, à faire$/u)).not.toBeChecked();
  });

  it('closes with « Fermer » or a touch outside the panel', async () => {
    const { onClose } = await open(october(12));

    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('day-detail-scrim', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows the day as the month showed it, then as it is recorded', async () => {
    const opened = await getDayDetail(dependencies, october(8));
    await doneOn(cooking, october(8));
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    let read: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      read = resolve;
    });
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => reading.then(() => run(work)));

    await renderScreen(<DayDetailSheet opened={opened} onClose={jest.fn()} />, dependencies);

    expect(screen.getByText('Pas fait')).toBeOnTheScreen();
    await act(async () => read());
    expect(await screen.findByText('Fait')).toBeOnTheScreen();
  });

  it('keeps the day shown when it cannot be read again', async () => {
    const opened = await getDayDetail(dependencies, october(12));
    dependencies.unitOfWork.failReads();

    await renderScreen(<DayDetailSheet opened={opened} onClose={jest.fn()} />, dependencies);

    await act(async () => undefined);
    expect(row(/^Cuisiner, lundi 12 octobre, fait$/u)).toBeChecked();
  });

  it('follows today: after midnight, today becomes a closed day', async () => {
    await open(wednesday);

    await act(async () => dependencies.clock.setToday(october(15)));

    expect(
      await screen.findByText('Jour clos · tu peux corriger un oubli · 0/2 faites'),
    ).toBeOnTheScreen();
    expect(row(/^Cuisiner, mercredi 14 octobre, pas fait$/u)).toBeOnTheScreen();
  });
});
