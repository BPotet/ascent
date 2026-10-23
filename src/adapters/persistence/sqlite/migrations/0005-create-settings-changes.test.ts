import { openNodeSqliteDatabase } from '../../testing/nodeSqliteDatabase';
import type { SqlDatabase } from '../SqlDatabase';
import { createKeyValue } from './0001-create-key-value';
import { createHabits } from './0002-create-habits';
import { createCheckIns } from './0003-create-check-ins';
import { createCharacter } from './0004-create-character';
import { createSettingsChanges } from './0005-create-settings-changes';
import { migrations } from '.';
import { readSchemaVersion, runMigrations } from './runMigrations';

const versionFour = [createKeyValue, createHabits, createCheckIns, createCharacter];
const insertHabit = 'INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?)';
const insertCheckIn = 'INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (?, ?, ?, ?)';
const insertChange =
  'INSERT INTO settings_changes (habit_id, changed_on, difficulty) VALUES (?, ?, ?)';

describe('migration 0005: create settings changes', () => {
  let db: SqlDatabase;

  const upgrade = () => runMigrations(db, [...versionFour, createSettingsChanges]);
  const changes = () =>
    db.getAll('SELECT sequence, habit_id, changed_on, difficulty FROM settings_changes');

  beforeEach(async () => {
    db = openNodeSqliteDatabase();
    await db.exec('PRAGMA foreign_keys = ON');
    await runMigrations(db, versionFour);
  });

  afterEach(async () => {
    await db.close();
  });

  it('comes right after 0004 in the Ascent migrations', () => {
    expect(migrations.indexOf(createSettingsChanges)).toBe(4);
    expect(createSettingsChanges.version).toBe(5);
  });

  it('upgrades a database at version 4 with no habit', async () => {
    await upgrade();

    await expect(readSchemaVersion(db)).resolves.toBe(5);
    await expect(changes()).resolves.toEqual([]);
  });

  it('gives every existing habit a change « Moyenne » dated from its day of creation (R2)', async () => {
    await db.run(insertHabit, ['Cuisiner', 'cuisiner', '2026-10-05']);
    await db.run(insertHabit, ['Lire', 'lire', '2026-10-06']);
    await db.run(insertHabit, ['Budget du jour', 'budget du jour', '2026-10-13']);
    await db.run('DELETE FROM habits WHERE id = 2');

    await upgrade();

    await expect(changes()).resolves.toEqual([
      { sequence: 1, habit_id: 1, changed_on: '2026-10-05', difficulty: 'medium' },
      { sequence: 2, habit_id: 3, changed_on: '2026-10-13', difficulty: 'medium' },
    ]);
  });

  it('keeps the habits, the check-ins and the experience exactly as they were', async () => {
    await db.run(insertHabit, ['Cuisiner', 'cuisiner', '2026-10-05']);
    await db.run(insertCheckIn, [1, '2026-10-12', 1, 0]);
    await db.run('UPDATE character SET xp = 70, retained_xp = 20');

    await upgrade();

    await expect(db.getAll('SELECT id, name, created_on FROM habits')).resolves.toEqual([
      { id: 1, name: 'Cuisiner', created_on: '2026-10-05' },
    ]);
    await expect(db.getAll('SELECT habit_id, day, done FROM check_ins')).resolves.toEqual([
      { habit_id: 1, day: '2026-10-12', done: 1 },
    ]);
    await expect(db.getAll('SELECT xp, retained_xp FROM character')).resolves.toEqual([
      { xp: 70, retained_xp: 20 },
    ]);
  });

  it('computes no date in SQL (ADR 0003)', () => {
    expect(createSettingsChanges.sql).not.toMatch(/date\s*\(|CURRENT_|DEFAULT/i);
  });

  describe('once applied', () => {
    beforeEach(async () => {
      await db.run(insertHabit, ['Cuisiner', 'cuisiner', '2026-10-05']);
      await upgrade();
    });

    it('stores a change of each difficulty, in increasing order of entry', async () => {
      await db.run(insertChange, [1, '2026-10-14', 'hard']);
      await db.run(insertChange, [1, '2026-10-14', 'easy']);

      await expect(changes()).resolves.toEqual([
        { sequence: 1, habit_id: 1, changed_on: '2026-10-05', difficulty: 'medium' },
        { sequence: 2, habit_id: 1, changed_on: '2026-10-14', difficulty: 'hard' },
        { sequence: 3, habit_id: 1, changed_on: '2026-10-14', difficulty: 'easy' },
      ]);
    });

    it('never reuses an order of entry', async () => {
      await db.run(insertChange, [1, '2026-10-14', 'hard']);
      await db.run('DELETE FROM settings_changes WHERE sequence = 2');
      await db.run(insertChange, [1, '2026-10-15', 'easy']);

      await expect(db.getAll('SELECT sequence FROM settings_changes')).resolves.toEqual([
        { sequence: 1 },
        { sequence: 3 },
      ]);
    });

    it.each(['Moyenne', 'MEDIUM', '', 'extreme'])('refuses the difficulty %p', async (value) => {
      await expect(db.run(insertChange, [1, '2026-10-14', value])).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it.each(['14/10/2026', '2026-10-4', '', 'today'])('refuses the day %p', async (day) => {
      await expect(db.run(insertChange, [1, day, 'hard'])).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it('refuses missing values and values of the wrong type', async () => {
      await expect(db.run(insertChange, [null, '2026-10-14', 'hard'])).rejects.toThrow(/NOT NULL/);
      await expect(db.run(insertChange, [1, null, 'hard'])).rejects.toThrow(/NOT NULL/);
      await expect(db.run(insertChange, [1, '2026-10-14', null])).rejects.toThrow(/NOT NULL/);
      await expect(db.run(insertChange, ['one', '2026-10-14', 'hard'])).rejects.toThrow(
        /datatype mismatch|cannot store/,
      );
    });

    it('refuses a change of a habit that does not exist', async () => {
      await expect(db.run(insertChange, [2, '2026-10-14', 'hard'])).rejects.toThrow(
        /FOREIGN KEY constraint failed/,
      );
    });

    it('erases the changes of a deleted habit', async () => {
      await db.run(insertChange, [1, '2026-10-14', 'hard']);

      await db.run('DELETE FROM habits WHERE id = 1');

      await expect(changes()).resolves.toEqual([]);
    });

    it('indexes the changes by habit, day and order of entry', async () => {
      await expect(
        db.getAll(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'settings_changes'",
        ),
      ).resolves.toContainEqual({ name: 'settings_changes_by_habit' });
    });
  });
});
