// Contrat du port IntroductionRepository : chaque adaptateur doit passer exactement les mêmes tests.
// Les dépôts ne s'obtiennent que dans une unité de travail.
import type { Repositories, UnitOfWork } from '../../../application/ports/UnitOfWork';
import { Character } from '../../../domain/character/Character';
import { Day } from '../../../domain/day/Day';

const wednesday14 = Day.of(2026, 10, 14);

export function describeIntroductionRepositoryContract(
  createUnitOfWork: () => Promise<UnitOfWork>,
): void {
  describe('IntroductionRepository contract', () => {
    let unitOfWork: UnitOfWork;

    const inTransaction = <T>(work: (repositories: Repositories) => Promise<T>) =>
      unitOfWork.run(work);
    const has = () => inTransaction(({ introductions }) => introductions.has('targetBonus'));
    const add = () =>
      inTransaction(({ introductions }) => introductions.add('targetBonus', wednesday14));

    beforeEach(async () => {
      unitOfWork = await createUnitOfWork();
    });

    it('has no introduction at first', async () => {
      await expect(has()).resolves.toBe(false);
    });

    it('has the introduction once added', async () => {
      await add();

      await expect(has()).resolves.toBe(true);
    });

    it('refuses to add the same introduction twice, and keeps the first', async () => {
      await add();

      await expect(add()).rejects.toThrow();
      await expect(has()).resolves.toBe(true);
    });

    it('keeps neither the introduction nor the experience of a failed work', async () => {
      await expect(
        inTransaction(async ({ introductions, character }) => {
          await character.save(new Character(35));
          await introductions.add('targetBonus', wednesday14);
          throw new Error('work failed');
        }),
      ).rejects.toThrow('work failed');

      await expect(has()).resolves.toBe(false);
      await expect(inTransaction(({ character }) => character.get())).resolves.toEqual(
        Character.NEW,
      );
    });
  });
}
