import { Character } from '../../domain/character/Character';
import { Day } from '../../domain/day/Day';
import { InMemoryUnitOfWork, StorageUnavailableError } from '../testing/InMemoryUnitOfWork';
import { settableClock } from '../testing/settableClock';
import { getCharacter } from './getCharacter';

describe('getCharacter', () => {
  let unitOfWork: InMemoryUnitOfWork;
  const deps = () => ({ clock: settableClock(Day.of(2026, 10, 14)), unitOfWork });

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork();
  });

  it('gives 0 Xp to a new player', async () => {
    await expect(getCharacter(deps())).resolves.toEqual({ xp: 0 });
  });

  it("gives the character's total experience, retained experience included (R24)", async () => {
    await unitOfWork.run(({ character }) => character.save(new Character(70, 20)));

    await expect(getCharacter(deps())).resolves.toEqual({ xp: 70 });
  });

  it('fails when the character cannot be read', async () => {
    unitOfWork.failReads();

    await expect(getCharacter(deps())).rejects.toThrow(StorageUnavailableError);
  });
});
