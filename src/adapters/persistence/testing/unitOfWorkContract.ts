// Contrat du port UnitOfWork : chaque adaptateur doit passer exactement les mêmes tests.
import type { UnitOfWork } from '../../../application/ports/UnitOfWork';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';

const day = Day.of(2026, 10, 14);
const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

export function describeUnitOfWorkContract(createUnitOfWork: () => Promise<UnitOfWork>): void {
  describe('UnitOfWork contract', () => {
    let unitOfWork: UnitOfWork;

    const habitNames = async () =>
      (await unitOfWork.run(({ habits }) => habits.listAll())).map((habit) => habit.name.value);

    beforeEach(async () => {
      unitOfWork = await createUnitOfWork();
    });

    it('returns the result of the work', async () => {
      await expect(unitOfWork.run(async () => 42)).resolves.toBe(42);
    });

    it('keeps what a successful work wrote', async () => {
      await unitOfWork.run(({ habits }) => habits.add(HabitName.parse('Cuisiner'), day));

      expect(await habitNames()).toEqual(['Cuisiner']);
    });

    it('keeps nothing of a failed work and gives back its error', async () => {
      await unitOfWork.run(({ habits }) => habits.add(HabitName.parse('Cuisiner'), day));
      const failure = new Error('work failed');

      await expect(
        unitOfWork.run(async ({ habits }) => {
          await habits.add(HabitName.parse('Méditer'), day);
          throw failure;
        }),
      ).rejects.toBe(failure);

      expect(await habitNames()).toEqual(['Cuisiner']);
    });

    it('runs one work at a time, in the order they were requested', async () => {
      const events: string[] = [];
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });

      const first = unitOfWork.run(async ({ habits }) => {
        events.push('first starts');
        await gate;
        await habits.add(HabitName.parse('Cuisiner'), day);
        events.push('first ends');
      });
      const second = unitOfWork.run(async ({ habits }) => {
        events.push('second starts');
        return (await habits.listAll()).length;
      });
      await nextTurn();
      expect(events).toEqual(['first starts']);

      release();

      await first;
      await expect(second).resolves.toBe(1);
      expect(events).toEqual(['first starts', 'first ends', 'second starts']);
    });

    it('goes on with the next work after a failed one', async () => {
      const failed = unitOfWork.run(async () => {
        throw new Error('work failed');
      });
      const next = unitOfWork.run(async () => 'done');

      await expect(failed).rejects.toThrow('work failed');
      await expect(next).resolves.toBe('done');
    });
  });
}
