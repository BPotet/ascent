import { describeCharacterRepositoryContract } from '../testing/characterRepositoryContract';
import { describeCheckInRepositoryContract } from '../testing/checkInRepositoryContract';
import { describeHabitRepositoryContract } from '../testing/habitRepositoryContract';
import { describeSettingsChangeRepositoryContract } from '../testing/settingsChangeRepositoryContract';
import { FakeExpoSqliteConnection } from '../testing/fakeExpoSqlite';
import { withFaults } from '../testing/faultySqlDatabase';
import { openNodeSqliteDatabase } from '../testing/nodeSqliteDatabase';
import { readsFrom, readsFromWith, SimulatedStorageError, writesTo } from '../testing/sqlFaults';
import { describeUnitOfWorkContract } from '../testing/unitOfWorkContract';
import { deleteHabit } from '../../../application/useCases/deleteHabit';
import { createHabit } from '../../../application/useCases/createHabit';
import { toggleCheckIn } from '../../../application/useCases/toggleCheckIn';
import { updateHabit } from '../../../application/useCases/updateHabit';
import { Character } from '../../../domain/character/Character';
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
  describeCharacterRepositoryContract(createUnitOfWork);
  describeSettingsChangeRepositoryContract(createUnitOfWork);

  describe('on the expo-sqlite bridge', () => {
    const createOnExpo = async () =>
      new SqliteUnitOfWork(await prepareExpoSqliteDatabase(FakeExpoSqliteConnection.open()));

    describeUnitOfWorkContract(createOnExpo);
    describeHabitRepositoryContract(createOnExpo);
    describeCheckInRepositoryContract(createOnExpo);
    describeCharacterRepositoryContract(createOnExpo);
    describeSettingsChangeRepositoryContract(createOnExpo);

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

    it('keeps the stored character when the character cannot be written', async () => {
      const db = withFaults(await prepareAscentDatabase(openNodeSqliteDatabase()));
      const unitOfWork = new SqliteUnitOfWork(db);
      await unitOfWork.run(({ character }) => character.save(new Character(30)));

      db.faults.failWhen(writesTo('character'));
      await expect(
        unitOfWork.run(({ character }) => character.save(new Character(40))),
      ).rejects.toThrow(SimulatedStorageError);

      db.faults.failWhen(null);
      await expect(unitOfWork.run(({ character }) => character.get())).resolves.toEqual(
        new Character(30),
      );
    });

    it('saves no check-in of a toggle whose experience cannot be written', async () => {
      const db = withFaults(await prepareAscentDatabase(openNodeSqliteDatabase()));
      const unitOfWork = new SqliteUnitOfWork(db);
      const cooking = await unitOfWork.run(({ habits }) =>
        habits.add(HabitName.parse('Cuisiner'), day),
      );

      db.faults.failWhen(writesTo('character'));
      await expect(
        toggleCheckIn({ clock: { today: () => day }, unitOfWork }, cooking.id, day),
      ).rejects.toThrow(SimulatedStorageError);

      db.faults.failWhen(null);
      await expect(
        unitOfWork.run(({ checkIns }) => checkIns.find(cooking.id, day)),
      ).resolves.toBeNull();
      await expect(unitOfWork.run(({ character }) => character.get())).resolves.toEqual(
        Character.NEW,
      );
    });

    // Les suivis sont effacés par la cascade de `DELETE FROM habits`, sans requête à eux.
    it.each(['habits', 'character'])(
      'deletes nothing, and keeps the experience, when %s cannot be written (#6)',
      async (table) => {
        const db = withFaults(await prepareAscentDatabase(openNodeSqliteDatabase()));
        const unitOfWork = new SqliteUnitOfWork(db);
        const deps = { clock: { today: () => day }, unitOfWork };
        const cooking = await unitOfWork.run(({ habits }) =>
          habits.add(HabitName.parse('Cuisiner'), day.plusDays(-2)),
        );
        await toggleCheckIn(deps, cooking.id, day.plusDays(-1));
        await toggleCheckIn(deps, cooking.id, day);

        db.faults.failWhen(writesTo(table));
        await expect(deleteHabit(deps, cooking.id)).rejects.toThrow(SimulatedStorageError);

        db.faults.failWhen(null);
        await expect(unitOfWork.run(({ habits }) => habits.listAll())).resolves.toEqual([cooking]);
        await expect(
          unitOfWork.run(({ checkIns }) => checkIns.listByHabit(cooking.id)),
        ).resolves.toHaveLength(2);
        await expect(unitOfWork.run(({ character }) => character.get())).resolves.toEqual(
          new Character(20),
        );
      },
    );

    it.each(['habits', 'settings_changes', 'character'])(
      'keeps name, difficulty and experience when %s cannot be written by updateHabit',
      async (table) => {
        const db = withFaults(await prepareAscentDatabase(openNodeSqliteDatabase()));
        const unitOfWork = new SqliteUnitOfWork(db);
        const deps = { clock: { today: () => day }, unitOfWork };
        const created = await createHabit(deps, 'Courir 5 km');
        const running = created.ok ? created.habit : (undefined as never);
        await toggleCheckIn(deps, running.id, day);
        const changes = () =>
          unitOfWork.run(({ settingsChanges }) => settingsChanges.listByHabit(running.id));
        const before = await changes();

        db.faults.failWhen(writesTo(table));
        await expect(
          updateHabit(deps, running.id, { name: 'Courir 10 km', difficulty: 'hard' }),
        ).rejects.toThrow(SimulatedStorageError);

        db.faults.failWhen(null);
        await expect(unitOfWork.run(({ habits }) => habits.listAll())).resolves.toEqual([running]);
        await expect(changes()).resolves.toEqual(before);
        await expect(unitOfWork.run(({ character }) => character.get())).resolves.toEqual(
          new Character(10),
        );
      },
    );

    it('creates neither the habit nor its settings change when the change cannot be written', async () => {
      const db = withFaults(await prepareAscentDatabase(openNodeSqliteDatabase()));
      const unitOfWork = new SqliteUnitOfWork(db);

      db.faults.failWhen(writesTo('settings_changes'));
      await expect(
        createHabit({ clock: { today: () => day }, unitOfWork }, 'Courir 5 km', 'hard'),
      ).rejects.toThrow(SimulatedStorageError);

      db.faults.failWhen(null);
      await expect(unitOfWork.run(({ habits }) => habits.listAll())).resolves.toEqual([]);
      await expect(
        unitOfWork.run(({ settingsChanges }) => settingsChanges.listAll()),
      ).resolves.toEqual([]);
    });

    it('fails to read a stored difficulty that is not one', async () => {
      const db = await prepareAscentDatabase(openNodeSqliteDatabase());
      const unitOfWork = new SqliteUnitOfWork(db);
      const created = await createHabit({ clock: { today: () => day }, unitOfWork }, 'Cuisiner');
      expect(created.ok).toBe(true);
      // Contourne la contrainte CHECK, comme une base abîmée.
      await db.exec('PRAGMA ignore_check_constraints = ON');
      await db.run("UPDATE settings_changes SET difficulty = 'extreme'");

      await expect(
        unitOfWork.run(({ settingsChanges }) => settingsChanges.listAll()),
      ).rejects.toThrow('Invalid difficulty: "extreme"');
    });

    it('reads a change made before the weekly target with an empty weekly target (R17)', async () => {
      const db = await prepareAscentDatabase(openNodeSqliteDatabase());
      const unitOfWork = new SqliteUnitOfWork(db);
      await createHabit({ clock: { today: () => day }, unitOfWork }, 'Cuisiner');
      await db.run(
        "INSERT INTO settings_changes (habit_id, changed_on, difficulty) VALUES (1, '2026-10-15', 'hard')",
      );

      await expect(
        unitOfWork.run(({ settingsChanges }) => settingsChanges.listAll()),
      ).resolves.toMatchObject([
        { difficulty: 'medium', weeklyTarget: 7 },
        { difficulty: 'hard', weeklyTarget: null },
      ]);
    });

    it('fails to read a stored weekly target that is not one', async () => {
      const db = await prepareAscentDatabase(openNodeSqliteDatabase());
      const unitOfWork = new SqliteUnitOfWork(db);
      await createHabit({ clock: { today: () => day }, unitOfWork }, 'Cuisiner');
      // Contourne la contrainte CHECK, comme une base abîmée.
      await db.exec('PRAGMA ignore_check_constraints = ON');
      await db.run('UPDATE settings_changes SET weekly_target = 9');

      await expect(
        unitOfWork.run(({ settingsChanges }) => settingsChanges.listAll()),
      ).rejects.toThrow('Invalid weekly target: 9');
    });

    it('fails to read a character missing from the database', async () => {
      const db = await prepareAscentDatabase(openNodeSqliteDatabase());
      await db.run('DELETE FROM character');

      await expect(
        new SqliteUnitOfWork(db).run(({ character }) => character.get()),
      ).rejects.toThrow('The character is missing from the database');
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
