import { openNodeSqliteDatabase } from '../../testing/nodeSqliteDatabase';
import type { SqlDatabase } from '../SqlDatabase';
import { createIntroductions } from './0007-create-introductions';
import { migrations } from '.';
import { readSchemaVersion, runMigrations } from './runMigrations';

const versionSix = migrations.slice(0, 6);
const insertIntroduction = 'INSERT INTO introductions (name, introduced_on) VALUES (?, ?)';

describe('migration 0007: create the introductions', () => {
  let db: SqlDatabase;

  const upgrade = () => runMigrations(db, [...versionSix, createIntroductions]);
  const introductions = () => db.getAll('SELECT name, introduced_on FROM introductions');

  beforeEach(async () => {
    db = openNodeSqliteDatabase();
    await db.exec('PRAGMA foreign_keys = ON');
    await runMigrations(db, versionSix);
  });

  afterEach(async () => {
    await db.close();
  });

  it('comes right after 0006 in the Ascent migrations', () => {
    expect(migrations.indexOf(createIntroductions)).toBe(6);
    expect(createIntroductions.version).toBe(7);
  });

  it('upgrades a populated database at version 6 with an empty table, and keeps every data', async () => {
    await db.run("INSERT INTO habits (name, name_key, created_on) VALUES ('Courir', 'courir', ?)", [
      '2026-10-05',
    ]);
    await db.run(
      "INSERT INTO settings_changes (habit_id, changed_on, difficulty, weekly_target) VALUES (1, '2026-10-05', 'medium', 3)",
    );
    for (const day of ['2026-10-05', '2026-10-07', '2026-10-09']) {
      await db.run('INSERT INTO check_ins (habit_id, day, done, corrected) VALUES (1, ?, 1, 0)', [
        day,
      ]);
    }
    await db.run('UPDATE character SET xp = 30, retained_xp = 0');

    await upgrade();

    await expect(readSchemaVersion(db)).resolves.toBe(7);
    await expect(introductions()).resolves.toEqual([]);
    await expect(db.getAll('SELECT xp, retained_xp FROM character')).resolves.toEqual([
      { xp: 30, retained_xp: 0 },
    ]);
    await expect(db.getAll('SELECT day FROM check_ins ORDER BY day')).resolves.toHaveLength(3);
    await expect(db.getAll('SELECT weekly_target FROM settings_changes')).resolves.toEqual([
      { weekly_target: 3 },
    ]);
  });

  it('invents no value: no default, no update, no date computed in SQL (ADR 0003, §5)', () => {
    expect(createIntroductions.sql).not.toMatch(/DEFAULT|UPDATE|INSERT|date\s*\(|CURRENT_/i);
  });

  describe('once applied', () => {
    beforeEach(upgrade);

    it('stores the introduction of the target bonus, with its day', async () => {
      await db.run(insertIntroduction, ['targetBonus', '2026-10-14']);

      await expect(introductions()).resolves.toEqual([
        { name: 'targetBonus', introduced_on: '2026-10-14' },
      ]);
    });

    it('refuses the same introduction twice', async () => {
      await db.run(insertIntroduction, ['targetBonus', '2026-10-14']);

      await expect(db.run(insertIntroduction, ['targetBonus', '2026-10-15'])).rejects.toThrow(
        /UNIQUE constraint failed|PRIMARY KEY/,
      );
    });

    it.each(['weeklyTarget', 'TargetBonus', ''])('refuses the introduction %p', async (name) => {
      await expect(db.run(insertIntroduction, [name, '2026-10-14'])).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it.each(['14/10/2026', '2026-10-1', 'today'])('refuses the day %p', async (day) => {
      await expect(db.run(insertIntroduction, ['targetBonus', day])).rejects.toThrow(
        /CHECK constraint failed/,
      );
    });

    it('refuses an introduction without a name or a day', async () => {
      await expect(db.run(insertIntroduction, [null, '2026-10-14'])).rejects.toThrow(
        /NOT NULL constraint failed/,
      );
      await expect(db.run(insertIntroduction, ['targetBonus', null])).rejects.toThrow(
        /NOT NULL constraint failed/,
      );
    });
  });
});
