import { openNodeSqliteDatabase } from '../../testing/nodeSqliteDatabase';
import type { SqlDatabase } from '../SqlDatabase';
import { addWeeklyTarget } from './0006-add-weekly-target';
import { migrations } from '.';
import { readSchemaVersion, runMigrations } from './runMigrations';

const versionFive = migrations.slice(0, 5);
const insertHabit = 'INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?)';
const insertCheckIn = 'INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (?, ?, ?, ?)';
const insertChange =
  'INSERT INTO settings_changes (habit_id, changed_on, difficulty) VALUES (?, ?, ?)';
const insertChangeWithTarget =
  'INSERT INTO settings_changes (habit_id, changed_on, difficulty, weekly_target) VALUES (?, ?, ?, ?)';

describe('migration 0006: add the weekly target', () => {
  let db: SqlDatabase;

  const upgrade = () => runMigrations(db, [...versionFive, addWeeklyTarget]);
  const changes = () =>
    db.getAll(
      'SELECT sequence, habit_id, changed_on, difficulty, weekly_target FROM settings_changes',
    );

  beforeEach(async () => {
    db = openNodeSqliteDatabase();
    await db.exec('PRAGMA foreign_keys = ON');
    await runMigrations(db, versionFive);
  });

  afterEach(async () => {
    await db.close();
  });

  it('comes right after 0005 in the Ascent migrations', () => {
    expect(migrations.indexOf(addWeeklyTarget)).toBe(5);
    expect(addWeeklyTarget.version).toBe(6);
  });

  it('upgrades a database at version 5 with no habit', async () => {
    await upgrade();

    await expect(readSchemaVersion(db)).resolves.toBe(6);
    await expect(changes()).resolves.toEqual([]);
  });

  it('leaves the weekly target of every existing change empty (R17)', async () => {
    await db.run(insertHabit, ['Cuisiner', 'cuisiner', '2026-10-05']);
    await db.run(insertHabit, ['Budget du jour', 'budget du jour', '2026-10-13']);
    await db.run(insertChange, [1, '2026-10-05', 'medium']);
    await db.run(insertChange, [1, '2026-10-12', 'hard']);
    await db.run(insertChange, [2, '2026-10-13', 'easy']);

    await upgrade();

    await expect(changes()).resolves.toEqual([
      {
        sequence: 1,
        habit_id: 1,
        changed_on: '2026-10-05',
        difficulty: 'medium',
        weekly_target: null,
      },
      {
        sequence: 2,
        habit_id: 1,
        changed_on: '2026-10-12',
        difficulty: 'hard',
        weekly_target: null,
      },
      {
        sequence: 3,
        habit_id: 2,
        changed_on: '2026-10-13',
        difficulty: 'easy',
        weekly_target: null,
      },
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

  it('invents no value for the past: no default, no date computed in SQL (ADR 0003, §5)', () => {
    expect(addWeeklyTarget.sql).not.toMatch(/DEFAULT|NOT NULL|UPDATE|date\s*\(|CURRENT_/i);
  });

  describe('once applied', () => {
    beforeEach(async () => {
      await db.run(insertHabit, ['Cuisiner', 'cuisiner', '2026-10-05']);
      await upgrade();
    });

    it.each([1, 2, 3, 4, 5, 6, 7])('stores the weekly target %p (R3)', async (target) => {
      await db.run(insertChangeWithTarget, [1, '2026-10-14', 'medium', target]);

      await expect(changes()).resolves.toMatchObject([{ weekly_target: target }]);
    });

    it('stores a change without a weekly target, empty', async () => {
      await db.run(insertChange, [1, '2026-10-14', 'medium']);
      await db.run(insertChangeWithTarget, [1, '2026-10-14', 'medium', null]);

      await expect(changes()).resolves.toMatchObject([
        { weekly_target: null },
        { weekly_target: null },
      ]);
    });

    it.each([0, 8, -1, 2.5])('refuses the weekly target %p (R3)', async (target) => {
      await expect(
        db.run(insertChangeWithTarget, [1, '2026-10-14', 'medium', target]),
      ).rejects.toThrow(/CHECK constraint failed|cannot store/);
    });

    it('refuses a weekly target that is not a number', async () => {
      await expect(
        db.run(insertChangeWithTarget, [1, '2026-10-14', 'medium', 'trois']),
      ).rejects.toThrow(/datatype mismatch|cannot store/);
    });

    it('still erases the changes of a deleted habit', async () => {
      await db.run(insertChangeWithTarget, [1, '2026-10-14', 'hard', 3]);

      await db.run('DELETE FROM habits WHERE id = 1');

      await expect(changes()).resolves.toEqual([]);
    });
  });
});
