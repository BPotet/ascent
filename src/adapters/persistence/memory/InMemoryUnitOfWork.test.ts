// L'unité de travail en mémoire vit dans `application/testing` (voir son en-tête) ;
// elle passe ici les mêmes tests de contrat que l'adaptateur SQLite.
import { InMemoryUnitOfWork } from '../../../application/testing/InMemoryUnitOfWork';
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
});
