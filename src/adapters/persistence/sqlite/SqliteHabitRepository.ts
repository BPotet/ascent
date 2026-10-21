import type { HabitRepository } from '../../../application/ports/HabitRepository';
import { Day } from '../../../domain/day/Day';
import { Habit, type HabitId } from '../../../domain/habit/Habit';
import { HabitName } from '../../../domain/habit/HabitName';
import type { SqlDatabase } from './SqlDatabase';

interface HabitRow {
  readonly id: number;
  readonly name: string;
  readonly created_on: string;
}

const toHabit = (row: HabitRow): Habit =>
  new Habit(row.id, HabitName.parse(row.name), Day.fromIsoString(row.created_on));

/** Habitudes dans la table `habits` (migration 0002). À utiliser dans une unité de travail. */
export class SqliteHabitRepository implements HabitRepository {
  constructor(private readonly db: SqlDatabase) {}

  async listAll(): Promise<Habit[]> {
    const rows = await this.db.getAll<HabitRow>(
      'SELECT id, name, created_on FROM habits ORDER BY id',
    );
    return rows.map(toHabit);
  }

  async findById(id: HabitId): Promise<Habit | null> {
    const row = await this.db.getFirst<HabitRow>(
      'SELECT id, name, created_on FROM habits WHERE id = ?',
      [id],
    );
    return row === null ? null : toHabit(row);
  }

  async add(name: HabitName, createdOn: Day): Promise<Habit> {
    const row = (await this.db.getFirst<HabitRow>(
      'INSERT INTO habits (name, name_key, created_on) VALUES (?, ?, ?) RETURNING id, name, created_on',
      [name.value, name.key, createdOn.toIsoString()],
    )) as HabitRow;
    return toHabit(row);
  }

  async rename(id: HabitId, name: HabitName): Promise<void> {
    await this.db.run('UPDATE habits SET name = ?, name_key = ? WHERE id = ?', [
      name.value,
      name.key,
      id,
    ]);
  }

  /** Les suivis de l'habitude sont effacés par `ON DELETE CASCADE` (`PRAGMA foreign_keys = ON`). */
  async remove(id: HabitId): Promise<void> {
    await this.db.run('DELETE FROM habits WHERE id = ?', [id]);
  }
}
