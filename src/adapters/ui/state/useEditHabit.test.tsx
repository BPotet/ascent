import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { settableClock } from '../../../application/testing/settableClock';
import { createHabit } from '../../../application/useCases/createHabit';
import { getDayView } from '../../../application/useCases/getDayView';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { type UpdateHabitInput, updateHabit } from '../../../application/useCases/updateHabit';
import { Day } from '../../../domain/day/Day';
import type { Habit } from '../../../domain/habit/Habit';
import { memoryKeyValueStore } from '../testing/memoryKeyValueStore';
import { DependenciesProvider } from './Dependencies';
import { useExperience } from './Experience';
import { useTrackingChanges } from './TrackingRevision';
import { useEditHabit } from './useEditHabit';

const tuesday = Day.of(2026, 10, 13);
const wednesday = Day.of(2026, 10, 14);
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);

let dependencies: {
  clock: ReturnType<typeof settableClock>;
  unitOfWork: InMemoryUnitOfWork;
  keyValueStore: ReturnType<typeof memoryKeyValueStore>;
  haptics: { success: jest.Mock };
};
let cooking: Habit;

beforeEach(async () => {
  announce.mockClear();
  dependencies = {
    clock: settableClock(tuesday),
    unitOfWork: new InMemoryUnitOfWork(),
    keyValueStore: memoryKeyValueStore(),
    haptics: { success: jest.fn() },
  };
  const created = await createHabit(dependencies, 'Cuisiner');
  if (!created.ok) {
    throw new Error('Habit not created');
  }
  cooking = created.habit;
  await createHabit(dependencies, 'Budget du jour');
  dependencies.clock.setToday(wednesday);
});

/** Lance `operation` dans `act`, et renvoie son résultat une fois l'affichage à jour. */
async function inAct<T>(operation: () => Promise<T>): Promise<T> {
  let outcome: T | undefined;
  await act(async () => {
    outcome = await operation();
  });
  return outcome as T;
}

async function setUp() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DependenciesProvider value={dependencies}>{children}</DependenciesProvider>
  );
  const otherReload = jest.fn();
  const { result } = await renderHook(
    () => {
      useTrackingChanges(otherReload);
      return { edit: useEditHabit(), experience: useExperience() };
    },
    { wrapper },
  );
  await waitFor(() => expect(result.current.experience.xp).not.toBeNull());
  otherReload.mockClear();
  return {
    update: (input: UpdateHabitInput, id = cooking.id) =>
      inAct(() => result.current.edit.update(id, input)),
    currentSettings: (id = cooking.id) => inAct(() => result.current.edit.currentSettings(id)),
    preview: (id = cooking.id) => inAct(() => result.current.edit.previewDeletion(id)),
    remove: (id = cooking.id) => inAct(() => result.current.edit.remove(id)),
    experience: () => result.current.experience,
    otherReload,
  };
}

async function names(): Promise<string[]> {
  const view = await getDayView(dependencies);
  return view.habits.map(({ habit }) => habit.name.value);
}

