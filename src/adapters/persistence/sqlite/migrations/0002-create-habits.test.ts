import { openNodeSqliteDatabase } from '../../testing/nodeSqliteDatabase';
import type { SqlDatabase } from '../SqlDatabase';
import { createKeyValue } from './0001-create-key-value';
import { createHabits } from './0002-create-habits';
import { migrations } from '.';
import { readSchemaVersion, runMigrations } from './runMigrations';

const insertHabit = 'INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?)';

describe('migration 0002: create habits', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    db = openNodeSqliteDatabase();
    await runMigrations(db, [createKeyValue]);
    await db.run('INSERT INTO key_value (key, value) VALUES (?, ?)', ['theme', 'dark']);
    await runMigrations(db, [createKeyValue, createHabits]);
  });

  afterEach(async () => {
    await db.close();
  });

  it('comes right after 0001 in the Ascent migrations', () => {
    expect(migrations.indexOf(createHabits)).toBe(1);
    expect(createHabits.version).toBe(2);
  });

  it('upgrades a database at version 1 and keeps its data', async () => {
    await expect(readSchemaVersion(db)).resolves.toBe(2);
    await expect(db.getAll('SELECT key, value FROM key_value')).resolves.toEqual([
      { key: 'theme', value: 'dark' },
    ]);
    await expect(db.getAll('SELECT * FROM habits')).resolves.toEqual([]);
  });

  it('stores a habit with its name, name key and day of creation', async () => {
    await db.run(insertHabit, ['Été 🍳', 'été 🍳', '2026-10-14']);

    await expect(db.getAll('SELECT id, name, name_key, created_on FROM habits')).resolves.toEqual([
      { id: 1, name: 'Été 🍳', name_key: 'été 🍳', created_on: '2026-10-14' },
    ]);
  });

  it('never reuses an id, so that ids follow the order of creation', async () => {
    await db.run(insertHabit, ['A', 'a', '2026-10-14']);
    await db.run(insertHabit, ['B', 'b', '2026-10-14']);
    await db.run('DELETE FROM habits WHERE id = 2');
    await db.run(insertHabit, ['C', 'c', '2026-10-14']);

    await expect(db.getAll('SELECT id FROM habits ORDER BY id')).resolves.toEqual([
      { id: 1 },
      { id: 3 },
    ]);
  });

  it('accepts names of 1 to 40 characters, counted as characters', async () => {
    await db.run(insertHabit, ['a', 'a', '2026-10-14']);
    await db.run(insertHabit, ['é'.repeat(40), 'é'.repeat(40), '2026-10-14']);
    await db.run(insertHabit, [`${'b'.repeat(39)}🍳`, 'b', '2026-10-14']);
  });

  it.each(['', 'a'.repeat(41)])('refuses the name %p', async (name) => {
    await expect(db.run(insertHabit, [name, `key ${name}`, '2026-10-14'])).rejects.toThrow(
      /CHECK constraint failed/,
    );
  });

  it('refuses two habits with the same name key', async () => {
    await db.run(insertHabit, ['Cuisiner', 'cuisiner', '2026-10-14']);

    await expect(db.run(insertHabit, ['cuisiner', 'cuisiner', '2026-10-14'])).rejects.toThrow(
      /UNIQUE constraint failed: habits.name_key/,
    );
  });

  it.each(['14/10/2026', '2026-10-4', '', 'today'])(
    'refuses the day of creation %p',
    async (createdOn) => {
      await expect(db.run(insertHabit, ['Cuisiner', 'cuisiner', createdOn])).rejects.toThrow(
        /CHECK constraint failed/,
      );
    },
  );

  it('refuses missing values and an id that is not a number', async () => {
    await expect(db.run(insertHabit, [null, 'cuisiner', '2026-10-14'])).rejects.toThrow(/NOT NULL/);
    await expect(db.run(insertHabit, ['Cuisiner', null, '2026-10-14'])).rejects.toThrow(/NOT NULL/);
    await expect(db.run(insertHabit, ['Cuisiner', 'cuisiner', null])).rejects.toThrow(/NOT NULL/);
    await expect(
      db.run('INSERT INTO habits (id, name, name_key, created_on) VALUES (?, ?, ?, ?)', [
        'one',
        'Cuisiner',
        'cuisiner',
        '2026-10-14',
      ]),
    ).rejects.toThrow(/datatype mismatch/);
  });
});
