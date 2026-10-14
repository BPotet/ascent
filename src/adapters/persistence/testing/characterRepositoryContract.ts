// Contrat du port CharacterRepository : chaque adaptateur doit passer exactement les mêmes tests.
// Les dépôts ne s'obtiennent que dans une unité de travail.
import type { Repositories, UnitOfWork } from '../../../application/ports/UnitOfWork';
import { Character } from '../../../domain/character/Character';

export function describeCharacterRepositoryContract(
  createUnitOfWork: () => Promise<UnitOfWork>,
): void {
  describe('CharacterRepository contract', () => {
    let unitOfWork: UnitOfWork;

    const inTransaction = <T>(work: (repositories: Repositories) => Promise<T>) =>
      unitOfWork.run(work);
    const get = () => inTransaction(({ character }) => character.get());
    const save = (character: Character) =>
      inTransaction((repositories) => repositories.character.save(character));

    beforeEach(async () => {
      unitOfWork = await createUnitOfWork();
    });

    it('has a character with no experience at first', async () => {
      await expect(get()).resolves.toEqual(Character.NEW);
    });

    it('gives back the saved character, with its retained experience', async () => {
      await save(new Character(70, 20));

      const character = await get();
      expect(character).toBeInstanceOf(Character);
      expect(character).toEqual(new Character(70, 20));
    });

    it('keeps a single character, the last one saved', async () => {
      await save(new Character(40));
      await save(new Character(30));
      await save(new Character(0));

      await expect(get()).resolves.toEqual(new Character(0));
    });

    it('keeps nothing of a failed work', async () => {
      await save(new Character(30));

      await expect(
        inTransaction(async ({ character }) => {
          await character.save(new Character(40));
          throw new Error('work failed');
        }),
      ).rejects.toThrow('work failed');

      await expect(get()).resolves.toEqual(new Character(30));
    });

    it('counts each of several gains requested together', async () => {
      const gain = () =>
        inTransaction(async ({ character }) => {
          const current = await character.get();
          await new Promise((resolve) => setTimeout(resolve, 0));
          await character.save(current.applyCheckInChange(true));
        });

      await Promise.all([gain(), gain(), gain()]);

      await expect(get()).resolves.toEqual(new Character(30));
    });
  });
}