describe('useEditHabit', () => {
  describe('update', () => {
    it('renames the habit, keeps its difficulty and makes the other views reload', async () => {
      const { update, experience, otherReload } = await setUp();

      const outcome = await update({ name: '  Cuisiner maison ' });

      expect(outcome).toMatchObject({
        ok: true,
        nameChanged: true,
        settingsChanged: false,
        weekSettings: { difficulty: 'medium' },
        xpChange: 0,
      });
      expect(outcome.ok && outcome.habit.name.value).toBe('Cuisiner maison');
      expect(await names()).toEqual(['Cuisiner maison', 'Budget du jour']);
      expect(experience().change).toBeNull();
      expect(otherReload).toHaveBeenCalledTimes(1);
    });

    it('changes the difficulty: the current week is re-evaluated and shown in the header', async () => {
      await toggleCheckIn(dependencies, cooking.id, tuesday);
      await toggleCheckIn(dependencies, cooking.id, wednesday);
      const { update, experience, otherReload } = await setUp();
      expect(experience().xp).toBe(20);

      const outcome = await update({ name: 'Cuisiner', difficulty: 'hard' });

      expect(outcome).toMatchObject({
        ok: true,
        nameChanged: false,
        settingsChanged: true,
        weekSettings: { difficulty: 'hard' },
        xpChange: 20,
        xp: 40,
      });
      expect(experience().xp).toBe(40);
      expect(experience().change).toMatchObject({ amount: 20 });
      expect(dependencies.haptics.success).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenLastCalledWith('+20 points d’expérience. Total : 40 XP.');
      expect(otherReload).toHaveBeenCalledTimes(1);
    });

    it('lowers the difficulty without vibration', async () => {
      await toggleCheckIn(dependencies, cooking.id, wednesday);
      const { update, experience } = await setUp();

      await update({ name: 'Cuisiner', difficulty: 'easy' });

      expect(experience().xp).toBe(5);
      expect(experience().change).toMatchObject({ amount: -5 });
      expect(dependencies.haptics.success).not.toHaveBeenCalled();
    });

    it('gives the reason of a refusal, without making the other views reload', async () => {
      const { update, otherReload } = await setUp();

      await expect(update({ name: 'budget du jour', difficulty: 'hard' })).resolves.toEqual({
        ok: false,
        reason: 'duplicate',
      });
      expect(otherReload).not.toHaveBeenCalled();
    });

    it('turns a storage failure into « saveFailed », and changes nothing', async () => {
      await toggleCheckIn(dependencies, cooking.id, wednesday);
      const { update, experience, otherReload } = await setUp();
      dependencies.unitOfWork.failWrites();

      await expect(update({ name: 'Cuisiner', difficulty: 'hard' })).resolves.toEqual({
        ok: false,
        reason: 'saveFailed',
      });

      dependencies.unitOfWork.failWrites(false);
      const [row] = (await getDayView(dependencies)).habits;
      expect(row?.weekSettings).toMatchObject({ difficulty: 'medium' });
      expect(experience().xp).toBe(10);
      expect(experience().change).toBeNull();
      expect(otherReload).not.toHaveBeenCalled();
    });

    it('makes the other views reload when the habit no longer exists', async () => {
      const { update, otherReload } = await setUp();

      await expect(update({ name: 'Lire' }, 99)).resolves.toEqual({
        ok: false,
        reason: 'unknownHabit',
      });
      expect(otherReload).toHaveBeenCalledTimes(1);
    });
  });

  describe('currentSettings', () => {
    it('gives the settings to edit, whatever week is shown', async () => {
      dependencies.clock.setToday(tuesday);
      await updateHabit(dependencies, cooking.id, {
        name: 'Cuisiner',
        difficulty: 'easy',
        weeklyTarget: 3,
      });
      dependencies.clock.setToday(wednesday);
      const { currentSettings, otherReload } = await setUp();

      await expect(currentSettings()).resolves.toEqual({
        ok: true,
        // Changé le jour de création (mardi) : l'objectif vaut dès cette semaine.
        weekSettings: { difficulty: 'easy', weeklyTarget: 3, weekTarget: 3 },
        nextWeeklyTarget: 3,
        targetChangeAppliesThisWeek: false,
      });
      expect(otherReload).not.toHaveBeenCalled();
    });

    it('says a change of target applies this week on the day of creation', async () => {
      const { currentSettings } = await setUp();
      const created = await createHabit(dependencies, 'Lire', 'medium', 3);
      if (!created.ok) {
        throw new Error('Lire not created');
      }

      await expect(currentSettings(created.habit.id)).resolves.toMatchObject({
        ok: true,
        nextWeeklyTarget: 3,
        targetChangeAppliesThisWeek: true,
      });
    });

    it('turns a storage failure into « readFailed »', async () => {
      const { currentSettings } = await setUp();
      dependencies.unitOfWork.failReads();

      await expect(currentSettings()).resolves.toEqual({ ok: false, reason: 'readFailed' });
    });

    it('makes the other views reload when the habit no longer exists', async () => {
      const { currentSettings, otherReload } = await setUp();

      await expect(currentSettings(99)).resolves.toEqual({ ok: false, reason: 'unknownHabit' });
      expect(otherReload).toHaveBeenCalledTimes(1);
    });
  });

  describe('previewDeletion', () => {
    it('gives the name and the experience the deletion would remove', async () => {
      await toggleCheckIn(dependencies, cooking.id, wednesday);
      const { preview, otherReload } = await setUp();

      await expect(preview()).resolves.toEqual({ ok: true, name: 'Cuisiner', xpRemoved: 10 });
      expect(otherReload).not.toHaveBeenCalled();
    });

    it('turns a storage failure into « readFailed »', async () => {
      const { preview } = await setUp();
      dependencies.unitOfWork.failReads();

      await expect(preview()).resolves.toEqual({ ok: false, reason: 'readFailed' });
    });

    it('makes the other views reload when the habit no longer exists', async () => {
      const { preview, otherReload } = await setUp();

      await expect(preview(99)).resolves.toEqual({ ok: false, reason: 'unknownHabit' });
      expect(otherReload).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('deletes the habit, shows the experience removed and makes the other views reload', async () => {
      await toggleCheckIn(dependencies, cooking.id, tuesday);
      await toggleCheckIn(dependencies, cooking.id, wednesday);
      const { remove, experience, otherReload } = await setUp();
      expect(experience().xp).toBe(20);

      await expect(remove()).resolves.toEqual({ ok: true, xpRemoved: 10, xp: 10 });

      expect(await names()).toEqual(['Budget du jour']);
      expect(experience().xp).toBe(10);
      expect(experience().change).toMatchObject({ amount: -10 });
      expect(announce).toHaveBeenLastCalledWith('−10 points d’expérience. Total : 10 XP.');
      expect(otherReload).toHaveBeenCalledTimes(1);
    });

    it('turns a storage failure into « saveFailed », and changes nothing', async () => {
      await toggleCheckIn(dependencies, cooking.id, wednesday);
      const { remove, experience, otherReload } = await setUp();
      dependencies.unitOfWork.failWrites();

      await expect(remove()).resolves.toEqual({ ok: false, reason: 'saveFailed' });

      dependencies.unitOfWork.failWrites(false);
      expect(await names()).toEqual(['Cuisiner', 'Budget du jour']);
      expect(experience().xp).toBe(10);
      expect(experience().change).toBeNull();
      expect(otherReload).not.toHaveBeenCalled();
    });

    it('makes the other views reload when the habit no longer exists', async () => {
      const { remove, experience, otherReload } = await setUp();

      await expect(remove(99)).resolves.toEqual({ ok: false, reason: 'unknownHabit' });
      expect(experience().change).toBeNull();
      expect(otherReload).toHaveBeenCalledTimes(1);
    });
  });
});
