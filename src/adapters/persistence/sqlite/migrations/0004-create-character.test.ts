import { openNodeSqliteDatabase } from '../../testing/nodeSqliteDatabase';
import type { SqlDatabase } from '../SqlDatabase';
import { createKeyValue } from './0001-create-key-value';
import { createHabits } from './0002-create-habits';
import { createCheckIns } from './0003-create-check-ins';
import { createCharacter } from './0004-create-character';
import { migrations } from '.';
import { readSchemaVersion, runMigrations } from './runMigrations';

const versionThree = [createKeyValue, createHabits, createCheckIns];
const insertHabit = 'INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?)';
const insertCheckIn = 'INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (?, ?, ?, ?)';

describe('migration 0004: create character', () => {
  let db: SqlDatabase;

  const upgrade = () => runMigrations(db, [...versionThree, createCharacter]);
  const character = () => db.getAll('SELECT id, xp, retained_xp FROM character');

  beforeEach(async () => {
    db = openNodeSqliteDatabase();
    await db.exec('PRAGMA foreign_keys = ON');
    await runMigrations(db, versionThree);
  });

  afterEach(async () => {
    await db.close();
  });

  it('comes right after 0003 in the Ascent migrations', () => {
    expect(migrations.indexOf(createCharacter)).toBe(3);
    expect(createCharacter.version).toBe(4);
  });

  it('gives 0 Xp to the character of a database with no check-in', async () => {
    await upgrade();

    await expect(readSchemaVersion(db)).resolves.toBe(4);
    await expect(character()).resolves.toEqual([{ id: 1, xp: 0, retained_xp: 0 }]);
  });

  it('computes the experience from the check-ins « fait » already stored (R19)', async () => {
    await db.run(insertHabit, ['Cuisiner', 'cuisiner', '2026-10-05']);
    await db.run(insertHabit, ['Budget du jour', 'budget du jour', '2026-10-13']);
    for (const day of ['05', '06', '07', '09', '11', '13', '14']) {
      await db.run(insertCheckIn, [1, `2026-10-${day}`, 1, 0]);
    }

    await upgrade();

    await expect(character()).resolves.toEqual([{ id: 1, xp: 70, retained_xp: 0 }]);
  });

  it('counts every check-in « fait », corrected or in the future, and no « pas fait »', async () => {
    await db.run(insertHabit, ['Cuisiner', 'cuisiner', '2026-10-05']);
    await db.run(insertHabit, ['Budget du jour', 'budget du jour', '2026-10-05']);
    await db.run(insertCheckIn, [1, '2026-10-12', 1, 1]);
    await db.run(insertCheckIn, [1, '2026-10-13', 0, 1]);
    await db.run(insertCheckIn, [2, '2026-10-14', 1, 0]);
    await db.run(insertCheckIn, [2, '2026-10-20', 1, 0]);

    await upgrade();

    await expect(character()).resolves.toEqual([{ id: 1, xp: 30, retained_xp: 0 }]);
  });

  it('keeps the habits and the check-ins', async () => {
    await db.run(insertHabit, ['Cuisiner', 'cuisiner', '2026-10-05']);
    await db.run(insertCheckIn, [1, '2026-10-12', 1, 0]);

    await upgrade();

    await expect(db.getAll('SELECT name FROM habits')).resolves.toEqual([{ name: 'Cuisiner' }]);
    await expect(db.getAll('SELECT habit_id, day, done FROM check_ins')).resolves.toEqual([
      { habit_id: 1, day: '2026-10-12', done: 1 },
    ]);
  });

  describe('once applied', () => {
    beforeEach(upgrade);

    it('stores a single character', async () => {
      await expect(
        db.run('INSERT INTO character (id, xp, retained_xp) VALUES (2, 0, 0)'),
      ).rejects.toThrow(/CHECK constraint failed/);
      await expect(
        db.run('INSERT INTO character (id, xp, retained_xp) VALUES (1, 0, 0)'),
      ).rejects.toThrow(/UNIQUE constraint failed|PRIMARY KEY/);
    });

    it('refuses a negative experience or retained experience (R16)', async () => {
      await expect(db.run('UPDATE character SET xp = -10')).rejects.toThrow(
        /CHECK constraint failed/,
      );
      await expect(db.run('UPDATE character SET retained_xp = -10')).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it('refuses missing values and values of the wrong type', async () => {
      await expect(db.run('UPDATE character SET xp = NULL')).rejects.toThrow(/NOT NULL/);
      await expect(db.run('UPDATE character SET retained_xp = NULL')).rejects.toThrow(/NOT NULL/);
      await expect(db.run("UPDATE character SET xp = 'ten'")).rejects.toThrow(
        /datatype mismatch|cannot store/,
      );
    });

    it('accepts any experience from 0 up', async () => {
      await db.run('UPDATE character SET xp = 120, retained_xp = 20');

      await expect(character()).resolves.toEqual([{ id: 1, xp: 120, retained_xp: 20 }]);
    });
  });
});
