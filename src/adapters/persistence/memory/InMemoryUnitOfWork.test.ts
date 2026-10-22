// L'unité de travail en mémoire vit dans `application/testing` (voir son en-tête) ;
// elle passe ici les mêmes tests de contrat que l'adaptateur SQLite.
import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { describeCharacterRepositoryContract } from '../testing/characterRepositoryContract';
import { describeCheckInRepositoryContract } from '../testing/checkInRepositoryContract';
import { describeHabitRepositoryContract } from '../testing/habitRepositoryContract';
import { describeSettingsChangeRepositoryContract } from '../testing/settingsChangeRepositoryContract';
import { describeUnitOfWorkContract } from '../testing/unitOfWorkContract';

describe('InMemoryUnitOfWork', () => {
  const createUnitOfWork = async () => new InMemoryUnitOfWork();

  describeUnitOfWorkContract(createUnitOfWork);
  describeHabitRepositoryContract(createUnitOfWork);
  describeCheckInRepositoryContract(createUnitOfWork);
  describeCharacterRepositoryContract(createUnitOfWork);
  describeSettingsChangeRepositoryContract(createUnitOfWork);

  describe('seeding a change made before the weekly target', () => {
    const monday5 = Day.of(2026, 10, 5);

    it('stores it with an empty weekly target, after the other changes', async () => {
      const unitOfWork = new InMemoryUnitOfWork();
      const cooking = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Cuisiner'), monday5),
      );
      const created = await unitOfWork.run(({ settingsChanges }) =>
        settingsChanges.add(cooking.id, monday5, { difficulty: 'hard', weeklyTarget: 3 }),
      );

      const seeded = await unitOfWork.addSettingsChangeBeforeWeeklyTarget(cooking.id, monday5);
      const easy = await unitOfWork.addSettingsChangeBeforeWeeklyTarget(
        cooking.id,
        monday5,
        'easy',
      );

      expect(seeded).toEqual({
        habitId: cooking.id,
        changedOn: monday5,
        sequence: created.sequence + 1,
        difficulty: 'medium',
        weeklyTarget: null,
      });
      expect(easy).toMatchObject({ difficulty: 'easy', weeklyTarget: null });
      await expect(
        unitOfWork.run(({ settingsChanges }) => settingsChanges.listByHabit(cooking.id)),
      ).resolves.toEqual([created, seeded, easy]);
    });

    it('refuses it for a habit that does not exist, and stores nothing', async () => {
      const unitOfWork = new InMemoryUnitOfWork();

      await expect(unitOfWork.addSettingsChangeBeforeWeeklyTarget(1, monday5)).rejects.toThrow(
        /FOREIGN KEY/,
      );
      await expect(
        unitOfWork.run(({ settingsChanges }) => settingsChanges.listAll()),
      ).resolves.toEqual([]);
    });
  });
});
