import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { deleteHabit } from '../../../application/useCases/deleteHabit';
import { updateHabit } from '../../../application/useCases/updateHabit';
import { Day } from '../../../domain/day/Day';
import { Habit } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { renderScreen } from '../testing/renderScreen';
import { silentHaptics } from '../testing/silentHaptics';
import { HabitEditing, type UpdatedHabit, updatedMessage } from './HabitEditing';

const updated = (change: Partial<UpdatedHabit>): UpdatedHabit => ({
  ok: true,
  habit: new Habit(1, HabitName.parse('Cuisiner'), Day.of(2026, 10, 5)),
  weekSettings: { difficulty: 'medium', weeklyTarget: 7, weekTarget: 7 },
  nextWeeklyTarget: 7,
  nameChanged: false,
  settingsChanged: false,
  xpChange: 0,
  xp: 0,
  ...change,
});

describe('updatedMessage', () => {
  it('says « Habitude renommée » when only the name changed', () => {
    expect(updatedMessage(updated({ nameChanged: true }))).toBe('Habitude renommée');
  });

  it('says « Habitude modifiée » with the change of experience (mockup E7)', () => {
    expect(updatedMessage(updated({ settingsChanged: true, xpChange: 20 }))).toBe(
      'Habitude modifiée · +20 XP',
    );
    expect(updatedMessage(updated({ settingsChanged: true, xpChange: -30 }))).toBe(
      'Habitude modifiée · −30 XP',
    );
  });

  it('says « Habitude modifiée » alone when the experience did not change', () => {
    expect(updatedMessage(updated({ settingsChanged: true, nameChanged: true }))).toBe(
      'Habitude modifiée',
    );
    expect(updatedMessage(updated({}))).toBe('Habitude modifiée');
  });
});

describe('HabitEditing', () => {
  const wednesday = Day.of(2026, 10, 14);
  let dependencies: {
    clock: ReturnType<typeof settableClock>;
    unitOfWork: InMemoryUnitOfWork;
    keyValueStore: ReturnType<typeof memoryKeyValueStore>;
    haptics: ReturnType<typeof silentHaptics>;
  };
  let cooking: Habit;

  beforeEach(async () => {
    dependencies = {
      clock: settableClock(wednesday),
      unitOfWork: new InMemoryUnitOfWork(),
      keyValueStore: memoryKeyValueStore(),
      haptics: silentHaptics(),
    };
    const created = await createHabit(dependencies, 'Cuisiner');
    if (!created.ok) {
      throw new Error('Cuisiner not created');
    }
    cooking = created.habit;
    await updateHabit(dependencies, cooking.id, { name: 'Cuisiner', difficulty: 'hard' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Retient les lectures jusqu'à `release`, pour agir avant la réponse. */
  function holdReads() {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = dependencies.unitOfWork.run.bind(dependencies.unitOfWork);
    jest
      .spyOn(dependencies.unitOfWork, 'run')
      .mockImplementation((work) => held.then(() => run(work)));
    return () => act(async () => release());
  }

  const callbacks = () => ({
    onUpdated: jest.fn(),
    onDeleted: jest.fn(),
    onGone: jest.fn(),
    onReadFailed: jest.fn(),
    onClose: jest.fn(),
  });

  /** « Modifier l'habitude » ouvert depuis une autre semaine : les réglages sont à lire. */
  const editing = (props: ReturnType<typeof callbacks>) => (
    <HabitEditing habit={cooking} settings={undefined} habits={[cooking]} {...props} />
  );

  it('opens the sheet with the settings of the current week once they are read', async () => {
    const props = callbacks();
    const release = holdReads();
    await renderScreen(editing(props), dependencies);

    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();

    await release();

    expect(await screen.findByTestId('edit-habit-sheet')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^Difficile,/u })).toBeChecked();
    expect(props.onGone).not.toHaveBeenCalled();
    expect(props.onReadFailed).not.toHaveBeenCalled();
  });

  it('reads the weekly target and the day of creation of the habit with its settings', async () => {
    const props = callbacks();
    await renderScreen(editing(props), dependencies);

    expect(
      await screen.findByRole('radio', { name: '7 fois par semaine, tous les jours' }),
    ).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: '3 fois par semaine' }));

    // « Cuisiner » a été créée aujourd'hui : le nouvel objectif vaut dès cette semaine.
    expect(screen.getByTestId('weekly-target-change-info')).toHaveAccessibleName(
      /^Habitude créée aujourd’hui/u,
    );
  });

  it('opens the sheet with the settings given, without reading them', async () => {
    const props = callbacks();
    dependencies.unitOfWork.failReads();

    await renderScreen(
      <HabitEditing
        habit={cooking}
        settings={{
          weekSettings: { difficulty: 'easy', weeklyTarget: 7, weekTarget: 7 },
          nextWeeklyTarget: 4,
          targetChangeAppliesThisWeek: false,
        }}
        habits={[cooking]}
        {...props}
      />,
      dependencies,
    );

    expect(await screen.findByTestId('edit-habit-sheet')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^Facile,/u })).toBeChecked();
    expect(screen.getByRole('radio', { name: '4 fois par semaine' })).toBeChecked();
    expect(props.onReadFailed).not.toHaveBeenCalled();
  });

  it('calls « onGone », without opening, when the habit no longer exists', async () => {
    const props = callbacks();
    await deleteHabit(dependencies, cooking.id);

    await renderScreen(editing(props), dependencies);

    await waitFor(() => expect(props.onGone).toHaveBeenCalledTimes(1));
    expect(props.onReadFailed).not.toHaveBeenCalled();
    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
  });

  it('calls « onReadFailed », without opening, when the settings cannot be read', async () => {
    const props = callbacks();
    dependencies.unitOfWork.failReads();

    await renderScreen(editing(props), dependencies);

    await waitFor(() => expect(props.onReadFailed).toHaveBeenCalledTimes(1));
    expect(props.onGone).not.toHaveBeenCalled();
    expect(screen.queryByTestId('edit-habit-sheet')).not.toBeOnTheScreen();
  });

  it('calls the latest callbacks of the screen, without reading again', async () => {
    const first = callbacks();
    const latest = callbacks();
    dependencies.unitOfWork.failReads();
    const release = holdReads();
    const { rerender } = await renderScreen(editing(first), dependencies);
    const reads = jest.mocked(dependencies.unitOfWork.run).mock.calls.length;

    await rerender(editing(latest));
    expect(dependencies.unitOfWork.run).toHaveBeenCalledTimes(reads);
    await release();

    await waitFor(() => expect(latest.onReadFailed).toHaveBeenCalledTimes(1));
    expect(first.onReadFailed).not.toHaveBeenCalled();
  });

  it('calls nothing once closed before the settings are read', async () => {
    const gone = callbacks();
    const failed = callbacks();
    await deleteHabit(dependencies, cooking.id);
    const releaseGone = holdReads();
    await renderScreen(editing(gone), dependencies);
    await act(async () => screen.unmount());
    await releaseGone();

    jest.restoreAllMocks();
    dependencies.unitOfWork.failReads();
    const releaseFailed = holdReads();
    await renderScreen(editing(failed), dependencies);
    await act(async () => screen.unmount());
    await releaseFailed();

    expect(gone.onGone).not.toHaveBeenCalled();
    expect(failed.onReadFailed).not.toHaveBeenCalled();
  });
});
