import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { deleteHabit } from '../../../application/useCases/deleteHabit';
import { getCharacter } from '../../../application/useCases/getCharacter';
import { dayDetailOf, getDayDetail } from '../../../application/useCases/getDayDetail';
import { getMonthView } from '../../../application/useCases/getMonthView';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { Character } from '../../../domain/character/Character';
import { Day } from '../../../domain/day/Day';
import type { HabitId } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
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
      <DayDetailSheet opened={opened} today={dependencies.clock.today()} onClose={onClose} />
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
    expect(row(/^Cuisiner, lundi 12 octobre, fait, 2 sur 7 cette semaine$/u)).toBeChecked();
    expect(screen.getByText('Fait · 2/7 cette semaine')).toBeOnTheScreen();
    expect(screen.queryByRole('switch', { name: /^Budget du jour/u })).toBeNull();
    expect(
      screen.getByText('« Budget du jour » : créée plus tard, hors habitude ce jour-là.'),
    ).toBeOnTheScreen();
  });

  it('shows today, where a touch is the same as in the day view', async () => {
    await open(wednesday);

    expect(screen.getByRole('header', { name: 'Mercredi 14 octobre' })).toBeOnTheScreen();
    expect(screen.getByText('Aujourd’hui · 0/2 faites')).toBeOnTheScreen();
    expect(screen.getByText('À faire · 2/7 cette semaine')).toBeOnTheScreen();
    expect(screen.getByText('À faire · 1/6 cette semaine')).toBeOnTheScreen();
    expect(screen.queryByText(/hors habitude ce jour-là/u)).toBeNull();

    await fireEvent.press(row(/^Cuisiner, mercredi 14 octobre/u));

    await waitFor(() => expect(screen.getByText('Aujourd’hui · 1/2 faites')).toBeOnTheScreen());
    await waitFor(() =>
      expect(row(/^Cuisiner, mercredi 14 octobre, fait, 3 sur 7 cette semaine$/u)).toBeChecked(),
    );
  });

  it('corrects a closed day: « fait » with the mark « corrigé », +10 Xp, other views told', async () => {
    await dependencies.unitOfWork.run(({ character }) => character.save(new Character(30)));
    const { onOtherViewChange } = await open(october(8));
    expect(
      screen.getByText('Jour clos · tu peux corriger un oubli · 0/1 faites'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Pas fait · 0/7 semaine du 5 octobre')).toBeOnTheScreen();

    await fireEvent.press(row(/^Cuisiner, jeudi 8 octobre/u));

    await waitFor(() =>
      expect(
        row(/^Cuisiner, jeudi 8 octobre, fait, 1 sur 7 semaine du 5 octobre, corrigé$/u),
      ).toBeChecked(),
    );
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
      expect(
        row(/^Cuisiner, lundi 12 octobre, pas fait, 1 sur 7 cette semaine, corrigé$/u),
      ).toBeOnTheScreen(),
    );

    await fireEvent.press(row(/^Cuisiner, lundi 12 octobre/u));

    await waitFor(() =>
      expect(row(/^Cuisiner, lundi 12 octobre, fait, 2 sur 7 cette semaine$/u)).toBeChecked(),
    );
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
    expect(
      row(/^Cuisiner, jeudi 8 octobre, pas fait, 0 sur 7 semaine du 5 octobre$/u),
    ).not.toBeChecked();
    expect(screen.queryByText('corrigé')).toBeNull();
    expect(
      screen.getByText('Jour clos · tu peux corriger un oubli · 0/1 faites'),
    ).toBeOnTheScreen();
    expect((await getCharacter(dependencies)).xp).toBe(30);
    expect(onOtherViewChange).not.toHaveBeenCalled();

    dependencies.unitOfWork.failWrites(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() =>
      expect(
        row(/^Cuisiner, jeudi 8 octobre, fait, 1 sur 7 semaine du 5 octobre, corrigé$/u),
      ).toBeChecked(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says that the check-in of today was not saved', async () => {
    await open(wednesday);
    dependencies.unitOfWork.failWrites();

    await fireEvent.press(row(/^Cuisiner, mercredi 14 octobre/u));

    expect(
      await screen.findByRole('alert', { name: 'Le suivi n’a pas été enregistré.' }),
    ).toBeOnTheScreen();
    expect(
      row(/^Cuisiner, mercredi 14 octobre, à faire, 2 sur 7 cette semaine$/u),
    ).not.toBeChecked();
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

    await renderScreen(
      <DayDetailSheet opened={opened} today={wednesday} onClose={jest.fn()} />,
      dependencies,
    );

    expect(screen.getByText('Pas fait · 0/7 semaine du 5 octobre')).toBeOnTheScreen();
    await act(async () => read());
    expect(await screen.findByText('Fait · 1/7 semaine du 5 octobre')).toBeOnTheScreen();
  });

  it('keeps the day shown when it cannot be read again', async () => {
    const opened = await getDayDetail(dependencies, october(12));
    dependencies.unitOfWork.failReads();

    await renderScreen(
      <DayDetailSheet opened={opened} today={wednesday} onClose={jest.fn()} />,
      dependencies,
    );

    await act(async () => undefined);
    expect(row(/^Cuisiner, lundi 12 octobre, fait, 2 sur 7 cette semaine$/u)).toBeChecked();
  });

  it('follows today: after midnight, today becomes a closed day', async () => {
    await open(wednesday);

    await act(async () => dependencies.clock.setToday(october(15)));

    expect(
      await screen.findByText('Jour clos · tu peux corriger un oubli · 0/2 faites'),
    ).toBeOnTheScreen();
    expect(
      row(/^Cuisiner, mercredi 14 octobre, pas fait, 2 sur 7 cette semaine$/u),
    ).toBeOnTheScreen();
  });
});

describe('DayDetailSheet and the expected habits (#25)', () => {
  const friday16 = october(16);
  const monday19 = october(19);
  let running: HabitId;

  /** « Courir 5 km », objectif 3, et « Cuisiner », objectif 7, créées le lundi 5 octobre. */
  beforeEach(async () => {
    dependencies.unitOfWork = new InMemoryUnitOfWork();
    dependencies.clock.setToday(october(5));
    const created = await createHabit(dependencies, 'Courir 5 km', 'medium', 3);
    const cuisine = await createHabit(dependencies, 'Cuisiner', 'medium', 7);
    running = created.ok ? created.habit.id : 0;
    cooking = cuisine.ok ? cuisine.habit.id : 0;
    for (const each of [12, 13, 14]) {
      await doneOn(running, october(each));
    }
  });

  /** Le jour `dayOfMonth` dans la Vue Mois. */
  async function monthDayOn(dayOfMonth: number) {
    const view = await getMonthView(dependencies);
    return view.days[dayOfMonth - 1]!;
  }

  it('counts only the expected habits under its title, and shows every habit, correctable', async () => {
    dependencies.clock.setToday(friday16);

    await open(october(15));

    expect(
      screen.getByText('Jour clos · tu peux corriger un oubli · 0/1 faites'),
    ).toBeOnTheScreen();
    expect(
      row(/^Courir 5 km, jeudi 15 octobre, pas fait, 3 sur 3 cette semaine, objectif atteint$/u),
    ).toBeEnabled();
    expect(row(/^Cuisiner, jeudi 15 octobre, pas fait, 0 sur 7 cette semaine$/u)).toBeEnabled();
  });

  it('agrees with the flag of its day in the month view, and recounts with it after a correction', async () => {
    await deleteHabit(dependencies, cooking);
    dependencies.clock.setToday(monday19);
    expect(await monthDayOn(15)).toMatchObject({ kind: 'tracked', expectedCount: 0 });

    await open(october(15));

    expect(
      screen.getByText('Jour clos · tu peux corriger un oubli · objectifs de la semaine atteints'),
    ).toBeOnTheScreen();
    expect(
      row(
        /^Courir 5 km, jeudi 15 octobre, pas fait, 3 sur 3 semaine du 12 octobre, objectif atteint$/u,
      ),
    ).toBeEnabled();

    await fireEvent.press(row(/^Courir 5 km, jeudi 15 octobre/u));

    expect(
      await screen.findByText('Jour clos · tu peux corriger un oubli · 1/1 faites'),
    ).toBeOnTheScreen();
    expect(await screen.findByText('Fait · 4 fois semaine du 12 octobre')).toBeOnTheScreen();
    expect(await monthDayOn(15)).toMatchObject({ doneCount: 1, expectedCount: 1 });
  });
});

describe('DayDetailSheet and the progress of the week (#27)', () => {
  const today = october(21);
  let running: HabitId;

  /** « Courir 5 km », objectif 3, créée le lundi 28 septembre, « fait » le 12 et le 14 octobre. */
  beforeEach(async () => {
    dependencies.unitOfWork = new InMemoryUnitOfWork();
    dependencies.clock.setToday(Day.of(2026, 9, 28));
    const created = await createHabit(dependencies, 'Courir 5 km', 'medium', 3);
    running = created.ok ? created.habit.id : 0;
    for (const each of [12, 14]) {
      dependencies.clock.setToday(october(each));
      await toggleCheckIn(dependencies, running, october(each));
    }
    dependencies.clock.setToday(today);
  });

  async function openOn(day: Day) {
    await renderScreen(
      <DayDetailSheet
        opened={await getDayDetail(dependencies, day)}
        today={today}
        onClose={jest.fn()}
      />,
      dependencies,
    );
  }

  it('shows the progress of the week of the day (scenario 6)', async () => {
    await openOn(october(14));

    expect(screen.getByTestId(`habit-progress-${running}`)).toHaveTextContent(
      'Fait · 2/3 semaine du 12 octobre',
    );
    expect(
      row(/^Courir 5 km, mercredi 14 octobre, fait, 2 sur 3 semaine du 12 octobre$/u),
    ).toBeChecked();
    // Le texte du Gherkin en toutes lettres, sans la difficulté (décision UX).
    expect(screen.queryByTestId(`habit-difficulty-${running}`)).toBeNull();
    expect(
      screen.queryByTestId(`habit-target-reached-${running}`, { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('writes « cette semaine » for a day of the current week', async () => {
    await doneOn(running, october(19));
    dependencies.clock.setToday(today);

    await openOn(october(20));

    expect(screen.getByTestId(`habit-progress-${running}`)).toHaveTextContent(
      'Pas fait · 1/3 cette semaine',
    );
  });

  it('carries the badge « Objectif atteint » when the target of the week was reached', async () => {
    await doneOn(running, october(16));
    dependencies.clock.setToday(today);

    await openOn(october(13));

    expect(screen.getByTestId(`habit-progress-${running}`)).toHaveTextContent(
      'Pas fait · 3/3 semaine du 12 octobre',
    );
    expect(
      screen.getByTestId(`habit-target-reached-${running}`, { includeHiddenElements: true }),
    ).toHaveTextContent('Objectif atteint');
  });

  it('shows no progress for a habit without a target of the week, as the week view', async () => {
    const reading = await dependencies.unitOfWork.run(({ habits }) =>
      habits.add(HabitName.parse('Lire'), Day.of(2026, 9, 21)),
    );
    await dependencies.unitOfWork.addSettingsChangeBeforeWeeklyTarget(
      reading.id,
      Day.of(2026, 9, 21),
    );

    await openOn(Day.of(2026, 9, 22));

    expect(row(/^Lire, mardi 22 septembre, pas fait$/u)).toBeOnTheScreen();
    expect(screen.queryByTestId(`habit-progress-${reading.id}`)).toBeNull();
    expect(screen.getByText('Pas fait')).toBeOnTheScreen();
  });

  it('opens with the progress at once, from the month view, before reading the day again', async () => {
    const view = await getMonthView(dependencies);
    const opened = dayDetailOf(view.days[13]!, view.targetsByWeek);
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    let read: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      read = resolve;
    });
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => reading.then(() => run(work)));

    await renderScreen(
      <DayDetailSheet opened={opened} today={today} onClose={jest.fn()} />,
      dependencies,
    );

    expect(screen.getByText('Fait · 2/3 semaine du 12 octobre')).toBeOnTheScreen();
    await act(async () => read());
    expect(screen.getByText('Fait · 2/3 semaine du 12 octobre')).toBeOnTheScreen();
  });

  it('shows the progress read again once a correction is saved', async () => {
    await openOn(october(16));
    expect(screen.getByText('Pas fait · 2/3 semaine du 12 octobre')).toBeOnTheScreen();

    await fireEvent.press(row(/^Courir 5 km, vendredi 16 octobre/u));

    expect(await screen.findByText('Fait · 3/3 semaine du 12 octobre')).toBeOnTheScreen();
    expect(
      screen.getByTestId(`habit-target-reached-${running}`, { includeHiddenElements: true }),
    ).toBeTruthy();
  });
});
