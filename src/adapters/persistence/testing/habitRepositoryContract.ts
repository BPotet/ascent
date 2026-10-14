// Contrat du port HabitRepository : chaque adaptateur doit passer exactement les mêmes tests.
// Les dépôts ne s'obtiennent que dans une unité de travail.
import type { HabitRepository } from '../../../application/ports/HabitRepository';
import type { UnitOfWork } from '../../../application/ports/UnitOfWork';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';

export function describeHabitRepositoryContract(createUnitOfWork: () => Promise<UnitOfWork>): void {
  describe('HabitRepository contract', () => {
    let unitOfWork: UnitOfWork;
    const inTransaction = <T>(work: (habits: HabitRepository) => Promise<T>) =>
      unitOfWork.run(({ habits }) => work(habits));
    const add = (name: string, createdOn = Day.of(2026, 10, 14)) =>
      inTransaction((habits) => habits.add(HabitName.parse(name), createdOn));

    beforeEach(async () => {
      unitOfWork = await createUnitOfWork();
    });

    it('has no habit at first', async () => {
      await expect(inTransaction((habits) => habits.listAll())).resolves.toEqual([]);
    });

    it('gives back the added habit with its name, day of creation and an id', async () => {
      const habit = await add('Cuisiner', Day.of(2026, 10, 14));

      expect(habit.name).toEqual(HabitName.parse('Cuisiner'));
      expect(habit.createdOn).toEqual(Day.of(2026, 10, 14));
      expect(Number.isInteger(habit.id)).toBe(true);
    });

    it('lists the habits in their order of creation, as they were added', async () => {
      const cooking = await add('Cuisiner', Day.of(2026, 10, 1));
      const budget = await add('Budget du jour', Day.of(2026, 10, 14));
      const summer = await add('Été 🍳', Day.of(2024, 2, 29));

      const habits = await inTransaction((repository) => repository.listAll());

      expect(habits).toEqual([cooking, budget, summer]);
      expect(habits.map((habit) => [habit.name.value, habit.createdOn.toIsoString()])).toEqual([
        ['Cuisiner', '2026-10-01'],
        ['Budget du jour', '2026-10-14'],
        ['Été 🍳', '2024-02-29'],
      ]);
    });

    it('gives each habit a greater id than the previous ones', async () => {
      const first = await add('Cuisiner');
      const second = await add('Méditer');
      const third = await add('Lire');

      expect(second.id).toBeGreaterThan(first.id);
      expect(third.id).toBeGreaterThan(second.id);
    });

    it('keeps names of 40 characters', async () => {
      await add('é'.repeat(40));

      const habits = await inTransaction((repository) => repository.listAll());
      expect(habits.map((habit) => habit.name.value)).toEqual(['é'.repeat(40)]);
    });

    it('refuses a habit whose name key already exists', async () => {
      await add('Cuisiner');

      await expect(add('CUISINER')).rejects.toThrow();
      await expect(inTransaction((habits) => habits.listAll())).resolves.toHaveLength(1);
    });

    it('lets accents distinguish two names', async () => {
      await add('Eté sans sucre');
      await add('Été sans sucre');

      await expect(inTransaction((habits) => habits.listAll())).resolves.toHaveLength(2);
    });
  });
}
