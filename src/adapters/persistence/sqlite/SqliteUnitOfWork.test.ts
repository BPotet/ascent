import { describeCheckInRepositoryContract } from '../testing/checkInRepositoryContract';
import { describeHabitRepositoryContract } from '../testing/habitRepositoryContract';
import { FakeExpoSqliteConnection } from '../testing/fakeExpoSqlite';
import { withFaults } from '../testing/faultySqlDatabase';
import { openNodeSqliteDatabase } from '../testing/nodeSqliteDatabase';
import { readsFrom, readsFromWith, SimulatedStorageError, writesTo } from '../testing/sqlFaults';
import { describeUnitOfWorkContract } from '../testing/unitOfWorkContract';
import { Day } from '../../../domain/day/Day';
import { HabitName } from '../../../domain/habit/HabitName';
import { prepareExpoSqliteDatabase } from './expoSqliteDatabase';
import { prepareAscentDatabase } from './prepareAscentDatabase';
import { SqliteUnitOfWork } from './SqliteUnitOfWork';

const createUnitOfWork = async () =>
  new SqliteUnitOfWork(await prepareAscentDatabase(openNodeSqliteDatabase()));

describe('SqliteUnitOfWork', () => {
  describeUnitOfWorkContract(createUnitOfWork);
  describeHabitRepositoryContract(createUnitOfWork);
  describeCheckInRepositoryContract(createUnitOfWork);

  describe('on the expo-sqlite bridge', () => {
    const createOnExpo = async () =>
      new SqliteUnitOfWork(await prepareExpoSqliteDatabase(FakeExpoSqliteConnection.open()));

    describeUnitOfWorkContract(createOnExpo);
    describeHabitRepositoryContract(createOnExpo);
    describeCheckInRepositoryContract(createOnExpo);

    it('sends every statement of a work on the shared connection, inside one transaction', async () => {
      const connection = FakeExpoSqliteConnection.open();
      const unitOfWork = new SqliteUnitOfWork(await prepareExpoSqliteDatabase(connection));
      connection.statements.length = 0;

      await unitOfWork.run(async ({ habits }) => {
        await habits.add(HabitName.parse('Cuisiner'), Day.of(2026, 10, 14));
        return habits.listAll();
      });

      expect(
        connection.statements.map(({ connection: name, sql }) => [name, sql.split(' ')[0]]),
      ).toEqual([
        ['main', 'BEGIN'],
        ['main', 'INSERT'],
        ['main', 'SELECT'],
        ['main', 'COMMIT'],
      ]);
    });

    it('keeps the habits when the database is reopened', async () => {
      const connection = FakeExpoSqliteConnection.open();
      await new SqliteUnitOfWork(await prepareExpoSqliteDatabase(connection)).run(({ habits }) =>
        habits.add(HabitName.parse('Cuisiner'), Day.of(2026, 10, 14)),
      );

      const reopened = new SqliteUnitOfWork(await prepareExpoSqliteDatabase(connection.reopen()));

      const habits = await reopened.run((repositories) => repositories.habits.listAll());
      expect(habits.map((habit) => habit.name.value)).toEqual(['Cuisiner']);
    });

    it('keeps names, days of creation, order and duplicates refused after a restart', async () => {
      const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
      const connection = FakeExpoSqliteConnection.open();
      await new SqliteUnitOfWork(await prepareExpoSqliteDatabase(connection)).run(
        async ({ habits }) => {
          await habits.add(HabitName.parse('Été sans sucre'), Day.of(2024, 2, 29));
          await habits.add(HabitName.parse(`Repas ${family}`), Day.of(2026, 12, 31));
        },
      );

      const reopened = new SqliteUnitOfWork(await prepareExpoSqliteDatabase(connection.reopen()));

      const habits = await reopened.run((repositories) => repositories.habits.listAll());
      expect(habits.map(({ name, createdOn }) => [name.value, createdOn.toIsoString()])).toEqual([
        ['Été sans sucre', '2024-02-29'],
        [`Repas ${family}`, '2026-12-31'],
      ]);
      await expect(
        reopened.run(({ habits: repository }) =>
          repository.add(HabitName.parse('ÉTÉ SANS SUCRE'), Day.of(2026, 10, 14)),
        ),
      ).rejects.toThrow();
      await expect(
        reopened.run((repositories) => repositories.habits.listAll()),
      ).resolves.toHaveLength(2);
    });
  });

  describe('storage failures', () => {
    const day = Day.of(2026, 10, 14);

    it('fails, and keeps the stored habits, when the habits cannot be read', async () => {
      const db = withFaults(await prepareAscentDatabase(openNodeSqliteDatabase()));
      const unitOfWork = new SqliteUnitOfWork(db);
      await unitOfWork.run(({ habits }) => habits.add(HabitName.parse('Cuisiner'), day));

      db.faults.failWhen(readsFrom('habits'));
      await expect(unitOfWork.run(({ habits }) => habits.listAll())).rejects.toThrow(
        SimulatedStorageError,
      );

      db.faults.failWhen(null);
      const habits = await unitOfWork.run((repositories) => repositories.habits.listAll());
      expect(habits.map((habit) => habit.name.value)).toEqual(['Cuisiner']);
    });

    it('stores nothing when a habit cannot be written', async () => {
      const db = withFaults(await prepareAscentDatabase(openNodeSqliteDatabase()));
      const unitOfWork = new SqliteUnitOfWork(db);

      db.faults.failWhen(writesTo('habits'));
      await expect(
        unitOfWork.run(({ habits }) => habits.add(HabitName.parse('Méditer'), day)),
      ).rejects.toThrow(SimulatedStorageError);

      db.faults.failWhen(null);
      await expect(unitOfWork.run(({ habits }) => habits.listAll())).resolves.toEqual([]);
    });

    it('keeps the stored check-in when a check-in cannot be written', async () => {
      const db = withFaults(await prepareAscentDatabase(openNodeSqliteDatabase()));
      const unitOfWork = new SqliteUnitOfWork(db);
      const cooking = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Cuisiner'), day),
      );
      const done = { habitId: cooking.id, day, done: true, corrected: false };
      await unitOfWork.run(({ checkIns }) => checkIns.save(done));

      db.faults.failWhen(writesTo('check_ins'));
      await expect(
        unitOfWork.run(({ checkIns }) => checkIns.save({ ...done, done: false })),
      ).rejects.toThrow(SimulatedStorageError);

      db.faults.failWhen(null);
      await expect(
        unitOfWork.run(({ checkIns }) => checkIns.find(cooking.id, day)),
      ).resolves.toEqual(done);
    });

    it.each([
      [
        'the SQL database',
        async () => withFaults(await prepareAscentDatabase(openNodeSqliteDatabase())),
      ],
      [
        'the expo-sqlite bridge',
        async () => {
          const connection = FakeExpoSqliteConnection.open();
          return Object.assign(await prepareExpoSqliteDatabase(connection), {
            faults: connection.faults,
          });
        },
      ],
    ])('on %s, fails the reads of the check-ins of one week only', async (_, open) => {
      const db = await open();
      const unitOfWork = new SqliteUnitOfWork(db);
      const lastWeek = [Day.of(2026, 10, 5), Day.of(2026, 10, 11)] as const;
      const thisWeek = [Day.of(2026, 10, 12), Day.of(2026, 10, 18)] as const;

      db.faults.failWhen(readsFromWith('check_ins', '2026-10-05'));

      await expect(
        unitOfWork.run(({ checkIns }) => checkIns.listBetween(...lastWeek)),
      ).rejects.toThrow(SimulatedStorageError);
      await expect(
        unitOfWork.run(({ checkIns }) => checkIns.listBetween(...thisWeek)),
      ).resolves.toEqual([]);
      await expect(unitOfWork.run(({ habits }) => habits.listAll())).resolves.toEqual([]);
    });
  });
});
