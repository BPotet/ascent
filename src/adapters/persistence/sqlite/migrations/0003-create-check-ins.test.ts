import { openNodeSqliteDatabase } from '../../testing/nodeSqliteDatabase';
import type { SqlDatabase } from '../SqlDatabase';
import { prepareAscentDatabase } from '../prepareAscentDatabase';
import { createKeyValue } from './0001-create-key-value';
import { createHabits } from './0002-create-habits';
import { createCheckIns } from './0003-create-check-ins';
import { migrations } from '.';
import { readSchemaVersion, runMigrations } from './runMigrations';

const insertCheckIn = 'INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (?, ?, ?, ?)';

describe('migration 0003: create check-ins', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    db = openNodeSqliteDatabase();
    await runMigrations(db, [createKeyValue, createHabits]);
    await db.run('INSERT INTO key_value (key, value) VALUES (?, ?)', ['theme', 'dark']);
    await db.run('INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?)', [
      'Cuisiner',
      'cuisiner',
      '2026-10-12',
    ]);
    await prepareAscentDatabase(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('comes right after 0002 in the Ascent migrations', () => {
    expect(migrations.indexOf(createCheckIns)).toBe(2);
    expect(createCheckIns.version).toBe(3);
  });

  it('upgrades a database at version 2 and keeps its data', async () => {
    await expect(readSchemaVersion(db)).resolves.toBe(3);
    await expect(db.getAll('SELECT key, value FROM key_value')).resolves.toEqual([
      { key: 'theme', value: 'dark' },
    ]);
    await expect(db.getAll('SELECT id, name, created_on FROM habits')).resolves.toEqual([
      { id: 1, name: 'Cuisiner', created_on: '2026-10-12' },
    ]);
    await expect(db.getAll('SELECT * FROM check_ins')).resolves.toEqual([]);
  });

  it('stores a check-in « fait », corrected or not, and a corrected « pas fait »', async () => {
    await db.run(insertCheckIn, [1, '2026-10-12', 1, 0]);
    await db.run(insertCheckIn, [1, '2026-10-13', 1, 1]);
    await db.run(insertCheckIn, [1, '2026-10-14', 0, 1]);

    await expect(db.getAll('SELECT * FROM check_ins ORDER BY day')).resolves.toEqual([
      { habit_id: 1, day: '2026-10-12', done: 1, corrected: 0 },
      { habit_id: 1, day: '2026-10-13', done: 1, corrected: 1 },
      { habit_id: 1, day: '2026-10-14', done: 0, corrected: 1 },
    ]);
  });

  it('never stores a « pas fait » without the mark « corrigé »', async () => {
    await expect(db.run(insertCheckIn, [1, '2026-10-14', 0, 0])).rejects.toThrow(
      /CHECK constraint failed/,
    );
  });

  it('refuses two check-ins of a habit on the same day', async () => {
    await db.run(insertCheckIn, [1, '2026-10-14', 1, 0]);

    await expect(db.run(insertCheckIn, [1, '2026-10-14', 0, 1])).rejects.toThrow(
      /UNIQUE constraint failed|PRIMARY KEY/,
    );
  });

  it.each([
    [2, 0],
    [0, 2],
    [-1, 1],
  ])('refuses done = %p and corrected = %p', async (done, corrected) => {
    await expect(db.run(insertCheckIn, [1, '2026-10-14', done, corrected])).rejects.toThrow(
      /CHECK constraint failed/,
    );
  });

  it.each(['14/10/2026', '2026-10-4', '', 'today'])('refuses the day %p', async (day) => {
    await expect(db.run(insertCheckIn, [1, day, 1, 0])).rejects.toThrow(/CHECK constraint failed/);
  });

  it('refuses missing values and values of the wrong type', async () => {
    await expect(db.run(insertCheckIn, [null, '2026-10-14', 1, 0])).rejects.toThrow(/NOT NULL/);
    await expect(db.run(insertCheckIn, [1, null, 1, 0])).rejects.toThrow(/NOT NULL/);
    await expect(db.run(insertCheckIn, [1, '2026-10-14', null, 0])).rejects.toThrow(/NOT NULL/);
    await expect(db.run(insertCheckIn, [1, '2026-10-14', 1, null])).rejects.toThrow(/NOT NULL/);
    await expect(db.run(insertCheckIn, [1, '2026-10-14', 'yes', 0])).rejects.toThrow(
      /datatype mismatch|cannot store/,
    );
  });

  it('refuses a check-in of a habit that does not exist', async () => {
    await expect(db.run(insertCheckIn, [2, '2026-10-14', 1, 0])).rejects.toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });

  it('erases the check-ins of a deleted habit', async () => {
    await db.run(insertCheckIn, [1, '2026-10-14', 1, 0]);

    await db.run('DELETE FROM habits WHERE id = 1');

    await expect(db.getAll('SELECT * FROM check_ins')).resolves.toEqual([]);
  });

  it('indexes the check-ins by day', async () => {
    await expect(
      db.getAll("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'check_ins'"),
    ).resolves.toContainEqual({ name: 'check_ins_by_day' });
  });
});
